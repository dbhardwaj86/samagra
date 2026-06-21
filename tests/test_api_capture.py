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

def test_munshi_capture_optional_field_passed(monkeypatch):
    captured = {}
    class FakeClient:
        def available(self): return True
        def create_item(self, kind, fields): captured.update(kind=kind, fields=fields); return {"item_id": 1}
    monkeypatch.setattr(api_app, "MunshiClient", lambda: FakeClient())
    r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": "A", "task": "T", "due": "tmrw"})
    assert r.status_code == 200
    assert captured["fields"] == {"assignee": "A", "task": "T", "due": "tmrw"}

def test_munshi_capture_strips_unknown_fields(monkeypatch):
    captured = {}
    class FakeClient:
        def available(self): return True
        def create_item(self, kind, fields): captured.update(kind=kind, fields=fields); return {"item_id": 2}
    monkeypatch.setattr(api_app, "MunshiClient", lambda: FakeClient())
    r = _client().post("/api/munshi/capture", json={
        "kind": "todo", "assignee": "A", "task": "T",
        "status": "done", "id": 99, "ts": "x", "label": "spoof",
    })
    assert r.status_code == 200
    # only contract-allowed fields forwarded to the production write
    assert captured["fields"] == {"assignee": "A", "task": "T"}

def test_munshi_capture_nonstring_kind(monkeypatch):
    monkeypatch.setattr(api_app, "MunshiClient", lambda: type("F", (), {"available": lambda s: True})())
    r = _client().post("/api/munshi/capture", json={"kind": ["todo"], "assignee": "A", "task": "T"})
    assert r.status_code == 400

def test_munshi_capture_nonstring_required_value(monkeypatch):
    monkeypatch.setattr(api_app, "MunshiClient", lambda: type("F", (), {"available": lambda s: True})())
    r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": 123, "task": "T"})
    assert r.status_code == 400

def test_munshi_capture_upstream_failure_502(monkeypatch):
    class FakeClient:
        def available(self): return True
        def create_item(self, kind, fields): raise RuntimeError("secret: token=abc123 https://munshi.internal")
    monkeypatch.setattr(api_app, "MunshiClient", lambda: FakeClient())
    r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": "A", "task": "T"})
    assert r.status_code == 502
    body = r.text
    assert "token" not in body and "munshi.internal" not in body and "abc123" not in body


def test_mcd_seed_happy(monkeypatch):
    captured = {}
    class FakeMcd:
        def available(self): return True
        def create_seed(self, fields): captured.update(fields); return {"id": "s1", "status": "captured"}
    monkeypatch.setattr(api_app, "McdClient", lambda: FakeMcd())
    r = _client().post("/api/mcd/seeds", json={"type": "rough_idea", "raw_text": "idea"})
    assert r.status_code == 200 and r.json()["seed"]["id"] == "s1"
    assert captured == {"type": "rough_idea", "raw_text": "idea"}

def test_mcd_seed_bad_type(monkeypatch):
    monkeypatch.setattr(api_app, "McdClient", lambda: type("F", (), {"available": lambda s: True})())
    r = _client().post("/api/mcd/seeds", json={"type": "nope", "raw_text": "x"})
    assert r.status_code == 400

def test_mcd_seed_empty_text(monkeypatch):
    monkeypatch.setattr(api_app, "McdClient", lambda: type("F", (), {"available": lambda s: True})())
    r = _client().post("/api/mcd/seeds", json={"type": "rough_idea", "raw_text": "  "})
    assert r.status_code == 400

def test_mcd_seed_unconfigured(monkeypatch):
    monkeypatch.setattr(api_app, "McdClient", lambda: type("F", (), {"available": lambda s: False})())
    r = _client().post("/api/mcd/seeds", json={"type": "rough_idea", "raw_text": "x"})
    assert r.status_code == 503
