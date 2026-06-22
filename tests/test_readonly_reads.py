"""W1.4 — GET routes must be side-effect-free.

`catalog.connect()` ran schema DDL on every call and `/api/assignments` called
`gstore.init_tables` on every read, so GET routes silently issued write
transactions. Fix: ensure the schema once (memoized + at startup), and open the
DB read-only on the read paths so a GET physically cannot mutate.
"""
from __future__ import annotations

import sqlite3

import pytest
from fastapi.testclient import TestClient

from samagra import catalog
from samagra.api import app as api_app
from samagra.governance import store as gstore


def test_catalog_connect_ro_rejects_writes():
    catalog.ensure_schema()
    con = catalog.connect_ro()
    try:
        with pytest.raises(sqlite3.OperationalError):
            con.execute("insert into catalog(uid) values('x')")
            con.commit()
    finally:
        con.close()


def test_catalog_reads_work_on_a_fresh_db():
    # No prior refresh: the read helpers must still return (auto-ensured schema),
    # not raise "no such table".
    assert catalog.facets() == {"sources": [], "kinds": [], "subjects": []}
    assert catalog.overview()["sources"] == []
    assert catalog.search("anything") == []


def test_catalog_ensure_schema_is_idempotent():
    catalog.ensure_schema()
    catalog.ensure_schema()  # second call must not raise
    con = catalog.connect_ro()
    try:
        names = {r[0] for r in con.execute(
            "select name from sqlite_master where type='table'")}
    finally:
        con.close()
    assert {"catalog", "source_summary", "refresh_meta"} <= names


def test_gstore_connect_ro_rejects_writes():
    gstore.ensure_tables()
    con = gstore.connect_ro()
    try:
        with pytest.raises(sqlite3.OperationalError):
            con.execute("insert into events(ts,actor,verb) values('t','a','v')")
            con.commit()
    finally:
        con.close()


def test_gstore_ensure_tables_is_idempotent():
    gstore.ensure_tables()
    gstore.ensure_tables()  # second call must not raise
    con = gstore.connect_ro()
    try:
        names = {r[0] for r in con.execute(
            "select name from sqlite_master where type='table'")}
    finally:
        con.close()
    assert {"assignments", "events", "review_overlay"} <= names


def test_assignments_endpoint_still_serves_repeatedly():
    c = TestClient(api_app.app)
    for _ in range(3):
        r = c.get("/api/assignments")
        assert r.status_code == 200
        assert r.json() == {"assignments": [], "events": []}


def test_startup_lifespan_initializes_schema():
    # Using the client as a context manager runs the lifespan; the read
    # endpoints must serve immediately afterwards.
    with TestClient(api_app.app) as c:
        assert c.get("/api/overview").status_code == 200
        assert c.get("/api/assignments").status_code == 200
