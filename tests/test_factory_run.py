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


def test_plan_dry_returns_five_proposals_and_writes_nothing(factory_env):
    proposals = run.plan("textbook:circular-motion", dry=True)
    assert [p["line"] for p in proposals] == ["revision", "lecture", "deck", "paper", "drill"]
    conn = store.connect()
    try:
        assert store.list_assignments(conn) == []   # dry writes nothing
    finally:
        conn.close()


def test_plan_live_records_five_in_review_children(factory_env):
    proposals = run.plan("textbook:circular-motion", dry=False)
    assert all("assignment_id" in p for p in proposals)
    conn = store.connect()
    try:
        rows = store.list_assignments(conn)
        assert {r["pipeline"] for r in rows} == {"revision", "lecture", "deck", "paper", "drill"}
        assert all(r["status"] == "in-review" for r in rows)
        assert all(r["seed_ref"] == "textbook:circular-motion" for r in rows)
        verbs = [e["verb"] for e in store.list_events(conn)]
        assert verbs.count("product_proposed") == 5
    finally:
        conn.close()


def test_plan_live_is_idempotent_per_seed_and_line(factory_env):
    run.plan("textbook:circular-motion", dry=False)
    again = run.plan("textbook:circular-motion", dry=False)
    assert all(p.get("reused") for p in again)
    conn = store.connect()
    try:
        assert len(store.list_assignments(conn)) == 5   # not 10
    finally:
        conn.close()


def test_approve_flips_single_child(factory_env):
    a = run.plan("textbook:circular-motion", dry=False)[0]
    res = run.approve(a["assignment_id"])
    assert res["status"] == "approved"


def test_approve_refuses_non_in_review(factory_env):
    a = run.plan("textbook:circular-motion", dry=False)[0]
    run.approve(a["assignment_id"])
    with pytest.raises(ValueError):
        run.approve(a["assignment_id"])   # already approved, not in-review


def test_approve_seed_batches_all_children(factory_env):
    run.plan("textbook:circular-motion", dry=False)
    res = run.approve_seed("textbook:circular-motion")
    assert len(res["approved"]) == 5
    conn = store.connect()
    try:
        assert all(r["status"] == "approved" for r in store.list_assignments(conn))
    finally:
        conn.close()


def _stub_export(monkeypatch, tmp_path):
    def fake_export_one(slug, variant, **kw):
        out = tmp_path / f"{slug}-{variant}.html"
        out.write_text(f"<h1>{slug} {variant}</h1>", encoding="utf-8")
        return {"variant": variant, "html": str(out), "docx": None, "gdoc": None}
    monkeypatch.setattr("samagra.lectures.export.export_one", fake_export_one)

def _stub_deck(monkeypatch, tmp_path):
    def fake_build_deck(slug):
        out = tmp_path / f"{slug}-deck.html"
        out.write_text(f"<h1>{slug} deck</h1>", encoding="utf-8")
        return {"variant": "deck", "html": str(out),
                "json": str(tmp_path / f"{slug}-deck.json"), "cards": 4}
    monkeypatch.setattr("samagra.factory.deck.build_deck", fake_build_deck)

def _stub_paper(monkeypatch, tmp_path):
    def fake_build_paper(slug, *, variant):
        out = tmp_path / f"{slug}-{variant}.html"
        out.write_text(f'<h1>{slug} {variant}</h1><div class="stem">q</div>', encoding="utf-8")
        return {"variant": variant, "html": str(out),
                "json": str(tmp_path / f"{slug}-{variant}.json"), "questions": 3}
    monkeypatch.setattr("samagra.factory.paper.build_paper", fake_build_paper)

def test_build_runs_engine_and_captures(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    a = run.plan("textbook:circular-motion", dry=False)[0]
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
    a = run.plan("textbook:circular-motion", dry=False)[0]
    with pytest.raises(ValueError):       # still in-review
        run.build(a["assignment_id"])

def test_build_refuses_double_build(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    a = run.plan("textbook:circular-motion", dry=False)[0]
    run.approve(a["assignment_id"]); run.build(a["assignment_id"])
    with pytest.raises(ValueError):       # captured -> not approved AND product_created exists
        run.build(a["assignment_id"])

def test_build_refuses_in_flight(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    a = run.plan("textbook:circular-motion", dry=False)[0]
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
    def empty_export(slug, variant, **kw):
        out = factory_env / f"{slug}-{variant}.html"; out.write_text("", encoding="utf-8")
        return {"variant": variant, "html": str(out)}
    monkeypatch.setattr("samagra.lectures.export.export_one", empty_export)
    a = run.plan("textbook:circular-motion", dry=False)[0]
    run.approve(a["assignment_id"])
    with pytest.raises(ValueError):       # empty artifact fails the boundary guard
        run.build(a["assignment_id"])
    conn = store.connect()
    try:
        row = next(r for r in store.list_assignments(conn) if r["id"] == a["assignment_id"])
        assert row["status"] != "captured"   # not captured on a failed build
    finally:
        conn.close()


def test_one_seed_fans_to_five_captured_artifacts(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    _stub_deck(monkeypatch, factory_env)
    _stub_paper(monkeypatch, factory_env)
    seed = "textbook:circular-motion"
    run.plan(seed, dry=False)
    run.approve_seed(seed)                       # per-seed batch
    conn = store.connect()
    try:
        ids = [r["id"] for r in store.list_assignments(conn)]
    finally:
        conn.close()
    arts = [run.build(i)["artifact_ref"] for i in ids]
    assert len(arts) == 5 and len(set(arts)) == 5   # revision+lecture+deck+paper+drill, distinct
    conn = store.connect()
    try:
        assert all(r["status"] == "captured" for r in store.list_assignments(conn))
        created = [e for e in store.list_events(conn) if e["verb"] == "product_created"]
        assert len(created) == 5
        assert all(e["subsystem_ref"] for e in created)   # provenance recorded
        pipelines = {r["pipeline"] for r in store.list_assignments(conn)}
        assert pipelines == {"revision", "lecture", "deck", "paper", "drill"}
    finally:
        conn.close()


def _approve_lane(seed, line):
    """plan a seed, approve only the named lane's child, return its id."""
    run.plan(seed, dry=False)
    conn = store.connect()
    try:
        aid = next(r["id"] for r in store.list_assignments(conn) if r["pipeline"] == line)
    finally:
        conn.close()
    run.approve(aid)
    return aid


def test_build_paper_lane_refuses_when_qx_leaks_an_answer(factory_env, monkeypatch):
    class _LeakyQx:
        base_url = "http://127.0.0.1:8783"
        def __init__(self, *a, **k): pass
        def search(self, **kw):
            return {"results": [{"q_uid": "q1", "q_type": "mcq", "subject": "physics",
                                 "chapter": "c", "html":
                '<div class="stem">x</div>'
                '<div class="answer"><span class="answer-label">Ans: 42</span></div>'}],
                    "total": 1, "page": 1, "page_size": 25, "mode": "exact",
                    "degraded": False, "facets": {}}
    monkeypatch.setattr("samagra.factory.paper.QxClient", _LeakyQx)
    aid = _approve_lane("textbook:circular-motion", "paper")
    with pytest.raises(ValueError):
        run.build(aid)                            # answer-leak guard refuses at the boundary
    conn = store.connect()
    try:
        row = next(r for r in store.list_assignments(conn) if r["id"] == aid)
        assert row["status"] != "captured"
    finally:
        conn.close()


def test_build_paper_lane_refuses_when_qx_unreachable(factory_env, monkeypatch):
    class _DownQx:
        base_url = "http://127.0.0.1:8783"
        def __init__(self, *a, **k): pass
        def search(self, **kw): raise RuntimeError("connection refused")
    monkeypatch.setattr("samagra.factory.paper.QxClient", _DownQx)
    aid = _approve_lane("textbook:circular-motion", "paper")
    with pytest.raises(ValueError):
        run.build(aid)                            # clean refusal, no partial artifact
    conn = store.connect()
    try:
        row = next(r for r in store.list_assignments(conn) if r["id"] == aid)
        assert row["status"] != "captured"
    finally:
        conn.close()


def test_build_paper_lane_captures_answer_free_paper(factory_env, monkeypatch):
    class _CleanQx:
        base_url = "http://127.0.0.1:8783"
        def __init__(self, *a, **k): pass
        def search(self, **kw):
            return {"results": [{"q_uid": "q1", "q_type": "mcq_single", "subject": "physics",
                                 "chapter": "Circular Motion",
                                 "html": '<div class="stem">A wheel spins</div>'}],
                    "total": 1, "page": 1, "page_size": 25, "mode": "exact",
                    "degraded": False, "facets": {}}
    monkeypatch.setattr("samagra.factory.paper.QxClient", _CleanQx)
    aid = _approve_lane("textbook:circular-motion", "paper")
    res = run.build(aid)
    assert res["artifact_ref"].endswith("circular-motion-paper.html")
    conn = store.connect()
    try:
        row = next(r for r in store.list_assignments(conn) if r["id"] == aid)
        assert row["status"] == "captured"
    finally:
        conn.close()


# --- Codex review 24 remediation -------------------------------------------

def test_build_never_uploads_to_external_gdocs(factory_env, monkeypatch):
    """Phase-1 invariant: a factory build writes ONLY local artifacts — it must
    never trigger the lecture exporter's external Google Docs upload (review 24 H1)."""
    def _boom(*a, **k):
        raise AssertionError("factory build attempted an external Google Docs upload")
    monkeypatch.setattr("samagra.lectures.gdocs.upload", _boom)
    monkeypatch.setattr("samagra.lectures.export._html_to_docx", lambda h, d: True)
    a = run.plan("textbook:circular-motion", dry=False)[0]
    run.approve(a["assignment_id"])
    res = run.build(a["assignment_id"])          # must NOT raise
    assert res["artifact_ref"].endswith("circular-motion-thin.html")


def test_plan_outbox_emits_factory_commands_not_bridge(factory_env):
    """The board outbox must instruct `samagra factory ...`, never the bridge's
    `samagra bridge submit` (review 24 M1)."""
    import pathlib
    run.plan("textbook:circular-motion", dry=False)
    files = sorted(pathlib.Path("board/khanak/outbox").glob("*.md"))
    assert files, "no outbox file written"
    body = files[0].read_text(encoding="utf-8")
    assert "samagra factory" in body
    assert "samagra bridge" not in body


def test_factory_approve_refuses_non_factory_pipeline(factory_env):
    """Workflow firewall: a bridge (mycontentdev) assignment is not approvable via
    the factory workflow (review 24 M1)."""
    conn = store.connect()
    try:
        store.add_assignment(conn, id="x1", agent="khanak",
                             outbox_path="board/khanak/outbox/x1.md",
                             pipeline="mycontentdev", seed_ref="munshi:1")
        store.set_assignment_status(conn, "x1", "in-review")
    finally:
        conn.close()
    with pytest.raises(ValueError):
        run.approve("x1")


def test_factory_build_refuses_non_factory_pipeline(factory_env):
    conn = store.connect()
    try:
        store.add_assignment(conn, id="x2", agent="khanak",
                             outbox_path="board/khanak/outbox/x2.md",
                             pipeline="mycontentdev", seed_ref="munshi:1")
        store.set_assignment_status(conn, "x2", "in-review")
        store.set_assignment_status(conn, "x2", "approved")
    finally:
        conn.close()
    with pytest.raises(ValueError):
        run.build("x2")


def test_plan_normalizes_whitespace_in_seed_ref(factory_env):
    """A padded seed_ref is normalized once at plan entry so it cannot classify yet
    fail validate_seed_for_line at build time (review 24 L2)."""
    proposals = run.plan("  textbook:circular-motion  ", dry=False)
    assert all(p["seed_ref"] == "textbook:circular-motion" for p in proposals)
    conn = store.connect()
    try:
        assert all(r["seed_ref"] == "textbook:circular-motion"
                   for r in store.list_assignments(conn))
    finally:
        conn.close()


def test_build_guard2_refuses_existing_product_created_even_if_approved(factory_env, monkeypatch):
    """Guard 2 in isolation: an approved assignment that already has a
    product_created event must be refused (review 24 I1)."""
    _stub_export(monkeypatch, factory_env)
    a = run.plan("textbook:circular-motion", dry=False)[0]
    run.approve(a["assignment_id"])
    conn = store.connect()
    try:
        store.append_event(conn, actor=run._AGENT, verb="product_created",
                           assignment_id=a["assignment_id"], subsystem="factory",
                           subsystem_ref="x")
    finally:
        conn.close()
    with pytest.raises(ValueError):
        run.build(a["assignment_id"])


def test_approve_seed_skips_non_factory_pipeline_with_same_seed_ref(factory_env):
    """approve_seed must touch ONLY factory-lane assignments, even if a bridge
    assignment shares the seed_ref (review 25 — firewall completeness)."""
    run.plan("textbook:circular-motion", dry=False)   # 3 factory children, in-review
    conn = store.connect()
    try:
        store.add_assignment(conn, id="b9", agent="khanak",
                             outbox_path="board/khanak/outbox/b9.md",
                             pipeline="mycontentdev", seed_ref="textbook:circular-motion")
        store.set_assignment_status(conn, "b9", "in-review")
    finally:
        conn.close()
    res = run.approve_seed("textbook:circular-motion")
    assert "b9" not in res["approved"]            # bridge assignment untouched
    assert len(res["approved"]) == 5              # only the 5 factory lanes
    conn = store.connect()
    try:
        b9 = next(r for r in store.list_assignments(conn) if r["id"] == "b9")
        assert b9["status"] == "in-review"        # NOT approved by the factory workflow
    finally:
        conn.close()
