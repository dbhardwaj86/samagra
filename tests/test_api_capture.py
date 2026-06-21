from fastapi.testclient import TestClient
from samagra.api import app as api_app

def _client(): return TestClient(api_app.app)

def test_munshi_capture_happy(monkeypatch):
    captured = {}
    class FakeClient:
        def available(self): return True
        def create_item(self, kind, fields): captured.update(kind=kind, fields=fields); return {"item_id": 7}
    monkeypatch.setattr(api_app, "MunshiClient", lambda: FakeClient())
    r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": "A", "task": "T"})
    assert r.status_code == 200 and r.json()["item"] == {"item_id": 7}
    assert captured["kind"] == "todo" and captured["fields"] == {"assignee": "A", "task": "T"}

def test_munshi_capture_bad_kind(monkeypatch):
    monkeypatch.setattr(api_app, "MunshiClient", lambda: type("F", (), {"available": lambda s: True})())
    r = _client().post("/api/munshi/capture", json={"kind": "question", "stem": "x"})
    assert r.status_code == 400

def test_munshi_capture_missing_field(monkeypatch):
    monkeypatch.setattr(api_app, "MunshiClient", lambda: type("F", (), {"available": lambda s: True})())
    r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": "A"})
    assert r.status_code == 400

def test_munshi_capture_unconfigured(monkeypatch):
    monkeypatch.setattr(api_app, "MunshiClient", lambda: type("F", (), {"available": lambda s: False})())
    r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": "A", "task": "T"})
    assert r.status_code == 503
