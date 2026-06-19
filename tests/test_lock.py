"""S-03 (F-06): atomic scheduler lock.

These tests pin the public contract of ``samagra.lock``:

* ``file_lock(path)`` is a context manager that acquires an *exclusive* lock.
* A second acquisition while the first is still held raises ``LockBusy``.
* ``is_busy(path)`` reflects whether the lock is currently held.
* Stale-lock reclamation is *guarded*: a lock older than the stale threshold
  may be reclaimed, but a fresh lock owned by a live holder must NOT be
  removed out from under it by another acquirer.
"""
from __future__ import annotations

import os
import time

import pytest

from samagra.lock import LockBusy, file_lock, is_busy


def test_exclusive_acquire_rejects_second_holder(tmp_path):
    """While one holder is inside file_lock(), a second acquire must fail.

    This is the atomicity contract: no two holders can both be inside the
    context for the same path at once.
    """
    lock = tmp_path / ".x.lock"
    with file_lock(lock):
        assert is_busy(lock) is True
        with pytest.raises(LockBusy):
            with file_lock(lock):
                pass  # pragma: no cover - must not be reached
    # released on exit
    assert is_busy(lock) is False


def test_lock_released_allows_reacquire(tmp_path):
    """After the first holder exits, the path is acquirable again."""
    lock = tmp_path / ".y.lock"
    with file_lock(lock):
        pass
    assert is_busy(lock) is False
    with file_lock(lock):
        assert is_busy(lock) is True


def test_stale_lock_is_reclaimed(tmp_path):
    """A lock file older than the stale threshold may be reclaimed."""
    lock = tmp_path / ".stale.lock"
    lock.parent.mkdir(parents=True, exist_ok=True)
    lock.write_text("old", encoding="utf-8")
    # backdate the file well past the stale threshold
    old = time.time() - 10_000
    os.utime(lock, (old, old))
    # a small stale threshold makes this lock stale -> acquirable
    with file_lock(lock, stale=1):
        assert is_busy(lock, stale=1) is True


def test_fresh_lock_not_removed_by_other_acquirer(tmp_path):
    """A genuinely fresh lock (live holder) must not be reclaimed/removed.

    Guarded stale removal: another acquirer that observes a *fresh* lock must
    raise LockBusy rather than deleting it. The original holder's lock file
    must survive the failed acquisition attempt.
    """
    lock = tmp_path / ".fresh.lock"
    with file_lock(lock):
        # second acquirer sees a fresh lock -> must refuse, not delete it
        with pytest.raises(LockBusy):
            with file_lock(lock):
                pass  # pragma: no cover
        # the original holder's lock must still be present
        assert lock.exists()
        assert is_busy(lock) is True
    # and only after the real holder exits is it gone
    assert not lock.exists()


def test_is_busy_false_when_absent(tmp_path):
    """No lock file -> not busy."""
    assert is_busy(tmp_path / ".none.lock") is False


def test_acquire_is_atomic_not_check_then_write(tmp_path):
    """Acquisition must be atomic, not check-then-write (the F-06 TOCTOU).

    The defect in the original impl was the two-step ``is_busy(); write_text()``
    sequence: a competing holder that writes the lock *between* the busy-check
    and the write was silently clobbered. We pin the fix by driving the precise
    interleaving: monkeypatch the busy-check to (wrongly) report free — modelling
    the window where this acquirer already passed its check — while a *fresh*
    competitor lock physically exists.

    A non-atomic ``write_text()`` overwrites the competitor and enters the
    context (RED). An atomic create that re-validates freshness before any
    destructive reclaim refuses, leaving the competitor's lock intact (GREEN).
    """
    import samagra.lock as lockmod

    lock = tmp_path / ".race.lock"
    lock.parent.mkdir(parents=True, exist_ok=True)
    # a competing live holder already owns the lock (fresh mtime)
    lock.write_text("competitor", encoding="utf-8")
    fresh = time.time()
    os.utime(lock, (fresh, fresh))

    # Model the TOCTOU window: this acquirer's *initial* busy-check returns
    # False, but the lock file is fresh and owned by a live competitor. An
    # atomic, race-safe acquire must NOT clobber it.
    calls = {"n": 0}
    real_is_busy = lockmod.is_busy

    def flaky_is_busy(*a, **k):
        # First call (the acquire pre-check) lies "free"; subsequent calls
        # (the guarded reclaim re-validation) tell the truth.
        calls["n"] += 1
        if calls["n"] == 1:
            return False
        return real_is_busy(*a, **k)

    import unittest.mock as mock

    with mock.patch.object(lockmod, "is_busy", flaky_is_busy):
        with pytest.raises(LockBusy):
            with file_lock(lock):
                pass  # pragma: no cover - must not be reached

    # the competitor's fresh lock must survive our refused acquisition
    assert lock.exists()
    assert lock.read_text(encoding="utf-8") == "competitor"


# ---------------------------------------------------------------------------
# S-08 (Codex H1): ownership-safe lock reclaim + release.
#
# Two invariants the lock must uphold even under concurrent stale reclaim:
#   (1) release must NOT delete a lock that someone else now owns;
#   (2) at most one holder may enter the critical section, even when two
#       acquirers race to reclaim the same stale lock.
# Auto-reclaim of a genuinely stale lock by a lone acquirer must still work.
# ---------------------------------------------------------------------------


def test_release_does_not_delete_foreign_lock(tmp_path):
    """Release must only delete the lock if we still own it.

    Scenario (the H1 unconditional-release bug): we acquire the lock and write
    our token. While we believe we hold it, a *different* owner replaces the
    lock file with their own token (e.g. after we were considered stale and
    they reclaimed it). When our context exits, the old code does an
    unconditional ``lock.unlink()`` in the ``finally`` and deletes the *other*
    owner's lock — leaving the critical section unprotected.

    A token-checked release reads the file and only unlinks when the bytes are
    still ours; here they are not, so the foreign lock must SURVIVE our exit.
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


def test_concurrent_stale_reclaim_yields_single_holder(tmp_path, monkeypatch):
    """Two acquirers racing to reclaim the SAME stale lock must not both win.

    We model the precise interleaving that breaks the old code:

      * A stale lock file exists (mtime well past the threshold).
      * Reclaimer A runs the full reclaim path and ends up holding a *fresh*
        lock (token A).
      * Reclaimer B had *already* passed its staleness checks while the lock
        was still stale (we model this by forcing ``is_busy`` to report free
        for B), so B proceeds into its destructive reclaim AFTER A is holding.

    Under the old code, B unconditionally ``os.unlink``s A's fresh lock and
    then ``_try_create`` succeeds — so BOTH A and B believe they hold the lock
    (two holders in the critical section). The race-safe design must let at
    most one win: B must observe that the lock it tries to steal is no longer
    the stale file it checked, and raise ``LockBusy`` instead of clobbering A.
    """
    import samagra.lock as lockmod

    lock = tmp_path / ".steal.lock"
    lock.parent.mkdir(parents=True, exist_ok=True)
    lock.write_text("STALE-DEAD-HOLDER", encoding="utf-8")
    old = time.time() - 10_000
    os.utime(lock, (old, old))

    # Reclaimer A acquires the (stale) lock for real and stays inside it.
    holder_a = file_lock(lock, stale=1)
    holder_a.__enter__()
    try:
        # A now holds a FRESH lock. Its file exists and is non-stale.
        assert lock.exists()
        a_bytes = lock.read_bytes()

        # Reclaimer B: model the interleave where B already decided the lock
        # was stale/free (its checks ran in the stale window) and now proceeds
        # into reclaim while A actually holds a fresh lock. Forcing is_busy to
        # report "free" reproduces B passing its staleness gate.
        monkeypatch.setattr(lockmod, "is_busy", lambda *a, **k: False)

        with pytest.raises(LockBusy):
            with file_lock(lock, stale=1):
                pass  # pragma: no cover - B must NOT enter the critical section

        # A's lock must be intact: B must not have clobbered the holder.
        assert lock.exists(), "B deleted A's fresh lock — two-holder window"
        assert lock.read_bytes() == a_bytes, "B clobbered A's lock content"
    finally:
        monkeypatch.undo()
        holder_a.__exit__(None, None, None)
    # After A exits, the lock is fully released.
    assert not lock.exists()


def test_lone_acquirer_still_reclaims_stale_lock(tmp_path):
    """Auto-reclaim must be preserved: a lone acquirer reclaims a stale lock.

    A crashed holder must not wedge the lock forever for the semi-autonomous
    scheduler. With no competing acquirer, a genuinely stale lock is still
    reclaimable and the new holder enters the critical section.
    """
    lock = tmp_path / ".lonestale.lock"
    lock.parent.mkdir(parents=True, exist_ok=True)
    lock.write_text("DEAD-HOLDER", encoding="utf-8")
    old = time.time() - 10_000
    os.utime(lock, (old, old))

    with file_lock(lock, stale=1):
        assert is_busy(lock, stale=1) is True
    # cleanly released by the new (live) holder
    assert is_busy(lock, stale=1) is False
    assert not lock.exists()
