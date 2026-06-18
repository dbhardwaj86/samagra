"""Common artifact shape + adapter contract.

Every source adapter is read-only and normalizes its source into `Artifact`
records at a coarse, browsable altitude (papers, chapters, booklets, exams, sims)
— NOT individual questions. Fine-grained question search is served live by the QX
adapter against its own search index, so we don't duplicate 67k rows here.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Iterator, Optional

CATALOG_COLUMNS = (
    "uid", "source", "kind", "title", "subject", "unit",
    "chapter", "status", "path", "url", "updated_at", "meta_json",
)


@dataclass
class Artifact:
    uid: str                       # stable, e.g. "qx:doc:<slug>"
    source: str                    # adapter name
    kind: str                      # paper|chapter|booklet|exam|exam-set|sim
    title: str
    subject: Optional[str] = None
    unit: Optional[str] = None     # textbook unit / grade group
    chapter: Optional[str] = None
    status: Optional[str] = None
    path: Optional[str] = None     # local path
    url: Optional[str] = None
    updated_at: Optional[str] = None
    meta: dict = field(default_factory=dict)

    def row(self) -> tuple:
        return (
            self.uid, self.source, self.kind, self.title, self.subject,
            self.unit, self.chapter, self.status, self.path, self.url,
            self.updated_at, json.dumps(self.meta, ensure_ascii=False),
        )


class Adapter:
    """Read-only source adapter."""

    name: str = "base"
    label: str = "Base"

    def available(self) -> bool:
        """True when the source exists on this machine."""
        return False

    def summary(self) -> dict:
        """Small dict of headline counts for the overview tile."""
        return {}

    def artifacts(self) -> Iterator[Artifact]:
        """Yield normalized catalog records."""
        return iter(())
