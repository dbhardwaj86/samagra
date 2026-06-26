"""Load + resolve the git-committed chapter<->concept normalization overlay.

`by_chapter[slug] = {"add": [labels], "remove": [labels]}` — `add` forces an edge,
`remove` drops an FTS-base edge. Labels resolve to QX concept ids (case-insensitive);
an unresolvable label is a HARD build error (catches typos at the review surface).
"""
from __future__ import annotations

import json
from pathlib import Path

from ... import config


def load_overlay(path: Path | None = None) -> dict:
    p = Path(path) if path is not None else config.CONCEPT_ALIASES
    return json.loads(p.read_text(encoding="utf-8"))


def resolve_overlay(overlay: dict, concepts: list[dict],
                    valid_slugs: set | None = None) -> dict:
    by_label = {c["label"].lower(): c["concept_id"] for c in concepts}
    resolved: dict[str, dict] = {}
    for slug, delta in (overlay.get("by_chapter") or {}).items():
        if valid_slugs is not None and slug not in valid_slugs:
            # symmetric with the label check: a typo'd chapter slug would otherwise
            # emit a phantom edge (score 999) + a broken plan_command. Fail at the
            # review surface instead.
            raise ValueError(
                f"concept_aliases.json: unknown chapter slug {slug!r} "
                f"(not a real textbook chapter)")
        out = {"add": set(), "remove": set()}
        for key in ("add", "remove"):
            for label in (delta.get(key) or []):
                cid = by_label.get(str(label).lower())
                if cid is None:
                    raise ValueError(
                        f"concept_aliases.json: unknown concept label {label!r} "
                        f"for chapter {slug!r}")
                out[key].add(cid)
        resolved[slug] = out
    return resolved
