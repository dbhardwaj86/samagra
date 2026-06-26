from fastapi.testclient import TestClient
from samagra.factory.coverage import store


def _seed(db):
    conn = store.connect(db)
    try:
        store.init_schema(conn)
        store.write_graph(
            conn,
            concepts=[{"concept_id": 1, "label": "x", "chapter_id": "physics.optics",
                       "demand_size": 50, "paper_count": 3}],
            chapter_edges=[{"concept_id": 1, "slug": "optics", "score": 1.0, "source": "fts"}],
            cells=[{"concept_id": 1, "lane": "paper", "state": "base",
                    "produced_n": 0, "base_n": 3}],
            gaps=[{"rank": 1, "concept_id": 1, "lane": "paper", "cell_state": "base",
                   "demand_size": 50, "existing_corpus_n": 3, "deficit_score": 12.5,
                   "suggested_seed_ref": "textbook:optics",
                   "plan_command": "samagra factory plan textbook:optics --lane paper"}],
            meta={"concept_count": 1})
    finally:
        conn.close()


def test_coverage_endpoints(tmp_path, monkeypatch):
    db = tmp_path / "concept_graph.db"
    _seed(db)
    monkeypatch.setattr("samagra.config.CONCEPT_GRAPH_DB", db, raising=False)
    from samagra.api.app import app
    client = TestClient(app)

    r = client.get("/api/coverage")
    assert r.status_code == 200
    body = r.json()
    assert body["lanes"][0] == "revision"
    assert body["concepts"][0]["paper_count"] == 3
    assert body["gaps"][0]["plan_command"].endswith("--lane paper")

    d = client.get("/api/coverage/concept/1")
    assert d.status_code == 200
    assert d.json()["chapters"] == ["optics"]

    assert client.get("/api/coverage/concept/999").status_code == 404


def test_coverage_when_not_built(tmp_path, monkeypatch):
    monkeypatch.setattr("samagra.config.CONCEPT_GRAPH_DB", tmp_path / "nope.db", raising=False)
    from samagra.api.app import app
    r = TestClient(app).get("/api/coverage")
    assert r.status_code == 200
    assert r.json()["error"]   # graceful "not built" payload, never a 500
