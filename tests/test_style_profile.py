import json

from samagra import config
from samagra.factory.style import profile as P


FACETS = {"voice": {"mean_sentence_len": 3.5}, "sequencing": {}, "analogy": {},
          "rigor": {}, "selection": {}}


def test_content_hash_is_order_independent_and_stable():
    h1 = P.content_hash({"a": 1, "b": 2})
    h2 = P.content_hash({"b": 2, "a": 1})   # key order must not matter
    assert h1 == h2 and len(h1) == 64


def test_save_and_load_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "styleseed")
    seed = P.StyleSeed(version=0, facets=FACETS, source_corpus_hash="abc",
                       created_at="2026-06-25T00:00:00+00:00")
    path = P.save(seed)
    assert path.name == "styleseed-v0.json"
    on_disk = json.loads(path.read_text(encoding="utf-8"))
    assert on_disk["version"] == 0 and on_disk["facets"] == FACETS
    assert P.load(0) == seed                       # frozen dataclass equality


def test_current_version_and_load_current(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "styleseed")
    assert P.current_version() is None             # nothing yet
    assert P.load_current() is None
    P.save(P.StyleSeed(0, FACETS, "h", "t"))
    P.save(P.StyleSeed(2, FACETS, "h", "t"))       # gap is fine -> max wins
    assert P.current_version() == 2
    assert P.load_current().version == 2
