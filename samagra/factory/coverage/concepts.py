"""Read the QX concept spine from builder.sqlite — READ-ONLY (the firewall holds).

The canonical physics concepts (`chapter_id LIKE 'physics.%'`) with their demand
signal (`concept.size`) and the distinct-paper count (paper/drill base depth),
derived purely from builder.sqlite via question_concept -> search_index.slug.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

from ... import config

_SQL = """
SELECT c.id AS concept_id, c.label AS label, c.chapter_id AS chapter_id,
       c.size AS demand_size, COUNT(DISTINCT si.slug) AS paper_count
FROM concept c
LEFT JOIN question_concept qc ON qc.concept_id = c.id
LEFT JOIN search_index si ON si.q_uid = qc.q_uid
WHERE c.chapter_id LIKE 'physics.%'
GROUP BY c.id
ORDER BY c.chapter_id, c.label
"""


def load_physics_concepts(db_path: Path | None = None) -> list[dict]:
    path = Path(db_path) if db_path is not None else config.QX_BUILDER_DB
    # resolve() first so a relative path is expressible as a file URI (matches
    # store.connect_ro hardening; as_uri() raises ValueError on a relative path).
    con = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in con.execute(_SQL)]
    finally:
        con.close()
