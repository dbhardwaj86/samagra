# tests/test_publish_run.py
import json
import pytest
from samagra import config
from samagra.governance import store
from samagra.factory.publish import run


@pytest.fixture
def publish_env(tmp_path, monkeypatch):
    """Isolate governance + export + published trees into tmp (mirrors
    tests/test_factory_run.py::factory_env, plus PUBLISHED_DIR)."""
    monkeypatch.setattr(config, "GOVERNANCE_DB", tmp_path / "governance.db")
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "exports")
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    store._INITIALIZED.clear()
    store.ensure_tables()
    monkeypatch.chdir(tmp_path)
    yield tmp_path
    store._INITIALIZED.clear()


def test_publishable_excludes_the_mcd_seed_lane():
    assert "seed" not in run.PUBLISHABLE
    assert {"revision", "lecture", "deck", "paper", "drill", "samadhan"} == run.PUBLISHABLE


def test_norm_lanes_validates_against_publishable():
    assert run._norm_lanes(None) is None
    assert run._norm_lanes("revision,deck") == {"revision", "deck"}
    with pytest.raises(ValueError):
        run._norm_lanes("seed")                       # not publishable
    with pytest.raises(ValueError):
        run._norm_lanes("bogus")


def test_titleize():
    assert run._titleize("circular-motion") == "Circular Motion"


def test_last_product_created_recovers_the_artifact_dict():
    events = [
        {"verb": "product_building", "note": "x"},
        {"verb": "product_created",
         "note": json.dumps({"line": "revision", "artifact": {"html": "/p/a.html"}})},
    ]
    assert run._last_product_created(events) == {"html": "/p/a.html"}


def test_last_product_created_returns_none_without_a_created_event():
    assert run._last_product_created([{"verb": "product_building", "note": "x"}]) is None


def test_last_product_created_returns_last_on_rebuild():
    events = [
        {"verb": "product_created",
         "note": json.dumps({"line": "revision", "artifact": {"html": "/a.html"}})},
        {"verb": "product_created",
         "note": json.dumps({"line": "revision", "artifact": {"html": "/b.html"}})},
    ]
    assert run._last_product_created(events) == {"html": "/b.html"}


def test_last_product_created_tolerates_malformed_notes():
    events = [
        {"verb": "product_created", "note": "not-json"},
        {"verb": "product_created",
         "note": json.dumps({"line": "revision", "artifact": "not-a-dict"})},
        {"verb": "product_created",
         "note": json.dumps({"line": "revision", "artifact": {"html": "/ok.html"}})},
    ]
    assert run._last_product_created(events) == {"html": "/ok.html"}


def test_norm_lanes_edges():
    assert run._norm_lanes("revision") == {"revision"}
    assert run._norm_lanes(["revision", "deck"]) == {"revision", "deck"}
    assert run._norm_lanes(" revision , deck ") == {"revision", "deck"}
    with pytest.raises(ValueError):
        run._norm_lanes("")
    with pytest.raises(ValueError):
        run._norm_lanes([])


def _captured_revision_assignment(conn, aid, html_path):
    """A minimal captured 'revision' assignment for textbook:cm with a
    product_created note pointing at html_path."""
    store.add_assignment(conn, id=aid, agent="khanak", outbox_path="o",
                         pipeline="revision", seed_ref="textbook:cm")
    store.append_event(conn, actor="khanak", verb="product_created",
                       assignment_id=aid, subsystem="factory",
                       note=json.dumps({"line": "revision",
                                        "artifact": {"html": str(html_path), "docx": None}}))
    store.set_assignment_status(conn, aid, "captured")


def test_captured_publishable_happy_path(publish_env):
    f = publish_env / "cm-thin.html"
    f.write_text("<h1>x</h1>", encoding="utf-8")
    conn = store.connect()
    try:
        _captured_revision_assignment(conn, "x3", f)
        out = run._captured_publishable(conn, "cm", None)
        assert len(out) == 1
        assert out[0]["lane"] == "revision"
        assert out[0]["source_files"] == [str(f)]
        assert out[0]["assignment_id"] == "x3"
    finally:
        conn.close()


def test_captured_publishable_refuses_missing_product_created(publish_env):
    conn = store.connect()
    try:
        store.add_assignment(conn, id="x1", agent="khanak", outbox_path="o",
                             pipeline="revision", seed_ref="textbook:cm")
        store.set_assignment_status(conn, "x1", "captured")
        with pytest.raises(ValueError, match="no recoverable artifact"):
            run._captured_publishable(conn, "cm", None)
    finally:
        conn.close()


def test_captured_publishable_refuses_missing_file(publish_env):
    conn = store.connect()
    try:
        _captured_revision_assignment(conn, "x2", "/no/such/file.html")
        with pytest.raises(ValueError, match="file missing on disk"):
            run._captured_publishable(conn, "cm", None)
    finally:
        conn.close()
