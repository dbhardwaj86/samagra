# Content Factory Phase C3 — `seed` (mcd) lane / bridge fold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the existing munshi→mcd bridge write into the factory dispatch as the canonical `seed` (kind=`mcd`) lane, so there is **exactly one** mcd-write path, behind the same five guards.

**Architecture:** Activate the `Line.kind="mcd"` seam (parked by C1). `classify("munshi:<id>") → ["seed"]`. The factory grows a `scan` discovery verb (the folded `bridge.scan`) and `plan("munshi:<id>")` that fetch a munshi content item, build the **reused** flat `create_seed` payload, and record it in the `product_proposed` event note. `build()` gains a small `kind=="mcd"` branch: load + `validate_seed_payload` **before** recording intent (anti-wedge), then `dispatch.run_seed(payload)` performs the ONE prod write (`McdClient.create_seed`) at the boundary; `artifact_ref = "mcd:<seed_id>"`. The five crash-safety guards are written once and reused for every kind. `samagra bridge {scan,approve,submit}` become thin **deprecating delegators** to the factory — `bridge.submit`'s prod write is retired. The payload helpers relocate to `factory/seed_payload.py`; `bridge/seed_payload.py` becomes a re-export shim.

**Tech Stack:** Python 3.14, pytest, sqlite (`governance.db`), `requests` (mocked in tests), the existing `McdClient` / `MunshiAdapter` / catalog FTS.

**Spec:** `docs/superpowers/specs/2026-06-23-samagra-content-factory-phase-c-design.md` §3.3, §5, §6 (C3 acceptance). **Mirrors:** the proven, Codex-reviewed bridge (`samagra/bridge/run.py`, reviews 22/23).

**Invariants that MUST hold (acceptance, spec §6 C3):**
1. A `munshi:` content seed plans → approves → builds **exactly one** mcd seed via the factory.
2. `validate_seed_payload` gates the write (re-asserts `{type ∈ SEED_TYPES, raw_text non-empty}`).
3. double-build, in-flight, and status guards all refuse.
4. `samagra bridge submit` **no longer writes** (delegates/retired) ⇒ exactly **one** mcd-write path.
5. The migrated bridge behaviors stay green.
6. No migration (existing `assignments` columns; new event verb reuse `product_*`); publish gate untouched; the seven read-only subsystems stay read-only (the `seed` lane uses only the existing `create_seed` capture contract — no NEW subsystem, no new web endpoint).
7. **Gate:** pytest green + a **dedicated DEC-7 Codex pre-merge review** of the prod-write boundary before merge.

---

## File structure

| File | Change | Responsibility |
|---|---|---|
| `samagra/factory/lines.py` | modify | register `seed` lane (kind=`mcd`, prefix `munshi:`); extend `_ORDER` |
| `samagra/factory/seed_payload.py` | **create** | canonical home for `SEED_TYPES` / `build_seed_payload` / `validate_seed_payload` (relocated from bridge) |
| `samagra/bridge/seed_payload.py` | rewrite → shim | thin re-export of `factory.seed_payload` (nothing breaks mid-migration) |
| `samagra/factory/dispatch.py` | modify | `run_line` refuses mcd; add `run_seed(payload)` = the ONE mcd prod write at the boundary |
| `samagra/factory/run.py` | modify | `_item_from_artifact`, `_munshi_item_for`, `_record_seed_proposal`, `_load_proposed_payload`; `scan()`; `plan()` munshi branch; `build()` mcd branch |
| `samagra/bridge/run.py` | rewrite → delegators | `scan/approve/submit` print a deprecation notice + forward to the factory; the prod write is retired |
| `samagra/__main__.py` | modify | `samagra factory scan` verb; robust `cmd_bridge` submit print |
| `tests/test_factory_lines.py` | modify | seed registry + classify + kind |
| `tests/test_factory_seed_payload.py` | **create** | payload-shape tests (moved to the new home) |
| `tests/test_factory_seed.py` | **create** | migrated + new seed-lane workflow tests (scan/plan/approve/build, all guards, McdClient mocked) |
| `tests/test_factory_dispatch.py` | modify | `run_seed` + `run_line` mcd-refusal tests |
| `tests/test_bridge.py` | modify | keep pure helpers + CLI dispatch; add shim re-export + 3 delegation tests; drop the migrated workflow + 2 firewall tests |
| `scripts/c3_smoke.py` | **create** | live golden thread (real munshi item → one real mcd seed) in an isolated governance store; flags cleanup |

No migration: `assignments` already carries `pipeline`/`seed_ref`/`artifact_ref`; the seed lane reuses the `product_proposed`/`product_building`/`product_created` verbs.

---

## Task 1 — register the `seed` lane

**Files:**
- Modify: `samagra/factory/lines.py`
- Test: `tests/test_factory_lines.py`

- [ ] **Step 1: Write the failing tests** — append to `tests/test_factory_lines.py`:

```python
def test_munshi_seed_fans_to_the_seed_lane_only():
    assert lines.classify("munshi:42") == ["seed"]


def test_textbook_seed_still_fans_to_five_content_lanes_not_seed():
    # the mcd seed lane has a munshi: prefix, so a textbook seed never reaches it
    assert lines.classify("textbook:circular-motion") == [
        "revision", "lecture", "deck", "paper", "drill"]


def test_seed_line_is_mcd_kind_and_munshi_sourced():
    seed = lines.LINES["seed"]
    assert seed.kind == "mcd"
    assert seed.source_prefixes == ("munshi:",)


def test_registry_now_has_six_lanes_including_seed():
    assert set(lines.LINES) == {
        "revision", "lecture", "deck", "paper", "drill", "seed"}
```

Also UPDATE the existing `test_registry_has_expected_output_labels` set assertion (it pins the lane set to five):

```python
def test_registry_has_expected_output_labels():
    for key in ("revision", "lecture", "deck", "paper", "drill", "seed"):
        assert lines.LINES[key].expected_output
    assert set(lines.LINES) == {
        "revision", "lecture", "deck", "paper", "drill", "seed"}
```

- [ ] **Step 2: Run, expect FAIL**

Run: `python -m pytest tests/test_factory_lines.py -q`
Expected: FAIL (`KeyError: 'seed'` / set mismatch).

- [ ] **Step 3: Register the lane** — in `samagra/factory/lines.py`, add to `LINES` and extend `_ORDER`:

```python
    "drill": Line("drill", "Adaptive drill set (answer-safe)",
                  "drill", ("textbook:",), "qx"),
    # C3: the folded munshi->mcd bridge. variant=None (no slug render — build()
    # runs the mcd path directly from the proposed payload). The ONLY mcd writer.
    "seed": Line("seed", "mycontentdev editorial seed",
                 None, ("munshi:",), "mcd"),
}

# Deterministic lane order so a seed always fans out the same way.
_ORDER = ["revision", "lecture", "deck", "paper", "drill", "seed"]
```

- [ ] **Step 4: Run, expect PASS**

Run: `python -m pytest tests/test_factory_lines.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/lines.py tests/test_factory_lines.py
git commit -m "feat(factory): register the mcd seed lane + classify(munshi:) (Phase C3 T1)"
```

---

## Task 2 — relocate the payload helpers to the canonical writer

**Files:**
- Create: `samagra/factory/seed_payload.py`
- Rewrite: `samagra/bridge/seed_payload.py` (→ shim)
- Test: `tests/test_factory_seed_payload.py` (create)

- [ ] **Step 1: Write the failing tests** — create `tests/test_factory_seed_payload.py`:

```python
"""Payload-shape tests, re-homed with seed_payload.py to the factory (Phase C3)."""
from __future__ import annotations

from samagra.factory.seed_payload import (
    SEED_TYPES, build_seed_payload, validate_seed_payload)
import pytest


def test_build_seed_payload_rough_idea_flat_body():
    item = {"id": "42", "uid": "munshi:42", "kind": "note",
            "payload": {"issue": "Idea: show work done by friction with a slider"},
            "status": "open"}
    body = build_seed_payload(item, [])
    assert body == {"type": "rough_idea",
                    "raw_text": "Idea: show work done by friction with a slider",
                    "source_ref": "munshi:42"}
    assert "detail" not in body                       # R1: worker drops nested detail{}


def test_build_seed_payload_question_maps_type():
    item = {"id": "7", "uid": "munshi:7", "kind": "question",
            "payload": {"stem": "A 2 kg block slides down a 30 deg incline; find a."},
            "status": "open"}
    body = build_seed_payload(item, [])
    assert body["type"] == "question"
    assert body["raw_text"].startswith("A 2 kg block")
    assert body["source_ref"] == "munshi:7"


def test_build_seed_payload_source_ref_from_id_when_no_uid():
    body = build_seed_payload(
        {"id": "9", "kind": "todo", "payload": {"task": "rotational kinetic energy demo"}}, [])
    assert body["source_ref"] == "munshi:9"


def test_validate_seed_payload_rejects_bad_type_and_empty_text():
    with pytest.raises(ValueError, match="type"):
        validate_seed_payload({"type": "nope", "raw_text": "x"})
    with pytest.raises(ValueError, match="raw_text"):
        validate_seed_payload({"type": "question", "raw_text": "   "})
    validate_seed_payload({"type": "rough_idea", "raw_text": "ok"})   # no raise


def test_seed_types_contract_unchanged():
    assert {"question", "rough_idea"} <= SEED_TYPES
```

- [ ] **Step 2: Run, expect FAIL**

Run: `python -m pytest tests/test_factory_seed_payload.py -q`
Expected: FAIL (`ModuleNotFoundError: samagra.factory.seed_payload`).

- [ ] **Step 3: Create the canonical module** — `samagra/factory/seed_payload.py` (verbatim move of the bridge body; the factory is the canonical mcd writer now):

```python
"""Build + validate the FLAT POST /api/seeds capture fields for a munshi item.

CANONICAL HOME (Phase C3 / F-C2): the factory `seed` lane is the one mcd writer,
so these helpers live with it. `bridge/seed_payload.py` re-exports from here for
backward compatibility.

The deployed worker parses multipart form-data and the live /api/mcd/seeds
forwards only {type, raw_text, title?, source_ref?}; a nested detail{} would be
dropped. So we emit the flat, proven contract here and keep the corpus pointers +
full proposal in SAMAGRA's own product_proposed event + outbox file.
"""
from __future__ import annotations

from ..bridge.text import item_text

# The seed types the mycontentdev capture endpoint accepts (mirrors the
# /api/mcd/seeds route's _SEED_TYPES). build_seed_payload only ever emits
# "question" or "rough_idea", but the set is the contract validate_seed_payload
# enforces at the mcd write boundary.
SEED_TYPES = {"concept", "question", "snippet", "simulation_idea",
              "experiment", "notebooklm_link", "rough_idea"}


def validate_seed_payload(body: dict) -> None:
    """Enforce the same shape the /api/mcd/seeds route enforces.

    The factory build() calls McdClient.create_seed directly (the proven flat
    form-POST), bypassing that FastAPI route — so the route's type/raw_text
    validation must be re-asserted here or an empty-stem item would write a blank
    seed to prod. Raises ValueError on a bad payload.
    """
    if body.get("type") not in SEED_TYPES:
        raise ValueError(
            "seed type must be one of: " + ", ".join(sorted(SEED_TYPES)))
    raw_text = body.get("raw_text")
    if not isinstance(raw_text, str) or not raw_text.strip():
        raise ValueError("seed raw_text is required (non-empty string)")


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

- [ ] **Step 4: Rewrite the bridge module as a shim** — replace `samagra/bridge/seed_payload.py` with:

```python
"""DEPRECATED home — relocated to samagra/factory/seed_payload.py (Phase C3 /
F-C2: the factory seed lane is the canonical mcd writer). Re-exported here so
existing imports keep working; prefer importing from samagra.factory.seed_payload.
"""
from __future__ import annotations

from ..factory.seed_payload import (  # noqa: F401
    SEED_TYPES, build_seed_payload, validate_seed_payload, _source_ref)

__all__ = ["SEED_TYPES", "build_seed_payload", "validate_seed_payload"]
```

- [ ] **Step 5: Run both — the new tests AND the bridge tests (shim regression)**

Run: `python -m pytest tests/test_factory_seed_payload.py tests/test_bridge.py -q`
Expected: PASS (the bridge tests import `from samagra.bridge.seed_payload import build_seed_payload` — the shim keeps them green).

- [ ] **Step 6: Commit**

```bash
git add samagra/factory/seed_payload.py samagra/bridge/seed_payload.py tests/test_factory_seed_payload.py
git commit -m "refactor(factory): relocate seed_payload to the canonical writer + bridge shim (Phase C3 T2)"
```

---

## Task 3 — `dispatch.run_seed` (the mcd write boundary) + `run_line` mcd refusal

**Files:**
- Modify: `samagra/factory/dispatch.py`
- Test: `tests/test_factory_dispatch.py`

- [ ] **Step 1: Write the failing tests** — append to `tests/test_factory_dispatch.py`:

```python
def test_run_line_refuses_the_mcd_seed_lane(monkeypatch):
    # defense in depth: build() runs the mcd path directly; run_line must never
    # fall through to the lecture exporter for an mcd lane.
    with pytest.raises(ValueError, match="mcd"):
        dispatch.run_line("seed", "munshi:1")


def test_run_seed_validates_creates_and_returns_mcd_artifact_ref(monkeypatch):
    calls = []

    class _Client:
        def create_seed(self, body):
            calls.append(body)
            return {"id": "seed-77", "status": "captured"}
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Client())

    payload = {"type": "question", "raw_text": "Find a.", "source_ref": "munshi:1"}
    res = dispatch.run_seed(payload)
    assert calls == [payload]                          # exactly one create, exact flat body
    assert res["artifact_ref"] == "mcd:seed-77"
    assert res["seed_id"] == "seed-77"
    assert res["seed"]["id"] == "seed-77"


def test_run_seed_refuses_a_bad_payload_before_writing(monkeypatch):
    class _Boom:
        def create_seed(self, body):  # pragma: no cover
            raise AssertionError("must not POST an invalid payload")
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Boom())
    with pytest.raises(ValueError):
        dispatch.run_seed({"type": "question", "raw_text": ""})


def test_run_seed_refuses_a_response_with_no_id(monkeypatch):
    class _Client:
        def create_seed(self, body):
            return {"status": "captured"}              # no id
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Client())
    with pytest.raises(ValueError, match="no seed id"):
        dispatch.run_seed({"type": "rough_idea", "raw_text": "x"})
```

- [ ] **Step 2: Run, expect FAIL**

Run: `python -m pytest tests/test_factory_dispatch.py -q`
Expected: FAIL (`run_seed` undefined; `run_line("seed", ...)` does not raise).

- [ ] **Step 3: Implement** — in `samagra/factory/dispatch.py`:

(a) extend the imports near the top:

```python
from ..lectures import export as lex
from ..clients.mcd_client import McdClient
from . import deck, paper
from .lines import LINES
from .seed_payload import validate_seed_payload
```

(b) in `run_line`, refuse the mcd kind BEFORE the export fall-through:

```python
    spec = LINES[line]
    if line == "deck":
        return deck.build_deck(slug)
    if spec.kind == "qx":
        return paper.build_paper(slug, variant=line)
    if spec.kind == "mcd":
        raise ValueError(
            f"line {line!r} is an mcd lane — built via the seed path (run_seed), "
            f"not run_line")
    return lex.export_one(slug, spec.variant, upload_gdocs=False)
```

(c) add `run_seed` (place it after `run_line`):

```python
def run_seed(payload: dict) -> dict:
    """The mcd (`seed`) lane produce step — the ONE prod write after the bridge
    fold (F-C2). Re-assert the payload contract at the literal write boundary
    (belt-and-suspenders: build() also validates BEFORE recording intent, but
    run_seed is the only mcd writer and must never POST an unvalidated body even
    if a future caller forgets), create the seed via the existing owner-initiated
    capture contract (McdClient.create_seed), and return a result carrying the new
    seed id. Raises ValueError on a bad payload OR a response with no id — never a
    silent blank/duplicate write."""
    validate_seed_payload(payload)
    seed = McdClient().create_seed(payload)
    seed_id = seed.get("id") if isinstance(seed, dict) else None
    if not seed_id:
        raise ValueError(
            "mcd create_seed returned no seed id — refusing to mark captured")
    return {"variant": "seed", "seed": seed, "seed_id": str(seed_id),
            "artifact_ref": f"mcd:{seed_id}"}
```

- [ ] **Step 4: Run, expect PASS**

Run: `python -m pytest tests/test_factory_dispatch.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/dispatch.py tests/test_factory_dispatch.py
git commit -m "feat(factory): dispatch.run_seed mcd write boundary + run_line refuses mcd (Phase C3 T3)"
```

---

## Task 4 — `run.py`: scan / plan(munshi) / build(mcd)

**Files:**
- Modify: `samagra/factory/run.py`
- Test: `tests/test_factory_seed.py` (create)

- [ ] **Step 1: Write the failing tests** — create `tests/test_factory_seed.py`:

```python
"""Phase C3 — the factory `seed` (mcd) lane. McdClient/MunshiAdapter are mocked;
no live calls. Mirrors the proven bridge behaviors, re-homed to the factory."""
from __future__ import annotations

import json
import pytest

from samagra import catalog, config
from samagra.governance import store
from samagra.factory import run


@pytest.fixture
def seed_env(tmp_path, monkeypatch):
    """Isolate governance.db + catalog.db + the outbox tree into tmp."""
    monkeypatch.setattr(config, "GOVERNANCE_DB", tmp_path / "governance.db")
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "exports")
    store._INITIALIZED.clear()
    store.ensure_tables()
    # a catalog so resolve_pointers has something to read (empty is fine too)
    con = catalog.connect()
    con.close()
    monkeypatch.chdir(tmp_path)
    yield tmp_path
    store._INITIALIZED.clear()


def _munshi_items():
    return [
        {"id": "1", "kind": "question", "status": "open", "ts": "2026-06-19T00:00:00Z",
         "payload": {"stem": "Find acceleration of a block on a frictionless incline?"}},
        {"id": "2", "kind": "issue", "status": "open", "ts": "2026-06-19T00:01:00Z",
         "payload": {"summary": "Projector broken in room 4"}},
    ]


class _FakeMunshiAdapter:
    def __init__(self, items): self._items = items
    def available(self): return True
    def artifacts(self):
        from samagra.adapters.base import Artifact
        from samagra.bridge.text import item_text
        for it in self._items:
            yield Artifact(
                uid=f"munshi:{it['id']}", source="munshi", kind=it["kind"],
                title=item_text(it)[:60], subject="physics",
                status=it["status"], updated_at=it.get("ts"),
                meta={"payload": it["payload"], "tags": it.get("tags"),
                      "person": it.get("person"), "due": it.get("due")})


def _mock_munshi(monkeypatch, items):
    monkeypatch.setattr(run, "MunshiAdapter", lambda: _FakeMunshiAdapter(items))


class _NoMcd:
    def create_seed(self, p):  # pragma: no cover
        raise AssertionError("must not create a seed here")


# --- scan (the folded bridge.scan) -------------------------------------------

def test_scan_dry_proposes_content_only_and_writes_nothing(seed_env, monkeypatch):
    _mock_munshi(monkeypatch, _munshi_items())
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", _NoMcd)
    monkeypatch.setattr(run.store, "add_assignment",
                        lambda *a, **k: (_ for _ in ()).throw(
                            AssertionError("dry scan must not write")))
    proposals = run.scan(dry=True)
    assert len(proposals) == 1                          # only the question item
    p = proposals[0]
    assert p["seed_ref"] == "munshi:1"
    assert p["line"] == "seed"
    assert p["payload"]["type"] == "question"
    assert "assignment_id" not in p                     # dry: nothing recorded


def test_scan_live_records_in_review_seed_lane_and_dedups(seed_env, monkeypatch):
    _mock_munshi(monkeypatch, _munshi_items())
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", _NoMcd)
    proposals = run.scan(dry=False)
    assert len(proposals) == 1
    aid = proposals[0]["assignment_id"]
    conn = store.connect()
    try:
        rows = [a for a in store.list_assignments(conn) if a["seed_ref"] == "munshi:1"]
        assert len(rows) == 1
        assert rows[0]["status"] == "in-review"
        assert rows[0]["pipeline"] == "seed"            # the factory seed lane, NOT mycontentdev
        evs = [e for e in store.list_events_for_assignment(conn, aid)
               if e["verb"] == "product_proposed"]
        assert len(evs) == 1
        note = json.loads(evs[0]["note"])
        assert note["payload"]["type"] == "question"    # payload carried for build()
    finally:
        conn.close()
    again = run.scan(dry=False)
    assert again[0].get("reused") is True
    conn = store.connect()
    try:
        rows = [a for a in store.list_assignments(conn) if a["seed_ref"] == "munshi:1"]
        assert len(rows) == 1                            # still exactly one
    finally:
        conn.close()


def test_scan_skips_already_captured_item(seed_env, monkeypatch):
    """Status-blind dedup: a munshi item already CAPTURED must not be re-proposed."""
    _mock_munshi(monkeypatch, _munshi_items())
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", _NoMcd)
    conn = store.connect()
    try:
        store.add_assignment(conn, id="old1", agent="khanak", outbox_path="o",
                             pipeline="seed", seed_ref="munshi:1")
        store.set_assignment_status(conn, "old1", "in-review")
        store.set_assignment_status(conn, "old1", "approved")
        store.set_assignment_status(conn, "old1", "captured")
    finally:
        conn.close()
    proposals = run.scan(dry=False)
    conn = store.connect()
    try:
        rows = [a for a in store.list_assignments(conn) if a["seed_ref"] == "munshi:1"]
        assert len(rows) == 1 and rows[0]["id"] == "old1"
    finally:
        conn.close()
    assert proposals and proposals[0].get("reused") is True


def test_scan_returns_empty_when_munshi_unavailable(monkeypatch):
    class _Unavail:
        def available(self): return False
        def artifacts(self):  # pragma: no cover
            raise AssertionError("must not read artifacts when unavailable")
    monkeypatch.setattr(run, "MunshiAdapter", lambda: _Unavail())
    assert run.scan(dry=True) == []
    assert run.scan(dry=False) == []


def test_scan_degrades_when_munshi_read_raises(monkeypatch):
    class _Flaky:
        def available(self): return True
        def artifacts(self): raise RuntimeError("munshi 503")
    monkeypatch.setattr(run, "MunshiAdapter", lambda: _Flaky())
    assert run.scan(dry=True) == []


# --- plan("munshi:<id>") — a single seed proposal ----------------------------

def test_plan_munshi_id_proposes_one_seed(seed_env, monkeypatch):
    _mock_munshi(monkeypatch, _munshi_items())
    proposals = run.plan("munshi:1", dry=False)
    assert len(proposals) == 1
    assert proposals[0]["line"] == "seed"
    assert proposals[0]["seed_ref"] == "munshi:1"
    assert "assignment_id" in proposals[0]


def test_plan_munshi_id_returns_empty_for_ops_item(seed_env, monkeypatch):
    _mock_munshi(monkeypatch, _munshi_items())
    assert run.plan("munshi:2", dry=False) == []        # the 'issue' item is ops


def test_plan_textbook_is_unchanged_and_never_includes_seed(seed_env):
    proposals = run.plan("textbook:circular-motion", dry=False)
    assert [p["line"] for p in proposals] == [
        "revision", "lecture", "deck", "paper", "drill"]


# --- build() mcd branch — the prod write -------------------------------------

def _approved_seed_assignment(monkeypatch, seed="munshi:1"):
    _mock_munshi(monkeypatch, _munshi_items())
    aid = run.plan(seed, dry=False)[0]["assignment_id"]
    run.approve(aid)
    return aid


def test_build_seed_creates_one_mcd_seed_and_captures(seed_env, monkeypatch):
    aid = _approved_seed_assignment(monkeypatch)
    calls = []

    class _Client:
        def create_seed(self, p):
            calls.append(p); return {"id": "seed-99", "status": "captured"}
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Client())

    res = run.build(aid)
    assert len(calls) == 1                                # exactly one prod write
    assert calls[0]["type"] == "question" and calls[0]["raw_text"]
    assert res["artifact_ref"] == "mcd:seed-99"
    conn = store.connect()
    try:
        row = next(r for r in store.list_assignments(conn) if r["id"] == aid)
        assert row["status"] == "captured"
        verbs = [e["verb"] for e in store.list_events_for_assignment(conn, aid)]
        assert "product_building" in verbs and "product_created" in verbs
        created = next(e for e in store.list_events_for_assignment(conn, aid)
                       if e["verb"] == "product_created")
        assert created["subsystem_ref"] == "seed-99"     # provenance = the seed id
    finally:
        conn.close()


def test_build_seed_refuses_double_build(seed_env, monkeypatch):
    aid = _approved_seed_assignment(monkeypatch)
    n = {"c": 0}

    class _Client:
        def create_seed(self, p):
            n["c"] += 1; return {"id": "seed-1", "status": "captured"}
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Client())
    run.build(aid)
    with pytest.raises(ValueError):
        run.build(aid)                                   # captured -> refused
    assert n["c"] == 1                                    # never a double prod write


def test_build_seed_refuses_in_flight_after_crash(seed_env, monkeypatch):
    """A prior build recorded product_building but never product_created (crash in
    the write window) — a retry must REFUSE, never blindly create a second seed."""
    aid = _approved_seed_assignment(monkeypatch)
    conn = store.connect()
    try:
        store.append_event(conn, actor=run._AGENT, verb="product_building",
                           assignment_id=aid, subsystem="factory",
                           subsystem_ref="munshi:1", note="crashed intent")
    finally:
        conn.close()

    class _Boom:
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("must not create a second seed for an in-flight build")
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Boom())
    with pytest.raises(ValueError, match="in-flight"):
        run.build(aid)


def test_build_seed_refuses_unapproved(seed_env, monkeypatch):
    _mock_munshi(monkeypatch, _munshi_items())
    aid = run.plan("munshi:1", dry=False)[0]["assignment_id"]   # still in-review

    class _Boom:
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("must not create a seed for an unapproved assignment")
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Boom())
    with pytest.raises(ValueError, match="approved"):
        run.build(aid)


def test_build_seed_refuses_when_no_proposed_payload(seed_env, monkeypatch):
    """An approved seed assignment with NO product_proposed payload (contrived) must
    refuse rather than POST a guessed body."""
    conn = store.connect()
    try:
        store.add_assignment(conn, id="np1", agent="khanak", outbox_path="o",
                             pipeline="seed", seed_ref="munshi:1")
        store.set_assignment_status(conn, "np1", "in-review")
        store.set_assignment_status(conn, "np1", "approved")
    finally:
        conn.close()

    class _Boom:
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("must not create a seed without a recorded payload")
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Boom())
    with pytest.raises(ValueError, match="no proposed payload"):
        run.build("np1")


def test_build_seed_refuses_empty_raw_text_before_writing(seed_env, monkeypatch):
    """validate_seed_payload gates the write: an approved seed whose recorded payload
    has empty raw_text must refuse BEFORE create_seed, and must NOT wedge the
    assignment in-flight (no build intent recorded for a never-attempted write)."""
    conn = store.connect()
    try:
        store.add_assignment(conn, id="e1", agent="khanak", outbox_path="o",
                             pipeline="seed", seed_ref="munshi:1")
        store.set_assignment_status(conn, "e1", "in-review")
        store.append_event(conn, actor="system", verb="product_proposed",
                           assignment_id="e1", subsystem="factory",
                           subsystem_ref="munshi:1",
                           note=json.dumps({"line": "seed",
                                            "payload": {"type": "question", "raw_text": ""},
                                            "pointers": []}))
        store.set_assignment_status(conn, "e1", "approved")
    finally:
        conn.close()

    class _Boom:
        def create_seed(self, p):  # pragma: no cover
            raise AssertionError("must not POST an empty-raw_text payload")
    monkeypatch.setattr("samagra.factory.dispatch.McdClient", lambda: _Boom())
    with pytest.raises(ValueError, match="raw_text"):
        run.build("e1")
    conn = store.connect()
    try:
        verbs = [e["verb"] for e in store.list_events_for_assignment(conn, "e1")]
        assert "product_building" not in verbs           # anti-wedge: no intent recorded
        row = next(r for r in store.list_assignments(conn) if r["id"] == "e1")
        assert row["status"] == "approved"               # still retryable after fixing the payload
    finally:
        conn.close()
```

- [ ] **Step 2: Run, expect FAIL**

Run: `python -m pytest tests/test_factory_seed.py -q`
Expected: FAIL (`run.scan` undefined; `plan("munshi:1")` returns no seed proposal; build has no mcd branch).

- [ ] **Step 3: Implement** — edit `samagra/factory/run.py`.

(a) extend the imports block:

```python
from __future__ import annotations

import json
import uuid

from ..adapters.munshi import MunshiAdapter
from ..bridge.classify import classify_item
from ..bridge.pointers import resolve_pointers
from ..bridge.text import item_text
from . import outbox
from ..governance import store
from . import dispatch
from .lines import LINES, classify
from .seed_payload import build_seed_payload, validate_seed_payload

_AGENT = "khanak"  # COO/CTO — production lane owner
```

(b) add the munshi-item helpers + the shared per-item seed proposer + payload loader (place after `_existing_assignment_for`):

```python
def _item_from_artifact(art) -> dict:
    """Reconstruct the munshi item dict from an Artifact's meta envelope."""
    meta = getattr(art, "meta", None) or {}
    return {
        "id": art.uid.split(":", 1)[-1], "uid": art.uid, "kind": art.kind,
        "status": art.status, "payload": meta.get("payload") or {},
        "tags": meta.get("tags"), "person": meta.get("person"),
        "due": meta.get("due"), "ts": art.updated_at,
    }


def _munshi_item_for(seed_ref: str) -> dict | None:
    """Read-only: the single munshi item whose uid == seed_ref, else None (munshi
    unavailable / down / item absent). Linear over the library — fine for the
    single-operator console."""
    adapter = MunshiAdapter()
    if not adapter.available():
        return None
    try:
        arts = list(adapter.artifacts())
    except Exception:  # noqa: BLE001
        return None
    for art in arts:
        if art.uid == seed_ref:
            return _item_from_artifact(art)
    return None


def _record_seed_proposal(conn, item: dict, *, dry: bool) -> dict | None:
    """Propose the mcd `seed` lane for ONE munshi content item: build the flat
    create_seed payload (reused build_seed_payload) + corpus pointers, dedup per
    (seed_ref, 'seed'), and record an in-review assignment + a product_proposed
    event whose note carries the PAYLOAD (build() loads it at write time). Returns
    None if the item is not content-classified. dry=True builds the proposal but
    writes nothing (conn may be None)."""
    if classify_item(item) != "content":
        return None
    seed_ref = item.get("uid") or f"munshi:{item.get('id')}"
    pointers = resolve_pointers(item_text(item), limit=5)
    payload = build_seed_payload(item, pointers)
    proposal = {"seed_ref": seed_ref, "line": "seed",
                "expected_output": LINES["seed"].expected_output,
                "classification": "content", "pointers": pointers, "payload": payload}
    if dry:
        return proposal
    existing = _existing_assignment_for(conn, seed_ref, "seed")
    if existing is not None:
        proposal["assignment_id"] = existing["id"]
        proposal["reused"] = True
        return proposal
    assignment_id = uuid.uuid4().hex
    outbox_path = outbox.write_outbox_file(
        agent=_AGENT, assignment_id=assignment_id, pipeline="seed",
        seed_ref=seed_ref, expected_output=LINES["seed"].expected_output,
        review_by=_AGENT, payload=payload, pointers=pointers)
    store.add_assignment(
        conn, id=assignment_id, agent=_AGENT, outbox_path=outbox_path,
        pipeline="seed", seed_ref=seed_ref,
        expected_output=LINES["seed"].expected_output, review_by=_AGENT)
    store.set_assignment_status(conn, assignment_id, "in-review")
    store.append_event(
        conn, actor="system", verb="product_proposed", assignment_id=assignment_id,
        subsystem="factory", subsystem_ref=seed_ref,
        note=json.dumps({"line": "seed", "payload": payload, "pointers": pointers},
                        ensure_ascii=False))
    proposal["assignment_id"] = assignment_id
    return proposal


def _load_proposed_payload(conn, assignment_id: str) -> dict | None:
    """Recover the flat create_seed body from this assignment's product_proposed
    event note. Assignment-scoped + unbounded (no newest-N window — strictly
    better than the bridge's 10000-row scan). Returns None if absent/malformed
    (surfaced as a clear refusal, never a silent wrong write)."""
    for ev in store.list_events_for_assignment(conn, assignment_id):
        if ev.get("verb") == "product_proposed":
            try:
                return json.loads(ev["note"])["payload"]
            except (TypeError, ValueError, KeyError):
                return None
    return None


def scan(dry: bool = True) -> list[dict]:
    """Discovery: propose the mcd `seed` lane for every content-classified munshi
    item (the folded bridge.scan, F-C2). Read-only over munshi; writes only
    in-review proposals (never a seed). dry=True writes nothing."""
    adapter = MunshiAdapter()
    if not adapter.available():
        return []
    proposals: list[dict] = []
    conn = None if dry else store.connect()
    try:
        try:
            arts = list(adapter.artifacts())
        except Exception:  # noqa: BLE001
            arts = []                       # munshi down mid-stream -> degrade (review 22 M2)
        for art in arts:
            proposal = _record_seed_proposal(conn, _item_from_artifact(art), dry=dry)
            if proposal is not None:
                proposals.append(proposal)
    finally:
        if conn is not None:
            conn.close()
    return proposals
```

(c) extend `plan()` with the munshi branch (insert at the very top of the function body, before the existing textbook logic):

```python
def plan(seed_ref: str, dry: bool = True) -> list[dict]:
    """Classify a seed into product lines; dry=True writes nothing, dry=False
    records ONE in-review child assignment + outbox + 'product_proposed' per line.

    A munshi: seed is the mcd `seed` lane — proposed from its LIVE item (payload),
    not a slug fan-out; routed here to _record_seed_proposal."""
    seed_ref = (seed_ref or "").strip()   # normalize ONCE (review 24 L2)
    if seed_ref.startswith("munshi:"):
        conn = None if dry else store.connect()
        try:
            item = _munshi_item_for(seed_ref)
            if item is None:
                return []
            proposal = _record_seed_proposal(conn, item, dry=dry)
            return [proposal] if proposal is not None else []
        finally:
            if conn is not None:
                conn.close()
    lines = classify(seed_ref)
    pointers = resolve_pointers(seed_ref.split(":", 1)[-1].replace("-", " "), limit=5)
    proposals: list[dict] = []
    conn = None if dry else store.connect()
    try:
        for line in lines:
            spec = LINES[line]
            if spec.kind == "mcd":            # defense in depth: the seed lane is
                continue                       # proposed via scan/munshi-plan, never a
                                               # textbook fan-out (classify excludes it anyway)
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

> NOTE: the textbook block is the EXISTING body with TWO additions only — the `seed_ref` normalize moved to the top (it already normalized once; keep a single normalize), and the `if spec.kind == "mcd": continue` guard. Everything else is byte-identical to the current `plan()`.

(d) extend `build()` with the mcd branch. Replace the produce/validate/artifact_ref section (currently lines ~154–168) with:

```python
        line, seed_ref = a["pipeline"], a["seed_ref"]
        dispatch.validate_seed_for_line(line, seed_ref)                  # cheap pre-check
        spec = LINES[line]
        # mcd PRE-WRITE: load + validate the proposed payload BEFORE recording build
        # intent, so a structurally invalid payload refuses WITHOUT wedging the
        # assignment in the in-flight state (no prod write was attempted — nothing
        # to reconcile). Mirrors the bridge's validate-before-intent order (review 22 M1).
        payload = None
        if spec.kind == "mcd":
            payload = _load_proposed_payload(conn, assignment_id)
            if payload is None:
                raise ValueError(
                    f"no proposed payload recorded for assignment {assignment_id}")
            validate_seed_payload(payload)
        # Record intent BEFORE producing (crash-window safe; mirrors bridge submit).
        store.append_event(conn, actor=_AGENT, verb="product_building",
                           assignment_id=assignment_id, subsystem="factory",
                           subsystem_ref=seed_ref, note="build intent before produce")
        # Produce + validate (KIND-AWARE — the five guards above are identical for
        # every kind; only this produce/validate step differs):
        if spec.kind == "mcd":
            result = dispatch.run_seed(payload)          # the ONE mcd prod write (+ id-check)
            artifact_ref = result["artifact_ref"]        # "mcd:<seed_id>"
            subsystem_ref = result["seed_id"]
        else:
            result = dispatch.run_line(line, seed_ref.split(":", 1)[-1])
            dispatch.validate_product(line, result)      # guard 4: exists/non-empty (+answer-leak)
            artifact_ref = result["html"]
            subsystem_ref = artifact_ref
        store.append_event(conn, actor=_AGENT, verb="product_created",
                           assignment_id=assignment_id, subsystem="factory",
                           subsystem_ref=subsystem_ref,
                           note=json.dumps({"line": line, "artifact": result},
                                           ensure_ascii=False))
        store.set_assignment_status(conn, assignment_id, "captured")     # guard 5 (single write)
        return {"assignment_id": assignment_id, "line": line,
                "artifact_ref": artifact_ref}
```

- [ ] **Step 4: Run, expect PASS**

Run: `python -m pytest tests/test_factory_seed.py -q`
Expected: PASS (all seed-lane tests).

- [ ] **Step 5: Run the EXISTING factory tests (no regressions)**

Run: `python -m pytest tests/test_factory_run.py tests/test_factory_lines.py tests/test_factory_dispatch.py -q`
Expected: PASS — textbook fan-out is still FIVE lanes (seed excluded by prefix); `product_created` for local/qx still uses the html path; the mcd branch is inert for textbook seeds.

- [ ] **Step 6: Commit**

```bash
git add samagra/factory/run.py tests/test_factory_seed.py
git commit -m "feat(factory): scan + plan(munshi) + build() mcd branch — the seed lane (Phase C3 T4)"
```

---

## Task 5 — bridge deprecation/delegation + CLI `factory scan`

**Files:**
- Rewrite: `samagra/bridge/run.py`
- Modify: `samagra/__main__.py`
- Test: `tests/test_bridge.py`

- [ ] **Step 1: Write the failing tests** — REPLACE the bridge-workflow and firewall tests with delegation + shim tests. In `tests/test_bridge.py`:

(i) Keep unchanged: the `classify_item` param test, `item_text` (3), `resolve_pointers` (3), `temp_catalog`/`temp_gov` fixtures, `test_governance_accepts_captured_status`, `test_classify_uses_word_boundary_not_substring`, and the three `test_cli_bridge_*_dispatch` tests.

(ii) DELETE these now-migrated tests (their behaviors live in `tests/test_factory_seed.py` against the seed lane): `test_scan_dry_proposes_content_only_and_writes_nothing`, `test_scan_live_records_in_review_and_dedups`, `test_approve_flips_in_review_to_approved`, `test_approve_refuses_non_in_review`, `test_approve_unknown_assignment_raises`, `test_submit_refuses_non_approved`, `test_submit_creates_seed_once_and_captures`, `test_submit_refuses_double_submit`, `test_submit_unknown_assignment_raises`, `test_submit_refuses_when_no_proposed_payload`, `test_scan_returns_empty_when_munshi_unavailable`, `test_scan_skips_already_captured_item`, `test_scan_degrades_when_munshi_read_raises`, `test_submit_refuses_in_flight_after_crash`, `test_submit_refuses_empty_raw_text`, `test_bridge_approve_refuses_non_mycontentdev_pipeline`, `test_bridge_submit_refuses_non_mycontentdev_pipeline`. Also DELETE the now-moved payload tests `test_build_seed_payload_rough_idea_flat_body`, `test_build_seed_payload_question_maps_type`, `test_build_seed_payload_source_ref_from_id_when_no_uid` (re-homed to `tests/test_factory_seed_payload.py`). The `_FakeMunshiAdapter`, `_munshi_items`, `_seed_proposed`, `_approved_assignment_with_payload` helpers may be removed if unused after the deletions.

(iii) ADD shim + delegation tests:

```python
def test_bridge_seed_payload_shim_reexports_from_factory():
    """The relocated helpers stay importable from the old path (Phase C3 shim)."""
    from samagra.bridge.seed_payload import (
        SEED_TYPES, build_seed_payload, validate_seed_payload)
    from samagra.factory import seed_payload as canonical
    assert build_seed_payload is canonical.build_seed_payload
    assert validate_seed_payload is canonical.validate_seed_payload
    assert SEED_TYPES == canonical.SEED_TYPES


def test_bridge_scan_delegates_to_factory(monkeypatch, capsys):
    seen = {}
    monkeypatch.setattr("samagra.factory.run.scan",
                        lambda dry=True: seen.update(dry=dry) or [{"x": 1}])
    out = run.scan(dry=True)
    assert seen["dry"] is True and out == [{"x": 1}]
    assert "deprecated" in capsys.readouterr().err.lower()


def test_bridge_approve_delegates_to_factory(monkeypatch, capsys):
    seen = {}
    monkeypatch.setattr("samagra.factory.run.approve",
                        lambda aid: seen.update(aid=aid) or {"status": "approved"})
    assert run.approve("a1")["status"] == "approved"
    assert seen["aid"] == "a1"
    assert "deprecated" in capsys.readouterr().err.lower()


def test_bridge_submit_delegates_to_factory_build_not_a_second_writer(monkeypatch, capsys):
    """F-C2: bridge.submit's own prod write is RETIRED — it forwards to the factory
    build (the one mcd writer)."""
    seen = {}
    monkeypatch.setattr("samagra.factory.run.build",
                        lambda aid: seen.update(aid=aid) or {"artifact_ref": "mcd:seed-5"})
    out = run.submit("a1")
    assert seen["aid"] == "a1" and out["artifact_ref"] == "mcd:seed-5"
    assert "deprecated" in capsys.readouterr().err.lower()
```

(iv) UPDATE the payload import at the top of `tests/test_bridge.py` if it becomes unused after (ii); keep `from samagra.bridge.seed_payload import build_seed_payload` ONLY if still referenced (the shim test imports inline, so the top-level import can be dropped).

- [ ] **Step 2: Run, expect FAIL**

Run: `python -m pytest tests/test_bridge.py -q`
Expected: FAIL (`run.scan` still the old implementation — no deprecation on stderr; delegation targets not used).

- [ ] **Step 3: Rewrite `samagra/bridge/run.py` as deprecating delegators:**

```python
"""DEPRECATED (Phase C3 / F-C2): the munshi->mcd write folded into the factory
`seed` lane, which is now the ONE canonical mcd writer. These verbs remain as thin
delegating aliases — a one-line deprecation notice on stderr + a forward to the
factory — so existing muscle-memory and scripts keep working. They add NO second
write path: `submit` forwards to the factory `build` (the only code path that
calls McdClient.create_seed). Prefer `samagra factory {scan,approve,build}`.

The pure helpers (classify_item, item_text, resolve_pointers) keep their homes in
this package and are imported by the factory; only the WORKFLOW verbs are folded.
"""
from __future__ import annotations

import sys

from ..factory import run as _factory

_DEPRECATION = ("[deprecated] `samagra bridge` folded into the factory seed lane "
                "(Phase C3) — use `samagra factory {scan,approve,build}`.")


def scan(dry: bool = True) -> list[dict]:
    print(_DEPRECATION, file=sys.stderr)
    return _factory.scan(dry=dry)


def approve(assignment_id: str) -> dict:
    print(_DEPRECATION, file=sys.stderr)
    return _factory.approve(assignment_id)


def submit(assignment_id: str) -> dict:
    """RETIRED prod write — forwards to the factory build (the one mcd writer)."""
    print(_DEPRECATION, file=sys.stderr)
    return _factory.build(assignment_id)
```

- [ ] **Step 4: Wire `samagra factory scan` + robust bridge submit print** — in `samagra/__main__.py`:

(a) in `cmd_factory`, add the `scan` branch at the top of the action chain:

```python
def cmd_factory(args) -> None:
    from .factory import run

    if args.action == "scan":
        proposals = run.scan(dry=args.dry_run)
        mode = "dry-run" if args.dry_run else "live"
        print(f"factory scan ({mode}): {len(proposals)} content seed proposal(s)")
        for p in proposals:
            aid = p.get("assignment_id", "-")
            tag = " (reused)" if p.get("reused") else ""
            print(f"  [{aid}] {p['seed_ref']} -> {p['payload']['type']}  "
                  f"({len(p['pointers'])} pointer(s)){tag}")
    elif args.action == "plan":
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

(b) make `cmd_bridge`'s submit print robust to the delegated factory-build return (which has no `seed` key):

```python
    elif args.action == "submit":
        res = run.submit(args.assignment_id)
        ref = res.get("artifact_ref")
        if ref:
            print(f"submitted {args.assignment_id} -> {ref}")
        else:                                           # legacy monkeypatched {"seed": {...}}
            seed = res.get("seed") or {}
            print(f"submitted {args.assignment_id} -> seed {seed.get('id')} "
                  f"({seed.get('status')})")
```

(c) add the `scan` subparser to the factory CLI group (after the `ft_plan` block):

```python
    ft_scan = ft_sub.add_parser("scan",
                                help="propose mcd seeds from munshi content items")
    ft_scan.add_argument("--dry-run", action="store_true",
                         help="propose only; record nothing")
```

- [ ] **Step 5: Add a CLI test for `factory scan`** — append to `tests/test_factory_run.py`:

```python
def test_cli_factory_scan_dispatch(monkeypatch):
    import sys as _sys
    import samagra.__main__ as cli
    seen = {}
    monkeypatch.setattr("samagra.factory.run.scan",
                        lambda dry=True: seen.update(dry=dry) or [])
    monkeypatch.setattr(_sys, "argv", ["samagra", "factory", "scan", "--dry-run"])
    cli.main()
    assert seen["dry"] is True
```

- [ ] **Step 6: Run, expect PASS**

Run: `python -m pytest tests/test_bridge.py tests/test_factory_run.py -q`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add samagra/bridge/run.py samagra/__main__.py tests/test_bridge.py tests/test_factory_run.py
git commit -m "refactor(bridge): fold scan/approve/submit into the factory (deprecating delegators) + factory scan CLI (Phase C3 T5)"
```

---

## Task 6 — full suite + live golden thread + adversarial review + DEC-7 Codex review + finish

- [ ] **Step 1: Full suite green** (authoritative JUnit count — the Win/py3.14 tmpdir `PermissionError` suppresses pytest's summary line):

Run: `python -m pytest -q --junitxml=c3.xml ; python - <<'PY'`
```python
import xml.etree.ElementTree as ET
r = ET.parse("c3.xml").getroot()
s = r if r.tag == "testsuite" else r.find("testsuite")
print("tests", s.get("tests"), "failures", s.get("failures"),
      "errors", s.get("errors"), "skipped", s.get("skipped"))
PY
```
Then `rm -f c3.xml`. Expected: failures=0, errors=0 except the lone pre-existing env `test_gdocs` (Google API libs missing) — confirm any failure is ONLY that.

- [ ] **Step 2: Live golden thread** — create `scripts/c3_smoke.py` (isolated governance store; the seed write hits REAL prod mycontentdev — like the Phase 3 bridge smoke). It must: repoint GOVERNANCE_DB/DATA_DB/EXPORT_DIR to a temp dir; record durable `governance.db` mtime before; `scan` (or `plan` a chosen real `munshi:<id>`) → `approve` → `build`; assert the build returns `mcd:<id>`, the assignment is `captured`, exactly one `product_created`; assert the durable governance.db mtime is UNCHANGED. Print the created seed id for OWNER CLEANUP.

```python
"""C3 live golden thread: one munshi content item -> exactly one mcd seed via the
factory seed lane, in an ISOLATED temp governance store (durable governance.db
untouched). The seed write hits REAL prod mycontentdev (owner-initiated capture,
the existing contract) — the created seed id is printed for owner cleanup.
Run: python scripts/c3_smoke.py            # scans munshi, builds the FIRST content seed
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from samagra import config                  # noqa: E402
from samagra.governance import store        # noqa: E402

tmp = Path(tempfile.mkdtemp(prefix="c3-smoke-"))
durable = config.GOVERNANCE_DB
durable_before = durable.stat().st_mtime_ns if durable.exists() else None

config.GOVERNANCE_DB = tmp / "governance.db"
config.DATA_DB = tmp / "samagra.db"
config.EXPORT_DIR = tmp / "exports"
store._INITIALIZED.clear()
store.ensure_tables()
os.chdir(tmp)

from samagra.factory import run             # noqa: E402

proposals = run.scan(dry=False)
print(f"[smoke] factory scan: {len(proposals)} content seed proposal(s)")
if not proposals:
    print("[smoke] SKIP — no content-classified munshi item to seed (munshi empty/down).")
    raise SystemExit(0)
aid = proposals[0]["assignment_id"]
print(f"[smoke] building seed assignment {aid} (seed_ref={proposals[0]['seed_ref']})")
run.approve(aid)
res = run.build(aid)
assert res["artifact_ref"].startswith("mcd:"), res
seed_id = res["artifact_ref"].split(":", 1)[1]

conn = store.connect()
try:
    row = next(r for r in store.list_assignments(conn) if r["id"] == aid)
    created = [e for e in store.list_events_for_assignment(conn, aid)
               if e["verb"] == "product_created"]
finally:
    conn.close()
assert row["status"] == "captured", row
assert len(created) == 1, created
durable_after = durable.stat().st_mtime_ns if durable.exists() else None
assert durable_before == durable_after, "DURABLE governance.db WAS TOUCHED!"

print(f"[smoke] OK -> {res['artifact_ref']} · assignment captured · one product_created")
print(f"[smoke] durable governance.db untouched (mtime unchanged)")
print(f"[smoke] >>> OWNER CLEANUP: archive prod mcd seed id {seed_id!r} <<<")
print("[smoke] PASS — one munshi item fanned to exactly one mcd seed via the factory")
```

Run: `PYTHONIOENCODING=utf-8 python scripts/c3_smoke.py` (requires `../mycontentdev/mcd-cloud.json`). Record the printed seed id for owner cleanup. If munshi/mcd are unreachable, the smoke SKIPs/raises cleanly — note it and rely on the mocked suite.

Commit the script:
```bash
git add scripts/c3_smoke.py
git commit -m "test(factory): C3 live golden-thread smoke (munshi item -> one mcd seed)"
```

- [ ] **Step 3: Adversarial multi-lens review** — run a Workflow (pipeline: parallel lens-finders → independent per-finding verify/refute) over the C3 diff (`git diff main...HEAD`). Lenses: (1) **prod-write safety** (double-build / in-flight / single-path / validate-before-write / anti-wedge ordering / exactly-one create_seed), (2) **firewall & one-path** (can any OTHER code still call create_seed? can a non-seed lane reach run_seed? can a textbook seed write to mcd?), (3) **migration/regression** (shim correctness, bridge delegation, textbook fan-out still 5, no migration), (4) **correctness/edge** (payload load staleness, classify, source_ref, munshi-down, id-less response). Reviewers in the shared tree use `git show <sha>:<file>` / `git diff` — NEVER `git checkout`. Triage raw → confirmed/refuted; FIX confirmed findings TDD (red→green→commit); re-verify.

- [ ] **Step 4: DEC-7 dedicated Codex pre-merge review** (MANDATORY before merge, spec §6 C3) — an INDEPENDENT Codex review of the prod-write boundary: focus on `dispatch.run_seed`, `run.build`'s mcd branch, the validate-before-intent ordering, the single-write/in-flight/double-build guards, and the F-C2 one-path claim (bridge retired). Save the report to `docs/codex-reviews/26-factory-phase-c3-seed-fold-premerge.report.md`. If NO-GO / GO-WITH-CAVEATS: remediate every finding TDD, then re-review (`27-...rereview`) until GO (or all caveats resolved). Mirror the Phase-3 bridge review 22/23 cadence.

- [ ] **Step 5: Trackers + memory** — update `CLAUDE.md` (C3 milestone banner: built TDD + adversarial + DEC-7 Codex-reviewed + merge ff, test count, one-mcd-path, bridge retired), `HANDOFF.md`, `STATUS.html`, `SUMMARY.html` (via subagent), and the `~/.claude/.../memory/content-factory-phase-c3-...md` + `MEMORY.md` index. Record the plan via `cbm record-plan` if not already.

- [ ] **Step 6: Finish** — use superpowers:finishing-a-development-branch: verify tests pass, present the 4 options, execute the user's choice (last phase: merge to `main` + push). Confirm `local main == origin/main` and the durable `governance.db` is untouched.

---

## Self-review (writing-plans)

**Spec coverage:** §3.3 registry (T1) · classify munshi→seed (T1) · plan("munshi:<id>") (T4) · build() mcd guards 1–5 + validate_seed_payload at boundary + artifact_ref mcd:<id> (T4/T3) · `factory scan` discovery verb (T4/T5) · bridge deprecation/delegation + retired submit write (T5) · seed_payload relocation + shim (T2) · test migration (T5/T4/T2) · answer-leak no-op for mcd (unchanged — build() never calls validate_product for mcd). §5 `_ORDER`+classify (T1). §6 C3 acceptance: one seed→one mcd seed (T4/smoke) · validate gates (T3/T4) · double-build/in-flight/status guards (T4) · one write path (T5 + review §3 lens 2) · migrated behaviors green (T4/T5) · golden thread (T6 smoke) · pytest + DEC-7 Codex review (T6). §6 "across all three": no migration (verbs reused) · publish gate untouched (build creates a seed; publishing stays separate) · read-only subsystems (only the existing create_seed contract).

**Placeholder scan:** none — every step carries exact code/commands.

**Type consistency:** `Line("seed", …, None, ("munshi:",), "mcd")` matches the frozen dataclass field order (key, expected_output, variant, source_prefixes, kind). `run_seed` returns `{variant, seed, seed_id, artifact_ref}`; `build()` reads `result["artifact_ref"]`/`["seed_id"]` for mcd and `result["html"]` for local/qx — consistent. `_record_seed_proposal` proposal keys (`seed_ref`, `line`, `expected_output`, `classification`, `pointers`, `payload`, `assignment_id`, `reused`) are read by the CLI scan print (`seed_ref`, `payload.type`, `pointers`) and the tests. `_load_proposed_payload` reads `note["payload"]` — written by `_record_seed_proposal` as `{"line","payload","pointers"}`. Consistent.
