"""Bridge tests after the Phase C3 fold.

The munshi->mcd WORKFLOW (scan/approve/submit) folded into the factory `seed`
lane (F-C2); the bridge verbs are now thin deprecating delegators. The behaviors
those verbs used to lock are re-homed to tests/test_factory_seed.py (the seed
lane) and the payload-shape tests to tests/test_factory_seed_payload.py. What
stays here: the pure helpers that keep their bridge home (classify_item,
item_text, resolve_pointers), the governance status contract, the seed_payload
re-export shim, and the deprecating-delegation + CLI surface.
"""
from __future__ import annotations

import sys

import pytest

import samagra.__main__ as cli

from samagra.bridge.text import item_text
from samagra.bridge.classify import classify_item
from samagra import catalog, config
from samagra.bridge.pointers import resolve_pointers
from samagra.governance import store
from samagra.bridge import run


def _item(kind, payload, **kw):
    base = {"id": "i1", "kind": kind, "payload": payload, "status": "open"}
    base.update(kw)
    return base


# --- pure helpers (still homed in the bridge package, imported by the factory) -

@pytest.mark.parametrize(
    "item,expected",
    [
        (_item("question", {"stem": "Find the work done by friction on a block?"}), "content"),
        (_item("note", {"issue": "Nice intuition for Gauss's law and electric flux"}), "content"),
        (_item("todo", {"task": "Make a question on rotational kinetic energy"}), "content"),
        (_item("note", {"text": "Gauss law electric flux through a cube"}), "content"),
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


@pytest.mark.parametrize(
    "task,expected",
    [
        ("finish the office paperwork", "ops"),
        ("set up the lab network", "ops"),
        ("make a question on work and energy", "content"),
        ("rotational dynamics worksheet", "content"),
    ],
)
def test_classify_uses_word_boundary_not_substring(task, expected):
    assert classify_item(_item("todo", {"task": task})) == expected


# --- governance status contract ----------------------------------------------

@pytest.fixture
def temp_gov(tmp_path, monkeypatch):
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
                             pipeline="seed", seed_ref="munshi:1")
        store.set_assignment_status(conn, "a1", "in-review")
        store.set_assignment_status(conn, "a1", "approved")
        store.set_assignment_status(conn, "a1", "captured")   # must not raise
        a = next(a for a in store.list_assignments(conn) if a["id"] == "a1")
        assert a["status"] == "captured"
    finally:
        conn.close()


# --- seed_payload re-export shim (Phase C3) -----------------------------------

def test_bridge_seed_payload_shim_reexports_from_factory():
    """The relocated helpers stay importable from the old path (Phase C3 shim)."""
    from samagra.bridge.seed_payload import (
        SEED_TYPES, build_seed_payload, validate_seed_payload)
    from samagra.factory import seed_payload as canonical
    assert build_seed_payload is canonical.build_seed_payload
    assert validate_seed_payload is canonical.validate_seed_payload
    assert SEED_TYPES == canonical.SEED_TYPES


# --- deprecating delegation (F-C2: the bridge folds into the factory) ---------

def test_bridge_scan_delegates_to_factory(monkeypatch, capsys):
    seen = {}
    monkeypatch.setattr("samagra.factory.run.scan",
                        lambda dry=True: seen.update(dry=dry) or [{"x": 1}])
    out = run.scan(dry=True)
    assert seen["dry"] is True and out == [{"x": 1}]
    assert "deprecated" in capsys.readouterr().err.lower()


def test_bridge_approve_delegates_to_factory(monkeypatch, capsys):
    seen = {}
    monkeypatch.setattr("samagra.factory.run.approve",
                        lambda aid: seen.update(aid=aid) or {"status": "approved"})
    assert run.approve("a1")["status"] == "approved"
    assert seen["aid"] == "a1"
    assert "deprecated" in capsys.readouterr().err.lower()


def test_bridge_submit_delegates_to_factory_build_not_a_second_writer(monkeypatch, capsys):
    """F-C2: bridge.submit's own prod write is RETIRED — it forwards to the factory
    build (the one mcd writer)."""
    seen = {}
    monkeypatch.setattr("samagra.factory.run.build",
                        lambda aid: seen.update(aid=aid) or {"artifact_ref": "mcd:seed-5"})
    out = run.submit("a1")
    assert seen["aid"] == "a1" and out["artifact_ref"] == "mcd:seed-5"
    assert "deprecated" in capsys.readouterr().err.lower()


# --- CLI surface (the deprecated bridge verbs still dispatch) -----------------

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
