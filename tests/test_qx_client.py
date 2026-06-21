"""QxClient — thin local-HTTP client to the always-up QX server's /api/qsearch.

Fully MOCKED transport; no live HTTP. QX is a local read-only question engine
(no secret), so this client just shapes the GET and returns JSON.
"""
from __future__ import annotations

from samagra.clients import qx_client


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeRequests:
    def __init__(self, payload):
        self.payload = payload
        self.last = None

    def get(self, url, params=None, timeout=None):
        self.last = {"url": url, "params": params or {}, "timeout": timeout}
        return FakeResponse(self.payload)


def test_search_gets_qsearch_with_params(monkeypatch):
    fake = FakeRequests({"results": [], "mode": "exact", "total": 0})
    monkeypatch.setattr(qx_client, "requests", fake)
    c = qx_client.QxClient(base_url="http://127.0.0.1:8783/")
    out = c.search(q="projectile", mode="semantic", subject="physics", page=2)
    assert out["mode"] == "exact"
    assert fake.last["url"] == "http://127.0.0.1:8783/api/qsearch"  # trailing slash trimmed
    p = fake.last["params"]
    assert p["q"] == "projectile" and p["mode"] == "semantic"
    assert p["subject"] == "physics" and p["page"] == 2
    # absent optional filters are not sent
    assert "chapter" not in p and "qtype" not in p


def test_base_url_defaults_to_config(monkeypatch):
    monkeypatch.setattr(qx_client.config, "QX_SERVER_URL", "http://localhost:9999/")
    assert qx_client.QxClient().base_url == "http://localhost:9999"
