# SAMAGRA Control Plane — Capture + read-only surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This run executes it via **dynamic Workflows** (one slice per phase, with an independent Codex review baked into each slice) — the task/step breakdown below is the source of truth for what each Workflow stage builds.

**Goal:** Make the SAMAGRA OS a working control plane — real owner-initiated captures into live Munshi + mycontentdev, and corrected read-only browsing of deployed Pratyaksh sims and the QX question bank.

**Architecture:** Browser → SAMAGRA FastAPI (holds all secrets) → read-only/now-write subsystem clients → live subsystems. All real logic in pure, headlessly-tested TS modules (`lib/capture/*`, `lib/sims/*`) + small Python helpers; React components and FastAPI routes stay thin. Two new write paths (`POST /api/munshi/capture`, `POST /api/mcd/seeds`) are creds-gated, server-validated, and never leak secrets. Everything else is read-only.

**Tech Stack:** Python 3.11 (`.venv`) · FastAPI · `requests` · `pytest` · React 18 + TS + Vite · Zustand · Vitest + RTL · `npm run verify` gate · Codex CLI (`codex exec`, gpt-5.5/xhigh) for per-slice review · advisory pre-commit gate active.

---

## Ground truth (verified this session — do NOT re-derive)

- **Munshi write** = `POST {MUNSHI_API_URL}/api/item`, **JSON** body, cookie `munshi=<urlencoded secret>` (same stateless auth as `library()`; live-verified). Deterministic kinds **only** (`agent.ts:227-236` → `tools.ts`):
  - `todo` → requires `assignee` + `task` (opt `due`)
  - `note` → requires `student` + `issue` (opt `label`)
  - `followup` → requires `date` + `note` (opt `person`)
  - any other kind → the worker 400s. issue/question are NOT writable via `/api/item`.
- **mcd write** = `POST {apiUrl}/api/seeds`, **form-encoded** (worker calls `request.formData()` — NOT JSON), header **`x-mcd-admin: <adminKey>`** (the existing read key authorizes the write — `functions/_middleware.js` accepts `adminOk`; live-verified GET 200; no per-route re-check). Fields `type` (required), `raw_text`, `title?`, `detail?` (JSON string), `source_ref?` → 201. Files out of scope.
- **Sims** = parse `{SIMS_ROOT}/deployed-sims-by-grade.md` (`## <grade>` / `### <subject>` / `- <id> — <title>`), 482 entries. URL = `https://pratyakshsims.com/sims/SIM<NNNN>/SIM<NNNN>_sim.html` (`<NNNN>` = 4-digit zero-padded id; confirmed `public/sims/SIM0018/SIM0018_sim.html`).
- **QX facets** = `qx.summary()["subjects"]` is a **dict** `{subject: count}` of question-scoped subjects (from the builder DB `search_index`); empty `{}` when the builder DB is absent (`adapters/qx.py:50-70`).
- **Existing patterns:** clients monkeypatch `requests` in unit tests; endpoints tested via FastAPI `TestClient` with a mocked client; `useApi` is a GET-only abort-guarded hook (`hooks/useApi.ts`) — `useApiPost` mirrors it imperatively. `conftest.py` autouse-isolates `DATA_DB`/`GOVERNANCE_DB`.

---

## Shared Contracts (freeze — every later task imports these verbatim)

**Python**
- `MunshiClient.create_item(kind: str, fields: dict) -> dict` (POST `/api/item`, JSON, cookie)
- `McdClient.create_seed(fields: dict) -> dict` (POST `/api/seeds`, form-encoded, `x-mcd-admin`)
- `samagra/sims_manifest.py`: `parse_deployed_sims(text: str) -> list[dict]`, `sim_url(sim_id: str) -> str`
- New routes: `POST /api/munshi/capture`, `POST /api/mcd/seeds`, `GET /api/sims`, `GET /api/questions/facets`

**TypeScript (`frontend/src/types/contracts.ts` — additive)**
```ts
export type MunshiKind = "todo" | "note" | "followup";
export interface MunshiCaptureForm { kind: MunshiKind; [field: string]: string; }
export interface SeedForm { type: SeedType; title?: string; raw_text: string; source_ref?: string; }
export type SeedType =
  | "concept" | "question" | "snippet" | "simulation_idea"
  | "experiment" | "notebooklm_link" | "rough_idea";
export interface SimRow { id: string; title: string; subject: string | null; grade: string | null; url: string; }
export interface SimsResponse { sims: SimRow[]; total: number; }
export interface QuestionFacets { subjects: string[]; }
```

**File map**
| Create | Modify |
|---|---|
| `samagra/sims_manifest.py` | `samagra/clients/munshi_client.py` |
| `tests/test_sims_manifest.py` | `samagra/clients/mcd_client.py` |
| `tests/test_api_capture.py` | `samagra/api/app.py` (append routes) |
| `tests/test_api_sims.py` | `tests/test_clients.py` (append) |
| `tests/test_api_questions_facets.py` | `frontend/src/types/contracts.ts` |
| `frontend/src/hooks/useApiPost.ts` | `frontend/src/apps/Munshi/index.tsx` |
| `frontend/src/lib/capture/munshi.ts` (+`.test.ts`) | `frontend/src/apps/Mycontentdev/index.tsx` |
| `frontend/src/lib/capture/seed.ts` (+`.test.ts`) | `frontend/src/apps/Sims/index.tsx` |
| `frontend/src/lib/sims/deployed.ts` (+`.test.ts`) | `frontend/src/apps/Questions/index.tsx` |

---

## Slice 0 — Bootstrap (branch + shared substrate)

### Task 0.1: Branch + land the spec
- [ ] **Step 1:** Create branch off `main`.
```bash
git checkout main && git pull --ff-only && git checkout -b feature/control-plane-capture
```
- [ ] **Step 2:** Commit the already-written spec.
```bash
git add docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md docs/superpowers/plans/2026-06-21-samagra-control-plane-capture.md
git commit -m "docs(capture): spec + plan for control-plane capture & read-only surfaces

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 0.2: Add shared TS contracts
**Files:** Modify `frontend/src/types/contracts.ts`
- [ ] **Step 1:** Append the TypeScript block from *Shared Contracts* above to `contracts.ts`.
- [ ] **Step 2:** Verify it compiles.
Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (no errors).
- [ ] **Step 3:** Commit.
```bash
git add frontend/src/types/contracts.ts
git commit -m "feat(contracts): capture/sims/facets types"
```

### Task 0.3: `useApiPost` hook
**Files:** Create `frontend/src/hooks/useApiPost.ts`, Test `frontend/src/hooks/useApiPost.test.ts`
- [ ] **Step 1: Write failing test.**
```ts
import { renderHook, act } from "@testing-library/react";
import { useApiPost } from "./useApiPost";

it("POSTs JSON and returns parsed data", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "content-type": "application/json" } }),
  );
  const { result } = renderHook(() => useApiPost<{ ok: boolean }>());
  let out: unknown;
  await act(async () => { out = await result.current.post("/api/x", { a: 1 }); });
  expect(out).toEqual({ ok: true });
  expect(spy).toHaveBeenCalledWith("/api/x", expect.objectContaining({ method: "POST" }));
  expect(result.current.error).toBeNull();
});

it("surfaces a non-2xx detail as error", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ detail: "bad kind" }), { status: 400, headers: { "content-type": "application/json" } }),
  );
  const { result } = renderHook(() => useApiPost());
  await act(async () => { await result.current.post("/api/x", {}); });
  expect(result.current.error).toBe("bad kind");
});
```
- [ ] **Step 2: Run — expect FAIL** (`useApiPost` undefined).
Run: `cd frontend && npx vitest run src/hooks/useApiPost.test.ts`
- [ ] **Step 3: Implement.**
```ts
import { useState } from "react";
export interface PostState<T> { data: T | null; error: string | null; loading: boolean; }
export function useApiPost<T = unknown>() {
  const [state, setState] = useState<PostState<T>>({ data: null, error: null, loading: false });
  async function post(path: string, body: unknown): Promise<T | null> {
    setState({ data: null, error: null, loading: true });
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); if (j?.detail) msg = String(j.detail); } catch { /* keep msg */ }
        setState({ data: null, error: msg, loading: false });
        return null;
      }
      const json = (await res.json()) as T;
      setState({ data: json, error: null, loading: false });
      return json;
    } catch (e) {
      setState({ data: null, error: String(e), loading: false });
      return null;
    }
  }
  return { ...state, post };
}
```
- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/hooks/useApiPost.test.ts`
- [ ] **Step 5: Commit.** `git add frontend/src/hooks/useApiPost.* && git commit -m "feat(hooks): useApiPost write hook"`

---

## Slice 1 — Munshi capture (write)

### Task 1.1: `MunshiClient.create_item`
**Files:** Modify `samagra/clients/munshi_client.py`, Test `tests/test_clients.py`
- [ ] **Step 1: Write failing test** (append to `tests/test_clients.py`):
```python
def test_munshi_create_item_posts_json_with_cookie(monkeypatch):
    from samagra.clients import munshi_client
    fake = FakeRequests({"item_id": 99})
    monkeypatch.setattr(munshi_client, "requests", fake)
    c = munshi_client.MunshiClient(api_url="https://m.example.dev", secret="S")
    out = c.create_item("todo", {"assignee": "Ravi", "task": "call parent"})
    assert out == {"item_id": 99}
    assert fake.last["method"] == "POST"
    assert fake.last["url"] == "https://m.example.dev/api/item"
    assert fake.last["headers"]["Cookie"] == "munshi=S"
    assert fake.last["json"] == {"kind": "todo", "assignee": "Ravi", "task": "call parent"}

def test_munshi_create_item_repr_never_leaks_secret():
    from samagra.clients import munshi_client
    c = munshi_client.MunshiClient(api_url="https://m.example.dev", secret="TOPSECRET")
    assert "TOPSECRET" not in repr(c)
```
> If `FakeRequests` in `tests/test_clients.py` doesn't yet record `json=`, extend its `post` to capture `json` into `self.last` (it already records method/url/headers).
- [ ] **Step 2: Run — expect FAIL** (`create_item` missing).
Run: `.venv\Scripts\python -m pytest tests/test_clients.py -k create_item -q`
- [ ] **Step 3: Implement** (add to `MunshiClient`):
```python
    def create_item(self, kind: str, fields: dict) -> dict:
        # Owner-initiated capture. Deterministic /api/item write; same stateless
        # cookie auth as library(). kind must be todo|note|followup (the worker
        # rejects others). The secret is never logged.
        r = requests.post(
            f"{self.api_url}/api/item",
            headers={"Cookie": self._cookie(), "content-type": "application/json"},
            json={"kind": kind, **fields},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()
```
- [ ] **Step 4: Run — expect PASS.** `.venv\Scripts\python -m pytest tests/test_clients.py -q`
- [ ] **Step 5: Commit.** `git add samagra/clients/munshi_client.py tests/test_clients.py && git commit -m "feat(clients): MunshiClient.create_item capture write"`

### Task 1.2: `POST /api/munshi/capture`
**Files:** Modify `samagra/api/app.py`, Test `tests/test_api_capture.py`
- [ ] **Step 1: Write failing test** (create `tests/test_api_capture.py`):
```python
from fastapi.testclient import TestClient
from samagra.api import app as api_app

def _client(): return TestClient(api_app.app)

def test_munshi_capture_happy(monkeypatch):
    captured = {}
    class FakeClient:
        def available(self): return True
        def create_item(self, kind, fields): captured.update(kind=kind, fields=fields); return {"item_id": 7}
    monkeypatch.setattr(api_app, "MunshiClient", lambda: FakeClient())
    r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": "A", "task": "T"})
    assert r.status_code == 200 and r.json()["item"] == {"item_id": 7}
    assert captured["kind"] == "todo" and captured["fields"] == {"assignee": "A", "task": "T"}

def test_munshi_capture_bad_kind(monkeypatch):
    monkeypatch.setattr(api_app, "MunshiClient", lambda: type("F", (), {"available": lambda s: True})())
    r = _client().post("/api/munshi/capture", json={"kind": "question", "stem": "x"})
    assert r.status_code == 400

def test_munshi_capture_missing_field(monkeypatch):
    monkeypatch.setattr(api_app, "MunshiClient", lambda: type("F", (), {"available": lambda s: True})())
    r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": "A"})
    assert r.status_code == 400

def test_munshi_capture_unconfigured(monkeypatch):
    monkeypatch.setattr(api_app, "MunshiClient", lambda: type("F", (), {"available": lambda s: False})())
    r = _client().post("/api/munshi/capture", json={"kind": "todo", "assignee": "A", "task": "T"})
    assert r.status_code == 503
```
- [ ] **Step 2: Run — expect FAIL** (route 404).
Run: `.venv\Scripts\python -m pytest tests/test_api_capture.py -k munshi -q`
- [ ] **Step 3: Implement.** Add import + route to `samagra/api/app.py` (place routes before the SPA catch-all):
```python
from ..clients import MunshiClient, McdClient  # add near the other imports

_MUNSHI_REQUIRED = {
    "todo": ("assignee", "task"),
    "note": ("student", "issue"),
    "followup": ("date", "note"),
}

@app.post("/api/munshi/capture")
def api_munshi_capture(payload: dict):
    kind = (payload or {}).get("kind")
    required = _MUNSHI_REQUIRED.get(kind)
    if not required:
        raise HTTPException(400, "kind must be one of: todo, note, followup")
    fields = {k: v for k, v in payload.items() if k != "kind"}
    missing = [k for k in required if not str(fields.get(k) or "").strip()]
    if missing:
        raise HTTPException(400, f"missing required field(s): {', '.join(missing)}")
    client = MunshiClient()
    if not client.available():
        raise HTTPException(503, "munshi not configured — set MUNSHI_API_URL/MUNSHI_SECRET")
    try:
        created = client.create_item(kind, fields)
    except Exception:  # noqa: BLE001 — never surface the upstream/secret details
        raise HTTPException(502, "munshi capture failed")
    return {"ok": True, "item": created}
```
- [ ] **Step 4: Run — expect PASS.** `.venv\Scripts\python -m pytest tests/test_api_capture.py -k munshi -q`
- [ ] **Step 5: Commit.** `git add samagra/api/app.py tests/test_api_capture.py && git commit -m "feat(api): POST /api/munshi/capture (creds-gated)"`

### Task 1.3: `lib/capture/munshi.ts`
**Files:** Create `frontend/src/lib/capture/munshi.ts` + `.test.ts`
- [ ] **Step 1: Write failing test** (`munshi.test.ts`):
```ts
import { buildMunshiCapture } from "./munshi";
it("builds a todo body", () => {
  expect(buildMunshiCapture({ kind: "todo", assignee: "Ravi", task: "Call" }))
    .toEqual({ ok: true, body: { kind: "todo", assignee: "Ravi", task: "Call" } });
});
it("rejects missing required field", () => {
  const r = buildMunshiCapture({ kind: "note", student: "Amit", issue: "" });
  expect(r.ok).toBe(false);
});
it("passes optional fields through when present", () => {
  const r = buildMunshiCapture({ kind: "todo", assignee: "A", task: "T", due: "2026-07-01" });
  expect(r.ok && r.body.due).toBe("2026-07-01");
});
```
- [ ] **Step 2: Run — expect FAIL.** `cd frontend && npx vitest run src/lib/capture/munshi.test.ts`
- [ ] **Step 3: Implement** (`munshi.ts`):
```ts
import type { MunshiKind, MunshiCaptureForm } from "../../types/contracts";
const REQUIRED: Record<MunshiKind, readonly string[]> = {
  todo: ["assignee", "task"],
  note: ["student", "issue"],
  followup: ["date", "note"],
};
const OPTIONAL: Record<MunshiKind, readonly string[]> = {
  todo: ["due"], note: ["label"], followup: ["person"],
};
export type BuildResult =
  | { ok: true; body: Record<string, string> }
  | { ok: false; error: string };
export function buildMunshiCapture(form: MunshiCaptureForm): BuildResult {
  const req = REQUIRED[form.kind];
  if (!req) return { ok: false, error: "kind must be todo, note, or followup" };
  const missing = req.filter((k) => !(form[k] ?? "").trim());
  if (missing.length) return { ok: false, error: `Missing: ${missing.join(", ")}` };
  const body: Record<string, string> = { kind: form.kind };
  for (const k of req) body[k] = form[k].trim();
  for (const k of OPTIONAL[form.kind]) if ((form[k] ?? "").trim()) body[k] = form[k].trim();
  return { ok: true, body };
}
```
- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/lib/capture/munshi.test.ts`
- [ ] **Step 5: Commit.** `git add frontend/src/lib/capture/munshi.* && git commit -m "feat(lib): munshi capture builder"`

### Task 1.4: Munshi app capture composer
**Files:** Modify `frontend/src/apps/Munshi/index.tsx`, Test `frontend/src/apps/Munshi/index.test.tsx`
- [ ] **Step 1: Write failing smoke test** (`Munshi/index.test.tsx`):
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Munshi from "./index";
beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation((url) =>
    Promise.resolve(new Response(
      String(url).includes("/api/munshi/capture")
        ? JSON.stringify({ ok: true, item: { item_id: 1 } })
        : JSON.stringify({ results: [] }),
      { status: 200, headers: { "content-type": "application/json" } })));
});
it("captures a todo", async () => {
  render(<Munshi />);
  fireEvent.change(screen.getByTestId("capture-kind"), { target: { value: "todo" } });
  fireEvent.change(screen.getByLabelText("assignee"), { target: { value: "Ravi" } });
  fireEvent.change(screen.getByLabelText("task"), { target: { value: "Call parent" } });
  fireEvent.click(screen.getByTestId("capture-submit"));
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith("/api/munshi/capture", expect.objectContaining({ method: "POST" })));
});
```
- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/apps/Munshi/index.test.tsx`
- [ ] **Step 3: Implement.** Add a composer above the existing library list. Keep the existing read list intact; add `useApiPost` + per-kind fields driven by `buildMunshiCapture`; on success, re-fetch the library (bump a `reloadKey` appended to the `useApi` path, or call a refetch). Composer fields: a `kind` `<select>` (todo/note/followup) + the required+optional inputs for the selected kind (each `<input aria-label="...">`), an error line, and a `data-testid="capture-submit"` button that calls `buildMunshiCapture(form)`, and on `ok` `post("/api/munshi/capture", body)`. Mic/photo FAB is **not** built.
- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/apps/Munshi/index.test.tsx`
- [ ] **Step 5: Commit.** `git add frontend/src/apps/Munshi/* && git commit -m "feat(munshi): owner capture composer (todo/note/followup)"`

### Task 1.5: Slice-1 gate + independent Codex review
- [ ] **Step 1: Full gate.** `.venv\Scripts\python -m pytest -q` (all green) and `cd frontend && npm run verify` (lint+tsc+vitest+build green, no `.only`/`.skip`).
- [ ] **Step 2: Independent Codex review** of the Slice-1 diff (`git diff main...HEAD -- samagra/clients/munshi_client.py samagra/api/app.py frontend/src/lib/capture/munshi.ts frontend/src/hooks/useApiPost.ts frontend/src/apps/Munshi`). Prompt: adversarial review of a NEW production-write path — focus on auth/secret-leak, input validation, creds-gating, error handling, contract correctness vs `myProd/src/{index,agent,tools}.ts`. Save report to `docs/codex-reviews/14-capture-munshi.report.md`.
- [ ] **Step 3:** Triage via `superpowers:receiving-code-review`; fix confirmed findings TDD; re-run the gate; commit fixes.

---

## Slice 2 — mycontentdev seed capture (write)

### Task 2.1: `McdClient.create_seed`
**Files:** Modify `samagra/clients/mcd_client.py`, Test `tests/test_clients.py`
- [ ] **Step 1: Write failing test** (append):
```python
def test_mcd_create_seed_posts_form_with_admin(monkeypatch):
    from samagra.clients import mcd_client
    fake = FakeRequests({"id": "seed_X", "status": "captured"})
    monkeypatch.setattr(mcd_client, "requests", fake)
    c = mcd_client.McdClient(api_url="https://mcd.example.dev", admin_key="ADM")
    out = c.create_seed({"type": "rough_idea", "raw_text": "tidal locking demo"})
    assert out == {"id": "seed_X", "status": "captured"}
    assert fake.last["method"] == "POST"
    assert fake.last["url"] == "https://mcd.example.dev/api/seeds"
    assert fake.last["headers"]["x-mcd-admin"] == "ADM"
    assert fake.last["data"] == {"type": "rough_idea", "raw_text": "tidal locking demo"}  # form, not json
    assert "json" not in fake.last or fake.last["json"] is None
```
> Extend `FakeRequests.post` to also record `data=` if not already.
- [ ] **Step 2: Run — expect FAIL.** `.venv\Scripts\python -m pytest tests/test_clients.py -k create_seed -q`
- [ ] **Step 3: Implement** (add to `McdClient`):
```python
    def create_seed(self, fields: dict) -> dict:
        # Owner-initiated capture. The deployed worker parses multipart/form-data
        # (request.formData()), so send form-encoded — NOT json. The existing
        # adminKey authorizes /api/seeds (middleware accepts adminOk). Never logs keys.
        r = requests.post(
            f"{self.api_url}/api/seeds",
            headers={"x-mcd-admin": self._admin_key},
            data=fields,
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()
```
- [ ] **Step 4: Run — expect PASS.** `.venv\Scripts\python -m pytest tests/test_clients.py -q`
- [ ] **Step 5: Commit.** `git add samagra/clients/mcd_client.py tests/test_clients.py && git commit -m "feat(clients): McdClient.create_seed form-encoded admin write"`

### Task 2.2: `POST /api/mcd/seeds`
**Files:** Modify `samagra/api/app.py`, Test `tests/test_api_capture.py`
- [ ] **Step 1: Write failing test** (append):
```python
def test_mcd_seed_happy(monkeypatch):
    captured = {}
    class FakeMcd:
        def available(self): return True
        def create_seed(self, fields): captured.update(fields); return {"id": "s1", "status": "captured"}
    monkeypatch.setattr(api_app, "McdClient", lambda: FakeMcd())
    r = _client().post("/api/mcd/seeds", json={"type": "rough_idea", "raw_text": "idea"})
    assert r.status_code == 200 and r.json()["seed"]["id"] == "s1"
    assert captured == {"type": "rough_idea", "raw_text": "idea"}

def test_mcd_seed_bad_type(monkeypatch):
    monkeypatch.setattr(api_app, "McdClient", lambda: type("F", (), {"available": lambda s: True})())
    r = _client().post("/api/mcd/seeds", json={"type": "nope", "raw_text": "x"})
    assert r.status_code == 400

def test_mcd_seed_empty_text(monkeypatch):
    monkeypatch.setattr(api_app, "McdClient", lambda: type("F", (), {"available": lambda s: True})())
    r = _client().post("/api/mcd/seeds", json={"type": "rough_idea", "raw_text": "  "})
    assert r.status_code == 400

def test_mcd_seed_unconfigured(monkeypatch):
    monkeypatch.setattr(api_app, "McdClient", lambda: type("F", (), {"available": lambda s: False})())
    r = _client().post("/api/mcd/seeds", json={"type": "rough_idea", "raw_text": "x"})
    assert r.status_code == 503
```
- [ ] **Step 2: Run — expect FAIL.** `.venv\Scripts\python -m pytest tests/test_api_capture.py -k mcd -q`
- [ ] **Step 3: Implement** (add to `app.py`):
```python
_SEED_TYPES = {"concept", "question", "snippet", "simulation_idea",
               "experiment", "notebooklm_link", "rough_idea"}

@app.post("/api/mcd/seeds")
def api_mcd_create_seed(payload: dict):
    typ = (payload or {}).get("type")
    raw_text = str((payload or {}).get("raw_text") or "").strip()
    if typ not in _SEED_TYPES:
        raise HTTPException(400, "type must be one of: " + ", ".join(sorted(_SEED_TYPES)))
    if not raw_text:
        raise HTTPException(400, "raw_text is required")
    client = McdClient()
    if not client.available():
        raise HTTPException(503, "mycontentdev not configured — set mcd-cloud.json adminKey")
    fields = {"type": typ, "raw_text": raw_text}
    for opt in ("title", "source_ref"):
        v = str((payload or {}).get(opt) or "").strip()
        if v:
            fields[opt] = v
    try:
        created = client.create_seed(fields)
    except Exception:  # noqa: BLE001
        raise HTTPException(502, "mycontentdev seed create failed")
    return {"ok": True, "seed": created}
```
- [ ] **Step 4: Run — expect PASS.** `.venv\Scripts\python -m pytest tests/test_api_capture.py -q`
- [ ] **Step 5: Commit.** `git add samagra/api/app.py tests/test_api_capture.py && git commit -m "feat(api): POST /api/mcd/seeds (creds-gated)"`

### Task 2.3: `lib/capture/seed.ts`
**Files:** Create `frontend/src/lib/capture/seed.ts` + `.test.ts`
- [ ] **Step 1: Write failing test:**
```ts
import { buildSeed, SEED_TYPES } from "./seed";
it("builds a seed body", () => {
  expect(buildSeed({ type: "rough_idea", raw_text: "  tidal demo " }))
    .toEqual({ ok: true, body: { type: "rough_idea", raw_text: "tidal demo" } });
});
it("requires raw_text", () => { expect(buildSeed({ type: "concept", raw_text: " " }).ok).toBe(false); });
it("exposes the 7 seed types", () => { expect(SEED_TYPES).toHaveLength(7); });
```
- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/lib/capture/seed.test.ts`
- [ ] **Step 3: Implement:**
```ts
import type { SeedType, SeedForm } from "../../types/contracts";
export const SEED_TYPES: readonly SeedType[] = [
  "concept", "question", "snippet", "simulation_idea",
  "experiment", "notebooklm_link", "rough_idea",
];
export type SeedResult =
  | { ok: true; body: Record<string, string> }
  | { ok: false; error: string };
export function buildSeed(form: SeedForm): SeedResult {
  if (!SEED_TYPES.includes(form.type)) return { ok: false, error: "pick a seed type" };
  const raw = (form.raw_text ?? "").trim();
  if (!raw) return { ok: false, error: "raw_text is required" };
  const body: Record<string, string> = { type: form.type, raw_text: raw };
  if ((form.title ?? "").trim()) body.title = form.title!.trim();
  if ((form.source_ref ?? "").trim()) body.source_ref = form.source_ref!.trim();
  return { ok: true, body };
}
```
- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/lib/capture/seed.test.ts`
- [ ] **Step 5: Commit.** `git add frontend/src/lib/capture/seed.* && git commit -m "feat(lib): mcd seed builder"`

### Task 2.4: Mycontentdev app seed composer
**Files:** Modify `frontend/src/apps/Mycontentdev/index.tsx` + test
- [ ] **Step 1: Write failing smoke test** (mirror Task 1.4's, but `type`/`raw_text` fields, POST to `/api/mcd/seeds`).
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** Add a "New seed" composer above the existing read list: `type` `<select>` (SEED_TYPES) + `title` `<input>` + `raw_text` `<textarea>` + `data-testid="seed-submit"`; calls `buildSeed` → `post("/api/mcd/seeds", body)` → refetch on success; error line.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit.** `git commit -m "feat(mcd): owner seed-capture composer"`

### Task 2.5: Slice-2 gate + independent Codex review
- [ ] **Step 1:** Full gate (`pytest -q` + `npm run verify`).
- [ ] **Step 2:** Independent Codex review of the Slice-2 diff; focus on form-vs-json correctness, adminKey usage, validation, secret safety, contract vs `mycontentdev/functions/api/seeds/index.js`. Save `docs/codex-reviews/15-capture-mcd.report.md`.
- [ ] **Step 3:** Triage + fix TDD + re-gate.

---

## Slice 3 — Sims (deployed-only)

### Task 3.1: `samagra/sims_manifest.py`
**Files:** Create `samagra/sims_manifest.py`, Test `tests/test_sims_manifest.py`
- [ ] **Step 1: Write failing test:**
```python
from samagra import sims_manifest as sm
SAMPLE = """_482 deployed sims_
## Class 9  (57)
### Biology (15)
- 0466 — Osmosis & Plasmolysis Lab
- 0470 — Xylem & Phloem Transport
### Chemistry (11)
- 0127 — States of Matter Explorer
## Class 11  (3)
### Physics (3)
- 0020 — Vector Algebra Lab · KSS 180
"""
def test_parse_groups_and_urls():
    rows = sm.parse_deployed_sims(SAMPLE)
    assert len(rows) == 4
    bio = [r for r in rows if r["subject"] == "Biology"]
    assert {r["id"] for r in bio} == {"0466", "0470"}
    assert all(r["grade"] == "Class 9" for r in bio)
    phys = [r for r in rows if r["subject"] == "Physics"][0]
    assert phys["grade"] == "Class 11" and phys["title"].startswith("Vector Algebra")
def test_sim_url_pads():
    assert sm.sim_url("18") == "https://pratyakshsims.com/sims/SIM0018/SIM0018_sim.html"
    assert sm.sim_url("0466") == "https://pratyakshsims.com/sims/SIM0466/SIM0466_sim.html"
```
- [ ] **Step 2: Run — expect FAIL.** `.venv\Scripts\python -m pytest tests/test_sims_manifest.py -q`
- [ ] **Step 3: Implement:**
```python
"""Parse the Pratyaksh deployed-sims manifest (read-only). No network, no DB."""
from __future__ import annotations
import re

SITE = "https://pratyakshsims.com"
_GRADE = re.compile(r"^##\s+(?!#)(.*?)\s*(?:\(\d+\))?\s*$")
_SUBJECT = re.compile(r"^###\s+(.*?)\s*(?:\(\d+\))?\s*$")
_ITEM = re.compile(r"^-\s*(\d{3,4})\s*[—-]\s*(.+?)\s*$")


def sim_url(sim_id: str) -> str:
    n = str(sim_id).strip().zfill(4)
    return f"{SITE}/sims/SIM{n}/SIM{n}_sim.html"


def parse_deployed_sims(text: str) -> list[dict]:
    grade = subject = None
    out: list[dict] = []
    for line in text.splitlines():
        ms = _SUBJECT.match(line)
        if ms:
            subject = ms.group(1).strip()
            continue
        mg = _GRADE.match(line)
        if mg:
            grade = mg.group(1).strip()
            continue
        mi = _ITEM.match(line)
        if mi:
            sid = mi.group(1).strip()
            out.append({"id": sid, "title": mi.group(2).strip(),
                        "subject": subject, "grade": grade, "url": sim_url(sid)})
    return out
```
> Note `_SUBJECT` is tested before `_GRADE` so `###` never matches the grade rule; `_GRADE`'s `(?!#)` also guards it.
- [ ] **Step 4: Run — expect PASS.** `.venv\Scripts\python -m pytest tests/test_sims_manifest.py -q`
- [ ] **Step 5: Commit.** `git add samagra/sims_manifest.py tests/test_sims_manifest.py && git commit -m "feat(sims): deployed-manifest parser"`

### Task 3.2: `GET /api/sims`
**Files:** Modify `samagra/api/app.py`, Test `tests/test_api_sims.py`
- [ ] **Step 1: Write failing test:**
```python
from fastapi.testclient import TestClient
from samagra.api import app as api_app
from samagra import config

def test_api_sims_reads_manifest(tmp_path, monkeypatch):
    (tmp_path / "deployed-sims-by-grade.md").write_text(
        "## Class 9 (1)\n### Physics (1)\n- 0020 — Vector Lab\n", encoding="utf-8")
    monkeypatch.setattr(config, "SIMS_ROOT", tmp_path)
    r = TestClient(api_app.app).get("/api/sims")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["sims"][0]["url"].endswith("/sims/SIM0020/SIM0020_sim.html")

def test_api_sims_absent_manifest(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "SIMS_ROOT", tmp_path)  # no manifest file
    r = TestClient(api_app.app).get("/api/sims")
    assert r.status_code == 200 and r.json() == {"sims": [], "total": 0}
```
- [ ] **Step 2: Run — expect FAIL.** `.venv\Scripts\python -m pytest tests/test_api_sims.py -q`
- [ ] **Step 3: Implement** (add to `app.py`, import `sims_manifest`):
```python
from .. import sims_manifest  # add near imports

@app.get("/api/sims")
def api_sims():
    p = config.SIMS_ROOT / "deployed-sims-by-grade.md"
    if not p.exists():
        return {"sims": [], "total": 0}
    sims = sims_manifest.parse_deployed_sims(p.read_text(encoding="utf-8"))
    return {"sims": sims, "total": len(sims)}
```
- [ ] **Step 4: Run — expect PASS.** `.venv\Scripts\python -m pytest tests/test_api_sims.py -q`
- [ ] **Step 5: Commit.** `git add samagra/api/app.py tests/test_api_sims.py && git commit -m "feat(api): GET /api/sims (deployed manifest)"`

### Task 3.3: `lib/sims/deployed.ts`
**Files:** Create `frontend/src/lib/sims/deployed.ts` + `.test.ts`
- [ ] **Step 1: Write failing test:**
```ts
import { filterSims, groupByGrade } from "./deployed";
const rows = [
  { id: "0020", title: "Vector Lab", subject: "Physics", grade: "Class 11", url: "u1" },
  { id: "0466", title: "Osmosis Lab", subject: "Biology", grade: "Class 9", url: "u2" },
];
it("filters by title/subject/id", () => {
  expect(filterSims(rows, "osmo").map(r => r.id)).toEqual(["0466"]);
  expect(filterSims(rows, "physics").map(r => r.id)).toEqual(["0020"]);
  expect(filterSims(rows, "").length).toBe(2);
});
it("groups by grade", () => {
  const g = groupByGrade(rows);
  expect(g.map(x => x.grade).sort()).toEqual(["Class 11", "Class 9"]);
});
```
- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/lib/sims/deployed.test.ts`
- [ ] **Step 3: Implement:**
```ts
import type { SimRow } from "../../types/contracts";
export function filterSims(rows: SimRow[], q: string): SimRow[] {
  const t = q.trim().toLowerCase();
  if (!t) return rows;
  return rows.filter((r) =>
    r.title.toLowerCase().includes(t) ||
    (r.subject ?? "").toLowerCase().includes(t) ||
    r.id.includes(t));
}
export function groupByGrade(rows: SimRow[]): { grade: string; rows: SimRow[] }[] {
  const map = new Map<string, SimRow[]>();
  for (const r of rows) {
    const g = r.grade ?? "Other";
    const list = map.get(g) ?? [];
    list.push(r);
    map.set(g, list);
  }
  return [...map.entries()].map(([grade, rs]) => ({ grade, rows: rs }));
}
```
- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/lib/sims/deployed.test.ts`
- [ ] **Step 5: Commit.** `git add frontend/src/lib/sims/deployed.* && git commit -m "feat(lib): deployed-sims filter/group"`

### Task 3.4: Sims app rewire
**Files:** Modify `frontend/src/apps/Sims/index.tsx` + test
- [ ] **Step 1: Write failing test:** render with a mocked `/api/sims` → `{sims:[{...}],total:1}`; assert a `catalog-row` with an `<a href>` pointing at `pratyakshsims.com`; assert NO `/api/search?source=sims` fetch and no `SIM0xxx` subject chips.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement.** Replace the `/api/search?source=sims` wiring with `useApi<SimsResponse>("/api/sims")`; render `groupByGrade(filterSims(rows, query))`; a search `<input>`; each row shows title + subject + an `open` link to `r.url` (target=_blank). Remove `catalogRows`/`subjectsOf`/SIM0xxx chips.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit.** `git commit -m "feat(sims): browse only the 482 deployed sims with live links"`

### Task 3.5: Slice-3 gate + independent Codex review
- [ ] **Step 1:** Full gate.
- [ ] **Step 2:** Codex review of the Slice-3 diff (parser robustness, URL correctness, empty-state). Save `docs/codex-reviews/16-sims-deployed.report.md`.
- [ ] **Step 3:** Triage + fix + re-gate.

---

## Slice 4 — QX facets fix (read-only)

### Task 4.1: `GET /api/questions/facets`
**Files:** Modify `samagra/api/app.py`, Test `tests/test_api_questions_facets.py`
- [ ] **Step 1: Write failing test:**
```python
from fastapi.testclient import TestClient
from samagra.api import app as api_app

def test_questions_facets_uses_qx_summary(monkeypatch):
    class FakeQx:
        def available(self): return True
        def summary(self): return {"subjects": {"Mechanics": 40, "Optics": 12}}
    monkeypatch.setattr(api_app, "get_adapter", lambda name: FakeQx() if name == "qx" else None)
    r = TestClient(api_app.app).get("/api/questions/facets")
    assert r.status_code == 200
    assert sorted(r.json()["subjects"]) == ["Mechanics", "Optics"]
    assert not any(s.startswith("SIM") for s in r.json()["subjects"])

def test_questions_facets_absent_qx(monkeypatch):
    monkeypatch.setattr(api_app, "get_adapter", lambda name: None)
    r = TestClient(api_app.app).get("/api/questions/facets")
    assert r.status_code == 200 and r.json() == {"subjects": []}
```
- [ ] **Step 2: Run — expect FAIL.** `.venv\Scripts\python -m pytest tests/test_api_questions_facets.py -q`
- [ ] **Step 3: Implement** (add to `app.py`):
```python
@app.get("/api/questions/facets")
def api_questions_facets():
    qx = get_adapter("qx")
    if not qx or not qx.available():
        return {"subjects": []}
    subjects = (qx.summary() or {}).get("subjects") or {}
    return {"subjects": list(subjects.keys())}
```
- [ ] **Step 4: Run — expect PASS.** `.venv\Scripts\python -m pytest tests/test_api_questions_facets.py -q`
- [ ] **Step 5: Commit.** `git add samagra/api/app.py tests/test_api_questions_facets.py && git commit -m "fix(api): question-scoped GET /api/questions/facets"`

### Task 4.2: Questions app reads the new facets path
**Files:** Modify `frontend/src/apps/Questions/index.tsx` + its test
- [ ] **Step 1: Write/adjust failing test:** mock `/api/questions/facets` → `{subjects:["Mechanics"]}` and `/api/facets` → `{subjects:["SIM0018"]}`; assert the rendered chips show `Mechanics` and NOT `SIM0018`; assert the app fetches `/api/questions/facets` (not `/api/facets`).
- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/apps/Questions/index.test.tsx`
- [ ] **Step 3: Implement.** Change `useApi<Facets>("/api/facets")` → `useApi<QuestionFacets>("/api/questions/facets")`; keep the rest (chip rendering, subject-filter wiring) unchanged.
- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit.** `git commit -m "fix(questions): source subject chips from question-scoped facets"`

### Task 4.3: Slice-4 gate + independent Codex review
- [ ] **Step 1:** Full gate.
- [ ] **Step 2:** Codex review of the Slice-4 diff (facets correctness, empty state, that the fix actually removes SIM ids). Save `docs/codex-reviews/17-qx-facets.report.md`.
- [ ] **Step 3:** Triage + fix + re-gate.

---

## Slice 5 — Decision record + pointer-file sync

### Task 5.1: Record the DEC-3 amendment + sync trackers
**Files:** Modify `HANDOFF.md`, `STATUS.html`, `SUMMARY.html`, `docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md` (§3 non-goals note), `docs/superpowers/plans/2026-06-19-samagra-evolution.md` (Phase-3 note), `CLAUDE.md` (project block, outside the scribe auto-block), and the memory files under `…/memory/`.
- [ ] **Step 1:** In each doc, record: **DEC-3 amended (2026-06-21, Chairman)** — *owner-initiated capture (munshi item + mcd seed) is in-scope; publish gate stays never-automated; no munshi→mcd bridge; invariant is now "read-only except owner-initiated capture."* Update the read-only-invariant wording wherever it appears verbatim (HANDOFF coherence section; STATUS "read-only safety invariant"; SUMMARY).
- [ ] **Step 2:** Update `STATUS.html` per the global status-page convention (new "Capture" row/section; test counts after the build; recent-decisions log entry). Update `SUMMARY.html` plain-language one-pager.
- [ ] **Step 3:** Update project memory: edit `…/memory/samagra-os-experience.md` + add/refresh a `capture-control-plane.md` memory and its `MEMORY.md` index line.
- [ ] **Step 4:** Commit. `git add -A && git commit -m "docs(capture): record DEC-3 amendment + sync trackers"`

---

## Slice 6 — Live end-to-end verification

> Run by the main session (needs `.env` creds + a browser preview). Not part of the unit suite.

### Task 6.1: Build + serve
- [ ] **Step 1:** `cd frontend && npm run build` (emits `dist/`).
- [ ] **Step 2:** Start the API: `.venv\Scripts\python -m uvicorn samagra.api.app:app --port 8799` (no `--reload`). Use the preview tools to load `http://127.0.0.1:8799`.

### Task 6.2: Live Munshi capture round-trip
- [ ] **Step 1:** Open Munshi; capture a benign `todo` (`assignee="self"`, `task="SAMAGRA capture smoke <ts>"`).
- [ ] **Step 2:** Confirm 2xx; the library list refetch shows the new item (and/or re-probe `library()` server-side). Screenshot proof.

### Task 6.3: Live mcd seed create
- [ ] **Step 1:** Open mycontentdev; create a benign seed (`type="rough_idea"`, `raw_text="SAMAGRA seed smoke <ts>"`).
- [ ] **Step 2:** Confirm 201; the read list shows it (status `captured`). Screenshot proof. (Owner can archive it after.)

### Task 6.4: Read surfaces + final review
- [ ] **Step 1:** Sims app shows the 482 deployed sims; click one → `pratyakshsims.com` resolves (HTTP 200). Screenshot.
- [ ] **Step 2:** Questions app subject chips are real subjects (no `SIM0xxx`); selecting one returns rows. Screenshot.
- [ ] **Step 3:** Final integrated Codex review across the whole branch diff (`git diff main...HEAD`). Save `docs/codex-reviews/18-capture-final.report.md`; triage + fix.
- [ ] **Step 4:** `superpowers:finishing-a-development-branch` → present merge/PR options per the usual flow; record the plan with `/record-plan`.

---

## Self-review (done at authoring)

- **Spec coverage:** §0 amendment → Slice 5; §1 outcomes 1-4 → Slices 1-4; §4 write seam → Tasks 1.1-1.2, 2.1-2.2 + `useApiPost`; §4.2 linchpin → `lib/capture/*`, `lib/sims/deployed.ts`, `sims_manifest.py`; §5 contracts → Tasks (verified); §6 safety → creds-gating + validation in 1.2/2.2; §7 testing → RED/GREEN per task + 1.5/2.5/3.5/4.3 gates; §8 review model → per-slice Codex tasks; §9 creds → all present (no MCD_APP_KEY); §11 acceptance → Slice 6. No gaps.
- **Placeholder scan:** all code/test steps contain real code + exact commands; the two app-composer UIs (1.4 step 3, 2.4 step 3) describe exact testids/fields/handlers (tests pin the behavior). No TBD/TODO.
- **Type consistency:** `create_item(kind, fields)`, `create_seed(fields)`, `parse_deployed_sims`/`sim_url`, `buildMunshiCapture`/`buildSeed`/`filterSims`/`groupByGrade`, `useApiPost().post`, `SimRow`/`SimsResponse`/`QuestionFacets` used identically across tasks and the Shared Contracts block.
