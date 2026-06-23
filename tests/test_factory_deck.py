import json
from pathlib import Path

import pytest

from samagra import config
from samagra.factory import deck


@pytest.fixture
def tmp_chapter(tmp_path, monkeypatch):
    """A hermetic single-chapter corpus so the engine test never touches the
    external read-only textbook repo. Repoints config.TEXTBOOK_CHAPTERS (what
    render.load_chapter reads) and config.EXPORT_DIR (where build_deck writes)."""
    chapters = tmp_path / "chapters"
    monkeypatch.setattr(config, "TEXTBOOK_CHAPTERS", chapters)
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "exports")
    slug = "circular-motion"
    content = {
        "slug": slug,
        "title": "Circular Motion",
        "subtitle": "Motion along a curved path",
        "sections": [
            {
                "id": "sec-1",
                "title": "Angular position",
                "blocks": [
                    {"type": "prose", "html": "<p>intro</p>"},
                    {"type": "equation", "tex": "\\Delta\\theta = \\theta_f - \\theta_i", "number": "1"},
                    {"type": "figure", "caption": "c", "svg": "<svg></svg>"},
                    {"type": "callout", "variant": "key", "html": "<p>radians are dimensionless</p>"},
                    {"type": "equation", "tex": "v = \\omega R"},
                ],
            }
        ],
    }
    d = chapters / slug
    d.mkdir(parents=True)
    (d / "content.json").write_text(json.dumps(content), encoding="utf-8")
    return slug


def _deck_json(slug):
    return json.loads((config.EXPORT_DIR / slug / f"{slug}-deck.json").read_text(encoding="utf-8"))


def test_build_deck_projects_only_equation_and_callout_in_doc_order(tmp_chapter):
    res = deck.build_deck(tmp_chapter)
    cards = _deck_json(tmp_chapter)["cards"]
    assert [c["kind"] for c in cards] == ["equation", "callout", "equation"]  # prose + figure skipped
    assert res["cards"] == 3


def test_build_deck_equation_card_shape(tmp_chapter):
    deck.build_deck(tmp_chapter)
    cards = _deck_json(tmp_chapter)["cards"]
    eq1, eq2 = cards[0], cards[2]
    assert eq1["front"] == "Equation 1 - Angular position"
    assert eq1["back"] == "$$ \\Delta\\theta = \\theta_f - \\theta_i $$"
    assert eq1["ref"] == "sec-1"
    assert eq2["front"] == "Equation - Angular position"   # numberless equation


def test_build_deck_callout_card_uses_variant_label_and_body(tmp_chapter):
    deck.build_deck(tmp_chapter)
    co = _deck_json(tmp_chapter)["cards"][1]
    assert co["front"] == "Key result - Angular position"   # variant 'key' -> 'Key result'
    assert co["back"] == "<p>radians are dimensionless</p>"
    assert co["ref"] == "sec-1"


def test_build_deck_writes_nonempty_mathjax_html(tmp_chapter):
    res = deck.build_deck(tmp_chapter)
    html_path = Path(res["html"])
    assert html_path.is_file() and html_path.stat().st_size > 0
    html = html_path.read_text(encoding="utf-8")
    assert "MathJax" in html              # reuses render.DOC_TEMPLATE (MathJax 3 CDN)
    assert "$$ \\Delta\\theta" in html    # equation back rendered as display math
    assert "radians are dimensionless" in html
    assert res["html"].endswith(f"{tmp_chapter}-deck.html")
    assert res["json"].endswith(f"{tmp_chapter}-deck.json")


def test_build_deck_result_is_json_serializable(tmp_chapter):
    res = deck.build_deck(tmp_chapter)
    json.dumps(res)   # build() json.dumps the whole result into the event note — must not raise
    assert all(isinstance(v, (str, int)) for v in res.values())


def test_build_deck_html_escapes_card_front(tmp_chapter, monkeypatch):
    # A section title with HTML metacharacters must be escaped in the front cue.
    chapters = config.TEXTBOOK_CHAPTERS
    content = json.loads((chapters / tmp_chapter / "content.json").read_text(encoding="utf-8"))
    content["sections"][0]["title"] = "A <b>&</b> B"
    (chapters / tmp_chapter / "content.json").write_text(json.dumps(content), encoding="utf-8")
    res = deck.build_deck(tmp_chapter)
    html = Path(res["html"]).read_text(encoding="utf-8")
    assert "A &lt;b&gt;&amp;&lt;/b&gt; B" in html   # escaped, not raw


def test_build_deck_missing_chapter_raises(tmp_chapter):
    with pytest.raises(FileNotFoundError):
        deck.build_deck("no-such-chapter")
