# tests/test_published_api.py
from fastapi.testclient import TestClient
from samagra import config
from samagra.factory.publish import manifest
from samagra.factory.publish import store as pub


def _publish(chapter, lane, files):
    """Write frozen copies + ONE immutable publish record (same helper shape as
    tests/test_publish_read.py). `files`: list of (basename, bytes)."""
    out = []
    for basename, data in files:
        rel = pub.write_published_file(chapter, basename, data)
        out.append({"rel": rel, "sha256": manifest.sha256_bytes(data), "bytes": len(data)})
    pub_id = f"pub_{lane}"
    entry = {"uid": f"published:{chapter}:{lane}", "lane": lane, "assignment_id": "a1",
             "files": out, "source_seed_ref": f"textbook:{chapter}",
             "style_seed_version": None, "captured_at": "t", "published_at": "t",
             "publication_id": pub_id}
    rec = {"publication_id": pub_id, "action": "publish", "actor": "owner",
           "chapter": chapter, "seed_ref": f"textbook:{chapter}",
           "title": chapter.replace("-", " ").title(), "lanes": [lane], "at": "t",
           "artifacts": [entry]}
    pub.write_publication(rec, sequence=pub.next_sequence())


def test_api_published_empty(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    from samagra.api.app import app
    r = TestClient(app).get("/api/published")
    assert r.status_code == 200
    body = r.json()
    assert body["schema"] == "samagra.published.v1"
    assert body["chapters"] == {}


def test_api_published_lists_chapters(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    _publish("circular-motion", "revision", [("circular-motion-thin.html", b"<h1>S</h1>")])
    from samagra.api.app import app
    r = TestClient(app).get("/api/published")
    assert r.status_code == 200
    ch = r.json()["chapters"]["circular-motion"]
    assert ch["artifacts"][0]["lane"] == "revision"
