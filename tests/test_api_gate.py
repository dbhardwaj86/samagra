"""S-04 (F-02): the gate API route must translate a refused gate decision into
HTTP 409, not a 200 with a silent JSON ``error`` body.

We exercise the route function directly (no live server / TestClient) so the test
has no extra HTTP dependency: ``api_gate`` should raise ``HTTPException`` with
status 409 when ``scheduler.gate`` refuses, and return the plain dict when it
succeeds.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException

from samagra import state
from samagra.api import app as api


def test_api_gate_returns_409_when_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(state.config, "STATE_DIR", tmp_path)
    state.init("textbook")  # prereqs incomplete, approve gate still pending

    with pytest.raises(HTTPException) as exc:
        api.api_gate("textbook", "approve")
    assert exc.value.status_code == 409
    assert "awaiting_gate" in str(exc.value.detail) or "prerequisites" in str(
        exc.value.detail
    )
    # The refused decision did not transition the gate.
    assert state.load("textbook")["phases"]["approve"]["status"] == "pending"


def test_api_gate_returns_result_when_valid(tmp_path, monkeypatch):
    monkeypatch.setattr(state.config, "STATE_DIR", tmp_path)
    state.init("textbook")
    state.set_phase("textbook", "draft", "done")
    state.set_phase("textbook", "enrich", "done")
    state.set_phase("textbook", "approve", "awaiting_gate")

    result = api.api_gate("textbook", "approve")
    assert result["decision"] == "approve" and result["gate"] == "approve"
    assert state.load("textbook")["phases"]["approve"]["status"] == "done"
