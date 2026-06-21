"""GET /api/questions — proxies the always-up QX engine's /api/qsearch (exact +
semantic), returning per-result rendered HTML (maths + figures) with asset URLs
absolutized to the QX server. QX unreachable -> graceful empty + error (200).
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from samagra.api import app as api_app

_PAYLOAD = {
    "results": [
        {"q_uid": "q1", "slug": "paper-a", "q_type": "mcq_single",
         "subject": "physics", "chapter": "Kinematics", "difficulty": None,
         "snippet": "A projectile [fig]",
         "html": '<div class="stem">A projectile</div><img class="fig" src="/asset?slug=paper-a&amp;id=f1">'},
    ],
    "total": 1, "page": 1, "page_size": 25, "mode": "exact", "degraded": False,
    "facets": {"subject": [["physics", 1]], "chapter": [["Kinematics", 1]], "qtype": [["mcq_single", 1]]},
}


class _FakeClient:
    base_url = "http://127.0.0.1:8783"

    def __init__(self, *a, **k):
        pass

    def search(self, **kw):
        _FakeClient.last_kw = kw
        return _PAYLOAD


class _DownClient:
    base_url = "http://127.0.0.1:8783"

    def __init__(self, *a, **k):
        pass

    def search(self, **kw):
        raise RuntimeError("connection refused")


def test_proxies_qx_and_absolutizes_assets(monkeypatch):
    monkeypatch.setattr(api_app, "QxClient", _FakeClient)
    r = TestClient(api_app.app).get(
        "/api/questions?q=projectile&mode=semantic&subject=physics&page=2")
    assert r.status_code == 200
    j = r.json()
    assert j["total"] == 1 and j["mode"] == "exact" and j["degraded"] is False
    # the filters are forwarded to the QX client
    assert _FakeClient.last_kw["q"] == "projectile"
    assert _FakeClient.last_kw["mode"] == "semantic"
    assert _FakeClient.last_kw["subject"] == "physics"
    assert _FakeClient.last_kw["page"] == 2
    # figure asset URL is absolute (loads from the QX server)
    assert 'src="http://127.0.0.1:8783/asset?slug=paper-a&amp;id=f1"' in j["results"][0]["html"]
    assert j["facets"]["subject"] == [["physics", 1]]


def test_graceful_when_qx_unreachable(monkeypatch):
    monkeypatch.setattr(api_app, "QxClient", _DownClient)
    r = TestClient(api_app.app).get("/api/questions?q=x")
    assert r.status_code == 200
    j = r.json()
    assert j["results"] == [] and j["mode"] == "exact"
    assert "error" in j and "unavailable" in j["error"].lower()
