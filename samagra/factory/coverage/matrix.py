"""The concept x lane coverage matrix — 3 states per cell (produced / base / gap).

Coverage rule (DEC: factory-produced-only): only a captured factory artifact marks
a cell `produced`. `base` = unproduced but a SOURCE provides the base (chapter for
the lecture/revision/deck lanes; QX papers for paper/drill). `gap` = neither.
"""
from __future__ import annotations

COVERAGE_LANES = ["revision", "lecture", "deck", "paper", "drill", "samadhan"]
PAPER_LANES = {"paper", "drill"}
CHAPTER_LANES = {"revision", "lecture", "deck"}


def _base_depth(concept: dict, lane: str, n_chapters: int) -> int:
    if lane in PAPER_LANES:
        return concept["paper_count"]
    if lane in CHAPTER_LANES:
        return n_chapters
    return 0  # samadhan — no source equivalent


def build_cells(concepts: list[dict], chapter_edges: list[dict], produced: dict) -> list[dict]:
    chapters_per_concept: dict[int, set] = {}
    for e in chapter_edges:
        chapters_per_concept.setdefault(e["concept_id"], set()).add(e["slug"])

    cells: list[dict] = []
    for c in concepts:
        cid = c["concept_id"]
        n_ch = len(chapters_per_concept.get(cid, ()))
        for lane in COVERAGE_LANES:
            pn = produced.get((cid, lane), 0)
            base_n = _base_depth(c, lane, n_ch)
            state = "produced" if pn > 0 else ("base" if base_n > 0 else "gap")
            cells.append({"concept_id": cid, "lane": lane, "state": state,
                          "produced_n": pn, "base_n": base_n})
    return cells
