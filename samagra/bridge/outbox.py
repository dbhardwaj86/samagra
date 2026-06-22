"""Write ready-to-paste outbox prompt files (spec §7b).

The outbox markdown is the human-readable board artifact: it carries the verbatim
text, the resolved corpus pointers, and the exact approve/submit commands. It is
where the pointers live for a human reviewer (they are not shipped to mcd).
"""
from __future__ import annotations

import datetime
import re
from pathlib import Path

# `agent` and `assignment_id` are interpolated into the output PATH (the [:8]
# slice) AND verbatim into the approve/submit command text in the file body, so
# both must be slug-safe — a self-defending guard against path traversal and
# command/markdown injection even though the only caller passes a hardcoded
# agent and a uuid4().hex id (defence in depth). The FULL id is validated, not
# just the path slice.
_SLUG_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def write_outbox_file(*, agent: str, assignment_id: str, pipeline: str,
                      seed_ref: str, expected_output: str, review_by: str,
                      payload: dict, pointers: list[dict]) -> str:
    """Write a dated front-matter prompt under board/<agent>/outbox/.
    Returns the repo-relative POSIX path (stored as the assignment's outbox_path)."""
    if not _SLUG_RE.match(agent or "") or not _SLUG_RE.match(assignment_id or ""):
        raise ValueError(
            f"agent/assignment_id must be slug-safe ([A-Za-z0-9_-]); "
            f"got agent={agent!r}, assignment_id={assignment_id!r}")
    today = datetime.date.today().isoformat()
    rel = Path("board") / agent / "outbox" / f"{today}-{assignment_id[:8]}.md"
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
        f"# Proposed mycontentdev seed (auto-bridged from munshi {seed_ref})\n\n"
        f"**Type:** {payload.get('type')}\n\n"
        "**Raw text (verbatim from munshi):**\n\n"
        f"{payload.get('raw_text', '')}\n\n"
        "**Exact pointers (candidate corpus sources):**\n"
        f"{ptr_lines}\n\n"
        "**Board action:** review this proposal. On approval run "
        f"`samagra bridge approve {assignment_id}`, then "
        f"`samagra bridge submit {assignment_id}` to create the seed via the "
        "capture API. Do NOT submit until a board agent approves it.\n"
    )
    rel.write_text(body, encoding="utf-8")
    return rel.as_posix()
