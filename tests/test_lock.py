"""S-09 (Codex H1, simple fix): exclusive O_EXCL lock, NO auto-reclaim.

These tests pin the *new, honest* public contract of ``samagra.lock``:

* ``file_lock(path)`` is a context manager that acquires an *exclusive* lock via
  ``os.open(O_CREAT | O_EXCL)`` and stamps a unique ownership token.
* A present lock file ALWAYS means "taken": a second acquisition raises
  ``LockBusy`` immediately — even if the file is very old (NO staleness-based
  stealing, NO reclaim, NO rename). This is what makes the lock provably
  single-holder.
* Release is ownership-safe: the lock is unlinked on exit ONLY if it still
  contains our token; a foreign replacement is left untouched.
* ``is_busy(path, stale=...)`` is retained ONLY to read the age/liveness of a
  *foreign* lock (the physics-textbook ``TEXTBOOK_LOCK``). It is NOT how SAMAGRA
  acquires its own locks.
* ``clear(path)`` best-effort removes a lock file (used by ``samagra unlock``).

A crashed holder that left its lock is cleared MANUALLY by the operator via
``samagra unlock`` — never auto-reclaimed by an acquirer.
"""
from __future__ import annotations

import os
import time

import pytest

from samagra.lock import LockBusy, clear, file_lock, is_busy


def test_exclusive_acquire_rejects_second_holder(tmp_path):
    """While one holder is inside file_lock(), a second acquire must fail.

    This is the atomicity contract: no two holders can both be inside the
    context for the same path at once.
    """
    lock = tmp_path / ".x.lock"
    with file_lock(lock):
        with pytest.raises(LockBusy):
            with file_lock(lock):
                pass  # pragma: no cover - must not be reached
    # released on exit
    assert not lock.exists()


def test_lock_released_allows_reacquire(tmp_path):
    """After the first holder exits, the path is acquirable again."""
    lock = tmp_path / ".y.lock"
    with file_lock(lock):
        pass
    assert not lock.exists()
    with file_lock(lock):
        assert lock.exists()


def test_present_lock_is_always_busy(tmp_path):
    """A present lock file — even with a very OLD mtime — refuses acquisition.

    The new contract REMOVES auto-reclaim: ``file_lock`` never inspects mtime to
    decide whether to steal a stale lock. A present file always means "taken", so
    even a lock backdated far past the old stale threshold makes ``file_lock``
    raise ``LockBusy``.

    On the OLD code this is RED (the stale lock was reclaimed and the acquirer
    entered the context); after removing auto-reclaim this is GREEN.
    """
    lock = tmp_path / ".ancient.lock"
    lock.parent.mkdir(parents=True, exist_ok=True)
    lock.write_text("DEAD-HOLDER", encoding="utf-8")
    # backdate the file far past any plausible stale threshold
    old = time.time() - 10_000
    os.utime(lock, (old, old))

    with pytest.raises(LockBusy):
        with file_lock(lock):
            pass  # pragma: no cover - must not be reached


def test_stale_lock_is_not_stolen_or_removed(tmp_path):
    """A refused acquire must not steal, move, or delete the existing lock.

    After ``file_lock`` refuses a present (old) lock, that lock file must still
    EXIST with its ORIGINAL content — we never rename/steal/unlink a foreign or
    pre-existing lock during acquisition. There must also be no stray ``*.steal.*``
    temp files left behind (the old reclaim path created those).
    """
    lock = tmp_path / ".keep.lock"
    lock.parent.mkdir(parents=True, exist_ok=True)
    lock.write_text("DEAD-HOLDER", encoding="utf-8")
    old = time.time() - 10_000
    os.utime(lock, (old, old))

    with pytest.raises(LockBusy):
        with file_lock(lock):
            pass  # pragma: no cover

    # untouched: same file, same bytes
    assert lock.exists(), "a refused acquire must not delete the existing lock"
    assert lock.read_text(encoding="utf-8") == "DEAD-HOLDER"
    # no steal/temp artifacts left in the directory
    strays = [p.name for p in tmp_path.iterdir() if ".steal." in p.name]
    assert strays == [], f"acquire left stray steal temp files: {strays}"


def test_acquire_is_atomic_o_excl(tmp_path):
    """Acquisition is a single atomic O_CREAT|O_EXCL create, never check-then-write.

    If the file already exists, ``file_lock`` must refuse immediately and leave a
    pre-existing competitor's lock byte-for-byte intact (no clobbering window).
    """
    lock = tmp_path / ".race.lock"
    lock.parent.mkdir(parents=True, exist_ok=True)
    # a competing live holder already owns the lock (fresh mtime)
    lock.write_text("competitor", encoding="utf-8")
    fresh = time.time()
    os.utime(lock, (fresh, fresh))

    with pytest.raises(LockBusy):
        with file_lock(lock):
            pass  # pragma: no cover - must not be reached

    # the competitor's lock must survive our refused acquisition, unchanged
    assert lock.exists()
    assert lock.read_text(encoding="utf-8") == "competitor"


def test_is_busy_false_when_absent(tmp_path):
    """No lock file -> not busy (used for reading a foreign lock's liveness)."""
    assert is_busy(tmp_path / ".none.lock") is False


def test_is_busy_reads_foreign_lock_age(tmp_path):
    """``is_busy`` reports a fresh foreign lock busy and a stale one free.

    ``is_busy`` is retained ONLY to read the age/liveness of a foreign lock (the
    physics-textbook routine lock), NOT to acquire SAMAGRA's own locks. A present
    non-stale file reads busy; a backdated one reads free.
    """
    foreign = tmp_path / ".routine.lock"
    foreign.write_text("physics-textbook", encoding="utf-8")
    fresh = time.time()
    os.utime(foreign, (fresh, fresh))
    assert is_busy(foreign, stale=60) is True

    old = time.time() - 10_000
    os.utime(foreign, (old, old))
    assert is_busy(foreign, stale=60) is False


# ---------------------------------------------------------------------------
# Ownership-safe release (kept from S-08): release must never delete a lock
# that someone else now owns.
# ---------------------------------------------------------------------------


def test_release_does_not_delete_foreign_lock(tmp_path):
    """Release must only delete the lock if we still own it.

    We acquire the lock and write our token. While we believe we hold it, a
    *different* owner replaces the lock file with their own token. When our
    context exits, a token-checked release reads the file and only unlinks when
    the bytes are still ours; here they are not, so the foreign lock must SURVIVE
    our exit.
    """
    lock = tmp_path / ".foreign.lock"
    with file_lock(lock):
        # the lock now contains OUR ownership token. Simulate a different owner
        # taking over by overwriting it with a foreign token while we "hold" it.
        lock.write_text("FOREIGN-OWNER-TOKEN", encoding="utf-8")
        foreign_mtime = time.time()
        os.utime(lock, (foreign_mtime, foreign_mtime))
    # On exit our release must NOT have clobbered the foreign owner's lock.
    assert lock.exists(), "release deleted a lock owned by someone else"
    assert lock.read_text(encoding="utf-8") == "FOREIGN-OWNER-TOKEN"


# ---------------------------------------------------------------------------
# clear(): best-effort removal used by the `samagra unlock` CLI.
# ---------------------------------------------------------------------------


def test_clear_removes_present_lock_and_reports(tmp_path):
    """``clear`` removes a present lock and returns True; False when absent."""
    lock = tmp_path / ".scheduler.lock"
    lock.write_text("whatever", encoding="utf-8")
    assert clear(lock) is True
    assert not lock.exists()
    # idempotent / safe when already gone
    assert clear(lock) is False
    assert clear(tmp_path / ".never-existed.lock") is False


# ---------------------------------------------------------------------------
# `samagra unlock` CLI: manual clearing of SAMAGRA's OWN crashed locks.
# ---------------------------------------------------------------------------


def test_cmd_unlock_clears_own_locks(tmp_path, monkeypatch, capsys):
    """``cmd_unlock`` removes SAMAGRA's own scheduler/state locks and names them.

    The operator runs ``samagra unlock`` to clear a lock left by a crashed run.
    It must remove ``.scheduler.lock`` and ``.state.lock`` under ``STATE_DIR``,
    report which were present, and never touch the FOREIGN ``TEXTBOOK_LOCK``.
    """
    import argparse

    from samagra import __main__ as cli

    monkeypatch.setattr(cli.config, "STATE_DIR", tmp_path)
    sched = tmp_path / ".scheduler.lock"
    st = tmp_path / ".state.lock"
    sched.write_text("crashed", encoding="utf-8")
    st.write_text("crashed", encoding="utf-8")

    cli.cmd_unlock(argparse.Namespace())

    out = capsys.readouterr().out
    assert not sched.exists(), "scheduler lock must be removed"
    assert not st.exists(), "state lock must be removed"
    assert ".scheduler.lock" in out
    assert ".state.lock" in out


def test_cmd_unlock_safe_when_no_locks(tmp_path, monkeypatch, capsys):
    """``cmd_unlock`` is a no-op (no error) when no SAMAGRA locks are present."""
    import argparse

    from samagra import __main__ as cli

    monkeypatch.setattr(cli.config, "STATE_DIR", tmp_path)

    cli.cmd_unlock(argparse.Namespace())  # must not raise

    out = capsys.readouterr().out
    assert "no SAMAGRA locks present" in out
