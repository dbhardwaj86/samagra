import json

from samagra import config
from samagra.factory.style import profile as P


def _seed_dir(tmp_path, monkeypatch):
    d = tmp_path / "styleseed"
    monkeypatch.setattr(config, "STYLESEED_DIR", d)
    return d


def test_style_extract_writes_v0_and_reports(tmp_path, monkeypatch, capsys):
    _seed_dir(tmp_path, monkeypatch)
    import samagra.factory.style.extract as extract_mod
    monkeypatch.setattr(extract_mod, "load_corpus",
                        lambda: [{"slug": "a", "sections": []}])
    from samagra.__main__ import cmd_factory

    cmd_factory(type("A", (), {"action": "style-extract"})())
    out = capsys.readouterr().out
    assert "styleseed-v0.json" in out
    assert (tmp_path / "styleseed" / "styleseed-v0.json").exists()


def test_style_show_prints_current_version_and_facets(tmp_path, monkeypatch, capsys):
    _seed_dir(tmp_path, monkeypatch)
    P.save(P.StyleSeed(0, {"voice": {"n_sentences": 42}, "sequencing": {},
                           "analogy": {}, "rigor": {}, "selection": {}}, "h", "t"))
    from samagra.__main__ import cmd_factory

    cmd_factory(type("A", (), {"action": "style-show"})())
    out = capsys.readouterr().out
    assert "v0" in out and "voice" in out


def test_style_show_handles_no_profile(tmp_path, monkeypatch, capsys):
    _seed_dir(tmp_path, monkeypatch)
    from samagra.__main__ import cmd_factory

    cmd_factory(type("A", (), {"action": "style-show"})())
    assert "no styleseed" in capsys.readouterr().out.lower()
