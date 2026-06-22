"""The active loop: scan munshi -> propose seeds (no write); approve; submit.

scan(dry=True)  -> classify munshi items, build proposed seed payloads + pointers.
                   dry=True writes NOTHING. dry=False records an 'in-review' board
                   assignment per content item (agent 'khanak') + an outbox file +
                   a 'seed_proposed' event; it NEVER creates a seed. Re-scanning
                   skips items that already have a non-terminal assignment.
approve(id)     -> board gate: flips an 'in-review' assignment to 'approved'.
submit(id)      -> the ONE subsystem write: requires status 'approved', refuses a
                   double-write, creates the seed, flips to terminal 'captured'.

Governance writes use store.connect() (the durable governance.db, D6) — NOT the
rebuildable catalog DB.
"""
from __future__ import annotations

import json
import uuid

from .. import catalog  # noqa: F401  (kept for future direct catalog reads)
from ..adapters.munshi import MunshiAdapter
from ..clients.mcd_client import McdClient
from ..governance import store
from . import outbox
from .classify import classify_item
from .pointers import resolve_pointers
from .seed_payload import build_seed_payload
from .text import item_text

# Statuses that mean "this munshi item already has a live proposal in flight".
_OPEN_STATUSES = {"queued", "running", "in-review", "approved"}


def _item_from_artifact(art) -> dict:
    """Reconstruct the munshi item dict from an Artifact's meta envelope."""
    meta = getattr(art, "meta", None) or {}
    return {
        "id": art.uid.split(":", 1)[-1],
        "uid": art.uid,
        "kind": art.kind,
        "status": art.status,
        "payload": meta.get("payload") or {},
        "tags": meta.get("tags"),
        "person": meta.get("person"),
        "due": meta.get("due"),
        "ts": art.updated_at,
    }


def _open_assignment_for(conn, seed_ref: str) -> dict | None:
    for a in store.list_assignments(conn):
        if a.get("seed_ref") == seed_ref and a.get("status") in _OPEN_STATUSES:
            return a
    return None


def scan(dry: bool = True) -> list[dict]:
    """Propose seeds for content-classified munshi items. dry=True writes nothing."""
    adapter = MunshiAdapter()
    if not adapter.available():
        return []

    proposals: list[dict] = []
    conn = None if dry else store.connect()
    try:
        for art in adapter.artifacts():
            item = _item_from_artifact(art)
            if classify_item(item) != "content":
                continue
            pointers = resolve_pointers(item_text(item), limit=5)
            payload = build_seed_payload(item, pointers)
            proposal = {
                "item": {"uid": art.uid, "kind": item["kind"], "status": item["status"]},
                "classification": "content",
                "pointers": pointers,
                "payload": payload,
            }
            if not dry:
                existing = _open_assignment_for(conn, art.uid)
                if existing is not None:
                    proposal["assignment_id"] = existing["id"]
                    proposal["reused"] = True
                    proposals.append(proposal)
                    continue
                assignment_id = uuid.uuid4().hex
                # Outbox file first, then the governance row. The file is not
                # authoritative (the governance row is); if add_assignment fails
                # after the file is written, the orphan file is harmless and a
                # re-scan (dedup keys on governance rows) re-proposes cleanly.
                outbox_path = outbox.write_outbox_file(
                    agent="khanak", assignment_id=assignment_id,
                    pipeline="mycontentdev", seed_ref=art.uid,
                    expected_output="Create mycontentdev seed from munshi item",
                    review_by="khanak", payload=payload, pointers=pointers,
                )
                store.add_assignment(
                    conn, id=assignment_id, agent="khanak",
                    outbox_path=outbox_path, pipeline="mycontentdev",
                    seed_ref=art.uid,
                    expected_output="Create mycontentdev seed from munshi item",
                    review_by="khanak",
                )
                store.set_assignment_status(conn, assignment_id, "in-review")
                store.append_event(
                    conn, actor="system", verb="seed_proposed",
                    assignment_id=assignment_id, subsystem="munshi",
                    subsystem_ref=art.uid,
                    note=json.dumps({"payload": payload, "pointers": pointers},
                                    ensure_ascii=False),
                )
                proposal["assignment_id"] = assignment_id
            proposals.append(proposal)
    finally:
        if conn is not None:
            conn.close()
    return proposals


def _load_assignment(conn, assignment_id: str) -> dict | None:
    for a in store.list_assignments(conn):
        if a["id"] == assignment_id:
            return a
    return None


def approve(assignment_id: str) -> dict:
    """Board gate: flip an 'in-review' assignment to 'approved'. Refuses others."""
    conn = store.connect()
    try:
        a = _load_assignment(conn, assignment_id)
        if a is None:
            raise ValueError(f"unknown assignment: {assignment_id}")
        if a["status"] != "in-review":
            raise ValueError(
                f"assignment {assignment_id} is '{a['status']}', not 'in-review' "
                f"— only an in-review proposal can be approved.")
        store.set_assignment_status(conn, assignment_id, "approved")
        return {"assignment_id": assignment_id, "status": "approved"}
    finally:
        conn.close()


def _load_proposed_payload(conn, assignment_id: str) -> dict | None:
    """Recover the flat create_seed body from the 'seed_proposed' event note.

    Scans the 10000 most-recent events (list_events is ORDER BY id DESC). For a
    single-operator governance DB that is effectively unbounded; if the ledger
    ever grows past it, a very old seed_proposed becomes invisible and this
    returns None (surfaced as a clear 'no proposed payload' refusal, never a
    silent wrong write).
    """
    for ev in store.list_events(conn, limit=10000):
        if ev.get("assignment_id") == assignment_id and ev.get("verb") == "seed_proposed":
            try:
                return json.loads(ev["note"])["payload"]
            except (TypeError, ValueError, KeyError):
                return None
    return None


def _already_captured(conn, assignment_id: str) -> bool:
    """True iff THIS assignment already has a seed_created event (per-assignment
    dedup). A *different* assignment for the same munshi item is a legitimate
    re-capture (scan dedup only excludes non-terminal statuses), and is gated by
    a fresh human board approval — so this guard is scoped to the assignment, not
    the munshi item, by design."""
    return any(ev.get("assignment_id") == assignment_id and ev.get("verb") == "seed_created"
               for ev in store.list_events(conn, limit=10000))


def submit(assignment_id: str) -> dict:
    """Create the seed for an APPROVED assignment. The only subsystem write.

    Refuses unless status is exactly 'approved' AND no seed was already created
    for it (idempotent). On success flips the assignment to terminal 'captured'.
    """
    conn = store.connect()
    try:
        a = _load_assignment(conn, assignment_id)
        if a is None:
            raise ValueError(f"unknown assignment: {assignment_id}")
        if a["status"] != "approved":
            raise ValueError(
                f"assignment {assignment_id} is '{a['status']}', not 'approved' "
                f"— refusing to create a seed.")
        if _already_captured(conn, assignment_id):
            raise ValueError(
                f"assignment {assignment_id} already has a created seed — "
                f"refusing a double write.")
        payload = _load_proposed_payload(conn, assignment_id)
        if payload is None:
            raise ValueError(
                f"no proposed payload recorded for assignment {assignment_id}")

        # Crash window: if the process dies AFTER create_seed() returns but
        # BEFORE the two governance writes below land, the seed exists in prod
        # yet governance has no seed_created event and the status stays
        # 'approved' — a re-submit would then pass both guards and create a
        # SECOND seed. For a manually-invoked, board-gated, single-operator tool
        # this millisecond window is acceptable (the human approve gate is the
        # real guard); to harden, look up an existing seed by source_ref on the
        # mcd side before retrying. Mirrors scan()'s outbox-before-DB note.
        seed = McdClient().create_seed(payload)

        store.append_event(
            conn, actor="khanak", verb="seed_created",
            assignment_id=assignment_id, subsystem="mycontentdev",
            subsystem_ref=str(seed.get("id")) if isinstance(seed, dict) else None,
            note="seed created from approved munshi bridge")
        store.set_assignment_status(conn, assignment_id, "captured")
        return {"assignment_id": assignment_id, "seed": seed}
    finally:
        conn.close()
