# SAMAGRA OS — E2 GROUNDING REPORT (source of truth; supersedes api.md for E2)

> Synthesized 2026-06-21 from 6 live-source verification passes (4 backend, 2 frontend) run as a
> grounding workflow, then re-confirmed by direct reads of `samagra/api/app.py`, `tests/conftest.py`,
> `frontend/src/hooks/useApi.ts`, `frontend/src/App.tsx`, `frontend/src/apps/Dashboard/index.tsx`,
> `frontend/src/types/contracts.ts`, and `frontend/src/lib/terminal/dispatch.ts`. **Where the live
> source differs from `api.md`, the live source wins and the delta is bolded.** This report is the
> authoritative contract for the E2 plan (`docs/superpowers/plans/2026-06-21-samagra-os-e2.md`).

---

## 1. VERIFIED ENDPOINT CONTRACT

Route function names are noted because the pytest harness calls **functions directly**, not URLs.

| Route (fn) | Params | Live response shape (exact field names) | Delta vs api.md |
|---|---|---|---|
| `GET /api/overview` (`api_overview`) | — | `{ sources: [{ source, label, available, summary_json, n_artifacts, refreshed_at, summary }], refreshed_at }` | **Each source row carries BOTH `summary_json` (raw string) AND `summary` (parsed dict). api.md documents only `summary`.** `available` is `0|1`. |
| `GET /api/facets` (`api_facets`) | — | `{ sources: string[], kinds: string[], subjects: string[] }` | Match. |
| `GET /api/search` (`api_search`) | `q="", source=None, kind=None, limit=200` | `{ results: [{ uid, source, kind, title, subject, unit, chapter, status, path, url, updated_at, meta_json, meta }] }` | **Each result carries BOTH `meta_json` (raw string) AND `meta` (parsed dict). `meta_json` is an undocumented 13th key.** **Route default `limit=200`.** |
| `GET /api/questions` (`api_questions`) | `q="", subject=None, chapter=None, qtype=None, limit=50` | Happy: `{ results: [{ q_uid, slug, q_type, subject, chapter, difficulty, text }] }` | **`text` value is `text_projection` aliased to `text` — a snippet, not full text.** **TWO distinct empty bodies, both HTTP 200:** `{results:[], error:"QX source not present"}` (adapter absent) vs `{results:[]}` with **NO `error` key** (adapter present, `config.QX_BUILDER_DB` missing). |
| `GET /api/pipelines` (`api_pipelines`) | — | `{ pipelines: [{ pipeline, label, created, updated, current, phases: { <name>: { status, owner, gate, started, finished, artifacts, error } } }] }` | Match. **Always all 5 pipelines even with zero runs**; `started/finished/error` default `null`, `artifacts` `[]`. **`phases` is a Record keyed by phase NAME — iterate `Object.entries`.** |
| `GET /api/assignments` (`api_assignments`) | — | `{ assignments: [{ id, agent, outbox_path, pipeline, seed_ref, artifact_ref, expected_output, review_by, status, created_at, updated_at }], events: [{ id, ts, actor, verb, assignment_id, subsystem, subsystem_ref, note }] }` | Match field-for-field. **`assignments` = ALL rows, `ORDER BY created_at, id` (oldest-first), NO LIMIT.** **`events` = `ORDER BY id DESC` (newest-first), effective `LIMIT 200`.** `status` default `'queued'`. |
| `GET /open` (`open_file`) | `path, download=False` | `FileResponse`; `403` if not under an allowed root; `404` if missing. | `ALLOWED_ROOTS = [QX_ROOT, TEXTBOOK_ROOT, BOOKLETS_ROOT, INSP_ROOT, SIMS_ROOT, EXPORT_DIR]`. |
| `GET /lecture/{slug}` (`lecture_preview`) | `slug` | `HTMLResponse`; `404` on `FileNotFoundError`. | Lectures deep-link only. |
| `POST /api/gate/{pipeline}/{decision}` (`api_gate`) | path | success dict; **refused → HTTP `409` `{detail}`.** | E2 read-only; not in scope. |

**`GET /api/org` — DOES NOT EXIST.** Net-new E2 work. The SPA catch-all `@app.get("/{full_path:path}")`
(`spa`) is declared **LAST** and 404s any `full_path` starting with `api/`; the new route registers above it.
**SPA fallback returns HTTP 503** (`"frontend not built"`) when `frontend/dist/index.html` is absent, and
**`/assets` mount is conditional at import time** — build before serving; restart if the build lands late.

---

## 2. org.py ID-ALIGNMENT SET

Exact distinct worker-id strings from `state.PIPELINES[*].owners` (`samagra/state.py` L18–51):

```
['claude1', 'claude2', 'codex', 'gemini', 'human', 'notebooklm', 'teachingos']
```

**Seven distinct ids** (NOT 6). NO bare `claude` — the two Claude workers are `claude1`/`claude2`.
Per-pipeline owner map:

- **textbook**: draft=`codex`, enrich=`codex`, approve=`human`, export=`teachingos`
- **mycontentdev**: capture=`human`, enrich=`claude2`, review=`claude1`, publish=`human`
- **questions**: extract=`codex`, tag=`gemini`, verify=`claude2`
- **papers**: link=`claude2`, build=`teachingos`, finalize=`human`
- **media**: plan=`claude1`, generate=`notebooklm`, publish=`human`

**No org/chairman data exists in the backend.** No `org.py`; no founder/board/CEO registry anywhere in
`samagra/`. (The governance `board`/review tables are a verdict ledger with free-text `agent`/`reviewer`
columns — NOT an identity registry.) The only `deepak/bhardwaj` backend hit is a coincidental QuestionDB
URL default in `config.py:51`.

**The 'Deepak Bhardwaj chairman' name lives frontend-only**, hardcoded in
`frontend/src/lib/terminal/dispatch.ts`:
- `PROMPT = "deepak@samagra:~$"` (L20)
- `cmdAgents()` BOARD/WORKERS roster (L110–119)
- `whoami` → `"Deepak Bhardwaj — Founder & Chairman"` (L256)

**Verbatim frontend roster (`cmdAgents()`) — org.py reconciles to this:**

```
BOARD
  Deepak Bhardwaj    Founder & Chairman
  Claude-Deepak      CEO — substrate & engine
  Claude-Khanak      CTO — leaf apps & UX
  Codex              Reviewer — pre-merge gate
WORKERS
  Gemini+NotebookLM  Research & synthesis
  Grok               Real-time search
  Hermes             Kanban / scheduling
```

**Token ↔ display-name mismatch org.py must own:** owner ids are lowercase machine tokens; the roster uses
Title-Case display names. Not a clean 1:1 — roster has `Claude-Deepak/Claude-Khanak/Grok/Hermes` absent from
the owner set; owner set has `teachingos` + the `claude1`/`claude2` split absent from the roster;
`Gemini+NotebookLM` is one roster line but two owner ids. **The `claude1`/`claude2` mapping is OWNER-CONFIRMED
(2026-06-21): `claude1` = Claude-Deepak (CEO — substrate & engine), `claude2` = Claude-Khanak (CTO — leaf apps &
UX)** — org.py asserts this in `tests/test_api_org.py`.

---

## 3. NEW BACKEND WORK (org endpoint)

### Must build
**(a) `samagra/org.py`** — static module, no DB, no I/O. Exports one `ORG` dict (chairman + board + workers +
a `owners` token→identity map covering all 7 owner ids).
**(b) `GET /api/org`** in `samagra/api/app.py`, registered **above** the `spa` catch-all: `def api_org(): return ORG`.
**(c) pytest `tests/test_api_org.py`** — direct-call pattern (repo has zero TestClient usage; `@app.get` returns
the fn unchanged). org.py reads no path, so **no DB isolation needed**. Route-registration check:
`{r.path for r in api.app.routes}` must contain `/api/org`.

**conftest (the ONE autouse fixture every test inherits):**
```python
@pytest.fixture(autouse=True)
def isolate_data_db(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
    monkeypatch.setattr(config, "GOVERNANCE_DB", tmp_path / "governance.db")
```
Run from repo root: `python -m pytest` (`testpaths=["tests"]`, `addopts="-q"`; bare `import samagra` works
because pytest runs from repo root). **Rule for any future path-reading backend module:** read the path via
`config.<ATTR>` *at call time* (never cache at import) or it bypasses conftest isolation. org.py is exempt.

### Optional additive endpoints — ALL SKIP (YAGNI)
| Endpoint | Verdict | Rationale |
|---|---|---|
| `GET /api/dashboard` | **SKIP** | Dashboard already renders from `/api/overview` + static consts. |
| `GET /api/lectures` | **SKIP** | Render via `/api/search?source=textbook`; dedicated route duplicates search. |
| `GET /api/integrations` | **SKIP** | No backend integrations registry; org/board covered by `/api/org`. |
| `GET /api/activity` | **SKIP** | Activity renders from `events[]` already in `/api/assignments`. |

**Net new backend for E2 = `org.py` + `GET /api/org` + its test. Nothing else.**

---

## 4. FRONTEND APP TEMPLATE (exact)

**Registration: NOTHING to register.** `registry.ts` is `// DATA ONLY; frozen for E1` — no import paths.
All 17 `AppId`s already complete in `contracts.ts`, `registry.ts`, and `App.tsx` (`APP_DIR`). Resolution is one
generic runtime dynamic import (`App.tsx` L88–99):
```ts
const Comp = lazy(() =>
  import(`./apps/${dir}/index.tsx`).catch(() => ({ default: () => null })),
) as ComponentType;
```
> **Note (E2 fix, commit `7794f0f`):** the original `/* @vite-ignore */` was REMOVED. With it, Vite left every
> `apps/*/index.tsx` OUT of the production bundle — FastAPI-served windows rendered empty (only `npm run dev`
> worked). Dropping it lets Vite's dynamic-import-vars emit a lazy chunk per app. **Do NOT re-add it.**

**"append-only / one-app-per-PR" = CREATE one `frontend/src/apps/<Dir>/index.tsx` per PR — no edit to
`registry.ts` or `App.tsx`.** Folder name MUST equal `APP_DIR[id]` exactly (`pipelines→Pipelines`, `org→Org`,
`insp→Insp`, `sims→Sims`, `mycontentdev→Mycontentdev`, `munshi→Munshi`, `activity→Activity`). A forgotten
file fails **silently** (`.catch` renders an empty window).

**Shell props: NONE.** Render path (`App.tsx` L318–337): `const Body = appComponent(win.app)` then
`<Suspense fallback={null}><Body /></Suspense>` inside `WindowFrame`. **`<Body />` is invoked with ZERO
props.** All chrome (38px title bar, controls, accent ring, drag, resize, context menu) is `WindowFrame`'s.
To know its accent the app imports `{ APPS }` and reads `APPS['<id>'].accent`. Theme reaches the body ONLY via
`--samagra-*` CSS vars (Dashboard/Settings pattern) or `useStore(themeStore, s => s.theme)` from `'../../App'`
(Terminal pattern) — never as a prop.

**Data: `useApi`, NOT `ApiClient`.** Signature (`frontend/src/hooks/useApi.ts`):
```ts
export function useApi<T = unknown>(path: string): ApiState<T>
// ApiState<T> = { data: T | null; error: string | null; loading: boolean }
```
Raw `fetch(path)`, **GET-once-on-mount, abort-guarded**. Non-2xx → `error="HTTP <status>"`; thrown → `error=String(e)`;
both set `data:null, loading:false`. **No refetch, no POST, no param builder** — query strings must be baked
into `path` (the effect re-fires when `path` changes). `ApiClient` in `contracts.ts` is **dead code — nothing
imports it; do not route E2 through it.**

**State convention (from Dashboard) — defensive-render-always, NEVER early-return:**
- error: inline at top — `{error ? <div role="alert">{error}</div> : null}`; the rest still renders.
- loading: `aria-busy={loading}` on the content section — not a spinner / early return.
- empty/missing: defensive pure selectors over possibly-`null` `data`; type the payload with optional fields.

**Shared components** (`frontend/src/components/*.tsx`) all take `accent: string` + `style?`: `Pill`, `Card`
(r12), `Chip`, `IconButton` (28×28, requires `label`). Glyphs: `<Icon name="<id>" size label />` (24×24 stroke,
`currentColor`) wrapped in `<span style={{ color: V.accent }}>` — NEVER a letter badge; `<AppIcon app accent />`
for the gradient tile. `hexA(c,a)` exported from `components/icons-data`. **The dominant shipped pattern is
inline-styled divs driven by a `V` CSS-var object with `data-testid`** — E2 apps MAY import the leaf primitives
but inline-with-`data-testid` is what the 439-green suite expects.

**Canonical E2 data-app skeleton (verbatim):**
```tsx
// src/apps/Pipelines/index.tsx  (folder name MUST equal APP_DIR['pipelines'] = "Pipelines")
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
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
      {error ? <div role="alert" style={{ color: V.text }}>{error}</div> : null}
      <section data-testid="pipeline-grid" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {pipelines.map((p) => (
          <article key={p.pipeline} data-testid="pipeline-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 12, padding: 14 }}>
            <div style={{ color: V.text, fontWeight: 600 }}>{p.label}</div>
            {Object.entries(p.phases ?? {}).map(([name, ph]) => (
              <div key={name} data-testid="phase" style={{ color: V.muted }}>
                {name}: {ph.status}{ph.owner ? ` · ${ph.owner}` : ""}
              </div>
            ))}
          </article>
        ))}
      </section>
    </div>
  );
}
```
**FD rules:** drive every surface color from `--samagra-*`; accent-alpha via
`color-mix(in srgb, var(--samagra-accent) N%, transparent)`; the root `<div>` must NOT set `color` (jsdom
border-color assertions) — set `color` on text nodes. Only sanctioned hardcoded colors are the semantic
`STATUS`/`DIFFICULTY` named exports. `data-testid` on root + each grid/section + repeated rows.

---

## 5. TYPES + ApiClient DELTA

**Current `ApiClient` (verbatim, `contracts.ts` L33–38) — DEAD CODE:**
```ts
export interface ApiClient {
  overview(): Promise<unknown>;
  pipelines(): Promise<unknown>;
  assignments(): Promise<unknown>;
}
```
Nothing imports/implements it; all live fetches use `useApi<T>(path)` with the type at the call site. E2's real
deliverable is **exporting the shared response types** (and replacing Dashboard's inline duplicates). Exact
additions to `contracts.ts`, grounded in the verified shapes:

```ts
// ── Catalog / search (GET /api/search, /api/facets) ──────────────────────────
export interface SearchResult {
  uid: string; source: string; kind: string; title: string;
  subject: string | null; unit: string | null; chapter: string | null;
  status: string | null; path: string | null; url: string | null;
  updated_at: string | null;
  meta: Record<string, unknown>;     // parsed from meta_json
  meta_json?: string;                 // DELTA: raw string ALSO present on the wire
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
  summary_json?: string;             // DELTA: raw string ALSO present on the wire
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

// ── Org chart (GET /api/org — built in E2; shape mirrors samagra/org.py) ──────
export interface OrgPerson { id: string; name: string; role: string; }
export interface OrgChart {
  chairman: OrgPerson; board: OrgPerson[]; workers: OrgPerson[];
  owners: Record<string, { name: string; role: string }>;  // token -> identity (7 owner ids)
}
```

---

## 6. MISSING APP FILES (registry-vs-disk diff)

On disk: `Clock, Dashboard, Notes, Settings, Snake, Terminal` (6 of 17). **E2 creates these 11**
(`<Dir>/index.tsx`, folder = exact `APP_DIR` value, `export default function`). **Owners below follow the
AUTHORITATIVE division doc** (`2026-06-20-samagra-os-division.md` §E2/E3 forward-assignment) — the grounding
workflow's owner guess was corrected against it:

| File to create | AppId | Owner | Primary endpoint |
|---|---|---|---|
| `apps/Org/index.tsx` | `org` | **deepak** | `GET /api/org` |
| `apps/Pipelines/index.tsx` | `pipelines` | **deepak** | `GET /api/pipelines` |
| `apps/Lectures/index.tsx` | `lectures` | **deepak** | `GET /api/search?source=textbook&limit=200` |
| `apps/Mycontentdev/index.tsx` | `mycontentdev` | **deepak** | `GET /api/search?source=mycontentdev&limit=200` |
| `apps/Munshi/index.tsx` | `munshi` | **deepak** | `GET /api/search?source=munshi&limit=200` |
| `apps/Assignments/index.tsx` | `assignments` | **khanak** | `GET /api/assignments` (assignments[]) |
| `apps/Activity/index.tsx` | `activity` | **khanak** | `GET /api/assignments` (events[]) |
| `apps/Questions/index.tsx` | `questions` | **khanak** | `GET /api/questions` (+ `/api/facets`) |
| `apps/Booklets/index.tsx` | `booklets` | **khanak** | `GET /api/search?source=booklets&limit=500` |
| `apps/Insp/index.tsx` | `insp` | **khanak** | `GET /api/search?source=insp&limit=500` |
| `apps/Sims/index.tsx` | `sims` | **khanak** | `GET /api/search?source=sims&limit=2000` |

> The exact `source`/`kind` filter values should be confirmed against live `/api/facets.kinds` (distinct DB
> values can drift); `kind ∈ paper|chapter|booklet|exam|exam-set|sim` per `adapters/base.py`.

---

## 7. RISKS & GOTCHAS for E2

1. **Search/overview double-field (`meta_json`+`meta`, `summary_json`+`summary`):** both raw-string and
   parsed-dict on the wire. Type `meta`/`summary` as parsed dict; mark `*_json` optional; never re-parse.
2. **Questions has TWO empty shapes, both HTTP 200:** `{results:[], error:"QX source not present"}` vs
   `{results:[]}` with NO `error`. Treat `error` as **optional**; gate empty state on `results.length`. `text`
   is a **snippet/projection**, not full question text — label the UI accordingly.
3. **`in-review` is HYPHENATED** in `ASSIGNMENT_STATUS = {queued, running, in-review, approved, changes}`. The
   kanban column key is the literal `'in-review'`. The **`changes` 5th status is a real column** — render it.
4. **Two feeds, two orderings, one payload** (`/api/assignments`): `assignments[]` oldest-first, unbounded;
   `events[]` newest-first, capped 200. Kanban vs Activity must keep these reads distinct.
5. **creds/refresh-gated empty states (mcd / munshi):** catalog sources can be `available:0` until refreshed.
   Catalog apps + Munshi must render a graceful empty/"not available" state; `useApi` has no refetch.
6. **Registry append-only / one-app-per-PR is purely file-creation** — no edit to `registry.ts`/`App.tsx`. A
   forgotten file fails **silently** (empty window). Coordination risk is "did we create the file", not merge.
7. **`useApi` has no querystring builder** — bake params into `path`. Changing `path` re-fires the fetch.
8. **`/open?path=` allowed-roots:** file links must be under `ALLOWED_ROOTS` or `403`; missing → `404`. Use the
   catalog row's `path`/`url`, not arbitrary paths.
9. **`/api/gate` returns HTTP 409 on refusal** — read-only E2 doesn't call it, but note for any future control.
10. **Pipelines `phases` is a name-keyed Record** (varies per pipeline) — iterate `Object.entries`; `current`
    names the active phase key. All 5 pipelines always return.
11. **SPA fallback 503 if not built; `/assets` mount is import-time conditional** — build before serving;
    restart if the build lands late.
12. **Org three-copies risk:** the chairman roster lives only in `dispatch.ts`. Make `/api/org` the single
    source; the Org app fetches it. The `claude1`/`claude2` token mapping is OWNER-CONFIRMED: `claude1` =
    Claude-Deepak (CEO), `claude2` = Claude-Khanak (CTO) — asserted in `tests/test_api_org.py`.

**Net new for the org endpoint:** `samagra/org.py`, `GET /api/org` in `samagra/api/app.py`, `tests/test_api_org.py`.
