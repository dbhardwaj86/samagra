"""Resolve corpus pointers for a munshi item by FTS5-searching the catalog.

Read-only over samagra.db via samagra.catalog.search(). Returns a compact list
of candidate artifacts to attach to a proposed seed (recorded in SAMAGRA's own
audit trail) so downstream enrichment knows where the idea connects.
"""
from __future__ import annotations

from .. import catalog


def resolve_pointers(text: str, *, limit: int = 5) -> list[dict]:
    """Up to `limit` candidates as [{uid, source, kind, title}], best-match first.
    Empty text -> []."""
    query = (text or "").strip()
    if not query:
        return []
    rows = catalog.search(query, limit=limit)
    return [
        {"uid": r["uid"], "source": r["source"], "kind": r["kind"], "title": r["title"]}
        for r in rows
    ]
