"""The outward active loop: one seed -> N content artifacts.

Mirrors samagra/bridge/run.py shape (plan~scan, build~submit) but fans a seed to
many LANES instead of one mcd write, and writes only LOCAL artifacts in Phase 1.
Governance writes use store.connect() (durable governance.db, D6). Dedup is per
(seed_ref, line): a seed is bridged once PER lane.
"""
from __future__ import annotations

import json
import uuid

from ..bridge import outbox
from ..bridge.pointers import resolve_pointers
from ..governance import store
from . import dispatch
from .lines import LINES, classify

_AGENT = "khanak"  # COO/CTO — production lane owner


def _existing_assignment_for(conn, seed_ref: str, line: str) -> dict | None:
    """ANY prior assignment for this (seed_ref, line), status-blind (incl. terminal
    'captured') — one seed is fanned to a given lane at most once."""
    for a in store.list_assignments(conn):
        if a.get("seed_ref") == seed_ref and a.get("pipeline") == line:
            return a
    return None


def plan(seed_ref: str, dry: bool = True) -> list[dict]:
    """Classify a seed into product lines; dry=True writes nothing, dry=False
    records ONE in-review child assignment + outbox + 'product_proposed' per line."""
    lines = classify(seed_ref)
    pointers = resolve_pointers(seed_ref.split(":", 1)[-1].replace("-", " "), limit=5)
    proposals: list[dict] = []
    conn = None if dry else store.connect()
    try:
        for line in lines:
            spec = LINES[line]
            proposal = {"seed_ref": seed_ref, "line": line,
                        "expected_output": spec.expected_output, "pointers": pointers}
            if not dry:
                existing = _existing_assignment_for(conn, seed_ref, line)
                if existing is not None:
                    proposal["assignment_id"] = existing["id"]
                    proposal["reused"] = True
                    proposals.append(proposal)
                    continue
                assignment_id = uuid.uuid4().hex
                outbox_path = outbox.write_outbox_file(
                    agent=_AGENT, assignment_id=assignment_id, pipeline=line,
                    seed_ref=seed_ref, expected_output=spec.expected_output,
                    review_by=_AGENT, payload=proposal, pointers=pointers)
                store.add_assignment(
                    conn, id=assignment_id, agent=_AGENT, outbox_path=outbox_path,
                    pipeline=line, seed_ref=seed_ref,
                    expected_output=spec.expected_output, review_by=_AGENT)
                store.set_assignment_status(conn, assignment_id, "in-review")
                store.append_event(
                    conn, actor="system", verb="product_proposed",
                    assignment_id=assignment_id, subsystem="factory",
                    subsystem_ref=seed_ref,
                    note=json.dumps({"line": line, "pointers": pointers},
                                    ensure_ascii=False))
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
    """Board gate: flip one 'in-review' child -> 'approved'. Refuses others."""
    conn = store.connect()
    try:
        a = _load_assignment(conn, assignment_id)
        if a is None:
            raise ValueError(f"unknown assignment: {assignment_id}")
        if a["status"] != "in-review":
            raise ValueError(
                f"assignment {assignment_id} is {a['status']!r}, not 'in-review'")
        store.set_assignment_status(conn, assignment_id, "approved")
        return {"assignment_id": assignment_id, "status": "approved"}
    finally:
        conn.close()


def approve_seed(seed_ref: str) -> dict:
    """PER-SEED BATCH gate (fork 3): flip ALL in-review children of a seed ->
    'approved' in one explicit human action. Never a silent auto-approve."""
    conn = store.connect()
    try:
        approved = []
        for a in store.list_assignments(conn):
            if a.get("seed_ref") == seed_ref and a["status"] == "in-review":
                store.set_assignment_status(conn, a["id"], "approved")
                approved.append(a["id"])
        return {"seed_ref": seed_ref, "approved": approved}
    finally:
        conn.close()


def _has_event(conn, assignment_id: str, verb: str) -> bool:
    return any(e.get("assignment_id") == assignment_id and e.get("verb") == verb
               for e in store.list_events(conn, limit=10000))


def _build_in_flight(conn, assignment_id: str) -> bool:
    """A prior build recorded 'product_building' but no matching 'product_created'
    — it crashed in its write window. Refuse rather than re-produce (guard 3)."""
    verbs = [e.get("verb") for e in store.list_events(conn, limit=10000)
             if e.get("assignment_id") == assignment_id]
    return "product_building" in verbs and "product_created" not in verbs


def build(assignment_id: str) -> dict:
    """The ONE guarded write boundary. Inherits the bridge's five guards; writes a
    LOCAL artifact (Phase 1); on success flips the assignment -> terminal 'captured'."""
    conn = store.connect()
    try:
        a = _load_assignment(conn, assignment_id)
        if a is None:
            raise ValueError(f"unknown assignment: {assignment_id}")
        if a["status"] != "approved":                                    # guard 1
            raise ValueError(
                f"assignment {assignment_id} is {a['status']!r}, not 'approved'")
        if _has_event(conn, assignment_id, "product_created"):           # guard 2
            raise ValueError(
                f"assignment {assignment_id} already built — refusing a double build")
        if _build_in_flight(conn, assignment_id):                        # guard 3
            raise ValueError(
                f"assignment {assignment_id} has an in-flight build — a prior build "
                f"may have written an artifact. Reconcile before retrying.")
        line, seed_ref = a["pipeline"], a["seed_ref"]
        dispatch.validate_seed_for_line(line, seed_ref)                  # cheap pre-check
        # Record intent BEFORE producing (crash-window safe; mirrors bridge submit).
        store.append_event(conn, actor=_AGENT, verb="product_building",
                           assignment_id=assignment_id, subsystem="factory",
                           subsystem_ref=seed_ref, note="build intent before produce")
        result = dispatch.run_line(line, seed_ref.split(":", 1)[-1])
        dispatch.validate_product(line, result)                          # guard 4
        artifact_ref = result["html"]
        store.append_event(conn, actor=_AGENT, verb="product_created",
                           assignment_id=assignment_id, subsystem="factory",
                           subsystem_ref=artifact_ref,
                           note=json.dumps({"line": line, "artifact": result},
                                           ensure_ascii=False))
        store.set_assignment_status(conn, assignment_id, "captured")     # guard 5 (single write)
        return {"assignment_id": assignment_id, "line": line,
                "artifact_ref": artifact_ref}
    finally:
        conn.close()
