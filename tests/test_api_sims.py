from fastapi.testclient import TestClient
from samagra.api import app as api_app
from samagra import config

def test_api_sims_reads_manifest(tmp_path, monkeypatch):
    (tmp_path / "deployed-sims-by-grade.md").write_text(
        "## Class 9 (1)\n### Physics (1)\n- 0020 — Vector Lab\n", encoding="utf-8")
    monkeypatch.setattr(config, "SIMS_ROOT", tmp_path)
    r = TestClient(api_app.app).get("/api/sims")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["sims"][0]["url"].endswith("/sims/SIM0020/SIM0020_sim")

def test_api_sims_absent_manifest(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "SIMS_ROOT", tmp_path)  # no manifest file
    r = TestClient(api_app.app).get("/api/sims")
    assert r.status_code == 200 and r.json() == {"sims": [], "total": 0}
