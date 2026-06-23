"""Product-line registry + classify: which content lanes a seed fans out to.

Phase 1 (deterministic, local-write): a textbook-chapter seed (uid 'textbook:<slug>')
fans to a revision sheet (thin) and a full lecture (thick). Pure; no I/O.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Line:
    key: str
    expected_output: str
    variant: str            # the lectures.export variant this lane renders
    source_prefixes: tuple  # seed_ref prefixes this lane applies to


LINES: dict[str, Line] = {
    "revision": Line("revision", "Revision sheet (thin lecture export)",
                     "thin", ("textbook:",)),
    "lecture": Line("lecture", "Full lecture (thick lecture export)",
                    "thick", ("textbook:",)),
}

# Deterministic lane order so a seed always fans out the same way.
_ORDER = ["revision", "lecture"]


def classify(seed_ref: str) -> list[str]:
    """Return the applicable product-line keys for a seed_ref, in stable order."""
    ref = (seed_ref or "").strip()
    if not ref:
        return []
    return [k for k in _ORDER
            if any(ref.startswith(p) for p in LINES[k].source_prefixes)]
