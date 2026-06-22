# SAMAGRA Phase 3 — Active Loop (the bridge) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SAMAGRA active loop — read munshi items, classify content vs ops, propose mycontentdev seeds with corpus pointers, queue them as board-review assignments, and (only after board approval) create the seed via the already-merged `McdClient.create_seed` — runnable end-to-end from the CLI and proven live with one labeled `Testbot` seed.

**Architecture:** A new pure, file-disjoint `samagra/bridge/` package (`text`, `classify`, `pointers`, `seed_payload`, `outbox`, `run`) plus three CLI verbs (`bridge scan|approve|submit`). `scan` is strictly read-only (dry by default); `approve` is the board gate that flips an `in-review` assignment to `approved`; `submit` is the single subsystem write — approval-gated and idempotent. Governance state lives in the existing durable `governance.db` (opened via `store.connect()`); proposals + corpus pointers are recorded in the `seed_proposed` event note and a pasteable outbox file.

**Tech Stack:** Python 3.11 (`.venv`), SQLite/FTS5 catalog (`samagra.db`) + durable `governance.db`, `pytest` (TDD), the merged `McdClient`/`MunshiClient`/`MunshiAdapter`/governance `store`.

**Spec:** [`docs/superpowers/specs/2026-06-22-phase3-active-loop-design.md`](../specs/2026-06-22-phase3-active-loop-design.md) (reconciles the 2026-06-19 evolution spec §8 + plan Tasks 3.1–3.8 against shipped `main`). Read it first.

**Branch:** `phase3/active-loop` (already created off `main`, holds the design spec at `54b6e76`). All commands run from the repo root `C:\SandBox\claude_box\TeachingOS` with the project venv `.venv\Scripts\python`.

---

## Shared facts (verified 2026-06-22 against `main` — do not re-derive)

- **`Artifact`** (`samagra/adapters/base.py`): `Artifact(uid, source, kind, title, subject=None, unit=None, chapter=None, status=None, path=None, url=None, updated_at=None, meta={})`. `import` it as `from samagra.adapters.base import Artifact`.
- **`MunshiAdapter`** (`samagra/adapters/munshi.py`): `available()`, `artifacts()` yielding `Artifact` with `meta={"payload":<dict>, "tags":..., "person":..., "due":...}`. Munshi payloads use **kind-specific keys** (note→`issue`/`topic`/`action`, todo→`task`, issue→`summary`/`source`, question→`stem`, followup→`note`) — **never a generic `"text"`** (R2).
- **`McdClient.create_seed(fields)`** (`samagra/clients/mcd_client.py:58`): POSTs **form-encoded** `data=fields` to `/api/seeds` (`x-mcd-admin`). The live `/api/mcd/seeds` proves the accepted flat fields are `{type, raw_text, title?, source_ref?}` (R1). Nested dicts are dropped by the worker.
- **`MunshiClient.create_item(kind, fields)`** (`munshi_client.py:42`): POSTs JSON `{kind, **fields}` to `/api/item`; `kind ∈ {todo,note,followup}`. A `note` needs `{student, issue}` (mirrors `/api/munshi/capture`).
- **Governance store** (`samagra/governance/store.py`): durable `governance.db`, opened with **`store.connect()`** (NOT `catalog.connect()` — D6 split). Functions each `conn.commit()` internally: `add_assignment(conn, *, id, agent, outbox_path, pipeline=None, seed_ref=None, ...)`, `set_assignment_status(conn, id, status)` (validates against `ASSIGNMENT_STATUS`, appends a `status:<s>` event), `append_event(conn, *, actor, verb, assignment_id=None, subsystem=None, subsystem_ref=None, note=None)`, `list_assignments(conn)`, `list_events(conn, limit=200)`. `ASSIGNMENT_STATUS = {queued, running, in-review, approved, changes}`. `ensure_tables()` memoizes per DB path; `config.GOVERNANCE_DB` is resolved at call time (tests repoint it).
- **`catalog.search(query, source=None, kind=None, limit=100) -> list[dict]`**: FTS5; rows are dicts with the catalog columns (`uid, source, kind, title, subject, unit, chapter, status, path, url, updated_at, meta_json`). `catalog.connect()` is read-write (creates schema incl. `catalog_fts(uid unindexed, title, subject, chapter, kind, source)`); `config.DATA_DB` resolved at call time.

## File structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `samagra/bridge/__init__.py` | Create | Package marker (docstring only). |
| `samagra/bridge/text.py` | Create | `item_text(item) -> str` — verbatim munshi text via kind-specific keys + fallback (R2). Shared by classify/seed_payload/run. |
| `samagra/bridge/classify.py` | Create | `classify_item(item) -> "content"\|"ops"` — pure heuristic. |
| `samagra/bridge/pointers.py` | Create | `resolve_pointers(text, *, limit=5)` — FTS5 corpus lookup. |
| `samagra/bridge/seed_payload.py` | Create | `build_seed_payload(item, pointers) -> dict` — flat `{type, raw_text, source_ref?}` (R1). |
| `samagra/bridge/outbox.py` | Create | `write_outbox_file(...) -> str` — pasteable board prompt; carries pointers + submit command. |
| `samagra/bridge/run.py` | Create | `scan(dry=True)`, `approve(id)`, `submit(id)` — orchestration on `store.connect()`. |
| `samagra/governance/store.py` | Modify | Add `"captured"` to `ASSIGNMENT_STATUS` (R3 terminal status). |
| `samagra/__main__.py` | Modify | `bridge scan [--dry-run]` · `bridge approve <id>` · `bridge submit <id>`. |
| `tests/test_bridge.py` | Create | Unit coverage (mocked clients) for every bridge function + CLI + the `captured` status. |
| `tests/test_bridge_outbox.py` | Create | Outbox file content. |

---

## Task 1: bridge package + `item_text` + `classify_item`

**Files:**
- Create: `samagra/bridge/__init__.py`
- Create: `samagra/bridge/text.py`
- Create: `samagra/bridge/classify.py`
- Create: `tests/test_bridge.py`

- [ ] **Step 1: Create the package marker.** `samagra/bridge/__init__.py`:

```python
"""SAMAGRA active loop: munshi item -> classify -> proposed seed -> board review -> capture."""
```

- [ ] **Step 2: Write the failing tests.** Create `tests/test_bridge.py`:

```python
"""Phase 3 — active-loop bridge tests. All HTTP clients are mocked; no live calls."""
from __future__ import annotations

import json
import sys

import pytest

from samagra.bridge.text import item_text
from samagra.bridge.classify import classify_item


def _item(kind, payload, **kw):
    base = {"id": "i1", "kind": kind, "payload": payload, "status": "open"}
    base.update(kw)
    return base


@pytest.mark.parametrize(
    "item,expected",
    [
        # real munshi kind-specific keys (R2)
        (_item("question", {"stem": "Find the work done by friction on a block?"}), "content"),
        (_item("note", {"issue": "Nice intuition for Gauss's law and electric flux"}), "content"),
        (_item("todo", {"task": "Make a question on rotational kinetic energy"}), "content"),
        # synthetic generic-text payloads still work via the fallback join
        (_item("note", {"text": "Gauss law electric flux through a cube"}), "content"),
        # ops: issues / followups / person-directed / non-physics
        (_item("issue", {"summary": "Projector in room 4 is broken"}), "ops"),
        (_item("followup", {"note": "Call the parent about fees"}, person="Riya"), "ops"),
        (_item("note", {"issue": "Buy more whiteboard markers"}), "ops"),
        (_item("todo", {"task": "Order new chairs"}), "ops"),
    ],
)
def test_classify_item(item, expected):
    assert classify_item(item) == expected


def test_item_text_uses_kind_specific_key():
    assert item_text(_item("todo", {"task": "Order new chairs"})) == "Order new chairs"
    assert item_text(_item("question", {"stem": "Find a?"})) == "Find a?"


def test_item_text_falls_back_to_joined_values():
    # no kind-specific key present -> join string values
    assert "Gauss" in item_text(_item("note", {"text": "Gauss law"}))


def test_item_text_empty_payload_is_empty_string():
    assert item_text(_item("todo", {})) == ""
```

- [ ] **Step 3: Run the tests, expect FAIL.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q`
Expected: collection error — `ModuleNotFoundError: No module named 'samagra.bridge.text'`.

- [ ] **Step 4: Implement `samagra/bridge/text.py`.**

```python
"""Extract the verbatim human text of a munshi item.

Munshi payloads store their text under a kind-SPECIFIC key (note->issue/topic,
todo->task, question->stem, ...), never a generic "text" (mirrors
samagra/adapters/munshi.py _TITLE_KEYS_BY_KIND). We try those first, then fall
back to joining any string/number values so synthetic or renamed payloads still
yield text. Pure; no I/O.
"""
from __future__ import annotations

# Mirrors samagra/adapters/munshi.py _TITLE_KEYS_BY_KIND (most descriptive first).
_KIND_KEYS = {
    "note": ("issue", "topic", "action"),
    "todo": ("task",),
    "issue": ("summary", "source"),
    "question": ("stem",),
    "followup": ("note",),
}


def item_text(item: dict) -> str:
    """Return the item's verbatim text (kind-specific key first, else joined values)."""
    payload = item.get("payload") or {}
    if isinstance(payload, str):
        return payload.strip()
    if not isinstance(payload, dict):
        return str(payload)
    kind = (item.get("kind") or "").lower()
    for key in _KIND_KEYS.get(kind, ()):
        val = payload.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    parts = [str(v) for v in payload.values() if isinstance(v, (str, int, float))]
    return " ".join(p for p in parts if p).strip()
```

- [ ] **Step 5: Implement `samagra/bridge/classify.py`.**

```python
"""Heuristic: is a munshi item a content-seed candidate or an ops todo?

Pure function over the item dict. No I/O. Conservative: when in doubt, 'ops'
(ops items just stay in munshi; mis-routing a note to ops is cheaper than
proposing a junk seed). The board reviews every content proposal anyway.
"""
from __future__ import annotations

from .text import item_text

# Physics-ish vocabulary — coarse on purpose.
_PHYSICS_TERMS = (
    "force", "energy", "work", "friction", "momentum", "velocity",
    "acceleration", "gravity", "gravitation", "field", "electric",
    "magnetic", "flux", "gauss", "charge", "current", "voltage", "ohm",
    "circuit", "wave", "optics", "lens", "mirror", "refraction", "diffraction",
    "thermodynamics", "entropy", "heat", "temperature", "pressure",
    "rotational", "torque", "kinetic", "potential", "oscillation", "pendulum",
    "capacitor", "inductor", "resistor", "photon", "quantum", "nucleus",
    "physics", "newton", "joule", "kepler", "doppler",
)


def _looks_physics(text: str) -> bool:
    low = text.lower()
    return any(term in low for term in _PHYSICS_TERMS)


def classify_item(item: dict) -> str:
    """Return 'content' or 'ops' for a single munshi item dict."""
    kind = (item.get("kind") or "").lower()
    text = item_text(item)

    # Person-directed work, issues, and followups are operational.
    if kind in {"issue", "followup"}:
        return "ops"
    if item.get("person"):
        return "ops"

    if kind == "question":
        return "content"
    if kind == "note":
        return "content" if (_looks_physics(text) or "?" in text) else "ops"
    if kind == "todo":
        return "content" if _looks_physics(text) else "ops"
    return "ops"
```

- [ ] **Step 6: Run the tests, expect PASS.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q`
Expected: `11 passed`.

- [ ] **Step 7: Commit.**

```bash
git add samagra/bridge/__init__.py samagra/bridge/text.py samagra/bridge/classify.py tests/test_bridge.py
git commit -m "feat(bridge): item_text + classify munshi items as content vs ops

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `resolve_pointers` — FTS5 candidate lookup

**Files:**
- Create: `samagra/bridge/pointers.py`
- Modify: `tests/test_bridge.py`

- [ ] **Step 1: Append the failing tests + temp-catalog fixture.** Add to the imports block of `tests/test_bridge.py`:

```python
from samagra import catalog, config
from samagra.bridge.pointers import resolve_pointers
```

Then append:

```python
@pytest.fixture
def temp_catalog(tmp_path, monkeypatch):
    """Point config.DATA_DB at a temp DB and seed three catalog rows."""
    db = tmp_path / "samagra.db"
    monkeypatch.setattr(config, "DATA_DB", db)
    con = catalog.connect()  # creates schema incl. catalog_fts
    rows = [
        ("qx:doc:gauss-1", "qx", "question", "Gauss law flux through a cube",
         "physics", None, "Electrostatics", None, None, None, None, "{}"),
        ("tb:ch:work-energy", "physics-textbook", "chapter",
         "Work, Energy and Power", "physics", None, "Mechanics",
         None, None, None, None, "{}"),
        ("insp:p:optics-9", "insp", "problem", "Lens refraction olympiad set",
         "physics", None, "Optics", None, None, None, None, "{}"),
    ]
    cur = con.cursor()
    for r in rows:
        cur.execute("insert into catalog values(?,?,?,?,?,?,?,?,?,?,?,?)", r)
        cur.execute(
            "insert into catalog_fts(uid,title,subject,chapter,kind,source) "
            "values(?,?,?,?,?,?)",
            (r[0], r[3], r[4], r[6], r[2], r[1]),
        )
    con.commit()
    con.close()
    return db


def test_resolve_pointers_finds_candidates(temp_catalog):
    ptrs = resolve_pointers("Gauss law electric flux", limit=5)
    assert any(p["uid"] == "qx:doc:gauss-1" for p in ptrs)
    for p in ptrs:
        assert set(p.keys()) == {"uid", "source", "kind", "title"}


def test_resolve_pointers_respects_limit(temp_catalog):
    ptrs = resolve_pointers("work energy lens gauss", limit=2)
    assert len(ptrs) <= 2


def test_resolve_pointers_empty_text_returns_empty(temp_catalog):
    assert resolve_pointers("", limit=5) == []
```

- [ ] **Step 2: Run the new tests, expect FAIL.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q -k resolve_pointers`
Expected: `ModuleNotFoundError: No module named 'samagra.bridge.pointers'`.

- [ ] **Step 3: Implement `samagra/bridge/pointers.py`.**

```python
"""Resolve corpus pointers for a munshi item by FTS5-searching the catalog.

Read-only over samagra.db via samagra.catalog.search(). Returns a compact list
of candidate artifacts to attach to a proposed seed (recorded in SAMAGRA's own
audit trail) so downstream enrichment knows where the idea connects.
"""
from __future__ import annotations

from .. import catalog


def resolve_pointers(text: str, *, limit: int = 5) -> list[dict]:
    """Up to `limit` candidates as [{uid, source, kind, title}], best-match first.
    Empty text -> []."""
    query = (text or "").strip()
    if not query:
        return []
    rows = catalog.search(query, limit=limit)
    return [
        {"uid": r["uid"], "source": r["source"], "kind": r["kind"], "title": r["title"]}
        for r in rows
    ]
```

- [ ] **Step 4: Run the tests, expect PASS.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q -k resolve_pointers`
Expected: `3 passed`.

- [ ] **Step 5: Commit.**

```bash
git add samagra/bridge/pointers.py tests/test_bridge.py
git commit -m "feat(bridge): resolve corpus pointers via catalog FTS5 search

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `build_seed_payload` — flat `POST /api/seeds` fields (R1)

**Files:**
- Create: `samagra/bridge/seed_payload.py`
- Modify: `tests/test_bridge.py`

- [ ] **Step 1: Append the failing tests.** Add to imports: `from samagra.bridge.seed_payload import build_seed_payload`. Then append:

```python
def test_build_seed_payload_rough_idea_flat_body():
    item = {"id": "42", "uid": "munshi:42", "kind": "note",
            "payload": {"issue": "Idea: show work done by friction with a slider"},
            "status": "open"}
    pointers = [
        {"uid": "tb:ch:work-energy", "source": "physics-textbook",
         "kind": "chapter", "title": "Work, Energy and Power"},
    ]
    body = build_seed_payload(item, pointers)
    assert body == {
        "type": "rough_idea",
        "raw_text": "Idea: show work done by friction with a slider",
        "source_ref": "munshi:42",
    }
    # R1: no nested detail{} (the worker would drop it)
    assert "detail" not in body


def test_build_seed_payload_question_maps_type():
    item = {"id": "7", "uid": "munshi:7", "kind": "question",
            "payload": {"stem": "A 2 kg block slides down a 30 deg incline; find a."},
            "status": "open"}
    body = build_seed_payload(item, [])
    assert body["type"] == "question"
    assert body["raw_text"] == "A 2 kg block slides down a 30 deg incline; find a."
    assert body["source_ref"] == "munshi:7"


def test_build_seed_payload_source_ref_from_id_when_no_uid():
    item = {"id": "9", "kind": "todo", "payload": {"task": "rotational kinetic energy demo"}}
    body = build_seed_payload(item, [])
    assert body["source_ref"] == "munshi:9"
```

- [ ] **Step 2: Run the new tests, expect FAIL.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q -k build_seed_payload`
Expected: `ModuleNotFoundError: No module named 'samagra.bridge.seed_payload'`.

- [ ] **Step 3: Implement `samagra/bridge/seed_payload.py`.**

```python
"""Build the FLAT POST /api/seeds capture fields for a munshi item (R1).

The deployed worker parses multipart form-data and the live /api/mcd/seeds
forwards only {type, raw_text, title?, source_ref?}; a nested detail{} would be
dropped. So we emit the flat, proven contract here and keep the corpus pointers
+ full proposal in SAMAGRA's own seed_proposed event + outbox file.
"""
from __future__ import annotations

from .text import item_text


def _source_ref(item: dict) -> str | None:
    uid = item.get("uid")
    if isinstance(uid, str) and uid:
        return uid
    iid = item.get("id")
    return f"munshi:{iid}" if iid is not None else None


def build_seed_payload(item: dict, pointers: list[dict]) -> dict:
    """Return the flat POST /api/seeds body. `pointers` are NOT shipped to mcd
    (recorded in SAMAGRA's audit trail instead); the param is kept for symmetry
    and future use."""
    kind = (item.get("kind") or "").lower()
    seed_type = "question" if kind == "question" else "rough_idea"
    body = {"type": seed_type, "raw_text": item_text(item)}
    ref = _source_ref(item)
    if ref:
        body["source_ref"] = ref
    return body
```

- [ ] **Step 4: Run the tests, expect PASS.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q -k build_seed_payload`
Expected: `3 passed`.

- [ ] **Step 5: Commit.**

```bash
git add samagra/bridge/seed_payload.py tests/test_bridge.py
git commit -m "feat(bridge): build flat POST /api/seeds payload (R1, no nested detail)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `write_outbox_file` — pasteable board prompt

**Files:**
- Create: `samagra/bridge/outbox.py`
- Create: `tests/test_bridge_outbox.py`

- [ ] **Step 1: Write the failing test.** Create `tests/test_bridge_outbox.py`:

```python
from pathlib import Path

from samagra.bridge import outbox


def test_write_outbox_file_creates_frontmatter_prompt(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    payload = {"type": "rough_idea", "raw_text": "idea about projectile motion",
               "source_ref": "munshi:9"}
    pointers = [{"source": "textbook", "uid": "tb:1", "kind": "chapter", "title": "Kinematics"}]
    rel = outbox.write_outbox_file(
        agent="khanak", assignment_id="abcd1234ef", pipeline="mycontentdev",
        seed_ref="munshi:9", expected_output="Create mycontentdev seed",
        review_by="khanak", payload=payload, pointers=pointers,
    )
    f = Path(rel)
    assert f.exists()
    text = f.read_text(encoding="utf-8")
    assert "assignee: khanak" in text
    assert "pipeline: mycontentdev" in text
    assert "samagra bridge approve abcd1234ef" in text
    assert "samagra bridge submit abcd1234ef" in text
    assert "Kinematics" in text
    assert f.parent.as_posix().endswith("board/khanak/outbox")
```

- [ ] **Step 2: Run it, expect FAIL.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge_outbox.py -q`
Expected: `ModuleNotFoundError: No module named 'samagra.bridge.outbox'`.

- [ ] **Step 3: Implement `samagra/bridge/outbox.py`.**

```python
"""Write ready-to-paste outbox prompt files (spec §7b).

The outbox markdown is the human-readable board artifact: it carries the verbatim
text, the resolved corpus pointers, and the exact approve/submit commands. It is
where the pointers live for a human reviewer (they are not shipped to mcd).
"""
from __future__ import annotations

import datetime
from pathlib import Path


def write_outbox_file(*, agent: str, assignment_id: str, pipeline: str,
                      seed_ref: str, expected_output: str, review_by: str,
                      payload: dict, pointers: list[dict]) -> str:
    """Write a dated front-matter prompt under board/<agent>/outbox/.
    Returns the repo-relative POSIX path (stored as the assignment's outbox_path)."""
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
```

- [ ] **Step 4: Run the test, expect PASS.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge_outbox.py -q`
Expected: `1 passed`.

- [ ] **Step 5: Commit.**

```bash
git add samagra/bridge/outbox.py tests/test_bridge_outbox.py
git commit -m "feat(bridge): materialise pasteable outbox prompt file

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: governance — add the terminal `captured` status (R3)

**Files:**
- Modify: `samagra/governance/store.py`
- Modify: `tests/test_bridge.py`

- [ ] **Step 1: Append the failing test + a governance temp-db fixture.** Add to imports: `from samagra.governance import store`. Then append:

```python
@pytest.fixture
def temp_gov(tmp_path, monkeypatch):
    """Point config.GOVERNANCE_DB at a temp DB (fresh governance store)."""
    gdb = tmp_path / "governance.db"
    monkeypatch.setattr(config, "GOVERNANCE_DB", gdb)
    store._INITIALIZED.discard(str(gdb))
    store.ensure_tables()
    return gdb


def test_governance_accepts_captured_status(temp_gov):
    conn = store.connect()
    try:
        store.add_assignment(conn, id="a1", agent="khanak",
                             outbox_path="board/khanak/outbox/a1.md",
                             pipeline="mycontentdev", seed_ref="munshi:1")
        store.set_assignment_status(conn, "a1", "in-review")
        store.set_assignment_status(conn, "a1", "approved")
        store.set_assignment_status(conn, "a1", "captured")   # must not raise
        a = next(a for a in store.list_assignments(conn) if a["id"] == "a1")
        assert a["status"] == "captured"
    finally:
        conn.close()
```

- [ ] **Step 2: Run it, expect FAIL.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q -k captured_status`
Expected: FAIL — `ValueError: invalid assignment status 'captured'`.

- [ ] **Step 3: Add `captured` to the status set.** In `samagra/governance/store.py`, replace:

```python
ASSIGNMENT_STATUS = {"queued", "running", "in-review", "approved", "changes"}
```

with:

```python
# 'captured' is the terminal state of a bridged assignment AFTER its seed was
# created (Phase 3 / R3): set_assignment_status accepts it; submit() flips to it
# so a captured assignment can never be re-submitted (idempotent prod write).
ASSIGNMENT_STATUS = {"queued", "running", "in-review", "approved", "changes", "captured"}
```

- [ ] **Step 4: Run it, expect PASS.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q -k captured_status`
Expected: `1 passed`.

- [ ] **Step 5: Run the existing governance suite to confirm no regression.**

Run: `.venv\Scripts\python -m pytest tests/ -q -k governance`
Expected: all governance tests still pass.

- [ ] **Step 6: Commit.**

```bash
git add samagra/governance/store.py tests/test_bridge.py
git commit -m "feat(governance): add terminal 'captured' assignment status (Phase 3 R3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `run.scan(dry=True)` — propose, never write (with re-scan dedup)

`scan` reads munshi via `MunshiAdapter`, keeps `content` items, builds pointers + the flat payload. `dry=True` (default) writes nothing. `dry=False` records an `in-review` assignment (governance via **`store.connect()`**, agent `khanak`), writes the outbox file, and records a `seed_proposed` event whose note is `json.dumps({"payload":…, "pointers":…})`. It NEVER calls `create_seed`. A re-scan skips an item that already has a non-terminal assignment for the same `seed_ref` (no duplicate proposals).

**Files:**
- Create: `samagra/bridge/run.py` (scan + shared helpers)
- Modify: `tests/test_bridge.py`

- [ ] **Step 1: Append the failing tests.** Add to imports: `from samagra.bridge import run`. Then append:

```python
class _FakeMunshiAdapter:
    def __init__(self, items):
        self._items = items

    def available(self):
        return True

    def artifacts(self):
        from samagra.adapters.base import Artifact
        for it in self._items:
            yield Artifact(
                uid=f"munshi:{it['id']}", source="munshi", kind=it["kind"],
                title=item_text(it)[:60], subject="physics",
                status=it["status"], updated_at=it.get("ts"),
                meta={"payload": it["payload"], "tags": it.get("tags"),
                      "person": it.get("person"), "due": it.get("due")},
            )


def _munshi_items():
    return [
        {"id": "1", "kind": "question", "status": "open", "ts": "2026-06-19T00:00:00Z",
         "payload": {"stem": "Find acceleration of a block on a frictionless incline?"}},
        {"id": "2", "kind": "issue", "status": "open", "ts": "2026-06-19T00:01:00Z",
         "payload": {"summary": "Projector broken in room 4"}},
    ]


def test_scan_dry_proposes_content_only_and_writes_nothing(temp_catalog, monkeypatch):
    monkeypatch.setattr(run, "MunshiAdapter", lambda: _FakeMunshiAdapter(_munshi_items()))

    class _Boom:
        def create_seed(self, payload):  # pragma: no cover - must not run
            raise AssertionError("scan must not create seeds")
    monkeypatch.setattr(run, "McdClient", _Boom)
    monkeypatch.setattr(run.store, "add_assignment",
                        lambda *a, **k: (_ for _ in ()).throw(
                            AssertionError("dry scan must not write")))

    proposals = run.scan(dry=True)
    assert len(proposals) == 1                       # only the question item
    p = proposals[0]
    assert p["item"]["uid"] == "munshi:1"
    assert p["classification"] == "content"
    assert p["payload"]["type"] == "question"
    assert isinstance(p["pointers"], list)
    assert "assignment_id" not in p                  # dry: no assignment recorded


def test_scan_live_records_in_review_and_dedups(temp_catalog, temp_gov, monkeypatch):
    monkeypatch.setattr(run, "MunshiAdapter", lambda: _FakeMunshiAdapter(_munshi_items()))

    class _Boom:
        def create_seed(self, payload):  # pragma: no cover
            raise AssertionError("scan must not create seeds")
    monkeypatch.setattr(run, "McdClient", _Boom)

    proposals = run.scan(dry=False)
    assert len(proposals) == 1
    aid = proposals[0]["assignment_id"]
    conn = store.connect()
    try:
        rows = [a for a in store.list_assignments(conn) if a["seed_ref"] == "munshi:1"]
        assert len(rows) == 1
        assert rows[0]["status"] == "in-review"
        assert rows[0]["agent"] == "khanak"
        assert rows[0]["pipeline"] == "mycontentdev"
        # the proposed payload round-trips out of the seed_proposed event note
        evs = [e for e in store.list_events(conn, limit=1000)
               if e["assignment_id"] == aid and e["verb"] == "seed_proposed"]
        assert len(evs) == 1
        note = json.loads(evs[0]["note"])
        assert note["payload"]["type"] == "question"
        assert isinstance(note["pointers"], list)
    finally:
        conn.close()

    # Re-scan: same item already has an open assignment -> no duplicate recorded.
    again = run.scan(dry=False)
    conn = store.connect()
    try:
        rows = [a for a in store.list_assignments(conn) if a["seed_ref"] == "munshi:1"]
        assert len(rows) == 1                         # still exactly one
    finally:
        conn.close()
    assert again[0].get("reused") is True
```

- [ ] **Step 2: Run the new tests, expect FAIL.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q -k scan`
Expected: `ModuleNotFoundError: No module named 'samagra.bridge.run'`.

- [ ] **Step 3: Implement `samagra/bridge/run.py` (scan + helpers).**

```python
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

from .. import catalog  # noqa: F401  (kept for symmetry / future read use)
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
```

- [ ] **Step 4: Run the scan tests, expect PASS.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q -k scan`
Expected: `2 passed`.

- [ ] **Step 5: Commit.**

```bash
git add samagra/bridge/run.py tests/test_bridge.py
git commit -m "feat(bridge): scan munshi into in-review proposals; dry never writes; dedup re-scan

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: `run.approve(id)` — the board gate

`approve` flips an `in-review` assignment to `approved` (the gate the retired portal used to provide). Refuses anything not `in-review`.

**Files:**
- Modify: `samagra/bridge/run.py`
- Modify: `tests/test_bridge.py`

- [ ] **Step 1: Append the failing tests.**

```python
def test_approve_flips_in_review_to_approved(temp_gov):
    conn = store.connect()
    try:
        store.add_assignment(conn, id="a1", agent="khanak",
                             outbox_path="board/khanak/outbox/a1.md",
                             pipeline="mycontentdev", seed_ref="munshi:1")
        store.set_assignment_status(conn, "a1", "in-review")
    finally:
        conn.close()
    res = run.approve("a1")
    assert res["status"] == "approved"
    conn = store.connect()
    try:
        a = next(a for a in store.list_assignments(conn) if a["id"] == "a1")
        assert a["status"] == "approved"
    finally:
        conn.close()


def test_approve_refuses_non_in_review(temp_gov):
    conn = store.connect()
    try:
        store.add_assignment(conn, id="a2", agent="khanak",
                             outbox_path="board/khanak/outbox/a2.md",
                             pipeline="mycontentdev", seed_ref="munshi:2")
    finally:
        conn.close()
    with pytest.raises(ValueError, match="in-review"):
        run.approve("a2")   # still 'queued'


def test_approve_unknown_assignment_raises(temp_gov):
    with pytest.raises(ValueError, match="unknown"):
        run.approve("nope")
```

- [ ] **Step 2: Run them, expect FAIL.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q -k approve`
Expected: `AttributeError: module 'samagra.bridge.run' has no attribute 'approve'`.

- [ ] **Step 3: Append `approve` + the load helper to `samagra/bridge/run.py`.**

```python
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
```

- [ ] **Step 4: Run them, expect PASS.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q -k approve`
Expected: `3 passed`.

- [ ] **Step 5: Commit.**

```bash
git add samagra/bridge/run.py tests/test_bridge.py
git commit -m "feat(bridge): approve flips in-review -> approved (board gate)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: `run.submit(id)` — approval-gated, idempotent seed creation (R3)

`submit` is the one subsystem write. It requires status exactly `approved`, refuses if a `seed_created` event already exists (idempotency), recovers the flat payload via `json.loads(note)["payload"]`, calls `McdClient.create_seed` once, records a `seed_created` event, and flips the assignment to terminal `captured`.

**Files:**
- Modify: `samagra/bridge/run.py`
- Modify: `tests/test_bridge.py`

- [ ] **Step 1: Append the failing tests.**

```python
def _seed_proposed(conn, aid, payload):
    store.append_event(conn, actor="system", verb="seed_proposed",
                       assignment_id=aid, subsystem="munshi", subsystem_ref="munshi:1",
                       note=json.dumps({"payload": payload, "pointers": []}))


def _approved_assignment_with_payload(conn, aid, payload):
    store.add_assignment(conn, id=aid, agent="khanak",
                         outbox_path=f"board/khanak/outbox/{aid}.md",
                         pipeline="mycontentdev", seed_ref="munshi:1")
    store.set_assignment_status(conn, aid, "in-review")
    _seed_proposed(conn, aid, payload)
    store.set_assignment_status(conn, aid, "approved")


def test_submit_refuses_non_approved(temp_gov, monkeypatch):
    conn = store.connect()
    try:
        store.add_assignment(conn, id="a1", agent="khanak",
                             outbox_path="o", pipeline="mycontentdev", seed_ref="munshi:1")
        store.set_assignment_status(conn, "a1", "in-review")
    finally:
        conn.close()

    class _Boom:
        def create_seed(self, payload):  # pragma: no cover
            raise AssertionError("must not create seed for non-approved")
    monkeypatch.setattr(run, "McdClient", _Boom)
    with pytest.raises(ValueError, match="approved"):
        run.submit("a1")


def test_submit_creates_seed_once_and_captures(temp_gov, monkeypatch):
    payload = {"type": "question", "raw_text": "x", "source_ref": "munshi:1"}
    conn = store.connect()
    try:
        _approved_assignment_with_payload(conn, "a1", payload)
    finally:
        conn.close()

    calls = []

    class _Client:
        def create_seed(self, p):
            calls.append(p)
            return {"id": "seed-99", "status": "captured"}
    monkeypatch.setattr(run, "McdClient", lambda: _Client())

    res = run.submit("a1")
    assert calls == [payload]                         # exactly one create, exact flat body
    assert res["seed"]["id"] == "seed-99"
    conn = store.connect()
    try:
        a = next(a for a in store.list_assignments(conn) if a["id"] == "a1")
        assert a["status"] == "captured"
        verbs = [e["verb"] for e in store.list_events(conn, limit=1000)
                 if e["assignment_id"] == "a1"]
        assert "seed_created" in verbs
    finally:
        conn.close()


def test_submit_refuses_double_submit(temp_gov, monkeypatch):
    payload = {"type": "question", "raw_text": "x", "source_ref": "munshi:1"}
    conn = store.connect()
    try:
        _approved_assignment_with_payload(conn, "a1", payload)
    finally:
        conn.close()

    n = {"create": 0}

    class _Client:
        def create_seed(self, p):
            n["create"] += 1
            return {"id": "seed-1", "status": "captured"}
    monkeypatch.setattr(run, "McdClient", lambda: _Client())

    run.submit("a1")                                  # first: ok
    with pytest.raises(ValueError):                   # second: refused (now 'captured')
        run.submit("a1")
    assert n["create"] == 1                            # never a double prod write
```

- [ ] **Step 2: Run them, expect FAIL.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q -k submit`
Expected: `AttributeError: module 'samagra.bridge.run' has no attribute 'submit'`.

- [ ] **Step 3: Append `submit` + helpers to `samagra/bridge/run.py`.**

```python
def _load_proposed_payload(conn, assignment_id: str) -> dict | None:
    """Recover the flat create_seed body from the 'seed_proposed' event note."""
    for ev in store.list_events(conn, limit=10000):
        if ev.get("assignment_id") == assignment_id and ev.get("verb") == "seed_proposed":
            try:
                return json.loads(ev["note"])["payload"]
            except (TypeError, ValueError, KeyError):
                return None
    return None


def _already_captured(conn, assignment_id: str) -> bool:
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
```

- [ ] **Step 4: Run them, expect PASS.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q -k submit`
Expected: `3 passed`.

- [ ] **Step 5: Run the whole bridge suite.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py tests/test_bridge_outbox.py -q`
Expected: all bridge tests pass.

- [ ] **Step 6: Commit.**

```bash
git add samagra/bridge/run.py tests/test_bridge.py
git commit -m "feat(bridge): submit creates seed only for approved, idempotent -> captured

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: CLI verbs `bridge scan | approve | submit`

**Files:**
- Modify: `samagra/__main__.py`
- Modify: `tests/test_bridge.py`

- [ ] **Step 1: Append the failing CLI dispatch tests.** Add to imports: `import samagra.__main__ as cli`. Then append:

```python
def test_cli_bridge_scan_dispatch(monkeypatch, capsys):
    seen = {}
    monkeypatch.setattr("samagra.bridge.run.scan",
                        lambda dry=True: seen.setdefault("dry", dry) or [])
    monkeypatch.setattr(sys, "argv", ["samagra", "bridge", "scan", "--dry-run"])
    cli.main()
    assert seen["dry"] is True


def test_cli_bridge_approve_dispatch(monkeypatch):
    seen = {}
    monkeypatch.setattr("samagra.bridge.run.approve",
                        lambda aid: seen.setdefault("aid", aid) or {"status": "approved"})
    monkeypatch.setattr(sys, "argv", ["samagra", "bridge", "approve", "a1"])
    cli.main()
    assert seen["aid"] == "a1"


def test_cli_bridge_submit_dispatch(monkeypatch):
    seen = {}
    monkeypatch.setattr("samagra.bridge.run.submit",
                        lambda aid: seen.setdefault("aid", aid) or {"seed": {"id": "s1"}})
    monkeypatch.setattr(sys, "argv", ["samagra", "bridge", "submit", "a1"])
    cli.main()
    assert seen["aid"] == "a1"
```

- [ ] **Step 2: Run them, expect FAIL.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q -k cli_bridge`
Expected: `SystemExit: 2` / `invalid choice: 'bridge'`.

- [ ] **Step 3: Add `cmd_bridge` to `samagra/__main__.py`.** Insert this function immediately after `cmd_unlock` (before `def main()`):

```python
def cmd_bridge(args) -> None:
    from .bridge import run

    if args.action == "scan":
        proposals = run.scan(dry=args.dry_run)
        mode = "dry-run" if args.dry_run else "live"
        print(f"bridge scan ({mode}): {len(proposals)} content proposal(s)")
        for p in proposals:
            aid = p.get("assignment_id", "-")
            tag = " (reused)" if p.get("reused") else ""
            print(f"  [{aid}] {p['item']['uid']} -> {p['payload']['type']}  "
                  f"({len(p['pointers'])} pointer(s)){tag}")
    elif args.action == "approve":
        res = run.approve(args.assignment_id)
        print(f"approved {args.assignment_id} -> {res['status']}")
    elif args.action == "submit":
        res = run.submit(args.assignment_id)
        seed = res.get("seed") or {}
        print(f"submitted {args.assignment_id} -> seed {seed.get('id')} "
              f"({seed.get('status')})")
```

- [ ] **Step 4: Wire the `bridge` subparser in `main()`.** In `samagra/__main__.py`, insert this block immediately before the `args = p.parse_args()` line:

```python
    br = sub.add_parser("bridge", help="active loop: scan munshi / approve / submit")
    br_sub = br.add_subparsers(dest="action", required=True)
    br_scan = br_sub.add_parser("scan", help="propose seeds from munshi items")
    br_scan.add_argument("--dry-run", action="store_true",
                         help="propose only; record no assignments")
    br_approve = br_sub.add_parser("approve", help="approve an in-review proposal")
    br_approve.add_argument("assignment_id")
    br_submit = br_sub.add_parser("submit",
                                  help="create a seed for an APPROVED assignment")
    br_submit.add_argument("assignment_id")
    br.set_defaults(func=cmd_bridge)
```

- [ ] **Step 5: Run them, expect PASS.**

Run: `.venv\Scripts\python -m pytest tests/test_bridge.py -q -k cli_bridge`
Expected: `3 passed`.

- [ ] **Step 6: Commit.**

```bash
git add samagra/__main__.py tests/test_bridge.py
git commit -m "feat(bridge): CLI verbs 'bridge scan | approve | submit'

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Full-suite green gate + dry smoke (verification)

**Files:** none (verification only).

- [ ] **Step 1: Run the entire suite, expect all green.**

Run: `.venv\Scripts\python -m pytest tests/ -q --basetemp=.pytest-tmp`
Expected: all tests pass (the ~229 baseline + the new bridge/outbox/governance tests), `0 failed`. (The `--basetemp` silences the cosmetic Windows tmpdir symlink-cleanup exit-1 noted in HANDOFF.)

- [ ] **Step 2: Smoke the dry CLI path (no creds needed, no write).**

Run: `.venv\Scripts\python -m samagra bridge scan --dry-run`
Expected: `bridge scan (dry-run): N content proposal(s)` and a clean exit 0. (With live munshi creds in `.env`, N reflects real content items; with creds absent, `MunshiAdapter.available()` is False → `0 content proposal(s)`.)

- [ ] **Step 3: Confirm no secret literals in the new code.**

Run: `git diff --stat main -- samagra/bridge samagra/__main__.py samagra/governance/store.py tests/test_bridge.py tests/test_bridge_outbox.py`
Expected: only those files changed; manually confirm no admin key / app password / `MUNSHI_SECRET` literal appears (clients own creds via gitignored config).

- [ ] **Step 4: Commit any fixups (else skip).**

```bash
git add -A
git commit -m "test(bridge): Phase 3 active loop suite green; scan read-only, submit approval-gated

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Live `Testbot` end-to-end smoke (owner-approved; writes ONE real seed)

This is the golden-thread proof: a real munshi item → scan → approve → submit → one real, clearly-labeled `Testbot` seed in prod mycontentdev, verified back. **Safety:** the only created entities are `Testbot`-prefixed; we never mutate pre-existing munshi items or seeds. Report the ids so the owner can dismiss/archive.

**Files:** none (live verification; do NOT commit any captured data).

- [ ] **Step 1: Confirm creds are live.**

Run: `.venv\Scripts\python -c "from samagra.clients import MunshiClient, McdClient; print('munshi', MunshiClient().available(), '| mcd', McdClient().available())"`
Expected: `munshi True | mcd True`. If either is False, STOP and tell the owner which env/`mcd-cloud.json` value is missing (do not print any secret).

- [ ] **Step 2: Capture one `Testbot` munshi note (a fresh, disposable physics item).**

Run:
```bash
.venv\Scripts\python -c "from samagra.clients import MunshiClient; import json; print(json.dumps(MunshiClient().create_item('note', {'student':'Testbot','issue':'Testbot Phase-3 smoke: idea for a Gauss law electric flux demo'})))"
```
Expected: a JSON item with a new `id`. **Record that munshi item id** (call it `MID`). (Mirrors `/api/munshi/capture`; `note` requires `student`+`issue`.)

- [ ] **Step 3: Live scan — confirm the Testbot item is classified `content` and recorded `in-review`.**

Run: `.venv\Scripts\python -m samagra bridge scan`
Expected: a line `[<assignment_id>] munshi:<MID> -> rough_idea  (K pointer(s))`. **Record the `assignment_id` for `munshi:<MID>`** (call it `AID`). An outbox file `board/khanak/outbox/<date>-<AID8>.md` now exists. (Other real content items may also appear — only act on the Testbot `AID`.)

- [ ] **Step 4: Approve the Testbot proposal.**

Run: `.venv\Scripts\python -m samagra bridge approve <AID>`
Expected: `approved <AID> -> approved`.

- [ ] **Step 5: Submit — create the real seed.**

Run: `.venv\Scripts\python -m samagra bridge submit <AID>`
Expected: `submitted <AID> -> seed <seed_id> (<status>)`. **Record the `seed_id` (SID).**

- [ ] **Step 6: Verify the seed exists in prod mcd (read-back).**

Run:
```bash
.venv\Scripts\python -c "from samagra.clients import McdClient; rows=McdClient().query(\"select id,type,status from seeds order by created_at desc limit 5\"); import json; print(json.dumps(rows))"
```
Expected: the new `SID` row appears with `type='rough_idea'`. (If the `seeds` table/columns differ, adjust the SQL to the live schema — read-only `select`.)

- [ ] **Step 7: Confirm idempotency — a second submit is refused (no double write).**

Run: `.venv\Scripts\python -m samagra bridge submit <AID>`
Expected: a non-zero exit with `ValueError ... already has a created seed` (or `... not 'approved'`). No new seed created.

- [ ] **Step 8: Report ids to the owner for cleanup.** Print a one-line summary: `LIVE SMOKE OK — munshi item MID=<...>, assignment AID=<...>, seed SID=<...>. Owner: dismiss the munshi item + archive the seed.` Do NOT commit `governance.db` or any captured data.

---

## Task 12: Close-out — trackers, STATUS/SUMMARY, memory, finishing the branch

**Files:**
- Modify: `HANDOFF.md`, `STATUS.html`, `SUMMARY.html`, `CLAUDE.md` (Phase 3 built + golden thread proven live)
- Modify: the project memory under `…/memory/` (+ `MEMORY.md` pointer)
- Modify: the evolution plan/spec banners (Phase 3 now BUILT, DEC-5 satisfied)

- [ ] **Step 1: Update the trackers.** In `HANDOFF.md` add a top banner: Phase 3 (active loop) BUILT TDD on `phase3/active-loop` — `bridge scan|approve|submit`, read-only scan, approval-gated idempotent submit; golden thread (munshi → seed) **proven live** (record MID/AID/SID from Task 11, note owner cleanup). Refresh the pytest count. In `STATUS.html` flip Phase 3 from PARKED to BUILT and add a decisions-log entry. In `SUMMARY.html` add the plain-language one-liner. In `CLAUDE.md` note Phase 3 built (DEC-5 satisfied; loop ungated by DEC-6). Mark the Phase-3 banners in `docs/superpowers/plans/2026-06-19-samagra-evolution.md` + spec §8 as ✅ BUILT (superseded by the 2026-06-22 reconciled spec/plan).

- [ ] **Step 2: Write the memory file.** Create `…/memory/phase3-active-loop-2026-06-22.md` (type `project`) summarizing: bridge built TDD; the 3 reconciliations (R1 flat payload / R2 real munshi keys / R3 idempotent terminal `captured`) + the `store.connect()` governance-DB fix; golden thread proven live; branch `phase3/active-loop` NOT merged (pending review). Link `[[ralph-deploy-plan]]`, `[[samagra-direction]]`, `[[capture-control-plane]]`. Add a one-line pointer to `MEMORY.md`.

- [ ] **Step 3: Run the full suite once more (docs edits don't touch code, but confirm).**

Run: `.venv\Scripts\python -m pytest tests/ -q --basetemp=.pytest-tmp`
Expected: all green.

- [ ] **Step 4: Commit the close-out.**

```bash
git add HANDOFF.md STATUS.html SUMMARY.html CLAUDE.md docs/superpowers
git commit -m "docs(phase3): trackers + spec/plan banners reflect active loop BUILT + golden thread live

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Finish the branch.** Invoke `superpowers:finishing-a-development-branch`. Because `submit` exercises the prod write path, run a **Codex pre-merge review** first (`samagra review-staged` is advisory-local; a full Codex pass over the diff is the gate), then present merge options to the owner. Do NOT self-merge without owner consent.

---

## Self-review notes (addressed inline)

- **Spec coverage:** §4 modules → Tasks 1–9; R1 → Task 3; R2 → Tasks 1/3/6; R3 → Tasks 5/8; §6 approve gap → Task 7; §7 unit tests → Tasks 1–9; §7 live smoke → Task 11; §8 branch/finish → Task 12. The post-D6 `store.connect()` correctness (a 4th reconciliation found while grounding) is baked into Tasks 6–8.
- **Type consistency:** `scan` returns proposals with `item/classification/pointers/payload/(assignment_id,reused)`; CLI reads exactly those. `seed_proposed` note is `{"payload","pointers"}`; `submit` reads `["payload"]`. `build_seed_payload` → flat `{type, raw_text, source_ref?}` everywhere. Governance writes use `store.connect()` consistently.
- **No placeholders:** every code/test/command step is complete.
