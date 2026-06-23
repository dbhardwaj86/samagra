"""Factory board outbox: a human-readable proposal file carrying the CORRECT
`samagra factory` approve/build commands.

Deliberately NOT the bridge's outbox writer — that one instructs the operator to
run `samagra bridge approve|submit`, the WRONG workflow for a factory assignment
(review 24 M1). The pointers live here for a human reviewer; they ship nowhere.
"""
from __future__ import annotations

import datetime
import re
from pathlib import Path

# agent + assignment_id are interpolated into the output PATH and verbatim into
# the command text, so both must be slug-safe (defence in depth — the only caller
# passes a hardcoded agent and a uuid4().hex id). Mirrors bridge.outbox.
_SLUG_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def write_outbox_file(*, agent: str, assignment_id: str, pipeline: str,
                      seed_ref: str, expected_output: str, review_by: str,
                      payload: dict, pointers: list[dict]) -> str:
    """Write a dated factory proposal under board/<agent>/outbox/.
    Returns the repo-relative POSIX path (stored as the assignment's outbox_path).
    `payload` is accepted for drop-in parity with bridge.outbox; it is not rendered."""
    if not _SLUG_RE.match(agent or "") or not _SLUG_RE.match(assignment_id or ""):
        raise ValueError(
            f"agent/assignment_id must be slug-safe ([A-Za-z0-9_-]); "
            f"got agent={agent!r}, assignment_id={assignment_id!r}")
    today = datetime.date.today().isoformat()
    rel = Path("board") / agent / "outbox" / f"{today}-factory-{assignment_id[:8]}.md"
    rel.parent.mkdir(parents=True, exist_ok=True)
    ptr_lines = "\n".join(
        f"  - {p.get('source')}:{p.get('uid')} — {p.get('title')}" for p in pointers
    ) or "  (none)"
    body = (
        "---\n"
        f"assignee: {agent}\n"
        f"pipeline: {pipeline}\n"
        f"seed_ref: {seed_ref}\n"
        f"expected_output: {expected_output}\n"
        f"review_by: {review_by}\n"
        "status: in-review\n"
        "---\n\n"
        f"# Proposed content artifact (factory dispatch from seed {seed_ref})\n\n"
        f"**Lane:** {pipeline}\n\n"
        f"**Expected output:** {expected_output}\n\n"
        "**Candidate corpus pointers:**\n"
        f"{ptr_lines}\n\n"
        "**Board action:** review this proposed content lane. To approve ALL lanes "
        f"of this seed in one batch run `samagra factory approve-seed {seed_ref}` "
        f"(or just this one with `samagra factory approve {assignment_id}`), then "
        f"build it with `samagra factory build {assignment_id}`. The build is the "
        "guarded write boundary — do NOT build until a board agent approves.\n"
    )
    rel.write_text(body, encoding="utf-8")
    return rel.as_posix()
