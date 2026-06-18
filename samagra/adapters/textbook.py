"""physics-textbook adapter — the lecture/notes engine.

`textbook/queue.json` IS the lecture tracker (order -> unit -> status). Each chapter's
authored content is `chapters/<slug>/content.json`.
"""
from __future__ import annotations

import json
from collections import Counter
from typing import Iterator

from .. import config
from .base import Adapter, Artifact


class TextbookAdapter(Adapter):
    name = "textbook"
    label = "Lectures / Textbook"

    def available(self) -> bool:
        return config.TEXTBOOK_QUEUE.exists()

    def _queue(self) -> dict:
        return json.loads(config.TEXTBOOK_QUEUE.read_text(encoding="utf-8"))

    def summary(self) -> dict:
        chapters = self._queue().get("chapters", [])
        by_status = Counter(c.get("status") for c in chapters)
        units = sorted({c.get("unit") for c in chapters if c.get("unit")})
        return {"chapters": len(chapters), "by_status": dict(by_status),
                "units": len(units)}

    def artifacts(self) -> Iterator[Artifact]:
        for c in self._queue().get("chapters", []):
            slug = c.get("slug")
            cj = config.TEXTBOOK_CHAPTERS / slug / "content.json"
            sections = None
            if cj.exists():
                try:
                    sections = len(
                        json.loads(cj.read_text(encoding="utf-8")).get("sections", [])
                    )
                except Exception:  # noqa: BLE001
                    sections = None
            yield Artifact(
                uid=f"textbook:chapter:{slug}", source=self.name, kind="chapter",
                title=c.get("title", slug), subject="Physics", unit=c.get("unit"),
                chapter=c.get("title"), status=c.get("status"),
                path=str(cj) if cj.exists() else None,
                updated_at=c.get("enriched_at"),
                meta={"order": c.get("order"), "pdf": c.get("pdf"),
                      "sections": sections, "slug": slug},
            )
