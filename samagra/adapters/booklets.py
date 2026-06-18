"""claude-booklet-proofer adapter — theory/workbook booklets."""
from __future__ import annotations

from typing import Iterator

from .. import config
from .base import Adapter, Artifact


class BookletAdapter(Adapter):
    name = "booklets"
    label = "Booklets"

    def _root(self):
        return config.BOOKLETS_ROOT / "booklets"

    def available(self) -> bool:
        return self._root().exists()

    def _pdfs(self):
        return sorted(self._root().rglob("*.pdf"))

    def summary(self) -> dict:
        return {"booklets": len(self._pdfs())}

    def artifacts(self) -> Iterator[Artifact]:
        root = self._root()
        for p in self._pdfs():
            rel = p.relative_to(root)
            folder = rel.parent.as_posix() if rel.parent.as_posix() != "." else ""
            yield Artifact(
                uid=f"booklets:{rel.as_posix()}", source=self.name, kind="booklet",
                title=p.stem, subject="Physics", path=str(p),
                meta={"folder": folder},
            )
