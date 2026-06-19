"""Unified catalog over all source adapters, persisted in samagra.db."""
from __future__ import annotations

import json
import sqlite3
import time

from . import config
from .adapters import ALL_ADAPTERS

SCHEMA = """
create table if not exists catalog(
  uid text primary key, source text, kind text, title text,
  subject text, unit text, chapter text, status text,
  path text, url text, updated_at text, meta_json text);
create table if not exists source_summary(
  source text primary key, label text, available int,
  summary_json text, n_artifacts int, refreshed_at text);
create table if not exists refresh_meta(key text primary key, value text);
create virtual table if not exists catalog_fts using fts5(
  uid unindexed, title, subject, chapter, kind, source);
"""


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def connect() -> sqlite3.Connection:
    config.DATA_DB.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(config.DATA_DB)
    con.executescript(SCHEMA)
    return con


def _fts_query(query: str) -> str:
    """Build a safe FTS5 MATCH expression: prefix-match each alnum token."""
    tokens = ["".join(ch for ch in t if ch.isalnum()) for t in query.split()]
    tokens = [t for t in tokens if t]
    return " ".join(f'"{t}"*' for t in tokens)


def refresh(verbose: bool = True) -> dict:
    """Rebuild the catalog last-known-good safe.

    Each adapter is collected into in-memory staging buffers BEFORE the live
    tables are touched. The live ``catalog``/``catalog_fts``/``source_summary``
    tables are only cleared and repopulated once every available adapter has
    yielded its artifacts without error — the whole swap runs in a single
    transaction. If any adapter raises while producing artifacts, nothing is
    deleted: the previous good catalog survives, the failure is surfaced in the
    returned per-source totals (the source maps to ``None``), and no completed
    ``refreshed_at`` timestamp is written.
    """
    con = connect()
    cur = con.cursor()
    now = _now()

    staged_catalog: list[tuple] = []
    staged_fts: list[tuple] = []
    staged_summary: list[tuple] = []
    totals: dict[str, int | None] = {}
    failures: list[str] = []

    for ad in ALL_ADAPTERS:
        avail = ad.available()
        rows: list[tuple] = []
        fts_rows: list[tuple] = []
        summ: dict = {}
        failed = False
        if avail:
            try:
                summ = ad.summary()
            except Exception as exc:  # noqa: BLE001
                summ = {"error": str(exc)}
            try:
                for art in ad.artifacts():
                    rows.append(art.row())
                    fts_rows.append(
                        (art.uid, art.title or "", art.subject or "",
                         art.chapter or "", art.kind or "", art.source)
                    )
            except Exception as exc:  # noqa: BLE001
                # A failing adapter must NOT poison the live catalog. Record the
                # failure, drop this adapter's partial rows, and continue
                # collecting so the report is complete — but the global refresh
                # is aborted (last-known-good preserved) at the end.
                summ.setdefault("error", str(exc))
                failed = True
                rows = []
                fts_rows = []
        if failed:
            failures.append(ad.name)
            totals[ad.name] = None
        else:
            totals[ad.name] = len(rows)
        staged_catalog.extend(rows)
        staged_fts.extend(fts_rows)
        staged_summary.append(
            (ad.name, ad.label, int(avail),
             json.dumps(summ, ensure_ascii=False),
             0 if failed else len(rows), now)
        )
        if verbose:
            shown = "FAILED" if failed else f"{len(rows):>6}"
            print(f"  {ad.name:12} available={avail!s:5} artifacts={shown}  {summ}")

    if failures:
        # Last-known-good: do not touch the live catalog at all.
        con.rollback()
        con.close()
        if verbose:
            print(f"  refresh ABORTED — adapters failed: {', '.join(failures)}; "
                  "previous catalog preserved")
        return totals

    # All adapters succeeded — swap atomically into the live tables.
    try:
        cur.execute("delete from catalog")
        cur.execute("delete from catalog_fts")
        cur.execute("delete from source_summary")
        cur.executemany(
            "insert or replace into catalog values(?,?,?,?,?,?,?,?,?,?,?,?)",
            staged_catalog,
        )
        cur.executemany(
            "insert into catalog_fts(uid,title,subject,chapter,kind,source) "
            "values(?,?,?,?,?,?)",
            staged_fts,
        )
        cur.executemany(
            "insert or replace into source_summary values(?,?,?,?,?,?)",
            staged_summary,
        )
        cur.execute("insert or replace into refresh_meta values('refreshed_at', ?)", (now,))
        con.commit()
    except Exception:  # noqa: BLE001
        con.rollback()
        con.close()
        raise
    con.close()
    return totals


def overview() -> dict:
    con = connect()
    con.row_factory = sqlite3.Row
    rows = [dict(r) for r in con.execute("select * from source_summary order by source")]
    refreshed = con.execute(
        "select value from refresh_meta where key='refreshed_at'"
    ).fetchone()
    con.close()
    for r in rows:
        try:
            r["summary"] = json.loads(r["summary_json"])
        except Exception:  # noqa: BLE001
            r["summary"] = {}
    return {"sources": rows, "refreshed_at": refreshed[0] if refreshed else None}


def search(query: str = "", source: str | None = None,
           kind: str | None = None, limit: int = 100) -> list[dict]:
    con = connect()
    con.row_factory = sqlite3.Row
    args: list = []
    match = _fts_query(query) if query else ""
    if match:
        sql = ("select c.* from catalog_fts f join catalog c on c.uid=f.uid "
               "where catalog_fts match ?")
        args.append(match)
    else:
        sql = "select * from catalog c where 1=1"
    if source:
        sql += " and c.source=?"
        args.append(source)
    if kind:
        sql += " and c.kind=?"
        args.append(kind)
    sql += " limit ?"
    args.append(limit)
    rows = [dict(r) for r in con.execute(sql, args)]
    con.close()
    for r in rows:
        try:
            r["meta"] = json.loads(r["meta_json"])
        except Exception:  # noqa: BLE001
            r["meta"] = {}
    return rows


def facets() -> dict:
    """Distinct sources / kinds / subjects for portal filters."""
    con = connect()
    out = {
        "sources": [r[0] for r in con.execute(
            "select distinct source from catalog order by 1")],
        "kinds": [r[0] for r in con.execute(
            "select distinct kind from catalog order by 1")],
        "subjects": [r[0] for r in con.execute(
            "select distinct subject from catalog where subject is not null order by 1")],
    }
    con.close()
    return out
