"""Tests for the mycontentdev pipeline entry and its scheduler reflector.

The McdClient is replaced by a fake returning canned seed-status rows, so the
status mapping is exercised with NO network access. State is redirected to a
tmp_path so tests don't touch the real state/ dir.
"""
from __future__ import annotations

import pytest

from samagra import scheduler, state


def test_mycontentdev_pipeline_registered():
    assert "mycontentdev" in state.PIPELINES
    spec = state.PIPELINES["mycontentdev"]
    assert spec["phases"] == ["capture", "enrich", "review", "publish"]
    assert spec["owners"] == {
        "capture": "human", "enrich": "claude2",
        "review": "claude1", "publish": "human",
    }
    assert "munshi" not in state.PIPELINES  # intake-only, no pipeline


def test_mycontentdev_pipeline_inits():
    spec = state.PIPELINES["mycontentdev"]
    # init builds a phase dict for every declared phase
    assert set(spec["phases"]) == {"capture", "enrich", "review", "publish"}


# ---------------- _reflect_mycontentdev ----------------

class FakeMcdClient:
    def __init__(self, statuses, avail=True):
        # statuses: list of seed status strings
        self._rows = [{"id": f"s{i}", "type": "concept", "title": f"t{i}",
                       "status": s, "created_at": "2026-06-01T00:00:00Z",
                       "updated_at": "2026-06-02T00:00:00Z"}
                      for i, s in enumerate(statuses)]
        self._avail = avail
        self.api_url = "https://mcd.example.dev"

    def available(self):
        return self._avail

    def query(self, sql):
        return self._rows


@pytest.fixture(autouse=True)
def _isolate_state(tmp_path, monkeypatch):
    monkeypatch.setattr(state.config, "STATE_DIR", tmp_path)
    yield


def test_reflect_skips_without_creds(monkeypatch):
    fake = FakeMcdClient([], avail=False)
    events = []
    out = scheduler._reflect_mycontentdev(dry=False, events=events,
                                          client=fake)
    assert out == {"skipped": "no mcd creds"}
    assert events == []


def test_reflect_review_gate_ready_when_draft_ready(monkeypatch):
    fake = FakeMcdClient(["captured", "draft_ready", "processing"])
    events = []
    scheduler._reflect_mycontentdev(dry=False, events=events, client=fake)
    st = state.load("mycontentdev")
    assert st["phases"]["review"]["status"] == "awaiting_gate"
    assert any(ev == "gate-ready" for ev, _ in events)


def test_reflect_changes_requested_triggers_review_gate(monkeypatch):
    # changes_requested is the OTHER half of the draft_ready OR — pin it directly.
    fake = FakeMcdClient(["captured", "changes_requested"])
    events = []
    scheduler._reflect_mycontentdev(dry=False, events=events, client=fake)
    st = state.load("mycontentdev")
    assert st["phases"]["review"]["status"] == "awaiting_gate"
    assert any(ev == "gate-ready" for ev, _ in events)


def test_reflect_publish_done_when_all_done(monkeypatch):
    fake = FakeMcdClient(["done", "done"])
    events = []
    scheduler._reflect_mycontentdev(dry=False, events=events, client=fake)
    st = state.load("mycontentdev")
    assert st["phases"]["publish"]["status"] == "done"


def test_reflect_publish_not_done_when_partial(monkeypatch):
    # Not all seeds done -> publish stays pending; a draft_ready still opens review.
    fake = FakeMcdClient(["done", "draft_ready"])
    events = []
    scheduler._reflect_mycontentdev(dry=False, events=events, client=fake)
    st = state.load("mycontentdev")
    assert st["phases"]["publish"]["status"] == "pending"
    assert st["phases"]["review"]["status"] == "awaiting_gate"


def test_reflect_dry_run_does_not_mutate_state(monkeypatch):
    fake = FakeMcdClient(["draft_ready"])
    events = []
    scheduler._reflect_mycontentdev(dry=True, events=events, client=fake)
    st = state.load("mycontentdev")
    # dry run still surfaces the event but never writes a non-pending phase
    assert st["phases"]["review"]["status"] == "pending"
    assert any(ev == "gate-ready" for ev, _ in events)
