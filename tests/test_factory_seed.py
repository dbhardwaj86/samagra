"""Phase C3 — the factory `seed` (mcd) lane. McdClient/MunshiAdapter are mocked;
no live calls. Mirrors the proven bridge behaviors, re-homed to the factory."""
from __future__ import annotations

import json
import pytest

from samagra import catalog, config
from samagra.governance import store
from samagra.factory import run


@pytest.fixture
def seed_env(tmp_path, monkeypatch):
    """Isolate governance.db + catalog.db + the outbox tree into tmp."""
    monkeypatch.setattr(config, "GOVERNANCE_DB", tmp_path / "governance.db")
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "exports")
    store._INITIALIZED.clear()
    store.ensure_tables()
    # a catalog so resolve_pointers has something to read (empty is fine too)
    con = catalog.connect()
    con.close()
    monkeypatch.chdir(tmp_path)
    yield tmp_path
    store._INITIALIZED.clear()


def _munshi_items():
    return [
        {"id": "1", "kind": "question", "status": "open", "ts": "2026-06-19T00:00:00Z",
         "payload": {"stem": "Find acceleration of a block on a frictionless incline?"}},
        {"id": "2", "kind": "issue", "status": "open", "ts": "2026-06-19T00:01:00Z",
         "payload": {"summary": "Projector broken in room 4"}},
    ]


class _FakeMunshiAdapter:
    def __init__(self, items): self._items = items
    def available(self): return True
    def artifacts(self):
        from samagra.adapters.base import Artifact
        from samagra.bridge.text import item_text
        for it in self._items:
            yield Artifact(
                uid=f"munshi:{it['id']}", source="munshi", kind=it["kind"],
                title=item_text(it)[:60], subject="physics",
                status=it["status"], updated_at=it.get("ts"),
                meta={"payload": it["payload"], "tags": it.get("tags"),
                      "person": it.get("person"), "due": it.get("due")})


def _mock_munshi(monkeypatch, items):
    monkeypatch.setattr(run, "MunshiAdapter", lambda: _FakeMunshiAdapter(items))


class _NoMcd:
    def create_seed(self, p):  # pragma: no cover
        raise AssertionError("must not create a seed here")


# --- scan (the folded bridge.scan) -------------------------------------------

def test_scan_dry_proposes_content_only_and_writes_nothing(seed_env, monkeypatch):
    _mock_munshi(monkeypatch, _munshi_items())
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", _NoMcd)
    monkeypatch.setattr(run.store, "add_assignment",
                        lambda *a, **k: (_ for _ in ()).throw(
                            AssertionError("dry scan must not write")))
    proposals = run.scan(dry=True)
    assert len(proposals) == 1                          # only the question item
    p = proposals[0]
    assert p["seed_ref"] == "munshi:1"
    assert p["line"] == "seed"
    assert p["payload"]["type"] == "question"
    assert "assignment_id" not in p                     # dry: nothing recorded


def test_scan_live_records_in_review_seed_lane_and_dedups(seed_env, monkeypatch):
    _mock_munshi(monkeypatch, _munshi_items())
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", _NoMcd)
    proposals = run.scan(dry=False)
    assert len(proposals) == 1
    aid = proposals[0]["assignment_id"]
    conn = store.connect()
    try:
        rows = [a for a in store.list_assignments(conn) if a["seed_ref"] == "munshi:1"]
        assert len(rows) == 1
        assert rows[0]["status"] == "in-review"
        assert rows[0]["pipeline"] == "seed"            # the factory seed lane, NOT mycontentdev
        evs = [e for e in store.list_events_for_assignment(conn, aid)
               if e["verb"] == "product_proposed"]
        assert len(evs) == 1
        note = json.loads(evs[0]["note"])
        assert note["payload"]["type"] == "question"    # payload carried for build()
    finally:
        conn.close()
    again = run.scan(dry=False)
    assert again[0].get("reused") is True
    conn = store.connect()
    try:
        rows = [a for a in store.list_assignments(conn) if a["seed_ref"] == "munshi:1"]
        assert len(rows) == 1                            # still exactly one
    finally:
        conn.close()


def test_scan_skips_already_captured_item(seed_env, monkeypatch):
    """Status-blind dedup: a munshi item already CAPTURED must not be re-proposed."""
    _mock_munshi(monkeypatch, _munshi_items())
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", _NoMcd)
    conn = store.connect()
    try:
        store.add_assignment(conn, id="old1", agent="khanak", outbox_path="o",
                             pipeline="seed", seed_ref="munshi:1")
        store.set_assignment_status(conn, "old1", "in-review")
        store.set_assignment_status(conn, "old1", "approved")
        store.set_assignment_status(conn, "old1", "captured")
    finally:
        conn.close()
    proposals = run.scan(dry=False)
    conn = store.connect()
    try:
        rows = [a for a in store.list_assignments(conn) if a["seed_ref"] == "munshi:1"]
        assert len(rows) == 1 and rows[0]["id"] == "old1"
    finally:
        conn.close()
    assert proposals and proposals[0].get("reused") is True


def test_scan_returns_empty_when_munshi_unavailable(monkeypatch):
    class _Unavail:
        def available(self): return False
        def artifacts(self):  # pragma: no cover
            raise AssertionError("must not read artifacts when unavailable")
    monkeypatch.setattr(run, "MunshiAdapter", lambda: _Unavail())
    assert run.scan(dry=True) == []
    assert run.scan(dry=False) == []


def test_scan_degrades_when_munshi_read_raises(monkeypatch):
    class _Flaky:
        def available(self): return True
        def artifacts(self): raise RuntimeError("munshi 503")
    monkeypatch.setattr(run, "MunshiAdapter", lambda: _Flaky())
    assert run.scan(dry=True) == []


# --- plan("munshi:<id>") — a single seed proposal ----------------------------

def test_plan_munshi_id_proposes_one_seed(seed_env, monkeypatch):
    _mock_munshi(monkeypatch, _munshi_items())
    proposals = run.plan("munshi:1", dry=False)
    assert len(proposals) == 1
    assert proposals[0]["line"] == "seed"
    assert proposals[0]["seed_ref"] == "munshi:1"
    assert "assignment_id" in proposals[0]


def test_plan_munshi_id_returns_empty_for_ops_item(seed_env, monkeypatch):
    _mock_munshi(monkeypatch, _munshi_items())
    assert run.plan("munshi:2", dry=False) == []        # the 'issue' item is ops


def test_plan_textbook_is_unchanged_and_never_includes_seed(seed_env):
    proposals = run.plan("textbook:circular-motion", dry=False)
    assert [p["line"] for p in proposals] == [
        "revision", "lecture", "deck", "paper", "drill"]


def test_plan_munshi_with_explicit_seed_lane_routes_like_default(seed_env, monkeypatch):
    """review 27 LOW-10: targeting the seed lane explicitly (--lane seed) on a munshi
    seed must route to the seed proposal, not silently fall through to an empty plan."""
    _mock_munshi(monkeypatch, _munshi_items())
    proposals = run.plan("munshi:1", dry=False, lane="seed")
    assert len(proposals) == 1
    assert proposals[0]["line"] == "seed"
    assert proposals[0]["seed_ref"] == "munshi:1"
    assert "assignment_id" in proposals[0]


def test_plan_textbook_with_seed_lane_is_refused(seed_env):
    """The seed lane only accepts munshi: seeds — --lane seed on a textbook seed is a
    clean refusal (unchanged boundary, documented alongside LOW-10)."""
    with pytest.raises(ValueError, match="does not accept"):
        run.plan("textbook:circular-motion", dry=True, lane="seed")


# --- build() mcd branch — the prod write -------------------------------------

def _approved_seed_assignment(monkeypatch, seed="munshi:1"):
    _mock_munshi(monkeypatch, _munshi_items())
    aid = run.plan(seed, dry=False)[0]["assignment_id"]
    run.approve(aid)
    return aid


def test_build_seed_creates_one_mcd_seed_and_captures(seed_env, monkeypatch):
    aid = _approved_seed_assignment(monkeypatch)
    calls = []

    class _Client:
        def available(self): return True
        def create_seed(self, p):
            calls.append(p); return {"id": "seed-99", "status": "captured"}
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Client())

    res = run.build(aid)
    assert len(calls) == 1                                # exactly one prod write
    assert calls[0]["type"] == "question" and calls[0]["raw_text"]
    assert res["artifact_ref"] == "mcd:seed-99"
    conn = store.connect()
    try:
        row = next(r for r in store.list_assignments(conn) if r["id"] == aid)
        assert row["status"] == "captured"
        verbs = [e["verb"] for e in store.list_events_for_assignment(conn, aid)]
        assert "product_building" in verbs and "product_created" in verbs
        created = next(e for e in store.list_events_for_assignment(conn, aid)
                       if e["verb"] == "product_created")
        assert created["subsystem_ref"] == "seed-99"     # provenance = the seed id
    finally:
        conn.close()


def test_build_seed_refuses_when_mcd_unconfigured_without_wedging(seed_env, monkeypatch):
    """review 27 MED-1: an approved seed build must refuse BEFORE recording intent
    when mcd is unconfigured (no adminKey/URL). Otherwise run_seed would raise AFTER
    the product_building intent, and the mcd lane deliberately never rolls intent
    back -> a permanent wedge. The assignment must stay 'approved' + retryable."""
    aid = _approved_seed_assignment(monkeypatch)

    class _Unconfigured:
        def available(self): return False
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("must not attempt a write when unconfigured")
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Unconfigured())
    with pytest.raises((RuntimeError, ValueError), match="configured"):
        run.build(aid)
    conn = store.connect()
    try:
        verbs = [e["verb"] for e in store.list_events_for_assignment(conn, aid)]
        assert "product_building" not in verbs           # anti-wedge: no intent recorded
        row = next(r for r in store.list_assignments(conn) if r["id"] == aid)
        assert row["status"] == "approved"               # retryable after configuring mcd
    finally:
        conn.close()


def test_build_seed_refuses_double_build(seed_env, monkeypatch):
    aid = _approved_seed_assignment(monkeypatch)
    n = {"c": 0}

    class _Client:
        def available(self): return True
        def create_seed(self, p):
            n["c"] += 1; return {"id": "seed-1", "status": "captured"}
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Client())
    run.build(aid)
    with pytest.raises(ValueError):
        run.build(aid)                                   # captured -> refused
    assert n["c"] == 1                                    # never a double prod write


def test_build_seed_refuses_in_flight_after_crash(seed_env, monkeypatch):
    """A prior build recorded product_building but never product_created (crash in
    the write window) — a retry must REFUSE, never blindly create a second seed."""
    aid = _approved_seed_assignment(monkeypatch)
    conn = store.connect()
    try:
        store.append_event(conn, actor=run._AGENT, verb="product_building",
                           assignment_id=aid, subsystem="factory",
                           subsystem_ref="munshi:1", note="crashed intent")
    finally:
        conn.close()

    class _Boom:
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("must not create a second seed for an in-flight build")
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Boom())
    with pytest.raises(ValueError, match="in-flight"):
        run.build(aid)


def test_build_seed_refuses_unapproved(seed_env, monkeypatch):
    _mock_munshi(monkeypatch, _munshi_items())
    aid = run.plan("munshi:1", dry=False)[0]["assignment_id"]   # still in-review

    class _Boom:
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("must not create a seed for an unapproved assignment")
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Boom())
    with pytest.raises(ValueError, match="approved"):
        run.build(aid)


def test_build_seed_refuses_when_no_proposed_payload(seed_env, monkeypatch):
    """An approved seed assignment with NO product_proposed payload (contrived) must
    refuse rather than POST a guessed body."""
    conn = store.connect()
    try:
        store.add_assignment(conn, id="np1", agent="khanak", outbox_path="o",
                             pipeline="seed", seed_ref="munshi:1")
        store.set_assignment_status(conn, "np1", "in-review")
        store.set_assignment_status(conn, "np1", "approved")
    finally:
        conn.close()

    class _Boom:
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("must not create a seed without a recorded payload")
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Boom())
    with pytest.raises(ValueError, match="no proposed payload"):
        run.build("np1")


def test_build_seed_refuses_empty_raw_text_before_writing(seed_env, monkeypatch):
    """validate_seed_payload gates the write: an approved seed whose recorded payload
    has empty raw_text must refuse BEFORE create_seed, and must NOT wedge the
    assignment in-flight (no build intent recorded for a never-attempted write)."""
    conn = store.connect()
    try:
        store.add_assignment(conn, id="e1", agent="khanak", outbox_path="o",
                             pipeline="seed", seed_ref="munshi:1")
        store.set_assignment_status(conn, "e1", "in-review")
        store.append_event(conn, actor="system", verb="product_proposed",
                           assignment_id="e1", subsystem="factory",
                           subsystem_ref="munshi:1",
                           note=json.dumps({"line": "seed",
                                            "payload": {"type": "question", "raw_text": ""},
                                            "pointers": []}))
        store.set_assignment_status(conn, "e1", "approved")
    finally:
        conn.close()

    class _Boom:
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("must not POST an empty-raw_text payload")
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Boom())
    with pytest.raises(ValueError, match="raw_text"):
        run.build("e1")
    conn = store.connect()
    try:
        verbs = [e["verb"] for e in store.list_events_for_assignment(conn, "e1")]
        assert "product_building" not in verbs           # anti-wedge: no intent recorded
        row = next(r for r in store.list_assignments(conn) if r["id"] == "e1")
        assert row["status"] == "approved"               # still retryable after fixing the payload
    finally:
        conn.close()


@pytest.mark.parametrize("bad_note", [
    '"just a bare string"',                              # note is a JSON string, not a dict
    "null",                                              # note is JSON null
    "[1, 2, 3]",                                         # note is a JSON list
    "not valid json at all",                             # note is not JSON
    json.dumps({"line": "seed", "payload": "not-a-dict"}),   # dict note, NON-DICT payload value
    json.dumps({"line": "seed"}),                       # dict note, payload key missing
])
def test_build_seed_refuses_malformed_proposed_note_cleanly(seed_env, monkeypatch, bad_note):
    """Defense in depth (DEC-7 Codex F1): a product_proposed note that is not a dict
    carrying a DICT payload must yield a clean 'no proposed payload' refusal — never
    an opaque AttributeError/TypeError downstream in validate_seed_payload — and must
    not write or wedge the assignment."""
    conn = store.connect()
    try:
        store.add_assignment(conn, id="m1", agent="khanak", outbox_path="o",
                             pipeline="seed", seed_ref="munshi:1")
        store.set_assignment_status(conn, "m1", "in-review")
        store.append_event(conn, actor="system", verb="product_proposed",
                           assignment_id="m1", subsystem="factory",
                           subsystem_ref="munshi:1", note=bad_note)
        store.set_assignment_status(conn, "m1", "approved")
    finally:
        conn.close()

    class _Boom:
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("must not write from a malformed proposed note")
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Boom())
    with pytest.raises(ValueError, match="no proposed payload"):
        run.build("m1")
    conn = store.connect()
    try:
        verbs = [e["verb"] for e in store.list_events_for_assignment(conn, "m1")]
        assert "product_building" not in verbs           # anti-wedge: no intent recorded
        row = next(r for r in store.list_assignments(conn) if r["id"] == "m1")
        assert row["status"] == "approved"               # retryable
    finally:
        conn.close()
