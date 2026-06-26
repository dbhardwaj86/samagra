"""Orchestrate a full, idempotent rebuild of concept_graph.db from read-only sources."""
from __future__ import annotations

from pathlib import Path

from ...governance import store as gstore
from . import aliases as aliases_mod
from . import concepts as concepts_mod
from . import edges as edges_mod
from . import gaps as gaps_mod
from . import matrix as matrix_mod
from . import store as store_mod


def build_concept_graph(*, qx_db: Path | None = None, graph_db: Path | None = None,
                        aliases_path: Path | None = None,
                        chapters: list[dict] | None = None,
                        assignments: list[dict] | None = None) -> dict:
    concepts = concepts_mod.load_physics_concepts(qx_db)
    overlay = aliases_mod.load_overlay(aliases_path)
    resolved = aliases_mod.resolve_overlay(overlay, concepts)

    if chapters is None:
        from ..style import extract
        chapters = extract.load_corpus()
    chapter_texts = {ch["slug"]: edges_mod.chapter_text(ch)
                     for ch in chapters if ch.get("slug")}

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

    conn = store_mod.connect(graph_db)
    try:
        store_mod.init_schema(conn)
        store_mod.write_graph(
            conn, concepts=concepts, chapter_edges=chapter_edges, cells=cells,
            gaps=gap_seeds,
            meta={"concept_count": len(concepts), "chapter_edges": len(chapter_edges),
                  "cells": len(cells), "gaps": len(gap_seeds)})
    finally:
        conn.close()

    return {"concepts": len(concepts), "chapter_edges": len(chapter_edges),
            "cells": len(cells), "gaps": len(gap_seeds)}
