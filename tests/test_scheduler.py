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


def test_gate_rejects_when_prereqs_incomplete(tmp_path, monkeypatch):
    """F-02: gate() must refuse to approve a gate whose prerequisites are not done.

    A freshly-initialized textbook pipeline has draft/enrich still ``pending`` and
    the ``approve`` gate still ``pending`` (never raised to ``awaiting_gate``).
    Approving here must be REFUSED and must NOT mark the gate ``done``.
    """
    monkeypatch.setattr(state.config, "STATE_DIR", tmp_path)
    state.init("textbook")  # all phases pending; approve never reached awaiting_gate

    res = scheduler.gate("textbook", "approve")

    # Refused: a structured error, and the gate is untouched (still pending).
    assert "error" in res, f"expected refusal, got {res!r}"
    assert state.load("textbook")["phases"]["approve"]["status"] == "pending"

    # Even raising the gate to awaiting_gate is not enough while prereqs are
    # incomplete — prior phases must all be done.
    state.set_phase("textbook", "approve", "awaiting_gate")
    res2 = scheduler.gate("textbook", "approve")
    assert "error" in res2, f"expected refusal (prereqs incomplete), got {res2!r}"
    assert state.load("textbook")["phases"]["approve"]["status"] == "awaiting_gate"

    # Conversely: once prereqs are done AND the gate is awaiting_gate, approve works.
    state.set_phase("textbook", "draft", "done")
    state.set_phase("textbook", "enrich", "done")
    state.set_phase("textbook", "approve", "awaiting_gate")
    res3 = scheduler.gate("textbook", "approve")
    assert res3.get("decision") == "approve" and res3.get("gate") == "approve"
    assert state.load("textbook")["phases"]["approve"]["status"] == "done"


def test_gate_reject_blocks(tmp_path, monkeypatch):
    monkeypatch.setattr(state.config, "STATE_DIR", tmp_path)
    state.init("papers")
    # F-02: a reject decision, like approve, is only valid once the gate is
    # actually awaiting approval with all prior phases done. (Previously this
    # test rejected papers/finalize straight from `pending` — relying on the bug.)
    state.set_phase("papers", "link", "done")
    state.set_phase("papers", "build", "done")
    state.set_phase("papers", "finalize", "awaiting_gate")
    res = scheduler.gate("papers", "reject")
    assert res["decision"] == "reject"
    assert state.load("papers")["phases"][res["gate"]]["status"] == "blocked"


def test_tick_dry_run_returns_log(tmp_path, monkeypatch):
    monkeypatch.setattr(state.config, "STATE_DIR", tmp_path)
    res = scheduler.tick(dry_run=True)
    assert res.get("dry_run") is True
    assert isinstance(res.get("log"), list)
