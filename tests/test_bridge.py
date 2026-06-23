"""Phase 3 — active-loop bridge tests. All HTTP clients are mocked; no live calls."""
from __future__ import annotations

import json
import sys

import pytest

import samagra.__main__ as cli

from samagra.bridge.text import item_text
from samagra.bridge.classify import classify_item
from samagra import catalog, config
from samagra.bridge.pointers import resolve_pointers
from samagra.bridge.seed_payload import build_seed_payload
from samagra.governance import store
from samagra.bridge import run


def _item(kind, payload, **kw):
    base = {"id": "i1", "kind": kind, "payload": payload, "status": "open"}
    base.update(kw)
    return base


@pytest.mark.parametrize(
    "item,expected",
    [
        # real munshi kind-specific keys (R2)
        (_item("question", {"stem": "Find the work done by friction on a block?"}), "content"),
        (_item("note", {"issue": "Nice intuition for Gauss's law and electric flux"}), "content"),
        (_item("todo", {"task": "Make a question on rotational kinetic energy"}), "content"),
        # synthetic generic-text payloads still work via the fallback join
        (_item("note", {"text": "Gauss law electric flux through a cube"}), "content"),
        # ops: issues / followups / person-directed / non-physics
        (_item("issue", {"summary": "Projector in room 4 is broken"}), "ops"),
        (_item("followup", {"note": "Call the parent about fees"}, person="Riya"), "ops"),
        (_item("note", {"issue": "Buy more whiteboard markers"}), "ops"),
        (_item("todo", {"task": "Order new chairs"}), "ops"),
    ],
)
def test_classify_item(item, expected):
    assert classify_item(item) == expected


def test_item_text_uses_kind_specific_key():
    assert item_text(_item("todo", {"task": "Order new chairs"})) == "Order new chairs"
    assert item_text(_item("question", {"stem": "Find a?"})) == "Find a?"


def test_item_text_falls_back_to_joined_values():
    # no kind-specific key present -> join string values
    assert "Gauss" in item_text(_item("note", {"text": "Gauss law"}))


def test_item_text_empty_payload_is_empty_string():
    assert item_text(_item("todo", {})) == ""


@pytest.fixture
def temp_catalog(tmp_path, monkeypatch):
    """Point config.DATA_DB at a temp DB and seed three catalog rows."""
    db = tmp_path / "samagra.db"
    monkeypatch.setattr(config, "DATA_DB", db)
    con = catalog.connect()  # creates schema incl. catalog_fts
    rows = [
        ("qx:doc:gauss-1", "qx", "question", "Gauss law electric flux through a cube",
         "physics", None, "Electrostatics", None, None, None, None, "{}"),
        ("tb:ch:work-energy", "physics-textbook", "chapter",
         "Work, Energy and Power", "physics", None, "Mechanics",
         None, None, None, None, "{}"),
        ("insp:p:optics-9", "insp", "problem", "Lens refraction olympiad set",
         "physics", None, "Optics", None, None, None, None, "{}"),
    ]
    cur = con.cursor()
    for r in rows:
        cur.execute("insert into catalog values(?,?,?,?,?,?,?,?,?,?,?,?)", r)
        cur.execute(
            "insert into catalog_fts(uid,title,subject,chapter,kind,source) "
            "values(?,?,?,?,?,?)",
            (r[0], r[3], r[4], r[6], r[2], r[1]),
        )
    con.commit()
    con.close()
    return db


def test_resolve_pointers_finds_candidates(temp_catalog):
    ptrs = resolve_pointers("Gauss law electric flux", limit=5)
    assert any(p["uid"] == "qx:doc:gauss-1" for p in ptrs)
    for p in ptrs:
        assert set(p.keys()) == {"uid", "source", "kind", "title"}


def test_resolve_pointers_respects_limit(temp_catalog):
    ptrs = resolve_pointers("work energy lens gauss", limit=2)
    assert len(ptrs) <= 2


def test_resolve_pointers_empty_text_returns_empty(temp_catalog):
    assert resolve_pointers("", limit=5) == []


def test_build_seed_payload_rough_idea_flat_body():
    item = {"id": "42", "uid": "munshi:42", "kind": "note",
            "payload": {"issue": "Idea: show work done by friction with a slider"},
            "status": "open"}
    pointers = [
        {"uid": "tb:ch:work-energy", "source": "physics-textbook",
         "kind": "chapter", "title": "Work, Energy and Power"},
    ]
    body = build_seed_payload(item, pointers)
    assert body == {
        "type": "rough_idea",
        "raw_text": "Idea: show work done by friction with a slider",
        "source_ref": "munshi:42",
    }
    # R1: no nested detail{} (the worker would drop it)
    assert "detail" not in body


def test_build_seed_payload_question_maps_type():
    item = {"id": "7", "uid": "munshi:7", "kind": "question",
            "payload": {"stem": "A 2 kg block slides down a 30 deg incline; find a."},
            "status": "open"}
    body = build_seed_payload(item, [])
    assert body["type"] == "question"
    assert body["raw_text"] == "A 2 kg block slides down a 30 deg incline; find a."
    assert body["source_ref"] == "munshi:7"


def test_build_seed_payload_source_ref_from_id_when_no_uid():
    item = {"id": "9", "kind": "todo", "payload": {"task": "rotational kinetic energy demo"}}
    body = build_seed_payload(item, [])
    assert body["source_ref"] == "munshi:9"


@pytest.fixture
def temp_gov(tmp_path, monkeypatch):
    """Point config.GOVERNANCE_DB at a temp DB (fresh governance store)."""
    gdb = tmp_path / "governance.db"
    monkeypatch.setattr(config, "GOVERNANCE_DB", gdb)
    store._INITIALIZED.discard(str(gdb))
    store.ensure_tables()
    return gdb


def test_governance_accepts_captured_status(temp_gov):
    conn = store.connect()
    try:
        store.add_assignment(conn, id="a1", agent="khanak",
                             outbox_path="board/khanak/outbox/a1.md",
                             pipeline="mycontentdev", seed_ref="munshi:1")
        store.set_assignment_status(conn, "a1", "in-review")
        store.set_assignment_status(conn, "a1", "approved")
        store.set_assignment_status(conn, "a1", "captured")   # must not raise
        a = next(a for a in store.list_assignments(conn) if a["id"] == "a1")
        assert a["status"] == "captured"
    finally:
        conn.close()


class _FakeMunshiAdapter:
    def __init__(self, items):
        self._items = items

    def available(self):
        return True

    def artifacts(self):
        from samagra.adapters.base import Artifact
        for it in self._items:
            yield Artifact(
                uid=f"munshi:{it['id']}", source="munshi", kind=it["kind"],
                title=item_text(it)[:60], subject="physics",
                status=it["status"], updated_at=it.get("ts"),
                meta={"payload": it["payload"], "tags": it.get("tags"),
                      "person": it.get("person"), "due": it.get("due")},
            )


def _munshi_items():
    return [
        {"id": "1", "kind": "question", "status": "open", "ts": "2026-06-19T00:00:00Z",
         "payload": {"stem": "Find acceleration of a block on a frictionless incline?"}},
        {"id": "2", "kind": "issue", "status": "open", "ts": "2026-06-19T00:01:00Z",
         "payload": {"summary": "Projector broken in room 4"}},
    ]


def test_scan_dry_proposes_content_only_and_writes_nothing(temp_catalog, monkeypatch):
    monkeypatch.setattr(run, "MunshiAdapter", lambda: _FakeMunshiAdapter(_munshi_items()))

    class _Boom:
        def create_seed(self, payload):  # pragma: no cover - must not run
            raise AssertionError("scan must not create seeds")
    monkeypatch.setattr(run, "McdClient", _Boom)
    monkeypatch.setattr(run.store, "add_assignment",
                        lambda *a, **k: (_ for _ in ()).throw(
                            AssertionError("dry scan must not write")))

    proposals = run.scan(dry=True)
    assert len(proposals) == 1                       # only the question item
    p = proposals[0]
    assert p["item"]["uid"] == "munshi:1"
    assert p["classification"] == "content"
    assert p["payload"]["type"] == "question"
    assert isinstance(p["pointers"], list)
    assert "assignment_id" not in p                  # dry: no assignment recorded


def test_scan_live_records_in_review_and_dedups(temp_catalog, temp_gov, tmp_path, monkeypatch):
    # chdir to a tmp cwd so scan's outbox files land in the tmp tree, not the repo.
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(run, "MunshiAdapter", lambda: _FakeMunshiAdapter(_munshi_items()))

    class _Boom:
        def create_seed(self, payload):  # pragma: no cover
            raise AssertionError("scan must not create seeds")
    monkeypatch.setattr(run, "McdClient", _Boom)

    proposals = run.scan(dry=False)
    assert len(proposals) == 1
    aid = proposals[0]["assignment_id"]
    conn = store.connect()
    try:
        rows = [a for a in store.list_assignments(conn) if a["seed_ref"] == "munshi:1"]
        assert len(rows) == 1
        assert rows[0]["status"] == "in-review"
        assert rows[0]["agent"] == "khanak"
        assert rows[0]["pipeline"] == "mycontentdev"
        evs = [e for e in store.list_events(conn, limit=1000)
               if e["assignment_id"] == aid and e["verb"] == "seed_proposed"]
        assert len(evs) == 1
        note = json.loads(evs[0]["note"])
        assert note["payload"]["type"] == "question"
        assert isinstance(note["pointers"], list)
    finally:
        conn.close()

    again = run.scan(dry=False)
    conn = store.connect()
    try:
        rows = [a for a in store.list_assignments(conn) if a["seed_ref"] == "munshi:1"]
        assert len(rows) == 1                         # still exactly one
    finally:
        conn.close()
    assert again[0].get("reused") is True


def test_approve_flips_in_review_to_approved(temp_gov):
    conn = store.connect()
    try:
        store.add_assignment(conn, id="a1", agent="khanak",
                             outbox_path="board/khanak/outbox/a1.md",
                             pipeline="mycontentdev", seed_ref="munshi:1")
        store.set_assignment_status(conn, "a1", "in-review")
    finally:
        conn.close()
    res = run.approve("a1")
    assert res["status"] == "approved"
    conn = store.connect()
    try:
        a = next(a for a in store.list_assignments(conn) if a["id"] == "a1")
        assert a["status"] == "approved"
    finally:
        conn.close()


def test_approve_refuses_non_in_review(temp_gov):
    conn = store.connect()
    try:
        store.add_assignment(conn, id="a2", agent="khanak",
                             outbox_path="board/khanak/outbox/a2.md",
                             pipeline="mycontentdev", seed_ref="munshi:2")
    finally:
        conn.close()
    with pytest.raises(ValueError, match="in-review"):
        run.approve("a2")   # still 'queued'


def test_approve_unknown_assignment_raises(temp_gov):
    with pytest.raises(ValueError, match="unknown"):
        run.approve("nope")


def _seed_proposed(conn, aid, payload):
    store.append_event(conn, actor="system", verb="seed_proposed",
                       assignment_id=aid, subsystem="munshi", subsystem_ref="munshi:1",
                       note=json.dumps({"payload": payload, "pointers": []}))


def _approved_assignment_with_payload(conn, aid, payload):
    store.add_assignment(conn, id=aid, agent="khanak",
                         outbox_path=f"board/khanak/outbox/{aid}.md",
                         pipeline="mycontentdev", seed_ref="munshi:1")
    store.set_assignment_status(conn, aid, "in-review")
    _seed_proposed(conn, aid, payload)
    store.set_assignment_status(conn, aid, "approved")


def test_submit_refuses_non_approved(temp_gov, monkeypatch):
    conn = store.connect()
    try:
        store.add_assignment(conn, id="a1", agent="khanak",
                             outbox_path="o", pipeline="mycontentdev", seed_ref="munshi:1")
        store.set_assignment_status(conn, "a1", "in-review")
    finally:
        conn.close()

    class _Boom:
        def create_seed(self, payload):  # pragma: no cover
            raise AssertionError("must not create seed for non-approved")
    monkeypatch.setattr(run, "McdClient", _Boom)
    with pytest.raises(ValueError, match="approved"):
        run.submit("a1")


def test_submit_creates_seed_once_and_captures(temp_gov, monkeypatch):
    payload = {"type": "question", "raw_text": "x", "source_ref": "munshi:1"}
    conn = store.connect()
    try:
        _approved_assignment_with_payload(conn, "a1", payload)
    finally:
        conn.close()

    calls = []

    class _Client:
        def create_seed(self, p):
            calls.append(p)
            return {"id": "seed-99", "status": "captured"}
    monkeypatch.setattr(run, "McdClient", lambda: _Client())

    res = run.submit("a1")
    assert calls == [payload]                         # exactly one create, exact flat body
    assert res["seed"]["id"] == "seed-99"
    conn = store.connect()
    try:
        a = next(a for a in store.list_assignments(conn) if a["id"] == "a1")
        assert a["status"] == "captured"
        verbs = [e["verb"] for e in store.list_events(conn, limit=1000)
                 if e["assignment_id"] == "a1"]
        assert "seed_created" in verbs
    finally:
        conn.close()


def test_submit_refuses_double_submit(temp_gov, monkeypatch):
    payload = {"type": "question", "raw_text": "x", "source_ref": "munshi:1"}
    conn = store.connect()
    try:
        _approved_assignment_with_payload(conn, "a1", payload)
    finally:
        conn.close()

    n = {"create": 0}

    class _Client:
        def create_seed(self, p):
            n["create"] += 1
            return {"id": "seed-1", "status": "captured"}
    monkeypatch.setattr(run, "McdClient", lambda: _Client())

    run.submit("a1")                                  # first: ok
    with pytest.raises(ValueError):                   # second: refused (now 'captured')
        run.submit("a1")
    assert n["create"] == 1                            # never a double prod write


def test_submit_unknown_assignment_raises(temp_gov, monkeypatch):
    class _Boom:
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("must not create seed for unknown assignment")
    monkeypatch.setattr(run, "McdClient", _Boom)
    with pytest.raises(ValueError, match="unknown"):
        run.submit("nope")


def test_submit_refuses_when_no_proposed_payload(temp_gov, monkeypatch):
    # approved, but NO seed_proposed event was ever recorded -> no payload to send
    conn = store.connect()
    try:
        store.add_assignment(conn, id="a1", agent="khanak",
                             outbox_path="o", pipeline="mycontentdev", seed_ref="munshi:1")
        store.set_assignment_status(conn, "a1", "in-review")
        store.set_assignment_status(conn, "a1", "approved")
    finally:
        conn.close()

    class _Boom:
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("must not create seed without a recorded payload")
    monkeypatch.setattr(run, "McdClient", _Boom)
    with pytest.raises(ValueError, match="no proposed payload"):
        run.submit("a1")


def test_cli_bridge_scan_dispatch(monkeypatch, capsys):
    seen = {}
    monkeypatch.setattr("samagra.bridge.run.scan",
                        lambda dry=True: seen.update(dry=dry) or [])
    monkeypatch.setattr(sys, "argv", ["samagra", "bridge", "scan", "--dry-run"])
    cli.main()
    assert seen["dry"] is True


def test_cli_bridge_approve_dispatch(monkeypatch):
    seen = {}
    monkeypatch.setattr("samagra.bridge.run.approve",
                        lambda aid: seen.update(aid=aid) or {"status": "approved"})
    monkeypatch.setattr(sys, "argv", ["samagra", "bridge", "approve", "a1"])
    cli.main()
    assert seen["aid"] == "a1"


def test_cli_bridge_submit_dispatch(monkeypatch):
    seen = {}
    monkeypatch.setattr("samagra.bridge.run.submit",
                        lambda aid: seen.update(aid=aid) or {"seed": {"id": "s1"}})
    monkeypatch.setattr(sys, "argv", ["samagra", "bridge", "submit", "a1"])
    cli.main()
    assert seen["aid"] == "a1"


def test_scan_returns_empty_when_munshi_unavailable(monkeypatch):
    class _Unavail:
        def available(self):
            return False

        def artifacts(self):  # pragma: no cover - must not be reached
            raise AssertionError("scan must not read artifacts when unavailable")
    monkeypatch.setattr(run, "MunshiAdapter", lambda: _Unavail())
    assert run.scan(dry=True) == []
    assert run.scan(dry=False) == []


# --- Codex pre-merge hardening (review 22) ------------------------------------

@pytest.mark.parametrize(
    "task,expected",
    [
        # left word-boundary: 'work' must NOT fire on 'paperwork'/'network'
        ("finish the office paperwork", "ops"),
        ("set up the lab network", "ops"),
        # but a real physics word (with suffixes) still classifies as content
        ("make a question on work and energy", "content"),
        ("rotational dynamics worksheet", "content"),
    ],
)
def test_classify_uses_word_boundary_not_substring(task, expected):
    assert classify_item(_item("todo", {"task": task})) == expected


def test_scan_skips_already_captured_item(temp_catalog, temp_gov, tmp_path, monkeypatch):
    """H3: a munshi item already CAPTURED must not be re-proposed on re-scan."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(run, "MunshiAdapter", lambda: _FakeMunshiAdapter(_munshi_items()))

    class _Boom:
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("scan must not create seeds")
    monkeypatch.setattr(run, "McdClient", _Boom)

    conn = store.connect()
    try:
        store.add_assignment(conn, id="old1", agent="khanak", outbox_path="o",
                             pipeline="mycontentdev", seed_ref="munshi:1")
        store.set_assignment_status(conn, "old1", "in-review")
        store.set_assignment_status(conn, "old1", "approved")
        store.set_assignment_status(conn, "old1", "captured")
    finally:
        conn.close()

    proposals = run.scan(dry=False)
    conn = store.connect()
    try:
        rows = [a for a in store.list_assignments(conn) if a["seed_ref"] == "munshi:1"]
        assert len(rows) == 1            # no SECOND assignment for the same item
        assert rows[0]["id"] == "old1"
    finally:
        conn.close()
    assert proposals and proposals[0].get("reused") is True


def test_scan_degrades_when_munshi_read_raises(monkeypatch):
    """M2: a munshi read that throws mid-stream must degrade, not crash."""
    class _Flaky:
        def available(self):
            return True

        def artifacts(self):
            raise RuntimeError("munshi 503")
    monkeypatch.setattr(run, "MunshiAdapter", lambda: _Flaky())
    assert run.scan(dry=True) == []


def test_submit_refuses_in_flight_after_crash(temp_gov, monkeypatch):
    """H1: if a prior submit recorded intent but never completed (crash after
    create_seed, before the ledger writes), a retry must REFUSE — never blindly
    create a second seed."""
    payload = {"type": "question", "raw_text": "x", "source_ref": "munshi:1"}
    conn = store.connect()
    try:
        _approved_assignment_with_payload(conn, "a1", payload)
        # simulate a crash mid-submit: intent recorded, no seed_created, status still approved
        store.append_event(conn, actor="khanak", verb="seed_submitting",
                           assignment_id="a1", subsystem="mycontentdev",
                           subsystem_ref="munshi:1", note="intent")
    finally:
        conn.close()

    class _Boom:
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("must not create a second seed for an in-flight submit")
    monkeypatch.setattr(run, "McdClient", _Boom)
    with pytest.raises(ValueError, match="in-flight"):
        run.submit("a1")


def test_submit_refuses_empty_raw_text(temp_gov, monkeypatch):
    """M1: submit calls create_seed directly, bypassing the /api/mcd/seeds route
    validation — so it must reject an empty raw_text itself."""
    payload = {"type": "question", "raw_text": "", "source_ref": "munshi:1"}
    conn = store.connect()
    try:
        _approved_assignment_with_payload(conn, "a1", payload)
    finally:
        conn.close()

    class _Boom:
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("must not create a seed with empty raw_text")
    monkeypatch.setattr(run, "McdClient", _Boom)
    with pytest.raises(ValueError, match="raw_text"):
        run.submit("a1")


def test_bridge_approve_refuses_non_mycontentdev_pipeline(temp_gov):
    """Workflow firewall: a factory assignment (pipeline 'revision'/'lecture') is
    not approvable via the bridge workflow (review 24 M1)."""
    conn = store.connect()
    try:
        store.add_assignment(conn, id="f1", agent="khanak",
                             outbox_path="board/khanak/outbox/f1.md",
                             pipeline="revision", seed_ref="textbook:x")
        store.set_assignment_status(conn, "f1", "in-review")
    finally:
        conn.close()
    with pytest.raises(ValueError):
        run.approve("f1")


def test_bridge_submit_refuses_non_mycontentdev_pipeline(temp_gov):
    conn = store.connect()
    try:
        store.add_assignment(conn, id="f2", agent="khanak",
                             outbox_path="board/khanak/outbox/f2.md",
                             pipeline="lecture", seed_ref="textbook:x")
        store.set_assignment_status(conn, "f2", "in-review")
        store.set_assignment_status(conn, "f2", "approved")
    finally:
        conn.close()
    with pytest.raises(ValueError):
        run.submit("f2")
