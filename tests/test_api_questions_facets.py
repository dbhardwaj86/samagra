from fastapi.testclient import TestClient
from samagra.api import app as api_app


def test_questions_facets_uses_qx_summary(monkeypatch):
    class FakeQx:
        def available(self): return True
        def summary(self): return {"subjects": {"Mechanics": 40, "Optics": 12}}
    monkeypatch.setattr(api_app, "get_adapter", lambda name: FakeQx() if name == "qx" else None)
    r = TestClient(api_app.app).get("/api/questions/facets")
    assert r.status_code == 200
    assert sorted(r.json()["subjects"]) == ["Mechanics", "Optics"]
    assert not any(s.startswith("SIM") for s in r.json()["subjects"])


def test_questions_facets_absent_qx(monkeypatch):
    monkeypatch.setattr(api_app, "get_adapter", lambda name: None)
    r = TestClient(api_app.app).get("/api/questions/facets")
    assert r.status_code == 200 and r.json() == {"subjects": []}
