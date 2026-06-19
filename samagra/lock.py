"""Atomic file lock with ownership-safe, race-free stale reclaim.

Mirrors physics-textbook's ``.routine.lock`` pattern, hardened against the
TOCTOU race in F-06 *and* the concurrency/ownership races in Codex finding H1.

Acquisition is atomic: we create the lock with ``os.open(O_CREAT | O_EXCL)``,
which fails if the file already exists, and stamp a unique *ownership token*
into it. There is no check-then-write window for two processes to both win.

Stale reclaim is race-safe. A crashed holder must not wedge the lock forever
for the semi-autonomous scheduler, so a *genuinely stale* lock (mtime older
than ``stale`` seconds) is still reclaimable. But reclaim never uses a bare
``os.unlink`` + recreate (which let two concurrent reclaimers both clobber and
both win). Instead we *atomically steal* the stale file with ``os.rename`` to a
unique temp name: ``os.rename`` of a given source succeeds for exactly one
racer; every other racer gets ``FileNotFoundError`` and reports ``LockBusy``.
Only the steal-winner then re-creates the lock with ``O_CREAT | O_EXCL``; if
even that loses to a racing *fresh* acquirer, it reports ``LockBusy`` rather
than entering. Net invariant: AT MOST ONE holder at a time.

Release is ownership-safe. On exit we read the lock file and unlink it ONLY if
it still contains *our* token. If the bytes differ (someone else owns it now)
or the file is gone, we leave it alone — a holder can never delete another
owner's replacement lock.

``is_busy()`` uses the lock file's mtime so the staleness check works
regardless of content format (ours stores ``pid ns uuid``; foreign locks may
differ). It is kept consistent with the acquire scheme: a present, non-stale
lock reads as busy; an absent or stale lock reads as free.

Windows note: ``os.O_EXCL`` + ``os.open`` is honoured on Windows, and we always
close the file handle before unlinking/renaming (Windows refuses to delete or
rename an open file). The stale file's prior holder is dead, so it is not open;
the rename target is unique so it never pre-exists. No POSIX-only ``fcntl`` is
used.
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
    """True iff a lock file exists and is not yet stale."""
    try:
        mtime = lock.stat().st_mtime
    except FileNotFoundError:
        return False
    return (time.time() - mtime) < stale


def _make_token() -> bytes:
    """Return a process-unique ownership token for this acquisition."""
    return f"{os.getpid()} {time.time_ns()} {uuid.uuid4().hex}".encode("utf-8")


def _try_create(lock: Path, token: bytes) -> bool:
    """Atomically create the lock file and stamp our ownership token into it.

    Return True on success, False if the lock already exists. The handle is
    closed before returning so Windows can later unlink/rename it.
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


def _steal_stale(lock: Path, stale: int) -> bool:
    """Atomically steal a *stale* lock file out of the way via ``os.rename``.

    Returns True if *this* caller won the steal of a genuinely stale file (and
    should now try to create a fresh lock); False otherwise — meaning either
    another concurrent reclaimer already moved/removed the file, OR the file we
    actually moved turned out to be *fresh* (a live holder created a new lock in
    the gap between our staleness check and this steal). In the latter case we
    rename the fresh file back into place so the live holder keeps its lock, and
    report a lost steal so the caller raises ``LockBusy`` instead of clobbering.

    ``os.rename`` of a single source path is atomic: exactly one racer's rename
    of the same source succeeds; the rest raise ``FileNotFoundError``. The temp
    target is unique so it never collides with a live lock.
    """
    tmp = lock.with_name(f"{lock.name}.steal.{uuid.uuid4().hex}")
    try:
        os.rename(lock, tmp)
    except FileNotFoundError:
        # Another reclaimer stole/removed it first — we did not win.
        return False
    # We won the *rename*, but the file we grabbed must actually be stale. A
    # live holder may have created a fresh lock between our staleness check and
    # this rename; clobbering it would put two holders in the critical section.
    try:
        mtime = os.stat(tmp).st_mtime
    except FileNotFoundError:
        return False
    if (time.time() - mtime) < stale:
        # The stolen file is fresh — restore it for its live owner and back off.
        try:
            os.rename(tmp, lock)
        except (FileNotFoundError, FileExistsError, OSError):
            # If restoration loses a race (a fresh lock already exists at the
            # destination), drop our copy and report busy regardless.
            try:
                os.unlink(tmp)
            except FileNotFoundError:
                pass
        return False
    # Genuinely stale: best-effort remove the stolen file and claim victory.
    try:
        os.unlink(tmp)
    except FileNotFoundError:
        pass
    return True


@contextmanager
def file_lock(lock: Path, stale: int = STALE_SECONDS):
    lock = Path(lock)
    lock.parent.mkdir(parents=True, exist_ok=True)
    token = _make_token()

    if not _try_create(lock, token):
        # Lock file already exists. Only reclaim it if it is *genuinely* stale.
        # A fresh lock owned by a live holder is refused, not deleted.
        if is_busy(lock, stale):
            raise LockBusy(str(lock))
        # Stale: steal it atomically so concurrent reclaimers cannot both win.
        # Exactly one racer's rename of this source succeeds; the rest lose the
        # steal and report busy rather than clobbering the winner's fresh lock.
        if not _steal_stale(lock, stale):
            raise LockBusy(str(lock))
        # We won the steal. Claim a fresh lock with our token. If a racing fresh
        # acquirer already created one in the gap, we lose cleanly (no double
        # ownership) and report busy.
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
