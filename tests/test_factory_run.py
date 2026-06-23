"""Task 3 — factory.run.plan: fan ONE seed to N in-review child assignments."""
from __future__ import annotations

import pytest
from samagra import config
from samagra.governance import store


@pytest.fixture
def factory_env(tmp_path, monkeypatch):
    """Isolate governance.db + catalog.db + the outbox/export trees into tmp.

    NOTE: store.connect() does NOT create the schema (only ensure_tables() does),
    so we must call store.ensure_tables() after repointing GOVERNANCE_DB and
    clearing the memoized init cache — mirroring tests/test_bridge.py::temp_gov.
    """
    monkeypatch.setattr(config, "GOVERNANCE_DB", tmp_path / "governance.db")
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "exports")
    store._INITIALIZED.clear()           # memoized schema cache must not leak across DBs
    store.ensure_tables()                # connect() does NOT create tables; create them here
    monkeypatch.chdir(tmp_path)          # outbox writes board/<agent>/outbox/ under tmp
    yield tmp_path
    store._INITIALIZED.clear()


from samagra.factory import run


def test_plan_dry_returns_two_proposals_and_writes_nothing(factory_env):
    proposals = run.plan("textbook:circular-motion", dry=True)
    assert [p["line"] for p in proposals] == ["revision", "lecture"]
    conn = store.connect()
    try:
        assert store.list_assignments(conn) == []   # dry writes nothing
    finally:
        conn.close()


def test_plan_live_records_two_in_review_children(factory_env):
    proposals = run.plan("textbook:circular-motion", dry=False)
    assert all("assignment_id" in p for p in proposals)
    conn = store.connect()
    try:
        rows = store.list_assignments(conn)
        assert {r["pipeline"] for r in rows} == {"revision", "lecture"}
        assert all(r["status"] == "in-review" for r in rows)
        assert all(r["seed_ref"] == "textbook:circular-motion" for r in rows)
        verbs = [e["verb"] for e in store.list_events(conn)]
        assert verbs.count("product_proposed") == 2
    finally:
        conn.close()


def test_plan_live_is_idempotent_per_seed_and_line(factory_env):
    run.plan("textbook:circular-motion", dry=False)
    again = run.plan("textbook:circular-motion", dry=False)
    assert all(p.get("reused") for p in again)
    conn = store.connect()
    try:
        assert len(store.list_assignments(conn)) == 2   # not 4
    finally:
        conn.close()


def test_approve_flips_single_child(factory_env):
    [a, _] = run.plan("textbook:circular-motion", dry=False)
    res = run.approve(a["assignment_id"])
    assert res["status"] == "approved"


def test_approve_refuses_non_in_review(factory_env):
    [a, _] = run.plan("textbook:circular-motion", dry=False)
    run.approve(a["assignment_id"])
    with pytest.raises(ValueError):
        run.approve(a["assignment_id"])   # already approved, not in-review


def test_approve_seed_batches_all_children(factory_env):
    run.plan("textbook:circular-motion", dry=False)
    res = run.approve_seed("textbook:circular-motion")
    assert len(res["approved"]) == 2
    conn = store.connect()
    try:
        assert all(r["status"] == "approved" for r in store.list_assignments(conn))
    finally:
        conn.close()


def _stub_export(monkeypatch, tmp_path):
    def fake_export_one(slug, variant):
        out = tmp_path / f"{slug}-{variant}.html"
        out.write_text(f"<h1>{slug} {variant}</h1>", encoding="utf-8")
        return {"variant": variant, "html": str(out), "docx": None, "gdoc": None}
    monkeypatch.setattr("samagra.lectures.export.export_one", fake_export_one)

def test_build_runs_engine_and_captures(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    [a, _] = run.plan("textbook:circular-motion", dry=False)
    run.approve(a["assignment_id"])
    res = run.build(a["assignment_id"])
    assert res["artifact_ref"].endswith("circular-motion-thin.html")
    conn = store.connect()
    try:
        row = next(r for r in store.list_assignments(conn) if r["id"] == a["assignment_id"])
        assert row["status"] == "captured"
        verbs = [e["verb"] for e in store.list_events(conn)
                 if e["assignment_id"] == a["assignment_id"]]
        assert "product_building" in verbs and "product_created" in verbs
    finally:
        conn.close()

def test_build_refuses_unapproved(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    [a, _] = run.plan("textbook:circular-motion", dry=False)
    with pytest.raises(ValueError):       # still in-review
        run.build(a["assignment_id"])

def test_build_refuses_double_build(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    [a, _] = run.plan("textbook:circular-motion", dry=False)
    run.approve(a["assignment_id"]); run.build(a["assignment_id"])
    with pytest.raises(ValueError):       # captured -> not approved AND product_created exists
        run.build(a["assignment_id"])

def test_build_refuses_in_flight(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    [a, _] = run.plan("textbook:circular-motion", dry=False)
    run.approve(a["assignment_id"])
    conn = store.connect()                # simulate a crashed prior build: intent, no created
    try:
        store.append_event(conn, actor=run._AGENT, verb="product_building",
                           assignment_id=a["assignment_id"], subsystem="factory")
    finally:
        conn.close()
    with pytest.raises(ValueError):
        run.build(a["assignment_id"])

def test_build_validates_output(factory_env, monkeypatch):
    def empty_export(slug, variant):
        out = factory_env / f"{slug}-{variant}.html"; out.write_text("", encoding="utf-8")
        return {"variant": variant, "html": str(out)}
    monkeypatch.setattr("samagra.lectures.export.export_one", empty_export)
    [a, _] = run.plan("textbook:circular-motion", dry=False)
    run.approve(a["assignment_id"])
    with pytest.raises(ValueError):       # empty artifact fails the boundary guard
        run.build(a["assignment_id"])
    conn = store.connect()
    try:
        row = next(r for r in store.list_assignments(conn) if r["id"] == a["assignment_id"])
        assert row["status"] != "captured"   # not captured on a failed build
    finally:
        conn.close()


def test_one_seed_fans_to_two_captured_artifacts(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    seed = "textbook:circular-motion"
    run.plan(seed, dry=False)
    run.approve_seed(seed)                       # per-seed batch
    conn = store.connect()
    try:
        ids = [r["id"] for r in store.list_assignments(conn)]
    finally:
        conn.close()
    arts = [run.build(i)["artifact_ref"] for i in ids]
    assert len(arts) == 2 and len(set(arts)) == 2   # two distinct catalogued artifacts
    conn = store.connect()
    try:
        assert all(r["status"] == "captured" for r in store.list_assignments(conn))
        created = [e for e in store.list_events(conn) if e["verb"] == "product_created"]
        assert len(created) == 2
        assert all(e["subsystem_ref"] for e in created)   # provenance recorded
    finally:
        conn.close()
