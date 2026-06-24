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
    variant: str            # the lectures.export variant this lane renders (unused by non-export engines)
    source_prefixes: tuple  # seed_ref prefixes this lane applies to
    kind: str = "local"     # output class: "local" | "qx" | "mcd" (Phase-C lane-kind seam).
                            # Default keeps revision/lecture local; consumed by C2 (qx
                            # answer-leak) / C3 (mcd build). In C1 every lane is "local".


LINES: dict[str, Line] = {
    "revision": Line("revision", "Revision sheet (thin lecture export)",
                     "thin", ("textbook:",)),
    "lecture": Line("lecture", "Full lecture (thick lecture export)",
                    "thick", ("textbook:",)),
    "deck": Line("deck", "Flashcard deck (equation/callout projection)",
                 "deck", ("textbook:",), "local"),
    "paper": Line("paper", "Question paper (answer-safe)",
                  "paper", ("textbook:",), "qx"),
    "drill": Line("drill", "Adaptive drill set (answer-safe)",
                  "drill", ("textbook:",), "qx"),
}

# Deterministic lane order so a seed always fans out the same way.
_ORDER = ["revision", "lecture", "deck", "paper", "drill"]


def classify(seed_ref: str) -> list[str]:
    """Return the applicable product-line keys for a seed_ref, in stable order."""
    ref = (seed_ref or "").strip()
    if not ref:
        return []
    return [k for k in _ORDER
            if any(ref.startswith(p) for p in LINES[k].source_prefixes)]
