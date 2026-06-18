"""Unified catalog over all source adapters, persisted in teachingos.db."""
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
    con = connect()
    cur = con.cursor()
    cur.execute("delete from catalog")
    cur.execute("delete from catalog_fts")
    cur.execute("delete from source_summary")
    now = _now()
    totals: dict[str, int] = {}
    for ad in ALL_ADAPTERS:
        avail = ad.available()
        n = 0
        summ: dict = {}
        if avail:
            try:
                summ = ad.summary()
            except Exception as exc:  # noqa: BLE001
                summ = {"error": str(exc)}
            try:
                for art in ad.artifacts():
                    cur.execute(
                        "insert or replace into catalog values(?,?,?,?,?,?,?,?,?,?,?,?)",
                        art.row(),
                    )
                    cur.execute(
                        "insert into catalog_fts(uid,title,subject,chapter,kind,source) "
                        "values(?,?,?,?,?,?)",
                        (art.uid, art.title or "", art.subject or "",
                         art.chapter or "", art.kind or "", art.source),
                    )
                    n += 1
            except Exception as exc:  # noqa: BLE001
                summ.setdefault("error", str(exc))
        cur.execute(
            "insert or replace into source_summary values(?,?,?,?,?,?)",
            (ad.name, ad.label, int(avail),
             json.dumps(summ, ensure_ascii=False), n, now),
        )
        totals[ad.name] = n
        if verbose:
            print(f"  {ad.name:12} available={avail!s:5} artifacts={n:>6}  {summ}")
    cur.execute("insert or replace into refresh_meta values('refreshed_at', ?)", (now,))
    con.commit()
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
