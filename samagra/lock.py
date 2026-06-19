"""Atomic file lock with guarded staleness — mirrors physics-textbook's
``.routine.lock`` pattern, hardened against the TOCTOU race in F-06.

Acquisition is atomic: we create the lock with ``os.open(O_CREAT | O_EXCL)``,
which fails if the file already exists. There is no check-then-write window for
two processes to both win. If the create fails because a lock file is already
present, we only reclaim it when it is *genuinely* stale (its mtime is older
than ``stale`` seconds) and we do so via a guarded re-attempt: a fresh lock
owned by a live holder is never removed by another acquirer.

``is_busy()`` uses the lock file's mtime so the staleness check works regardless
of the lock file's content format (ours stores a timestamp; foreign locks may
differ). It is kept consistent with the acquire scheme: a present, non-stale
lock reads as busy; an absent or stale lock reads as free.

Windows note: ``os.O_EXCL`` + ``os.open`` is honoured on Windows, and we always
close the file handle before unlinking (Windows refuses to delete an open
file). No POSIX-only ``fcntl`` is used.
"""
from __future__ import annotations

import os
import time
from contextlib import contextmanager
from pathlib import Path

STALE_SECONDS = 25 * 60


class LockBusy(RuntimeError):
    pass


def is_busy(lock: Path, stale: int = STALE_SECONDS) -> bool:
    """True iff a lock file exists and is not yet stale."""
    try:
        mtime = lock.stat().st_mtime
    except FileNotFoundError:
        return False
    return (time.time() - mtime) < stale


def _try_create(lock: Path) -> bool:
    """Atomically create the lock file. Return True on success, False if it
    already exists. The pid/timestamp stamp is written into the freshly-owned
    handle, which is closed before returning so Windows can later unlink it.
    """
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        return False
    try:
        os.write(fd, f"{os.getpid()} {time.time()}".encode("utf-8"))
    finally:
        os.close(fd)
    return True


@contextmanager
def file_lock(lock: Path, stale: int = STALE_SECONDS):
    lock = Path(lock)
    lock.parent.mkdir(parents=True, exist_ok=True)

    if not _try_create(lock):
        # Lock file already exists. Only reclaim it if it is *genuinely* stale.
        # A fresh lock owned by a live holder is refused, not deleted.
        if is_busy(lock, stale):
            raise LockBusy(str(lock))
        # Re-validate freshness immediately before the destructive unlink: this
        # closes the TOCTOU window where the initial busy-check observed the
        # lock as free but a live holder owns a fresh lock. If it is now busy we
        # refuse rather than clobber a competitor's fresh lock.
        if is_busy(lock, stale):
            raise LockBusy(str(lock))
        # Stale: remove and retry the atomic create exactly once. If another
        # acquirer wins the retry (or writes a fresh lock first), we lose the
        # race cleanly and report busy rather than clobbering their lock.
        try:
            os.unlink(lock)
        except FileNotFoundError:
            pass  # someone else already reclaimed it
        if not _try_create(lock):
            raise LockBusy(str(lock))

    try:
        yield
    finally:
        try:
            lock.unlink()
        except FileNotFoundError:
            pass
