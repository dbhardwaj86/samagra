"""concept_graph.db — the rebuildable, read-only derived coverage DB.

Phase E populates: graph_meta, concept, concept_chapter, coverage_cell, gap_seed.
The spec's artifact / concept_artifact node tables are created but reserved for
Phase F (Tier-2/3). A full rebuild REPLACES all rows (idempotent).
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

from ... import config
from . import matrix

_SCHEMA = """
CREATE TABLE IF NOT EXISTS graph_meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS concept (
  concept_id INTEGER PRIMARY KEY, label TEXT NOT NULL, chapter_id TEXT,
  demand_size INTEGER NOT NULL, paper_count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS concept_chapter (
  concept_id INTEGER NOT NULL, chapter_slug TEXT NOT NULL, source TEXT NOT NULL,
  score REAL, PRIMARY KEY (concept_id, chapter_slug));
CREATE TABLE IF NOT EXISTS coverage_cell (
  concept_id INTEGER NOT NULL, lane TEXT NOT NULL, state TEXT NOT NULL,
  produced_n INTEGER NOT NULL DEFAULT 0, base_n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (concept_id, lane));
CREATE TABLE IF NOT EXISTS gap_seed (
  rank INTEGER PRIMARY KEY, concept_id INTEGER NOT NULL, lane TEXT NOT NULL,
  cell_state TEXT NOT NULL, demand_size INTEGER NOT NULL,
  existing_corpus_n INTEGER NOT NULL, deficit_score REAL NOT NULL,
  suggested_seed_ref TEXT NOT NULL, plan_command TEXT NOT NULL);
-- Phase F (schema reserved): per-artifact node/edge graph.
CREATE TABLE IF NOT EXISTS artifact (
  uid TEXT PRIMARY KEY, source TEXT, kind TEXT, content_type TEXT,
  seed_ref TEXT, chapter_slug TEXT);
CREATE TABLE IF NOT EXISTS concept_artifact (
  concept_id INTEGER NOT NULL, artifact_uid TEXT NOT NULL, relation TEXT NOT NULL,
  source TEXT NOT NULL, score REAL,
  PRIMARY KEY (concept_id, artifact_uid, relation));
"""

_TABLES = ["graph_meta", "concept", "concept_chapter", "coverage_cell", "gap_seed"]


def connect(db_path: Path | None = None) -> sqlite3.Connection:
    path = Path(db_path) if db_path is not None else config.CONCEPT_GRAPH_DB
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    return con


def connect_ro(db_path: Path | None = None) -> sqlite3.Connection:
    path = Path(db_path) if db_path is not None else config.CONCEPT_GRAPH_DB
    if not path.exists():
        raise FileNotFoundError(path)
    con = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    return con


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(_SCHEMA)
    conn.commit()


def write_graph(conn, *, concepts, chapter_edges, cells, gaps, meta) -> None:
    for t in _TABLES:
        conn.execute(f"DELETE FROM {t}")
    conn.executemany(
        "INSERT INTO concept VALUES (?,?,?,?,?)",
        [(c["concept_id"], c["label"], c["chapter_id"], c["demand_size"], c["paper_count"])
         for c in concepts])
    conn.executemany(
        "INSERT OR REPLACE INTO concept_chapter VALUES (?,?,?,?)",
        [(e["concept_id"], e["slug"], e["source"], e["score"]) for e in chapter_edges])
    conn.executemany(
        "INSERT INTO coverage_cell VALUES (?,?,?,?,?)",
        [(c["concept_id"], c["lane"], c["state"], c["produced_n"], c["base_n"]) for c in cells])
    conn.executemany(
        "INSERT INTO gap_seed VALUES (?,?,?,?,?,?,?,?,?)",
        [(g["rank"], g["concept_id"], g["lane"], g["cell_state"], g["demand_size"],
          g["existing_corpus_n"], g["deficit_score"], g["suggested_seed_ref"],
          g["plan_command"]) for g in gaps])
    conn.executemany("INSERT OR REPLACE INTO graph_meta VALUES (?,?)",
                     [(k, str(v)) for k, v in (meta or {}).items()])
    conn.commit()


def coverage_payload(conn) -> dict:
    return {
        "lanes": matrix.COVERAGE_LANES,
        "concepts": [dict(r) for r in conn.execute(
            "SELECT * FROM concept ORDER BY chapter_id, label")],
        "cells": [dict(r) for r in conn.execute("SELECT * FROM coverage_cell")],
        "gaps": [dict(r) for r in conn.execute("SELECT * FROM gap_seed ORDER BY rank")],
        "meta": {r["key"]: r["value"] for r in conn.execute("SELECT * FROM graph_meta")},
    }


def list_gaps(conn, top: int | None = None, lane: str | None = None) -> list[dict]:
    sql, args = "SELECT * FROM gap_seed", []
    if lane:
        sql += " WHERE lane=?"
        args.append(lane)
    sql += " ORDER BY rank"
    if top:
        sql += " LIMIT ?"
        args.append(top)
    return [dict(r) for r in conn.execute(sql, args)]


def concept_dossier(conn, concept_id: int) -> dict | None:
    row = conn.execute("SELECT * FROM concept WHERE concept_id=?", (concept_id,)).fetchone()
    if row is None:
        return None
    d = dict(row)
    d["chapters"] = [r["chapter_slug"] for r in conn.execute(
        "SELECT chapter_slug FROM concept_chapter WHERE concept_id=? ORDER BY score DESC",
        (concept_id,))]
    d["cells"] = [dict(r) for r in conn.execute(
        "SELECT * FROM coverage_cell WHERE concept_id=?", (concept_id,))]
    d["gaps"] = [dict(r) for r in conn.execute(
        "SELECT * FROM gap_seed WHERE concept_id=? ORDER BY rank", (concept_id,))]
    return d
