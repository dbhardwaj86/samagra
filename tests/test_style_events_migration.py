"""Phase D3: the additive style_events migration (_MIGRATIONS[2]).

The autouse isolate_data_db fixture (conftest) repoints GOVERNANCE_DB at a
per-test temp file, so no real governance.db is touched.
"""
from __future__ import annotations

import sqlite3

import pytest

from samagra.governance import store


@pytest.fixture()
def conn():
    c = store.connect()
    store.init_tables(c)
    yield c
    c.close()


def test_schema_version_is_2():
    assert store.SCHEMA_VERSION == 2


def test_migration_creates_style_events(conn):
    names = {r[0] for r in conn.execute(
        "select name from sqlite_master where type='table'")}
    assert "style_events" in names


def test_style_events_has_expected_columns(conn):
    cols = {r[1] for r in conn.execute("PRAGMA table_info(style_events)")}
    assert {"id", "ts", "kind", "subsystem_ref", "from_version",
            "payload_json", "status"} <= cols


def test_init_stamps_user_version_2(conn):
    assert conn.execute("PRAGMA user_version").fetchone()[0] == 2


def test_status_defaults_to_proposed(conn):
    conn.execute("INSERT INTO style_events (ts, kind, payload_json) "
                 "VALUES ('t', 'facet_delta', '{}')")
    conn.commit()
    row = conn.execute("SELECT status FROM style_events").fetchone()
    assert row[0] == "proposed"


def test_migration_upgrades_an_existing_v1_db(tmp_path, monkeypatch):
    # Simulate a pre-D3 governance DB stamped at user_version 1 with the baseline
    # tables but NO style_events, then prove init_tables adds it and re-stamps.
    db = tmp_path / "old.db"
    monkeypatch.setattr(store.config, "GOVERNANCE_DB", db)
    raw = sqlite3.connect(db)
    raw.executescript(store.DDL)
    raw.execute("PRAGMA user_version = 1")
    raw.commit()
    raw.close()

    c = store.connect()
    store.init_tables(c)
    try:
        names = {r[0] for r in c.execute(
            "select name from sqlite_master where type='table'")}
        assert "style_events" in names
        assert c.execute("PRAGMA user_version").fetchone()[0] == 2
    finally:
        c.close()


def test_init_is_idempotent_at_v2(conn):
    conn.execute("INSERT INTO style_events (ts, kind, payload_json) "
                 "VALUES ('t', 'facet_delta', '{}')")
    conn.commit()
    store.init_tables(conn)  # second run must not raise or drop rows
    assert conn.execute("SELECT count(*) FROM style_events").fetchone()[0] == 1
    assert conn.execute("PRAGMA user_version").fetchone()[0] == 2
