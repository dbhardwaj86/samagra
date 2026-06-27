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


def test_api_published_artifact_returns_html(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    _publish("circular-motion", "revision", [("circular-motion-thin.html", b"<h1>Saar</h1>")])
    from samagra.api.app import app
    r = TestClient(app).get("/api/published/circular-motion/revision")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    assert r.content == b"<h1>Saar</h1>"


def test_api_published_artifact_docx_kind(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    _publish("cm", "lecture", [("cm-thick.html", b"<h1>h</h1>"), ("cm-thick.docx", b"DOCX")])
    from samagra.api.app import app
    r = TestClient(app).get("/api/published/cm/lecture?kind=docx")
    assert r.status_code == 200
    assert r.content == b"DOCX"
    assert "wordprocessingml" in r.headers["content-type"]


def test_api_published_artifact_unknown_is_404(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    from samagra.api.app import app
    assert TestClient(app).get("/api/published/nope/revision").status_code == 404


def test_api_published_artifact_integrity_breach_is_500(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    _publish("cm", "revision", [("cm-thin.html", b"<h1>ok</h1>")])
    (tmp_path / "published" / "cm" / "cm-thin.html").write_bytes(b"TAMPERED")
    from samagra.api.app import app
    assert TestClient(app).get("/api/published/cm/revision").status_code == 500


def test_published_endpoints_are_public_not_gated():
    # The G2 read surface is intentionally PUBLIC: it must NOT be in _PROTECTED_GETS
    # (it serves only owner-released content). Mirrors the /api/coverage precedent.
    from samagra.api import origin_auth
    assert origin_auth.is_protected("GET", "/api/published") is False
    assert origin_auth.is_protected("GET", "/api/published/cm/revision") is False
