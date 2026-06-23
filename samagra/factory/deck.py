"""The deck lane engine: project a chapter's equation + callout blocks into a
flashcard deck. Pure + deterministic — NO LLM, NO network, NO external write.

Phase C / C1 (Smriti). One textbook chapter (seed 'textbook:<slug>') -> a deck:
each EQUATION block -> one card (front = a cue naming the section + equation
label; back = the equation as display math); each CALLOUT block -> one card
(front = the callout's variant label + section; back = the callout body html).
Writes <slug>-deck.json (the deck data) + <slug>-deck.html (a printable,
MathJax-enabled card grid) under config.EXPORT_DIR/<slug>/, and returns a
factory-compatible result dict carrying the printable html path under "html".

There is deliberately NO upload/network/gdocs code here at all — the Phase-1
"no external write path" invariant is enforced structurally, not by an opt-out
flag (stronger than the lecture lane's upload_gdocs=False).
"""
from __future__ import annotations

import html as _html
import json

from .. import config
from ..lectures import render

# Human labels for the closed set of callout variants (data: note/key/warn/tip).
_VARIANT_LABEL = {"note": "Note", "key": "Key result", "warn": "Caution", "tip": "Tip"}

# Minimal card-grid styling appended to the lecture DOC_CSS (kept tiny + print-safe).
_DECK_CSS = """
.deck{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-top:8px}
.card{border:1px solid #e3e3e6;border-radius:10px;padding:14px 16px;background:#fff}
.card-front{font-weight:600;margin-bottom:8px;color:#1f2328}
.card-n{color:#8a8f98;font-weight:600}
.card-back{color:#1f2328}
@media print{.card{break-inside:avoid}}
"""


def _cards_for_chapter(content: dict) -> list[dict]:
    """Deterministically project equation + callout blocks into flashcards.

    Each card = {"front": <plain cue text>, "back": <display math / callout html>,
    "ref": <section id or title>, "kind": "equation" | "callout"}, in document
    order (sections, then blocks). Other block types (prose/figure/subheading/
    image-need) are skipped — equation + callout are the revision-keepable blocks.
    """
    cards: list[dict] = []
    for sec in content.get("sections", []) or []:
        sec_title = (sec.get("title", "") or "").strip()
        sec_ref = sec.get("id") or sec_title
        for block in sec.get("blocks", []) or []:
            t = block.get("type")
            if t == "equation":
                tex = (block.get("tex") or "").strip()
                if not tex:
                    continue
                number = block.get("number")
                label = f"Equation {number}" if number else "Equation"
                cards.append({
                    "front": f"{label} - {sec_title}".strip(" -"),
                    "back": f"$$ {tex} $$",
                    "ref": sec_ref,
                    "kind": "equation",
                })
            elif t == "callout":
                body = (block.get("html") or "").strip()
                if not body:
                    continue
                label = _VARIANT_LABEL.get(block.get("variant") or "note", "Note")
                cards.append({
                    "front": f"{label} - {sec_title}".strip(" -"),
                    "back": body,
                    "ref": sec_ref,
                    "kind": "callout",
                })
    return cards


def _deck_html(content: dict, cards: list[dict]) -> str:
    """Render a printable card grid, reusing the lecture DOC_TEMPLATE/DOC_CSS so
    the deck inherits MathJax (display $$..$$ + inline $..$), Inter, print CSS."""
    parts = ['<section class="deck">']
    for i, card in enumerate(cards, 1):
        front = _html.escape(card["front"])          # cue text: escape (author-free)
        back = card["back"]                           # display math / trusted-author callout html
        parts.append(
            f'<article class="card">'
            f'<div class="card-front"><span class="card-n">{i}.</span> {front}</div>'
            f'<div class="card-back">{back}</div>'
            f'</article>'
        )
    parts.append("</section>")
    return render.DOC_TEMPLATE.format(
        title=_html.escape(content.get("title", "Deck")),
        subtitle=_html.escape(content.get("subtitle", "")),
        kicker=_html.escape("Flashcard deck"),
        css=render.DOC_CSS + _DECK_CSS,
        body="\n".join(parts),
    )


def build_deck(slug: str) -> dict:
    """Build the flashcard deck for a chapter slug. Writes <slug>-deck.json +
    <slug>-deck.html under config.EXPORT_DIR/<slug>/ and returns the factory
    result dict {variant, html, json, cards}. Raises FileNotFoundError if the
    chapter has no content.json (propagated from render.load_chapter)."""
    content = render.load_chapter(slug)
    cards = _cards_for_chapter(content)

    out = config.EXPORT_DIR / slug
    out.mkdir(parents=True, exist_ok=True)

    deck_data = {"slug": slug, "title": content.get("title", slug), "cards": cards}
    json_path = out / f"{slug}-deck.json"
    json_path.write_text(json.dumps(deck_data, ensure_ascii=False, indent=2), encoding="utf-8")

    html_path = out / f"{slug}-deck.html"
    html_path.write_text(_deck_html(content, cards), encoding="utf-8")

    return {
        "variant": "deck",
        "html": str(html_path),
        "json": str(json_path),
        "cards": len(cards),
    }
