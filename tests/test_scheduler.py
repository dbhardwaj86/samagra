"""Phase D scheduler/gate tests (use a tmp STATE_DIR; no real state touched)."""
from __future__ import annotations

from samagra import scheduler, state


def test_gate_approve_marks_done(tmp_path, monkeypatch):
    monkeypatch.setattr(state.config, "STATE_DIR", tmp_path)
    state.init("textbook")
    state.set_phase("textbook", "draft", "done")
    state.set_phase("textbook", "enrich", "done")
    state.set_phase("textbook", "approve", "awaiting_gate")
    res = scheduler.gate("textbook", "approve")
    assert res["decision"] == "approve" and res["gate"] == "approve"
    assert state.load("textbook")["phases"]["approve"]["status"] == "done"


def test_gate_reject_blocks(tmp_path, monkeypatch):
    monkeypatch.setattr(state.config, "STATE_DIR", tmp_path)
    state.init("papers")
    res = scheduler.gate("papers", "reject")
    assert res["decision"] == "reject"
    assert state.load("papers")["phases"][res["gate"]]["status"] == "blocked"


def test_tick_dry_run_returns_log(tmp_path, monkeypatch):
    monkeypatch.setattr(state.config, "STATE_DIR", tmp_path)
    res = scheduler.tick(dry_run=True)
    assert res.get("dry_run") is True
    assert isinstance(res.get("log"), list)
