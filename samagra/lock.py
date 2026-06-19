"""Exclusive file lock — present == busy, with manual recovery (no auto-reclaim).

Acquisition is a single atomic operation: we create the lock with
``os.open(O_CREAT | O_EXCL)``, which fails if the file already exists, and stamp
a unique *ownership token* into it. There is no check-then-write window for two
processes to both win.

A present lock file ALWAYS means "taken". There is NO staleness-based stealing,
NO automatic reclaim, NO rename. This is what makes the lock *provably*
single-holder: a holder exists for exactly as long as its lock file exists, and
nobody else may create that file while it is present. We deliberately removed
the older "atomically steal a stale lock" path because it briefly exposed an
absent canonical lock and admitted a second/third holder under a three-acquirer
interleave (Codex H1). Correctness here beats convenience.

A crashed holder that left its lock behind does NOT auto-clear. It is cleared
MANUALLY by the operator via ``samagra unlock`` (see ``clear`` below), and the
scheduler surfaces a present-but-old own-lock as a likely crashed run so the
operator knows to run it.

Release is ownership-safe. On exit we read the lock file and unlink it ONLY if
it still contains *our* token. If the bytes differ (someone else owns it now) or
the file is gone, we leave it alone — a holder can never delete another owner's
lock.

``is_busy()`` is retained ONLY to read the age/liveness of a *foreign* lock — the
physics-textbook ``.routine.lock`` — so SAMAGRA can coexist with that system's
own automations. It is mtime-based so it works regardless of the foreign lock's
content format. It is NOT how SAMAGRA acquires its own locks (own locks:
present == busy, period).

Windows note: ``os.O_EXCL`` + ``os.open`` is honoured on Windows, and we always
close the file handle before unlinking (Windows refuses to delete an open file).
No POSIX-only ``fcntl`` is used.
"""
from __future__ import annotations

import os
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

STALE_SECONDS = 25 * 60


class LockBusy(RuntimeError):
    pass


def is_busy(lock: Path, stale: int = STALE_SECONDS) -> bool:
    """True iff a FOREIGN lock file exists and is not yet stale (mtime-based).

    Use this ONLY to read the age/liveness of an *external* lock — e.g. the
    physics-textbook ``.routine.lock`` — so SAMAGRA can coexist with that
    system's automations. It is mtime-based so it works regardless of the foreign
    lock's content format.

    This is NOT how SAMAGRA's OWN locks are acquired or checked: an own lock is
    "busy" whenever its file is present (see ``file_lock``), with no staleness
    consideration. Do not gate ``file_lock`` on this.
    """
    try:
        mtime = lock.stat().st_mtime
    except FileNotFoundError:
        return False
    return (time.time() - mtime) < stale


def clear(lock: Path) -> bool:
    """Best-effort remove a lock file. Returns True iff a file was removed.

    Used by the ``samagra unlock`` CLI to MANUALLY clear an own-lock left behind
    by a crashed run. There is no token check here — clearing is an explicit
    operator action, not an acquirer stealing a peer's live lock.
    """
    try:
        Path(lock).unlink()
        return True
    except FileNotFoundError:
        return False
    except OSError:
        return False


def _make_token() -> bytes:
    """Return a process-unique ownership token for this acquisition."""
    return f"{os.getpid()} {time.time_ns()} {uuid.uuid4().hex}".encode("utf-8")


def _try_create(lock: Path, token: bytes) -> bool:
    """Atomically create the lock file and stamp our ownership token into it.

    Return True on success, False if the lock already exists. The handle is
    closed before returning so Windows can later unlink it.
    """
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        return False
    try:
        os.write(fd, token)
    finally:
        os.close(fd)
    return True


@contextmanager
def file_lock(lock: Path):
    """Acquire an exclusive lock via O_CREAT|O_EXCL; present == busy.

    If the lock file already exists, raise ``LockBusy`` IMMEDIATELY — no
    staleness check, no reclaim, no rename. On exit, release is ownership-safe:
    unlink only if the file still holds our token.
    """
    lock = Path(lock)
    lock.parent.mkdir(parents=True, exist_ok=True)
    token = _make_token()

    # A present lock ALWAYS means taken. No reclaim, no steal, no rename.
    if not _try_create(lock, token):
        raise LockBusy(str(lock))

    try:
        yield
    finally:
        # Ownership-safe release: unlink ONLY if the lock still holds OUR token.
        # If someone else owns it now (different bytes) or it is gone, leave it.
        try:
            current = lock.read_bytes()
        except FileNotFoundError:
            current = None
        if current == token:
            try:
                lock.unlink()
            except FileNotFoundError:
                pass
