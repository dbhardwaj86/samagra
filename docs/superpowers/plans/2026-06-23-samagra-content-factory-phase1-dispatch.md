# SAMAGRA Content Factory — Phase 1 (Dispatch Spine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize the proven inward bridge (munshi → 1 mcd seed) into an outward **dispatch spine** that fans ONE seed into N catalogued content artifacts, proven on two deterministic, local-write lanes (`revision` + `lecture`) from a textbook-chapter seed — no new prod write path.

**Architecture:** A new `samagra/factory/` package mirrors `samagra/bridge/` structure and reuses its safety shape verbatim: `plan → board-approve → build(guarded write boundary) → captured`. Lanes are entries in a dispatch table mapping `(seed, slug) → existing renderer` (`lectures.export.export_one`). Governance reuses the existing `assignments` columns (`pipeline`=lane, `seed_ref`=parent seed, `artifact_ref` via event) — **no migration**. Per-seed-batch approval (`approve_seed`) implements the Chairman's fork-3 ruling. The build boundary inherits all five bridge guards (status, double-build, in-flight, output-validate, single-write).

**Tech Stack:** Python 3.11, stdlib `sqlite3`, `argparse`, `uuid`, `json`; pytest. Reuses `samagra/lectures/export.py`, `samagra/bridge/outbox.py`, `samagra/bridge/pointers.py`, `samagra/governance/store.py`.

**Spec:** `docs/superpowers/specs/2026-06-23-samagra-content-factory-design.md` (§3.1–§3.3, §5).

---

## File Structure

- Create `samagra/factory/__init__.py` — package marker + one-line docstring.
- Create `samagra/factory/lines.py` — the lane registry (`LINES`) + `classify(seed_ref)`.
- Create `samagra/factory/dispatch.py` — `ENGINES` table, `run_line`, `validate_seed_for_line`, `validate_product`.
- Create `samagra/factory/run.py` — `plan`, `approve`, `approve_seed`, `build` orchestration.
- Modify `samagra/__main__.py` — add the `factory` subcommand (`cmd_factory` + subparser, registered before `args = p.parse_args()`).
- Create `tests/test_factory_lines.py`, `tests/test_factory_dispatch.py`, `tests/test_factory_run.py`, `tests/test_factory_cli.py`.

**Shared test fixture** (paste into the top of each test file that touches governance/catalog/outbox — keeps every test off the real DBs and repo tree):

```python
import pytest
from samagra import config
from samagra.governance import store

@pytest.fixture
def factory_env(tmp_path, monkeypatch):
    """Isolate governance.db + catalog.db + the outbox tree into tmp."""
    monkeypatch.setattr(config, "GOVERNANCE_DB", tmp_path / "governance.db")
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "exports")
    store._INITIALIZED.clear()           # memoized schema cache must not leak across DBs
    monkeypatch.chdir(tmp_path)          # outbox writes board/<agent>/outbox/ under tmp
    yield tmp_path
    store._INITIALIZED.clear()
```

---

### Task 1: `factory.lines` — lane registry + classify

**Files:**
- Create: `samagra/factory/__init__.py`
- Create: `samagra/factory/lines.py`
- Test: `tests/test_factory_lines.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_factory_lines.py
from samagra.factory import lines

def test_textbook_seed_fans_to_revision_and_lecture():
    assert lines.classify("textbook:circular-motion") == ["revision", "lecture"]

def test_unknown_source_fans_to_nothing_in_phase1():
    assert lines.classify("mcd:123") == []
    assert lines.classify("") == []

def test_registry_has_expected_output_labels():
    assert lines.LINES["revision"].expected_output
    assert lines.LINES["lecture"].expected_output
    assert set(lines.LINES) == {"revision", "lecture"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_factory_lines.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'samagra.factory'`

- [ ] **Step 3: Write minimal implementation**

```python
# samagra/factory/__init__.py
"""SAMAGRA content factory: one approved seed -> N content artifacts (the bridge, widened)."""
```

```python
# samagra/factory/lines.py
"""Product-line registry + classify: which content lanes a seed fans out to.

Phase 1 (deterministic, local-write): a textbook-chapter seed (uid 'textbook:<slug>')
fans to a revision sheet (thin) and a full lecture (thick). Pure; no I/O.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Line:
    key: str
    expected_output: str
    variant: str            # the lectures.export variant this lane renders
    source_prefixes: tuple  # seed_ref prefixes this lane applies to


LINES: dict[str, Line] = {
    "revision": Line("revision", "Revision sheet (thin lecture export)",
                     "thin", ("textbook:",)),
    "lecture": Line("lecture", "Full lecture (thick lecture export)",
                    "thick", ("textbook:",)),
}

# Deterministic lane order so a seed always fans out the same way.
_ORDER = ["revision", "lecture"]


def classify(seed_ref: str) -> list[str]:
    """Return the applicable product-line keys for a seed_ref, in stable order."""
    ref = (seed_ref or "").strip()
    if not ref:
        return []
    return [k for k in _ORDER
            if any(ref.startswith(p) for p in LINES[k].source_prefixes)]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_factory_lines.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/__init__.py samagra/factory/lines.py tests/test_factory_lines.py
git commit -m "feat(factory): lane registry + classify (Phase 1 dispatch spine)"
```

---

### Task 2: `factory.dispatch` — engines, input/output validation, run_line

**Files:**
- Create: `samagra/factory/dispatch.py`
- Test: `tests/test_factory_dispatch.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_factory_dispatch.py
import pytest
from samagra.factory import dispatch

def test_run_line_invokes_export_with_the_lane_variant(monkeypatch, tmp_path):
    calls = {}
    html = tmp_path / "circular-motion-thin.html"
    html.write_text("<h1>Circular Motion</h1>", encoding="utf-8")
    def fake_export_one(slug, variant):
        calls["args"] = (slug, variant)
        return {"variant": variant, "html": str(html), "docx": None, "gdoc": None}
    monkeypatch.setattr("samagra.lectures.export.export_one", fake_export_one)

    result = dispatch.run_line("revision", "circular-motion")
    assert calls["args"] == ("circular-motion", "thin")   # revision -> thin
    assert result["html"] == str(html)

def test_validate_product_passes_for_nonempty_html(tmp_path):
    html = tmp_path / "x.html"; html.write_text("<p>ok</p>", encoding="utf-8")
    dispatch.validate_product("revision", {"html": str(html)})  # no raise

def test_validate_product_raises_on_missing_or_empty(tmp_path):
    with pytest.raises(ValueError):
        dispatch.validate_product("revision", {"html": str(tmp_path / "nope.html")})
    empty = tmp_path / "e.html"; empty.write_text("", encoding="utf-8")
    with pytest.raises(ValueError):
        dispatch.validate_product("revision", {"html": str(empty)})

def test_validate_seed_for_line_rejects_wrong_prefix():
    with pytest.raises(ValueError):
        dispatch.validate_seed_for_line("revision", "mcd:1")
    dispatch.validate_seed_for_line("revision", "textbook:circular-motion")  # no raise
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_factory_dispatch.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'samagra.factory.dispatch'`

- [ ] **Step 3: Write minimal implementation**

```python
# samagra/factory/dispatch.py
"""The guarded engine layer: map a lane -> an existing renderer; validate I/O.

Phase 1 lanes are DETERMINISTIC and write only LOCAL artifacts via the lecture
exporter (no new prod write path). validate_product re-asserts the output contract
at the write boundary exactly as bridge.seed_payload.validate_seed_payload does
(spec §3.2 guard 4); the answer-leak hook is a no-op for Phase 1's lecture lanes
but is the structural seam for the later QX/paper lanes.
"""
from __future__ import annotations

from pathlib import Path

from ..lectures import export as lex
from .lines import LINES


def _slug(seed_ref: str) -> str:
    return seed_ref.split(":", 1)[-1]


def validate_seed_for_line(line: str, seed_ref: str) -> None:
    """Cheap pre-check (before recording any build intent): the seed_ref matches
    the lane's source prefix and names a slug."""
    spec = LINES.get(line)
    if spec is None:
        raise ValueError(f"unknown line {line!r}")
    if not any((seed_ref or "").startswith(p) for p in spec.source_prefixes):
        raise ValueError(f"seed {seed_ref!r} is not valid input for line {line!r}")
    if not _slug(seed_ref):
        raise ValueError(f"seed {seed_ref!r} has no slug")


def run_line(line: str, slug: str) -> dict:
    """Run the lane's engine. Phase 1: lecture export with the lane's variant."""
    spec = LINES[line]
    return lex.export_one(slug, spec.variant)


def validate_product(line: str, result: dict) -> None:
    """Write-boundary output guard: the artifact exists, is non-empty, and (for
    answer-bearing lanes — none in Phase 1) carries zero answer data. Raises ValueError."""
    html = result.get("html")
    if not html:
        raise ValueError(f"line {line!r} produced no html artifact")
    p = Path(html)
    if not p.is_file() or p.stat().st_size == 0:
        raise ValueError(f"line {line!r} artifact missing or empty: {html}")
    # Answer-leak structural hook (no-op for lecture lanes; enforced for QX in Phase C).
    _assert_no_answer_leak(line, result)


def _assert_no_answer_leak(line: str, result: dict) -> None:
    # Phase 1 lecture lanes carry no answer columns by construction. The QX
    # paper lane (Phase C) overrides this to assert the student variant has none.
    return
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_factory_dispatch.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/dispatch.py tests/test_factory_dispatch.py
git commit -m "feat(factory): dispatch engines + I/O write-boundary validation"
```

---

### Task 3: `factory.run.plan` — propose children (dry + live + dedup)

**Files:**
- Create: `samagra/factory/run.py`
- Test: `tests/test_factory_run.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_factory_run.py  (paste the `factory_env` fixture from File Structure at the top)
from samagra.factory import run
from samagra.governance import store

def test_plan_dry_returns_two_proposals_and_writes_nothing(factory_env):
    proposals = run.plan("textbook:circular-motion", dry=True)
    assert [p["line"] for p in proposals] == ["revision", "lecture"]
    conn = store.connect()
    try:
        assert store.list_assignments(conn) == []   # dry writes nothing
    finally:
        conn.close()

def test_plan_live_records_two_in_review_children(factory_env):
    proposals = run.plan("textbook:circular-motion", dry=False)
    assert all("assignment_id" in p for p in proposals)
    conn = store.connect()
    try:
        rows = store.list_assignments(conn)
        assert {r["pipeline"] for r in rows} == {"revision", "lecture"}
        assert all(r["status"] == "in-review" for r in rows)
        assert all(r["seed_ref"] == "textbook:circular-motion" for r in rows)
        verbs = [e["verb"] for e in store.list_events(conn)]
        assert verbs.count("product_proposed") == 2
    finally:
        conn.close()

def test_plan_live_is_idempotent_per_seed_and_line(factory_env):
    run.plan("textbook:circular-motion", dry=False)
    again = run.plan("textbook:circular-motion", dry=False)
    assert all(p.get("reused") for p in again)
    conn = store.connect()
    try:
        assert len(store.list_assignments(conn)) == 2   # not 4
    finally:
        conn.close()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_factory_run.py -v`
Expected: FAIL — `ImportError: cannot import name 'run' from 'samagra.factory'` / `AttributeError: plan`

- [ ] **Step 3: Write minimal implementation**

```python
# samagra/factory/run.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_factory_run.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/run.py tests/test_factory_run.py
git commit -m "feat(factory): plan() fans a seed to in-review children (dedup per seed+line)"
```

---

### Task 4: `factory.run.approve` + `approve_seed` (per-seed batch gate — fork 3)

**Files:**
- Modify: `samagra/factory/run.py`
- Test: `tests/test_factory_run.py` (append)

- [ ] **Step 1: Write the failing test**

```python
# append to tests/test_factory_run.py
import pytest

def test_approve_flips_single_child(factory_env):
    [a, _] = run.plan("textbook:circular-motion", dry=False)
    res = run.approve(a["assignment_id"])
    assert res["status"] == "approved"

def test_approve_refuses_non_in_review(factory_env):
    [a, _] = run.plan("textbook:circular-motion", dry=False)
    run.approve(a["assignment_id"])
    with pytest.raises(ValueError):
        run.approve(a["assignment_id"])   # already approved, not in-review

def test_approve_seed_batches_all_children(factory_env):
    run.plan("textbook:circular-motion", dry=False)
    res = run.approve_seed("textbook:circular-motion")
    assert len(res["approved"]) == 2
    conn = store.connect()
    try:
        assert all(r["status"] == "approved" for r in store.list_assignments(conn))
    finally:
        conn.close()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_factory_run.py -k approve -v`
Expected: FAIL — `AttributeError: module 'samagra.factory.run' has no attribute 'approve'`

- [ ] **Step 3: Write minimal implementation**

```python
# append to samagra/factory/run.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_factory_run.py -k approve -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/run.py tests/test_factory_run.py
git commit -m "feat(factory): approve + approve_seed (per-seed batch gate, fork 3)"
```

---

### Task 5: `factory.run.build` — the guarded write boundary (DEC-7, 5 guards)

**Files:**
- Modify: `samagra/factory/run.py`
- Test: `tests/test_factory_run.py` (append)

- [ ] **Step 1: Write the failing test**

```python
# append to tests/test_factory_run.py
def _stub_export(monkeypatch, tmp_path):
    def fake_export_one(slug, variant):
        out = tmp_path / f"{slug}-{variant}.html"
        out.write_text(f"<h1>{slug} {variant}</h1>", encoding="utf-8")
        return {"variant": variant, "html": str(out), "docx": None, "gdoc": None}
    monkeypatch.setattr("samagra.lectures.export.export_one", fake_export_one)

def test_build_runs_engine_and_captures(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    [a, _] = run.plan("textbook:circular-motion", dry=False)
    run.approve(a["assignment_id"])
    res = run.build(a["assignment_id"])
    assert res["artifact_ref"].endswith("circular-motion-thin.html")
    conn = store.connect()
    try:
        row = next(r for r in store.list_assignments(conn) if r["id"] == a["assignment_id"])
        assert row["status"] == "captured"
        verbs = [e["verb"] for e in store.list_events(conn)
                 if e["assignment_id"] == a["assignment_id"]]
        assert "product_building" in verbs and "product_created" in verbs
    finally:
        conn.close()

def test_build_refuses_unapproved(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    [a, _] = run.plan("textbook:circular-motion", dry=False)
    with pytest.raises(ValueError):       # still in-review
        run.build(a["assignment_id"])

def test_build_refuses_double_build(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    [a, _] = run.plan("textbook:circular-motion", dry=False)
    run.approve(a["assignment_id"]); run.build(a["assignment_id"])
    with pytest.raises(ValueError):       # captured -> not approved AND product_created exists
        run.build(a["assignment_id"])

def test_build_refuses_in_flight(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    [a, _] = run.plan("textbook:circular-motion", dry=False)
    run.approve(a["assignment_id"])
    conn = store.connect()                # simulate a crashed prior build: intent, no created
    try:
        store.append_event(conn, actor=run._AGENT, verb="product_building",
                           assignment_id=a["assignment_id"], subsystem="factory")
    finally:
        conn.close()
    with pytest.raises(ValueError):
        run.build(a["assignment_id"])

def test_build_validates_output(factory_env, monkeypatch):
    def empty_export(slug, variant):
        out = factory_env / f"{slug}-{variant}.html"; out.write_text("", encoding="utf-8")
        return {"variant": variant, "html": str(out)}
    monkeypatch.setattr("samagra.lectures.export.export_one", empty_export)
    [a, _] = run.plan("textbook:circular-motion", dry=False)
    run.approve(a["assignment_id"])
    with pytest.raises(ValueError):       # empty artifact fails the boundary guard
        run.build(a["assignment_id"])
    conn = store.connect()
    try:
        row = next(r for r in store.list_assignments(conn) if r["id"] == a["assignment_id"])
        assert row["status"] != "captured"   # not captured on a failed build
    finally:
        conn.close()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_factory_run.py -k build -v`
Expected: FAIL — `AttributeError: module 'samagra.factory.run' has no attribute 'build'`

- [ ] **Step 3: Write minimal implementation**

```python
# append to samagra/factory/run.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_factory_run.py -k build -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/run.py tests/test_factory_run.py
git commit -m "feat(factory): guarded build() write boundary (DEC-7; 5 bridge guards)"
```

---

### Task 6: Fan-out acceptance test (spec §5)

**Files:**
- Test: `tests/test_factory_run.py` (append)

- [ ] **Step 1: Write the failing test**

```python
# append to tests/test_factory_run.py
def test_one_seed_fans_to_two_captured_artifacts(factory_env, monkeypatch):
    _stub_export(monkeypatch, factory_env)
    seed = "textbook:circular-motion"
    run.plan(seed, dry=False)
    run.approve_seed(seed)                       # per-seed batch
    conn = store.connect()
    try:
        ids = [r["id"] for r in store.list_assignments(conn)]
    finally:
        conn.close()
    arts = [run.build(i)["artifact_ref"] for i in ids]
    assert len(arts) == 2 and len(set(arts)) == 2   # two distinct catalogued artifacts
    conn = store.connect()
    try:
        assert all(r["status"] == "captured" for r in store.list_assignments(conn))
        created = [e for e in store.list_events(conn) if e["verb"] == "product_created"]
        assert len(created) == 2
        assert all(e["subsystem_ref"] for e in created)   # provenance recorded
    finally:
        conn.close()
```

- [ ] **Step 2: Run test to verify it fails (or passes if Tasks 1-5 complete)**

Run: `python -m pytest tests/test_factory_run.py -k fans -v`
Expected: PASS once Tasks 1–5 are in (this is the integration acceptance — if it fails, a guard/ordering regression exists).

- [ ] **Step 3: (no new impl expected)** — if the test fails, fix the regression it exposes in `run.py`/`dispatch.py`, do not weaken the test.

- [ ] **Step 4: Run the full factory suite**

Run: `python -m pytest tests/test_factory_lines.py tests/test_factory_dispatch.py tests/test_factory_run.py -v`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add tests/test_factory_run.py
git commit -m "test(factory): one-seed -> two-captured-artifacts fan-out acceptance (spec §5)"
```

---

### Task 7: CLI `samagra factory plan|approve|approve-seed|build`

**Files:**
- Modify: `samagra/__main__.py` (add `cmd_factory` near `cmd_bridge:130`; register subparser before `args = p.parse_args():217`)
- Test: `tests/test_factory_cli.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_factory_cli.py
import samagra.__main__ as cli

def test_factory_plan_dispatches(monkeypatch, capsys):
    seen = {}
    monkeypatch.setattr("samagra.factory.run.plan",
                        lambda seed_ref, dry: seen.setdefault("plan", (seed_ref, dry)) or [])
    monkeypatch.setattr("sys.argv",
                        ["samagra", "factory", "plan", "textbook:circular-motion", "--dry-run"])
    cli.main()
    assert seen["plan"] == ("textbook:circular-motion", True)

def test_factory_approve_seed_dispatches(monkeypatch):
    seen = {}
    monkeypatch.setattr("samagra.factory.run.approve_seed",
                        lambda seed_ref: seen.setdefault("ref", seed_ref) or {"approved": []})
    monkeypatch.setattr("sys.argv",
                        ["samagra", "factory", "approve-seed", "textbook:circular-motion"])
    cli.main()
    assert seen["ref"] == "textbook:circular-motion"

def test_factory_build_dispatches(monkeypatch):
    seen = {}
    monkeypatch.setattr("samagra.factory.run.build",
                        lambda aid: seen.setdefault("aid", aid) or {"artifact_ref": "x", "line": "revision"})
    monkeypatch.setattr("sys.argv", ["samagra", "factory", "build", "abc123"])
    cli.main()
    assert seen["aid"] == "abc123"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_factory_cli.py -v`
Expected: FAIL — argparse exits 2 (`invalid choice: 'factory'`)

- [ ] **Step 3: Write minimal implementation**

Add `cmd_factory` after `cmd_bridge` (`samagra/__main__.py:150`):

```python
def cmd_factory(args) -> None:
    from .factory import run

    if args.action == "plan":
        proposals = run.plan(args.seed_ref, dry=args.dry_run)
        mode = "dry-run" if args.dry_run else "live"
        print(f"factory plan ({mode}): {len(proposals)} line(s) for {args.seed_ref}")
        for p in proposals:
            aid = p.get("assignment_id", "-")
            tag = " (reused)" if p.get("reused") else ""
            print(f"  [{aid}] {p['line']:9} -> {p['expected_output']}{tag}")
    elif args.action == "approve":
        res = run.approve(args.assignment_id)
        print(f"approved {args.assignment_id} -> {res['status']}")
    elif args.action == "approve-seed":
        res = run.approve_seed(args.seed_ref)
        print(f"approved {len(res['approved'])} child(ren) of {args.seed_ref}")
    elif args.action == "build":
        res = run.build(args.assignment_id)
        print(f"built {args.assignment_id} -> {res['line']}: {res['artifact_ref']}")
```

Register the subparser before `args = p.parse_args()` (`samagra/__main__.py:217`):

```python
    ft = sub.add_parser("factory", help="content factory: one seed -> N content artifacts")
    ft_sub = ft.add_subparsers(dest="action", required=True)
    ft_plan = ft_sub.add_parser("plan", help="fan a seed out to product lines")
    ft_plan.add_argument("seed_ref", help="e.g. textbook:circular-motion")
    ft_plan.add_argument("--dry-run", action="store_true", help="propose only; record nothing")
    ft_ap = ft_sub.add_parser("approve", help="approve one in-review child")
    ft_ap.add_argument("assignment_id")
    ft_aps = ft_sub.add_parser("approve-seed", help="approve ALL in-review children of a seed (batch)")
    ft_aps.add_argument("seed_ref")
    ft_bld = ft_sub.add_parser("build", help="build an APPROVED child (the guarded write boundary)")
    ft_bld.add_argument("assignment_id")
    ft.set_defaults(func=cmd_factory)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_factory_cli.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add samagra/__main__.py tests/test_factory_cli.py
git commit -m "feat(factory): samagra factory plan|approve|approve-seed|build CLI"
```

---

### Task 8: Full-suite green + DEC-7 Codex pre-merge review

**Files:** none (gate + review)

- [ ] **Step 1: Run the whole backend suite**

Run: `python -m pytest -q`
Expected: PASS — 272 prior + the new factory tests (~21), no regressions. (On Windows the suite may exit 1 from a tmpdir symlink-cleanup teardown *after* all pass — cosmetic; re-run with `--basetemp` to confirm.)

- [ ] **Step 2: Live golden-thread smoke (one real chapter)**

Run:
```bash
python -m samagra factory plan textbook:circular-motion --dry-run   # see 2 lines proposed
python -m samagra factory plan textbook:circular-motion             # record 2 in-review children
python -m samagra factory approve-seed textbook:circular-motion     # batch approve
# build each printed assignment id:
python -m samagra factory build <id-revision>
python -m samagra factory build <id-lecture>
```
Expected: two local artifacts under `state/exports/circular-motion/` (thin + thick HTML, DOCX if pandoc present); both assignments `captured`.

- [ ] **Step 3: DEC-7 Codex pre-merge review of the new write boundary**

Run: `python -m samagra review-staged` (advisory) AND request an independent Codex review of `samagra/factory/` focused on the `build` boundary (double-build, in-flight, output-validate) — mirror the bridge review-22 discipline. Remediate any confirmed High/Medium TDD before merge.

- [ ] **Step 4: Finish the branch**

Use `superpowers:finishing-a-development-branch` to present merge options. Then sync `STATUS.html` / `SUMMARY.html` / `HANDOFF.md` (Phase 1 shipped) and record the plan with `cbm record-plan docs/superpowers/plans/2026-06-23-samagra-content-factory-phase1-dispatch.md --title "Content Factory Phase 1"`.

- [ ] **Step 5: Commit any review fixes**

```bash
git add -A && git commit -m "harden(factory): resolve Phase-1 Codex pre-merge review findings"
```

---

## Self-Review

**Spec coverage:** §3.1 dispatch spine → Tasks 1–7; §3.2 five guards → Task 5 (+ Task 2 validate); §3.3 governance reuse / no-migration → Tasks 3–5 use existing `pipeline`/`seed_ref` columns + new event verbs only; §5 acceptance (fan-out, per-seed batch, guards, no new prod path) → Tasks 4–6; DEC-7 Codex review → Task 8. Phases C–G are explicitly out of Phase-1 scope (spec §6).

**Placeholder scan:** none — every code step is complete and runnable.

**Type consistency:** `Line(key, expected_output, variant, source_prefixes)` is consistent across `lines.py`, `dispatch.py` (`LINES[line].variant`, `.source_prefixes`), and `run.py` (`LINES[line].expected_output`). `plan` returns dicts with `seed_ref|line|expected_output|pointers|assignment_id|reused`; `build` returns `assignment_id|line|artifact_ref` — both consumed consistently by the CLI in Task 7. Event verbs `product_proposed|product_building|product_created` are used identically in `run.py` and asserted in tests.
