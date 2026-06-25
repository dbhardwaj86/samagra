from samagra.factory import run


def test_plan_lane_samadhan_proposes_only_that_lane(monkeypatch):
    props = run.plan("textbook:circular-motion", dry=True, lane="samadhan")
    assert [p["line"] for p in props] == ["samadhan"]


def test_plan_lane_rejects_mismatched_prefix():
    import pytest
    with pytest.raises(ValueError):
        run.plan("munshi:5", dry=True, lane="samadhan")


def test_plan_without_lane_is_unchanged(monkeypatch):
    props = run.plan("textbook:circular-motion", dry=True)
    assert "samadhan" not in [p["line"] for p in props]


# --- D2 wiring: build() llm preflight (anti-wedge) + capture/changes gate ----
import json
from pathlib import Path

import pytest

from samagra import config
from samagra.factory import samadhan
from samagra.factory.style import profile as P
from samagra.clients import llm_client
from samagra.governance import store

FACETS = {"voice": {"mean_sentence_len": 16.0, "second_person_rate": 0.08,
                    "hedge_rate": 0.05, "imperative_rate": 0.1},
          "sequencing": {"mean_sections_per_chapter": 5.0},
          "analogy": {"analogy_block_rate": 0.03},
          "rigor": {"flags_per_section": 0.9}, "selection": {"callout_density": 0.2}}


class FakeLLM:
    def __init__(self, verdicts):
        self._verdicts = verdicts
    def generate_samadhan(self, chapter, *, system):
        return {"items": [{"concept": "c", "misconception": "m",
                           "correction": "k", "why": "w"}]}
    def review_samadhan(self, items, chapter):
        return {"verdicts": self._verdicts}


@pytest.fixture()
def env(tmp_path, monkeypatch):
    # Isolate governance.db (mirrors tests/test_factory_run.py::factory_env:
    # connect() does NOT create the schema; repoint + clear init cache + create).
    monkeypatch.setattr(config, "GOVERNANCE_DB", tmp_path / "governance.db")
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
    store._INITIALIZED.clear()
    store.ensure_tables()
    monkeypatch.chdir(tmp_path)          # outbox writes board/<agent>/outbox/ under tmp
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "styleseed")
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "lectures")
    monkeypatch.setattr(P, "_now", lambda: "t")
    P.save(P.StyleSeed(0, FACETS, "h", "t"))
    from samagra.lectures import render
    monkeypatch.setattr(render, "load_chapter",
                        lambda slug: {"title": "Circular Motion", "subtitle": "",
                                      "sections": []})
    monkeypatch.setattr(llm_client, "configured", lambda: True)
    yield tmp_path
    store._INITIALIZED.clear()


def _approve_and_build(seed_ref):
    props = run.plan(seed_ref, dry=False, lane="samadhan")
    run.approve_seed(seed_ref)
    return run.build(props[0]["assignment_id"])


def test_clean_brief_is_captured(env, monkeypatch):
    monkeypatch.setattr(samadhan.llm_client, "LLMClient",
                        lambda: FakeLLM([{"idx": 0, "verdict": "ok", "rationale": "r"}]))
    res = _approve_and_build("textbook:circular-motion")
    assert res["line"] == "samadhan"
    from samagra.governance import store
    c = store.connect()
    try:
        a = [x for x in store.list_assignments(c) if x["id"] == res["assignment_id"]][0]
    finally:
        c.close()
    assert a["status"] == "captured"


def test_error_brief_lands_in_changes_not_captured(env, monkeypatch):
    monkeypatch.setattr(samadhan.llm_client, "LLMClient",
                        lambda: FakeLLM([{"idx": 0, "verdict": "error", "rationale": "wrong"}]))
    res = _approve_and_build("textbook:x")
    from samagra.governance import store
    c = store.connect()
    try:
        a = [x for x in store.list_assignments(c) if x["id"] == res["assignment_id"]][0]
        assert a["status"] == "changes"
        verbs = [e["verb"] for e in store.list_events_for_assignment(c, res["assignment_id"])]
        assert "product_created" in verbs
    finally:
        c.close()


def test_missing_key_refuses_before_intent_no_wedge(env, monkeypatch):
    monkeypatch.setattr(llm_client, "configured", lambda: False)
    props = run.plan("textbook:circular-motion", dry=False, lane="samadhan")
    run.approve_seed("textbook:circular-motion")
    aid = props[0]["assignment_id"]
    with pytest.raises(RuntimeError):
        run.build(aid)
    from samagra.governance import store
    c = store.connect()
    try:
        verbs = [e["verb"] for e in store.list_events_for_assignment(c, aid)]
        a = [x for x in store.list_assignments(c) if x["id"] == aid][0]
    finally:
        c.close()
    assert "product_building" not in verbs and a["status"] == "approved"


# --- DEC-7 remediation: the LLM produce window must not permanently wedge ----
class BoomLLM:
    def generate_samadhan(self, chapter, *, system):
        raise RuntimeError("transient 502 from the model")
    def review_samadhan(self, items, chapter):
        return {"verdicts": []}


class EmptyLLM:
    def generate_samadhan(self, chapter, *, system):
        return {"items": []}
    def review_samadhan(self, items, chapter):
        return {"verdicts": []}


def test_llm_produce_failure_rolls_back_and_is_retryable(env, monkeypatch):
    # A post-intent LLM failure must ROLL BACK the in-flight intent (local-write
    # lane: nothing external committed), leaving the assignment retryable — not
    # permanently wedged (the DEC-7 HIGH).
    monkeypatch.setattr(samadhan.llm_client, "LLMClient", lambda: BoomLLM())
    props = run.plan("textbook:circular-motion", dry=False, lane="samadhan")
    run.approve_seed("textbook:circular-motion")
    aid = props[0]["assignment_id"]
    with pytest.raises(RuntimeError):
        run.build(aid)
    c = store.connect()
    try:
        a = [x for x in store.list_assignments(c) if x["id"] == aid][0]
        verbs = [e["verb"] for e in store.list_events_for_assignment(c, aid)]
    finally:
        c.close()
    assert a["status"] == "approved"                       # not wedged
    assert "product_build_failed" in verbs and "product_created" not in verbs
    # retry with a working client -> succeeds and captures (no manual reconcile)
    monkeypatch.setattr(samadhan.llm_client, "LLMClient",
                        lambda: FakeLLM([{"idx": 0, "verdict": "ok", "rationale": "r"}]))
    res = run.build(aid)
    assert res["status"] == "captured"


def test_empty_brief_lands_in_changes_not_wedge(env, monkeypatch):
    # An empty generation (no items) is a degenerate brief: route to `changes`
    # (owner review), never silent capture and never a wedge.
    monkeypatch.setattr(samadhan.llm_client, "LLMClient", lambda: EmptyLLM())
    res = _approve_and_build("textbook:circular-motion")
    assert res["status"] == "changes"
    c = store.connect()
    try:
        verbs = [e["verb"] for e in store.list_events_for_assignment(c, res["assignment_id"])]
    finally:
        c.close()
    assert "product_created" in verbs
