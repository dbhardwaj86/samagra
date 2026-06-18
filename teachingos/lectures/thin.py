"""Build a 'thin' revision-sheet variant from a thick chapter content dict.

Deterministic extraction (no LLM): per section keep the lead prose paragraph,
every formula (equation), every callout (key results / warnings / tips) and any
subheadings; drop figures, image-needs and the long explanatory prose. The result
is a concise revision sheet of key ideas, formulae and results. A future hook can
swap this for an LLM summarization pass without changing callers.
"""
from __future__ import annotations

import re

KEEP_ALWAYS = {"equation", "callout", "subheading"}
_FIRST_P = re.compile(r"<p\b[^>]*>.*?</p>", re.I | re.S)


def _lead_paragraph(html: str) -> str:
    """Keep only the first <p>…</p> of a prose block (safe on tag boundaries)."""
    m = _FIRST_P.search(html or "")
    return m.group(0) if m else (html or "")


def build_thin(content: dict) -> dict:
    out = {
        "title": content.get("title", "Lecture"),
        "subtitle": "Revision sheet — key ideas, formulae and results.",
        "slug": content.get("slug"),
        "status": content.get("status"),
        "sections": [],
    }
    for sec in content.get("sections", []):
        kept = []
        prose_used = False
        for b in sec.get("blocks", []) or []:
            t = b.get("type")
            if t in KEEP_ALWAYS:
                kept.append(b)
            elif t == "prose" and not prose_used:
                kept.append({"type": "prose", "html": _lead_paragraph(b.get("html", ""))})
                prose_used = True
        if kept:
            out["sections"].append({"title": sec.get("title", ""), "blocks": kept})
    return out
