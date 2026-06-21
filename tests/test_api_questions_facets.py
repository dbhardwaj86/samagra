import pytest
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


@pytest.mark.parametrize(
    "available, summary",
    [
        (False, {"subjects": {"Mechanics": 40}}),  # adapter present but QX offline
        (True, None),                               # summary() returns None
        (True, {}),                                 # summary() missing the subjects key
        (True, {"subjects": {}}),                   # subjects present but empty
    ],
)
def test_questions_facets_degradation_branches(monkeypatch, available, summary):
    # S4 LOW: every degraded path — QX unavailable, a None summary, a missing
    # "subjects" key, or an empty subjects dict — collapses to {"subjects": []}
    # (HTTP 200, never a 500). Locks these guards against a future refactor.
    class FakeQx:
        def available(self):
            return available

        def summary(self):
            return summary

    monkeypatch.setattr(api_app, "get_adapter", lambda name: FakeQx() if name == "qx" else None)
    r = TestClient(api_app.app).get("/api/questions/facets")
    assert r.status_code == 200
    assert r.json() == {"subjects": []}


def test_questions_facets_drops_numeric_subject_codes(monkeypatch):
    # Some QX corpora store numeric subject codes (e.g. {1: 32285}); a bare "1"
    # chip is useless. Only alphabetic subject names should survive.
    class FakeQx:
        def available(self): return True
        def summary(self): return {"subjects": {1: 32285, "Mechanics": 40, "2": 9}}
    monkeypatch.setattr(api_app, "get_adapter", lambda name: FakeQx() if name == "qx" else None)
    r = TestClient(api_app.app).get("/api/questions/facets")
    assert r.status_code == 200 and r.json()["subjects"] == ["Mechanics"]
