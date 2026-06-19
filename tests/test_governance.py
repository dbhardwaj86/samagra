"""Phase 2 governance-store tests.

Per runbook D6 the governance store lives in its OWN durable DB
(`config.GOVERNANCE_DB`), separate from the rebuildable catalog
(`config.DATA_DB`). The autouse `isolate_data_db` fixture (conftest) already
repoints BOTH at per-test temp paths, so no real DB is ever touched.
"""
from __future__ import annotations

import sqlite3

import pytest

from samagra import config
from samagra.governance import store


@pytest.fixture()
def conn():
    c = store.connect()
    store.init_tables(c)
    yield c
    c.close()


def test_init_tables_creates_three_tables(conn):
    names = {r[0] for r in conn.execute(
        "select name from sqlite_master where type='table'")}
    assert {"assignments", "events", "review_overlay"} <= names


def test_store_targets_governance_db_not_catalog():
    # D6: the store must open GOVERNANCE_DB, never the rebuildable catalog DB.
    assert config.GOVERNANCE_DB != config.DATA_DB
    c = store.connect()
    try:
        db_path = c.execute("PRAGMA database_list").fetchall()[0][2]
    finally:
        c.close()
    assert db_path == str(config.GOVERNANCE_DB)


def test_init_stamps_schema_version(conn):
    assert conn.execute("PRAGMA user_version").fetchone()[0] == store.SCHEMA_VERSION


def test_init_tables_is_idempotent(conn):
    # Re-running init on an existing DB must not raise or duplicate data.
    store.add_assignment(conn, id="a1", agent="khanak", outbox_path="x.md")
    store.init_tables(conn)
    assert len(store.list_assignments(conn)) == 1
    assert conn.execute("PRAGMA user_version").fetchone()[0] == store.SCHEMA_VERSION


def test_backup_makes_a_usable_copy(conn, tmp_path):
    store.add_assignment(conn, id="a1", agent="khanak", outbox_path="x.md")
    dest = tmp_path / "backups" / "governance.bak.db"
    out = store.backup(dest)
    assert out.exists()
    b = sqlite3.connect(out)
    try:
        b.row_factory = sqlite3.Row
        rows = [dict(r) for r in b.execute("SELECT * FROM assignments")]
    finally:
        b.close()
    assert any(r["id"] == "a1" for r in rows)


def test_add_assignment_and_list(conn):
    store.add_assignment(
        conn, id="a1", agent="khanak",
        outbox_path="board/khanak/outbox/2026-06-19-01-x.md",
        pipeline="mycontentdev", seed_ref="mcd:7",
        expected_output="a draft", review_by="codex")
    rows = store.list_assignments(conn)
    assert len(rows) == 1
    r = rows[0]
    assert r["id"] == "a1"
    assert r["agent"] == "khanak"
    assert r["status"] == "queued"
    assert r["created_at"] and r["created_at"].endswith("Z")
    assert r["created_at"] == r["updated_at"]


def test_set_assignment_status_appends_event(conn):
    store.add_assignment(conn, id="a1", agent="khanak",
                         outbox_path="board/khanak/outbox/x.md")
    store.set_assignment_status(conn, "a1", "running")
    rows = store.list_assignments(conn)
    assert rows[0]["status"] == "running"
    assert rows[0]["updated_at"] >= rows[0]["created_at"]
    evs = store.list_events(conn)
    assert any(e["assignment_id"] == "a1" and e["verb"] == "status:running"
               for e in evs)


def test_set_assignment_status_rejects_unknown(conn):
    store.add_assignment(conn, id="a1", agent="khanak",
                         outbox_path="x.md")
    with pytest.raises(ValueError):
        store.set_assignment_status(conn, "a1", "bogus")


def test_set_status_on_missing_assignment_raises_and_writes_no_event(conn):
    # The ledger is durable audit history — a status change for a nonexistent
    # assignment must raise and must NOT append an orphan event.
    with pytest.raises(ValueError):
        store.set_assignment_status(conn, "ghost", "running")
    assert store.list_events(conn) == []


def test_append_event_standalone(conn):
    store.append_event(conn, actor="system", verb="bridge_scan",
                       subsystem="munshi", subsystem_ref="munshi:3",
                       note="auto")
    evs = store.list_events(conn)
    assert len(evs) == 1
    e = evs[0]
    assert e["actor"] == "system"
    assert e["verb"] == "bridge_scan"
    assert e["subsystem"] == "munshi"
    assert e["ts"].endswith("Z")


def test_add_review_records_verdict(conn):
    store.add_review(conn, subsystem="mycontentdev", subsystem_ref="mcd:7",
                     reviewer="khanak", verdict="approved",
                     artifact_uid="mcd:7", rationale="looks good")
    rows = [dict(r) for r in conn.execute("select * from review_overlay")]
    assert len(rows) == 1
    assert rows[0]["verdict"] == "approved"
    assert rows[0]["reviewer"] == "khanak"


def test_add_review_rejects_bad_verdict(conn):
    with pytest.raises(ValueError):
        store.add_review(conn, subsystem="mycontentdev", subsystem_ref="mcd:7",
                         reviewer="khanak", verdict="maybe")


def test_list_events_limit(conn):
    for i in range(5):
        store.append_event(conn, actor="system", verb=f"v{i}")
    assert len(store.list_events(conn, limit=3)) == 3


def test_api_assignments_endpoint():
    # Exercise the route function directly (repo convention, see test_api_gate.py)
    # so the suite needs no extra HTTP dependency. The autouse isolate_data_db
    # fixture already repoints GOVERNANCE_DB at a per-test temp file, so the
    # endpoint and this test share the same DB.
    c = store.connect()
    store.init_tables(c)
    store.add_assignment(c, id="a1", agent="khanak",
                         outbox_path="board/khanak/outbox/x.md")
    c.close()
    from samagra.api import app as api

    body = api.api_assignments()
    assert "assignments" in body and "events" in body
    assert any(a["id"] == "a1" for a in body["assignments"])
