"""Phase E — the coverage graph (read-only STEERING layer)."""
from __future__ import annotations

from pathlib import Path

from . import store
from .build import build_concept_graph

__all__ = ["build_concept_graph", "coverage_payload", "list_gaps", "concept_dossier"]


def coverage_payload(graph_db: Path | None = None) -> dict:
    conn = store.connect_ro(graph_db)
    try:
        return store.coverage_payload(conn)
    finally:
        conn.close()


def list_gaps(top: int | None = None, lane: str | None = None,
              graph_db: Path | None = None) -> list[dict]:
    conn = store.connect_ro(graph_db)
    try:
        return store.list_gaps(conn, top=top, lane=lane)
    finally:
        conn.close()


def concept_dossier(concept_id: int, graph_db: Path | None = None) -> dict | None:
    conn = store.connect_ro(graph_db)
    try:
        return store.concept_dossier(conn, concept_id)
    finally:
        conn.close()
