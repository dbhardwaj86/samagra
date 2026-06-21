"""E2.1: GET /api/org returns the static org chart (no DB, read-only)."""
from __future__ import annotations

from samagra import org
from samagra.api import app as api


def test_org_dict_shape():
    o = org.ORG
    assert o["chairman"]["name"] == "Deepak Bhardwaj"
    assert o["chairman"]["role"] == "Founder & Chairman"
    # board hierarchy from the source-verified roster
    assert [b["id"] for b in o["board"]] == ["claude-deepak", "claude-khanak", "codex"]
    # owners map covers ALL 7 distinct state.PIPELINES owner ids
    assert set(o["owners"]) == {
        "claude1", "claude2", "codex", "gemini", "human", "notebooklm", "teachingos"
    }
    # every owner entry has a name + role
    assert all({"name", "role"} <= set(v) for v in o["owners"].values())
    # owner-confirmed identity mapping (claude1 = CEO Deepak, claude2 = CTO Khanak)
    assert o["owners"]["claude1"]["name"] == "Claude-Deepak"
    assert o["owners"]["claude2"]["name"] == "Claude-Khanak"


def test_org_owner_ids_align_to_pipeline_owners():
    """The owners map must cover every owner string used across the live pipelines."""
    from samagra import state
    used = {ow for p in state.PIPELINES.values() for ow in p["owners"].values()}
    assert used <= set(org.ORG["owners"])


def test_api_org_route_returns_org():
    assert api.api_org() is org.ORG


def test_api_org_route_registered():
    assert "/api/org" in {r.path for r in api.app.routes}
