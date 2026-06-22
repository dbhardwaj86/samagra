"""W1.3 — validate SAMAGRA_QX_SERVER_URL as loopback (or an explicit allowlist).

The QX base URL is the target of BOTH the backend `requests.get` AND the figure
`<img src>` URLs the browser loads. A poisoned QX_SERVER_URL would turn the proxy
into an SSRF vector (backend fetches an attacker host) and an open asset-host
(the browser loads images from anywhere). Constrain it to loopback unless an
explicit allowlist opts a host in.
"""
from __future__ import annotations

import pytest

from samagra import config
from samagra.api import qx_guard
from samagra.clients import qx_client


@pytest.mark.parametrize("url", [
    "http://127.0.0.1:8783",
    "http://127.0.0.1:8783/",
    "http://localhost:8783",
    "http://[::1]:8783",
    "https://localhost",
])
def test_loopback_urls_are_allowed(url):
    # returns the URL unchanged (no raise)
    assert qx_guard.validate_qx_url(url) == url


@pytest.mark.parametrize("url", [
    "http://evil.example.com",
    "http://169.254.169.254/latest/meta-data/",   # cloud metadata SSRF target
    "http://10.0.0.5:8783",
    "http://attacker.internal:8783",
])
def test_offhost_urls_are_rejected(url):
    with pytest.raises(ValueError):
        qx_guard.validate_qx_url(url)


@pytest.mark.parametrize("url", [
    "ftp://127.0.0.1",
    "file:///etc/passwd",
    "127.0.0.1:8783",   # no scheme
])
def test_non_http_schemes_are_rejected(url):
    with pytest.raises(ValueError):
        qx_guard.validate_qx_url(url)


def test_allowlist_opts_in_a_trusted_host(monkeypatch):
    monkeypatch.setattr(config, "QX_SERVER_ALLOWED_HOSTS", "qx.lan, other.host")
    assert qx_guard.validate_qx_url("http://qx.lan:8783") == "http://qx.lan:8783"
    # a host NOT on the allowlist is still rejected
    with pytest.raises(ValueError):
        qx_guard.validate_qx_url("http://not.allowed:8783")


def test_qxclient_rejects_poisoned_base_url():
    with pytest.raises(ValueError):
        qx_client.QxClient(base_url="http://evil.example.com")


def test_qxclient_accepts_loopback_base_url():
    c = qx_client.QxClient(base_url="http://127.0.0.1:8783/")
    assert c.base_url == "http://127.0.0.1:8783"


def test_questions_endpoint_degrades_gracefully_on_poisoned_url(monkeypatch):
    # A misconfigured QX_SERVER_URL must NOT 500 — the questions route fails
    # closed to a graceful empty + error body (the SSRF fetch never happens).
    from fastapi.testclient import TestClient
    from samagra.api import app as api_app

    monkeypatch.setattr(config, "QX_SERVER_URL", "http://evil.example.com")
    r = TestClient(api_app.app).get("/api/questions?q=x")
    assert r.status_code == 200
    assert r.json()["results"] == []
    assert "error" in r.json()
