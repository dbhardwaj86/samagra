"""Phase C lecture export tests (skip when textbook source absent)."""
from __future__ import annotations

import pytest

from samagra.adapters import get_adapter
from samagra.lectures import render
from samagra.lectures.thin import build_thin

_HAS_TEXTBOOK = get_adapter("textbook").available()


def test_thin_is_subset_of_thick():
    content = {"title": "T", "sections": [
        {"title": "S1", "blocks": [
            {"type": "prose", "html": "<p>a</p><p>b</p>"},
            {"type": "equation", "html": "$x$"},
            {"type": "callout", "html": "<p>key</p>"},
            {"type": "figure", "html": "<svg></svg>"},
            {"type": "prose", "html": "<p>extra</p>"},
        ]},
    ]}
    thin = build_thin(content)
    kinds = [b["type"] for b in thin["sections"][0]["blocks"]]
    assert kinds == ["prose", "equation", "callout"]  # figure + extra prose dropped
    assert thin["sections"][0]["blocks"][0]["html"] == "<p>a</p>"  # lead paragraph only


@pytest.mark.skipif(not _HAS_TEXTBOOK, reason="textbook source not present")
def test_render_real_chapter():
    content = render.load_chapter("vectors")
    html = render.render_chapter_html(content)
    assert "Vectors" in html and "<section>" in html
    thin_html = render.render_chapter_html(build_thin(content), label="Revision sheet")
    assert len(thin_html) < len(html)  # thin is smaller
