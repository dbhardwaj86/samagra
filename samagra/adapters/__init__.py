"""Read-only source adapters and their registry."""
from __future__ import annotations

from .base import Adapter, Artifact, CATALOG_COLUMNS
from .booklets import BookletAdapter
from .insp import INSPAdapter
from .qx import QXAdapter
from .questiondb import QuestionDBAdapter
from .sims import SimsAdapter
from .textbook import TextbookAdapter

ALL_ADAPTERS: list[Adapter] = [
    QXAdapter(),
    TextbookAdapter(),
    BookletAdapter(),
    INSPAdapter(),
    SimsAdapter(),
    QuestionDBAdapter(),
]


def get_adapter(name: str) -> Adapter | None:
    for adapter in ALL_ADAPTERS:
        if adapter.name == name:
            return adapter
    return None


__all__ = ["Adapter", "Artifact", "CATALOG_COLUMNS", "ALL_ADAPTERS", "get_adapter"]
