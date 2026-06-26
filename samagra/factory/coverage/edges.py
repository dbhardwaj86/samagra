"""Tier-1 structural edges for the coverage graph.

- chapter_text: flatten a chapter to a searchable text blob.
- build_chapter_concept_edges: FTS5 concept-label matches over the chapter blobs.
- apply_overlay: merge the curated add/remove deltas onto the FTS base.
- best_chapter_by_concept: the strongest-edge chapter (the gap-seed pointer).
- factory_produced_counts: captured factory artifacts per (concept, lane).
"""
from __future__ import annotations

import re
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


def _fts_tokens(s: str) -> list[str]:
    """Split a concept label into alphanumeric tokens, discarding apostrophes/punctuation.
    E.g. "gauss's law" → ["gauss", "law"]; single-char fragments dropped."""
    return [t for t in re.findall(r"[a-z0-9]+", (s or "").lower()) if len(t) > 1]


def build_chapter_concept_edges(chapter_texts: dict, concepts: list[dict]) -> list[dict]:
    """One in-memory FTS5 table of chapters; AND-prefix-match each concept label.
    score = -bm25 (higher = stronger). Deterministic for fixed inputs."""
    con = sqlite3.connect(":memory:")
    con.execute("CREATE VIRTUAL TABLE ch USING fts5(slug UNINDEXED, body)")
    con.executemany("INSERT INTO ch(slug, body) VALUES (?,?)",
                    list(chapter_texts.items()))
    out: list[dict] = []
    try:
        for c in concepts:
            toks = _fts_tokens(c["label"])
            if not toks:
                continue
            match = " ".join(f'"{t}"*' for t in toks)
            for slug, bm25 in con.execute(
                    "SELECT slug, bm25(ch) FROM ch WHERE ch MATCH ? ORDER BY bm25(ch)",
                    (match,)):
                out.append({"concept_id": c["concept_id"], "slug": slug,
                            "score": T.round4(-float(bm25)), "source": "fts"})
    finally:
        con.close()
    return out


def apply_overlay(base_edges: list[dict], resolved_overlay: dict) -> list[dict]:
    kept = [e for e in base_edges
            if e["concept_id"] not in resolved_overlay.get(e["slug"], {}).get("remove", set())]
    have = {(e["concept_id"], e["slug"]) for e in kept}
    for slug, delta in resolved_overlay.items():
        for cid in delta.get("add", set()):
            if (cid, slug) not in have:
                kept.append({"concept_id": cid, "slug": slug,
                             "score": 999.0, "source": "overlay-add"})
                have.add((cid, slug))
    return kept


def best_chapter_by_concept(edges: list[dict]) -> dict:
    best: dict[int, str] = {}
    for e in sorted(edges, key=lambda x: -x["score"]):
        best.setdefault(e["concept_id"], e["slug"])
    return best
