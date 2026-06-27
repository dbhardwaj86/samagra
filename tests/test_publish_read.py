# tests/test_publish_read.py
import pytest
from samagra import config
from samagra.factory.publish import read, manifest
from samagra.factory.publish import store as pub


@pytest.fixture
def pub_env(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    return tmp_path


def _publish(chapter, lane, files):
    """Write frozen copies + ONE immutable publish record so the derived manifest
    holds a (chapter, lane) artifact. `files`: list of (basename, bytes)."""
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
    return out


def test_published_manifest_empty_when_nothing_published(pub_env):
    m = read.published_manifest()
    assert m["schema"] == "samagra.published.v1"
    assert m["chapters"] == {}


def test_resolve_artifact_happy_html(pub_env):
    _publish("cm", "revision", [("cm-thin.html", b"<h1>Saar</h1>")])
    art = read.resolve_artifact("cm", "revision")
    assert art is not None
    assert art["bytes"] == b"<h1>Saar</h1>"
    assert art["media_type"].startswith("text/html")
    assert art["sha256"] == manifest.sha256_bytes(b"<h1>Saar</h1>")
    assert art["rel"] == "cm/cm-thin.html"


def test_resolve_artifact_docx_kind(pub_env):
    _publish("cm", "lecture", [("cm-thick.html", b"<h1>h</h1>"), ("cm-thick.docx", b"DOCX")])
    art = read.resolve_artifact("cm", "lecture", kind="docx")
    assert art is not None
    assert art["bytes"] == b"DOCX"
    assert "wordprocessingml" in art["media_type"]


def test_resolve_artifact_unknown_chapter_lane_kind(pub_env):
    _publish("cm", "revision", [("cm-thin.html", b"x")])
    assert read.resolve_artifact("nope", "revision") is None
    assert read.resolve_artifact("cm", "nope") is None
    assert read.resolve_artifact("cm", "revision", kind="exe") is None
    assert read.resolve_artifact("cm", "revision", kind="docx") is None  # no docx file


def test_resolve_artifact_missing_file_returns_none(pub_env):
    _publish("cm", "revision", [("cm-thin.html", b"x")])
    (pub_env / "published" / "cm" / "cm-thin.html").unlink()
    assert read.resolve_artifact("cm", "revision") is None


def test_resolve_artifact_integrity_mismatch_raises(pub_env):
    _publish("cm", "revision", [("cm-thin.html", b"<h1>ok</h1>")])
    (pub_env / "published" / "cm" / "cm-thin.html").write_bytes(b"TAMPERED")
    with pytest.raises(ValueError, match="integrity"):
        read.resolve_artifact("cm", "revision")
