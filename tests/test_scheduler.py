"""Phase D scheduler/gate tests (use a tmp STATE_DIR; no real state touched)."""
from __future__ import annotations

from samagra import catalog, notify, scheduler, state


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


def test_tick_survives_failed_adapter(tmp_path, monkeypatch):
    """S-06 (Codex H3): a failed adapter must not crash a live tick.

    ``catalog.refresh()`` maps a FAILED source to ``None`` in its totals dict.
    ``tick()`` must count only the successful artifacts (5, not crash on the
    ``None``) and surface the failed source ("bad") in the log and via a
    ``failure`` notify event — never silently hide it.
    """
    monkeypatch.setattr(state.config, "STATE_DIR", tmp_path)
    # Live refresh returns None for the failed source; tick must not sum it.
    monkeypatch.setattr(catalog, "refresh", lambda verbose=False: {"good": 5, "bad": None})

    # Capture notify events without touching any real channel.
    notified: list = []
    monkeypatch.setattr(notify, "notify",
                        lambda event, message, *a, **k: notified.append((event, message)))

    res = scheduler.tick(dry_run=False)  # NO exception must escape

    assert "skipped" not in res, f"tick should run, got {res!r}"
    log_text = "\n".join(res["log"])
    # Only successful artifacts counted (5), and the failed source is named.
    assert "5" in log_text, f"successful count (5) must appear in log:\n{log_text}"
    assert "bad" in log_text, f"failed source must be surfaced in log:\n{log_text}"
    # The failure is also raised as a notify event naming the failed source.
    assert any(ev == "failure" and "bad" in msg for ev, msg in notified), (
        f"expected a failure notify naming 'bad', got {notified!r}"
    )
    assert "failure" in res.get("events", []), (
        f"failure event must be reported in res['events'], got {res!r}"
    )
