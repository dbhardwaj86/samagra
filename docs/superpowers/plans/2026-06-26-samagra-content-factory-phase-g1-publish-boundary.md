# Phase G1 — Publish Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `published` a real, durable, owner-gated state — a manual `samagra factory publish <chapter>` that copies a chapter's *captured* artifacts into an immutable, append-only `published/` snapshot (the export contract a future outward consumer reads), with an append-only retract.

**Architecture:** A new pure-modules-plus-thin-orchestrator package `samagra/factory/publish/` (mirrors `coverage/`, `style/`). `manifest.py` (PURE) owns the schema, sha256, the per-lane-last-write-wins manifest derivation, and idempotency. `store.py` owns the `published/` directory I/O (atomic copies, immutable publication records, manifest read/write). `run.py` orchestrates `publish`/`unpublish`/`list_published`, reading **captured** assignments + their `product_created` event notes from `governance.store`, enforcing the gates, and appending `published`/`unpublished` audit events. No assignment-state change, no new table, **no migration**; no public surface, no identity; the inward `build()` boundary is untouched.

**Tech Stack:** Python 3, stdlib only (`json`, `hashlib`, `pathlib`, `os`, `time`, `uuid`), SQLite via the existing `samagra.governance.store`, pytest. CLI via the existing `argparse` wiring in `samagra/__main__.py`.

**Spec:** `docs/superpowers/specs/2026-06-26-samagra-content-factory-phase-g1-publish-boundary-design.md`

---

## File structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `samagra/config.py` | Modify (after line 108) | add `PUBLISHED_DIR = REPO_ROOT / "published"` (durable, gitignored) |
| `.gitignore` | Modify | ignore `published/` |
| `samagra/factory/publish/__init__.py` | Create | re-export `publish`, `unpublish`, `list_published` |
| `samagra/factory/publish/manifest.py` | Create | PURE: `SCHEMA`, `sha256_bytes`, `derive_manifest`, `unchanged_lanes` |
| `samagra/factory/publish/store.py` | Create | I/O: `now`, file/record/manifest read+write under `PUBLISHED_DIR` |
| `samagra/factory/publish/run.py` | Create | orchestrator: `publish`, `unpublish`, `list_published` + helpers |
| `samagra/__main__.py` | Modify (`cmd_factory` ~L160; `build_parser` ~L405) | `publish`/`unpublish`/`published` subcommands |
| `tests/test_publish_manifest.py` | Create | pure manifest + idempotency tests |
| `tests/test_publish_store.py` | Create | `published/` I/O tests |
| `tests/test_publish_run.py` | Create | orchestrator: golden, idempotency, refusals, retract, governance-unchanged |
| `tests/test_publish_cli.py` | Create | CLI parse + dispatch |

**Data contracts (used across tasks — keep names identical):**

A **manifest artifact entry** (one per published `(chapter, lane)`):
```python
{
  "uid": "published:<chapter>:<lane>",
  "lane": "<lane>",
  "assignment_id": "<governance assignment id>",
  "files": [{"rel": "<chapter>/<basename>", "sha256": "<hex>", "bytes": <int>}],
  "source_seed_ref": "textbook:<chapter>",
  "style_seed_version": <str|None>,
  "captured_at": "<iso>",
  "published_at": "<iso>",
  "publication_id": "pub_<hex12>",
}
```

An immutable **publication record** (`published/_publications/pub_<NNNNN>_<hex12>.json`):
```python
{
  "publication_id": "pub_<hex12>",
  "action": "publish" | "unpublish",
  "actor": "owner",
  "chapter": "<chapter>",
  "seed_ref": "textbook:<chapter>",
  "title": "<Titleized Chapter>",
  "lanes": ["<lane>", ...],
  "at": "<iso>",
  "artifacts": [<entry>, ...],   # for unpublish: the entries withdrawn (audit)
}
```

The derived **`published/manifest.json`**:
```python
{
  "schema": "samagra.published.v1",
  "generated_at": "<iso>",
  "publication_count": <int>,
  "chapters": {"<chapter>": {"chapter","title","seed_ref","artifacts": [<entry>, ...]}},
}
```

---

### Task 1: Config constant + gitignore

**Files:**
- Modify: `samagra/config.py` (after line 108, the `CONCEPT_ALIASES` line)
- Modify: `.gitignore`
- Test: `tests/test_publish_config.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_publish_config.py
from samagra import config


def test_published_dir_is_a_durable_repo_root_sibling():
    assert config.PUBLISHED_DIR == config.REPO_ROOT / "published"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_publish_config.py -v`
Expected: FAIL with `AttributeError: module 'samagra.config' has no attribute 'PUBLISHED_DIR'`

- [ ] **Step 3: Add the constant**

In `samagra/config.py`, immediately after the `CONCEPT_ALIASES = REPO_ROOT / "concept_aliases.json"` line (line 108), add:

```python
# Published corpus (Phase G1): the owner-gated export snapshot a downstream
# consumer (PRATHAM) reads INSTEAD of the inward stores. DURABLE — never reset
# (frozen artifact copies + immutable per-publication records); gitignored like
# GOVERNANCE_DB (durable != git-committed). The append-only audit ledger lives
# in governance.db (`published`/`unpublished` events).
PUBLISHED_DIR = REPO_ROOT / "published"
```

- [ ] **Step 4: Add the gitignore entry**

Append to `.gitignore` (under the other SAMAGRA-owned data ignores; add the line if absent):

```
published/
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_publish_config.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add samagra/config.py .gitignore tests/test_publish_config.py
git commit -m "feat(publish): PUBLISHED_DIR config + gitignore (Phase G1 Task 1)"
```

---

### Task 2: `manifest.sha256_bytes` + `SCHEMA`

**Files:**
- Create: `samagra/factory/publish/__init__.py`
- Create: `samagra/factory/publish/manifest.py`
- Test: `tests/test_publish_manifest.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_publish_manifest.py
from samagra.factory.publish import manifest


def test_schema_constant():
    assert manifest.SCHEMA == "samagra.published.v1"


def test_sha256_bytes_is_stable_and_distinguishes_content():
    a = manifest.sha256_bytes(b"hello")
    assert a == manifest.sha256_bytes(b"hello")          # deterministic
    assert a != manifest.sha256_bytes(b"hello!")         # content-sensitive
    assert len(a) == 64 and all(c in "0123456789abcdef" for c in a)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_publish_manifest.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'samagra.factory.publish'`

- [ ] **Step 3: Create the package init (empty for now) and `manifest.py`**

```python
# samagra/factory/publish/__init__.py
"""Phase G1 — the publish boundary: captured -> published (owner-gated)."""
```

```python
# samagra/factory/publish/manifest.py
"""PURE manifest logic for the publish boundary.

No I/O beyond hashing bytes the caller already read. Owns the published-corpus
schema, content hashing, the per-lane-last-write-wins manifest derivation over an
ordered list of immutable publication records, and the idempotency comparison.
"""
from __future__ import annotations

import hashlib

SCHEMA = "samagra.published.v1"


def sha256_bytes(data: bytes) -> str:
    """Hex sha256 of raw bytes — the per-file content fingerprint."""
    return hashlib.sha256(data).hexdigest()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_publish_manifest.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/publish/__init__.py samagra/factory/publish/manifest.py tests/test_publish_manifest.py
git commit -m "feat(publish): manifest.sha256_bytes + SCHEMA (Phase G1 Task 2)"
```

---

### Task 3: `manifest.derive_manifest` (per-lane last-write-wins replay)

**Files:**
- Modify: `samagra/factory/publish/manifest.py`
- Test: `tests/test_publish_manifest.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_publish_manifest.py`:

```python
def _entry(chapter, lane, sha):
    return {"uid": f"published:{chapter}:{lane}", "lane": lane,
            "assignment_id": f"a-{lane}",
            "files": [{"rel": f"{chapter}/{chapter}-{lane}.html",
                       "sha256": sha, "bytes": 10}],
            "source_seed_ref": f"textbook:{chapter}", "style_seed_version": None,
            "captured_at": "T0", "published_at": "T1", "publication_id": "pub_x"}


def _pub(chapter, action, lanes, *, shas=None):
    shas = shas or {l: f"sha-{l}" for l in lanes}
    return {"publication_id": "pub_" + "".join(lanes), "action": action,
            "actor": "owner", "chapter": chapter, "seed_ref": f"textbook:{chapter}",
            "title": chapter.title(), "lanes": list(lanes), "at": "T1",
            "artifacts": [_entry(chapter, l, shas[l]) for l in lanes]}


def test_derive_empty():
    m = manifest.derive_manifest([], generated_at="T")
    assert m == {"schema": manifest.SCHEMA, "generated_at": "T",
                 "publication_count": 0, "chapters": {}}


def test_derive_single_publish_lists_the_artifact():
    m = manifest.derive_manifest([_pub("circular-motion", "publish", ["revision"])],
                                 generated_at="T")
    ch = m["chapters"]["circular-motion"]
    assert [a["lane"] for a in ch["artifacts"]] == ["revision"]
    assert ch["seed_ref"] == "textbook:circular-motion"


def test_derive_accumulates_lanes_across_publications():
    pubs = [_pub("cm", "publish", ["revision"]), _pub("cm", "publish", ["deck"])]
    ch = manifest.derive_manifest(pubs, generated_at="T")["chapters"]["cm"]
    assert sorted(a["lane"] for a in ch["artifacts"]) == ["deck", "revision"]


def test_derive_same_lane_last_write_wins():
    pubs = [_pub("cm", "publish", ["revision"], shas={"revision": "OLD"}),
            _pub("cm", "publish", ["revision"], shas={"revision": "NEW"})]
    ch = manifest.derive_manifest(pubs, generated_at="T")["chapters"]["cm"]
    assert len(ch["artifacts"]) == 1
    assert ch["artifacts"][0]["files"][0]["sha256"] == "NEW"


def test_derive_unpublish_removes_lane():
    pubs = [_pub("cm", "publish", ["revision", "deck"]),
            _pub("cm", "unpublish", ["deck"])]
    ch = manifest.derive_manifest(pubs, generated_at="T")["chapters"]["cm"]
    assert [a["lane"] for a in ch["artifacts"]] == ["revision"]


def test_derive_drops_chapter_when_all_lanes_withdrawn():
    pubs = [_pub("cm", "publish", ["revision"]),
            _pub("cm", "unpublish", ["revision"])]
    assert manifest.derive_manifest(pubs, generated_at="T")["chapters"] == {}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_publish_manifest.py -v -k derive`
Expected: FAIL with `AttributeError: module ... has no attribute 'derive_manifest'`

- [ ] **Step 3: Implement `derive_manifest`**

Append to `samagra/factory/publish/manifest.py`:

```python
def derive_manifest(publications: list[dict], *, generated_at: str) -> dict:
    """Replay an ordered list of immutable publication records into the current
    published manifest. Publish adds/replaces a lane's entry (last-write-wins);
    unpublish removes a lane; a chapter with no remaining lanes drops out."""
    chapters: dict[str, dict] = {}
    for rec in publications:
        ch = rec["chapter"]
        slot = chapters.setdefault(
            ch, {"chapter": ch, "title": rec.get("title"),
                 "seed_ref": rec.get("seed_ref"), "lanes": {}})
        if rec.get("title"):
            slot["title"] = rec["title"]
        if rec.get("seed_ref"):
            slot["seed_ref"] = rec["seed_ref"]
        if rec.get("action") == "unpublish":
            for lane in rec.get("lanes", []):
                slot["lanes"].pop(lane, None)
        else:
            for entry in rec.get("artifacts", []):
                slot["lanes"][entry["lane"]] = entry
    out: dict[str, dict] = {}
    for ch, slot in chapters.items():
        if not slot["lanes"]:
            continue
        out[ch] = {"chapter": ch, "title": slot["title"],
                   "seed_ref": slot["seed_ref"],
                   "artifacts": [slot["lanes"][l] for l in sorted(slot["lanes"])]}
    return {"schema": SCHEMA, "generated_at": generated_at,
            "publication_count": len(publications), "chapters": out}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_publish_manifest.py -v -k derive`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/publish/manifest.py tests/test_publish_manifest.py
git commit -m "feat(publish): derive_manifest last-write-wins replay (Phase G1 Task 3)"
```

---

### Task 4: `manifest.unchanged_lanes` (idempotency)

**Files:**
- Modify: `samagra/factory/publish/manifest.py`
- Test: `tests/test_publish_manifest.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_publish_manifest.py`:

```python
def test_unchanged_lanes_none_manifest_is_empty():
    cands = [{"lane": "revision", "files": [{"sha256": "x"}]}]
    assert manifest.unchanged_lanes(None, "cm", cands) == set()


def test_unchanged_lanes_matches_identical_sha_set():
    m = manifest.derive_manifest([_pub("cm", "publish", ["revision"],
                                       shas={"revision": "SAME"})], generated_at="T")
    cands = [{"lane": "revision", "files": [{"sha256": "SAME"}]}]
    assert manifest.unchanged_lanes(m, "cm", cands) == {"revision"}


def test_unchanged_lanes_excludes_changed_sha():
    m = manifest.derive_manifest([_pub("cm", "publish", ["revision"],
                                       shas={"revision": "OLD"})], generated_at="T")
    cands = [{"lane": "revision", "files": [{"sha256": "NEW"}]}]
    assert manifest.unchanged_lanes(m, "cm", cands) == set()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_publish_manifest.py -v -k unchanged`
Expected: FAIL with `AttributeError: ... 'unchanged_lanes'`

- [ ] **Step 3: Implement `unchanged_lanes`**

Append to `samagra/factory/publish/manifest.py`:

```python
def unchanged_lanes(manifest_obj: dict | None, chapter: str,
                    candidates: list[dict]) -> set[str]:
    """Lanes whose candidate file-sha set EXACTLY matches the current manifest
    entry — these are no-ops a re-publish must skip (idempotency)."""
    if not manifest_obj:
        return set()
    ch = (manifest_obj.get("chapters") or {}).get(chapter)
    if not ch:
        return set()
    current = {e["lane"]: {f["sha256"] for f in e.get("files", [])}
               for e in ch.get("artifacts", [])}
    out: set[str] = set()
    for c in candidates:
        cur = current.get(c["lane"])
        if cur is not None and cur == {f["sha256"] for f in c["files"]}:
            out.add(c["lane"])
    return out
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_publish_manifest.py -v`
Expected: PASS (all manifest tests)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/publish/manifest.py tests/test_publish_manifest.py
git commit -m "feat(publish): unchanged_lanes idempotency check (Phase G1 Task 4)"
```

---

### Task 5: `store.py` — the `published/` directory I/O

**Files:**
- Create: `samagra/factory/publish/store.py`
- Test: `tests/test_publish_store.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_publish_store.py
import pytest
from samagra import config
from samagra.factory.publish import store


@pytest.fixture
def published_env(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    return tmp_path / "published"


def test_now_is_utc_iso(published_env):
    s = store.now()
    assert s.endswith("Z") and "T" in s and len(s) == 20


def test_write_and_read_published_file(published_env):
    rel = store.write_published_file("circular-motion", "circular-motion-thin.html", b"<h1>x</h1>")
    assert rel == "circular-motion/circular-motion-thin.html"
    assert (published_env / rel).read_bytes() == b"<h1>x</h1>"


def test_write_published_file_overwrites_on_republish(published_env):
    store.write_published_file("cm", "f.html", b"old")
    store.write_published_file("cm", "f.html", b"new")        # deliberate re-publish
    assert (published_env / "cm" / "f.html").read_bytes() == b"new"


def test_manifest_roundtrip_and_absent(published_env):
    assert store.read_manifest() is None
    store.write_manifest({"schema": "samagra.published.v1", "chapters": {}})
    assert store.read_manifest()["schema"] == "samagra.published.v1"


def test_next_sequence_and_ordered_publications(published_env):
    assert store.next_sequence() == 1
    store.write_publication({"publication_id": "pub_a", "chapter": "cm"}, sequence=1)
    assert store.next_sequence() == 2
    store.write_publication({"publication_id": "pub_b", "chapter": "cm"}, sequence=2)
    recs = store.read_publications()
    assert [r["publication_id"] for r in recs] == ["pub_a", "pub_b"]   # ordered by seq


def test_write_publication_refuses_overwrite(published_env):
    store.write_publication({"publication_id": "pub_a", "chapter": "cm"}, sequence=1)
    with pytest.raises(FileExistsError):
        store.write_publication({"publication_id": "pub_a", "chapter": "cm"}, sequence=1)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_publish_store.py -v`
Expected: FAIL with `ModuleNotFoundError: ... 'samagra.factory.publish.store'`

- [ ] **Step 3: Implement `store.py`**

```python
# samagra/factory/publish/store.py
"""I/O for the publish boundary — everything that touches PUBLISHED_DIR.

Layout (config.PUBLISHED_DIR, durable + gitignored):
    manifest.json                          # derived CURRENT view (the export contract)
    _publications/pub_<NNNNN>_<id>.json    # immutable per-action records (append-only)
    <chapter>/<basename>                   # frozen artifact copies (current published bytes)

PUBLISHED_DIR is resolved at call time so tests can repoint it.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

from ... import config


def now() -> str:
    """UTC ISO 'YYYY-MM-DDTHH:MM:SSZ' — matches governance.store._now()."""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _root() -> Path:
    return config.PUBLISHED_DIR


def _pubs_dir() -> Path:
    return _root() / "_publications"


def _atomic_write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def _atomic_write_text(path: Path, text: str) -> None:
    _atomic_write_bytes(path, text.encode("utf-8"))


def read_manifest() -> dict | None:
    p = _root() / "manifest.json"
    if not p.is_file():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def write_manifest(manifest: dict) -> Path:
    p = _root() / "manifest.json"
    _atomic_write_text(p, json.dumps(manifest, ensure_ascii=False, indent=2))
    return p


def read_publications() -> list[dict]:
    """Every immutable publication record, ordered by sequence (filename sorts
    lexically because the sequence is zero-padded)."""
    d = _pubs_dir()
    if not d.is_dir():
        return []
    return [json.loads(f.read_text(encoding="utf-8")) for f in sorted(d.glob("pub_*.json"))]


def next_sequence() -> int:
    d = _pubs_dir()
    return (len(list(d.glob("pub_*.json"))) if d.is_dir() else 0) + 1


def write_publication(record: dict, *, sequence: int) -> Path:
    """Write ONE immutable record. Refuses to overwrite an existing file —
    publication history is append-only."""
    p = _pubs_dir() / f"pub_{sequence:05d}_{record['publication_id']}.json"
    if p.exists():
        raise FileExistsError(f"publication record already exists: {p.name}")
    _atomic_write_text(p, json.dumps(record, ensure_ascii=False, indent=2))
    return p


def write_published_file(chapter: str, basename: str, data: bytes) -> str:
    """Copy one artifact file into published/<chapter>/<basename>; returns its
    manifest-relative path. Overwrites only on a deliberate re-publish."""
    _atomic_write_bytes(_root() / chapter / basename, data)
    return f"{chapter}/{basename}"
```

> **Note:** `store.py` is three levels deep (`samagra/factory/publish/`), so the
> config import is `from ... import config` (three dots), unlike `run.py`/`coverage`
> which use two. Verify the import resolves when you run the tests.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_publish_store.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/publish/store.py tests/test_publish_store.py
git commit -m "feat(publish): published/ directory I/O store (Phase G1 Task 5)"
```

---

### Task 6: `run.py` helpers — lane normalization, titleize, artifact recovery

**Files:**
- Create: `samagra/factory/publish/run.py`
- Test: `tests/test_publish_run.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_publish_run.py
import json
import pytest
from samagra import config
from samagra.governance import store
from samagra.factory.publish import run


@pytest.fixture
def publish_env(tmp_path, monkeypatch):
    """Isolate governance + export + published trees into tmp (mirrors
    tests/test_factory_run.py::factory_env, plus PUBLISHED_DIR)."""
    monkeypatch.setattr(config, "GOVERNANCE_DB", tmp_path / "governance.db")
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "exports")
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    store._INITIALIZED.clear()
    store.ensure_tables()
    monkeypatch.chdir(tmp_path)
    yield tmp_path
    store._INITIALIZED.clear()


def test_publishable_excludes_the_mcd_seed_lane():
    assert "seed" not in run.PUBLISHABLE
    assert {"revision", "lecture", "deck", "paper", "drill", "samadhan"} == run.PUBLISHABLE


def test_norm_lanes_validates_against_publishable():
    assert run._norm_lanes(None) is None
    assert run._norm_lanes("revision,deck") == {"revision", "deck"}
    with pytest.raises(ValueError):
        run._norm_lanes("seed")                       # not publishable
    with pytest.raises(ValueError):
        run._norm_lanes("bogus")


def test_titleize():
    assert run._titleize("circular-motion") == "Circular Motion"


def test_last_product_created_recovers_the_artifact_dict():
    events = [
        {"verb": "product_building", "note": "x"},
        {"verb": "product_created",
         "note": json.dumps({"line": "revision", "artifact": {"html": "/p/a.html"}})},
    ]
    assert run._last_product_created(events) == {"html": "/p/a.html"}


def test_last_product_created_returns_none_without_a_created_event():
    assert run._last_product_created([{"verb": "product_building", "note": "x"}]) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_publish_run.py -v`
Expected: FAIL with `ModuleNotFoundError: ... 'samagra.factory.publish.run'`

- [ ] **Step 3: Implement `run.py` constants + helpers**

```python
# samagra/factory/publish/run.py
"""The publish boundary orchestrator: captured -> published (owner-gated).

Reads ONLY captured local factory artifacts (governance.db + the files already on
disk) and writes ONLY under PUBLISHED_DIR + appends append-only `published` /
`unpublished` governance events. No write path to the 7 source subsystems; no
public surface; no assignment-state change; no migration. Manual CLI only.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from ...governance import store as gov
from ..lines import LINES
from . import manifest
from . import store as pub

_ACTOR = "owner"

# Every non-mcd lane produces a LOCAL artifact that can be copied into published/.
# The mcd `seed` lane writes inward to mycontentdev and has no local file to copy.
PUBLISHABLE = frozenset(k for k, l in LINES.items() if l.kind != "mcd")


def _titleize(chapter: str) -> str:
    return chapter.replace("-", " ").title()


def _norm_lanes(lanes) -> set[str] | None:
    """Normalize a None | str("a,b") | iterable lane filter to a set, validated
    against PUBLISHABLE. None means 'all captured publishable lanes'."""
    if lanes is None:
        return None
    items = lanes.split(",") if isinstance(lanes, str) else list(lanes)
    want = {x.strip() for x in items if x and x.strip()}
    bad = want - PUBLISHABLE
    if bad:
        raise ValueError(
            f"not publishable lane(s): {sorted(bad)} "
            f"(publishable: {sorted(PUBLISHABLE)})")
    return want or None


def _last_product_created(events: list[dict]) -> dict | None:
    """The artifact `result` dict from the LAST product_created note (a rebuilt
    assignment may have several). None if absent/malformed — a clean refusal."""
    result = None
    for ev in events:                         # list_events_for_assignment is oldest-first
        if ev.get("verb") != "product_created":
            continue
        try:
            note = json.loads(ev["note"])
        except (TypeError, ValueError):
            continue
        if isinstance(note, dict) and isinstance(note.get("artifact"), dict):
            result = note["artifact"]
    return result


def _captured_publishable(conn, chapter: str, want: set[str] | None) -> list[dict]:
    """Descriptors for the chapter's captured, publishable artifacts. Refuses (no
    phantom publish) if an artifact's product_created note or its html file on
    disk is missing — the owner must rebuild first."""
    seed = f"textbook:{chapter}"
    out: list[dict] = []
    for a in gov.list_assignments(conn):
        if a.get("seed_ref") != seed or a.get("status") != "captured":
            continue
        lane = a.get("pipeline")
        if lane not in PUBLISHABLE or (want is not None and lane not in want):
            continue
        result = _last_product_created(gov.list_events_for_assignment(conn, a["id"]))
        if not result:
            raise ValueError(
                f"assignment {a['id']} ({lane}) has no recoverable artifact — "
                f"rebuild before publishing")
        html = result.get("html")
        if not (html and Path(html).is_file()):
            raise ValueError(
                f"assignment {a['id']} ({lane}) artifact file missing on disk — "
                f"rebuild before publishing")
        files = [result[k] for k in ("html", "json", "docx")
                 if result.get(k) and Path(result[k]).is_file()]
        out.append({"assignment_id": a["id"], "lane": lane,
                    "captured_at": a.get("updated_at"),
                    "style_seed_version": result.get("style_seed_version"),
                    "source_files": files})
    return out
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_publish_run.py -v`
Expected: PASS (5 tests; `_captured_publishable` is exercised in Task 7)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/publish/run.py tests/test_publish_run.py
git commit -m "feat(publish): run.py constants + artifact-recovery helpers (Phase G1 Task 6)"
```

---

### Task 7: `run.publish` — the owner release gate

**Files:**
- Modify: `samagra/factory/publish/run.py`
- Test: `tests/test_publish_run.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_publish_run.py` (the helper builds a real captured artifact via the existing factory flow with a stubbed engine):

```python
from samagra.factory import run as factory


def _stub_export(monkeypatch, tmp_path):
    def fake_export_one(slug, variant, **kw):
        out = tmp_path / f"{slug}-{variant}.html"
        out.write_text(f"<h1>{slug} {variant}</h1>", encoding="utf-8")
        return {"variant": variant, "html": str(out), "docx": None, "gdoc": None}
    monkeypatch.setattr("samagra.lectures.export.export_one", fake_export_one)


def _capture_revision(publish_env, monkeypatch, chapter="circular-motion"):
    """plan -> approve -> build the revision lane => one captured artifact."""
    _stub_export(monkeypatch, publish_env)
    proposals = factory.plan(f"textbook:{chapter}", dry=False)
    rev = next(p for p in proposals if p["line"] == "revision")
    factory.approve(rev["assignment_id"])
    factory.build(rev["assignment_id"])
    return rev["assignment_id"]


def test_publish_golden_revision_saar_sheet(publish_env, monkeypatch):
    aid = _capture_revision(publish_env, monkeypatch)
    res = run.publish("circular-motion", lanes=["revision"])
    assert res["published"] == ["revision"]
    m = run.list_published()
    art = m["chapters"]["circular-motion"]["artifacts"][0]
    assert art["uid"] == "published:circular-motion:revision"
    assert art["assignment_id"] == aid
    # the frozen copy exists under published/<chapter>/ and matches the manifest sha
    rel = art["files"][0]["rel"]
    data = (publish_env / "published" / rel).read_bytes()
    from samagra.factory.publish import manifest as M
    assert M.sha256_bytes(data) == art["files"][0]["sha256"]
    # a `published` audit event was appended, linked to the lane's assignment
    conn = store.connect()
    try:
        ev = [e for e in store.list_events(conn) if e["verb"] == "published"]
        assert len(ev) == 1 and ev[0]["assignment_id"] == aid
    finally:
        conn.close()


def test_publish_is_idempotent_noop(publish_env, monkeypatch):
    _capture_revision(publish_env, monkeypatch)
    run.publish("circular-motion", lanes=["revision"])
    res = run.publish("circular-motion", lanes=["revision"])
    assert res.get("noop") is True and res["published"] == []
    from samagra.factory.publish import store as pubstore
    assert len(pubstore.read_publications()) == 1     # second publish wrote no record


def test_publish_refuses_chapter_with_no_captured_artifacts(publish_env):
    with pytest.raises(ValueError):
        run.publish("circular-motion")


def test_publish_refuses_non_publishable_lane_filter(publish_env, monkeypatch):
    _capture_revision(publish_env, monkeypatch)
    with pytest.raises(ValueError):
        run.publish("circular-motion", lanes=["seed"])


def test_publish_skips_in_review_artifacts(publish_env, monkeypatch):
    _stub_export(monkeypatch, publish_env)
    factory.plan("textbook:circular-motion", dry=False)   # in-review, never built
    with pytest.raises(ValueError):                        # nothing captured yet
        run.publish("circular-motion", lanes=["revision"])
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_publish_run.py -v -k publish`
Expected: FAIL with `AttributeError: module ... has no attribute 'publish'`

- [ ] **Step 3: Implement `run.publish`**

Append to `samagra/factory/publish/run.py`:

```python
def publish(chapter: str, *, lanes=None, actor: str = _ACTOR) -> dict:
    """Owner release gate (manual): copy a chapter's captured artifacts into the
    immutable published/ snapshot. Idempotent — unchanged lanes are a no-op."""
    chapter = (chapter or "").strip()
    if not chapter:
        raise ValueError("chapter is required")
    want = _norm_lanes(lanes)
    conn = gov.connect()
    try:
        cands = _captured_publishable(conn, chapter, want)
        if not cands:
            raise ValueError(
                f"no captured publishable artifacts for chapter {chapter!r} "
                f"(build + capture them through the factory first)")
        # Stage: read each source file's bytes once + hash (no write yet).
        staged = []
        for c in cands:
            files = []
            for src in c["source_files"]:
                data = Path(src).read_bytes()
                files.append({"rel": f"{chapter}/{Path(src).name}",
                              "sha256": manifest.sha256_bytes(data),
                              "bytes": len(data), "_data": data})
            staged.append({**c, "files": files})
        current = pub.read_manifest()
        unchanged = manifest.unchanged_lanes(current, chapter, staged)
        changed = [s for s in staged if s["lane"] not in unchanged]
        if not changed:
            return {"chapter": chapter, "publication_id": None, "published": [],
                    "skipped_unchanged": sorted(unchanged), "noop": True}
        pub_id = "pub_" + uuid.uuid4().hex[:12]
        at = pub.now()
        entries = []
        for s in changed:
            out_files = []
            for f in s["files"]:
                rel = pub.write_published_file(chapter, Path(f["rel"]).name, f["_data"])
                out_files.append({"rel": rel, "sha256": f["sha256"], "bytes": f["bytes"]})
            entries.append({
                "uid": f"published:{chapter}:{s['lane']}", "lane": s["lane"],
                "assignment_id": s["assignment_id"], "files": out_files,
                "source_seed_ref": f"textbook:{chapter}",
                "style_seed_version": s.get("style_seed_version"),
                "captured_at": s.get("captured_at"), "published_at": at,
                "publication_id": pub_id})
        record = {"publication_id": pub_id, "action": "publish", "actor": actor,
                  "chapter": chapter, "seed_ref": f"textbook:{chapter}",
                  "title": _titleize(chapter), "lanes": [e["lane"] for e in entries],
                  "at": at, "artifacts": entries}
        pub.write_publication(record, sequence=pub.next_sequence())
        for e in entries:
            gov.append_event(
                conn, actor=actor, verb="published", assignment_id=e["assignment_id"],
                subsystem="published", subsystem_ref=chapter,
                note=json.dumps({"publication_id": pub_id, "lane": e["lane"],
                                 "uid": e["uid"],
                                 "sha256": [f["sha256"] for f in e["files"]]},
                                ensure_ascii=False))
        pub.write_manifest(
            manifest.derive_manifest(pub.read_publications(), generated_at=pub.now()))
        return {"chapter": chapter, "publication_id": pub_id,
                "published": [e["lane"] for e in entries],
                "skipped_unchanged": sorted(unchanged)}
    finally:
        conn.close()
```

> Note: `list_published` is referenced by the tests but defined in Task 8. If you
> run only `-k publish` now, add a temporary `def list_published(): ...` or run the
> Task-7 + Task-8 tests together after Task 8. Cleanest: implement Task 8's
> `list_published` immediately after this step, then run.

- [ ] **Step 4: Run tests to verify they pass** (after Task 8's `list_published` exists)

Run: `python -m pytest tests/test_publish_run.py -v -k publish`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/publish/run.py tests/test_publish_run.py
git commit -m "feat(publish): run.publish owner release gate (Phase G1 Task 7)"
```

---

### Task 8: `run.unpublish` + `run.list_published`

**Files:**
- Modify: `samagra/factory/publish/run.py`
- Test: `tests/test_publish_run.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_publish_run.py`:

```python
def test_list_published_empty_when_nothing_published(publish_env):
    m = run.list_published()
    assert m["chapters"] == {} and m["schema"] == "samagra.published.v1"


def test_unpublish_drops_from_manifest_but_keeps_history(publish_env, monkeypatch):
    _capture_revision(publish_env, monkeypatch)
    run.publish("circular-motion", lanes=["revision"])
    res = run.unpublish("circular-motion", lanes=["revision"])
    assert res["unpublished"] == ["revision"]
    assert run.list_published()["chapters"] == {}          # gone from current view
    from samagra.factory.publish import store as pubstore
    recs = pubstore.read_publications()
    assert [r["action"] for r in recs] == ["publish", "unpublish"]   # history retained
    conn = store.connect()
    try:
        verbs = [e["verb"] for e in store.list_events(conn)]
        assert "unpublished" in verbs
    finally:
        conn.close()


def test_unpublish_refuses_unpublished_chapter(publish_env):
    with pytest.raises(ValueError):
        run.unpublish("circular-motion")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_publish_run.py -v -k "list_published or unpublish"`
Expected: FAIL with `AttributeError: ... 'unpublish'` / `'list_published'`

- [ ] **Step 3: Implement `unpublish` + `list_published`**

Append to `samagra/factory/publish/run.py`:

```python
def unpublish(chapter: str, *, lanes=None, actor: str = _ACTOR) -> dict:
    """Owner retract (manual, append-only): drop a chapter (or specific lanes)
    from the CURRENT manifest. The frozen bytes + publication records + ledger are
    never deleted — the consumer simply stops seeing the withdrawn artifacts."""
    chapter = (chapter or "").strip()
    want = _norm_lanes(lanes)
    current = pub.read_manifest() or manifest.derive_manifest(
        pub.read_publications(), generated_at=pub.now())
    ch = (current.get("chapters") or {}).get(chapter)
    if not ch:
        raise ValueError(f"chapter {chapter!r} is not published")
    present = {e["lane"]: e for e in ch.get("artifacts", [])}
    targets = sorted(present) if want is None else sorted(set(present) & want)
    if not targets:
        raise ValueError(f"no published lane(s) to withdraw for chapter {chapter!r}")
    conn = gov.connect()
    try:
        pub_id = "pub_" + uuid.uuid4().hex[:12]
        at = pub.now()
        record = {"publication_id": pub_id, "action": "unpublish", "actor": actor,
                  "chapter": chapter, "seed_ref": f"textbook:{chapter}",
                  "title": ch.get("title"), "lanes": targets, "at": at,
                  "artifacts": [present[l] for l in targets]}
        pub.write_publication(record, sequence=pub.next_sequence())
        for l in targets:
            gov.append_event(
                conn, actor=actor, verb="unpublished",
                assignment_id=present[l].get("assignment_id"),
                subsystem="published", subsystem_ref=chapter,
                note=json.dumps({"publication_id": pub_id, "lane": l,
                                 "uid": present[l].get("uid")}, ensure_ascii=False))
        pub.write_manifest(
            manifest.derive_manifest(pub.read_publications(), generated_at=pub.now()))
        return {"chapter": chapter, "publication_id": pub_id, "unpublished": targets}
    finally:
        conn.close()


def list_published() -> dict:
    """The current published manifest (the export contract). Re-derives from the
    immutable records if manifest.json is absent."""
    m = pub.read_manifest()
    if m is None:
        m = manifest.derive_manifest(pub.read_publications(), generated_at=pub.now())
    return m
```

- [ ] **Step 4: Run all run tests to verify they pass**

Run: `python -m pytest tests/test_publish_run.py -v`
Expected: PASS (all publish/unpublish/list tests)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/publish/run.py tests/test_publish_run.py
git commit -m "feat(publish): run.unpublish retract + list_published (Phase G1 Task 8)"
```

---

### Task 9: Package re-exports + governance-byte-unchanged invariant + golden e2e

**Files:**
- Modify: `samagra/factory/publish/__init__.py`
- Test: `tests/test_publish_run.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_publish_run.py`:

```python
def test_package_reexports_the_public_api():
    from samagra.factory import publish as pub_pkg
    assert callable(pub_pkg.publish)
    assert callable(pub_pkg.unpublish)
    assert callable(pub_pkg.list_published)


def test_publish_leaves_assignments_table_byte_unchanged(publish_env, monkeypatch):
    """The publish boundary is additive: it appends `published` events and writes
    published/ — it must NOT alter the assignment rows (no state-machine change)."""
    _capture_revision(publish_env, monkeypatch)
    conn = store.connect()
    try:
        before = store.list_assignments(conn)
    finally:
        conn.close()
    run.publish("circular-motion", lanes=["revision"])
    conn = store.connect()
    try:
        after = store.list_assignments(conn)
        assert after == before                         # assignments untouched
        verbs = [e["verb"] for e in store.list_events(conn)]
        assert verbs.count("published") == 1           # only an event was appended
        assert all(a["status"] == "captured" for a in after)  # still captured, not 'published'
    finally:
        conn.close()


def test_golden_thread_publish_then_unpublish_roundtrip(publish_env, monkeypatch):
    _capture_revision(publish_env, monkeypatch)
    run.publish("circular-motion", lanes=["revision"])
    assert "circular-motion" in run.list_published()["chapters"]
    run.unpublish("circular-motion")
    assert run.list_published()["chapters"] == {}
    # the frozen file + both publication records persist on disk (append-only)
    from samagra.factory.publish import store as pubstore
    assert len(pubstore.read_publications()) == 2
    assert (publish_env / "published" / "circular-motion"
            / "circular-motion-thin.html").is_file()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_publish_run.py -v -k "reexport or byte_unchanged or golden"`
Expected: FAIL (`publish` not re-exported on the package)

- [ ] **Step 3: Wire the package re-exports**

Replace `samagra/factory/publish/__init__.py` contents with:

```python
"""Phase G1 — the publish boundary: captured -> published (owner-gated)."""
from .run import list_published, publish, unpublish

__all__ = ["publish", "unpublish", "list_published"]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_publish_run.py -v`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/publish/__init__.py tests/test_publish_run.py
git commit -m "feat(publish): package re-exports + governance-unchanged invariant + golden e2e (Phase G1 Task 9)"
```

---

### Task 10: CLI — `factory publish | unpublish | published`

**Files:**
- Modify: `samagra/__main__.py` (`cmd_factory` dispatch; `build_parser` subparsers)
- Test: `tests/test_publish_cli.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_publish_cli.py
import pytest
from samagra import config, __main__ as cli
from samagra.governance import store
from samagra.factory import run as factory


@pytest.fixture
def publish_env(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "GOVERNANCE_DB", tmp_path / "governance.db")
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "exports")
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    store._INITIALIZED.clear()
    store.ensure_tables()
    monkeypatch.chdir(tmp_path)
    yield tmp_path
    store._INITIALIZED.clear()


def test_parser_wires_publish_subcommands():
    p = cli.build_parser()
    ns = p.parse_args(["factory", "publish", "circular-motion", "--lanes", "revision"])
    assert ns.action == "publish" and ns.chapter == "circular-motion" and ns.lanes == "revision"
    ns2 = p.parse_args(["factory", "published"])
    assert ns2.action == "published"
    ns3 = p.parse_args(["factory", "unpublish", "circular-motion"])
    assert ns3.action == "unpublish" and ns3.lanes is None


def test_cli_publish_then_published_prints(publish_env, monkeypatch, capsys):
    def fake_export_one(slug, variant, **kw):
        out = publish_env / f"{slug}-{variant}.html"
        out.write_text(f"<h1>{slug} {variant}</h1>", encoding="utf-8")
        return {"variant": variant, "html": str(out), "docx": None, "gdoc": None}
    monkeypatch.setattr("samagra.lectures.export.export_one", fake_export_one)
    rev = next(p for p in factory.plan("textbook:circular-motion", dry=False)
               if p["line"] == "revision")
    factory.approve(rev["assignment_id"]); factory.build(rev["assignment_id"])

    p = cli.build_parser()
    cli.cmd_factory(p.parse_args(["factory", "publish", "circular-motion", "--lanes", "revision"]))
    cli.cmd_factory(p.parse_args(["factory", "published"]))
    out = capsys.readouterr().out
    assert "factory publish: circular-motion" in out
    assert "circular-motion: revision" in out
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_publish_cli.py -v`
Expected: FAIL (`parse_args(["factory","publish",...])` errors — subcommand not registered)

- [ ] **Step 3: Add the subparsers in `build_parser`**

In `samagra/__main__.py`, immediately after the `gaps` subparser block (after line 407, `ft_gaps.add_argument("--lane", ...)`) and before `ft.set_defaults(func=cmd_factory)`:

```python
    ft_pub = ft_sub.add_parser(
        "publish", help="publish a chapter's captured artifacts (the owner release gate)")
    ft_pub.add_argument("chapter", help="chapter slug, e.g. circular-motion")
    ft_pub.add_argument("--lanes", default=None,
                        help="comma-separated lane subset (default: all captured), "
                             "e.g. revision,deck — Saar sheets first")
    ft_unpub = ft_sub.add_parser(
        "unpublish", help="withdraw a published chapter / lanes from the current manifest")
    ft_unpub.add_argument("chapter")
    ft_unpub.add_argument("--lanes", default=None, help="comma-separated lane subset")
    ft_sub.add_parser("published", help="print the current published corpus")
```

- [ ] **Step 4: Add the dispatch branches in `cmd_factory`**

In `samagra/__main__.py`, inside `cmd_factory`, after the `reopen` branch (after line 163) add:

```python
    elif args.action == "publish":
        from .factory import publish as pub
        res = pub.publish(args.chapter, lanes=args.lanes)
        if res.get("noop"):
            print(f"factory publish: {args.chapter} already published, unchanged "
                  f"(skipped {res['skipped_unchanged']})")
        else:
            extra = (f"; skipped unchanged {res['skipped_unchanged']}"
                     if res.get("skipped_unchanged") else "")
            print(f"factory publish: {args.chapter} -> {res['publication_id']} "
                  f"published {res['published']}{extra}")
    elif args.action == "unpublish":
        from .factory import publish as pub
        res = pub.unpublish(args.chapter, lanes=args.lanes)
        print(f"factory unpublish: {args.chapter} -> {res['publication_id']} "
              f"withdrew {res['unpublished']}")
    elif args.action == "published":
        from .factory import publish as pub
        m = pub.list_published()
        chapters = m.get("chapters") or {}
        if not chapters:
            print("factory published: nothing published yet "
                  "(`factory publish <chapter>` after build).")
        else:
            print(f"published corpus ({len(chapters)} chapter(s), {m['schema']}):")
            for ch, c in sorted(chapters.items()):
                lanes = ", ".join(f"{a['lane']}({len(a['files'])}f)" for a in c["artifacts"])
                print(f"  {ch}: {lanes}")
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_publish_cli.py -v`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add samagra/__main__.py tests/test_publish_cli.py
git commit -m "feat(publish): factory publish|unpublish|published CLI (Phase G1 Task 10)"
```

---

### Task 11: Full-suite gate + tracker updates

**Files:**
- Modify: `CLAUDE.md`, `HANDOFF.md`, `STATUS.html`, `SUMMARY.html`, `TRACKER.md` (whichever the project syncs at a phase boundary — see the project's status-pointer-files convention)

- [ ] **Step 1: Run the full test suite**

Run: `python -m pytest -q`
Expected: all green except the known pre-existing reds — the env-only `test_gdocs` (Google API libs) and the opt-in `test_samadhan_live_smoke` skip. Count should be ≈ 479 + ~28 new = ~507 passing. If any *other* test fails, fix it before proceeding (do not paper over a regression).

- [ ] **Step 2: Confirm the firewall invariants by inspection (no code change)**

Verify, by re-reading `run.py`:
- `publish`/`unpublish` write only under `PUBLISHED_DIR` + `gov.append_event` — no call touches munshi/mcd/QX/textbook/booklets/INSP/sims, and no `set_assignment_status`.
- the only governance writes are `append_event` with verbs `published`/`unpublished` (no migration, no new table, no status change).
- there is no scheduler/auto path — `publish` is reachable only via the CLI / a direct call.

- [ ] **Step 3: Update the trackers** (lift wording from this plan + the spec; keep STATUS.html / SUMMARY.html in the loop per the project convention). Record: Phase G opened (DEC-9 Chairman re-scope); G1 publish boundary shipped; the proposed **DEC-10** invariant set; the new `published/` durable-gitignored dir + `samagra factory publish|unpublish|published` CLI; pytest count; ⚠ owner follow-up: `published/` is gitignored — it is created on first `factory publish`.

- [ ] **Step 4: Commit the tracker sync**

```bash
git add CLAUDE.md HANDOFF.md STATUS.html SUMMARY.html TRACKER.md
git commit -m "docs(trackers): Phase G1 publish boundary shipped — sync CLAUDE/HANDOFF/STATUS/SUMMARY"
```

---

## Post-implementation review gate (NOT plan tasks — run via finishing-a-development-branch)

1. **A dedicated DEC-7-style Codex pre-merge review of the new publish boundary** —
   it is a new write target + the conceptual outward firewall (matching the Phase-1 /
   C3 / D2 boundary reviews). Provide the reviewer: `samagra/factory/publish/{run,store,manifest}.py`,
   the spec, and the new tests. Confirm: reads only captured artifacts; never touches
   the 7 subsystems; manual/never-automated; immutability + append-only honoured;
   retract cannot leak; no phantom publish on a missing note/file. Remediate any
   HIGH/MED TDD-first; re-review to GO.
2. **An adversarial multi-lens final review** (Workflow, 4 lenses × independent verify),
   as every prior phase. Remediate confirmed findings TDD-first.
3. **Merge** (ff to `main`) + **push** to `origin/main` per finishing-a-development-branch,
   once both reviews are GO and the gate is green.

---

## Self-review (completed by the plan author)

**Spec coverage:**
- Static export dir (copy) → Tasks 5, 7. ✓
- Manifest as export contract / derived current view → Tasks 3, 8 (`derive_manifest`, `list_published`). ✓
- Immutable append-only `_publications/` records → Task 5 (`write_publication` refuses overwrite). ✓
- Per-chapter batch + lane filter (Saar first) → Task 6 (`_norm_lanes`), Task 7, Task 10 (`--lanes`). ✓
- Append-only retract dropping from current view, history retained → Task 8, Task 9 golden. ✓
- Idempotent no-op on unchanged content → Task 4 + Task 7. ✓
- mcd/seed lane excluded → Task 6 (`PUBLISHABLE`), tested in Task 6 + Task 7. ✓
- No assignment-state change / no migration / no new table → Task 9 byte-unchanged test. ✓
- Clean refusals (no captured / missing note / missing file / non-publishable lane) → Tasks 6, 7. ✓
- CLI-first, no web endpoint → Task 10 only; no endpoint task (matches the non-goal). ✓
- `published/` gitignored-durable → Task 1. ✓
- `actor="owner"` on events → Task 7, Task 8. ✓
- Golden thread (real-or-synthetic captured chapter) → Task 9 (synthetic via the real factory flow). ✓
- DEC-7 Codex review + adversarial review → post-implementation review gate. ✓

**Placeholder scan:** none — every code/test step shows complete content.

**Type consistency:** `publish`/`unpublish` return dicts with `published`/`unpublished`
+ `publication_id`; manifest entries carry the same keys in Tasks 3/7/8; `_norm_lanes`
returns `set|None` everywhere; `PUBLISHABLE` is a frozenset used consistently;
`store.now`/`read_publications`/`write_publication(sequence=)`/`write_published_file`
signatures match between Task 5 and their callers in Tasks 7–8.

**One ordering note (already flagged in Task 7 Step 3):** `run.publish` references
`list_published` indirectly only via tests; implement Task 8's `list_published`
before running the Task-7 publish tests (or run Tasks 7+8 together).
