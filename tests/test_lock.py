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
