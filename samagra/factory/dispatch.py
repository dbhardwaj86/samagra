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
from . import deck, paper
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
      - deck            -> the pure local flashcard engine (no external write).
      - paper/drill     -> the QX-backed answer-safe paper engine (kind 'qx';
        read-only QX, local write; variant = the lane key sizes paper vs drill).
      - revision/lecture-> the lecture exporter (upload_gdocs=False keeps the
        Phase-1 invariant: local artifacts only, never an external Google Docs
        upload — review 24 H1).
    The mcd (seed) branch lands in C3.
    """
    spec = LINES[line]
    if line == "deck":
        return deck.build_deck(slug)
    if spec.kind == "qx":
        return paper.build_paper(slug, variant=line)
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


# Structural answer/solution markers QX uses in its AUTHORING views (never in the
# read-only /api/qsearch student render, which stops at stem/options/passage/matrix).
# All are HTML class/attribute tokens — they cannot occur in legitimately rendered
# question PROSE (a stem may contain the word "answer"; it can never contain
# class="answer"), so scanning for them is false-positive-free.
_ANSWER_MARKERS = (
    'class="answer"',
    "answer-label",
    "answer_confidence",
    "data-answer",
    "data-correct",
    'class="solution"',
)


def _assert_no_answer_leak(line: str, result: dict) -> None:
    """For QX (paper/drill) lanes ONLY: re-assert the published artifact carries no
    answer/solution data. Defense in depth — we do not trust the upstream render to
    be answer-free and re-check at our write boundary. Reads the assembled artifact
    and raises ValueError on any structural answer/solution marker. kind in
    {local, mcd} keep the no-op (lecture/deck carry no answer columns; the mcd
    payload is validated by validate_seed_payload, not this guard)."""
    spec = LINES.get(line)
    if spec is None or spec.kind != "qx":
        return
    html = result.get("html")
    text = (Path(html).read_text(encoding="utf-8") if html else "").lower()
    for marker in _ANSWER_MARKERS:
        if marker in text:
            raise ValueError(
                f"line {line!r} artifact carries an answer/solution marker "
                f"({marker!r}) — refusing to publish a paper that may leak answers")
