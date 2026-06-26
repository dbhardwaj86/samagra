# Phase E — Coverage Graph & Concept Atlas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build SAMAGRA's read-only STEERING layer — a rebuildable `concept_graph.db` that maps the 86 QX physics concepts × the 6 producible factory lanes into a 3-state coverage matrix, ranks every unproduced cell into a deficit-weighted demand queue, and surfaces it as a read-only `GET /api/coverage` endpoint + a React "Atlas" app in SAMAGRA OS.

**Architecture:** A new pure, read-only Python package `samagra/factory/coverage/` derives `concept_graph.db` (a gitignored sibling of `samagra.db`) from three read-only sources — QX `builder.sqlite` (concept spine + demand + paper counts), the 59 `content.json` chapters (FTS edges), and the governance `assignments` ledger (factory-produced coverage) — merged with a git-committed `concept_aliases.json` overlay. The factory acts on gaps only through the EXISTING `samagra factory plan … --lane …` CLI, so the entire web surface stays read-only and the publish gate is untouched.

**Tech Stack:** Python 3 / sqlite3 (FTS5) / FastAPI (read GET routes) · React + TypeScript + Vitest (the Atlas app) · pytest (backend TDD).

**Spec:** `docs/superpowers/specs/2026-06-26-samagra-content-factory-phase-e-coverage-graph-design.md`

---

## Conventions for every task

- **TDD:** write the test, run it, watch it FAIL, write minimal code, run it, watch it PASS, commit.
- **Run backend tests:** `python -m pytest tests/test_coverage_<x>.py -v` (from repo root, venv active).
- **Run frontend tests:** `cd frontend && npx vitest run src/<path>` .
- **Every git commit message ends with the trailer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (omitted from the `-m` examples below for brevity — add it).
- **Branch:** all work lands on `feature/content-factory-phase-e` (already created; the spec is committed there).
- **The lone pre-existing red** `tests/test_gdocs.py` (missing Google libs) is unrelated — ignore it; do not "fix" it.

## Canonical data shapes (used across tasks — keep these EXACT)

```python
# concept dict
{"concept_id": int, "label": str, "chapter_id": str, "demand_size": int, "paper_count": int}
# chapter↔concept edge dict
{"concept_id": int, "slug": str, "score": float, "source": "fts" | "overlay-add"}
# coverage cell dict
{"concept_id": int, "lane": str, "state": "produced"|"base"|"gap", "produced_n": int, "base_n": int}
# gap-seed dict (rank added by ranker)
{"rank": int, "concept_id": int, "lane": str, "cell_state": "base"|"gap",
 "demand_size": int, "existing_corpus_n": int, "deficit_score": float,
 "suggested_seed_ref": str, "plan_command": str}
```

Lane constants (define once in `matrix.py`, import elsewhere):
```python
COVERAGE_LANES = ["revision", "lecture", "deck", "paper", "drill", "samadhan"]
PAPER_LANES = {"paper", "drill"}          # base depth = concept.paper_count
CHAPTER_LANES = {"revision", "lecture", "deck"}   # base depth = # chapters edging the concept
# samadhan: no source equivalent → base depth always 0
```

## File structure

| File | Responsibility |
|---|---|
| `samagra/config.py` (modify) | add `CONCEPT_GRAPH_DB`, `CONCEPT_ALIASES` |
| `.gitignore` (modify) | ignore `concept_graph.db` |
| `concept_aliases.json` (create, committed) | the curated normalization overlay |
| `samagra/factory/coverage/__init__.py` (create) | package + convenience wrappers (`build_concept_graph`, `coverage_payload`, `list_gaps`, `concept_dossier`) |
| `samagra/factory/coverage/concepts.py` (create) | read QX `builder.sqlite` read-only → physics concepts + demand + paper_count |
| `samagra/factory/coverage/aliases.py` (create) | load + resolve `concept_aliases.json` (label→id, validation) |
| `samagra/factory/coverage/edges.py` (create) | chapter text, FTS5 chapter↔concept edges, overlay apply, best-chapter, factory-produced counts |
| `samagra/factory/coverage/matrix.py` (create) | lane constants + 3-state coverage cells |
| `samagra/factory/coverage/gaps.py` (create) | deficit-weighted ranker → gap-seed queue |
| `samagra/factory/coverage/store.py` (create) | `concept_graph.db` schema + connect/connect_ro + write + read helpers |
| `samagra/factory/coverage/build.py` (create) | orchestrate the full idempotent rebuild |
| `samagra/__main__.py` (modify) | CLI verbs `coverage-build`, `coverage`, `gaps` |
| `samagra/api/app.py` (modify) | `GET /api/coverage`, `GET /api/coverage/concept/{id}` |
| `frontend/src/types/contracts.ts` (modify) | add `"atlas"` to `AppId` + coverage response types |
| `frontend/src/registry.ts` (modify) | register the Atlas app |
| `frontend/src/lib/atlas/heatmap.ts` (create) | pure: build heatmap communities/rows + state colours |
| `frontend/src/apps/Atlas/index.tsx` (create) | the Atlas app (heatmap + dossier + gap queue) |

---

### Task 1: Config, gitignore, and the committed overlay

**Files:**
- Modify: `samagra/config.py` (after the `STYLESEED_DIR` block, ~line 102)
- Modify: `.gitignore`
- Create: `concept_aliases.json`
- Test: `tests/test_coverage_config.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_coverage_config.py
import json
from samagra import config


def test_concept_graph_paths_defined():
    assert config.CONCEPT_GRAPH_DB.name == "concept_graph.db"
    assert config.CONCEPT_GRAPH_DB.parent == config.REPO_ROOT
    assert config.CONCEPT_ALIASES.name == "concept_aliases.json"


def test_concept_aliases_file_is_valid_overlay():
    data = json.loads(config.CONCEPT_ALIASES.read_text(encoding="utf-8"))
    assert data["version"] == 1
    assert isinstance(data["by_chapter"], dict)
    for slug, delta in data["by_chapter"].items():
        assert set(delta) <= {"add", "remove"}
        assert isinstance(delta.get("add", []), list)
        assert isinstance(delta.get("remove", []), list)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_coverage_config.py -v`
Expected: FAIL — `AttributeError: module 'samagra.config' has no attribute 'CONCEPT_GRAPH_DB'`

- [ ] **Step 3: Add the config constants**

In `samagra/config.py`, immediately after the `STYLESEED_DIR = REPO_ROOT / "styleseed"` line:

```python
# Coverage graph (Phase E): REBUILDABLE derived DB, a sibling of DATA_DB and
# gitignored — it may be deleted and rebuilt at will (never a governance reset).
CONCEPT_GRAPH_DB = REPO_ROOT / "concept_graph.db"
# The curated chapter<->concept normalization overlay — git-COMMITTED (the human
# review surface, like styleseed/). Deltas merged onto the deterministic FTS base.
CONCEPT_ALIASES = REPO_ROOT / "concept_aliases.json"
```

- [ ] **Step 4: Create the committed overlay file**

`concept_aliases.json` (repo root):
```json
{
  "version": 1,
  "note": "Curated chapter<->concept normalization. Deltas applied ON TOP of the deterministic FTS base. by_chapter is keyed on textbook chapter slug; add/remove values are QX physics concept labels (case-insensitive).",
  "by_chapter": {
    "lom-and-pseudo-force": { "add": ["newton's laws"], "remove": [] }
  }
}
```

- [ ] **Step 5: Ignore the rebuildable DB**

Append to `.gitignore` (next to the existing `samagra.db` entry):
```
concept_graph.db
```

- [ ] **Step 6: Run test to verify it passes**

Run: `python -m pytest tests/test_coverage_config.py -v`
Expected: PASS (both tests)

- [ ] **Step 7: Commit**

```bash
git add samagra/config.py .gitignore concept_aliases.json tests/test_coverage_config.py
git commit -m "feat(coverage): Phase E config paths + committed concept_aliases overlay"
```

---

### Task 2: `concepts.py` — read the QX physics concept spine

**Files:**
- Create: `samagra/factory/coverage/__init__.py` (empty for now)
- Create: `samagra/factory/coverage/concepts.py`
- Test: `tests/test_coverage_concepts.py`

The verified join (builder.sqlite only): `concept ⋈ question_concept ⋈ search_index.slug`, filtered `chapter_id LIKE 'physics.%'`, gives demand (`size`) + distinct-paper count.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_coverage_concepts.py
import sqlite3
from samagra.factory.coverage import concepts


def _make_builder(path):
    con = sqlite3.connect(path)
    con.executescript(
        "CREATE TABLE concept(id INTEGER PRIMARY KEY, subject TEXT, chapter_id TEXT,"
        " label TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, built_at TEXT NOT NULL);"
        "CREATE TABLE question_concept(q_uid TEXT, concept_id INTEGER, score REAL,"
        " PRIMARY KEY(q_uid, concept_id));"
        "CREATE TABLE search_index(q_uid TEXT PRIMARY KEY, slug TEXT NOT NULL);"
    )
    con.executemany("INSERT INTO concept VALUES (?,?,?,?,?,?)", [
        (226, "physics", "physics.alternating_currents", "ac circuits", 173, "t"),
        (242, "physics", "physics.current_electricity", "kirchhoff's laws", 616, "t"),
        (999, "chemistry", "chemistry.organic_chemistry", "alkanes", 50, "t"),
    ])
    con.executemany("INSERT INTO question_concept VALUES (?,?,?)", [
        ("paperA-q01", 226, 0.5), ("paperA-q02", 226, 0.4), ("paperB-q01", 226, 0.3),
        ("paperA-q03", 242, 0.5),
    ])
    con.executemany("INSERT INTO search_index VALUES (?,?)", [
        ("paperA-q01", "paperA"), ("paperA-q02", "paperA"),
        ("paperB-q01", "paperB"), ("paperA-q03", "paperA"),
    ])
    con.commit()
    con.close()


def test_loads_physics_concepts_with_demand_and_paper_count(tmp_path):
    db = tmp_path / "builder.sqlite"
    _make_builder(db)
    rows = concepts.load_physics_concepts(db)

    assert {r["label"] for r in rows} == {"ac circuits", "kirchhoff's laws"}  # chemistry excluded
    by_id = {r["concept_id"]: r for r in rows}
    assert by_id[226]["demand_size"] == 173
    assert by_id[226]["paper_count"] == 2   # paperA + paperB
    assert by_id[226]["chapter_id"] == "physics.alternating_currents"
    assert by_id[242]["paper_count"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_coverage_concepts.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'samagra.factory.coverage'`

- [ ] **Step 3: Create the package + module**

`samagra/factory/coverage/__init__.py`:
```python
"""Phase E — the coverage graph (read-only STEERING layer)."""
```

`samagra/factory/coverage/concepts.py`:
```python
"""Read the QX concept spine from builder.sqlite — READ-ONLY (the firewall holds).

The canonical physics concepts (`chapter_id LIKE 'physics.%'`) with their demand
signal (`concept.size`) and the distinct-paper count (paper/drill base depth),
derived purely from builder.sqlite via question_concept -> search_index.slug.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

from ... import config

_SQL = """
SELECT c.id AS concept_id, c.label AS label, c.chapter_id AS chapter_id,
       c.size AS demand_size, COUNT(DISTINCT si.slug) AS paper_count
FROM concept c
LEFT JOIN question_concept qc ON qc.concept_id = c.id
LEFT JOIN search_index si ON si.q_uid = qc.q_uid
WHERE c.chapter_id LIKE 'physics.%'
GROUP BY c.id
ORDER BY c.chapter_id, c.label
"""


def load_physics_concepts(db_path: Path | None = None) -> list[dict]:
    path = Path(db_path) if db_path is not None else config.QX_BUILDER_DB
    con = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in con.execute(_SQL)]
    finally:
        con.close()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_coverage_concepts.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/coverage/__init__.py samagra/factory/coverage/concepts.py tests/test_coverage_concepts.py
git commit -m "feat(coverage): read QX physics concept spine (demand + paper count) read-only"
```

---

### Task 3: `aliases.py` — load + resolve the overlay

**Files:**
- Create: `samagra/factory/coverage/aliases.py`
- Test: `tests/test_coverage_aliases.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_coverage_aliases.py
import json
import pytest
from samagra.factory.coverage import aliases

CONCEPTS = [
    {"concept_id": 226, "label": "ac circuits"},
    {"concept_id": 873, "label": "newton's laws"},
    {"concept_id": 587, "label": "friction"},
]


def test_resolve_overlay_maps_labels_to_ids():
    overlay = {"by_chapter": {
        "lom-and-pseudo-force": {"add": ["newton's laws", "FRICTION"], "remove": []},
        "circular-motion": {"add": [], "remove": ["ac circuits"]},
    }}
    resolved = aliases.resolve_overlay(overlay, CONCEPTS)
    assert resolved["lom-and-pseudo-force"]["add"] == {873, 587}   # case-insensitive
    assert resolved["circular-motion"]["remove"] == {226}


def test_unknown_label_is_a_hard_error():
    overlay = {"by_chapter": {"x": {"add": ["no such concept"], "remove": []}}}
    with pytest.raises(ValueError, match="unknown concept label"):
        aliases.resolve_overlay(overlay, CONCEPTS)


def test_load_overlay_reads_json(tmp_path):
    p = tmp_path / "concept_aliases.json"
    p.write_text(json.dumps({"version": 1, "by_chapter": {}}), encoding="utf-8")
    assert aliases.load_overlay(p) == {"version": 1, "by_chapter": {}}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_coverage_aliases.py -v`
Expected: FAIL — `ModuleNotFoundError: ... coverage.aliases`

- [ ] **Step 3: Create the module**

`samagra/factory/coverage/aliases.py`:
```python
"""Load + resolve the git-committed chapter<->concept normalization overlay.

`by_chapter[slug] = {"add": [labels], "remove": [labels]}` — `add` forces an edge,
`remove` drops an FTS-base edge. Labels resolve to QX concept ids (case-insensitive);
an unresolvable label is a HARD build error (catches typos at the review surface).
"""
from __future__ import annotations

import json
from pathlib import Path

from ... import config


def load_overlay(path: Path | None = None) -> dict:
    p = Path(path) if path is not None else config.CONCEPT_ALIASES
    return json.loads(p.read_text(encoding="utf-8"))


def resolve_overlay(overlay: dict, concepts: list[dict]) -> dict:
    by_label = {c["label"].lower(): c["concept_id"] for c in concepts}
    resolved: dict[str, dict] = {}
    for slug, delta in (overlay.get("by_chapter") or {}).items():
        out = {"add": set(), "remove": set()}
        for key in ("add", "remove"):
            for label in (delta.get(key) or []):
                cid = by_label.get(str(label).lower())
                if cid is None:
                    raise ValueError(
                        f"concept_aliases.json: unknown concept label {label!r} "
                        f"for chapter {slug!r}")
                out[key].add(cid)
        resolved[slug] = out
    return resolved
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_coverage_aliases.py -v`
Expected: PASS (all 3)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/coverage/aliases.py tests/test_coverage_aliases.py
git commit -m "feat(coverage): load + resolve the concept_aliases merge-overlay"
```

---

### Task 4: `edges.py` part 1 — chapter text extraction

**Files:**
- Create: `samagra/factory/coverage/edges.py`
- Test: `tests/test_coverage_edges.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_coverage_edges.py
from samagra.factory.coverage import edges


def test_chapter_text_concatenates_title_sections_prose():
    chapter = {
        "title": "Circular Motion",
        "sections": [
            {"title": "Centripetal acceleration", "blocks": [
                {"type": "prose", "html": "<p>The body moves in a <b>circle</b>.</p>"},
                {"type": "equation", "html": "$$a=v^2/r$$"},
                {"type": "callout", "variant": "note", "html": "<p>Key idea here.</p>"},
            ]},
        ],
    }
    text = edges.chapter_text(chapter)
    assert "Circular Motion" in text
    assert "Centripetal acceleration" in text
    assert "The body moves in a circle." in text   # html stripped
    assert "Key idea here." in text                 # callout included
    assert "<p>" not in text                         # tags gone
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_coverage_edges.py::test_chapter_text_concatenates_title_sections_prose -v`
Expected: FAIL — `ModuleNotFoundError: ... coverage.edges`

- [ ] **Step 3: Create the module with `chapter_text`**

`samagra/factory/coverage/edges.py`:
```python
"""Tier-1 structural edges for the coverage graph.

- chapter_text: flatten a chapter to a searchable text blob.
- build_chapter_concept_edges: FTS5 concept-label matches over the chapter blobs.
- apply_overlay: merge the curated add/remove deltas onto the FTS base.
- best_chapter_by_concept: the strongest-edge chapter (the gap-seed pointer).
- factory_produced_counts: captured factory artifacts per (concept, lane).
"""
from __future__ import annotations

import sqlite3

from ..style import text as T

_TEXT_BLOCKS = {"prose", "callout", "subheading"}


def chapter_text(chapter: dict) -> str:
    parts = [chapter.get("title", "") or ""]
    for sec in chapter.get("sections", []) or []:
        parts.append(sec.get("title", "") or "")
        for b in sec.get("blocks", []) or []:
            if b.get("type") in _TEXT_BLOCKS:
                parts.append(T.strip_html(b.get("html", "")))
    return " ".join(p for p in parts if p)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_coverage_edges.py::test_chapter_text_concatenates_title_sections_prose -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/coverage/edges.py tests/test_coverage_edges.py
git commit -m "feat(coverage): chapter text flattener for FTS edges"
```

---

### Task 5: `edges.py` part 2 — FTS5 chapter↔concept edges + overlay + best-chapter

**Files:**
- Modify: `samagra/factory/coverage/edges.py`
- Test: `tests/test_coverage_edges.py` (add)

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_coverage_edges.py`:
```python
CHAPTER_TEXTS = {
    "circular-motion": "Circular Motion centripetal acceleration uniform circular motion",
    "gauss-law": "Gauss Law electric flux through a closed surface",
    "lom-and-pseudo-force": "Pseudo forces in non inertial frames and free body diagrams",
}
CONCEPTS = [
    {"concept_id": 1, "label": "circular motion"},
    {"concept_id": 2, "label": "gauss's law"},
    {"concept_id": 3, "label": "newton's laws"},   # NOT in any chapter text -> needs overlay
]


def test_fts_edges_match_obvious_chapters():
    e = edges.build_chapter_concept_edges(CHAPTER_TEXTS, CONCEPTS)
    pairs = {(x["concept_id"], x["slug"]) for x in e}
    assert (1, "circular-motion") in pairs
    assert (2, "gauss-law") in pairs
    assert all(x["source"] == "fts" for x in e)
    assert (3, "lom-and-pseudo-force") not in pairs   # 'newton's laws' not in the text


def test_overlay_adds_and_removes_edges():
    base = edges.build_chapter_concept_edges(CHAPTER_TEXTS, CONCEPTS)
    resolved = {
        "lom-and-pseudo-force": {"add": {3}, "remove": set()},
        "circular-motion": {"add": set(), "remove": {1}},
    }
    merged = edges.apply_overlay(base, resolved)
    pairs = {(x["concept_id"], x["slug"]) for x in merged}
    assert (3, "lom-and-pseudo-force") in pairs                      # added
    assert next(x for x in merged if x["concept_id"] == 3)["source"] == "overlay-add"
    assert (1, "circular-motion") not in pairs                       # removed


def test_best_chapter_picks_highest_score():
    edges_in = [
        {"concept_id": 1, "slug": "a", "score": 1.0, "source": "fts"},
        {"concept_id": 1, "slug": "b", "score": 5.0, "source": "fts"},
    ]
    assert edges.best_chapter_by_concept(edges_in) == {1: "b"}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_coverage_edges.py -v`
Expected: FAIL — `AttributeError: module ... has no attribute 'build_chapter_concept_edges'`

- [ ] **Step 3: Add the FTS matcher, overlay merge, and best-chapter**

Append to `samagra/factory/coverage/edges.py`:
```python
def _fts_tokens(s: str) -> list[str]:
    toks = ["".join(ch for ch in t if ch.isalnum()) for t in (s or "").lower().split()]
    return [t for t in toks if t]


def build_chapter_concept_edges(chapter_texts: dict, concepts: list[dict]) -> list[dict]:
    """One in-memory FTS5 table of chapters; AND-prefix-match each concept label.
    score = -bm25 (higher = stronger). Deterministic for fixed inputs."""
    con = sqlite3.connect(":memory:")
    con.execute("CREATE VIRTUAL TABLE ch USING fts5(slug UNINDEXED, body)")
    con.executemany("INSERT INTO ch(slug, body) VALUES (?,?)",
                    list(chapter_texts.items()))
    out: list[dict] = []
    try:
        for c in concepts:
            toks = _fts_tokens(c["label"])
            if not toks:
                continue
            match = " ".join(f'"{t}"*' for t in toks)
            for slug, bm25 in con.execute(
                    "SELECT slug, bm25(ch) FROM ch WHERE ch MATCH ? ORDER BY bm25(ch)",
                    (match,)):
                out.append({"concept_id": c["concept_id"], "slug": slug,
                            "score": T.round4(-float(bm25)), "source": "fts"})
    finally:
        con.close()
    return out


def apply_overlay(base_edges: list[dict], resolved_overlay: dict) -> list[dict]:
    kept = [e for e in base_edges
            if e["concept_id"] not in resolved_overlay.get(e["slug"], {}).get("remove", set())]
    have = {(e["concept_id"], e["slug"]) for e in kept}
    for slug, delta in resolved_overlay.items():
        for cid in delta.get("add", set()):
            if (cid, slug) not in have:
                kept.append({"concept_id": cid, "slug": slug,
                             "score": 999.0, "source": "overlay-add"})
                have.add((cid, slug))
    return kept


def best_chapter_by_concept(edges: list[dict]) -> dict:
    best: dict[int, str] = {}
    for e in sorted(edges, key=lambda x: -x["score"]):
        best.setdefault(e["concept_id"], e["slug"])
    return best
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_coverage_edges.py -v`
Expected: PASS (all edge tests)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/coverage/edges.py tests/test_coverage_edges.py
git commit -m "feat(coverage): FTS5 chapter<->concept edges + overlay merge + best-chapter"
```

---

### Task 6: `edges.py` part 3 — factory-produced counts from governance

**Files:**
- Modify: `samagra/factory/coverage/edges.py`
- Test: `tests/test_coverage_edges.py` (add)

- [ ] **Step 1: Write the failing test**

Add to `tests/test_coverage_edges.py`:
```python
def test_factory_produced_counts_from_captured_assignments():
    chapter_edges = [
        {"concept_id": 1, "slug": "circular-motion", "score": 1.0, "source": "fts"},
        {"concept_id": 9, "slug": "circular-motion", "score": 1.0, "source": "fts"},
    ]
    assignments = [
        {"pipeline": "deck", "seed_ref": "textbook:circular-motion", "status": "captured"},
        {"pipeline": "deck", "seed_ref": "textbook:circular-motion", "status": "in-review"},  # not captured
        {"pipeline": "paper", "seed_ref": "munshi:52", "status": "captured"},                  # not textbook
        {"pipeline": "drill", "seed_ref": "textbook:gauss-law", "status": "captured"},         # no edge
    ]
    produced = edges.factory_produced_counts(assignments, chapter_edges)
    assert produced[(1, "deck")] == 1   # concept 1 + concept 9 both inherit the captured deck
    assert produced[(9, "deck")] == 1
    assert (1, "paper") not in produced
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_coverage_edges.py::test_factory_produced_counts_from_captured_assignments -v`
Expected: FAIL — `AttributeError: ... 'factory_produced_counts'`

- [ ] **Step 3: Add the function**

Append to `samagra/factory/coverage/edges.py`:
```python
def factory_produced_counts(assignments: list[dict], chapter_edges: list[dict]) -> dict:
    """(concept_id, lane) -> # captured factory artifacts. A captured assignment with
    seed_ref 'textbook:<slug>' counts toward every concept that <slug> edges to."""
    slug_concepts: dict[str, set] = {}
    for e in chapter_edges:
        slug_concepts.setdefault(e["slug"], set()).add(e["concept_id"])
    out: dict[tuple, int] = {}
    for a in assignments:
        if a.get("status") != "captured":
            continue
        seed = a.get("seed_ref") or ""
        if not seed.startswith("textbook:"):
            continue
        slug = seed.split(":", 1)[1]
        lane = a.get("pipeline")
        for cid in slug_concepts.get(slug, ()):
            out[(cid, lane)] = out.get((cid, lane), 0) + 1
    return out
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_coverage_edges.py -v`
Expected: PASS (all edge tests)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/coverage/edges.py tests/test_coverage_edges.py
git commit -m "feat(coverage): factory-produced coverage counts from captured assignments"
```

---

### Task 7: `matrix.py` — the 3-state coverage cells

**Files:**
- Create: `samagra/factory/coverage/matrix.py`
- Test: `tests/test_coverage_matrix.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_coverage_matrix.py
from samagra.factory.coverage import matrix


def test_cells_are_3_state_per_lane():
    concepts = [{"concept_id": 1, "label": "x", "chapter_id": "physics.optics",
                 "demand_size": 100, "paper_count": 7}]
    chapter_edges = [{"concept_id": 1, "slug": "optics", "score": 1.0, "source": "fts"}]
    produced = {(1, "deck"): 1}   # a captured factory deck

    cells = matrix.build_cells(concepts, chapter_edges, produced)
    by_lane = {c["lane"]: c for c in cells}

    assert set(by_lane) == set(matrix.COVERAGE_LANES)
    assert by_lane["deck"]["state"] == "produced"            # factory artifact
    assert by_lane["lecture"]["state"] == "base"             # chapter edge, not produced
    assert by_lane["lecture"]["base_n"] == 1
    assert by_lane["paper"]["state"] == "base"               # paper_count > 0
    assert by_lane["paper"]["base_n"] == 7
    assert by_lane["samadhan"]["state"] == "gap"             # no source equivalent
    assert by_lane["samadhan"]["base_n"] == 0


def test_no_chapter_edge_makes_chapter_lanes_a_gap():
    concepts = [{"concept_id": 5, "label": "y", "chapter_id": "physics.misc",
                 "demand_size": 10, "paper_count": 0}]
    cells = matrix.build_cells(concepts, chapter_edges=[], produced={})
    by_lane = {c["lane"]: c for c in cells}
    assert by_lane["lecture"]["state"] == "gap"
    assert by_lane["paper"]["state"] == "gap"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_coverage_matrix.py -v`
Expected: FAIL — `ModuleNotFoundError: ... coverage.matrix`

- [ ] **Step 3: Create the module**

`samagra/factory/coverage/matrix.py`:
```python
"""The concept x lane coverage matrix — 3 states per cell (produced / base / gap).

Coverage rule (DEC: factory-produced-only): only a captured factory artifact marks
a cell `produced`. `base` = unproduced but a SOURCE provides the base (chapter for
the lecture/revision/deck lanes; QX papers for paper/drill). `gap` = neither.
"""
from __future__ import annotations

COVERAGE_LANES = ["revision", "lecture", "deck", "paper", "drill", "samadhan"]
PAPER_LANES = {"paper", "drill"}
CHAPTER_LANES = {"revision", "lecture", "deck"}


def _base_depth(concept: dict, lane: str, n_chapters: int) -> int:
    if lane in PAPER_LANES:
        return concept["paper_count"]
    if lane in CHAPTER_LANES:
        return n_chapters
    return 0  # samadhan — no source equivalent


def build_cells(concepts: list[dict], chapter_edges: list[dict], produced: dict) -> list[dict]:
    chapters_per_concept: dict[int, set] = {}
    for e in chapter_edges:
        chapters_per_concept.setdefault(e["concept_id"], set()).add(e["slug"])

    cells: list[dict] = []
    for c in concepts:
        cid = c["concept_id"]
        n_ch = len(chapters_per_concept.get(cid, ()))
        for lane in COVERAGE_LANES:
            pn = produced.get((cid, lane), 0)
            base_n = _base_depth(c, lane, n_ch)
            state = "produced" if pn > 0 else ("base" if base_n > 0 else "gap")
            cells.append({"concept_id": cid, "lane": lane, "state": state,
                          "produced_n": pn, "base_n": base_n})
    return cells
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_coverage_matrix.py -v`
Expected: PASS (both)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/coverage/matrix.py tests/test_coverage_matrix.py
git commit -m "feat(coverage): 3-state (produced/base/gap) concept x lane matrix"
```

---

### Task 8: `gaps.py` — the deficit-weighted demand queue

**Files:**
- Create: `samagra/factory/coverage/gaps.py`
- Test: `tests/test_coverage_gaps.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_coverage_gaps.py
from samagra.factory.coverage import gaps


def test_rank_is_deficit_weighted_and_pointer_preloaded():
    concepts = [
        {"concept_id": 1, "label": "hot", "demand_size": 1000, "paper_count": 0},
        {"concept_id": 2, "label": "saturated", "demand_size": 1000, "paper_count": 99},
    ]
    cells = [
        # concept 1: a true samadhan gap, demand 1000, denom 0 -> deficit 1000
        {"concept_id": 1, "lane": "samadhan", "state": "gap", "produced_n": 0, "base_n": 0},
        # concept 2: a paper base cell, demand 1000, denom 99 -> deficit 10
        {"concept_id": 2, "lane": "paper", "state": "base", "produced_n": 0, "base_n": 99},
        # produced cells are NOT queued
        {"concept_id": 1, "lane": "deck", "state": "produced", "produced_n": 1, "base_n": 1},
    ]
    best_chapter = {1: "thermodynamics", 2: "optics"}

    ranked = gaps.rank_gaps(cells, concepts, best_chapter)

    assert [g["rank"] for g in ranked] == [1, 2]
    assert ranked[0]["concept_id"] == 1                       # higher deficit first
    assert ranked[0]["deficit_score"] == 1000.0
    assert ranked[0]["cell_state"] == "gap"
    assert ranked[0]["suggested_seed_ref"] == "textbook:thermodynamics"
    assert ranked[0]["plan_command"] == \
        "samagra factory plan textbook:thermodynamics --lane samadhan"
    assert ranked[1]["deficit_score"] == 10.0
    assert all(g["lane"] != "deck" for g in ranked)           # produced excluded


def test_concept_without_a_chapter_pointer_is_skipped():
    concepts = [{"concept_id": 7, "label": "z", "demand_size": 5, "paper_count": 0}]
    cells = [{"concept_id": 7, "lane": "samadhan", "state": "gap", "produced_n": 0, "base_n": 0}]
    assert gaps.rank_gaps(cells, concepts, best_chapter={}) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_coverage_gaps.py -v`
Expected: FAIL — `ModuleNotFoundError: ... coverage.gaps`

- [ ] **Step 3: Create the module**

`samagra/factory/coverage/gaps.py`:
```python
"""Rank every UNPRODUCED cell (state in base|gap) into the demand queue.

Default ranker = deficit-weighted: demand_size / (existing_corpus_n + 1). The
existing corpus never marks a cell covered, but it steers priority — a high-demand
concept thin in existing material (e.g. samadhan, denominator 0) floats to the top.
Pure + deterministic; the one seam Phase F enriches (post-use flags / semantic).
"""
from __future__ import annotations

from .matrix import COVERAGE_LANES  # noqa: F401  (kept for lane validation/imports)

_LANE_PRIORITY = {lane: i for i, lane in enumerate(
    ["samadhan", "revision", "deck", "drill", "paper", "lecture"])}


def rank_gaps(cells: list[dict], concepts: list[dict], best_chapter: dict) -> list[dict]:
    demand = {c["concept_id"]: c["demand_size"] for c in concepts}
    items: list[dict] = []
    for cell in cells:
        if cell["state"] == "produced":
            continue
        cid = cell["concept_id"]
        slug = best_chapter.get(cid)
        if not slug:
            continue  # no textbook pointer -> can't pre-load a seed (logged by build)
        d = demand.get(cid, 0)
        ec = cell["base_n"]
        items.append({
            "concept_id": cid, "lane": cell["lane"], "cell_state": cell["state"],
            "demand_size": d, "existing_corpus_n": ec,
            "deficit_score": round(d / (ec + 1), 4),
            "suggested_seed_ref": f"textbook:{slug}",
            "plan_command": f"samagra factory plan textbook:{slug} --lane {cell['lane']}",
        })
    items.sort(key=lambda g: (-g["deficit_score"],
                              _LANE_PRIORITY.get(g["lane"], 99), g["concept_id"]))
    for i, g in enumerate(items, 1):
        g["rank"] = i
    return items
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_coverage_gaps.py -v`
Expected: PASS (both)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/coverage/gaps.py tests/test_coverage_gaps.py
git commit -m "feat(coverage): deficit-weighted gap-seed demand queue ranker"
```

---

### Task 9: `store.py` — concept_graph.db schema + write + read

**Files:**
- Create: `samagra/factory/coverage/store.py`
- Test: `tests/test_coverage_store.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_coverage_store.py
from samagra.factory.coverage import store


def _sample():
    concepts = [{"concept_id": 1, "label": "circular motion",
                 "chapter_id": "physics.laws_of_motion", "demand_size": 100, "paper_count": 7}]
    chapter_edges = [{"concept_id": 1, "slug": "circular-motion", "score": 5.0, "source": "fts"}]
    cells = [{"concept_id": 1, "lane": "samadhan", "state": "gap", "produced_n": 0, "base_n": 0},
             {"concept_id": 1, "lane": "deck", "state": "produced", "produced_n": 1, "base_n": 1}]
    gaps = [{"rank": 1, "concept_id": 1, "lane": "samadhan", "cell_state": "gap",
             "demand_size": 100, "existing_corpus_n": 0, "deficit_score": 100.0,
             "suggested_seed_ref": "textbook:circular-motion",
             "plan_command": "samagra factory plan textbook:circular-motion --lane samadhan"}]
    return concepts, chapter_edges, cells, gaps


def test_write_then_read_payload(tmp_path):
    db = tmp_path / "concept_graph.db"
    concepts, chapter_edges, cells, gaps = _sample()
    conn = store.connect(db)
    try:
        store.init_schema(conn)
        store.write_graph(conn, concepts=concepts, chapter_edges=chapter_edges,
                          cells=cells, gaps=gaps, meta={"concept_count": 1})
    finally:
        conn.close()

    conn = store.connect_ro(db)
    try:
        payload = store.coverage_payload(conn)
        dossier = store.concept_dossier(conn, 1)
        only = store.list_gaps(conn, lane="samadhan")
    finally:
        conn.close()

    assert payload["lanes"] == store.matrix.COVERAGE_LANES
    assert payload["concepts"][0]["paper_count"] == 7
    assert len(payload["cells"]) == 2
    assert payload["gaps"][0]["plan_command"].endswith("--lane samadhan")
    assert dossier["label"] == "circular motion"
    assert dossier["chapters"] == ["circular-motion"]
    assert {c["lane"] for c in dossier["cells"]} == {"samadhan", "deck"}
    assert [g["lane"] for g in only] == ["samadhan"]


def test_write_graph_is_idempotent(tmp_path):
    db = tmp_path / "concept_graph.db"
    concepts, chapter_edges, cells, gaps = _sample()
    for _ in range(2):
        conn = store.connect(db)
        try:
            store.init_schema(conn)
            store.write_graph(conn, concepts=concepts, chapter_edges=chapter_edges,
                              cells=cells, gaps=gaps, meta={"concept_count": 1})
        finally:
            conn.close()
    conn = store.connect_ro(db)
    try:
        assert len(store.coverage_payload(conn)["concepts"]) == 1   # not duplicated
    finally:
        conn.close()


def test_connect_ro_missing_db_raises(tmp_path):
    import pytest
    with pytest.raises(FileNotFoundError):
        store.connect_ro(tmp_path / "nope.db")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_coverage_store.py -v`
Expected: FAIL — `ModuleNotFoundError: ... coverage.store`

- [ ] **Step 3: Create the module**

`samagra/factory/coverage/store.py`:
```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_coverage_store.py -v`
Expected: PASS (all 3)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/coverage/store.py tests/test_coverage_store.py
git commit -m "feat(coverage): concept_graph.db schema + idempotent write + read payloads"
```

---

### Task 10: `build.py` + package convenience wrappers — full rebuild

**Files:**
- Create: `samagra/factory/coverage/build.py`
- Modify: `samagra/factory/coverage/__init__.py`
- Test: `tests/test_coverage_build.py`

- [ ] **Step 1: Write the failing test** (injects all sources; no real DBs/corpus needed)

```python
# tests/test_coverage_build.py
import sqlite3
from samagra.factory import coverage
from samagra.factory.coverage import store


def _builder(path):
    con = sqlite3.connect(path)
    con.executescript(
        "CREATE TABLE concept(id INTEGER PRIMARY KEY, subject TEXT, chapter_id TEXT,"
        " label TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, built_at TEXT NOT NULL);"
        "CREATE TABLE question_concept(q_uid TEXT, concept_id INTEGER, score REAL,"
        " PRIMARY KEY(q_uid, concept_id));"
        "CREATE TABLE search_index(q_uid TEXT PRIMARY KEY, slug TEXT NOT NULL);")
    con.executemany("INSERT INTO concept VALUES (?,?,?,?,?,?)", [
        (1, "physics", "physics.laws_of_motion", "circular motion", 100, "t"),
        (2, "physics", "physics.laws_of_motion", "newton's laws", 200, "t")])
    con.executemany("INSERT INTO question_concept VALUES (?,?,?)",
                    [("pA-q1", 1, 0.5), ("pB-q1", 1, 0.5)])
    con.executemany("INSERT INTO search_index VALUES (?,?)",
                    [("pA-q1", "pA"), ("pB-q1", "pB")])
    con.commit(); con.close()


def test_full_build_writes_a_queryable_graph(tmp_path):
    qx = tmp_path / "builder.sqlite"; _builder(qx)
    graph = tmp_path / "concept_graph.db"
    aliases = tmp_path / "concept_aliases.json"
    aliases.write_text('{"version":1,"by_chapter":'
                       '{"lom-and-pseudo-force":{"add":["newton\'s laws"],"remove":[]}}}',
                       encoding="utf-8")
    chapters = [
        {"slug": "circular-motion", "title": "Circular Motion",
         "sections": [{"title": "uniform circular motion", "blocks": [
             {"type": "prose", "html": "<p>circular motion centripetal</p>"}]}]},
        {"slug": "lom-and-pseudo-force", "title": "Laws of Motion",
         "sections": [{"title": "pseudo force", "blocks": [
             {"type": "prose", "html": "<p>free body diagrams</p>"}]}]},
    ]
    assignments = [{"pipeline": "deck", "seed_ref": "textbook:circular-motion",
                    "status": "captured"}]

    summary = coverage.build_concept_graph(
        qx_db=qx, graph_db=graph, aliases_path=aliases,
        chapters=chapters, assignments=assignments)

    assert summary["concepts"] == 2
    assert summary["gaps"] > 0

    conn = store.connect_ro(graph)
    try:
        payload = store.coverage_payload(conn)
    finally:
        conn.close()
    # concept 1 got a produced deck (state produced); concept 2 mapped via the overlay
    cell = {(c["concept_id"], c["lane"]): c for c in payload["cells"]}
    assert cell[(1, "deck")]["state"] == "produced"
    assert cell[(2, "lecture")]["state"] == "base"   # overlay edge -> chapter base
    # the top gap is pointer-pre-loaded
    assert payload["gaps"][0]["plan_command"].startswith("samagra factory plan textbook:")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_coverage_build.py -v`
Expected: FAIL — `AttributeError: module 'samagra.factory.coverage' has no attribute 'build_concept_graph'`

- [ ] **Step 3: Create `build.py`**

`samagra/factory/coverage/build.py`:
```python
"""Orchestrate a full, idempotent rebuild of concept_graph.db from read-only sources."""
from __future__ import annotations

from pathlib import Path

from ...governance import store as gstore
from . import aliases as aliases_mod
from . import concepts as concepts_mod
from . import edges as edges_mod
from . import gaps as gaps_mod
from . import matrix as matrix_mod
from . import store as store_mod


def build_concept_graph(*, qx_db: Path | None = None, graph_db: Path | None = None,
                        aliases_path: Path | None = None,
                        chapters: list[dict] | None = None,
                        assignments: list[dict] | None = None) -> dict:
    concepts = concepts_mod.load_physics_concepts(qx_db)
    overlay = aliases_mod.load_overlay(aliases_path)
    resolved = aliases_mod.resolve_overlay(overlay, concepts)

    if chapters is None:
        from ..style import extract
        chapters = extract.load_corpus()
    chapter_texts = {ch["slug"]: edges_mod.chapter_text(ch)
                     for ch in chapters if ch.get("slug")}

    base_edges = edges_mod.build_chapter_concept_edges(chapter_texts, concepts)
    chapter_edges = edges_mod.apply_overlay(base_edges, resolved)
    best = edges_mod.best_chapter_by_concept(chapter_edges)

    if assignments is None:
        conn = gstore.connect_ro()
        try:
            assignments = gstore.list_assignments(conn)
        finally:
            conn.close()
    produced = edges_mod.factory_produced_counts(assignments, chapter_edges)

    cells = matrix_mod.build_cells(concepts, chapter_edges, produced)
    gap_seeds = gaps_mod.rank_gaps(cells, concepts, best)

    conn = store_mod.connect(graph_db)
    try:
        store_mod.init_schema(conn)
        store_mod.write_graph(
            conn, concepts=concepts, chapter_edges=chapter_edges, cells=cells,
            gaps=gap_seeds,
            meta={"concept_count": len(concepts), "chapter_edges": len(chapter_edges),
                  "cells": len(cells), "gaps": len(gap_seeds)})
    finally:
        conn.close()

    return {"concepts": len(concepts), "chapter_edges": len(chapter_edges),
            "cells": len(cells), "gaps": len(gap_seeds)}
```

- [ ] **Step 4: Add package convenience wrappers**

Replace `samagra/factory/coverage/__init__.py` with:
```python
"""Phase E — the coverage graph (read-only STEERING layer)."""
from __future__ import annotations

from pathlib import Path

from . import store
from .build import build_concept_graph

__all__ = ["build_concept_graph", "coverage_payload", "list_gaps", "concept_dossier"]


def coverage_payload(graph_db: Path | None = None) -> dict:
    conn = store.connect_ro(graph_db)
    try:
        return store.coverage_payload(conn)
    finally:
        conn.close()


def list_gaps(top: int | None = None, lane: str | None = None,
              graph_db: Path | None = None) -> list[dict]:
    conn = store.connect_ro(graph_db)
    try:
        return store.list_gaps(conn, top=top, lane=lane)
    finally:
        conn.close()


def concept_dossier(concept_id: int, graph_db: Path | None = None) -> dict | None:
    conn = store.connect_ro(graph_db)
    try:
        return store.concept_dossier(conn, concept_id)
    finally:
        conn.close()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_coverage_build.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add samagra/factory/coverage/build.py samagra/factory/coverage/__init__.py tests/test_coverage_build.py
git commit -m "feat(coverage): full idempotent concept_graph rebuild orchestrator"
```

---

### Task 11: CLI verbs — `coverage-build`, `coverage`, `gaps`

**Files:**
- Modify: `samagra/__main__.py` — `cmd_factory()` (~line 130) + the `factory` subparser block (~line 333, before `ft.set_defaults`)
- Test: `tests/test_coverage_cli.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_coverage_cli.py
import sqlite3
from samagra.factory.coverage import store


def _seed_graph(db):
    conn = store.connect(db)
    try:
        store.init_schema(conn)
        store.write_graph(
            conn,
            concepts=[{"concept_id": 1, "label": "x", "chapter_id": "physics.optics",
                       "demand_size": 50, "paper_count": 0}],
            chapter_edges=[{"concept_id": 1, "slug": "optics", "score": 1.0, "source": "fts"}],
            cells=[{"concept_id": 1, "lane": "samadhan", "state": "gap",
                    "produced_n": 0, "base_n": 0}],
            gaps=[{"rank": 1, "concept_id": 1, "lane": "samadhan", "cell_state": "gap",
                   "demand_size": 50, "existing_corpus_n": 0, "deficit_score": 50.0,
                   "suggested_seed_ref": "textbook:optics",
                   "plan_command": "samagra factory plan textbook:optics --lane samadhan"}],
            meta={"concept_count": 1})
    finally:
        conn.close()


def test_gaps_cli_prints_ranked_plan_commands(tmp_path, monkeypatch, capsys):
    db = tmp_path / "concept_graph.db"
    _seed_graph(db)
    monkeypatch.setattr("samagra.config.CONCEPT_GRAPH_DB", db, raising=False)

    from samagra.__main__ import main
    main(["factory", "gaps", "--top", "5"])

    out = capsys.readouterr().out
    assert "samagra factory plan textbook:optics --lane samadhan" in out
    assert "#  1" in out or "#1" in out
```

> Note: confirm `samagra/__main__.py` exposes a `main(argv=None)` entry the test can call; if the dispatch lives elsewhere, call it the same way the existing CLI tests do (grep `tests/` for `factory`).

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_coverage_cli.py -v`
Expected: FAIL — argparse `invalid choice: 'gaps'` (the subcommand isn't registered)

- [ ] **Step 3: Register the subparsers**

In `samagra/__main__.py`, in the `factory` subparser block, immediately BEFORE `ft.set_defaults(func=cmd_factory)`:
```python
    ft_sub.add_parser("coverage-build",
                      help="(re)build concept_graph.db (the read-only coverage graph)")
    ft_sub.add_parser("coverage", help="print the concept x lane coverage summary")
    ft_gaps = ft_sub.add_parser("gaps", help="print the ranked gap-seed demand queue")
    ft_gaps.add_argument("--top", type=int, default=20, help="show the top N gaps")
    ft_gaps.add_argument("--lane", default=None, help="filter to a single lane")
```

- [ ] **Step 4: Add the dispatch branches**

In `cmd_factory()`, add these `elif` branches (after the existing factory actions, before the final `else`/end):
```python
    elif args.action == "coverage-build":
        from .factory import coverage
        from . import config
        s = coverage.build_concept_graph()
        print(f"factory coverage-build: {s['concepts']} concepts, "
              f"{s['chapter_edges']} chapter edges, {s['cells']} cells, "
              f"{s['gaps']} gap seeds -> {config.CONCEPT_GRAPH_DB}")
    elif args.action == "coverage":
        from .factory import coverage
        from collections import Counter
        payload = coverage.coverage_payload()
        by_state = Counter(c["state"] for c in payload["cells"])
        print(f"factory coverage: {len(payload['concepts'])} concepts x "
              f"{len(payload['lanes'])} lanes")
        for st in ("produced", "base", "gap"):
            print(f"  {st:9}: {by_state.get(st, 0)} cells")
        print(f"  gap queue: {len(payload['gaps'])} ranked seeds")
    elif args.action == "gaps":
        from .factory import coverage
        rows = coverage.list_gaps(top=args.top, lane=args.lane)
        print(f"factory gaps: top {len(rows)} demand-ranked gap seed(s)")
        for g in rows:
            print(f"  #{g['rank']:>3} [{g['deficit_score']:>9.2f}] {g['lane']:9} "
                  f"{g['suggested_seed_ref']:34} "
                  f"(demand {g['demand_size']}, corpus {g['existing_corpus_n']}, {g['cell_state']})")
            print(f"        {g['plan_command']}")
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_coverage_cli.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add samagra/__main__.py tests/test_coverage_cli.py
git commit -m "feat(coverage): CLI verbs coverage-build / coverage / gaps"
```

---

### Task 12: API — read-only `GET /api/coverage` + `/api/coverage/concept/{id}`

**Files:**
- Modify: `samagra/api/app.py` — add two routes in the API section (before the live-subsystem passthroughs, ~line 329)
- Test: `tests/test_coverage_api.py`

These are unprotected read GETs (NOT added to `origin_auth._PROTECTED_GETS`), exactly like `/api/overview`.

- [ ] **Step 1: Write the failing test**

```python
# tests/test_coverage_api.py
from fastapi.testclient import TestClient
from samagra.factory.coverage import store


def _seed(db):
    conn = store.connect(db)
    try:
        store.init_schema(conn)
        store.write_graph(
            conn,
            concepts=[{"concept_id": 1, "label": "x", "chapter_id": "physics.optics",
                       "demand_size": 50, "paper_count": 3}],
            chapter_edges=[{"concept_id": 1, "slug": "optics", "score": 1.0, "source": "fts"}],
            cells=[{"concept_id": 1, "lane": "paper", "state": "base",
                    "produced_n": 0, "base_n": 3}],
            gaps=[{"rank": 1, "concept_id": 1, "lane": "paper", "cell_state": "base",
                   "demand_size": 50, "existing_corpus_n": 3, "deficit_score": 12.5,
                   "suggested_seed_ref": "textbook:optics",
                   "plan_command": "samagra factory plan textbook:optics --lane paper"}],
            meta={"concept_count": 1})
    finally:
        conn.close()


def test_coverage_endpoints(tmp_path, monkeypatch):
    db = tmp_path / "concept_graph.db"
    _seed(db)
    monkeypatch.setattr("samagra.config.CONCEPT_GRAPH_DB", db, raising=False)
    from samagra.api.app import app
    client = TestClient(app)

    r = client.get("/api/coverage")
    assert r.status_code == 200
    body = r.json()
    assert body["lanes"][0] == "revision"
    assert body["concepts"][0]["paper_count"] == 3
    assert body["gaps"][0]["plan_command"].endswith("--lane paper")

    d = client.get("/api/coverage/concept/1")
    assert d.status_code == 200
    assert d.json()["chapters"] == ["optics"]

    assert client.get("/api/coverage/concept/999").status_code == 404


def test_coverage_when_not_built(tmp_path, monkeypatch):
    monkeypatch.setattr("samagra.config.CONCEPT_GRAPH_DB", tmp_path / "nope.db", raising=False)
    from samagra.api.app import app
    r = TestClient(app).get("/api/coverage")
    assert r.status_code == 200
    assert r.json()["error"]   # graceful "not built" payload, never a 500
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_coverage_api.py -v`
Expected: FAIL — 404 on `/api/coverage` (route not defined)

- [ ] **Step 3: Add the routes**

In `samagra/api/app.py`, in the API routes section (before the live-subsystem passthroughs):
```python
@app.get("/api/coverage")
def api_coverage():
    # Read-only over the rebuildable concept_graph.db (Phase E). Not built yet ->
    # a graceful empty payload + hint, never a 500 (mirrors /api/questions).
    from ..factory import coverage
    try:
        return coverage.coverage_payload()
    except FileNotFoundError:
        return {"lanes": [], "concepts": [], "cells": [], "gaps": [],
                "meta": {"built": False},
                "error": "coverage graph not built — run `samagra factory coverage-build`"}


@app.get("/api/coverage/concept/{concept_id}")
def api_coverage_concept(concept_id: int):
    from ..factory import coverage
    try:
        dossier = coverage.concept_dossier(concept_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="coverage graph not built")
    if dossier is None:
        raise HTTPException(status_code=404, detail=f"unknown concept {concept_id}")
    return dossier
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_coverage_api.py -v`
Expected: PASS (both)

- [ ] **Step 5: Commit**

```bash
git add samagra/api/app.py tests/test_coverage_api.py
git commit -m "feat(coverage): read-only GET /api/coverage + /api/coverage/concept/{id}"
```

---

### Task 13: Frontend — contracts + registry (the Atlas app slot)

**Files:**
- Modify: `frontend/src/types/contracts.ts` (add `"atlas"` to `AppId`; add coverage types)
- Modify: `frontend/src/registry.ts` (add the `atlas` entry + `ORDER`)
- Test: `frontend/src/registry.test.ts` (extend if it asserts app set) — otherwise add `frontend/src/lib/atlas/heatmap.test.ts` in Task 14 covers the new types.

- [ ] **Step 1: Write the failing test**

Add to `frontend/src/registry.test.ts` (or create if absent):
```typescript
import { describe, it, expect } from "vitest";
import { APPS, ORDER } from "./registry";

describe("Atlas registration", () => {
  it("registers the atlas app and includes it in ORDER", () => {
    expect(APPS.atlas).toMatchObject({ id: "atlas", name: "Atlas" });
    expect(ORDER).toContain("atlas");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/registry.test.ts`
Expected: FAIL — `APPS.atlas` is undefined / TS error on the `atlas` key

- [ ] **Step 3: Add the AppId + coverage types**

In `frontend/src/types/contracts.ts`, add `"atlas"` to the `AppId` union:
```typescript
export type AppId =
  | "dashboard" | "pipelines" | "assignments" | "org" | "questions" | "lectures"
  | "booklets" | "insp" | "sims" | "mycontentdev" | "munshi" | "activity"
  | "settings" | "terminal" | "clock" | "notes" | "snake" | "atlas";
```
Append the coverage response types at the end of the file:
```typescript
// ── Atlas / coverage graph (GET /api/coverage) — Phase E ─────────────────────
export type CoverageState = "produced" | "base" | "gap";
export interface CoverageConcept {
  concept_id: number; label: string; chapter_id: string | null;
  demand_size: number; paper_count: number;
}
export interface CoverageCell {
  concept_id: number; lane: string; state: CoverageState;
  produced_n: number; base_n: number;
}
export interface CoverageGap {
  rank: number; concept_id: number; lane: string; cell_state: "base" | "gap";
  demand_size: number; existing_corpus_n: number; deficit_score: number;
  suggested_seed_ref: string; plan_command: string;
}
export interface CoverageResponse {
  lanes: string[];
  concepts: CoverageConcept[];
  cells: CoverageCell[];
  gaps: CoverageGap[];
  meta: Record<string, unknown>;
  error?: string;     // present (HTTP 200) when the graph isn't built yet
}
```

- [ ] **Step 4: Register the app**

In `frontend/src/registry.ts`, add to the `APPS` record:
```typescript
  atlas: { id: "atlas", name: "Atlas", accent: "#06b6d4", w: 1040, h: 720 },
```
and add `"atlas"` to the `ORDER` array (e.g. right after `"sims"`).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/registry.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/contracts.ts frontend/src/registry.ts frontend/src/registry.test.ts
git commit -m "feat(atlas): register Atlas app + coverage response contracts"
```

---

### Task 14: Frontend — `lib/atlas/heatmap.ts` pure logic

**Files:**
- Create: `frontend/src/lib/atlas/heatmap.ts`
- Test: `frontend/src/lib/atlas/heatmap.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/lib/atlas/heatmap.test.ts
import { describe, it, expect } from "vitest";
import { buildHeatmap, STATE_COLOR } from "./heatmap";
import type { CoverageResponse } from "../../types/contracts";

const data: CoverageResponse = {
  lanes: ["paper", "samadhan"],
  concepts: [
    { concept_id: 1, label: "gauss law", chapter_id: "physics.electrostatics", demand_size: 700, paper_count: 50 },
    { concept_id: 2, label: "ac circuits", chapter_id: "physics.alternating_currents", demand_size: 170, paper_count: 60 },
  ],
  cells: [
    { concept_id: 1, lane: "paper", state: "base", produced_n: 0, base_n: 50 },
    { concept_id: 1, lane: "samadhan", state: "gap", produced_n: 0, base_n: 0 },
    { concept_id: 2, lane: "paper", state: "produced", produced_n: 1, base_n: 60 },
  ],
  gaps: [],
  meta: {},
};

describe("buildHeatmap", () => {
  it("groups rows by community (chapter_id), sorted, with cells indexed by lane", () => {
    const communities = buildHeatmap(data);
    expect(communities.map((c) => c.chapter_id)).toEqual([
      "physics.alternating_currents", "physics.electrostatics",
    ]);
    const electro = communities.find((c) => c.chapter_id === "physics.electrostatics")!;
    expect(electro.rows[0].concept.label).toBe("gauss law");
    expect(electro.rows[0].cells.samadhan.state).toBe("gap");
  });
  it("defensive: null / missing fields -> []", () => {
    expect(buildHeatmap(null)).toEqual([]);
    expect(buildHeatmap({ ...data, concepts: undefined as never })).toEqual([]);
  });
  it("exposes a colour for each state", () => {
    expect(STATE_COLOR.produced).toBeTruthy();
    expect(STATE_COLOR.base).toBeTruthy();
    expect(STATE_COLOR.gap).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/atlas/heatmap.test.ts`
Expected: FAIL — cannot resolve `./heatmap`

- [ ] **Step 3: Create the module**

```typescript
// frontend/src/lib/atlas/heatmap.ts
import type {
  CoverageResponse, CoverageCell, CoverageConcept, CoverageState,
} from "../../types/contracts";

export const STATE_COLOR: Record<CoverageState, string> = {
  produced: "#16a34a", // green — factory shipped
  base: "#eab308",     // amber — source-ready, unproduced
  gap: "#ef4444",      // red — net-new hole
};

export interface HeatRow {
  concept: CoverageConcept;
  cells: Record<string, CoverageCell>; // lane -> cell
}
export interface HeatCommunity {
  chapter_id: string;
  rows: HeatRow[];
}

export function buildHeatmap(data: CoverageResponse | null | undefined): HeatCommunity[] {
  if (!data || !Array.isArray(data.concepts)) return [];
  const index = new Map<string, CoverageCell>();
  for (const c of data.cells ?? []) index.set(`${c.concept_id}:${c.lane}`, c);

  const byCommunity = new Map<string, HeatRow[]>();
  for (const concept of data.concepts) {
    const cells: Record<string, CoverageCell> = {};
    for (const lane of data.lanes ?? []) {
      const cell = index.get(`${concept.concept_id}:${lane}`);
      if (cell) cells[lane] = cell;
    }
    const key = concept.chapter_id ?? "other";
    const rows = byCommunity.get(key) ?? [];
    rows.push({ concept, cells });
    byCommunity.set(key, rows);
  }
  return [...byCommunity.entries()]
    .map(([chapter_id, rows]) => ({ chapter_id, rows }))
    .sort((a, b) => a.chapter_id.localeCompare(b.chapter_id));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/lib/atlas/heatmap.test.ts`
Expected: PASS (all 3)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/atlas/heatmap.ts frontend/src/lib/atlas/heatmap.test.ts
git commit -m "feat(atlas): pure heatmap builder (communities + state colours)"
```

---

### Task 15: Frontend — the `Atlas` app component

**Files:**
- Create: `frontend/src/apps/Atlas/index.tsx`
- Test: `frontend/src/apps/Atlas/index.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/src/apps/Atlas/index.test.tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Atlas from "./index";

const data = {
  lanes: ["paper", "samadhan"],
  concepts: [{ concept_id: 1, label: "gauss law", chapter_id: "physics.electrostatics", demand_size: 700, paper_count: 50 }],
  cells: [
    { concept_id: 1, lane: "paper", state: "base", produced_n: 0, base_n: 50 },
    { concept_id: 1, lane: "samadhan", state: "gap", produced_n: 0, base_n: 0 },
  ],
  gaps: [{ rank: 1, concept_id: 1, lane: "samadhan", cell_state: "gap", demand_size: 700,
           existing_corpus_n: 0, deficit_score: 700, suggested_seed_ref: "textbook:gauss-law",
           plan_command: "samagra factory plan textbook:gauss-law --lane samadhan" }],
  meta: {},
};

describe("Atlas app", () => {
  beforeEach(() => useApiMock.mockReset());

  it("fetches /api/coverage and renders the heatmap + gap queue", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Atlas />);
    expect(useApiMock).toHaveBeenCalledWith("/api/coverage");
    expect(screen.getByTestId("atlas")).toBeInTheDocument();
    expect(screen.getByText("gauss law")).toBeInTheDocument();
    // the gap queue shows the copy-ready plan command
    expect(screen.getByText(/factory plan textbook:gauss-law --lane samadhan/)).toBeInTheDocument();
  });

  it("shows the not-built hint when the API returns an error payload", () => {
    useApiMock.mockReturnValue({ data: { ...data, concepts: [], gaps: [], error: "not built" }, loading: false, error: null });
    render(<Atlas />);
    expect(screen.getByTestId("atlas")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("not built");
  });

  it("loading sets aria-busy", () => {
    useApiMock.mockReturnValue({ data: null, loading: true, error: null });
    render(<Atlas />);
    expect(screen.getByTestId("atlas-grid")).toHaveAttribute("aria-busy", "true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/apps/Atlas/index.test.tsx`
Expected: FAIL — cannot resolve `./index`

- [ ] **Step 3: Create the component**

```tsx
// frontend/src/apps/Atlas/index.tsx
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { buildHeatmap, STATE_COLOR } from "../../lib/atlas/heatmap";
import type { CoverageResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

export default function Atlas() {
  const { data, loading, error } = useApi<CoverageResponse>("/api/coverage");
  const lanes = Array.isArray(data?.lanes) ? data!.lanes : [];
  const communities = buildHeatmap(data);
  const gaps = Array.isArray(data?.gaps) ? data!.gaps : [];
  const notice = error || data?.error || null;

  return (
    <div data-testid="atlas" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="dashboard" size={26} label="Atlas" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Concept Atlas</h1>
      </header>
      {notice ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{notice}</div> : null}

      <section data-testid="atlas-grid" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 16 }}>
        {communities.map((com) => (
          <div key={com.chapter_id}>
            <div style={{ color: V.muted, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              {com.chapter_id}
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              {com.rows.map((row) => (
                <div key={row.concept.concept_id}
                     style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 8, alignItems: "center" }}>
                  <div style={{ color: V.text, fontSize: 13 }} title={`demand ${row.concept.demand_size}`}>
                    {row.concept.label}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {lanes.map((lane) => {
                      const cell = row.cells[lane];
                      return (
                        <div key={lane} data-testid="atlas-cell"
                             title={`${lane}: ${cell ? cell.state : "—"}`}
                             style={{ width: 26, height: 18, borderRadius: 4,
                                      background: cell ? STATE_COLOR[cell.state] : V.subBg }} />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section data-testid="atlas-gaps" style={{ marginTop: 20 }}>
        <h2 style={{ color: V.text, fontSize: 14 }}>Demand queue (deficit-ranked)</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {gaps.map((g) => (
            <article key={g.rank} data-testid="atlas-gap"
                     style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10, padding: "8px 12px" }}>
              <div style={{ color: V.text, fontSize: 13 }}>
                #{g.rank} · {g.lane} · deficit {g.deficit_score} · demand {g.demand_size}
              </div>
              <code style={{ color: V.muted, fontSize: 12, userSelect: "all" }}>{g.plan_command}</code>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
```

> Note: if `Icon` has no `"dashboard"`/atlas glyph, reuse any existing name that renders (the test only checks text, not the icon). Pick an existing `name` from `frontend/src/components/Icon.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/apps/Atlas/index.test.tsx`
Expected: PASS (all 3)

- [ ] **Step 5: Wire the component into the app renderer**

Find where apps map `AppId -> component` (grep `frontend/src` for an existing app id like `"pipelines":` in a `switch`/record that imports `apps/Pipelines`). Add the `atlas` case importing `apps/Atlas`. Run the relevant render/registry test to confirm no missing-component error:
Run: `cd frontend && npx vitest run`
Expected: PASS (whole suite)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/apps/Atlas/index.tsx frontend/src/apps/Atlas/index.test.tsx
git commit -m "feat(atlas): Concept Atlas app — heatmap + deficit-ranked gap queue"
```

---

### Task 16: Golden-thread integration test (real sources)

**Files:**
- Test: `tests/test_coverage_golden.py`

Proves the build works against the REAL `builder.sqlite` + the REAL corpus + the REAL governance ledger, and that `governance.db` is untouched. Skips cleanly if a source is absent (CI safety).

- [ ] **Step 1: Write the test**

```python
# tests/test_coverage_golden.py
import pytest
from samagra import config
from samagra.factory import coverage
from samagra.factory.coverage import store


@pytest.mark.skipif(not config.QX_BUILDER_DB.exists(), reason="QX builder.sqlite absent")
@pytest.mark.skipif(not config.TEXTBOOK_CHAPTERS.exists(), reason="textbook corpus absent")
def test_golden_thread_real_sources(tmp_path):
    graph = tmp_path / "concept_graph.db"
    summary = coverage.build_concept_graph(graph_db=graph)   # real QX + corpus + governance

    assert summary["concepts"] == 86          # the 86 QX physics concepts
    assert summary["gaps"] > 0

    conn = store.connect_ro(graph)
    try:
        payload = store.coverage_payload(conn)
    finally:
        conn.close()

    states = {c["state"] for c in payload["cells"]}
    assert "gap" in states                     # samadhan everywhere is a gap
    # the top gap is a high-demand concept and is pointer-pre-loaded
    top = payload["gaps"][0]
    assert top["plan_command"].startswith("samagra factory plan textbook:")
    assert top["deficit_score"] >= payload["gaps"][-1]["deficit_score"]
```

- [ ] **Step 2: Run it**

Run: `python -m pytest tests/test_coverage_golden.py -v`
Expected: PASS (or SKIPPED if a real source is absent on this machine)

- [ ] **Step 3: Commit**

```bash
git add tests/test_coverage_golden.py
git commit -m "test(coverage): golden-thread build against real QX + corpus + governance"
```

---

### Task 17: Full-suite gate + first real graph build

**Files:** none (verification + a generated, gitignored DB)

- [ ] **Step 1: Run the whole backend suite**

Run: `python -m pytest -q`
Expected: all green EXCEPT the known pre-existing `tests/test_gdocs.py` red (Google libs) — confirm the count rose by the ~30 new coverage tests and nothing else regressed.

- [ ] **Step 2: Run the whole frontend suite**

Run: `cd frontend && npx vitest run`
Expected: all green (the existing vitest count + the new Atlas/heatmap/registry tests).

- [ ] **Step 3: Build the real coverage graph (owner smoke)**

Run: `python -m samagra factory coverage-build`
Expected: `factory coverage-build: 86 concepts, … chapter edges, … cells, … gap seeds -> …\concept_graph.db`
Then: `python -m samagra factory gaps --top 10` — eyeball the ranked queue; the top entries should be high-demand concepts (e.g. electrostatics/optics) with thin/absent derivative coverage, each with a ready `plan` command. `concept_graph.db` is gitignored (not committed).

- [ ] **Step 4: Confirm governance is untouched**

Run: `git status` — only the expected source files changed; `governance.db` and `samagra.db` are not modified by the build.

- [ ] **Step 5 (owner, optional): curate the overlay**

Inspect FTS misses (a physics concept with no `concept_chapter` edge): `python -m samagra factory coverage` then query the graph, and add `add`/`remove` deltas to `concept_aliases.json`; re-run `coverage-build`. Commit the curated overlay:
```bash
git add concept_aliases.json
git commit -m "chore(coverage): curate chapter<->concept alias overlay"
```

---

## Self-review checklist (done by the plan author)

- **Spec coverage:** concept_graph.db (Task 9) ✓ · QX-anchored concepts (Task 2) ✓ · FTS base + committed overlay normalization (Tasks 3–5) ✓ · factory-produced-only 3-state matrix (Task 7) ✓ · deficit-weighted ranking (Task 8) ✓ · read-only GET endpoints (Task 12) ✓ · React Atlas app (Tasks 13–15) ✓ · CLI verbs (Task 11) ✓ · no new prod write path / publish gate untouched / no governance migration (read-only throughout; gap emission via existing CLI) ✓ · golden thread (Task 16) ✓.
- **Spec deviation (noted in spec §5):** the per-artifact `artifact`/`concept_artifact` node graph is created-but-reserved for Phase F; the Tier-1 matrix derives from aggregates (`concept.paper_count`, `concept_chapter`, `coverage_cell.produced_n`).
- **Type consistency:** the concept / edge / cell / gap-seed dict shapes and the `COVERAGE_LANES` constant are identical across `concepts.py` → `edges.py` → `matrix.py` → `gaps.py` → `store.py` → the API payload → the frontend `contracts.ts`.
- **No placeholders:** every step has runnable code, exact commands, and expected output.
