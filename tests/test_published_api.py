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


def test_api_published_artifact_carries_hardening_headers(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    _publish("cm", "revision", [("cm-thin.html", b"<h1>ok</h1>")])
    from samagra.api.app import app
    r = TestClient(app).get("/api/published/cm/revision")
    assert r.status_code == 200
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["referrer-policy"] == "no-referrer"
    # an html artifact is forced into an opaque origin even on DIRECT navigation
    # (closes the gap the iframe sandbox leaves for shared deep-links), while still
    # allowing the artifact's own CDN-loaded KaTeX/MathJax to run (sandbox allow-scripts
    # isolates the ORIGIN; it does NOT restrict resource sources).
    assert "sandbox" in r.headers["content-security-policy"]
    assert "allow-scripts" in r.headers["content-security-policy"]


def test_api_published_artifact_docx_has_nosniff_no_csp(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    _publish("cm", "lecture", [("cm-thick.html", b"<h1>h</h1>"), ("cm-thick.docx", b"DOCX")])
    from samagra.api.app import app
    r = TestClient(app).get("/api/published/cm/lecture?kind=docx")
    assert r.status_code == 200
    assert r.headers["x-content-type-options"] == "nosniff"
    # CSP sandbox is only meaningful for html (a docx is a download, not a rendered doc)
    assert "content-security-policy" not in r.headers


def test_golden_api_serves_a_published_saar_sheet(tmp_path, monkeypatch):
    # Full slice: capture a real revision artifact through the factory, publish it
    # (G1), then read it back through the G2 outward endpoints.
    monkeypatch.setattr(config, "GOVERNANCE_DB", tmp_path / "governance.db")
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "exports")
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    from samagra.governance import store as gov
    gov._INITIALIZED.clear()
    gov.ensure_tables()
    monkeypatch.chdir(tmp_path)

    def fake_export_one(slug, variant, **kw):
        out = tmp_path / f"{slug}-{variant}.html"
        out.write_text(f"<h1>{slug} {variant}</h1>", encoding="utf-8")
        return {"variant": variant, "html": str(out), "docx": None, "gdoc": None}
    monkeypatch.setattr("samagra.lectures.export.export_one", fake_export_one)

    from samagra.factory import run as factory
    from samagra.factory.publish import run as publish
    proposals = factory.plan("textbook:circular-motion", dry=False)
    rev = next(p for p in proposals if p["line"] == "revision")
    factory.approve(rev["assignment_id"])
    factory.build(rev["assignment_id"])
    publish.publish("circular-motion", lanes=["revision"])

    from samagra.api.app import app
    client = TestClient(app)
    m = client.get("/api/published").json()
    assert "circular-motion" in m["chapters"]
    r = client.get("/api/published/circular-motion/revision")
    assert r.status_code == 200
    assert r.content == b"<h1>circular-motion thin</h1>"
    gov._INITIALIZED.clear()
