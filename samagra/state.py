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
    "mycontentdev": {
        "label": "Editorial (mycontentdev)",
        "phases": ["capture", "enrich", "review", "publish"],
        "gates": ["review", "publish"],
        "owners": {"capture": "human", "enrich": "claude2",
                   "review": "claude1", "publish": "human"},
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


def _load_unlocked(pipeline: str) -> dict:
    """Read state from disk (or an in-memory default) WITHOUT taking the lock.

    Internal primitive: callers that already hold ``.state.lock`` use this to
    read inside their critical section. ``load()`` wraps it for public reads.
    """
    p = _path(pipeline)
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return _default(pipeline)


def load(pipeline: str) -> dict:
    """Return current state, or an in-memory default if none exists yet.

    Read-only: a missing pipeline yields a default WITHOUT writing it to disk
    (no GET-side write). Use ``init()``/``set_phase()`` to persist explicitly.

    The read is unlocked: ``os.replace`` makes every write land atomically, so a
    concurrent reader always observes a complete old-or-new file, never a torn
    one. Read-modify-write callers must use ``set_phase()`` (or hold the lock
    and use ``_load_unlocked``) so their read and write stay in one lock span.
    """
    return _load_unlocked(pipeline)


def _save_unlocked(st: dict) -> None:
    """Persist state atomically WITHOUT taking the lock.

    Internal primitive: assumes the caller already holds ``.state.lock``. Stamps
    ``updated``, writes to a sibling ``*.tmp`` file, then ``os.replace``s it into
    place (atomic on POSIX and Windows) and mirrors to the tracker. On any
    failure of the write/replace, the leftover ``*.tmp`` is best-effort removed
    so a crashed write does not litter ``STATE_DIR`` (Codex LOW durability nit).
    """
    config.STATE_DIR.mkdir(parents=True, exist_ok=True)
    st["updated"] = _now()
    payload = json.dumps(st, indent=2, ensure_ascii=False)
    path = _path(st["pipeline"])
    tmp = path.with_suffix(path.suffix + ".tmp")
    try:
        tmp.write_text(payload, encoding="utf-8")
        os.replace(tmp, path)
    except Exception:
        # Best-effort temp cleanup must NOT mask the original write/replace
        # error: swallow any OSError from the unlink (not just FileNotFoundError)
        # and then re-raise the ORIGINAL exception (Codex LOW).
        try:
            tmp.unlink()
        except OSError:
            pass
        raise
    phases = " ".join(f'{k}:{v["status"]}' for k, v in st["phases"].items())
    tracker_append(
        f'{st["updated"]} {st["pipeline"]} current={st.get("current")} {phases}'
    )


def save(st: dict) -> None:
    """Persist state atomically under a single state lock.

    Writes the JSON to a sibling ``*.tmp`` file then ``os.replace``s it into
    place (atomic on POSIX and Windows), with the whole operation guarded by a
    dedicated ``.state.lock`` so concurrent gate/tick/API writes cannot
    interleave and truncate or lose updates.
    """
    with file_lock(config.STATE_DIR / ".state.lock"):
        _save_unlocked(st)


def set_phase(pipeline: str, phase: str, status: str, **fields) -> dict:
    if status not in VALID_STATUS:
        raise ValueError(f"invalid status {status!r}")
    # Whole read-modify-write under ONE ``.state.lock`` so two concurrent writers
    # cannot load the same old JSON, mutate different phases, and have the later
    # save clobber the earlier transition (the lost-update bug from Codex H2).
    # ``file_lock`` is not reentrant, so we use the *unlocked* primitives here
    # rather than the public ``load``/``save`` (which would re-acquire the lock).
    with file_lock(config.STATE_DIR / ".state.lock"):
        st = _load_unlocked(pipeline)
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
        _save_unlocked(st)
    return st


def all_states() -> list[dict]:
    return [load(name) for name in PIPELINES]


def tracker_append(line: str) -> None:
    config.STATE_DIR.mkdir(parents=True, exist_ok=True)
    with open(config.STATE_DIR / "tracker.txt", "a", encoding="utf-8") as f:
        f.write(line + "\n")
