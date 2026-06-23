"""The guarded engine layer: map a lane -> an existing renderer; validate I/O.

Phase 1 lanes are DETERMINISTIC and write only LOCAL artifacts via the lecture
exporter (no new prod write path). validate_product re-asserts the output contract
at the write boundary exactly as bridge.seed_payload.validate_seed_payload does
(spec §3.2 guard 4); the answer-leak hook is a no-op for Phase 1's lecture lanes
but is the structural seam for the later QX/paper lanes.
"""
from __future__ import annotations

from pathlib import Path

from ..lectures import export as lex
from . import deck
from .lines import LINES


def _slug(seed_ref: str) -> str:
    return seed_ref.split(":", 1)[-1]


def validate_seed_for_line(line: str, seed_ref: str) -> None:
    """Cheap pre-check (before recording any build intent): the seed_ref matches
    the lane's source prefix and names a slug."""
    spec = LINES.get(line)
    if spec is None:
        raise ValueError(f"unknown line {line!r}")
    if not any((seed_ref or "").startswith(p) for p in spec.source_prefixes):
        raise ValueError(f"seed {seed_ref!r} is not valid input for line {line!r}")
    if not _slug(seed_ref):
        raise ValueError(f"seed {seed_ref!r} has no slug")


def run_line(line: str, slug: str) -> dict:
    """Run the lane's engine. Phase-C lane-kind dispatch:
      - deck      -> the pure local flashcard engine (no external write).
      - revision/lecture -> the lecture exporter (upload_gdocs=False keeps the
        Phase-1 invariant: local artifacts only, never an external Google Docs
        upload — review 24 H1).
    Later sub-slices add the qx (paper/drill) + mcd (seed) branches.
    """
    spec = LINES[line]
    if line == "deck":
        return deck.build_deck(slug)
    return lex.export_one(slug, spec.variant, upload_gdocs=False)


def validate_product(line: str, result: dict) -> None:
    """Write-boundary output guard: the artifact exists, is non-empty, and (for
    answer-bearing lanes — none in Phase 1) carries zero answer data. Raises ValueError."""
    html = result.get("html")
    if not html:
        raise ValueError(f"line {line!r} produced no html artifact")
    p = Path(html)
    if not p.is_file() or p.stat().st_size == 0:
        raise ValueError(f"line {line!r} artifact missing or empty: {html}")
    # Answer-leak structural hook (no-op for lecture lanes; enforced for QX in Phase C).
    _assert_no_answer_leak(line, result)


def _assert_no_answer_leak(line: str, result: dict) -> None:
    # Phase 1 lecture lanes carry no answer columns by construction. The QX
    # paper lane (Phase C) overrides this to assert the student variant has none.
    return
