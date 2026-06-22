"""Phase 3 — active-loop bridge tests. All HTTP clients are mocked; no live calls."""
from __future__ import annotations

import json
import sys

import pytest

from samagra.bridge.text import item_text
from samagra.bridge.classify import classify_item
from samagra import catalog, config
from samagra.bridge.pointers import resolve_pointers


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
