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
    """One in-memory FTS5 table of chapters; prefix-match each concept label.

    Primary pass is AND-prefix (all label tokens must co-locate in one chapter) —
    high precision, marks edges 'fts'. When a MULTI-WORD label co-locates nowhere
    the AND pass returns nothing, silently dropping that concept from the gap queue
    (review finding: e.g. "dimensional analysis"). We then fall back to an OR-prefix
    best-effort match (ANY token), marked 'fts-or' to flag the weaker confidence.
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
            rows = _match(con, " ".join(f'"{t}"*' for t in toks))
            source = "fts"
            if not rows and len(toks) > 1:
                rows = _match(con, " OR ".join(f'"{t}"*' for t in toks))
                source = "fts-or"
            for slug, bm25 in rows:
                out.append({"concept_id": c["concept_id"], "slug": slug,
                            "score": T.round4(-float(bm25)), "source": source})
    finally:
        con.close()
    return out


def _match(con: sqlite3.Connection, match: str) -> list:
    return list(con.execute(
        "SELECT slug, bm25(ch) FROM ch WHERE ch MATCH ? ORDER BY bm25(ch)", (match,)))


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


def factory_produced_counts(assignments: list[dict], chapter_edges: list[dict]) -> dict:
    """(concept_id, lane) -> # captured factory artifacts. A captured assignment with
    seed_ref 'textbook:<slug>' counts toward every concept that <slug> edges to."""
    slug_concepts: dict[str, set] = {}
    for e in chapter_edges:
        slug_concepts.setdefault(e["slug"], set()).add(e["concept_id"])
    out: dict[tuple, int] = {}
    for a in assignments:
        if a.get("status") != "captured":
            continue
        seed = a.get("seed_ref") or ""
        if not seed.startswith("textbook:"):
            continue
        slug = seed.split(":", 1)[1]
        lane = a.get("pipeline")
        for cid in slug_concepts.get(slug, ()):
            out[(cid, lane)] = out.get((cid, lane), 0) + 1
    return out
