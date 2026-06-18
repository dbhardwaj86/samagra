"""Phase A spine tests. Source-dependent tests skip cleanly when sources are
absent (e.g. in CI), so the suite is green both locally and on GitHub."""
from __future__ import annotations

import pytest

from teachingos import catalog, state
from teachingos.adapters import ALL_ADAPTERS, get_adapter


def test_adapters_registered():
    names = {a.name for a in ALL_ADAPTERS}
    assert {"qx", "textbook", "booklets", "insp", "sims", "questiondb"} <= names


def test_catalog_refresh_runs():
    totals = catalog.refresh(verbose=False)
    assert isinstance(totals, dict)
    assert set(totals) >= {"qx", "textbook", "sims"}


def test_catalog_overview_shape():
    catalog.refresh(verbose=False)
    ov = catalog.overview()
    assert "sources" in ov and "refreshed_at" in ov


def test_state_machine_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(state.config, "STATE_DIR", tmp_path)
    st = state.init("textbook")
    assert st["current"] == "draft"
    state.set_phase("textbook", "draft", "done")
    st2 = state.load("textbook")
    assert st2["phases"]["draft"]["status"] == "done"
    assert st2["current"] == "enrich"


@pytest.mark.skipif(not get_adapter("qx").available(),
                    reason="QX source not present")
def test_qx_counts():
    s = get_adapter("qx").summary()
    assert s["questions"] > 1000 and s["documents"] > 100


@pytest.mark.skipif(not get_adapter("textbook").available(),
                    reason="textbook source not present")
def test_textbook_chapters():
    s = get_adapter("textbook").summary()
    assert s["chapters"] >= 50
