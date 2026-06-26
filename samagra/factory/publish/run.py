# samagra/factory/publish/run.py
"""The publish boundary orchestrator: captured -> published (owner-gated).

Reads ONLY captured local factory artifacts (governance.db + the files already on
disk) and writes ONLY under PUBLISHED_DIR + appends append-only `published` /
`unpublished` governance events. No write path to the 7 source subsystems; no
public surface; no assignment-state change; no migration. Manual CLI only.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from ...governance import store as gov
from ..lines import LINES
from . import manifest
from . import store as pub

_ACTOR = "owner"

# Every non-mcd lane produces a LOCAL artifact that can be copied into published/.
# The mcd `seed` lane writes inward to mycontentdev and has no local file to copy.
PUBLISHABLE = frozenset(k for k, l in LINES.items() if l.kind != "mcd")


def _titleize(chapter: str) -> str:
    # Assumes hyphen-delimited slugs (e.g. circular-motion); underscores are NOT
    # treated as word boundaries, so an underscore slug won't title-case per word.
    return chapter.replace("-", " ").title()


def _norm_lanes(lanes) -> set[str] | None:
    """Normalize a None | str("a,b") | iterable lane filter to a set, validated
    against PUBLISHABLE. None means 'all captured publishable lanes'; an empty or
    whitespace-only filter is a mistake, not 'all', and raises."""
    if lanes is None:
        return None
    items = lanes.split(",") if isinstance(lanes, str) else list(lanes)
    want = {x.strip() for x in items if x and x.strip()}
    if not want:
        raise ValueError(
            "empty lane filter — pass lanes=None to publish all captured lanes")
    bad = want - PUBLISHABLE
    if bad:
        raise ValueError(
            f"not publishable lane(s): {sorted(bad)} "
            f"(publishable: {sorted(PUBLISHABLE)})")
    return want


def _last_product_created(events: list[dict]) -> dict | None:
    """The artifact `result` dict from the LAST product_created note (a rebuilt
    assignment may have several). None if absent/malformed — a clean refusal."""
    result = None
    for ev in events:                         # list_events_for_assignment is oldest-first
        if ev.get("verb") != "product_created":
            continue
        try:
            note = json.loads(ev["note"])
        except (TypeError, ValueError):
            continue
        if isinstance(note, dict) and isinstance(note.get("artifact"), dict):
            result = note["artifact"]
    return result


def _captured_publishable(conn, chapter: str, want: set[str] | None) -> list[dict]:
    """Descriptors for the chapter's captured, publishable artifacts. Refuses (no
    phantom publish) if an artifact's product_created note or its html file on
    disk is missing — the owner must rebuild first.

    `conn` is a governance connection (read or write); the full scan over
    list_assignments is fine for the single-operator console."""
    seed = f"textbook:{chapter}"
    out: list[dict] = []
    for a in gov.list_assignments(conn):
        if a.get("seed_ref") != seed or a.get("status") != "captured":
            continue
        lane = a.get("pipeline")
        if lane not in PUBLISHABLE or (want is not None and lane not in want):
            continue
        result = _last_product_created(gov.list_events_for_assignment(conn, a["id"]))
        if not result:
            raise ValueError(
                f"assignment {a['id']} ({lane}) has no recoverable artifact — "
                f"rebuild before publishing")
        html = result.get("html")
        if not (html and Path(html).is_file()):
            raise ValueError(
                f"assignment {a['id']} ({lane}) artifact file missing on disk — "
                f"rebuild before publishing")
        files = [result[k] for k in ("html", "json", "docx")
                 if result.get(k) and Path(result[k]).is_file()]
        out.append({"assignment_id": a["id"], "lane": lane,
                    "captured_at": a.get("updated_at"),
                    "style_seed_version": result.get("style_seed_version"),
                    "source_files": files})
    return out
