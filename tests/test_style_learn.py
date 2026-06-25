"""Phase D3 learning loop: mine review_overlay -> proposed style_events; ratify.

conftest's isolate_data_db repoints GOVERNANCE_DB; STYLESEED_DIR is NOT
auto-isolated, so tests that touch profiles monkeypatch it explicitly.
"""
from __future__ import annotations

import json

import pytest

from samagra import config
from samagra.governance import store
from samagra.factory.style import learn, profile as P


FACETS = {
    "voice": {"mean_sentence_len": 16.0, "second_person_rate": 0.08,
              "hedge_rate": 0.05, "imperative_rate": 0.1},
    "sequencing": {}, "analogy": {"analogy_block_rate": 0.03},
    "rigor": {}, "selection": {},
}


@pytest.fixture()
def conn():
    c = store.connect()
    store.init_tables(c)
    yield c
    c.close()


@pytest.fixture()
def profile_v0(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "styleseed")
    monkeypatch.setattr(P, "_now", lambda: "2026-06-25T00:00:00+00:00")
    P.save(P.StyleSeed(0, FACETS, "corpushash", "2026-06-25T00:00:00+00:00"))
    return P.load_current()


def _samadhan_change(conn, slug, rationale):
    store.add_review(conn, subsystem="factory", subsystem_ref=f"factory:{slug}",
                     artifact_uid=f"samadhan:{slug}", reviewer="owner",
                     verdict="changes", rationale=rationale)


def test_mine_matched_rule_proposes_facet_delta(conn, profile_v0):
    _samadhan_change(conn, "circular-motion", "Too hedgy — drop the maybes.")
    new_ids = learn.mine_deltas(conn)
    assert len(new_ids) == 1
    evs = learn.list_style_events(conn)
    assert len(evs) == 1
    e = evs[0]
    assert e["kind"] == "facet_delta" and e["status"] == "proposed"
    assert e["subsystem_ref"] == "review:1"
    assert e["from_version"] == 0
    p = e["payload"]
    assert p["facet"] == "voice"
    assert p["delta"]["hedge_rate"] < 0.05
    assert p["source_review_ids"] == [1]


def test_mine_is_idempotent(conn, profile_v0):
    _samadhan_change(conn, "x", "too hedgy")
    assert len(learn.mine_deltas(conn)) == 1
    assert learn.mine_deltas(conn) == []
    assert len(learn.list_style_events(conn)) == 1


def test_mine_unmatched_rationale_proposes_review_signal(conn, profile_v0):
    _samadhan_change(conn, "x", "The third item is factually wrong.")
    learn.mine_deltas(conn)
    e = learn.list_style_events(conn)[0]
    assert e["kind"] == "review_signal"
    assert e["payload"]["artifact_uid"] == "samadhan:x"
    assert e["payload"]["source_review_id"] == 1


def test_mine_ignores_approved_and_non_samadhan(conn, profile_v0):
    store.add_review(conn, subsystem="factory", subsystem_ref="factory:a",
                     artifact_uid="samadhan:a", reviewer="owner",
                     verdict="approved", rationale="great")
    store.add_review(conn, subsystem="mycontentdev", subsystem_ref="mcd:7",
                     artifact_uid="mcd:7", reviewer="owner",
                     verdict="changes", rationale="too hedgy")
    assert learn.mine_deltas(conn) == []
    assert learn.list_style_events(conn) == []


def test_mine_without_profile_falls_back_to_review_signal(conn, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "empty")
    _samadhan_change(conn, "x", "too hedgy")
    learn.mine_deltas(conn)
    assert learn.list_style_events(conn)[0]["kind"] == "review_signal"


def test_list_filters_by_status(conn, profile_v0):
    _samadhan_change(conn, "x", "too hedgy")
    learn.mine_deltas(conn)
    assert len(learn.list_style_events(conn, status="proposed")) == 1
    assert learn.list_style_events(conn, status="ratified") == []


def test_ratify_promotes_facet_delta_to_next_version(conn, profile_v0, monkeypatch):
    monkeypatch.setattr(P, "_now", lambda: "2026-06-25T01:00:00+00:00")
    _samadhan_change(conn, "x", "too hedgy")
    (event_id,) = learn.mine_deltas(conn)

    res = learn.ratify(conn, event_id)
    assert res["version"] == 1
    assert res["path"].endswith("styleseed-v1.json")
    assert len(res["content_hash"]) == 64

    v1 = P.load_current()
    assert v1.version == 1
    assert v1.facets["voice"]["hedge_rate"] < 0.05
    assert v1.facets["voice"]["mean_sentence_len"] == 16.0
    assert v1.source_corpus_hash == "corpushash"

    assert learn.list_style_events(conn, status="ratified")[0]["id"] == event_id
    verbs = [e["verb"] for e in store.list_events(conn)]
    assert "style_seed_promoted" in verbs


def test_ratify_is_not_repeatable(conn, profile_v0):
    _samadhan_change(conn, "x", "too hedgy")
    (event_id,) = learn.mine_deltas(conn)
    learn.ratify(conn, event_id)
    with pytest.raises(ValueError):
        learn.ratify(conn, event_id)


def test_ratify_unknown_event_raises(conn, profile_v0):
    with pytest.raises(ValueError):
        learn.ratify(conn, 999)


def test_ratify_review_signal_raises(conn, profile_v0):
    _samadhan_change(conn, "x", "factually wrong")
    (event_id,) = learn.mine_deltas(conn)
    with pytest.raises(ValueError):
        learn.ratify(conn, event_id)


def test_ratify_without_profile_raises(conn, tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "none")
    eid = learn._insert_event(
        conn, kind="facet_delta", subsystem_ref="review:9", from_version=0,
        payload={"facet": "voice", "delta": {"hedge_rate": 0.01},
                 "rationale": "x", "source_review_ids": [9]})
    with pytest.raises(ValueError):
        learn.ratify(conn, eid)


def test_reject_marks_event_and_blocks_ratify(conn, profile_v0):
    _samadhan_change(conn, "x", "too hedgy")
    (event_id,) = learn.mine_deltas(conn)
    learn.reject(conn, event_id)
    assert learn.list_style_events(conn, status="rejected")[0]["id"] == event_id
    with pytest.raises(ValueError):
        learn.ratify(conn, event_id)
