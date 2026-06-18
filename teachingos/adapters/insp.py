"""claude-INSP-extract adapter — INSP / olympiad papers."""
from __future__ import annotations

from typing import Iterator

from .. import config
from .base import Adapter, Artifact


class INSPAdapter(Adapter):
    name = "insp"
    label = "INSP / Olympiad"

    def _root(self):
        return config.INSP_ROOT / "INSP"

    def available(self) -> bool:
        return self._root().exists()

    def artifacts(self) -> Iterator[Artifact]:
        root = self._root()
        for child in sorted(root.iterdir()):
            if child.is_dir():
                pdfs = list(child.rglob("*.pdf"))
                yield Artifact(
                    uid=f"insp:set:{child.name}", source=self.name, kind="exam-set",
                    title=child.name, subject="Physics", path=str(child),
                    meta={"pdfs": len(pdfs)},
                )
            elif child.suffix.lower() == ".pdf":
                yield Artifact(
                    uid=f"insp:pdf:{child.name}", source=self.name, kind="exam",
                    title=child.stem, subject="Physics", path=str(child),
                )

    def summary(self) -> dict:
        sets = exams = 0
        for a in self.artifacts():
            if a.kind == "exam-set":
                sets += 1
            else:
                exams += 1
        return {"sets": sets, "papers": exams}
