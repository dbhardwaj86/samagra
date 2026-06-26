"""Orchestrate a full, idempotent rebuild of concept_graph.db from read-only sources."""
from __future__ import annotations

import hashlib
from pathlib import Path

from ... import config
from ...governance import store as gstore
from . import aliases as aliases_mod
from . import concepts as concepts_mod
from . import edges as edges_mod
from . import gaps as gaps_mod
from . import matrix as matrix_mod
from . import store as store_mod

_BUILDER_VERSION = "phase-e/1"


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def build_concept_graph(*, qx_db: Path | None = None, graph_db: Path | None = None,
                        aliases_path: Path | None = None,
                        chapters: list[dict] | None = None,
                        assignments: list[dict] | None = None) -> dict:
    concepts = concepts_mod.load_physics_concepts(qx_db)

    if chapters is None:
        from ..style import extract
        chapters = extract.load_corpus()
    chapter_texts = {ch["slug"]: edges_mod.chapter_text(ch)
                     for ch in chapters if ch.get("slug")}

    # resolve the overlay AFTER chapter_texts so we can validate the overlay's chapter
    # slugs against the real corpus (symmetric with the concept-label validation).
    overlay = aliases_mod.load_overlay(aliases_path)
    resolved = aliases_mod.resolve_overlay(overlay, concepts,
                                           valid_slugs=set(chapter_texts))

    base_edges = edges_mod.build_chapter_concept_edges(chapter_texts, concepts)
    chapter_edges = edges_mod.apply_overlay(base_edges, resolved)
    best = edges_mod.best_chapter_by_concept(chapter_edges)

    if assignments is None:
        conn = gstore.connect_ro()
        try:
            assignments = gstore.list_assignments(conn)
        finally:
            conn.close()
    produced = edges_mod.factory_produced_counts(assignments, chapter_edges)

    cells = matrix_mod.build_cells(concepts, chapter_edges, produced)
    gap_seeds = gaps_mod.rank_gaps(cells, concepts, best)

    # provenance for staleness detection: the two inputs that drift (QX grows as
    # questions are indexed; the overlay is hand-edited). built_at is deliberately
    # OMITTED so a rebuild from identical sources stays byte-idempotent (mirrors the
    # StyleSeed created_at-excluded-from-hash convention).
    qx_path = Path(qx_db) if qx_db is not None else config.QX_BUILDER_DB
    al_path = Path(aliases_path) if aliases_path is not None else config.CONCEPT_ALIASES
    meta = {"concept_count": len(concepts), "chapter_edges": len(chapter_edges),
            "cells": len(cells), "gaps": len(gap_seeds),
            "builder_version": _BUILDER_VERSION,
            "qx_builder_sha": _sha256_file(qx_path),
            "aliases_sha": _sha256_file(al_path)}

    conn = store_mod.connect(graph_db)
    try:
        store_mod.init_schema(conn)
        store_mod.write_graph(
            conn, concepts=concepts, chapter_edges=chapter_edges, cells=cells,
            gaps=gap_seeds, meta=meta)
    finally:
        conn.close()

    pointer_concept_ids = {e["concept_id"] for e in chapter_edges}
    skipped_concepts = sorted(
        ({"concept_id": c["concept_id"], "label": c["label"],
          "demand_size": c["demand_size"]}
         for c in concepts if c["concept_id"] not in pointer_concept_ids),
        key=lambda s: -s["demand_size"])
    return {"concepts": len(concepts), "chapter_edges": len(chapter_edges),
            "cells": len(cells), "gaps": len(gap_seeds),
            "skipped_no_pointer": len(skipped_concepts),
            "skipped_concepts": skipped_concepts}
