"""S-02 (F-07): atomic state writes + state lock, no GET-side writes.

These tests redirect ``config.STATE_DIR`` to a per-test ``tmp_path`` so the real
``state/`` directory is never touched. ``config.DATA_DB`` is already isolated by
the autouse conftest fixture, but ``STATE_DIR`` is not, so we redirect it here.
"""
from __future__ import annotations

import json
import os

import pytest

from samagra import state


def _redirect_state_dir(monkeypatch, tmp_path):
    monkeypatch.setattr(state.config, "STATE_DIR", tmp_path)


def test_save_is_atomic_and_locked(tmp_path, monkeypatch):
    _redirect_state_dir(monkeypatch, tmp_path)

    # (a) After an explicit save()/set_phase(), the on-disk JSON parses cleanly
    #     and no leftover *.tmp file remains in STATE_DIR.
    state.init("textbook")
    state.set_phase("textbook", "draft", "done")

    path = state.config.STATE_DIR / "textbook.orchestrator_state.json"
    assert path.exists(), "explicit mutation must persist the state file"
    parsed = json.loads(path.read_text(encoding="utf-8"))
    assert parsed["phases"]["draft"]["status"] == "done"

    leftover = list(state.config.STATE_DIR.glob("*.tmp"))
    assert leftover == [], f"no leftover temp files allowed, found {leftover}"

    # (b) A read-only access of a *missing* pipeline returns a sensible default
    #     in memory but creates NO file on disk (no GET-side write).
    missing_path = state.config.STATE_DIR / "papers.orchestrator_state.json"
    assert not missing_path.exists()
    st = state.load("papers")
    assert st["pipeline"] == "papers"
    assert st["current"] == state.PIPELINES["papers"]["phases"][0]
    assert not missing_path.exists(), "load() of a missing pipeline must not write to disk"

    # all_states() must likewise not persist defaults for the still-missing ones.
    before = {p.name for p in state.config.STATE_DIR.iterdir()}
    states = state.all_states()
    assert {s["pipeline"] for s in states} == set(state.PIPELINES)
    after = {p.name for p in state.config.STATE_DIR.iterdir()}
    assert after == before, "all_states() must not create state files as a side effect"

    # (c) save() routes through os.replace(tmp_path -> final_path).
    calls: list[tuple[str, str]] = []
    real_replace = os.replace

    def spy_replace(src, dst, *a, **k):
        calls.append((str(src), str(dst)))
        return real_replace(src, dst, *a, **k)

    monkeypatch.setattr(state.os, "replace", spy_replace)
    state.set_phase("textbook", "enrich", "done")
    assert calls, "save() must route through os.replace"
    src, dst = calls[-1]
    final = str(state.config.STATE_DIR / "textbook.orchestrator_state.json")
    assert dst == final, f"os.replace must target the final path, got {dst!r}"
    assert src.endswith(".tmp"), f"os.replace source must be a temp path, got {src!r}"
