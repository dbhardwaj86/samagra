"""Rank every UNPRODUCED cell (state in base|gap) into the demand queue.

Default ranker = deficit-weighted: demand_size / (existing_corpus_n + 1). The
existing corpus never marks a cell covered, but it steers priority — a high-demand
concept thin in existing material (e.g. samadhan, denominator 0) floats to the top.
Pure + deterministic; the one seam Phase F enriches (post-use flags / semantic).
"""
from __future__ import annotations

from .matrix import COVERAGE_LANES  # noqa: F401  (kept for lane validation/imports)

_LANE_PRIORITY = {lane: i for i, lane in enumerate(
    ["samadhan", "revision", "deck", "drill", "paper", "lecture"])}


def rank_gaps(cells: list[dict], concepts: list[dict], best_chapter: dict) -> list[dict]:
    demand = {c["concept_id"]: c["demand_size"] for c in concepts}
    items: list[dict] = []
    for cell in cells:
        if cell["state"] == "produced":
            continue
        cid = cell["concept_id"]
        slug = best_chapter.get(cid)
        if not slug:
            continue  # no textbook pointer -> can't pre-load a seed (logged by build)
        d = demand.get(cid, 0)
        ec = cell["base_n"]
        items.append({
            "concept_id": cid, "lane": cell["lane"], "cell_state": cell["state"],
            "demand_size": d, "existing_corpus_n": ec,
            "deficit_score": round(d / (ec + 1), 4),
            "suggested_seed_ref": f"textbook:{slug}",
            "plan_command": f"samagra factory plan textbook:{slug} --lane {cell['lane']}",
        })
    items.sort(key=lambda g: (-g["deficit_score"],
                              _LANE_PRIORITY.get(g["lane"], 99), g["concept_id"]))
    for i, g in enumerate(items, 1):
        g["rank"] = i
    return items
