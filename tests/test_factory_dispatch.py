import pytest
from samagra.factory import dispatch

def test_run_line_invokes_export_with_the_lane_variant(monkeypatch, tmp_path):
    calls = {}
    html = tmp_path / "circular-motion-thin.html"
    html.write_text("<h1>Circular Motion</h1>", encoding="utf-8")
    def fake_export_one(slug, variant, **kw):
        calls["args"] = (slug, variant)
        calls["kw"] = kw
        return {"variant": variant, "html": str(html), "docx": None, "gdoc": None}
    monkeypatch.setattr("samagra.lectures.export.export_one", fake_export_one)

    result = dispatch.run_line("revision", "circular-motion")
    assert calls["args"] == ("circular-motion", "thin")   # revision -> thin
    assert calls["kw"].get("upload_gdocs") is False        # H1: factory never uploads
    assert result["html"] == str(html)

def test_validate_product_passes_for_nonempty_html(tmp_path):
    html = tmp_path / "x.html"; html.write_text("<p>ok</p>", encoding="utf-8")
    dispatch.validate_product("revision", {"html": str(html)})  # no raise

def test_validate_product_raises_on_missing_or_empty(tmp_path):
    with pytest.raises(ValueError):
        dispatch.validate_product("revision", {"html": str(tmp_path / "nope.html")})
    empty = tmp_path / "e.html"; empty.write_text("", encoding="utf-8")
    with pytest.raises(ValueError):
        dispatch.validate_product("revision", {"html": str(empty)})

def test_validate_seed_for_line_rejects_wrong_prefix():
    with pytest.raises(ValueError):
        dispatch.validate_seed_for_line("revision", "mcd:1")
    dispatch.validate_seed_for_line("revision", "textbook:circular-motion")  # no raise


def test_run_line_routes_deck_to_build_deck(monkeypatch, tmp_path):
    seen = {}
    out = tmp_path / "circular-motion-deck.html"
    out.write_text("<h1>deck</h1>", encoding="utf-8")

    def fake_build_deck(slug):
        seen["slug"] = slug
        return {"variant": "deck", "html": str(out),
                "json": str(tmp_path / "circular-motion-deck.json"), "cards": 5}

    monkeypatch.setattr("samagra.factory.deck.build_deck", fake_build_deck)
    result = dispatch.run_line("deck", "circular-motion")
    assert seen["slug"] == "circular-motion"
    assert result["html"] == str(out)


def test_run_line_still_routes_lecture_lanes_to_export(monkeypatch, tmp_path):
    calls = {}
    html = tmp_path / "x.html"; html.write_text("<h1>x</h1>", encoding="utf-8")

    def fake_export_one(slug, variant, **kw):
        calls["args"] = (slug, variant)
        calls["kw"] = kw
        return {"variant": variant, "html": str(html), "docx": None, "gdoc": None}

    monkeypatch.setattr("samagra.lectures.export.export_one", fake_export_one)
    dispatch.run_line("revision", "circular-motion")
    assert calls["args"] == ("circular-motion", "thin")
    assert calls["kw"].get("upload_gdocs") is False   # lecture lanes never upload (H1)


def test_run_line_routes_paper_to_build_paper(monkeypatch, tmp_path):
    seen = {}
    out = tmp_path / "circular-motion-paper.html"
    out.write_text("<h1>paper</h1>", encoding="utf-8")

    def fake_build_paper(slug, *, variant):
        seen["args"] = (slug, variant)
        return {"variant": variant, "html": str(out),
                "json": str(tmp_path / "circular-motion-paper.json"), "questions": 4}

    monkeypatch.setattr("samagra.factory.paper.build_paper", fake_build_paper)
    result = dispatch.run_line("paper", "circular-motion")
    assert seen["args"] == ("circular-motion", "paper")   # variant from the lane key
    assert result["html"] == str(out)


def test_run_line_routes_drill_to_build_paper_with_drill_variant(monkeypatch, tmp_path):
    seen = {}
    out = tmp_path / "circular-motion-drill.html"
    out.write_text("<h1>drill</h1>", encoding="utf-8")

    def fake_build_paper(slug, *, variant):
        seen["variant"] = variant
        return {"variant": variant, "html": str(out),
                "json": str(tmp_path / "x.json"), "questions": 2}

    monkeypatch.setattr("samagra.factory.paper.build_paper", fake_build_paper)
    dispatch.run_line("drill", "circular-motion")
    assert seen["variant"] == "drill"


def test_validate_product_qx_refuses_answer_marker(tmp_path):
    leaky = tmp_path / "p.html"
    leaky.write_text('<div class="stem">x</div>'
                     '<div class="answer"><span class="answer-label">Ans: 42</span></div>',
                     encoding="utf-8")
    with pytest.raises(ValueError):
        dispatch.validate_product("paper", {"html": str(leaky)})


def test_validate_product_qx_allows_clean_paper_even_with_word_answer(tmp_path):
    # A legitimate stem may contain the WORD "answer"; that must NOT trip the
    # structural marker guard (no class="answer"/answer-label/etc.).
    clean = tmp_path / "p.html"
    clean.write_text('<div class="stem">What is the answer to this question?</div>'
                     '<div class="options"><div class="opt"><span class="opt-label">(A)</span> 5</div></div>',
                     encoding="utf-8")
    dispatch.validate_product("paper", {"html": str(clean)})   # no raise


def test_validate_product_answer_leak_is_noop_for_local_lanes(tmp_path):
    # The guard is qx-only: a local lane artifact that (contrived) carries an
    # answer marker is NOT scanned (lecture/deck carry no answer columns by
    # construction; scanning them would be wrong-layer).
    f = tmp_path / "r.html"
    f.write_text('<div class="answer">Ans: 1</div>', encoding="utf-8")
    dispatch.validate_product("revision", {"html": str(f)})    # no raise (local kind)


def test_validate_product_qx_refuses_qx_teacher_paper_markup(tmp_path):
    # Defense in depth: QX has a THIRD answer renderer — its teacher paper_render
    # emits <span class="pq-ans">Ans: ..</span> / "pq-ans unv" and a <div
    # class="pkey"> answer-key appendix. The guard must catch those shapes too
    # (the single most plausible future leak = QX reusing that sibling renderer).
    for body in ('<div class="stem">x</div><span class="pq-ans">Ans: 42</span>',
                 '<div class="stem">x</div><span class="pq-ans unv">Ans: 5</span>',
                 '<div class="stem">x</div><div class="pkey"><table><td>1</td><td>42</td></table></div>'):
        f = tmp_path / "p.html"
        f.write_text(body, encoding="utf-8")
        with pytest.raises(ValueError):
            dispatch.validate_product("paper", {"html": str(f)})


def test_validate_product_qx_scans_json_sidecar_too(tmp_path):
    # The JSON sidecar embeds each question's raw QX html verbatim and is a
    # written artifact too — the guard must scan it, not only the printable html.
    html = tmp_path / "p.html"
    html.write_text('<div class="stem">clean</div>', encoding="utf-8")
    js = tmp_path / "p.json"
    js.write_text('{"questions":[{"html":"<span class=\\"pq-ans\\">Ans: 9</span>"}]}',
                  encoding="utf-8")
    with pytest.raises(ValueError):
        dispatch.validate_product("paper", {"html": str(html), "json": str(js)})
