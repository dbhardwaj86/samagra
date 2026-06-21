"""Live-read passthroughs: /api/munshi/library and /api/mcd/seeds.

These read the live subsystems via the adapters (not the catalog) so the capture
apps show real data and a fresh capture is visible on refetch. Read-only,
creds-gated, and must never leak upstream/secret detail on failure.
"""
from fastapi.testclient import TestClient

from samagra.api import app as api_app
from samagra.adapters.base import Artifact


def _c():
    return TestClient(api_app.app)


def _fake_adapter(available=True, arts=None, boom=None):
    class A:
        def available(self):
            return available

        def artifacts(self):
            if boom:
                raise RuntimeError(boom)
            return iter(arts or [])

    return A()


def test_munshi_library_returns_live_artifacts(monkeypatch):
    art = Artifact(uid="munshi:1", source="munshi", kind="todo",
                   title="Call parent", status="open")
    monkeypatch.setattr(api_app, "get_adapter",
                        lambda n: _fake_adapter(arts=[art]) if n == "munshi" else None)
    r = _c().get("/api/munshi/library")
    assert r.status_code == 200
    res = r.json()["results"]
    assert len(res) == 1
    assert res[0]["title"] == "Call parent" and res[0]["kind"] == "todo"


def test_munshi_library_unconfigured(monkeypatch):
    monkeypatch.setattr(api_app, "get_adapter",
                        lambda n: _fake_adapter(available=False))
    r = _c().get("/api/munshi/library")
    assert r.status_code == 200 and r.json()["results"] == []


def test_mcd_seeds_returns_live_artifacts(monkeypatch):
    art = Artifact(uid="mcd:s1", source="mycontentdev", kind="rough_idea",
                   title="tidal demo", status="captured")
    monkeypatch.setattr(api_app, "get_adapter",
                        lambda n: _fake_adapter(arts=[art]) if n == "mycontentdev" else None)
    r = _c().get("/api/mcd/seeds")
    assert r.status_code == 200
    res = r.json()["results"]
    assert len(res) == 1 and res[0]["title"] == "tidal demo"


def test_mcd_seeds_read_failure_does_not_leak(monkeypatch):
    monkeypatch.setattr(api_app, "get_adapter",
                        lambda n: _fake_adapter(boom="boom https://x.dev adminKEY123")
                        if n == "mycontentdev" else None)
    r = _c().get("/api/mcd/seeds")
    assert r.status_code == 200 and r.json()["results"] == []
    assert "adminKEY123" not in r.text and "https://x.dev" not in r.text
