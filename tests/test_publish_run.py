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
