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


# --- Phase D3: learning-loop CLI --------------------------------------------
from samagra.governance import store
from samagra.factory.style import learn


def _A(**kw):
    return type("A", (), kw)()


def _seed_profile_and_review(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "STYLESEED_DIR", tmp_path / "styleseed")
    monkeypatch.setattr(P, "_now", lambda: "2026-06-25T00:00:00+00:00")
    P.save(P.StyleSeed(0, {"voice": {"hedge_rate": 0.05, "mean_sentence_len": 16.0,
                                     "second_person_rate": 0.08},
                           "sequencing": {}, "analogy": {"analogy_block_rate": 0.03},
                           "rigor": {}, "selection": {}}, "h", "t"))
    c = store.connect()
    store.init_tables(c)
    store.add_review(c, subsystem="factory", subsystem_ref="factory:x",
                     artifact_uid="samadhan:x", reviewer="owner",
                     verdict="changes", rationale="too hedgy")
    c.close()


def test_style_mine_reports_count(tmp_path, monkeypatch, capsys):
    _seed_profile_and_review(tmp_path, monkeypatch)
    from samagra.__main__ import cmd_factory
    cmd_factory(_A(action="style-mine"))
    out = capsys.readouterr().out
    assert "1" in out and "style-mine" in out


def test_style_events_lists_proposed(tmp_path, monkeypatch, capsys):
    _seed_profile_and_review(tmp_path, monkeypatch)
    from samagra.__main__ import cmd_factory
    cmd_factory(_A(action="style-mine"))
    cmd_factory(_A(action="style-events"))
    out = capsys.readouterr().out
    assert "facet_delta" in out and "proposed" in out


def test_style_ratify_bumps_committed_version(tmp_path, monkeypatch, capsys):
    _seed_profile_and_review(tmp_path, monkeypatch)
    from samagra.__main__ import cmd_factory
    cmd_factory(_A(action="style-mine"))
    cmd_factory(_A(action="style-ratify", event_id=1))
    out = capsys.readouterr().out
    assert "v1" in out
    assert P.load_current().version == 1


def test_style_reject_marks_rejected(tmp_path, monkeypatch, capsys):
    _seed_profile_and_review(tmp_path, monkeypatch)
    from samagra.__main__ import cmd_factory
    cmd_factory(_A(action="style-mine"))
    cmd_factory(_A(action="style-reject", event_id=1))
    out = capsys.readouterr().out.lower()
    assert "reject" in out
    c = store.connect()
    try:
        assert learn.list_style_events(c, status="rejected")[0]["id"] == 1
    finally:
        c.close()
