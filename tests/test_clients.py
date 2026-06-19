"""Unit tests for the read-only subsystem HTTP clients.

The HTTP layer is fully MOCKED — no live-prod calls. We monkeypatch the module
`requests` attribute with a fake transport that records the last request and
returns canned JSON. We also assert that secret values are never echoed.

create_seed is DEFERRED to Phase 3 (D2/D9), so there is no write-path test here.
"""
from __future__ import annotations

from samagra.clients import mcd_client, munshi_client


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
    """Records the last GET/POST and returns a canned payload."""

    def __init__(self, payload):
        self.payload = payload
        self.last = None

    def get(self, url, headers=None, timeout=None):
        self.last = {"method": "GET", "url": url, "headers": headers or {},
                     "json": None, "timeout": timeout}
        return FakeResponse(self.payload)

    def post(self, url, headers=None, json=None, timeout=None):
        self.last = {"method": "POST", "url": url, "headers": headers or {},
                     "json": json, "timeout": timeout}
        return FakeResponse(self.payload)


# ---------------- McdClient ----------------

def test_mcd_available_false_without_creds(monkeypatch):
    monkeypatch.delenv("MCD_API_URL", raising=False)
    monkeypatch.delenv("MCD_ADMIN_KEY", raising=False)
    monkeypatch.delenv("MCD_APP_KEY", raising=False)
    monkeypatch.setattr(mcd_client, "_load_cloud_json", lambda: {})
    c = mcd_client.McdClient()
    assert c.available() is False


def test_mcd_available_true_with_env(monkeypatch):
    monkeypatch.setenv("MCD_API_URL", "https://mcd.example.dev/")
    monkeypatch.setenv("MCD_ADMIN_KEY", "ADMIN-SECRET")
    monkeypatch.setattr(mcd_client, "_load_cloud_json", lambda: {})
    c = mcd_client.McdClient()
    assert c.available() is True
    # trailing slash trimmed, mirroring _cloud.mjs
    assert c.api_url == "https://mcd.example.dev"


def test_mcd_query_posts_with_admin_header(monkeypatch):
    fake = FakeRequests([{"id": "s1", "title": "Gauss law"}])
    monkeypatch.setattr(mcd_client, "requests", fake)
    c = mcd_client.McdClient(api_url="https://mcd.example.dev",
                             admin_key="ADMIN-SECRET")
    rows = c.query("SELECT 1")
    assert rows == [{"id": "s1", "title": "Gauss law"}]
    assert fake.last["method"] == "POST"
    assert fake.last["url"] == "https://mcd.example.dev/api/admin/query"
    assert fake.last["headers"]["x-mcd-admin"] == "ADMIN-SECRET"
    assert fake.last["json"] == {"sql": "SELECT 1"}


def test_mcd_pending_gets_with_admin_header(monkeypatch):
    fake = FakeRequests([{"id": "s2", "status": "needs_processing"}])
    monkeypatch.setattr(mcd_client, "requests", fake)
    c = mcd_client.McdClient(api_url="https://mcd.example.dev",
                             admin_key="ADMIN-SECRET")
    rows = c.pending()
    assert rows == [{"id": "s2", "status": "needs_processing"}]
    assert fake.last["method"] == "GET"
    assert fake.last["url"] == "https://mcd.example.dev/api/admin/pending"
    assert fake.last["headers"]["x-mcd-admin"] == "ADMIN-SECRET"


def test_mcd_repr_never_leaks_secret(monkeypatch):
    monkeypatch.setattr(mcd_client, "_load_cloud_json", lambda: {})
    c = mcd_client.McdClient(api_url="https://mcd.example.dev",
                             admin_key="ADMIN-SECRET", app_key="APP-SECRET")
    assert "ADMIN-SECRET" not in repr(c)
    assert "APP-SECRET" not in repr(c)


# ---------------- MunshiClient ----------------

def test_munshi_available_false_without_creds(monkeypatch):
    monkeypatch.delenv("MUNSHI_API_URL", raising=False)
    monkeypatch.delenv("MUNSHI_SECRET", raising=False)
    c = munshi_client.MunshiClient()
    assert c.available() is False


def test_munshi_available_true_with_env(monkeypatch):
    monkeypatch.setenv("MUNSHI_API_URL", "https://munshi.example.dev/")
    monkeypatch.setenv("MUNSHI_SECRET", "COOKIE-SECRET")
    c = munshi_client.MunshiClient()
    assert c.available() is True
    assert c.api_url == "https://munshi.example.dev"


def test_munshi_library_sends_cookie_header(monkeypatch):
    fake = FakeRequests({"people": [], "total": 2,
                         "items": [{"id": 1}, {"id": 2}]})
    monkeypatch.setattr(munshi_client, "requests", fake)
    c = munshi_client.MunshiClient(api_url="https://munshi.example.dev",
                                   secret="COOKIE SECRET/with=chars")
    lib = c.library()
    assert lib["total"] == 2 and len(lib["items"]) == 2
    assert fake.last["method"] == "GET"
    assert fake.last["url"] == "https://munshi.example.dev/api/library"
    # secret is URL-encoded into the cookie, exactly like driver.mjs cookie()
    assert fake.last["headers"]["Cookie"] == "munshi=COOKIE%20SECRET%2Fwith%3Dchars"


def test_munshi_repr_never_leaks_secret():
    c = munshi_client.MunshiClient(api_url="https://munshi.example.dev",
                                   secret="COOKIE-SECRET")
    assert "COOKIE-SECRET" not in repr(c)
