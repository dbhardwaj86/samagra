# SAMAGRA OS — Phase E2 (Data/Control Apps) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
> Every task heading carries `[owner: deepak|khanak] [verify: headless|visual] [blockedBy: <task-ids>]`.
> `headless` = fully gated by vitest/tsc/eslint/vite-build/pytest (loop-completable). `visual` = also needs a
> human pixel/interaction QA pass (NOT in any loop; see §Testing).

**Goal:** Wire the eleven SAMAGRA OS data/control apps (Org Chart, Pipelines, Assignments, Activity, Questions,
Lectures, Booklets, INSP, Simulations, mycontentdev, Munshi) as **thin, read-only React wrappers** over the
existing FastAPI `/api/*` contract, adding exactly one backend endpoint (`GET /api/org`, static `samagra/org.py`)
and zero new write paths.

**Architecture:** All real logic lands in **pure, headlessly-testable TypeScript modules** (`lib/api`,
`lib/catalog`, `lib/pipelines`, `lib/org`, `lib/kanban`, `lib/activity`, `lib/questions`) authored + tested once
by **deepak** (the linchpin, mirroring E1); the response **types** are added to `types/contracts.ts`; the eleven
app components are thin wrappers that `useApi<T>(path)`, normalize via the pure modules, and render defensively
(error inline, `aria-busy` loading, graceful empty). Apps are registered by **file creation only** — `registry.ts`
and `App.tsx` are frozen and already resolve all 17 slots via a generic dynamic import. The build runs as a
**single-tree DAG** on branch `e2/samagra-os` (continuous publication to that branch on each green task), honoring
the file-disjoint deepak/khanak ownership as task labels.

**Tech Stack:** React 18 + TypeScript + Vite (existing `frontend/`); Zustand theme store (read via CSS vars);
Vitest + React Testing Library + jsdom; ESLint + `@typescript-eslint`; Python 3.11 (`.venv`) + FastAPI
(`samagra/org.py` + one route). Advisory Codex pre-commit gate active (`core.hooksPath=.githooks`) — **never
`--no-verify`, never self-break-glass.**

**Source of truth:** [`docs/superpowers/_research/samagra-os/e2-grounding.md`](../_research/samagra-os/e2-grounding.md)
— the live-verified contract (supersedes the stale `api.md`). Read it before any task. Parent plan +
division: [`2026-06-20-samagra-os.md`](2026-06-20-samagra-os.md) (§Phase E2 skeleton),
[`2026-06-20-samagra-os-division.md`](2026-06-20-samagra-os-division.md) (§E2 forward-assignment owners).

---

## Shared Contracts — single source of truth for E2

**Repo & branch:** repo root `C:\SandBox\claude_box\TeachingOS` (`main` @ `e1ea95e`, in sync with `origin/main`).
E2 builds on branch **`e2/samagra-os`** cut from `main`. Each greened task is committed to that branch; the phase
merges to `main` at the E2.20 gate. The advisory Codex hook runs on every commit; it blocks only a two-pass
confirmed-CRITICAL and never wedges.

**Owners (authoritative, from the division doc §E2):**
- **deepak** — `samagra/org.py` + `/api/org` (E2.1); the frontend contract types + all pure `lib/**` E2 modules
  (E2.2–E2.8); apps **Org, Pipelines, Lectures, mycontentdev, Munshi** (E2.9–E2.13); the E2 gate (E2.20).
- **khanak** — apps **Assignments, Activity, Questions, Booklets, INSP, Simulations** (E2.14–E2.19), each a thin
  wrapper over a deepak `lib/**` module.

**File-disjointness.** deepak creates every `samagra/org.py`, `tests/test_api_org.py`, `frontend/src/types/contracts.ts`
(append types), `frontend/src/lib/{api,catalog,pipelines,org,kanban,activity,questions}/*`, and
`frontend/src/apps/{Org,Pipelines,Lectures,Mycontentdev,Munshi}/index.tsx`. khanak creates only
`frontend/src/apps/{Assignments,Activity,Questions,Booklets,Insp,Sims}/index.tsx`. **The single shared file is
`types/contracts.ts`** — deepak appends ALL E2 types in E2.2 and it is then **frozen for E2** (no second writer;
khanak only imports). `registry.ts` and `App.tsx` are **not touched** (frozen since E1).

**Continuous-publication gating (why deepak's lib lands first).** Every khanak app imports a deepak pure module:
Assignments←`lib/kanban`, Activity←`lib/activity`, Questions←`lib/questions`, Booklets/INSP/Sims←`lib/catalog`.
So deepak front-loads E2.2–E2.8 (types + all lib) before his own apps; once those are on `e2/samagra-os`, all six
khanak apps unblock at once. (Single-tree DAG execution makes "publish + rebase" automatic — the engines are
already in the tree when the app task runs.)

**The `useApi` contract (verbatim, do not deviate):**
```ts
export function useApi<T = unknown>(path: string): { data: T | null; error: string | null; loading: boolean }
```
Raw `fetch(path)`, GET-once-on-mount, abort-guarded. Non-2xx → `error="HTTP <status>"`. **No refetch, no POST,
no param builder** — bake query strings into `path` (use `buildQuery`, E2.2). Every app renders **defensively,
never early-returns**: error inline (`role="alert"`), loading via `aria-busy` on the content section, empty via
defensive selectors over possibly-`null` `data`.

**App registration = file creation only.** Create `frontend/src/apps/<Dir>/index.tsx` with a default-exported
component taking **zero props**. Folder name MUST equal `APP_DIR[id]`: `org→Org`, `pipelines→Pipelines`,
`lectures→Lectures`, `mycontentdev→Mycontentdev`, `munshi→Munshi`, `assignments→Assignments`, `activity→Activity`,
`questions→Questions`, `booklets→Booklets`, `insp→Insp`, `sims→Sims`. The app reads its accent via
`import { APPS } from "../../registry"` → `APPS["<id>"].accent`. Theme reaches the body only through `--samagra-*`
CSS vars — never as a prop. **A forgotten file fails silently** (empty window), so the gate (E2.20) asserts all 11
files exist.

**The `V` CSS-var object (every app declares this near the top):**
```ts
const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", accent2: "var(--samagra-accent2)", font: "var(--samagra-font)",
} as const;
```
FD rules: drive every surface color from `--samagra-*`; accent-alpha via
`color-mix(in srgb, var(--samagra-accent) N%, transparent)`; the **root `<div>` must NOT set `color`** (jsdom
border-color assertions break) — set `color` on text nodes. `data-testid` on the root + each grid/section + each
repeated row.

**Canonical app render-smoke test (the looped headless residue of every `visual` app task):**
```tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import App_ from "./index";              // the app under test (default export)

beforeEach(() => useApiMock.mockReset());
// 1) renders rows from data  2) error renders inline AND the app still mounts
// 3) loading sets aria-busy   4) empty/null data renders the empty state without crashing
```

**npm scripts / commands (unchanged from E1).** Frontend (from `frontend/`): `npm test -- <selector>` (one),
`npm test` (all), **`npm run verify`** (lint → tsc → vitest → build — the per-task gate). Backend (from repo
root, Python 3.11 `.venv`): `.venv\Scripts\python -m pytest -q`. No live HTTP/Codex in tests — call route
functions directly, mock `useApi`.

**Commits.** Conventional Commits `type(scope): subject`. New scopes for E2: `org`, `api`, `catalog`, `pipelines`,
`kanban`, `activity`, `questions`, plus existing `apps`, `frontend`, `os`. Every commit ends with a blank line then
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Never amend; never `--no-verify`.

**Safety.** Every backend touch is read-only. The only new endpoint is `GET /api/org` (static dict). mcd/munshi
apps render an **empty-or-unavailable** state — `/api/search` simply omits an absent source, so the empty state is
gated purely on `rows.length` (there is no `available` field on a search row). Munshi capture/write is OUT of scope.
Pixel fidelity is a separate human QA pass, never a loop completion signal.

**Optional endpoints — SKIPPED (grounding §3, YAGNI):** `/api/dashboard`, `/api/lectures`, `/api/integrations`,
`/api/activity` are deliberately NOT built. Dashboard reuses `/api/overview`; Lectures reuses `/api/search`;
Activity reuses `/api/assignments.events`; integrations are covered by `/api/org`. E2 adds exactly one endpoint.

---

## Testing strategy

- **Headless (looped, the done-signal):** every pure `lib/**` module is red-green TDD with exact-constant Vitest
  assertions; `org.py` is pytest TDD; each app carries an RTL render-smoke (4 cases above) that IS its loop gate.
- **Visual (quarantined, human/owner pass — NOT a loop gate):** pixel/interaction parity of the 11 apps (tree
  layout, kanban density, catalog list spacing, facet chrome) is signed off by the owner with `npm run dev` against
  the prototype + `screenshots/`, once per surface, after E2.20. A loop NEVER claims "looks right" — only "logic
  green, build green."

---

## Phase E2 — task list (DAG order)

```
E2.1 org.py+/api/org (py) ─┐
E2.2 types + lib/api/query ─┼─ E2.3 lib/catalog/rows ──┬─ E2.11 Lectures · E2.12 mcd · E2.13 Munshi   (deepak apps)
                           │                            └─ E2.17 Booklets · E2.18 Insp · E2.19 Sims    (khanak apps)
                           ├─ E2.4 lib/pipelines/stages ── E2.10 Pipelines
                           ├─ E2.5 lib/org/resolve ─────── E2.9 Org   (+ E2.1 /api/org)
                           ├─ E2.6 lib/kanban/columns ──── E2.14 Assignments
                           ├─ E2.7 lib/activity/format ─── E2.15 Activity
                           └─ E2.8 lib/questions/facets ── E2.16 Questions
   (all apps green) ─► E2.20 E2 GREEN GATE + pointer-file sync
```
Legend: `headless` (loop-completable) = E2.1–E2.8, E2.20 + the render-smoke sub-tests inside E2.9–E2.19.
`visual` (human QA, quarantined) = the pixel/interaction parity of E2.9–E2.19.

---

### Task E2.1: Backend — `samagra/org.py` + `GET /api/org` + pytest [owner: deepak] [verify: headless] [blockedBy: none]

**Files:**
- Create: `samagra/org.py`
- Modify: `samagra/api/app.py` (add one route, above the `spa` catch-all)
- Test: `tests/test_api_org.py`

The single hard backend gap (grounding §3). A static org chart — no DB, no I/O. The `owners` token→identity map
covers all 7 `state.PIPELINES[*].owners` ids so the Pipelines/Org apps can resolve a phase-owner token to a name.
The `claude1`/`claude2` → identity mapping is **owner-confirmed (2026-06-21): `claude1` = Claude-Deepak (CEO —
substrate & engine), `claude2` = Claude-Khanak (CTO — leaf apps & UX)** — asserted in the test below.

- [ ] **Step 1: Write the failing test.** Create `tests/test_api_org.py`:
```python
"""E2.1: GET /api/org returns the static org chart (no DB, read-only)."""
from __future__ import annotations

from samagra import org
from samagra.api import app as api


def test_org_dict_shape():
    o = org.ORG
    assert o["chairman"]["name"] == "Deepak Bhardwaj"
    assert o["chairman"]["role"] == "Founder & Chairman"
    # board hierarchy from the source-verified roster
    assert [b["id"] for b in o["board"]] == ["claude-deepak", "claude-khanak", "codex"]
    # owners map covers ALL 7 distinct state.PIPELINES owner ids
    assert set(o["owners"]) == {
        "claude1", "claude2", "codex", "gemini", "human", "notebooklm", "teachingos"
    }
    # every owner entry has a name + role
    assert all({"name", "role"} <= set(v) for v in o["owners"].values())
    # owner-confirmed identity mapping (claude1 = CEO Deepak, claude2 = CTO Khanak)
    assert o["owners"]["claude1"]["name"] == "Claude-Deepak"
    assert o["owners"]["claude2"]["name"] == "Claude-Khanak"


def test_org_owner_ids_align_to_pipeline_owners():
    """The owners map must cover every owner string used across the live pipelines."""
    from samagra import state
    used = {ow for p in state.PIPELINES.values() for ow in p["owners"].values()}
    assert used <= set(org.ORG["owners"])


def test_api_org_route_returns_org():
    assert api.api_org() is org.ORG


def test_api_org_route_registered():
    assert "/api/org" in {r.path for r in api.app.routes}
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `.venv\Scripts\python -m pytest tests/test_api_org.py -q` (from repo root)
Expected: `ModuleNotFoundError: No module named 'samagra.org'` (red).

- [ ] **Step 3: Create `samagra/org.py`.**
```python
"""Static SAMAGRA org chart (E2.1). No DB, no I/O — a human-authored registry.

`owners` maps every machine owner-token used in state.PIPELINES[*].owners to a
display identity, so the Org/Pipelines GUI apps can resolve a phase owner to a
person + role. The board hierarchy is the source-verified frontend roster
(terminal `agents`/`whoami`). Owner-confirmed (2026-06-21): claude1 = Claude-Deepak
(CEO), claude2 = Claude-Khanak (CTO).
"""
from __future__ import annotations

ORG: dict = {
    "chairman": {"id": "deepak", "name": "Deepak Bhardwaj", "role": "Founder & Chairman"},
    "board": [
        {"id": "claude-deepak", "name": "Claude-Deepak", "role": "CEO — substrate & engine"},
        {"id": "claude-khanak", "name": "Claude-Khanak", "role": "CTO — leaf apps & UX"},
        {"id": "codex", "name": "Codex", "role": "Reviewer — pre-merge gate"},
    ],
    "workers": [
        {"id": "gemini", "name": "Gemini", "role": "Research & synthesis"},
        {"id": "notebooklm", "name": "NotebookLM", "role": "Research & synthesis"},
        {"id": "grok", "name": "Grok", "role": "Real-time search"},
        {"id": "hermes", "name": "Hermes", "role": "Kanban / scheduling"},
    ],
    # token -> identity; covers all 7 distinct state.PIPELINES owner ids.
    "owners": {
        "codex": {"name": "Codex", "role": "Reviewer — pre-merge gate"},
        "claude1": {"name": "Claude-Deepak", "role": "CEO — substrate & engine"},
        "claude2": {"name": "Claude-Khanak", "role": "CTO — leaf apps & UX"},
        "gemini": {"name": "Gemini", "role": "Research & synthesis"},
        "notebooklm": {"name": "NotebookLM", "role": "Research & synthesis"},
        "teachingos": {"name": "TeachingOS", "role": "Build / export automation"},
        "human": {"name": "Human", "role": "Manual gate / approval"},
    },
}
```

- [ ] **Step 4: Add the route to `samagra/api/app.py`.** Put the import near the other `from ..` imports, and the
  route **above** the `@app.get("/{full_path:path}")` SPA catch-all (grep for `full_path` to find it):
```python
from ..org import ORG  # E2.1 static org chart

@app.get("/api/org")
def api_org():
    return ORG
```

- [ ] **Step 5: Run — expect PASS.**
Run: `.venv\Scripts\python -m pytest tests/test_api_org.py -q`
Expected: 4 passed.

- [ ] **Step 6: Full backend gate + commit.**
Run: `.venv\Scripts\python -m pytest -q` (expect the prior 102 + 4 = 106 green)
```bash
git add samagra/org.py samagra/api/app.py tests/test_api_org.py
git commit -m "feat(org): static org chart + GET /api/org (read-only, no DB)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.2: Frontend contract types + `lib/api/query` helper [owner: deepak] [verify: headless] [blockedBy: E2.1]

**Files:**
- Modify: `frontend/src/types/contracts.ts` (append the E2 response types — then FROZEN for E2)
- Create: `frontend/src/lib/api/query.ts`
- Test: `frontend/src/lib/api/query.test.ts`

The blocking prefix every E2 app imports: the typed response shapes (grounding §5) + a tiny pure `buildQuery`
helper (because `useApi` has no param builder — params must be baked into the `path`). Types are typecheck-gated;
`buildQuery` gets a real Vitest.

- [ ] **Step 1: Write the failing test.** Create `frontend/src/lib/api/query.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildQuery } from "./query";

describe("buildQuery", () => {
  it("empty / all-undefined → empty string", () => {
    expect(buildQuery({})).toBe("");
    expect(buildQuery({ source: undefined, limit: undefined })).toBe("");
  });
  it("drops undefined and empty-string params, keeps 0", () => {
    expect(buildQuery({ q: "", source: "textbook", limit: 200 })).toBe("?source=textbook&limit=200");
    expect(buildQuery({ limit: 0 })).toBe("?limit=0");
  });
  it("URL-encodes keys and values", () => {
    expect(buildQuery({ q: "a b&c" })).toBe("?q=a%20b%26c");
  });
  it("preserves the given key order", () => {
    expect(buildQuery({ source: "insp", kind: "exam", limit: 500 })).toBe("?source=insp&kind=exam&limit=500");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- query`
Expected: `Cannot find module './query'` (red).

- [ ] **Step 3: Implement `frontend/src/lib/api/query.ts`.**
```ts
/** Build a query string for useApi(path). Drops undefined and empty-string values
 *  (but keeps 0). Encodes keys + values. Returns "" or "?k=v&k2=v2". */
export function buildQuery(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (typeof v === "string" && v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}
```

- [ ] **Step 4: Append the E2 response types to `frontend/src/types/contracts.ts`.** Add this block verbatim at
  the end of the file. Do **not** modify the existing `ApiClient` interface (it is dead code; leave it). After this
  commit, `contracts.ts` is **frozen for E2**.
```ts
// ── Catalog / search (GET /api/search, /api/facets) ──────────────────────────
export interface SearchResult {
  uid: string; source: string; kind: string; title: string;
  subject: string | null; unit: string | null; chapter: string | null;
  status: string | null; path: string | null; url: string | null;
  updated_at: string | null;
  meta: Record<string, unknown>;     // parsed from meta_json
  meta_json?: string;                 // raw string ALSO present on the wire
}
export interface SearchResponse { results: SearchResult[]; }
export interface Facets { sources: string[]; kinds: string[]; subjects: string[]; }

// ── Questions (GET /api/questions) ───────────────────────────────────────────
export interface Question {
  q_uid: string; slug: string; q_type: string | null;
  subject: string | null; chapter: string | null;
  difficulty: string | null; text: string | null;   // value is text_projection (a snippet)
}
export interface QuestionsResponse { results: Question[]; error?: string; }  // error OPTIONAL

// ── Overview (GET /api/overview) — promote Dashboard's inline types ───────────
export interface OverviewSource {
  source: string; label: string; available: number;   // 0 | 1
  n_artifacts: number; refreshed_at: string;
  summary: Record<string, unknown>;
  summary_json?: string;             // raw string ALSO present on the wire
}
export interface Overview { sources: OverviewSource[]; refreshed_at: string | null; }

// ── Pipelines (GET /api/pipelines) ───────────────────────────────────────────
export type PipelineStatus = "pending" | "in_progress" | "awaiting_gate" | "done" | "failed" | "blocked";
export interface Phase {
  status: PipelineStatus; owner: string | null; gate: boolean;
  started: string | null; finished: string | null; artifacts: string[]; error: string | null;
}
export interface Pipeline {
  pipeline: string; label: string; created: string; updated: string;
  current: string; phases: Record<string, Phase>;     // keyed by phase NAME, not array
}
export interface PipelinesResponse { pipelines: Pipeline[]; }

// ── Assignments + events (GET /api/assignments) ──────────────────────────────
export type AssignmentStatus = "queued" | "running" | "in-review" | "approved" | "changes";  // HYPHEN
export interface Assignment {
  id: string; agent: string; outbox_path: string;
  pipeline: string | null; seed_ref: string | null; artifact_ref: string | null;
  expected_output: string | null; review_by: string | null;
  status: AssignmentStatus; created_at: string; updated_at: string;
}
export interface EventItem {
  id: number; ts: string; actor: string; verb: string;
  assignment_id: string | null; subsystem: string | null; subsystem_ref: string | null; note: string | null;
}
export interface AssignmentsResponse { assignments: Assignment[]; events: EventItem[]; }

// ── Org chart (GET /api/org — built in E2.1; shape mirrors samagra/org.py) ────
export interface OrgPerson { id: string; name: string; role: string; }
export interface OrgChart {
  chairman: OrgPerson; board: OrgPerson[]; workers: OrgPerson[];
  owners: Record<string, { name: string; role: string }>;  // token -> identity (7 owner ids)
}
```

- [ ] **Step 5: Run — expect PASS + typecheck clean.**
Run: `cd frontend && npm test -- query && npm run typecheck`
Expected: 4 query tests pass; `tsc --noEmit` clean.

- [ ] **Step 6: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/types/contracts.ts frontend/src/lib/api/query.ts frontend/src/lib/api/query.test.ts
git commit -m "feat(frontend): E2 response types (proto-verified) + buildQuery helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.3: `lib/catalog/rows` — shared catalog normalizer (TDD) [owner: deepak] [verify: headless] [blockedBy: E2.2]

**Files:**
- Create: `frontend/src/lib/catalog/rows.ts`
- Test: `frontend/src/lib/catalog/rows.test.ts`

The shared pure normalizer the six catalog-backed apps (Lectures, mcd, Munshi, Booklets, INSP, Sims) all consume.
Turns a `SearchResponse` into display rows, computes the safe `/open?path=` href (only for paths; the app must not
link arbitrary paths — grounding §7.8), and derives the distinct subject list (Sims filter). Defensive: tolerates
`null` data and a non-array `results`.

- [ ] **Step 1: Write the failing test.** Create `frontend/src/lib/catalog/rows.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { catalogRows, openHref, subjectsOf } from "./rows";
import type { SearchResponse } from "../../types/contracts";

const sample: SearchResponse = {
  results: [
    { uid: "u1", source: "textbook", kind: "chapter", title: "Vectors", subject: "Physics",
      unit: "Mechanics", chapter: "1", status: "approved", path: "C:/t/vectors.html",
      url: "/lecture/vectors", updated_at: "2026-06-01", meta: { order: 1 } },
    { uid: "u2", source: "textbook", kind: "chapter", title: "Kinematics", subject: "Maths",
      unit: "Mechanics", chapter: "2", status: null, path: null, url: null,
      updated_at: null, meta: {} },
  ],
};

describe("catalogRows", () => {
  it("maps results to display rows with a safe open href", () => {
    const rows = catalogRows(sample);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ uid: "u1", title: "Vectors", subject: "Physics", status: "approved" });
    expect(rows[0].openHref).toBe("/open?path=" + encodeURIComponent("C:/t/vectors.html"));
    expect(rows[1].openHref).toBeNull(); // no path → no open link
  });
  it("is defensive: null data and non-array results → []", () => {
    expect(catalogRows(null)).toEqual([]);
    expect(catalogRows({ results: undefined } as unknown as SearchResponse)).toEqual([]);
  });
});

describe("openHref", () => {
  it("encodes a path, returns null for null/empty", () => {
    expect(openHref("C:/a b.pdf")).toBe("/open?path=" + encodeURIComponent("C:/a b.pdf"));
    expect(openHref(null)).toBeNull();
    expect(openHref("")).toBeNull();
  });
});

describe("subjectsOf", () => {
  it("distinct, sorted, drops null/empty", () => {
    expect(subjectsOf(catalogRows(sample))).toEqual(["Maths", "Physics"]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- catalog/rows`
Expected: `Cannot find module './rows'` (red).

- [ ] **Step 3: Implement `frontend/src/lib/catalog/rows.ts`.**
```ts
import type { SearchResponse, SearchResult } from "../../types/contracts";

export interface CatalogRow {
  uid: string;
  title: string;
  subject: string | null;
  unit: string | null;
  chapter: string | null;
  status: string | null;
  kind: string;
  url: string | null;
  openHref: string | null;        // safe /open?path= link, or null
  meta: Record<string, unknown>;
}

/** Build the safe file-open href for a catalog path (null when no path). The
 *  backend /open enforces ALLOWED_ROOTS; we only link rows that carry a path. */
export function openHref(path: string | null | undefined): string | null {
  if (!path) return null;
  return "/open?path=" + encodeURIComponent(path);
}

function toRow(r: SearchResult): CatalogRow {
  return {
    uid: r.uid,
    title: r.title,
    subject: r.subject ?? null,
    unit: r.unit ?? null,
    chapter: r.chapter ?? null,
    status: r.status ?? null,
    kind: r.kind,
    url: r.url ?? null,
    openHref: openHref(r.path),
    meta: r.meta && typeof r.meta === "object" ? r.meta : {},
  };
}

export function catalogRows(data: SearchResponse | null | undefined): CatalogRow[] {
  const results = data?.results;
  return Array.isArray(results) ? results.map(toRow) : [];
}

export function subjectsOf(rows: CatalogRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.subject) set.add(r.subject);
  return Array.from(set).sort();
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- catalog/rows`
Expected: all tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/catalog
git commit -m "feat(catalog): shared catalog-row normalizer + safe open href (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.4: `lib/pipelines/stages` — phase→stage derivation (TDD) [owner: deepak] [verify: headless] [blockedBy: E2.2]

**Files:**
- Create: `frontend/src/lib/pipelines/stages.ts`
- Test: `frontend/src/lib/pipelines/stages.test.ts`

`phases` is a Record keyed by phase NAME (grounding §1/§7.10) — turn it into an **ordered** stage array (insertion
order = pipeline order), mark the `current` stage, expose the gate flag, and compute done/total progress.
Defensive over a missing/empty `phases`.

- [ ] **Step 1: Write the failing test.** Create `frontend/src/lib/pipelines/stages.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { stagesOf, pipelineProgress } from "./stages";
import type { Pipeline } from "../../types/contracts";

const p: Pipeline = {
  pipeline: "textbook", label: "Lectures (textbook)", created: "x", updated: "y", current: "approve",
  phases: {
    draft: { status: "done", owner: "codex", gate: false, started: null, finished: null, artifacts: [], error: null },
    enrich: { status: "done", owner: "codex", gate: false, started: null, finished: null, artifacts: [], error: null },
    approve: { status: "awaiting_gate", owner: "human", gate: true, started: null, finished: null, artifacts: [], error: null },
    export: { status: "pending", owner: "teachingos", gate: false, started: null, finished: null, artifacts: [], error: null },
  },
};

describe("stagesOf", () => {
  it("ordered stages, current flagged, gate carried", () => {
    const s = stagesOf(p);
    expect(s.map((x) => x.name)).toEqual(["draft", "enrich", "approve", "export"]);
    expect(s.find((x) => x.name === "approve")).toMatchObject({ isCurrent: true, gate: true, owner: "human" });
    expect(s.filter((x) => x.isCurrent)).toHaveLength(1);
  });
  it("defensive: missing phases → []", () => {
    expect(stagesOf({ ...p, phases: undefined as never })).toEqual([]);
  });
});

describe("pipelineProgress", () => {
  it("counts done / total", () => {
    expect(pipelineProgress(p)).toEqual({ done: 2, total: 4 });
    expect(pipelineProgress({ ...p, phases: {} })).toEqual({ done: 0, total: 0 });
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- pipelines/stages`
Expected: `Cannot find module './stages'` (red).

- [ ] **Step 3: Implement `frontend/src/lib/pipelines/stages.ts`.**
```ts
import type { Pipeline, PipelineStatus } from "../../types/contracts";

export interface Stage {
  name: string;
  status: PipelineStatus;
  owner: string | null;
  gate: boolean;
  isCurrent: boolean;
}

export function stagesOf(p: Pipeline): Stage[] {
  const phases = p?.phases;
  if (!phases || typeof phases !== "object") return [];
  return Object.entries(phases).map(([name, ph]) => ({
    name,
    status: ph.status,
    owner: ph.owner ?? null,
    gate: Boolean(ph.gate),
    isCurrent: name === p.current,
  }));
}

export function pipelineProgress(p: Pipeline): { done: number; total: number } {
  const stages = stagesOf(p);
  return { done: stages.filter((s) => s.status === "done").length, total: stages.length };
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- pipelines/stages`
Expected: all tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/pipelines
git commit -m "feat(pipelines): phase-record -> ordered stages + progress (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.5: `lib/org/resolve` — owner-token resolution (TDD) [owner: deepak] [verify: headless] [blockedBy: E2.2]

**Files:**
- Create: `frontend/src/lib/org/resolve.ts`
- Test: `frontend/src/lib/org/resolve.test.ts`

Resolve a pipeline owner token (e.g. `codex`, `claude2`) to a display identity via the org `owners` map; fall back
to the raw token when unknown or org is `null`. Used by the Org app and (optionally) Pipelines to humanize owners.

- [ ] **Step 1: Write the failing test.** Create `frontend/src/lib/org/resolve.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveOwner, ownerName } from "./resolve";
import type { OrgChart } from "../../types/contracts";

const org: OrgChart = {
  chairman: { id: "deepak", name: "Deepak Bhardwaj", role: "Founder & Chairman" },
  board: [], workers: [],
  owners: {
    codex: { name: "Codex", role: "Reviewer — pre-merge gate" },
    human: { name: "Human", role: "Manual gate / approval" },
  },
};

describe("resolveOwner", () => {
  it("maps a known token", () => {
    expect(resolveOwner(org, "codex")).toEqual({ name: "Codex", role: "Reviewer — pre-merge gate" });
  });
  it("falls back to the raw token (empty role) when unknown or org null", () => {
    expect(resolveOwner(org, "gemini")).toEqual({ name: "gemini", role: "" });
    expect(resolveOwner(null, "codex")).toEqual({ name: "codex", role: "" });
  });
});

describe("ownerName", () => {
  it("returns the display name or the token", () => {
    expect(ownerName(org, "human")).toBe("Human");
    expect(ownerName(org, "grok")).toBe("grok");
    expect(ownerName(null, null)).toBe("");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- org/resolve`
Expected: `Cannot find module './resolve'` (red).

- [ ] **Step 3: Implement `frontend/src/lib/org/resolve.ts`.**
```ts
import type { OrgChart } from "../../types/contracts";

export interface OwnerIdentity { name: string; role: string; }

export function resolveOwner(org: OrgChart | null | undefined, token: string): OwnerIdentity {
  const hit = org?.owners?.[token];
  return hit ? { name: hit.name, role: hit.role } : { name: token, role: "" };
}

export function ownerName(org: OrgChart | null | undefined, token: string | null | undefined): string {
  if (!token) return "";
  return resolveOwner(org, token).name;
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- org/resolve`
Expected: all tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/org
git commit -m "feat(org): owner-token -> identity resolver (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.6: `lib/kanban/columns` — assignment status buckets (TDD) [owner: deepak] [verify: headless] [blockedBy: E2.2]

**Files:**
- Create: `frontend/src/lib/kanban/columns.ts`
- Test: `frontend/src/lib/kanban/columns.test.ts`

The five kanban columns (note the **hyphenated** `in-review` and the real **`changes`** 5th status — grounding
§7.3). `groupByStatus` buckets assignments by their literal status; unknown statuses are ignored (not crashed).

- [ ] **Step 1: Write the failing test.** Create `frontend/src/lib/kanban/columns.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { KANBAN_COLUMNS, groupByStatus } from "./columns";
import type { Assignment } from "../../types/contracts";

const a = (id: string, status: Assignment["status"]): Assignment => ({
  id, agent: "codex", outbox_path: "x", pipeline: null, seed_ref: null, artifact_ref: null,
  expected_output: null, review_by: null, status, created_at: "t", updated_at: "t",
});

describe("KANBAN_COLUMNS", () => {
  it("is the 5 statuses in order, in-review hyphenated", () => {
    expect(KANBAN_COLUMNS.map((c) => c.key)).toEqual(
      ["queued", "running", "in-review", "approved", "changes"]);
  });
});

describe("groupByStatus", () => {
  it("buckets each assignment under its literal status, all 5 keys present", () => {
    const g = groupByStatus([a("1", "queued"), a("2", "in-review"), a("3", "in-review"), a("4", "changes")]);
    expect(Object.keys(g)).toEqual(["queued", "running", "in-review", "approved", "changes"]);
    expect(g["in-review"].map((x) => x.id)).toEqual(["2", "3"]);
    expect(g["running"]).toEqual([]);
  });
  it("defensive: null/non-array → all-empty buckets; unknown status ignored", () => {
    const g = groupByStatus(null as never);
    expect(g["queued"]).toEqual([]);
    const u = groupByStatus([{ ...a("9", "queued"), status: "weird" as never }]);
    expect(Object.values(u).every((arr) => arr.length === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- kanban/columns`
Expected: `Cannot find module './columns'` (red).

- [ ] **Step 3: Implement `frontend/src/lib/kanban/columns.ts`.**
```ts
import type { Assignment, AssignmentStatus } from "../../types/contracts";

export interface KanbanColumn { key: AssignmentStatus; label: string; }

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { key: "queued", label: "Queued" },
  { key: "running", label: "Running" },
  { key: "in-review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "changes", label: "Changes" },
];

export function groupByStatus(assignments: Assignment[]): Record<AssignmentStatus, Assignment[]> {
  const groups = {
    queued: [], running: [], "in-review": [], approved: [], changes: [],
  } as Record<AssignmentStatus, Assignment[]>;
  if (!Array.isArray(assignments)) return groups;
  for (const a of assignments) {
    const bucket = groups[a.status as AssignmentStatus];
    if (bucket) bucket.push(a);   // unknown status → ignored, never crashes
  }
  return groups;
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- kanban/columns`
Expected: all tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/kanban
git commit -m "feat(kanban): assignment status columns + defensive grouping (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.7: `lib/activity/format` — event-line formatting (TDD) [owner: deepak] [verify: headless] [blockedBy: E2.2]

**Files:**
- Create: `frontend/src/lib/activity/format.ts`
- Test: `frontend/src/lib/activity/format.test.ts`

Turn the `events[]` ledger (from `/api/assignments`, newest-first) into display lines. Defensive over `null` data
and the 8 sparse event columns (grounding §7.4).

- [ ] **Step 1: Write the failing test.** Create `frontend/src/lib/activity/format.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { activityLines, formatEvent } from "./format";
import type { AssignmentsResponse, EventItem } from "../../types/contracts";

const ev = (over: Partial<EventItem>): EventItem => ({
  id: 1, ts: "2026-06-20T10:00:00", actor: "codex", verb: "status:in-review",
  assignment_id: "A1", subsystem: null, subsystem_ref: null, note: null, ...over,
});

describe("formatEvent", () => {
  it("derives who/what/when/note", () => {
    const l = formatEvent(ev({ note: "looks good" }));
    expect(l).toMatchObject({ id: 1, who: "codex", what: "status:in-review", note: "looks good" });
    expect(l.when).toContain("2026-06-20");
  });
  it("tolerates null note/actor", () => {
    const l = formatEvent(ev({ actor: null as never, note: null }));
    expect(l.who).toBe("");
    expect(l.note).toBe("");
  });
});

describe("activityLines", () => {
  it("maps events defensively; null data → []", () => {
    const data: AssignmentsResponse = { assignments: [], events: [ev({ id: 2 }), ev({ id: 3 })] };
    expect(activityLines(data).map((l) => l.id)).toEqual([2, 3]);
    expect(activityLines(null)).toEqual([]);
    expect(activityLines({ events: undefined } as never)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- activity/format`
Expected: `Cannot find module './format'` (red).

- [ ] **Step 3: Implement `frontend/src/lib/activity/format.ts`.**
```ts
import type { AssignmentsResponse, EventItem } from "../../types/contracts";

export interface ActivityLine { id: number; when: string; who: string; what: string; note: string; }

export function formatEvent(e: EventItem): ActivityLine {
  return {
    id: e.id,
    when: e.ts ?? "",
    who: e.actor ?? "",
    what: e.verb ?? "",
    note: e.note ?? "",
  };
}

export function activityLines(data: AssignmentsResponse | null | undefined): ActivityLine[] {
  const events = data?.events;
  return Array.isArray(events) ? events.map(formatEvent) : [];
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- activity/format`
Expected: all tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/activity
git commit -m "feat(activity): event-ledger -> display lines (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.8: `lib/questions/facets` — qtype list + defensive rows (TDD) [owner: deepak] [verify: headless] [blockedBy: E2.2]

**Files:**
- Create: `frontend/src/lib/questions/facets.ts`
- Test: `frontend/src/lib/questions/facets.test.ts`

The static 8 `q_type`s, plus defensive accessors over the questions payload's **two** empty shapes (with/without
`error`, both HTTP 200 — grounding §7.2). `questionError` returns the error string or null; the empty state is
gated on `results.length`, NOT on `error` presence.

- [ ] **Step 1: Write the failing test.** Create `frontend/src/lib/questions/facets.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { QTYPES, questionRows, questionError } from "./facets";
import type { QuestionsResponse } from "../../types/contracts";

describe("QTYPES", () => {
  it("is the 8 known question types", () => {
    expect(QTYPES).toEqual([
      "mcq_single", "integer", "numeric", "mcq_multi",
      "matrix_match", "assertion_reason", "comprehension", "true_false",
    ]);
  });
});

describe("questionRows / questionError", () => {
  it("returns rows defensively", () => {
    const data = { results: [{ q_uid: "q1", slug: "s", q_type: "integer", subject: "P",
      chapter: "1", difficulty: "easy", text: "snippet…" }] } as QuestionsResponse;
    expect(questionRows(data)).toHaveLength(1);
    expect(questionError(data)).toBeNull();
  });
  it("both empty shapes: error present vs absent (both → [])", () => {
    expect(questionRows({ results: [], error: "QX source not present" })).toEqual([]);
    expect(questionError({ results: [], error: "QX source not present" })).toBe("QX source not present");
    expect(questionRows({ results: [] })).toEqual([]);
    expect(questionError({ results: [] })).toBeNull();
    expect(questionRows(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- questions/facets`
Expected: `Cannot find module './facets'` (red).

- [ ] **Step 3: Implement `frontend/src/lib/questions/facets.ts`.**
```ts
import type { Question, QuestionsResponse } from "../../types/contracts";

export const QTYPES: string[] = [
  "mcq_single", "integer", "numeric", "mcq_multi",
  "matrix_match", "assertion_reason", "comprehension", "true_false",
];

export function questionRows(data: QuestionsResponse | null | undefined): Question[] {
  const results = data?.results;
  return Array.isArray(results) ? results : [];
}

/** The in-body error string (HTTP 200) when QX is absent, else null.
 *  Empty state is gated on rows.length, NOT on this — `error` is optional. */
export function questionError(data: QuestionsResponse | null | undefined): string | null {
  return data?.error ?? null;
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- questions/facets`
Expected: all tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/questions
git commit -m "feat(questions): qtype list + defensive row/error accessors (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.9: Org Chart app [owner: deepak] [verify: visual] [blockedBy: E2.1, E2.5]

**Files:**
- Create: `frontend/src/apps/Org/index.tsx`
- Test: `frontend/src/apps/Org/index.test.tsx`

Thin wrapper over `GET /api/org`. Renders chairman → board → workers as a box hierarchy (CSS columns + simple
connectors; the SVG-tree polish is the quarantined visual pass), plus the **pipeline-owner roster** (the 7 owner
tokens resolved to display names via `lib/org/resolve` — this is `resolveOwner`'s consumer). VISUAL — but the
looped headless residue is the render-smoke below.

- [ ] **Step 1: Write the failing render-smoke test.** Create `frontend/src/apps/Org/index.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Org from "./index";

const org = {
  chairman: { id: "deepak", name: "Deepak Bhardwaj", role: "Founder & Chairman" },
  board: [{ id: "claude-deepak", name: "Claude-Deepak", role: "CEO" }],
  workers: [{ id: "gemini", name: "Gemini", role: "Research" }],
  owners: { codex: { name: "Codex", role: "Reviewer" } },
};

describe("Org app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/org and renders the hierarchy + owner roster", () => {
    useApiMock.mockReturnValue({ data: org, loading: false, error: null });
    render(<Org />);
    expect(useApiMock).toHaveBeenCalledWith("/api/org");
    expect(screen.getByTestId("org")).toBeInTheDocument();
    expect(screen.getByText("Deepak Bhardwaj")).toBeInTheDocument();
    expect(screen.getByText("Claude-Deepak")).toBeInTheDocument();
    expect(screen.getByText("Gemini")).toBeInTheDocument();
    expect(screen.getByTestId("org-owners")).toHaveTextContent("Codex");
  });
  it("renders error inline and still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Org />);
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 500");
    expect(screen.getByTestId("org")).toBeInTheDocument();
  });
  it("empty/loading: aria-busy, no crash", () => {
    useApiMock.mockReturnValue({ data: null, loading: true, error: null });
    render(<Org />);
    expect(screen.getByTestId("org-tree")).toHaveAttribute("aria-busy", "true");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- apps/Org`
Expected: `Cannot find module './index'` (red).

- [ ] **Step 3: Implement `frontend/src/apps/Org/index.tsx`.**
```tsx
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { resolveOwner } from "../../lib/org/resolve";
import type { OrgChart, OrgPerson } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

function Node({ p }: { p: OrgPerson }) {
  return (
    <div data-testid="org-node"
         style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10,
                  padding: "8px 12px", minWidth: 150, textAlign: "center" }}>
      <div style={{ color: V.text, fontWeight: 600 }}>{p.name}</div>
      <div style={{ color: V.muted, fontSize: 12 }}>{p.role}</div>
    </div>
  );
}

export default function Org() {
  const { data, loading, error } = useApi<OrgChart>("/api/org");
  const board = Array.isArray(data?.board) ? data!.board : [];
  const workers = Array.isArray(data?.workers) ? data!.workers : [];
  const ownerTokens = data?.owners ? Object.keys(data.owners) : [];
  return (
    <div data-testid="org" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="org" size={26} label="Org Chart" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Org Chart</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <div data-testid="org-tree" aria-busy={loading}
           style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        {data?.chairman ? <Node p={data.chairman} /> : null}
        <div data-testid="org-board" style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {board.map((b) => <Node key={b.id} p={b} />)}
        </div>
        <div data-testid="org-workers" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          {workers.map((w) => <Node key={w.id} p={w} />)}
        </div>
        {ownerTokens.length ? (
          <div data-testid="org-owners" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {ownerTokens.map((token) => (
              <span key={token} data-testid="owner-chip"
                    style={{ color: V.muted, fontSize: 12, border: `1px solid ${V.line}`,
                             borderRadius: 999, padding: "2px 10px" }}>
                {resolveOwner(data, token).name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- apps/Org`
Expected: 3 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/apps/Org
git commit -m "feat(apps): Org Chart app over GET /api/org (thin wrapper)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.10: Pipelines app [owner: deepak] [verify: visual] [blockedBy: E2.4]

**Files:**
- Create: `frontend/src/apps/Pipelines/index.tsx`
- Test: `frontend/src/apps/Pipelines/index.test.tsx`

Thin wrapper over `GET /api/pipelines` using `stagesOf`. Renders each pipeline card with its ordered stages,
current-stage marker, and gate lock.

- [ ] **Step 1: Write the failing render-smoke test.** Create `frontend/src/apps/Pipelines/index.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Pipelines from "./index";

const data = { pipelines: [{
  pipeline: "textbook", label: "Lectures (textbook)", created: "x", updated: "y", current: "approve",
  phases: {
    draft: { status: "done", owner: "codex", gate: false, started: null, finished: null, artifacts: [], error: null },
    approve: { status: "awaiting_gate", owner: "human", gate: true, started: null, finished: null, artifacts: [], error: null },
  },
}] };

describe("Pipelines app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/pipelines and renders stages", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Pipelines />);
    expect(useApiMock).toHaveBeenCalledWith("/api/pipelines");
    expect(screen.getByTestId("pipelines")).toBeInTheDocument();
    expect(screen.getByText("Lectures (textbook)")).toBeInTheDocument();
    expect(screen.getAllByTestId("phase")).toHaveLength(2);
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 503" });
    render(<Pipelines />);
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 503");
    expect(screen.getByTestId("pipelines")).toBeInTheDocument();
  });
  it("loading aria-busy, empty no crash", () => {
    useApiMock.mockReturnValue({ data: null, loading: true, error: null });
    render(<Pipelines />);
    expect(screen.getByTestId("pipeline-grid")).toHaveAttribute("aria-busy", "true");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- apps/Pipelines`
Expected: `Cannot find module './index'` (red).

- [ ] **Step 3: Implement `frontend/src/apps/Pipelines/index.tsx`.**
```tsx
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { stagesOf } from "../../lib/pipelines/stages";
import type { PipelinesResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

export default function Pipelines() {
  const { data, loading, error } = useApi<PipelinesResponse>("/api/pipelines");
  const pipelines = Array.isArray(data?.pipelines) ? data!.pipelines : [];
  return (
    <div data-testid="pipelines" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="pipelines" size={26} label="Pipelines" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Pipelines</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section data-testid="pipeline-grid" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {pipelines.map((p) => (
          <article key={p.pipeline} data-testid="pipeline-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 12, padding: 14 }}>
            <div style={{ color: V.text, fontWeight: 600, marginBottom: 8 }}>{p.label}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {stagesOf(p).map((s) => (
                <div key={s.name} data-testid="phase"
                     style={{ background: V.subBg, borderRadius: 8, padding: "4px 10px",
                              color: s.isCurrent ? V.text : V.muted, fontSize: 12,
                              border: s.isCurrent ? `1px solid ${V.accent}` : `1px solid ${V.line}` }}>
                  {s.gate ? "[gate] " : ""}{s.name}: {s.status}{s.owner ? ` · ${s.owner}` : ""}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- apps/Pipelines`
Expected: 3 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/apps/Pipelines
git commit -m "feat(apps): Pipelines app over GET /api/pipelines (thin wrapper)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.11: Lectures app [owner: deepak] [verify: visual] [blockedBy: E2.2, E2.3]

**Files:**
- Create: `frontend/src/apps/Lectures/index.tsx`
- Test: `frontend/src/apps/Lectures/index.test.tsx`

Thin catalog wrapper over `GET /api/search?source=textbook&limit=200` using `buildQuery` + `catalogRows`. Lists
chapters with unit/status and a safe open link (`openHref`). This is the **template for the 5 other catalog apps**
(mcd, Munshi, Booklets, INSP, Sims) — they differ only in `source`, `limit`, header label, and empty-state copy.

- [ ] **Step 1: Write the failing render-smoke test.** Create `frontend/src/apps/Lectures/index.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Lectures from "./index";

const data = { results: [
  { uid: "u1", source: "textbook", kind: "chapter", title: "Vectors", subject: "Physics",
    unit: "Mechanics", chapter: "1", status: "approved", path: "C:/t/vectors.html",
    url: null, updated_at: null, meta: {} },
] };

describe("Lectures app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/search?source=textbook and lists rows", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Lectures />);
    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=textbook&limit=200");
    expect(screen.getByTestId("lectures")).toBeInTheDocument();
    expect(screen.getByText("Vectors")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-row")).toBeInTheDocument();
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Lectures />);
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 500");
    expect(screen.getByTestId("lectures")).toBeInTheDocument();
  });
  it("empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Lectures />);
    expect(screen.getByTestId("catalog-empty")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- apps/Lectures`
Expected: `Cannot find module './index'` (red).

- [ ] **Step 3: Implement `frontend/src/apps/Lectures/index.tsx`.**
```tsx
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { buildQuery } from "../../lib/api/query";
import { catalogRows } from "../../lib/catalog/rows";
import type { SearchResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

const PATH = "/api/search" + buildQuery({ source: "textbook", limit: 200 });

export default function Lectures() {
  const { data, loading, error } = useApi<SearchResponse>(PATH);
  const rows = catalogRows(data);
  return (
    <div data-testid="lectures" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="lectures" size={26} label="Lectures" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Lectures</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div data-testid="catalog-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "No chapters yet — run a catalog refresh."}
          </div>
        ) : rows.map((r) => (
          <article key={r.uid} data-testid="catalog-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10,
                            padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ color: V.text, fontWeight: 600 }}>{r.title}</div>
              <div style={{ color: V.muted, fontSize: 12 }}>
                {[r.unit, r.chapter && `ch ${r.chapter}`, r.status].filter(Boolean).join(" · ")}
              </div>
            </div>
            {r.openHref ? (
              <a href={r.openHref} target="_blank" rel="noreferrer"
                 style={{ color: V.accent, fontSize: 13, alignSelf: "center" }}>open</a>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- apps/Lectures`
Expected: 3 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/apps/Lectures
git commit -m "feat(apps): Lectures app over /api/search?source=textbook (catalog wrapper)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.12: mycontentdev app [owner: deepak] [verify: visual] [blockedBy: E2.2, E2.3]

**Files:**
- Create: `frontend/src/apps/Mycontentdev/index.tsx`
- Test: `frontend/src/apps/Mycontentdev/index.test.tsx`

Catalog wrapper over `GET /api/search?source=mycontentdev&limit=200`. **Empty-or-unavailable** — `/api/search`
omits an absent source, so the empty state (gated purely on `rows.length`, no `available` field on a search row)
reads "not available — set MCD creds & refresh" (grounding §7.5). Read-only; capture/write is out of scope.

- [ ] **Step 1: Write the failing render-smoke test.** Create `frontend/src/apps/Mycontentdev/index.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Mcd from "./index";

const data = { results: [
  { uid: "s1", source: "mycontentdev", kind: "concept", title: "Seed A", subject: null,
    unit: null, chapter: null, status: "captured", path: null, url: "x", updated_at: null, meta: {} },
] };

describe("mycontentdev app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/search?source=mycontentdev and lists seeds", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Mcd />);
    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=mycontentdev&limit=200");
    expect(screen.getByTestId("mycontentdev")).toBeInTheDocument();
    expect(screen.getByText("Seed A")).toBeInTheDocument();
  });
  it("creds-gated empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Mcd />);
    expect(screen.getByTestId("catalog-empty")).toHaveTextContent(/creds/i);
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Mcd />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("mycontentdev")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- apps/Mycontentdev`
Expected: `Cannot find module './index'` (red).

- [ ] **Step 3: Implement `frontend/src/apps/Mycontentdev/index.tsx`.**
```tsx
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { buildQuery } from "../../lib/api/query";
import { catalogRows } from "../../lib/catalog/rows";
import type { SearchResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

const PATH = "/api/search" + buildQuery({ source: "mycontentdev", limit: 200 });

export default function Mycontentdev() {
  const { data, loading, error } = useApi<SearchResponse>(PATH);
  const rows = catalogRows(data);
  return (
    <div data-testid="mycontentdev" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="mycontentdev" size={26} label="mycontentdev" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>mycontentdev</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div data-testid="catalog-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "mycontentdev not available — set MCD creds and run a refresh."}
          </div>
        ) : rows.map((r) => (
          <article key={r.uid} data-testid="catalog-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ color: V.text, fontWeight: 600 }}>{r.title}</div>
            <div style={{ color: V.muted, fontSize: 12 }}>{[r.kind, r.status].filter(Boolean).join(" · ")}</div>
          </article>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- apps/Mycontentdev`
Expected: 3 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/apps/Mycontentdev
git commit -m "feat(apps): mycontentdev app (read-only, creds-gated empty state)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.13: Munshi app [owner: deepak] [verify: visual] [blockedBy: E2.2, E2.3]

**Files:**
- Create: `frontend/src/apps/Munshi/index.tsx`
- Test: `frontend/src/apps/Munshi/index.test.tsx`

Catalog wrapper over `GET /api/search?source=munshi&limit=200`. Rows are front-desk library items
(`kind ∈ note|todo|issue|question|followup`). **Read-only — the prototype's capture input + mic FAB are OUT of
scope** (no backend write endpoint; grounding §7.5). Empty-or-unavailable state, gated on `rows.length` (an absent
source returns no rows).

- [ ] **Step 1: Write the failing render-smoke test.** Create `frontend/src/apps/Munshi/index.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Munshi from "./index";

const data = { results: [
  { uid: "m1", source: "munshi", kind: "todo", title: "Call vendor", subject: null,
    unit: null, chapter: null, status: "open", path: null, url: null, updated_at: null, meta: {} },
] };

describe("Munshi app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/search?source=munshi and lists items", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Munshi />);
    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=munshi&limit=200");
    expect(screen.getByTestId("munshi")).toBeInTheDocument();
    expect(screen.getByText("Call vendor")).toBeInTheDocument();
  });
  it("creds-gated empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Munshi />);
    expect(screen.getByTestId("catalog-empty")).toHaveTextContent(/creds|available/i);
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Munshi />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("munshi")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- apps/Munshi`
Expected: `Cannot find module './index'` (red).

- [ ] **Step 3: Implement `frontend/src/apps/Munshi/index.tsx`.**
```tsx
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { buildQuery } from "../../lib/api/query";
import { catalogRows } from "../../lib/catalog/rows";
import type { SearchResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

const PATH = "/api/search" + buildQuery({ source: "munshi", limit: 200 });

export default function Munshi() {
  const { data, loading, error } = useApi<SearchResponse>(PATH);
  const rows = catalogRows(data);
  return (
    <div data-testid="munshi" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="munshi" size={26} label="Munshi" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Munshi</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div data-testid="catalog-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "Munshi not available — set MUNSHI creds and run a refresh."}
          </div>
        ) : rows.map((r) => (
          <article key={r.uid} data-testid="catalog-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ color: V.text, fontWeight: 600 }}>{r.title}</div>
            <div style={{ color: V.muted, fontSize: 12 }}>{[r.kind, r.status].filter(Boolean).join(" · ")}</div>
          </article>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- apps/Munshi`
Expected: 3 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/apps/Munshi
git commit -m "feat(apps): Munshi app (read-only library view; capture out of scope)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.14: Assignments kanban app [owner: khanak] [verify: visual] [blockedBy: E2.2, E2.6]

**Files:**
- Create: `frontend/src/apps/Assignments/index.tsx`
- Test: `frontend/src/apps/Assignments/index.test.tsx`

Thin wrapper over `GET /api/assignments` using `KANBAN_COLUMNS` + `groupByStatus`. Renders the **5 columns**
(queued/running/in-review/approved/changes); each card shows id + agent + pipeline. Empty DB → all columns empty
(grounding §7.3).

- [ ] **Step 1: Write the failing render-smoke test.** Create `frontend/src/apps/Assignments/index.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Assignments from "./index";

const data = { assignments: [
  { id: "A1", agent: "codex", outbox_path: "x", pipeline: "textbook", seed_ref: null, artifact_ref: null,
    expected_output: null, review_by: null, status: "in-review", created_at: "t", updated_at: "t" },
], events: [] };

describe("Assignments app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/assignments and renders 5 columns + a card in in-review", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Assignments />);
    expect(useApiMock).toHaveBeenCalledWith("/api/assignments");
    expect(screen.getByTestId("assignments")).toBeInTheDocument();
    expect(screen.getAllByTestId("kanban-column")).toHaveLength(5);
    expect(screen.getByTestId("col-in-review")).toHaveTextContent("A1");
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Assignments />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("assignments")).toBeInTheDocument();
  });
  it("empty DB: 5 empty columns, no crash", () => {
    useApiMock.mockReturnValue({ data: { assignments: [], events: [] }, loading: false, error: null });
    render(<Assignments />);
    expect(screen.getAllByTestId("kanban-column")).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- apps/Assignments`
Expected: `Cannot find module './index'` (red).

- [ ] **Step 3: Implement `frontend/src/apps/Assignments/index.tsx`.**
```tsx
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { KANBAN_COLUMNS, groupByStatus } from "../../lib/kanban/columns";
import type { AssignmentsResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

export default function Assignments() {
  const { data, loading, error } = useApi<AssignmentsResponse>("/api/assignments");
  const groups = groupByStatus(Array.isArray(data?.assignments) ? data!.assignments : []);
  return (
    <div data-testid="assignments" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="assignments" size={26} label="Assignments" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Assignments</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section aria-busy={loading} style={{ marginTop: 16, display: "grid",
               gridTemplateColumns: `repeat(${KANBAN_COLUMNS.length}, 1fr)`, gap: 10 }}>
        {KANBAN_COLUMNS.map((c) => (
          <div key={c.key} data-testid="kanban-column"
               style={{ background: V.subBg, border: `1px solid ${V.line}`, borderRadius: 10, padding: 10 }}>
            <div style={{ color: V.muted, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              {c.label} · {groups[c.key].length}
            </div>
            <div data-testid={`col-${c.key}`} style={{ display: "grid", gap: 8 }}>
              {groups[c.key].map((a) => (
                <article key={a.id} data-testid="kanban-card"
                         style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 8, padding: 8 }}>
                  <div style={{ color: V.text, fontWeight: 600, fontSize: 13 }}>{a.id}</div>
                  <div style={{ color: V.muted, fontSize: 12 }}>
                    {[a.agent, a.pipeline].filter(Boolean).join(" · ")}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- apps/Assignments`
Expected: 3 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/apps/Assignments
git commit -m "feat(apps): Assignments kanban over GET /api/assignments (5 status columns)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.15: Activity app [owner: khanak] [verify: visual] [blockedBy: E2.2, E2.7]

**Files:**
- Create: `frontend/src/apps/Activity/index.tsx`
- Test: `frontend/src/apps/Activity/index.test.tsx`

Thin wrapper over `GET /api/assignments` (reuses the `events[]` ledger, newest-first) via `activityLines`. Renders
a timeline of who/what/when/note. No new endpoint (grounding §7.4).

- [ ] **Step 1: Write the failing render-smoke test.** Create `frontend/src/apps/Activity/index.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Activity from "./index";

const data = { assignments: [], events: [
  { id: 2, ts: "2026-06-20T10:00", actor: "codex", verb: "status:approved",
    assignment_id: "A1", subsystem: null, subsystem_ref: null, note: "ok" },
] };

describe("Activity app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/assignments and renders event lines", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Activity />);
    expect(useApiMock).toHaveBeenCalledWith("/api/assignments");
    expect(screen.getByTestId("activity")).toBeInTheDocument();
    expect(screen.getByTestId("activity-row")).toHaveTextContent("status:approved");
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Activity />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("activity")).toBeInTheDocument();
  });
  it("empty state when no events", () => {
    useApiMock.mockReturnValue({ data: { assignments: [], events: [] }, loading: false, error: null });
    render(<Activity />);
    expect(screen.getByTestId("activity-empty")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- apps/Activity`
Expected: `Cannot find module './index'` (red).

- [ ] **Step 3: Implement `frontend/src/apps/Activity/index.tsx`.**
```tsx
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { activityLines } from "../../lib/activity/format";
import type { AssignmentsResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

export default function Activity() {
  const { data, loading, error } = useApi<AssignmentsResponse>("/api/assignments");
  const lines = activityLines(data);
  return (
    <div data-testid="activity" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="activity" size={26} label="Activity" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Activity</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section data-testid="activity-list" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 6 }}>
        {lines.length === 0 ? (
          <div data-testid="activity-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "No activity recorded yet."}
          </div>
        ) : lines.map((l) => (
          <article key={l.id} data-testid="activity-row"
                   style={{ borderLeft: `2px solid ${V.line}`, paddingLeft: 10 }}>
            <div style={{ color: V.text, fontSize: 13 }}>
              <strong>{l.who}</strong> {l.what}
            </div>
            <div style={{ color: V.muted, fontSize: 12 }}>
              {[l.when, l.note].filter(Boolean).join(" · ")}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- apps/Activity`
Expected: 3 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/apps/Activity
git commit -m "feat(apps): Activity timeline over /api/assignments events (thin wrapper)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.16: Questions app [owner: khanak] [verify: visual] [blockedBy: E2.2, E2.8]

**Files:**
- Create: `frontend/src/apps/Questions/index.tsx`
- Test: `frontend/src/apps/Questions/index.test.tsx`

Thin wrapper over `GET /api/questions` using `QTYPES` + `questionRows`/`questionError`. The empty state is gated on
`rows.length`, NOT on `error` (two empty shapes — grounding §7.2); `text` is a snippet (label it "preview"). For E2,
the app fetches the default (unfiltered) question list once; a qtype filter is rendered but baked into `path` only
if a filter UI is wired (kept minimal here — fetch the default list, show the qtype chips as labels).

- [ ] **Step 1: Write the failing render-smoke test.** Create `frontend/src/apps/Questions/index.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Questions from "./index";

const data = { results: [
  { q_uid: "q1", slug: "s1", q_type: "integer", subject: "Physics", chapter: "1",
    difficulty: "easy", text: "A block of mass…" },
] };

describe("Questions app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/questions and lists rows", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Questions />);
    expect(useApiMock).toHaveBeenCalledWith("/api/questions?limit=50");
    expect(screen.getByTestId("questions")).toBeInTheDocument();
    expect(screen.getByTestId("question-row")).toHaveTextContent("A block of mass…");
  });
  it("QX-absent in-body error shows a notice; still mounts", () => {
    useApiMock.mockReturnValue({ data: { results: [], error: "QX source not present" }, loading: false, error: null });
    render(<Questions />);
    expect(screen.getByTestId("questions-notice")).toHaveTextContent(/QX/);
    expect(screen.getByTestId("questions")).toBeInTheDocument();
  });
  it("empty (no error key) still renders empty state", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Questions />);
    expect(screen.getByTestId("questions-empty")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- apps/Questions`
Expected: `Cannot find module './index'` (red).

- [ ] **Step 3: Implement `frontend/src/apps/Questions/index.tsx`.**
```tsx
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { buildQuery } from "../../lib/api/query";
import { QTYPES, questionRows, questionError } from "../../lib/questions/facets";
import type { QuestionsResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

const PATH = "/api/questions" + buildQuery({ limit: 50 });

export default function Questions() {
  const { data, loading, error } = useApi<QuestionsResponse>(PATH);
  const rows = questionRows(data);
  const notice = questionError(data);   // in-body QX-absent notice (optional)
  return (
    <div data-testid="questions" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="questions" size={26} label="Questions" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Questions</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      {notice ? <div data-testid="questions-notice" style={{ color: V.muted, marginTop: 8 }}>{notice}</div> : null}
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {QTYPES.map((t) => (
          <span key={t} data-testid="qtype-chip"
                style={{ background: V.subBg, color: V.muted, fontSize: 11, borderRadius: 999, padding: "2px 8px" }}>{t}</span>
        ))}
      </div>
      <section data-testid="questions-list" aria-busy={loading} style={{ marginTop: 14, display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div data-testid="questions-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "No questions to show."}
          </div>
        ) : rows.map((q) => (
          <article key={q.q_uid} data-testid="question-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ color: V.text, fontSize: 13 }}>{q.text /* preview snippet */}</div>
            <div style={{ color: V.muted, fontSize: 12, marginTop: 4 }}>
              {[q.q_type, q.subject, q.chapter, q.difficulty].filter(Boolean).join(" · ")}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- apps/Questions`
Expected: 3 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/apps/Questions
git commit -m "feat(apps): Questions app over /api/questions (qtype chips, snippet preview)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.17: Booklets app [owner: khanak] [verify: visual] [blockedBy: E2.2, E2.3]

**Files:**
- Create: `frontend/src/apps/Booklets/index.tsx`
- Test: `frontend/src/apps/Booklets/index.test.tsx`

Catalog wrapper over `GET /api/search?source=booklets&limit=500`. Same shape as Lectures (E2.11) — differs only in
`source`, `limit`, header, and empty copy. Theory/Workbook pill is derived presentation (not a backend field) and is
deferred to the visual pass.

- [ ] **Step 1: Write the failing render-smoke test.** Create `frontend/src/apps/Booklets/index.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Booklets from "./index";

const data = { results: [
  { uid: "b1", source: "booklets", kind: "booklet", title: "Mechanics WB", subject: "Physics",
    unit: null, chapter: null, status: null, path: "C:/b/mech.pdf", url: null, updated_at: null, meta: {} },
] };

describe("Booklets app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/search?source=booklets and lists rows", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Booklets />);
    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=booklets&limit=500");
    expect(screen.getByTestId("booklets")).toBeInTheDocument();
    expect(screen.getByText("Mechanics WB")).toBeInTheDocument();
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Booklets />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("booklets")).toBeInTheDocument();
  });
  it("empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Booklets />);
    expect(screen.getByTestId("catalog-empty")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- apps/Booklets`
Expected: `Cannot find module './index'` (red).

- [ ] **Step 3: Implement `frontend/src/apps/Booklets/index.tsx`.**
```tsx
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { buildQuery } from "../../lib/api/query";
import { catalogRows } from "../../lib/catalog/rows";
import type { SearchResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

const PATH = "/api/search" + buildQuery({ source: "booklets", limit: 500 });

export default function Booklets() {
  const { data, loading, error } = useApi<SearchResponse>(PATH);
  const rows = catalogRows(data);
  return (
    <div data-testid="booklets" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="booklets" size={26} label="Booklets" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Booklets</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div data-testid="catalog-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "No booklets yet — run a catalog refresh."}
          </div>
        ) : rows.map((r) => (
          <article key={r.uid} data-testid="catalog-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10,
                            padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ color: V.text, fontWeight: 600 }}>{r.title}</div>
              <div style={{ color: V.muted, fontSize: 12 }}>{[r.subject, r.status].filter(Boolean).join(" · ")}</div>
            </div>
            {r.openHref ? (
              <a href={r.openHref} target="_blank" rel="noreferrer"
                 style={{ color: V.accent, fontSize: 13, alignSelf: "center" }}>open</a>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- apps/Booklets`
Expected: 3 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/apps/Booklets
git commit -m "feat(apps): Booklets app over /api/search?source=booklets (catalog wrapper)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.18: INSP / Olympiad app [owner: khanak] [verify: visual] [blockedBy: E2.2, E2.3]

**Files:**
- Create: `frontend/src/apps/Insp/index.tsx`
- Test: `frontend/src/apps/Insp/index.test.tsx`

Catalog wrapper over `GET /api/search?source=insp&limit=500`. Rows are `kind:"exam-set"` (a folder) or
`kind:"exam"` (a single pdf). Shows kind + title + open link.

- [ ] **Step 1: Write the failing render-smoke test.** Create `frontend/src/apps/Insp/index.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Insp from "./index";

const data = { results: [
  { uid: "i1", source: "insp", kind: "exam-set", title: "NSEP 2024", subject: null,
    unit: null, chapter: null, status: null, path: null, url: null, updated_at: null, meta: { pdfs: 5 } },
] };

describe("INSP app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/search?source=insp and lists rows", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Insp />);
    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=insp&limit=500");
    expect(screen.getByTestId("insp")).toBeInTheDocument();
    expect(screen.getByText("NSEP 2024")).toBeInTheDocument();
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Insp />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("insp")).toBeInTheDocument();
  });
  it("empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Insp />);
    expect(screen.getByTestId("catalog-empty")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- apps/Insp`
Expected: `Cannot find module './index'` (red).

- [ ] **Step 3: Implement `frontend/src/apps/Insp/index.tsx`.**
```tsx
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { buildQuery } from "../../lib/api/query";
import { catalogRows } from "../../lib/catalog/rows";
import type { SearchResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

const PATH = "/api/search" + buildQuery({ source: "insp", limit: 500 });

export default function Insp() {
  const { data, loading, error } = useApi<SearchResponse>(PATH);
  const rows = catalogRows(data);
  return (
    <div data-testid="insp" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="insp" size={26} label="INSP / Olympiad" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>INSP / Olympiad</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div data-testid="catalog-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "No INSP/Olympiad sets yet — run a catalog refresh."}
          </div>
        ) : rows.map((r) => (
          <article key={r.uid} data-testid="catalog-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10,
                            padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ color: V.text, fontWeight: 600 }}>{r.title}</div>
              <div style={{ color: V.muted, fontSize: 12 }}>{r.kind}</div>
            </div>
            {r.openHref ? (
              <a href={r.openHref} target="_blank" rel="noreferrer"
                 style={{ color: V.accent, fontSize: 13, alignSelf: "center" }}>open</a>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- apps/Insp`
Expected: 3 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/apps/Insp
git commit -m "feat(apps): INSP/Olympiad app over /api/search?source=insp (catalog wrapper)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.19: Simulations app [owner: khanak] [verify: visual] [blockedBy: E2.2, E2.3]

**Files:**
- Create: `frontend/src/apps/Sims/index.tsx`
- Test: `frontend/src/apps/Sims/index.test.tsx`

Catalog wrapper over `GET /api/search?source=sims&limit=2000` using `catalogRows` + `subjectsOf` (for a subject
filter row). Each row opens its `.html` via `openHref`.

- [ ] **Step 1: Write the failing render-smoke test.** Create `frontend/src/apps/Sims/index.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Sims from "./index";

const data = { results: [
  { uid: "s1", source: "sims", kind: "sim", title: "Projectile", subject: "Physics",
    unit: null, chapter: null, status: null, path: "C:/s/proj.html", url: null, updated_at: null, meta: { grade: "11" } },
] };

describe("Sims app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/search?source=sims and lists rows + subject chips", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Sims />);
    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=sims&limit=2000");
    expect(screen.getByTestId("sims")).toBeInTheDocument();
    expect(screen.getByText("Projectile")).toBeInTheDocument();
    expect(screen.getByTestId("subject-chip")).toHaveTextContent("Physics");
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Sims />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("sims")).toBeInTheDocument();
  });
  it("empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Sims />);
    expect(screen.getByTestId("catalog-empty")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
Run: `cd frontend && npm test -- apps/Sims`
Expected: `Cannot find module './index'` (red).

- [ ] **Step 3: Implement `frontend/src/apps/Sims/index.tsx`.**
```tsx
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { buildQuery } from "../../lib/api/query";
import { catalogRows, subjectsOf } from "../../lib/catalog/rows";
import type { SearchResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

const PATH = "/api/search" + buildQuery({ source: "sims", limit: 2000 });

export default function Sims() {
  const { data, loading, error } = useApi<SearchResponse>(PATH);
  const rows = catalogRows(data);
  const subjects = subjectsOf(rows);
  return (
    <div data-testid="sims" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="sims" size={26} label="Simulations" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Simulations</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {subjects.map((s) => (
          <span key={s} data-testid="subject-chip"
                style={{ background: V.subBg, color: V.muted, fontSize: 11, borderRadius: 999, padding: "2px 8px" }}>{s}</span>
        ))}
      </div>
      <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 14, display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div data-testid="catalog-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "No simulations yet — run a catalog refresh."}
          </div>
        ) : rows.map((r) => (
          <article key={r.uid} data-testid="catalog-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10,
                            padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ color: V.text, fontWeight: 600 }}>{r.title}</div>
              <div style={{ color: V.muted, fontSize: 12 }}>{r.subject ?? ""}</div>
            </div>
            {r.openHref ? (
              <a href={r.openHref} target="_blank" rel="noreferrer"
                 style={{ color: V.accent, fontSize: 13, alignSelf: "center" }}>open</a>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect PASS.**
Run: `cd frontend && npm test -- apps/Sims`
Expected: 3 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/apps/Sims
git commit -m "feat(apps): Simulations app over /api/search?source=sims (subject chips)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E2.20: E2 green gate + pointer-file sync [owner: deepak] [verify: headless] [blockedBy: E2.1–E2.19]

**Files:**
- None (verification + doc sync)
- Modify: `STATUS.html`, `SUMMARY.html`, `HANDOFF.md`, and the parent plan's E2 banner

The phase close: prove the full suite green, assert all 11 app files exist (a forgotten file fails silently), then
sync the pointer files and merge `e2/samagra-os` → `main`.

- [ ] **Step 1: Assert all 11 E2 app files exist** (catch a silently-missing app).
Run (from `frontend/`):
```bash
for d in Org Pipelines Lectures Mycontentdev Munshi Assignments Activity Questions Booklets Insp Sims; do
  test -f "src/apps/$d/index.tsx" && echo "OK $d" || echo "MISSING $d";
done
```
Expected: 11 × `OK`, zero `MISSING`.

- [ ] **Step 2: Full frontend gate.**
Run: `cd frontend && npm run verify`
Expected: lint clean, `tsc --noEmit` clean, `vitest run` all green (E1's 439 + the new E2 lib/app tests), `vite build`
writes `dist/`. No `.only`/`.skip` in the diff.

- [ ] **Step 3: Full backend gate.**
Run (repo root): `.venv\Scripts\python -m pytest -q`
Expected: 106 green (E1's 102 + the 4 `test_api_org.py`).

- [ ] **Step 4: Sync pointer files.** Update `STATUS.html`, `SUMMARY.html`, `HANDOFF.md` (E2 shipped: 11 data apps +
  `GET /api/org`, test counts, "pixel parity is a separate human pass — not claimed"), and flip the parent plan's
  E2 status banner (`2026-06-20-samagra-os.md` §Phase E2) from `⬜ NOT STARTED` to `✅ BUILT (headless green)`.
  Record this **post-E2 follow-up** in HANDOFF (deferred under the E2 contracts-freeze): *delete Dashboard's inline
  `Overview`/`OverviewSource` interfaces (`apps/Dashboard/index.tsx`) and `import type { Overview, OverviewSource }
  from "../../types/contracts"` so it stops drifting from the now-exported types.*

- [ ] **Step 5: Merge + commit the sync.**
```bash
cd /c/SandBox/claude_box/TeachingOS
git add STATUS.html SUMMARY.html HANDOFF.md docs/superpowers/plans/2026-06-20-samagra-os.md
git commit -m "docs(status): SAMAGRA OS E2 built — 11 data apps + /api/org, suites green

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
# fast-forward merge to main (owner-gated; or open a PR if preferred):
git checkout main && git merge --ff-only e2/samagra-os
```
Expected: clean fast-forward; both suites green on `main`. **Then the owner-run browser-vision pixel QA pass over
the 11 apps (quarantined; not a loop gate).**

---

## Self-Review (run against the grounding report + parent plan)

**Spec coverage:** all 11 E2 apps + `GET /api/org` are tasked (E2.1, E2.9–E2.19). The 4 optional endpoints are
SKIPped (grounding §3 YAGNI) — recorded, not silently dropped. Owners match the division doc §E2.

**Grounding-delta fidelity:** dual `meta_json`/`summary_json` (typed optional, never re-parsed); two empty-question
bodies (`questionError` optional, empty gated on `rows.length` — E2.8/E2.16); hyphenated `in-review` + `changes`
5th column (E2.6/E2.14); `phases` name-keyed Record iterated via `Object.entries` (E2.4/E2.10); 7 owner ids in
`org.py` (E2.1); `/open?path=` only for rows with a path (E2.3); `useApi` no-param-builder → `buildQuery` bakes
params into `path` (E2.2); registration = file-creation only, gate asserts all 11 exist (E2.20).

**Type consistency:** every app imports the exact types from E2.2 (`SearchResponse`, `PipelinesResponse`,
`AssignmentsResponse`, `QuestionsResponse`, `OrgChart`); pure-module signatures (`catalogRows`, `stagesOf`,
`groupByStatus`, `activityLines`, `questionRows`/`questionError`, `resolveOwner`, `buildQuery`) are defined once and
referenced unchanged.

**No placeholders:** every step ships exact code or an exact command + expected output.
