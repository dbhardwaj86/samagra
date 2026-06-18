"""pratyaksh-May-deploy adapter — simulations. READ-ONLY, never writes."""
from __future__ import annotations

from typing import Iterator

from .. import config
from .base import Adapter, Artifact


class SimsAdapter(Adapter):
    name = "sims"
    label = "Simulations (Pratyaksh)"

    def available(self) -> bool:
        return config.SIMS_ROOT.exists()

    def _sims(self):
        out = []
        for p in config.SIMS_ROOT.rglob("*.html"):
            if "sims" in {part.lower() for part in p.parts}:
                out.append(p)
        return out

    def summary(self) -> dict:
        return {"sims": len(self._sims())}

    def artifacts(self) -> Iterator[Artifact]:
        root = config.SIMS_ROOT
        for p in self._sims():
            rel = p.relative_to(root)
            parts = rel.parts
            subject = grade = None
            lowered = [x.lower() for x in parts]
            if "sims" in lowered:
                after = parts[lowered.index("sims") + 1:]
                if len(after) >= 1:
                    subject = after[0]
                if len(after) >= 2:
                    grade = after[1]
            yield Artifact(
                uid=f"sims:{rel.as_posix()}", source=self.name, kind="sim",
                title=p.stem, subject=subject, unit=grade, path=str(p),
                meta={"grade": grade},
            )
