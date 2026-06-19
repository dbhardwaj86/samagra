"""Pipeline phase state machine.

Adopts the run-episode pattern: one JSON file per pipeline is the source of truth
(`state/<pipeline>.orchestrator_state.json`), mirrored to a human-readable
`state/tracker.txt`. The scheduler (Phase D) advances auto-phases; human gates pause.
"""
from __future__ import annotations

import json
import os
import time

from . import config
from .lock import file_lock

# Pipeline definitions: ordered phases, which phases are hard gates, and the
# worker that owns each phase (role-specialized routing).
PIPELINES: dict[str, dict] = {
    "textbook": {
        "label": "Lectures (textbook)",
        "phases": ["draft", "enrich", "approve", "export"],
        "gates": ["approve"],
        "owners": {"draft": "codex", "enrich": "codex",
                   "approve": "human", "export": "teachingos"},
    },
    "questions": {
        "label": "Question corpus (QX)",
        "phases": ["extract", "tag", "verify"],
        "gates": [],
        "owners": {"extract": "codex", "tag": "gemini", "verify": "claude2"},
    },
    "papers": {
        "label": "Booklet-linked papers",
        "phases": ["link", "build", "finalize"],
        "gates": ["finalize"],
        "owners": {"link": "claude2", "build": "teachingos", "finalize": "human"},
    },
    "media": {
        "label": "Media (audio/decks/images)",
        "phases": ["plan", "generate", "publish"],
        "gates": ["publish"],
        "owners": {"plan": "claude1", "generate": "notebooklm", "publish": "human"},
    },
}

VALID_STATUS = {"pending", "in_progress", "awaiting_gate", "done", "failed", "blocked"}


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _path(pipeline: str):
    return config.STATE_DIR / f"{pipeline}.orchestrator_state.json"


def _default(pipeline: str) -> dict:
    """Build a fresh default state object in memory (no disk side effects)."""
    spec = PIPELINES[pipeline]
    return {
        "pipeline": pipeline,
        "label": spec["label"],
        "created": _now(),
        "updated": _now(),
        "current": spec["phases"][0],
        "phases": {
            ph: {
                "status": "pending",
                "owner": spec["owners"].get(ph),
                "gate": ph in spec["gates"],
                "started": None,
                "finished": None,
                "artifacts": [],
                "error": None,
            }
            for ph in spec["phases"]
        },
    }


def init(pipeline: str) -> dict:
    """Create and persist a fresh state object (explicit mutation)."""
    st = _default(pipeline)
    save(st)
    return st


def load(pipeline: str) -> dict:
    """Return current state, or an in-memory default if none exists yet.

    Read-only: a missing pipeline yields a default WITHOUT writing it to disk
    (no GET-side write). Use ``init()``/``set_phase()`` to persist explicitly.
    """
    p = _path(pipeline)
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return _default(pipeline)


def save(st: dict) -> None:
    """Persist state atomically under a single state lock.

    Writes the JSON to a sibling ``*.tmp`` file then ``os.replace``s it into
    place (atomic on POSIX and Windows), with the whole operation guarded by a
    dedicated ``.state.lock`` so concurrent gate/tick/API writes cannot
    interleave and truncate or lose updates.
    """
    config.STATE_DIR.mkdir(parents=True, exist_ok=True)
    st["updated"] = _now()
    payload = json.dumps(st, indent=2, ensure_ascii=False)
    path = _path(st["pipeline"])
    tmp = path.with_suffix(path.suffix + ".tmp")
    with file_lock(config.STATE_DIR / ".state.lock"):
        tmp.write_text(payload, encoding="utf-8")
        os.replace(tmp, path)
        phases = " ".join(f'{k}:{v["status"]}' for k, v in st["phases"].items())
        tracker_append(
            f'{st["updated"]} {st["pipeline"]} current={st.get("current")} {phases}'
        )


def set_phase(pipeline: str, phase: str, status: str, **fields) -> dict:
    if status not in VALID_STATUS:
        raise ValueError(f"invalid status {status!r}")
    st = load(pipeline)
    ph = st["phases"][phase]
    ph["status"] = status
    if status == "in_progress" and not ph["started"]:
        ph["started"] = _now()
    if status in ("done", "failed"):
        ph["finished"] = _now()
    for k, v in fields.items():
        ph[k] = v
    order = PIPELINES[pipeline]["phases"]
    st["current"] = next(
        (p for p in order if st["phases"][p]["status"] != "done"), order[-1]
    )
    save(st)
    return st


def all_states() -> list[dict]:
    return [load(name) for name in PIPELINES]


def tracker_append(line: str) -> None:
    config.STATE_DIR.mkdir(parents=True, exist_ok=True)
    with open(config.STATE_DIR / "tracker.txt", "a", encoding="utf-8") as f:
        f.write(line + "\n")
