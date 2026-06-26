from samagra.factory.coverage import edges


def test_chapter_text_concatenates_title_sections_prose():
    chapter = {
        "title": "Circular Motion",
        "sections": [
            {"title": "Centripetal acceleration", "blocks": [
                {"type": "prose", "html": "<p>The body moves in a <b>circle</b>.</p>"},
                {"type": "equation", "html": "$$a=v^2/r$$"},
                {"type": "callout", "variant": "note", "html": "<p>Key idea here.</p>"},
            ]},
        ],
    }
    text = edges.chapter_text(chapter)
    assert "Circular Motion" in text
    assert "Centripetal acceleration" in text
    assert "The body moves in a circle." in text   # html stripped
    assert "Key idea here." in text                 # callout included
    assert "<p>" not in text                         # tags gone
