"""S-07 (Codex H2): state read-modify-write must run under a single state lock.

S-02 made the *final write* atomic (tmp + os.replace under ``.state.lock``) so a
reader never sees a torn file. But ``set_phase()`` still ``load()``ed the JSON
*before* acquiring the lock, mutated it, then called ``save()`` (which took the
lock only for the write). Two concurrent writers could therefore load the same
old JSON, mutate *different* phases, and have the later ``save()`` clobber the
earlier writer's transition — a classic lost update.

These tests pin the fix: the WHOLE load->mutate->save sequence in ``set_phase()``
must hold ``.state.lock`` for its entire duration.

As elsewhere in the suite we redirect ``config.STATE_DIR`` to a per-test
``tmp_path`` so the real ``state/`` directory is never touched.
"""
from __future__ import annotations

import json

import pytest

from samagra import state


def _redirect_state_dir(monkeypatch, tmp_path):
    monkeypatch.setattr(state.config, "STATE_DIR", tmp_path)


def test_set_phase_loads_inside_lock(tmp_path, monkeypatch):
    """STRUCTURAL contract: set_phase() reads state AFTER taking the lock.

    We record an ordered event trace by wrapping ``state.file_lock`` (to mark
    lock-enter / lock-exit) and ``state._load_unlocked`` (to mark the read). The
    required order for a correct read-modify-write under one lock is:

        lock-enter -> load -> save -> lock-exit

    On the pre-fix code, ``set_phase`` calls ``load()`` (the public, unlocked
    read) BEFORE ``save()`` takes the lock, so the trace starts with ``load``
    before ``lock-enter`` and this assertion is RED.
    """
    _redirect_state_dir(monkeypatch, tmp_path)
    state.init("textbook")

    events: list[str] = []

    real_file_lock = state.file_lock

    from contextlib import contextmanager

    @contextmanager
    def spy_file_lock(*args, **kwargs):
        events.append("lock-enter")
        with real_file_lock(*args, **kwargs):
            try:
                yield
            finally:
                events.append("lock-exit")

    real_load_unlocked = state._load_unlocked
    real_save_unlocked = state._save_unlocked

    def spy_load_unlocked(pipeline):
        events.append("load")
        return real_load_unlocked(pipeline)

    def spy_save_unlocked(st):
        events.append("save")
        return real_save_unlocked(st)

    monkeypatch.setattr(state, "file_lock", spy_file_lock)
    monkeypatch.setattr(state, "_load_unlocked", spy_load_unlocked)
    monkeypatch.setattr(state, "_save_unlocked", spy_save_unlocked)

    state.set_phase("textbook", "draft", "done")

    # The read-modify-write of set_phase must occur inside exactly one lock span.
    assert "lock-enter" in events and "lock-exit" in events, events
    enter = events.index("lock-enter")
    exit_ = len(events) - 1 - events[::-1].index("lock-exit")
    load_i = events.index("load")
    save_i = events.index("save")

    assert enter < load_i, (
        f"set_phase must acquire the lock BEFORE reading state; got {events}"
    )
    assert load_i < save_i, (
        f"set_phase must load before save; got {events}"
    )
    assert save_i < exit_, (
        f"set_phase must save BEFORE releasing the lock; got {events}"
    )


def test_set_phase_no_lost_update(tmp_path, monkeypatch):
    """BEHAVIORAL: a competing write that lands at lock-acquisition is preserved.

    A correct read-modify-write reads state *after* it has taken the lock, so it
    always observes the latest committed bytes. We exploit exactly that: a
    competing writer commits a transition to a DIFFERENT phase ('enrich') at the
    moment the target writer *acquires the lock* (i.e. right at ``lock-enter``,
    before the target's in-lock read would run).

    - FIXED code (read inside the lock): the target's ``_load_unlocked`` runs
      after lock-enter, so it reads the competitor's just-committed 'enrich'
      change and preserves it. Both transitions survive -> GREEN.
    - PRE-FIX code (read before the lock): the target already captured stale
      JSON *before* ``save()`` ever touches the lock, so by the time the
      competitor writes at lock-enter the target's in-memory ``st`` is stale;
      the target's save then clobbers 'enrich' -> lost update -> RED.

    The competitor commits via the *unlocked* primitives so the injection point
    (a wrapper around ``file_lock``) does not itself deadlock on the same lock.
    The interleave is one-shot and deterministic — no real threads or timing.
    """
    _redirect_state_dir(monkeypatch, tmp_path)
    state.init("textbook")

    from contextlib import contextmanager

    real_file_lock = state.file_lock
    real_load_unlocked = state._load_unlocked
    real_save_unlocked = state._save_unlocked
    fired = {"done": False}

    @contextmanager
    def competing_at_lock_enter(*args, **kwargs):
        # At the instant the target writer takes the lock, a competing writer
        # commits a different-phase transition straight to disk (one-shot).
        if not fired["done"]:
            fired["done"] = True
            competitor = real_load_unlocked("textbook")
            competitor["phases"]["enrich"]["status"] = "done"
            real_save_unlocked(competitor)
        with real_file_lock(*args, **kwargs):
            yield

    monkeypatch.setattr(state, "file_lock", competing_at_lock_enter)

    # Target writer mutates 'draft'. On fixed code its read happens after the
    # competitor's 'enrich' commit (which fires at lock-enter), so it preserves
    # both. On pre-fix code its read already happened before the lock, so its
    # save drops the competitor's 'enrich' transition.
    state.set_phase("textbook", "draft", "done")

    path = state.config.STATE_DIR / "textbook.orchestrator_state.json"
    final = json.loads(path.read_text(encoding="utf-8"))

    assert final["phases"]["draft"]["status"] == "done", (
        "target writer's own transition must survive"
    )
    assert final["phases"]["enrich"]["status"] == "done", (
        "competing writer's transition must NOT be lost (lost-update bug)"
    )
