"""Tier-1 structural edges for the coverage graph.

- chapter_text: flatten a chapter to a searchable text blob.
- build_chapter_concept_edges: FTS5 concept-label matches over the chapter blobs.
- apply_overlay: merge the curated add/remove deltas onto the FTS base.
- best_chapter_by_concept: the strongest-edge chapter (the gap-seed pointer).
- factory_produced_counts: captured factory artifacts per (concept, lane).
"""
from __future__ import annotations

import sqlite3

from ..style import text as T

_TEXT_BLOCKS = {"prose", "callout", "subheading"}


def chapter_text(chapter: dict) -> str:
    parts = [chapter.get("title", "") or ""]
    for sec in chapter.get("sections", []) or []:
        parts.append(sec.get("title", "") or "")
        for b in sec.get("blocks", []) or []:
            if b.get("type") in _TEXT_BLOCKS:
                parts.append(T.strip_html(b.get("html", "")))
    return " ".join(p for p in parts if p)
