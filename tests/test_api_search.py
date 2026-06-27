"""GET /api/search — the network-facing catalog read.

review 27 MED-3: the endpoint must clamp `limit` to a positive bound. A negative
limit (e.g. -1) is SQLite's "unbounded" and would dump the whole catalog in one
response; the frontend's max page is 500. The CLI calls catalog.search directly
and is unaffected by this network-only clamp.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from samagra.api import app as api_app


def _captured_limit(monkeypatch):
    seen = {}

    def fake_search(q="", *, source=None, kind=None, limit=200):
        seen["limit"] = limit
        return []
    monkeypatch.setattr(api_app.catalog, "search", fake_search)
    return seen


def test_negative_limit_is_clamped_to_positive(monkeypatch):
    seen = _captured_limit(monkeypatch)
    r = TestClient(api_app.app).get("/api/search", params={"limit": -1})
    assert r.status_code == 200
    assert seen["limit"] >= 1                      # never SQLite's unbounded -1


def test_zero_limit_is_clamped_to_at_least_one(monkeypatch):
    seen = _captured_limit(monkeypatch)
    TestClient(api_app.app).get("/api/search", params={"limit": 0})
    assert seen["limit"] >= 1


def test_huge_limit_is_capped(monkeypatch):
    seen = _captured_limit(monkeypatch)
    TestClient(api_app.app).get("/api/search", params={"limit": 100000})
    assert seen["limit"] <= 500                    # bounded to the frontend max page


def test_frontend_max_page_500_passes_through(monkeypatch):
    seen = _captured_limit(monkeypatch)
    TestClient(api_app.app).get("/api/search", params={"limit": 500})
    assert seen["limit"] == 500                    # Booklets/Insp apps use limit=500
