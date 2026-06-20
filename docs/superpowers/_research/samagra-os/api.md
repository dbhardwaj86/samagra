# SAMAGRA OS — Backend API audit for the GUI

> What data/endpoints already exist for the 17 SAMAGRA OS apps, and the minimal
> read-only contracts to add where they don't. Source of truth read in full:
> `samagra/api/app.py`, `samagra/portal/static/app.js`, `samagra/catalog.py`,
> `samagra/state.py`, `samagra/governance/store.py`, `samagra/scheduler.py`,
> `samagra/adapters/__init__.py` (+ every adapter, `config.py`, `clients/`).
> Date: 2026-06-20. All endpoints are mounted on the same FastAPI app under `/api/*`.

---

## 0. Quick orientation

- The portal is served by **one FastAPI app** (`samagra/api/app.py`, `app = FastAPI(...)`).
- **Two SQLite stores + JSON state**, by design (runbook D6):
  - `samagra.db` (`config.DATA_DB`) — REBUILDABLE catalog: `catalog`, `catalog_fts`
    (FTS5), `source_summary`, `refresh_meta`. Rebuilt from 8 read-only adapters.
  - `governance.db` (`config.GOVERNANCE_DB`) — DURABLE ledger: `assignments`,
    `events`, `review_overlay`. Never deleted.
  - `state/<pipeline>.orchestrator_state.json` — pipeline phase state machine
    (one JSON file per pipeline, 5 pipelines) + `state/tracker.txt`.
- **8 adapters** registered in `ALL_ADAPTERS`: `qx`, `textbook`, `booklets`,
  `insp`, `sims`, `questiondb`, `mycontentdev`, `munshi`. The catalog is at
  COARSE altitude (papers/chapters/booklets/exams/sims/seeds) — NOT individual
  questions. Fine-grained question search is served LIVE by the QX adapter against
  `builder.sqlite`, never indexed into the catalog (avoids duplicating ~67k rows).

---

## 1. EXISTING ENDPOINTS

| Method | Path | Response JSON shape (field names) | Powers today |
|---|---|---|---|
| GET | `/` | HTML (`portal.html` via Jinja2) | The whole jinja portal page (to be RETIRED → Vite `dist/`) |
| GET | `/lecture/{slug}` | HTML (rendered lecture) | Lecture preview window (opened in new tab) |
| GET | `/api/overview` | `{sources:[{source,label,available(int 0/1),summary_json,n_artifacts,refreshed_at, summary:{…per-adapter…}}], refreshed_at}` | Dashboard stat cards + sidebar counts |
| GET | `/api/facets` | `{sources:[str], kinds:[str], subjects:[str]}` | Filter dropdowns / facet chips |
| GET | `/api/search?q=&source=&kind=&limit=` | `{results:[{uid,source,kind,title,subject,unit,chapter,status,path,url,updated_at, meta:{…}}]}` | Lectures, Booklets, INSP, Sims, global search (all driven by `source=` filter) |
| GET | `/api/questions?q=&subject=&chapter=&qtype=&limit=` | `{results:[{q_uid,slug,q_type,subject,chapter,difficulty,text}]}` or `{results:[], error}` | Questions app (LIVE QX search, not the catalog) |
| GET | `/api/pipelines` | `{pipelines:[{pipeline,label,created,updated,current, phases:{<name>:{status,owner,gate(bool),started,finished,artifacts[],error}}}]}` | Pipelines app + gate buttons |
| GET | `/api/assignments` | `{assignments:[{id,agent,outbox_path,pipeline,seed_ref,artifact_ref,expected_output,review_by,status,created_at,updated_at}], events:[{id,ts,actor,verb,assignment_id,subsystem,subsystem_ref,note}]}` | Assignments app + Activity/events ledger |
| POST | `/api/refresh` | `{ok:true, totals:{<source>:int|null}}` | "↻ Refresh" — rebuilds catalog (null = that source failed, last-known-good kept) |
| POST | `/api/tick?dry_run=` | `{dry_run,log:[str],events:[str]}` | "▶ Run tick" — advances the scheduler once |
| POST | `/api/gate/{pipeline}/{decision}` | `{pipeline,gate,decision}` (200) or HTTP 409 `{detail}` | Approve/Reject a hard gate (`decision` ∈ approve\|reject) |
| GET | `/open?path=&download=` | `FileResponse` (binary) | "open" links — safe local-file opener, constrained to `ALLOWED_ROOTS` |

**Notes for the GUI:**
- `/api/overview` `summary` shape is **per-source and heterogeneous** (each adapter's
  `summary()` returns a different dict — see §3). The Dashboard already reads it; do
  NOT assume a flat shape.
- `/api/search` is the **one workhorse** behind Lectures, Booklets, INSP, Sims, and
  global search — it just changes `source=` and the column mapping client-side.
- `/api/questions` returns `{results:[], error:"QX source not present"}` (HTTP 200,
  not an error status) when QX is offline — the GUI must check `error` in-body.
- `/api/assignments` already returns BOTH assignments and the events ledger in one
  call. The Activity app can reuse `events` from here (no new endpoint needed).

---

## 2. PER-APP DATA COVERAGE (the 13 data/control apps)

Legend: **✅ exists** · **🟡 partial** (data exists but needs a thin new endpoint/derivation) · **❌ missing** (no backend → propose read-only contract).

### Dashboard — 🟡 partial
- **Have:** `/api/overview` (all stat numbers via `sources[].summary`),
  `/api/pipelines` (pipeline progress bars), `/api/assignments` (board + recent
  activity from `events`).
- **Gap:** The Dashboard wants *flat* headline numbers (artifacts / questions /
  chapters / sims / booklets / INSP). Today they're scattered across
  `sources[].summary` with per-adapter keys (`summary.questions`, `summary.chapters`,
  `summary.booklets`, `summary.sims`, `summary.sets`+`summary.papers`). Workable as-is
  (the current portal already does this client-side in `renderOverview`), but a
  flattened stats endpoint would remove fragile client glue.
- **Proposed (optional, additive):**
  - `GET /api/dashboard` →
    ```json
    {
      "stats": {"artifacts": int, "questions": int, "chapters": int,
                "sims": int, "booklets": int, "insp": int},
      "tests": {"label": "11/11 tests green", "ok": true},
      "pipelines": [ {pipeline, label, current, done, total} ],
      "recent_events": [ {ts, actor, verb, note} ]   // last N from events ledger
    }
    ```
  - Pure read-only aggregation over `catalog.overview()` + `state.all_states()` +
    `gstore.list_events(limit=N)`. No new tables.

### Pipelines — ✅ exists
- `GET /api/pipelines` returns all 5 pipelines with per-phase status/owner/gate.
- The README's 6-stage flow (Capture→Process→Draft→Review→Approve→Publish) is a
  **visual abstraction**; real phase names differ per pipeline (see §3). The GUI must
  map real phases → display stages, or render the real phases. Gate cell 🔒 = the
  phase with `gate:true`. Counts per stage are NOT in the payload (the phase has
  `artifacts:[str]` free-text, not numeric counts) — render status, not counts, or
  add counts to `/api/dashboard`.

### Assignments (kanban) — ✅ exists
- `GET /api/assignments` → `assignments[]` with `status` ∈
  `{queued, running, in-review, approved, changes}` (`ASSIGNMENT_STATUS` in
  `governance/store.py`). The 4 kanban columns map directly:
  Queued / Running / In-review / Approved (`changes` is a 5th status — fold into
  In-review or show as a flag). Each card: `id` (title), `agent` (avatar+name),
  `pipeline`/`seed_ref`/`artifact_ref` (category pill). No new endpoint.
- **Note:** governance.db ships empty until assignments are written; the kanban will
  be empty on a fresh DB. That's data-state, not an API gap.

### Org Chart — ❌ missing (no backend at all)
- **Searched:** no founder/board/CEO/COO/architect/worker data structure exists
  anywhere in `samagra/` — the only references are role *strings* in pipeline
  `owners` (`state.py`: `codex, claude1, claude2, gemini, teachingos, notebooklm,
  human`) and prose in docs. There is NO org/agent registry.
- **Source today:** the agent roster is implicit in two places:
  1. `state.PIPELINES[*].owners` — the set of worker identities that own phases.
  2. The CEO/COO worktree convention (claude-deepak, claude-khanak) — not in code.
- **Proposed READ-ONLY endpoint:**
  - `GET /api/org` →
    ```json
    {
      "founder": {"id":"founder","name":"…","title":"Founder"},
      "board":  [ {"id":"ceo","name":"…","title":"CEO"}, {"id":"coo",…}, {"id":"architect",…} ],
      "workers":[ {"id":"codex","name":"Codex","title":"…","reports_to":"architect"},
                  {"id":"claude2","name":"…","reports_to":"coo"}, … ]
    }
    ```
  - **Backing:** a static `samagra/org.py` dict (or `org.json`) — the org is small,
    slow-changing, and human-authored. `id`s should align with
    `state.PIPELINES[*].owners` so the chart and pipeline owners cross-link. No DB.

### Questions — ✅ exists
- `GET /api/questions?q=&subject=&chapter=&qtype=&limit=` (LIVE QX). Facets come from
  `/api/facets` (`subjects[]`) and the static `qtype` list already in the portal:
  `mcq_single, integer, numeric, mcq_multi, matrix_match, assertion_reason,
  comprehension, true_false`. Difficulty/exam pills come from the row's
  `difficulty` field. **Caveat:** no `exam` field in the question search result
  (only `q_uid,slug,q_type,subject,chapter,difficulty,text`) — the README's "exam"
  pill would need adding to the QX `search_index` SELECT if desired (additive).

### Lectures — ✅ exists
- `GET /api/search?source=textbook&limit=200`. Each row's `meta` has
  `{order, pdf, sections, slug}`, `status` ∈ textbook queue statuses
  (`drafted, in-review, approved, enriched, …`), `unit` = textbook unit.
- The README's **Thin / Thick** export columns are NOT in the catalog. Export
  artifacts live on disk at `build/lectures/<slug>/<slug>-{thin,thick}.html`
  (see `scheduler._run_pending_exports`, which checks `…-thick.html`).
- **Proposed (small additive endpoint) for export status:**
  - `GET /api/lectures` →
    ```json
    {"chapters":[{slug,title,unit,order,status,sections,
                  thin:{exists:bool,path}, thick:{exists:bool,path}}]}
    ```
  - Derive `thin/thick` by `Path(EXPORT_DIR/slug/f"{slug}-thin.html").exists()` etc.
    Read-only filesystem probe; reuse `/open?path=` to actually open the file.

### Booklets — ✅ exists
- `GET /api/search?source=booklets&limit=500`. `meta.folder` = relative folder.
  Open via `/open?path=`. The README's Theory/Workbook pill is NOT a backend field —
  derive client-side from folder/title, OR add `meta.kind: theory|workbook` to
  `booklets.py` (the adapter currently sets only `meta.folder`). Minor adapter
  enrichment, not a new endpoint.

### INSP / Olympiad — ✅ exists
- `GET /api/search?source=insp&limit=500`. Rows are `kind:"exam-set"` (a folder,
  `meta.pdfs` = count) or `kind:"exam"` (a single pdf). Summary pills
  (`sets`, `papers`) come from `/api/overview` → `sources[insp].summary`.

### Simulations — ✅ exists
- `GET /api/search?source=sims&limit=2000`. `subject` + `meta.grade` per row;
  open the `.html` via `/open?path=`. Subjects derived client-side (current portal
  builds the subject filter from the result set). The README's gradient thumbnail
  is pure presentation. Count via `/api/overview` → `sources[sims].summary.sims`.

### mycontentdev — ✅ exists (when creds present)
- `GET /api/search?source=mycontentdev&limit=…`. Rows = editorial seeds: `kind` =
  seed type (`concept, question, snippet, simulation_idea, experiment,
  notebooklm_link, rough_idea`), `status` ∈ (`captured, needs_processing,
  processing, draft_ready, changes_requested, approved, brief_generated,
  content_linked, done, archived`), `url` → `{api}/seed/{id}`, `meta.seedId`.
- **Caveat:** only appears in the catalog after `/api/refresh` AND when
  `MCD` creds are set (`clients/mcd_client.py`, `available()` checks env). When
  unavailable the source is absent from results / shows `available:0` in overview.

### Munshi — ✅ exists (when creds present)
- `GET /api/search?source=munshi&limit=…`. Rows = front-desk library items:
  `kind` ∈ (`note, todo, issue, question, followup`), `status` ∈ (`open,
  claimed_done, validated, dismissed` — dismissed filtered out),
  `meta` = `{payload, tags, person, due}`. Requires `MUNSHI_API_URL` +
  `MUNSHI_SECRET` (`clients/munshi_client.py`).
- **Caveat:** same as mcd — present only post-refresh with creds. The README's
  Munshi app has a live capture input + mic FAB (writes); the backend adapter is
  **read-only/intake-only** — capture/write is OUT of scope for E2 (no write
  endpoint exists, and the decided scope is additive read-only).

### Activity — ✅ exists (reuse)
- The events timeline is already in `/api/assignments` → `events:[{ts,actor,verb,
  assignment_id,subsystem,subsystem_ref,note}]` (newest-first, `LIMIT 200`).
  No new endpoint needed; the Activity app can call `/api/assignments` and render
  `events`, OR a thin alias `GET /api/activity` → `{events:[…]}` if you want a
  dedicated route (pure passthrough to `gstore.list_events`).

### Settings — 🟡 partial
- **Theme/device:** PURELY client-side (Zustand theme/device store + localStorage,
  per the linchpin decision). No backend.
- **Integrations status rows** (active / needs-creds pills): derivable from
  `/api/overview` → each `sources[].available` (0/1) already tells you which
  subsystems are live vs need creds. A dedicated endpoint is optional:
  - `GET /api/integrations` →
    ```json
    {"integrations":[{id, label, available:bool, detail}]}
    ```
    one row per adapter (`available()` + a short detail like the env var name).
    Pure read-only over `ALL_ADAPTERS`. Otherwise reuse `/api/overview`.

---

### Summary table — app → endpoint

| App | Status | Endpoint(s) | New work |
|---|---|---|---|
| Dashboard | 🟡 | `/api/overview` + `/api/pipelines` + `/api/assignments` | optional `/api/dashboard` aggregator |
| Pipelines | ✅ | `/api/pipelines` | none (counts optional) |
| Assignments | ✅ | `/api/assignments` | none |
| Org Chart | ❌ | — | **`/api/org`** backed by static `org.py` |
| Questions | ✅ | `/api/questions` (+ `/api/facets`) | optional `exam` field in QX SELECT |
| Lectures | ✅ | `/api/search?source=textbook` | optional `/api/lectures` for thin/thick export status |
| Booklets | ✅ | `/api/search?source=booklets` | optional theory/workbook pill in adapter |
| INSP | ✅ | `/api/search?source=insp` (+ overview summary) | none |
| Simulations | ✅ | `/api/search?source=sims` | none |
| mycontentdev | ✅ | `/api/search?source=mycontentdev` | none (needs creds + refresh) |
| Munshi | ✅ | `/api/search?source=munshi` | none read-only (capture/write = out of scope) |
| Activity | ✅ | `/api/assignments` → `events` | optional `/api/activity` alias |
| Settings | 🟡 | `/api/overview` (integrations) | theme/device client-only; optional `/api/integrations` |

**Apps with ZERO backend dependency (E1, fully client-side, localStorage only):**
Terminal, Clock, Notes/To-dos, Snake — no endpoints. (Terminal `status/catalog/
agents/pipelines` commands *may* call `/api/overview` / `/api/pipelines` / `/api/org`
if you want live output, but can also be canned.)

---

## 3. EXACT CATALOG / GOVERNANCE / STATE DATA AVAILABLE

### Dashboard headline numbers — where each comes from (`/api/overview` → `sources[]`)

The numbers in the README (7,044 artifacts, 67,276 questions, 59 chapters,
1,554 sims, 11 booklets, 136 INSP) are **design placeholders**; the LIVE numbers
come from each adapter's `summary()` (and `n_artifacts`), recomputed on
`/api/refresh`:

| Dashboard stat | Live source | Field path in `/api/overview` |
|---|---|---|
| Artifacts (total) | sum of `n_artifacts` across sources | `Σ sources[].n_artifacts` |
| Questions | QX content DB `count(*) from questions` | `sources[qx].summary.questions` |
| Papers (QX docs) | QX `count(*) from documents` | `sources[qx].summary.documents` |
| Chapters | textbook queue length | `sources[textbook].summary.chapters` |
| Chapters by status | `Counter(status)` over queue | `sources[textbook].summary.by_status` (dict) |
| Units | distinct textbook units | `sources[textbook].summary.units` |
| Sims | count of `*.html` under any `sims/` dir | `sources[sims].summary.sims` |
| Booklets | count of `*.pdf` under booklets root | `sources[booklets].summary.booklets` |
| INSP sets / papers | INSP folders vs loose pdfs | `sources[insp].summary.sets` / `.papers` |
| QX subjects breakdown | `group by coalesce(ov_subject,subject)` | `sources[qx].summary.subjects` (dict subj→count) |
| QuestionDB (online) | stub | `sources[questiondb].summary.status` / `.url` |
| Refreshed-at | catalog `refresh_meta` | top-level `refreshed_at` |

> So the Dashboard's 6 hero stats = `Σ n_artifacts`, `qx.summary.questions`,
> `textbook.summary.chapters`, `sims.summary.sims`, `booklets.summary.booklets`,
> `insp.summary.sets + insp.summary.papers`. The mcd/munshi sources contribute to
> `n_artifacts` only when their creds are set and a refresh has run.

### Pipelines + phases (from `state.PIPELINES`, served by `/api/pipelines`)

5 pipelines, each with ordered phases, gate phases, and per-phase owner:

| pipeline | label | phases | gates | owners |
|---|---|---|---|---|
| `textbook` | Lectures (textbook) | draft → enrich → approve → export | approve | codex, codex, human, teachingos |
| `mycontentdev` | Editorial (mycontentdev) | capture → enrich → review → publish | review, publish | human, claude2, claude1, human |
| `questions` | Question corpus (QX) | extract → tag → verify | — | codex, gemini, claude2 |
| `papers` | Booklet-linked papers | link → build → finalize | finalize | claude2, teachingos, human |
| `media` | Media (audio/decks/images) | plan → generate → publish | publish | claude1, notebooklm, human |

Phase status ∈ `VALID_STATUS = {pending, in_progress, awaiting_gate, done,
failed, blocked}`. Each phase object: `{status, owner, gate, started, finished,
artifacts:[str], error}`. `current` = first non-`done` phase.

### Assignments + events (governance.db, `/api/assignments`)

- **`assignments`** columns: `id, agent, outbox_path, pipeline, seed_ref,
  artifact_ref, expected_output, review_by, status, created_at, updated_at`.
  `status` ∈ `{queued, running, in-review, approved, changes}`.
  Ordered by `created_at, id`.
- **`events`** (ledger, newest-first, `LIMIT 200`): `id, ts, actor, verb,
  assignment_id, subsystem, subsystem_ref, note`.
- **`review_overlay`** (NOT exposed by any endpoint yet): `id, subsystem,
  subsystem_ref, artifact_uid, reviewer, verdict ∈ {approved,changes}, rationale, ts`.
  If a future "review" view is wanted, add `GET /api/reviews` → `list` over this
  table (read-only; the table already exists).

### Org structure source — **none in code**
- No org/agent registry exists. The only machine-readable agent identities are the
  **owner strings** in `state.PIPELINES[*].owners`:
  `{codex, claude1, claude2, gemini, teachingos, notebooklm, human}`.
- Recommendation: author a static `samagra/org.py` (founder → board → workers,
  `id`s aligned to those owner strings) and expose via `GET /api/org` (§2). This is
  the single biggest *content* gap (vs. an infra gap).

### `/open` allowed roots (file opener safety)
`ALLOWED_ROOTS = [QX_ROOT, TEXTBOOK_ROOT, BOOKLETS_ROOT, INSP_ROOT, SIMS_ROOT,
EXPORT_DIR]`. Any open link the GUI builds must point inside one of these or it
returns 403.

---

## 4. HOW FASTAPI SERVES THE PORTAL TODAY (and how to swap in Vite `dist/`)

Current wiring in `samagra/api/app.py`:

```python
PORTAL = Path(__file__).resolve().parent.parent / "portal"   # samagra/portal
app.mount("/static", StaticFiles(directory=str(PORTAL / "static")), name="static")
templates = Jinja2Templates(directory=str(PORTAL / "templates"))

@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(request, "portal.html", {"version": ...})
```

- The page is a **Jinja2 template** (`samagra/portal/templates/portal.html`) +
  static assets mounted at **`/static`** (`app.js`, `style.css`). This entire
  `portal/` tree is the RETIRED stack (kept in git history).
- Server runs on `127.0.0.1:8799` (`config.HOST` / `config.PORT`).

**Swap plan for the Vite build (decided stack):**
1. New `frontend/` app (its own `package.json`) builds to `frontend/dist/`.
2. Replace the Jinja `index` route + `/static` mount with serving the built bundle:
   - Mount the hashed assets: `app.mount("/assets", StaticFiles(directory=DIST/"assets"))`
     (Vite emits hashed files under `dist/assets/`).
   - Serve `dist/index.html` at `/` (and as the SPA fallback for non-`/api`,
     non-`/open`, non-`/assets` paths so client-side routing/deep links work):
     ```python
     DIST = config.REPO_ROOT / "frontend" / "dist"
     app.mount("/assets", StaticFiles(directory=str(DIST / "assets")), name="assets")

     @app.get("/")
     def index():
         return FileResponse(str(DIST / "index.html"))
     # optional SPA catch-all (register AFTER /api, /open, /lecture, /assets):
     @app.get("/{full_path:path}")
     def spa(full_path: str):
         return FileResponse(str(DIST / "index.html"))
     ```
3. **Keep `/api/*`, `/open`, `/lecture/{slug}` exactly as-is** — they are the
   contract. Drop `Jinja2Templates` + the `/static` mount + `portal/`.
4. **Dev:** run Vite dev server (its own port), proxy `/api` → FastAPI `:8799`
   (Vite `server.proxy` config). Also proxy `/open` and `/lecture` so links work in
   dev. FastAPI stays the single prod origin.
5. **Ordering caveat:** a catch-all `GET /{full_path:path}` must be registered
   LAST (after every real route) or it will shadow `/api/*`. Safer: only fall back
   for paths that don't start with `api/`, `open`, `lecture`, `assets`.

---

## SIX-LINE SUMMARY — biggest gaps

1. **Org Chart has NO backend** — no founder/board/worker registry exists anywhere; only owner *strings* in `state.PIPELINES[*].owners`. Needs a new static `samagra/org.py` + `GET /api/org`. This is the single hard gap.
2. **No flat Dashboard stats endpoint** — the 6 hero numbers are scattered across heterogeneous per-adapter `summary` dicts in `/api/overview`; works but fragile. Optional `GET /api/dashboard` aggregator removes client glue.
3. **Lectures thin/thick export status isn't in the catalog** — export HTML lives on disk (`build/lectures/<slug>/<slug>-{thin,thick}.html`); needs a small `/api/lectures` filesystem-probe endpoint for the Thin/Thick columns.
4. **Questions search lacks an `exam` field** (only `q_uid,slug,q_type,subject,chapter,difficulty,text`) and **Booklets lacks a theory/workbook field** — both are minor additive enrichments to existing adapters, not new endpoints.
5. **mcd / munshi are creds-gated AND refresh-gated** — they only appear in `/api/search` after `/api/refresh` runs with env creds set; the GUI must handle empty/absent sources gracefully (and Munshi's write-capture UI has no backend write endpoint — read-only only, out of scope).
6. **Swapping the portal is clean** — `/api/*`, `/open`, `/lecture/{slug}` are a stable contract; only the Jinja `index` route + `/static` mount + `portal/` get replaced by serving `frontend/dist/` (mount `/assets`, serve `index.html` at `/` + SPA fallback registered last), with Vite proxying `/api` in dev.
