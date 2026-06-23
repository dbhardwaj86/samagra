"""Governance store — assignments, events ledger, and board-review overlay.

Runbook D6: governance state is DURABLE and lives in its OWN database file
(`config.GOVERNANCE_DB`), SEPARATE from the rebuildable catalog
(`config.DATA_DB`). The catalog may be deleted and rebuilt at will; this DB must
NOT be — it is the irreplaceable decision ledger (every board approve/reject is
one immutable row). The store carries a `schema_version` (PRAGMA user_version),
an additive migration hook, and a file-consistent `backup()`.

Timestamps are UTC ISO 'YYYY-MM-DDTHH:MM:SSZ', matching state._now() /
catalog._now(). Per D11 the ledger stays metadata-free: verdict + free-text
rationale only, no enumerated reason columns.
"""
from __future__ import annotations

import sqlite3
import time
from pathlib import Path

from .. import config

# Baseline schema version. Bump when adding a migration below; never edit a
# migration that has already shipped.
SCHEMA_VERSION = 1

DDL = """
CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY, agent TEXT NOT NULL, outbox_path TEXT NOT NULL, pipeline TEXT, seed_ref TEXT, artifact_ref TEXT, expected_output TEXT, review_by TEXT, status TEXT NOT NULL DEFAULT 'queued', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, actor TEXT NOT NULL, verb TEXT NOT NULL, assignment_id TEXT, subsystem TEXT, subsystem_ref TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS review_overlay (id INTEGER PRIMARY KEY AUTOINCREMENT, subsystem TEXT NOT NULL, subsystem_ref TEXT NOT NULL, artifact_uid TEXT, reviewer TEXT NOT NULL, verdict TEXT NOT NULL, rationale TEXT, ts TEXT NOT NULL);
"""

# Additive migrations BEYOND the v1 baseline DDL above. Map target_version -> SQL
# script. Empty today — the hook is ready to grow (e.g. {2: "ALTER TABLE ..."}).
# `init_tables` applies every migration whose version exceeds the DB's current
# user_version, then stamps SCHEMA_VERSION.
_MIGRATIONS: dict[int, str] = {}

# 'captured' is the terminal state of a bridged assignment AFTER its seed was
# created (Phase 3 / R3): set_assignment_status accepts it; submit() flips to it
# so a captured assignment can never be re-submitted (idempotent prod write).
ASSIGNMENT_STATUS = {"queued", "running", "in-review", "approved", "changes", "captured"}
REVIEW_VERDICT = {"approved", "changes"}


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def connect() -> sqlite3.Connection:
    """Open the DURABLE governance DB (`config.GOVERNANCE_DB`).

    Deliberately NOT `config.DATA_DB`: the catalog is rebuildable, this is not
    (runbook D6). Resolved at call time so tests can repoint it.
    """
    config.GOVERNANCE_DB.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(config.GOVERNANCE_DB)
    con.row_factory = sqlite3.Row
    return con


# W1.4: GET /api/assignments called init_tables (DDL) on every read. Memoize the
# schema/migration so it runs once per process+DB-path (re-runs if the file was
# deleted), and expose a read-only connection so the read endpoint can't mutate.
_INITIALIZED: set[str] = set()


def ensure_tables() -> None:
    """Idempotent + memoized: create tables + apply migrations once per DB path."""
    key = str(config.GOVERNANCE_DB)
    if key in _INITIALIZED and config.GOVERNANCE_DB.exists():
        return
    conn = connect()
    try:
        init_tables(conn)
    finally:
        conn.close()
    _INITIALIZED.add(key)


def connect_ro() -> sqlite3.Connection:
    """Read-only connection for the assignments GET path — writes raise."""
    ensure_tables()
    con = sqlite3.connect(config.GOVERNANCE_DB.as_uri() + "?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    return con


def init_tables(conn: sqlite3.Connection) -> None:
    """Create baseline tables, apply pending migrations, stamp schema_version.

    Idempotent: safe to call on every connection (used by the API endpoint).
    """
    conn.executescript(DDL)
    _apply_migrations(conn)
    conn.commit()


def _apply_migrations(conn: sqlite3.Connection) -> None:
    cur = conn.execute("PRAGMA user_version").fetchone()[0]
    for version in sorted(_MIGRATIONS):
        if version > cur:
            conn.executescript(_MIGRATIONS[version])
            cur = version
    cur = max(cur, SCHEMA_VERSION)
    # PRAGMA user_version does not accept bound params; cur is an int we control.
    conn.execute(f"PRAGMA user_version = {int(cur)}")


def backup(dest) -> Path:
    """Make a consistent copy of the governance DB to `dest` (sqlite backup API).

    Use this before any risky migration or as a durable governance snapshot —
    NEVER 'reset' governance state by deleting the DB (D6).
    """
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    src = connect()
    try:
        out = sqlite3.connect(dest)
        try:
            src.backup(out)
        finally:
            out.close()
    finally:
        src.close()
    return dest


def add_assignment(conn, *, id, agent, outbox_path, pipeline=None,
                   seed_ref=None, artifact_ref=None, expected_output=None,
                   review_by=None) -> None:
    now = _now()
    conn.execute(
        "INSERT INTO assignments (id, agent, outbox_path, pipeline, seed_ref, "
        "artifact_ref, expected_output, review_by, status, created_at, updated_at) "
        "VALUES (?,?,?,?,?,?,?,?, 'queued', ?, ?)",
        (id, agent, outbox_path, pipeline, seed_ref, artifact_ref,
         expected_output, review_by, now, now),
    )
    conn.commit()


def set_assignment_status(conn, assignment_id, status) -> None:
    if status not in ASSIGNMENT_STATUS:
        raise ValueError(f"invalid assignment status {status!r}")
    now = _now()
    cur = conn.execute(
        "UPDATE assignments SET status=?, updated_at=? WHERE id=?",
        (status, now, assignment_id),
    )
    # Don't write a status event for an assignment that does not exist — this is
    # the durable audit ledger; an orphan event is false history.
    if cur.rowcount != 1:
        conn.rollback()
        raise ValueError(f"unknown assignment {assignment_id!r}")
    append_event(conn, actor="system", verb=f"status:{status}",
                 assignment_id=assignment_id)
    conn.commit()


def append_event(conn, *, actor, verb, assignment_id=None, subsystem=None,
                 subsystem_ref=None, note=None) -> None:
    conn.execute(
        "INSERT INTO events (ts, actor, verb, assignment_id, subsystem, "
        "subsystem_ref, note) VALUES (?,?,?,?,?,?,?)",
        (_now(), actor, verb, assignment_id, subsystem, subsystem_ref, note),
    )
    conn.commit()


def add_review(conn, *, subsystem, subsystem_ref, reviewer, verdict,
               artifact_uid=None, rationale=None) -> None:
    if verdict not in REVIEW_VERDICT:
        raise ValueError(f"invalid verdict {verdict!r}")
    conn.execute(
        "INSERT INTO review_overlay (subsystem, subsystem_ref, artifact_uid, "
        "reviewer, verdict, rationale, ts) VALUES (?,?,?,?,?,?,?)",
        (subsystem, subsystem_ref, artifact_uid, reviewer, verdict,
         rationale, _now()),
    )
    conn.commit()


def list_assignments(conn) -> list[dict]:
    return [dict(r) for r in conn.execute(
        "SELECT * FROM assignments ORDER BY created_at, id")]


def list_events(conn, limit: int = 200) -> list[dict]:
    return [dict(r) for r in conn.execute(
        "SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,))]


def list_events_for_assignment(conn, assignment_id: str) -> list[dict]:
    """All events for one assignment, oldest-first, UNBOUNDED (assignment-scoped
    SQL — no newest-N window). Used by the factory build guards (review 24 L1)."""
    return [dict(r) for r in conn.execute(
        "SELECT * FROM events WHERE assignment_id=? ORDER BY id", (assignment_id,))]
