# SAMAGRA Content Factory — Phase G2: Outward Read Surface + PRATHAM reader — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the G1-published corpus through a public, read-only HTTP surface (`GET /api/published` + a manifest-resolved, sha-verified artifact endpoint) and a separate full-page `/learn` student reader (PRATHAM) that renders published lanes, Saar-led.

**Architecture:** A pure `factory/publish/read.py` resolver sits over G1's existing `run.list_published()` + the frozen `published/` bytes — no new write path, no migration. Two public FastAPI handlers (left out of `_PROTECTED_GETS`, mirroring `/api/coverage`) serve the manifest and individual artifact bytes resolved *from the manifest* (never a client path) and re-verified by sha256. The frontend adds a self-contained `/learn` reader: `main.tsx` branches on the path to mount `<Pratham/>` (no operator OS-shell), which consumes only `/api/published` and renders each lane's self-contained HTML in a sandboxed iframe.

**Tech Stack:** Python 3 / FastAPI / pytest (backend); React 18 + TypeScript + Vite + Vitest (frontend). Spec: `docs/superpowers/specs/2026-06-27-samagra-content-factory-phase-g2-outward-read-surface-design.md`.

---

## File Structure

**Backend (create):**
- `samagra/factory/publish/read.py` — PURE read-only resolver over the G1 manifest + frozen bytes. Owns `published_manifest()` and `resolve_artifact()`. No writes; never touches governance.db / EXPORT_DIR / `_publications/` / the 7 subsystems.
- `tests/test_publish_read.py` — unit tests for the resolver.
- `tests/test_published_api.py` — endpoint tests (incl. the public/un-gated assertion + the golden integration).

**Backend (modify):**
- `samagra/api/app.py` — add `Response` to the responses import; add `GET /api/published` and `GET /api/published/{chapter}/{lane}` after the coverage endpoints (≈ line 208), before `@app.post("/api/refresh")`.

**Frontend (create):**
- `frontend/src/lib/published/manifest.ts` — PURE types + helpers (`chaptersList`, `laneSort`, `laneLabel`, `artifactUrl`, `pickChapter`, `pickLane`, `fileExts`).
- `frontend/src/lib/published/manifest.test.ts` — vitest for the pure helpers.
- `frontend/src/lib/published/route.ts` — PURE path helpers (`isLearnPath`, `parseLearnPath`, `learnPath`).
- `frontend/src/lib/published/route.test.ts` — vitest for the path helpers.
- `frontend/src/apps/Pratham/index.tsx` — the reader component.
- `frontend/src/apps/Pratham/index.test.tsx` — vitest (mocked `useApi`).

**Frontend (modify):**
- `frontend/src/main.tsx` — branch on `isLearnPath(...)` to mount `<Pratham/>` vs the existing `<App/>`.

**No changes:** `.gitignore` (G1 already ignores `published/`), `config.py` (`PUBLISHED_DIR` already exists), `origin_auth.py` (the new GETs stay public by being *absent* from `_PROTECTED_GETS`), the governance schema, the inward factory.

> **Command note:** run `python -m pytest …` from the repo root. Run `npx vitest run …`, `npm run build`, etc. from the `frontend/` directory (the examples prefix `cd frontend &&` where relevant).

---

## Task 1: `read.py` — the pure read-only resolver

**Files:**
- Create: `samagra/factory/publish/read.py`
- Test: `tests/test_publish_read.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_publish_read.py`:

```python
# tests/test_publish_read.py
import pytest
from samagra import config
from samagra.factory.publish import read, manifest
from samagra.factory.publish import store as pub


@pytest.fixture
def pub_env(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    return tmp_path


def _publish(chapter, lane, files):
    """Write frozen copies + ONE immutable publish record so the derived manifest
    holds a (chapter, lane) artifact. `files`: list of (basename, bytes)."""
    out = []
    for basename, data in files:
        rel = pub.write_published_file(chapter, basename, data)
        out.append({"rel": rel, "sha256": manifest.sha256_bytes(data), "bytes": len(data)})
    pub_id = f"pub_{lane}"
    entry = {"uid": f"published:{chapter}:{lane}", "lane": lane, "assignment_id": "a1",
             "files": out, "source_seed_ref": f"textbook:{chapter}",
             "style_seed_version": None, "captured_at": "t", "published_at": "t",
             "publication_id": pub_id}
    rec = {"publication_id": pub_id, "action": "publish", "actor": "owner",
           "chapter": chapter, "seed_ref": f"textbook:{chapter}",
           "title": chapter.replace("-", " ").title(), "lanes": [lane], "at": "t",
           "artifacts": [entry]}
    pub.write_publication(rec, sequence=pub.next_sequence())
    return out


def test_published_manifest_empty_when_nothing_published(pub_env):
    m = read.published_manifest()
    assert m["schema"] == "samagra.published.v1"
    assert m["chapters"] == {}


def test_resolve_artifact_happy_html(pub_env):
    _publish("cm", "revision", [("cm-thin.html", b"<h1>Saar</h1>")])
    art = read.resolve_artifact("cm", "revision")
    assert art is not None
    assert art["bytes"] == b"<h1>Saar</h1>"
    assert art["media_type"].startswith("text/html")
    assert art["sha256"] == manifest.sha256_bytes(b"<h1>Saar</h1>")
    assert art["rel"] == "cm/cm-thin.html"


def test_resolve_artifact_docx_kind(pub_env):
    _publish("cm", "lecture", [("cm-thick.html", b"<h1>h</h1>"), ("cm-thick.docx", b"DOCX")])
    art = read.resolve_artifact("cm", "lecture", kind="docx")
    assert art is not None
    assert art["bytes"] == b"DOCX"
    assert "wordprocessingml" in art["media_type"]


def test_resolve_artifact_unknown_chapter_lane_kind(pub_env):
    _publish("cm", "revision", [("cm-thin.html", b"x")])
    assert read.resolve_artifact("nope", "revision") is None
    assert read.resolve_artifact("cm", "nope") is None
    assert read.resolve_artifact("cm", "revision", kind="exe") is None
    assert read.resolve_artifact("cm", "revision", kind="docx") is None  # no docx file


def test_resolve_artifact_missing_file_returns_none(pub_env):
    _publish("cm", "revision", [("cm-thin.html", b"x")])
    (pub_env / "published" / "cm" / "cm-thin.html").unlink()
    assert read.resolve_artifact("cm", "revision") is None


def test_resolve_artifact_integrity_mismatch_raises(pub_env):
    _publish("cm", "revision", [("cm-thin.html", b"<h1>ok</h1>")])
    (pub_env / "published" / "cm" / "cm-thin.html").write_bytes(b"TAMPERED")
    with pytest.raises(ValueError, match="integrity"):
        read.resolve_artifact("cm", "revision")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_publish_read.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'samagra.factory.publish.read'`.

- [ ] **Step 3: Write the implementation**

Create `samagra/factory/publish/read.py`:

```python
# samagra/factory/publish/read.py
"""Read-only resolver over the G1 published export contract (Phase G2).

The outward read surface reads ONLY what G1 released: the derived manifest
(`run.list_published()`) and the frozen artifact bytes under PUBLISHED_DIR. It
performs NO writes and never touches governance.db, EXPORT_DIR, the immutable
`_publications/` records, or the seven source subsystems. The artifact path is
always resolved from the manifest entry (never a client-supplied path) and
re-verified by sha256 before any bytes are returned.
"""
from __future__ import annotations

from ... import config
from . import manifest, run
from . import store as pub

# kind -> (accepted file extensions, response media type)
_KIND_EXT = {"html": (".html", ".htm"), "json": (".json",), "docx": (".docx",)}
_KIND_MEDIA = {
    "html": "text/html; charset=utf-8",
    "json": "application/json",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def published_manifest() -> dict:
    """The current published corpus (the `samagra.published.v1` manifest), derived
    from the immutable publication records. Graceful-empty (chapters == {}) when
    nothing is published — never raises for an absent published/ dir."""
    return run.list_published()


def resolve_artifact(chapter: str, lane: str, kind: str = "html") -> dict | None:
    """Resolve ONE published artifact file for (chapter, lane, kind) FROM the
    manifest, re-verify its sha256, and return
    {rel, abs_path, bytes, sha256, media_type}. Returns None for an unknown
    chapter / lane / kind / missing file. Raises ValueError if the on-disk bytes no
    longer match the manifest sha (an integrity breach — surfaced, never silently
    served)."""
    exts = _KIND_EXT.get(kind)
    if exts is None:
        return None
    chap = (published_manifest().get("chapters") or {}).get(chapter)
    if not chap:
        return None
    entry = next((a for a in chap.get("artifacts", []) if a.get("lane") == lane), None)
    if entry is None:
        return None
    f = next((g for g in entry.get("files", [])
              if str(g.get("rel", "")).lower().endswith(exts)), None)
    if f is None:
        return None
    rel = f.get("rel") or ""
    # Defense-in-depth: rel is from our own manifest, but re-validate it is a
    # <safe-chapter>/<safe-basename> pair that stays under PUBLISHED_DIR.
    parts = rel.split("/")
    if len(parts) != 2 or not all(pub._SAFE_SEGMENT.match(p) for p in parts):
        return None
    root = config.PUBLISHED_DIR.resolve()
    abs_path = (config.PUBLISHED_DIR / rel).resolve()
    try:
        abs_path.relative_to(root)
    except ValueError:
        return None
    if not abs_path.is_file():
        return None
    data = abs_path.read_bytes()
    if manifest.sha256_bytes(data) != f.get("sha256"):
        raise ValueError(f"published artifact integrity check failed: {rel}")
    return {"rel": rel, "abs_path": str(abs_path), "bytes": data,
            "sha256": f.get("sha256"), "media_type": _KIND_MEDIA[kind]}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_publish_read.py -q`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add samagra/factory/publish/read.py tests/test_publish_read.py
git commit -m "feat(publish): pure read-only resolver over the G1 manifest (G2 read.py)"
```

---

## Task 2: `GET /api/published` endpoint

**Files:**
- Modify: `samagra/api/app.py` (imports + new handler after the coverage endpoints)
- Test: `tests/test_published_api.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_published_api.py`:

```python
# tests/test_published_api.py
from fastapi.testclient import TestClient
from samagra import config
from samagra.factory.publish import manifest
from samagra.factory.publish import store as pub


def _publish(chapter, lane, files):
    """Write frozen copies + ONE immutable publish record (same helper shape as
    tests/test_publish_read.py). `files`: list of (basename, bytes)."""
    out = []
    for basename, data in files:
        rel = pub.write_published_file(chapter, basename, data)
        out.append({"rel": rel, "sha256": manifest.sha256_bytes(data), "bytes": len(data)})
    pub_id = f"pub_{lane}"
    entry = {"uid": f"published:{chapter}:{lane}", "lane": lane, "assignment_id": "a1",
             "files": out, "source_seed_ref": f"textbook:{chapter}",
             "style_seed_version": None, "captured_at": "t", "published_at": "t",
             "publication_id": pub_id}
    rec = {"publication_id": pub_id, "action": "publish", "actor": "owner",
           "chapter": chapter, "seed_ref": f"textbook:{chapter}",
           "title": chapter.replace("-", " ").title(), "lanes": [lane], "at": "t",
           "artifacts": [entry]}
    pub.write_publication(rec, sequence=pub.next_sequence())


def test_api_published_empty(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    from samagra.api.app import app
    r = TestClient(app).get("/api/published")
    assert r.status_code == 200
    body = r.json()
    assert body["schema"] == "samagra.published.v1"
    assert body["chapters"] == {}


def test_api_published_lists_chapters(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    _publish("circular-motion", "revision", [("circular-motion-thin.html", b"<h1>S</h1>")])
    from samagra.api.app import app
    r = TestClient(app).get("/api/published")
    assert r.status_code == 200
    ch = r.json()["chapters"]["circular-motion"]
    assert ch["artifacts"][0]["lane"] == "revision"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_published_api.py -q`
Expected: FAIL — `/api/published` 404s (route not defined → the SPA catch-all returns 404 for `api/...`).

- [ ] **Step 3: Add the import**

In `samagra/api/app.py`, change the responses import (currently line 15):

```python
from fastapi.responses import FileResponse, HTMLResponse, Response
```

- [ ] **Step 4: Add the handler**

In `samagra/api/app.py`, immediately after the `api_coverage_concept` handler (after the block ending at the `return dossier` near line 208) and before `@app.post("/api/refresh")`, add:

```python
# -- G2 outward read surface (public, read-only) ------------------------
@app.get("/api/published")
def api_published():
    # Phase G2: the outward read surface. Public-by-design (deliberately NOT in
    # origin_auth._PROTECTED_GETS) — it serves only the corpus the owner already
    # released through the G1 publish gate. Graceful-empty (chapters == {}) when
    # nothing is published; never a 500 (mirrors /api/coverage).
    from ..factory.publish import read
    return read.published_manifest()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_published_api.py -q`
Expected: PASS (2 passed).

- [ ] **Step 6: Commit**

```bash
git add samagra/api/app.py tests/test_published_api.py
git commit -m "feat(api): public GET /api/published (G2 outward manifest read)"
```

---

## Task 3: `GET /api/published/{chapter}/{lane}` artifact endpoint

**Files:**
- Modify: `samagra/api/app.py` (second handler)
- Test: `tests/test_published_api.py` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_published_api.py`:

```python
def test_api_published_artifact_returns_html(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    _publish("circular-motion", "revision", [("circular-motion-thin.html", b"<h1>Saar</h1>")])
    from samagra.api.app import app
    r = TestClient(app).get("/api/published/circular-motion/revision")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")
    assert r.content == b"<h1>Saar</h1>"


def test_api_published_artifact_docx_kind(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    _publish("cm", "lecture", [("cm-thick.html", b"<h1>h</h1>"), ("cm-thick.docx", b"DOCX")])
    from samagra.api.app import app
    r = TestClient(app).get("/api/published/cm/lecture?kind=docx")
    assert r.status_code == 200
    assert r.content == b"DOCX"
    assert "wordprocessingml" in r.headers["content-type"]


def test_api_published_artifact_unknown_is_404(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    from samagra.api.app import app
    assert TestClient(app).get("/api/published/nope/revision").status_code == 404


def test_api_published_artifact_integrity_breach_is_500(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    _publish("cm", "revision", [("cm-thin.html", b"<h1>ok</h1>")])
    (tmp_path / "published" / "cm" / "cm-thin.html").write_bytes(b"TAMPERED")
    from samagra.api.app import app
    assert TestClient(app).get("/api/published/cm/revision").status_code == 500


def test_published_endpoints_are_public_not_gated():
    # The G2 read surface is intentionally PUBLIC: it must NOT be in _PROTECTED_GETS
    # (it serves only owner-released content). Mirrors the /api/coverage precedent.
    from samagra.api import origin_auth
    assert origin_auth.is_protected("GET", "/api/published") is False
    assert origin_auth.is_protected("GET", "/api/published/cm/revision") is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_published_api.py -q`
Expected: FAIL — the artifact route 404s for the happy/docx/integrity cases (`test_published_endpoints_are_public_not_gated` already passes; the unknown-404 case passes coincidentally).

- [ ] **Step 3: Add the handler**

In `samagra/api/app.py`, immediately after the `api_published` handler from Task 2, add:

```python
@app.get("/api/published/{chapter}/{lane}")
def api_published_artifact(chapter: str, lane: str, kind: str = "html"):
    # One published artifact's bytes, resolved FROM the manifest (never a
    # client-supplied path) and sha-verified. Public read. 404 on unknown
    # chapter/lane/kind; 500 on an integrity breach (a tampered/rebuilt frozen file
    # whose bytes no longer match the manifest sha — surfaced, never served).
    from ..factory.publish import read
    try:
        art = read.resolve_artifact(chapter, lane, kind=kind)
    except ValueError:
        raise HTTPException(status_code=500, detail="artifact integrity check failed")
    if art is None:
        raise HTTPException(status_code=404, detail="not published")
    return Response(content=art["bytes"], media_type=art["media_type"])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_published_api.py -q`
Expected: PASS (7 passed).

- [ ] **Step 5: Commit**

```bash
git add samagra/api/app.py tests/test_published_api.py
git commit -m "feat(api): public GET /api/published/{chapter}/{lane} (sha-verified artifact bytes)"
```

---

## Task 4: Golden integration — factory → publish → API

**Files:**
- Test: `tests/test_published_api.py` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/test_published_api.py`:

```python
def test_golden_api_serves_a_published_saar_sheet(tmp_path, monkeypatch):
    # Full slice: capture a real revision artifact through the factory, publish it
    # (G1), then read it back through the G2 outward endpoints.
    monkeypatch.setattr(config, "GOVERNANCE_DB", tmp_path / "governance.db")
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
    monkeypatch.setattr(config, "EXPORT_DIR", tmp_path / "exports")
    monkeypatch.setattr(config, "PUBLISHED_DIR", tmp_path / "published")
    from samagra.governance import store as gov
    gov._INITIALIZED.clear()
    gov.ensure_tables()
    monkeypatch.chdir(tmp_path)

    def fake_export_one(slug, variant, **kw):
        out = tmp_path / f"{slug}-{variant}.html"
        out.write_text(f"<h1>{slug} {variant}</h1>", encoding="utf-8")
        return {"variant": variant, "html": str(out), "docx": None, "gdoc": None}
    monkeypatch.setattr("samagra.lectures.export.export_one", fake_export_one)

    from samagra.factory import run as factory
    from samagra.factory.publish import run as publish
    proposals = factory.plan("textbook:circular-motion", dry=False)
    rev = next(p for p in proposals if p["line"] == "revision")
    factory.approve(rev["assignment_id"])
    factory.build(rev["assignment_id"])
    publish.publish("circular-motion", lanes=["revision"])

    from samagra.api.app import app
    client = TestClient(app)
    m = client.get("/api/published").json()
    assert "circular-motion" in m["chapters"]
    r = client.get("/api/published/circular-motion/revision")
    assert r.status_code == 200
    assert r.content == b"<h1>circular-motion revision</h1>"
    gov._INITIALIZED.clear()
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `python -m pytest tests/test_published_api.py::test_golden_api_serves_a_published_saar_sheet -q`
Expected: PASS (the read surface is already implemented; this proves the end-to-end factory→publish→serve thread). If it fails, the failure is in the wiring — read the error before changing code.

- [ ] **Step 3: Run the full backend publish suite (no regressions)**

Run: `python -m pytest tests/test_publish_read.py tests/test_published_api.py tests/test_publish_run.py -q`
Expected: PASS (all green).

- [ ] **Step 4: Commit**

```bash
git add tests/test_published_api.py
git commit -m "test(api): golden thread — factory capture -> publish -> G2 read surface"
```

---

## Task 5: `lib/published/manifest.ts` — pure types + helpers

**Files:**
- Create: `frontend/src/lib/published/manifest.ts`
- Test: `frontend/src/lib/published/manifest.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/published/manifest.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  artifactUrl, chaptersList, fileExts, laneLabel, laneSort, pickChapter, pickLane,
  type PublishedManifest,
} from "./manifest";

const manifest: PublishedManifest = {
  schema: "samagra.published.v1", generated_at: "t", publication_count: 2,
  chapters: {
    "circular-motion": {
      chapter: "circular-motion", title: "Circular Motion",
      seed_ref: "textbook:circular-motion",
      artifacts: [
        { uid: "u1", lane: "lecture", assignment_id: "a", files: [{ rel: "circular-motion/cm-thick.html", sha256: "s", bytes: 1 }, { rel: "circular-motion/cm-thick.docx", sha256: "s2", bytes: 2 }], source_seed_ref: "", style_seed_version: null, captured_at: null, published_at: null, publication_id: "p" },
        { uid: "u2", lane: "revision", assignment_id: "a", files: [{ rel: "circular-motion/cm-thin.html", sha256: "s", bytes: 1 }], source_seed_ref: "", style_seed_version: null, captured_at: null, published_at: null, publication_id: "p" },
      ],
    },
    "atoms": {
      chapter: "atoms", title: "Atoms", seed_ref: "textbook:atoms", artifacts: [],
    },
  },
};

describe("chaptersList", () => {
  it("extracts + sorts chapters by title, defensive on null", () => {
    const cs = chaptersList(manifest);
    expect(cs.map((c) => c.chapter)).toEqual(["atoms", "circular-motion"]);
    expect(chaptersList(null)).toEqual([]);
    expect(chaptersList({ ...manifest, chapters: undefined as never })).toEqual([]);
  });
});

describe("laneSort", () => {
  it("Saar-led order; unknown lanes after, alphabetical", () => {
    expect(laneSort(["lecture", "revision"])).toEqual(["revision", "lecture"]);
    expect(laneSort(["zeta", "deck", "alpha"])).toEqual(["deck", "alpha", "zeta"]);
    expect(laneSort(["revision", "revision"])).toEqual(["revision"]);  // de-duped
  });
});

describe("laneLabel", () => {
  it("maps known lanes; falls back to titlecase", () => {
    expect(laneLabel("revision").name).toBe("Saar");
    expect(laneLabel("paper").name).toBe("Pariksha");
    expect(laneLabel("mystery_lane").name).toBe("Mystery Lane");
  });
});

describe("pickChapter / pickLane", () => {
  it("returns the requested if present, else the first", () => {
    const cs = chaptersList(manifest);
    expect(pickChapter(cs, "circular-motion")?.chapter).toBe("circular-motion");
    expect(pickChapter(cs, "missing")?.chapter).toBe("atoms");      // fallback to first
    expect(pickChapter([], "x")).toBeUndefined();
    expect(pickLane(["revision", "lecture"], "lecture")).toBe("lecture");
    expect(pickLane(["revision", "lecture"], "missing")).toBe("revision");
    expect(pickLane([], undefined)).toBeUndefined();
  });
});

describe("fileExts", () => {
  it("lists lowercased extensions present on an artifact", () => {
    const cm = chaptersList(manifest).find((c) => c.chapter === "circular-motion")!;
    const lecture = cm.artifacts.find((a) => a.lane === "lecture")!;
    expect(fileExts(lecture).sort()).toEqual(["docx", "html"]);
    expect(fileExts(undefined)).toEqual([]);
  });
});

describe("artifactUrl", () => {
  it("builds the endpoint path; adds ?kind= only for non-html", () => {
    expect(artifactUrl("cm", "revision")).toBe("/api/published/cm/revision");
    expect(artifactUrl("cm", "lecture", "html")).toBe("/api/published/cm/lecture");
    expect(artifactUrl("cm", "lecture", "docx")).toBe("/api/published/cm/lecture?kind=docx");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/published/manifest.test.ts`
Expected: FAIL — cannot resolve `./manifest`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/published/manifest.ts`:

```ts
// Pure helpers + types over the G1 `samagra.published.v1` export contract.
// Zero React, zero DOM — fully headless-testable (the PRATHAM reader's logic core).

export interface PublishedFile {
  rel: string;
  sha256: string;
  bytes: number;
}
export interface PublishedArtifact {
  uid: string;
  lane: string;
  assignment_id: string;
  files: PublishedFile[];
  source_seed_ref: string;
  style_seed_version: string | null;
  captured_at: string | null;
  published_at: string | null;
  publication_id: string;
}
export interface PublishedChapter {
  chapter: string;
  title: string | null;
  seed_ref: string | null;
  artifacts: PublishedArtifact[];
}
export interface PublishedManifest {
  schema: string;
  generated_at: string | null;
  publication_count: number;
  chapters: Record<string, PublishedChapter>;
}

// Saar-led canonical lane order; unknown lanes sort after, alphabetically.
export const LANE_ORDER = ["revision", "lecture", "deck", "paper", "drill", "samadhan"];

const LANE_LABELS: Record<string, { name: string; gloss: string }> = {
  revision: { name: "Saar", gloss: "Revision sheet" },
  lecture: { name: "Vaani", gloss: "Lecture" },
  deck: { name: "Smriti", gloss: "Flashcards" },
  paper: { name: "Pariksha", gloss: "Practice paper" },
  drill: { name: "Abhyaas", gloss: "Drill" },
  samadhan: { name: "Samadhan", gloss: "Solutions" },
};

function titlecase(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function laneLabel(lane: string): { name: string; gloss: string } {
  return LANE_LABELS[lane] ?? { name: titlecase(lane), gloss: "" };
}

export function laneSort(lanes: string[]): string[] {
  const rank = (l: string) => {
    const i = LANE_ORDER.indexOf(l);
    return i === -1 ? LANE_ORDER.length : i;
  };
  return [...new Set(lanes)].sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    return ra !== rb ? ra - rb : a.localeCompare(b);
  });
}

export function chaptersList(m: PublishedManifest | null | undefined): PublishedChapter[] {
  const chapters = m?.chapters;
  if (!chapters || typeof chapters !== "object") return [];
  return Object.values(chapters)
    .filter((c): c is PublishedChapter => !!c && Array.isArray(c.artifacts))
    .sort((a, b) => (a.title ?? a.chapter).localeCompare(b.title ?? b.chapter));
}

export function pickChapter(
  chapters: PublishedChapter[], slug?: string,
): PublishedChapter | undefined {
  if (slug) {
    const hit = chapters.find((c) => c.chapter === slug);
    if (hit) return hit;
  }
  return chapters[0];
}

export function pickLane(lanes: string[], lane?: string): string | undefined {
  if (lane && lanes.includes(lane)) return lane;
  return lanes[0];
}

export function fileExts(artifact: PublishedArtifact | undefined): string[] {
  if (!artifact || !Array.isArray(artifact.files)) return [];
  return artifact.files
    .map((f) => {
      const m = /\.([A-Za-z0-9]+)$/.exec(f.rel || "");
      return m ? m[1].toLowerCase() : "";
    })
    .filter(Boolean);
}

export function artifactUrl(chapter: string, lane: string, kind?: string): string {
  const base = `/api/published/${encodeURIComponent(chapter)}/${encodeURIComponent(lane)}`;
  return kind && kind !== "html" ? `${base}?kind=${encodeURIComponent(kind)}` : base;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/published/manifest.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/published/manifest.ts frontend/src/lib/published/manifest.test.ts
git commit -m "feat(web): pure published-manifest helpers (G2 reader logic core)"
```

---

## Task 6: `lib/published/route.ts` — pure path helpers

**Files:**
- Create: `frontend/src/lib/published/route.ts`
- Test: `frontend/src/lib/published/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/published/route.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isLearnPath, learnPath, parseLearnPath } from "./route";

describe("isLearnPath", () => {
  it("matches /learn and /learn/...", () => {
    expect(isLearnPath("/learn")).toBe(true);
    expect(isLearnPath("/learn/circular-motion")).toBe(true);
    expect(isLearnPath("/learn/cm/revision")).toBe(true);
    expect(isLearnPath("/")).toBe(false);
    expect(isLearnPath("/learning")).toBe(false);   // not a prefix match by accident
    expect(isLearnPath("/dashboard")).toBe(false);
  });
});

describe("parseLearnPath", () => {
  it("extracts chapter + lane; empty for non-learn paths", () => {
    expect(parseLearnPath("/learn")).toEqual({});
    expect(parseLearnPath("/learn/circular-motion")).toEqual({ chapter: "circular-motion" });
    expect(parseLearnPath("/learn/cm/revision")).toEqual({ chapter: "cm", lane: "revision" });
    expect(parseLearnPath("/")).toEqual({});
  });
});

describe("learnPath", () => {
  it("builds the canonical /learn URL", () => {
    expect(learnPath()).toBe("/learn");
    expect(learnPath("cm")).toBe("/learn/cm");
    expect(learnPath("cm", "revision")).toBe("/learn/cm/revision");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/published/route.test.ts`
Expected: FAIL — cannot resolve `./route`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/published/route.ts`:

```ts
// Pure path helpers for the standalone /learn reader (no router dependency).

export interface LearnSelection {
  chapter?: string;
  lane?: string;
}

export function isLearnPath(pathname: string): boolean {
  return pathname === "/learn" || pathname.startsWith("/learn/");
}

export function parseLearnPath(pathname: string): LearnSelection {
  if (!isLearnPath(pathname)) return {};
  const rest = pathname.slice("/learn".length).replace(/^\/+/, "");
  if (!rest) return {};
  const [chapter, lane] = rest.split("/");
  const out: LearnSelection = {};
  if (chapter) out.chapter = decodeURIComponent(chapter);
  if (lane) out.lane = decodeURIComponent(lane);
  return out;
}

export function learnPath(chapter?: string, lane?: string): string {
  if (!chapter) return "/learn";
  const c = encodeURIComponent(chapter);
  return lane ? `/learn/${c}/${encodeURIComponent(lane)}` : `/learn/${c}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/published/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/published/route.ts frontend/src/lib/published/route.test.ts
git commit -m "feat(web): pure /learn path helpers (isLearnPath/parseLearnPath/learnPath)"
```

---

## Task 7: `apps/Pratham/index.tsx` — the reader component

**Files:**
- Create: `frontend/src/apps/Pratham/index.tsx`
- Test: `frontend/src/apps/Pratham/index.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/apps/Pratham/index.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Pratham from "./index";

const manifest = {
  schema: "samagra.published.v1", generated_at: "t", publication_count: 1,
  chapters: {
    "circular-motion": {
      chapter: "circular-motion", title: "Circular Motion",
      seed_ref: "textbook:circular-motion",
      artifacts: [
        { uid: "u1", lane: "lecture", assignment_id: "a", files: [{ rel: "circular-motion/cm-thick.html", sha256: "s", bytes: 1 }], source_seed_ref: "", style_seed_version: null, captured_at: null, published_at: null, publication_id: "p" },
        { uid: "u2", lane: "revision", assignment_id: "a", files: [{ rel: "circular-motion/cm-thin.html", sha256: "s", bytes: 1 }], source_seed_ref: "", style_seed_version: null, captured_at: null, published_at: null, publication_id: "p" },
      ],
    },
  },
};

describe("Pratham reader", () => {
  beforeEach(() => useApiMock.mockReset());

  it("reads /api/published and renders the chapter list", () => {
    useApiMock.mockReturnValue({ data: manifest, loading: false, error: null });
    render(<Pratham />);
    expect(useApiMock).toHaveBeenCalledWith("/api/published");
    expect(screen.getByTestId("pratham-chapter-circular-motion")).toBeInTheDocument();
  });

  it("leads with the Saar (revision) lane and points the frame at it", () => {
    useApiMock.mockReturnValue({ data: manifest, loading: false, error: null });
    render(<Pratham />);
    expect(screen.getByTestId("pratham-lane-revision")).toBeInTheDocument();
    expect(screen.getByTestId("pratham-frame").getAttribute("src"))
      .toBe("/api/published/circular-motion/revision");
  });

  it("switching lane swaps the iframe src", () => {
    useApiMock.mockReturnValue({ data: manifest, loading: false, error: null });
    render(<Pratham />);
    fireEvent.click(screen.getByTestId("pratham-lane-lecture"));
    expect(screen.getByTestId("pratham-frame").getAttribute("src"))
      .toBe("/api/published/circular-motion/lecture");
  });

  it("empty manifest shows the empty state", () => {
    useApiMock.mockReturnValue({ data: { ...manifest, chapters: {} }, loading: false, error: null });
    render(<Pratham />);
    expect(screen.getByTestId("pratham-empty")).toHaveTextContent("Nothing published yet.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/apps/Pratham/index.test.tsx`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/apps/Pratham/index.tsx`:

```tsx
// The PRATHAM reader — the Phase G2 student surface. A separate full-page
// experience (mounted at /learn, NO operator OS-shell chrome) that reads ONLY the
// public /api/published surface. The Saar (revision) sheet leads; each lane's
// self-contained HTML renders in a sandboxed iframe (origin-isolated from the app).
import { useState } from "react";
import { useApi } from "../../hooks/useApi";
import {
  artifactUrl, chaptersList, fileExts, laneLabel, laneSort, pickChapter, pickLane,
  type PublishedManifest,
} from "../../lib/published/manifest";
import { learnPath, parseLearnPath } from "../../lib/published/route";

const C = {
  bg: "#fbfbfd", text: "#1c1c28", muted: "#6b7280", line: "#e6e6ef",
  accent: "#2563eb", card: "#ffffff",
  font: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

export default function Pratham() {
  const { data, loading } = useApi<PublishedManifest>("/api/published");
  const chapters = chaptersList(data);
  const [sel, setSel] = useState(() => parseLearnPath(window.location.pathname));

  const chapter = pickChapter(chapters, sel.chapter);
  const lanes = chapter ? laneSort(chapter.artifacts.map((a) => a.lane)) : [];
  const lane = pickLane(lanes, sel.lane);
  const artifact = chapter?.artifacts.find((a) => a.lane === lane);
  const hasDocx = fileExts(artifact).includes("docx");

  function go(nextChapter?: string, nextLane?: string) {
    setSel({ chapter: nextChapter, lane: nextLane });
    window.history.pushState(null, "", learnPath(nextChapter, nextLane));
  }

  return (
    <div data-testid="pratham" style={{
      position: "fixed", inset: 0, display: "flex", flexDirection: "column",
      background: C.bg, color: C.text, font: `15px ${C.font}`,
    }}>
      <header style={{
        padding: "14px 22px", borderBottom: `1px solid ${C.line}`,
        display: "flex", alignItems: "baseline", gap: 10,
      }}>
        <strong style={{ fontSize: 18, letterSpacing: 0.2 }}>PRATHAM</strong>
        <span style={{ color: C.muted, fontSize: 13 }}>Published revision corpus</span>
      </header>

      {chapters.length === 0 ? (
        <div data-testid="pratham-empty" aria-busy={loading} style={{
          margin: "auto", color: C.muted, textAlign: "center", padding: 40,
        }}>
          {loading ? "Loading…" : "Nothing published yet."}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <nav style={{
            width: 240, borderRight: `1px solid ${C.line}`, overflowY: "auto", padding: 10,
          }}>
            {chapters.map((c) => (
              <button key={c.chapter} data-testid={`pratham-chapter-${c.chapter}`}
                onClick={() => go(c.chapter, undefined)}
                style={{
                  display: "block", width: "100%", textAlign: "left", border: 0,
                  background: c.chapter === chapter?.chapter
                    ? `color-mix(in srgb, ${C.accent} 12%, transparent)` : "transparent",
                  color: C.text, font: "inherit", padding: "8px 10px",
                  borderRadius: 8, cursor: "pointer",
                }}>
                {c.title ?? c.chapter}
              </button>
            ))}
          </nav>

          <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{
              display: "flex", gap: 6, padding: "10px 14px", flexWrap: "wrap",
              borderBottom: `1px solid ${C.line}`, alignItems: "center",
            }}>
              {lanes.map((l) => {
                const lab = laneLabel(l);
                return (
                  <button key={l} data-testid={`pratham-lane-${l}`}
                    onClick={() => go(chapter?.chapter, l)} title={lab.gloss}
                    style={{
                      border: `1px solid ${l === lane ? C.accent : C.line}`,
                      background: l === lane ? C.accent : C.card,
                      color: l === lane ? "#fff" : C.text, font: "inherit",
                      padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                    }}>
                    {lab.name}
                  </button>
                );
              })}
              {hasDocx && chapter && lane ? (
                <a data-testid="pratham-docx"
                  href={artifactUrl(chapter.chapter, lane, "docx")}
                  style={{ marginLeft: "auto", color: C.accent, fontSize: 13 }}>
                  Download .docx
                </a>
              ) : null}
            </div>
            {chapter && lane ? (
              <iframe data-testid="pratham-frame"
                title={`${chapter.title ?? chapter.chapter} — ${laneLabel(lane).name}`}
                src={artifactUrl(chapter.chapter, lane)}
                sandbox="allow-scripts"
                style={{ flex: 1, border: 0, width: "100%", background: "#fff" }} />
            ) : null}
          </main>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/apps/Pratham/index.test.tsx`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/apps/Pratham/index.tsx frontend/src/apps/Pratham/index.test.tsx
git commit -m "feat(web): PRATHAM /learn reader — Saar-led, sandboxed-iframe lane render"
```

---

## Task 8: `main.tsx` — mount the reader at `/learn`

**Files:**
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Write the implementation**

Replace the entire contents of `frontend/src/main.tsx` with:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Pratham from "./apps/Pratham";
import { isLearnPath } from "./lib/published/route";

// Phase G2: the student reader is a SEPARATE full-page experience. Branch on the
// path before mount so /learn gets PRATHAM (no operator OS-shell chrome) while
// every other path keeps the existing operator console.
const Root = isLearnPath(window.location.pathname) ? Pratham : App;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
```

- [ ] **Step 2: Typecheck + build to verify the wiring compiles**

Run: `cd frontend && npm run build`
Expected: PASS — `tsc --noEmit` reports no errors and `vite build` writes `dist/`.

- [ ] **Step 3: Run the full frontend test suite (no regressions)**

Run: `cd frontend && npm test`
Expected: PASS — all vitest suites green (existing console tests + the 3 new published suites).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/main.tsx
git commit -m "feat(web): mount the PRATHAM /learn reader (path split in main.tsx)"
```

---

## Task 9: Full verification gate

**Files:** none (verification only)

- [ ] **Step 1: Backend — full pytest suite**

Run: `python -m pytest -q`
Expected: PASS. The publish read + API tests add ≈ 15 tests over the current 534. The lone pre-existing red is the env-dependent `test_gdocs` (Google API libs absent); the opt-in live-LLM smoke is skipped. No NEW reds.

- [ ] **Step 2: Frontend — lint + typecheck + test + build**

Run: `cd frontend && npm run verify`
Expected: PASS — `lint`, `typecheck`, `test`, and `build` all green.

- [ ] **Step 3: Confirm the firewall invariants by inspection**

Verify each holds (read the diff, do not assume):
- `read.py` performs NO writes and imports nothing from the 7 subsystems / `EXPORT_DIR` / `governance.store` write paths (it only reads `run.list_published()` + `PUBLISHED_DIR` bytes).
- `origin_auth._PROTECTED_GETS` is UNCHANGED — the new GETs are public by absence (proven by `test_published_endpoints_are_public_not_gated`).
- No new governance migration / table / assignment-state change; the inward `build()` boundary is untouched.
- `main.tsx` imports the reader but `<Pratham/>` imports NO operator-shell module (only `useApi` + `lib/published`).

- [ ] **Step 4: Final commit (if any inspection fixups were needed)**

```bash
git add -A
git commit -m "chore(g2): verification gate green — outward read surface complete"
```

---

## Self-Review (completed by the plan author)

**1. Spec coverage** — every spec section maps to a task:
- Spec §5.1 `read.py` resolver → Task 1. §5.2 `GET /api/published` → Task 2. §5.3 artifact endpoint → Task 3.
- §6.1 `main.tsx` split → Task 8. §6.2 `lib/published/` → Tasks 5–6. §6.3 `<Pratham/>` reader → Task 7.
- §7 data flow / error handling → covered by the 404/500/empty tests across Tasks 2–4, 7.
- §8 acceptance golden thread → Task 4. §10 testing strategy → Tasks 1–9 (pytest + vitest + the public/un-gated + integrity tests).
- §11 non-goals (no write path, no identity, no migration) → enforced by Task 9 Step 3 inspection + the read-only `read.py`.

**2. Placeholder scan** — no TBD/TODO; every code step shows complete content; every command shows expected output.

**3. Type consistency** — `published_manifest()` / `resolve_artifact(chapter, lane, kind="html")` returning `{rel, abs_path, bytes, sha256, media_type}` are used identically in Tasks 1–4. The TS `PublishedManifest`/`PublishedChapter`/`PublishedArtifact` shapes and the helper names (`chaptersList`, `laneSort`, `laneLabel`, `pickChapter`, `pickLane`, `fileExts`, `artifactUrl`, `isLearnPath`, `parseLearnPath`, `learnPath`) match across Tasks 5–8. `data-testid` values (`pratham`, `pratham-empty`, `pratham-chapter-<slug>`, `pratham-lane-<lane>`, `pratham-frame`, `pratham-docx`) match between the reader (Task 7) and its test.

**Post-implementation review gate (per spec §9):** an adversarial multi-lens final review (Workflow, 4 lenses × independent verify) — firewall (read-only proven), security (no traversal; nothing un-published leaks; iframe sandbox isolates foreign HTML), spec-fidelity, separate-entity boundary. No dedicated Codex boundary review is required (G2 adds no write/generation boundary).
