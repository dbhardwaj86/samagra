"""File lock with staleness — mirrors physics-textbook's .routine.lock pattern.

Uses file mtime for the staleness check so it works regardless of the lock file's
content format (ours stores a timestamp; foreign locks may differ).
"""
from __future__ import annotations

import time
from contextlib import contextmanager
from pathlib import Path

STALE_SECONDS = 25 * 60


class LockBusy(RuntimeError):
    pass


def is_busy(lock: Path, stale: int = STALE_SECONDS) -> bool:
    if not lock.exists():
        return False
    return (time.time() - lock.stat().st_mtime) < stale


@contextmanager
def file_lock(lock: Path, stale: int = STALE_SECONDS):
    lock.parent.mkdir(parents=True, exist_ok=True)
    if is_busy(lock, stale):
        raise LockBusy(str(lock))
    lock.write_text(str(time.time()), encoding="utf-8")
    try:
        yield
    finally:
        try:
            lock.unlink()
        except FileNotFoundError:
            pass
