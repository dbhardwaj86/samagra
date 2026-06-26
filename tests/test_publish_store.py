import pytest
from samagra import config
from samagra.factory.publish import store


@pytest.fixture
def published_env(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    return tmp_path / "published"


def test_now_is_utc_iso(published_env):
    s = store.now()
    assert s.endswith("Z") and "T" in s and len(s) == 20


def test_write_and_read_published_file(published_env):
    rel = store.write_published_file("circular-motion", "circular-motion-thin.html", b"<h1>x</h1>")
    assert rel == "circular-motion/circular-motion-thin.html"
    assert (published_env / rel).read_bytes() == b"<h1>x</h1>"


def test_write_published_file_overwrites_on_republish(published_env):
    store.write_published_file("cm", "f.html", b"old")
    store.write_published_file("cm", "f.html", b"new")        # deliberate re-publish
    assert (published_env / "cm" / "f.html").read_bytes() == b"new"


def test_manifest_roundtrip_and_absent(published_env):
    assert store.read_manifest() is None
    store.write_manifest({"schema": "samagra.published.v1", "chapters": {}})
    assert store.read_manifest()["schema"] == "samagra.published.v1"


def test_next_sequence_and_ordered_publications(published_env):
    assert store.next_sequence() == 1
    store.write_publication({"publication_id": "pub_a", "chapter": "cm"}, sequence=1)
    assert store.next_sequence() == 2
    store.write_publication({"publication_id": "pub_b", "chapter": "cm"}, sequence=2)
    recs = store.read_publications()
    assert [r["publication_id"] for r in recs] == ["pub_a", "pub_b"]   # ordered by seq


def test_write_publication_refuses_overwrite(published_env):
    store.write_publication({"publication_id": "pub_a", "chapter": "cm"}, sequence=1)
    with pytest.raises(FileExistsError):
        store.write_publication({"publication_id": "pub_a", "chapter": "cm"}, sequence=1)


def test_write_published_file_rejects_traversal_chapter(published_env):
    with pytest.raises(ValueError, match="unsafe chapter"):
        store.write_published_file("../../etc", "f.html", b"x")


def test_write_published_file_rejects_traversal_basename(published_env):
    with pytest.raises(ValueError, match="unsafe basename"):
        store.write_published_file("cm", "../evil.html", b"x")


def test_write_publication_rejects_traversal_id(published_env):
    with pytest.raises(ValueError, match="unsafe publication_id"):
        store.write_publication({"publication_id": "../../evil"}, sequence=1)
