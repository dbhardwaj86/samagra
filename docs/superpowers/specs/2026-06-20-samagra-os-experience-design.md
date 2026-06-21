# SAMAGRA OS — Experience Track Design Spec

> **Status:** Design artifact (no code). Authored 2026-06-20.
> **Decision basis:** approved "SAMAGRA OS" direction + extracted hi-fi design handoff.
> **Inputs read:** `docs/superpowers/_research/samagra-os/{api,proto,conventions,repo}.md`
> and the design handoff README at
> `C:\Users\abc\AppData\Local\Temp\webos_design\design_handoff_samagra_os\README.md`
> (+ the `SAMAGRA OS.dc.html` prototype it documents; `support.js` is NOT ported).
>
> This spec is the **what + why + where**. The phased, paste-ready **how** lives in the
> companion implementation plan (mirrors `docs/superpowers/plans/2026-06-19-samagra-evolution.md`).

---

> **⚠ Coherence note (OPEN — added 2026-06-21 by a coherence audit; owner has not yet ratified).**
> This spec re-adopts "OS" as the product metaphor, but the **2026-06-19 evolution spec deliberately
> *retired* the word "OS"** — *"it silently licenses OS-sized scope"* — and bound SAMAGRA to an
> **attention-ROI north-star + a kill-criterion** (freeze if not saving the owner ~3 hrs/wk by Phase 2). An
> independent **Codex vision review (verdict DRIFTING)** and a **multi-agent implementation audit (verdict
> COHERENT-WITH-CAVEATS)** found this track *half-reconciles* the reversal (it argues §1's "honest shape of the
> work" and firewalls write paths) but **never restates the attention-ROI metric or the kill-criterion**, and
> parks the value-producing active loop while OS chrome (3 themes, a Snake game, mobile mode) grows; the "frugal"
> value sits unaddressed. **Recommended (PROPOSED, not ratified):** (1) frame SAMAGRA OS as a *bounded operator
> console / UI-metaphor only* — no app-platform scope; (2) restate the attention-ROI north-star + ~3 hrs/wk
> kill-criterion as still binding (data source = the governance `events`/`review_overlay` ledger); (3) add a
> scope firewall to §3 non-goals (no entertainment apps beyond E1's Snake, no third-party apps/marketplace, no
> process-scheduler model, no user-facing identity); (4) add an attention-ROI acceptance gate before E3; (5) give
> Phase 3 a dated restart commitment after the E2 visual-QA pass. Full write-up: `HANDOFF.md` → *Direction-coherence
> finding (OPEN)*; reviews in `docs/superpowers/_research/samagra-os/_vision-review-output.md`.

## 1. Overview & goal

**SAMAGRA OS** is a desktop-and-mobile, operating-system-style GUI that becomes the
**control plane** for SAMAGRA — the agentic JEE/NEET physics content operation. It replaces
the retired Jinja portal with a windowing-metaphor shell: a top bar / dock, free-floating
draggable-resizable windows, and 17 apps that surface the company's real data (catalog,
pipelines, agent org, content libraries) alongside first-class OS utilities (Clock, Notes/
To-dos, Snake, Terminal).

**Goal of this track:** ship a faithful, testable recreation of the extracted hi-fi prototype
as a **React 18 + TypeScript + Vite** app in a new `frontend/` at the repo root, served in
production by the existing FastAPI control plane, with **all real behavior pushed into pure,
headlessly-testable TypeScript modules** (the *linchpin*). The GUI is the **new immediate
priority**; the backend "active loop" is parked (kept planned, deprioritized).

Why an OS metaphor: the operation is genuinely multi-app and multi-agent (a board of agents
owns pipelines and gates), so a windowing control plane — multitasking, a live org chart, a
terminal that mutates global state, kanban + activity ledgers — is the honest shape of the
work, not skeuomorphic decoration.

**Non-relitigated ground truth (decided elsewhere):** project = SAMAGRA (Python + FastAPI);
stack = React 18 + TS + Vite in `frontend/`; Zustand stores; lucide-react; Vitest + RTL +
jsdom; fonts Inter / Hanken Grotesk / JetBrains Mono / Tiro Devanagari Hindi; the jinja
`samagra/portal/` is retired (kept in git history); two agents own disjoint worktrees; the
advisory Codex pre-commit gate is active.

---

## 2. Scope — E1 / E2 / E3 phasing

The 17 apps split across three phases. **E1 is the immediate build.** Each phase ends on a
full green gate before the next begins.

| Phase | Theme/device surface | Apps delivered | Backend dependency | Status |
|---|---|---|---|---|
| **E1 — Shell + Aqua + OS utilities** | `aqua` theme only; `pc` device only | **Shell** (top bar + Dock + window frame + context menu + work-area), **Dashboard**, **Settings**, **Terminal**, **Clock**, **Notes/To-dos**, **Snake** | Dashboard/Settings read existing `/api/*`; Terminal optional live; Clock/Notes/Snake = **zero backend** (localStorage only) | **IMMEDIATE** |
| **E2 — Data/control apps** | (still aqua/pc) | **Pipelines**, **Assignments** (kanban), **Org Chart**, **Questions**, **Lectures**, **Booklets**, **INSP/Olympiad**, **Simulations**, **mycontentdev**, **Munshi** (read-only), **Activity** | Wired to existing backends; reuse `/api/search`, `/api/pipelines`, `/api/assignments`, `/api/questions`; **one genuinely new endpoint: `/api/org`** (+ optional aggregators) | Planned |
| **E3 — Console + Samagra themes + mobile** | `console` + `samagra` themes; `mobile` device mode | (no new apps — all 17 re-skinned + mobile-framed) | none new (theme/device are client-only) | Planned |

**E1 app inventory (exact, from the prototype `APPS` map):**

| id | name | accent | default w×h |
|---|---|---|---|
| `dashboard` | Dashboard | `#4f46e5` | 940×610 |
| `settings` | Settings | `#475569` | 760×580 |
| `terminal` | Terminal | `#10b981` | 740×480 |
| `clock` | Clock | `#0ea5e9` | 560×640 |
| `notes` | Notes | `#f59e0b` | 840×600 |
| `snake` | Snake | `#22c55e` | 480×680 |

Min window size **360×280**. Aqua chrome: top bar **30px**, Dock bottom-center radius 20,
window radius 13, traffic-light controls on the **left**.

---

## 3. Non-goals

- **No new write paths.** Every backend touch in E2 is **read-only**. Munshi's prototype has a
  live capture input + mic FAB; the backend adapter is **intake/read-only** and there is **no
  write endpoint** — capture/write is explicitly out of scope. The human publish gate stays the
  only sacred, never-automated mutation.
- **The active loop stays parked.** Former Phase 3 of `docs/superpowers/plans/2026-06-19-samagra-evolution.md`
  (autonomous active loop) remains planned but deprioritized. This track does not build, schedule,
  or wire it. `scheduler.py` is kept (SAMAGRA reuses it) but no new tick is installed.
- **No pixel-fidelity gate in either agent loop.** Visual/pixel parity is a **separate human QA
  pass** (§9), not a loop completion signal.
- **No second SQLite store, no schema migrations** beyond what already exists. The catalog
  (`samagra.db`) and governance ledger (`governance.db`) stay as-is (runbook D6). New read
  endpoints aggregate existing data; the only new *content* is a static `org.py`.
- **No port of `support.js`** (the prototype's custom render runtime) and no port of the
  prototype's single-component architecture — it is read as a spec, rebuilt idiomatically.
- **No theme/device beyond E1's aqua/pc until E3.** Token maps for console/samagra are authored
  forward-compatibly but not surfaced in E1.

---

## 4. Architecture

### 4.1 The `frontend/` app + FastAPI serving

A new top-level `frontend/` (its own `package.json`, **beside** `samagra/`, never inside it —
`samagra/` is a Python wheel package). React 18 + TS + Vite. Vite builds to `frontend/dist/`.

**Production seam (decided — Option A, SPA fallback):** FastAPI retires the Jinja `index`
route + the `/static` mount + `Jinja2Templates`, and instead:
- mounts Vite's hashed assets: `app.mount("/assets", StaticFiles(directory=DIST/"assets"))`;
- serves `dist/index.html` at `/` via a `GET /{full_path:path}` **SPA catch-all declared LAST**
  (after every `/api/*`, `/lecture/{slug}`, `/open` route) so client-side window state and deep
  links resolve and the API is never shadowed.
- `FRONTEND_DIST = config.REPO_ROOT / "frontend" / "dist"` (REPO_ROOT already exists).

**Dev seam:** Vite dev server on `:5173` proxies `/api`, `/lecture`, `/open` → FastAPI
`127.0.0.1:8799` (`server.proxy`). Two terminals: `samagra serve` (uvicorn) + `npm run dev`.
Prod is a single origin (no proxy, no CORS).

**`/api/*`, `/lecture/{slug}`, `/open` are a frozen contract** — unchanged by this track.

### 4.2 The LINCHPIN — pure TypeScript logic modules

The architectural keystone: **all real behavior lives in pure TS modules with zero React
imports**, unit-tested **headlessly** under Vitest (most with no DOM at all). React components
are **thin visual wrappers** that call these modules and render their output. This makes the
bulk of every app loop-completable on a deterministic green signal; visual fidelity is a
separate human pass.

Each module below is headlessly testable because its inputs and outputs are **plain data**
(rects, arrays, numbers, strings) — no DOM, no timers-as-truth (timers are injected/faked),
no network. The exact values to assert against are the verbatim prototype constants captured in
`proto.md`.

| Pure module | Owns | Why headlessly testable (assertion targets) |
|---|---|---|
| `lib/wm/geometry.ts` | `workArea(theme,vw,vh)`, `openRect()` (cascade `+34x/+30y` wrap-6, clamp), `clampDrag` (x≥0, y≥barH), `clampResize` (≥360×280), `maximizeRect`/`restore`, `reclampOnThemeChange` (8px inset), `tile` (cols=⌈√n⌉, gap 12, rounded rects) | Pure rect math over `(theme, vw, vh, windows[])`; assert exact px (aqua workArea `{8,36,vw-16,vh-122}`, min `360×280`, cascade offsets) — no DOM |
| `lib/wm/zorder.ts` | monotonic `z` counter (init **20**), `focus(id)→z+1`, `active = max-z non-min` | Pure array sort/reduce over `{id,z,min}`; assert top-window id |
| `lib/snake/engine.ts` | grid **19×19**, `init/dir(no-reverse)/step(eat/grow/death)/food(reject-resample)`, level table (relaxed 215→135/−2, normal 135→70/−3), scoring (10/food), speed ramp | Pure reducer `(state, input)→state` with **injected RNG** for food; assert death cases, no-reverse guard, grow-vs-trim, speed floor — no canvas, no interval |
| `lib/snake/cell.ts` | responsive `cell` formula (`clamp(11,28, floor(min(availW,availH)/19))`, board px) | Pure arithmetic over `{w,h}`; assert cell at default (18) + bounds |
| `lib/clock/analog.ts` | hand angles (`secA=s*6`, `minA=m*6+s*0.1`, `hrA=(hr%12)*30+m*0.5`), tick/numeral geometry, endpoints | Pure trig over a `Date`; assert angles + SVG coords (300×300, R=120) |
| `lib/clock/stopwatch.ts` | drift-free elapsed (wall-anchor `start=now-elapsed`), lap splits, `fmtMs` | Pure over an injected `now()`; assert elapsed/splits with a fake clock — no real 33ms interval |
| `lib/clock/timer.ts` | remaining math, ring `frac`/`dashoffset` (C=2π·110), preset table (1/5/10/25 min), done detection | Pure over injected `now()`; assert remaining, ring offset, "Time!" boundary |
| `lib/clock/world.ts` | zone table (6 zones, exact order), day/night rule (day = 06:00–18:59 local) | Pure over `Intl` + injected hour; assert ☀/☾ per hour |
| `lib/terminal/parser.ts` | tokenize (split `/\s+/`, `c0` lower, `args`), `clear` special-case, empty-echo | Pure string→tokens; assert parse of each command line |
| `lib/terminal/dispatch.ts` | command table (help/status/catalog/agents/pipelines/ls/open/theme/device/neofetch/whoami/date/echo/about/sudo/clear/unknown), `open`-name resolution vs `ORDER` ids + single-word names, line-class tagging (`in/fg/dim/accent/ok/err`) | Pure `(line, ctx)→{lines[], effects[]}` where effects (`openApp`/`setTheme`/`setDevice`) are **returned, not executed**; assert output lines + effect intents — no global mutation |
| `lib/notes/model.ts` | note/todo CRUD (`newNote/updNote(ts re-stamp)/delNote`, `addTodo/toggle/del/clearDone`), title-display + word-count + preview derivations, filters (all/active/done), seed-on-first-run | Pure array transforms; assert CRUD results, derived title/word-count, filtered lists, exact seed objects |
| `lib/persistence.ts` | typed `load<T>(key, fallback)` / `save<T>(key, v)` over the 4 keys (`samagra.{notes,todos,snake.best,snake.level}`), defensive parse (`Array.isArray` guard, level validation → `normal`) | Pure over an **injected Storage** (or jsdom localStorage); assert round-trip + fallback on corrupt JSON |
| `lib/registry.ts` (data) | `APPS` map (17 id→{name,accent,w,h}) + `ORDER` array + mobile favorites | Pure constant table; assert shape/values match `proto.md` exactly |

> Rationale recap: the hard, bug-prone logic (window clamp math, snake death/grow, drift-free
> stopwatch, terminal dispatch, notes seed/derivations, localStorage parse guards) is exactly
> the code that benefits most from red-green TDD and exactly the code a loop can verify without
> a human looking at pixels. Keeping it in `lib/` with injected RNG/clock/storage makes every
> assertion deterministic.

### 4.3 State stores (Zustand)

Thin stores that hold state and delegate math to `lib/`:
- **`stores/windowManager.ts`** — `windows[]` (`{id,app,x,y,w,h,z,min,max,prev}`), `z`,
  `openApp/closeApp/focus/move/resize/minimize/toggleMax/tile`. Geometry/z-order delegated to
  `lib/wm/*`. Device branch (mobile → single `mobileApp`) lives here.
- **`stores/theme.ts`** — `theme` (`aqua|console|samagra`), `device` (`pc|mobile`),
  `setTheme` (triggers WM re-clamp via `lib/wm/geometry.reclampOnThemeChange`), `setDevice`.
- Per-app ephemeral state (clock tab, sw/timer, snake, notes selection/filters) lives in small
  per-app stores or local state, each backed by the relevant `lib/` module + `lib/persistence`.

### 4.4 Tokens / themes

`themes/` holds the `THEMES` token maps verbatim from `proto.md` §6 (aqua authored for E1;
console + samagra authored forward-compatible for E3, surfaced later). Each theme carries
`kind/dockPos/controlSide/barH/(rail)/winRadius/bg/winBg/bar/text/muted/line/cardBg/subBg/
accent/accent2/shadow/dock*/font/wordmark`. Terminal palette (`termPalette`) and semantic/
status colors (success `#16a34a`, danger `#ef4444`, difficulty Easy/Med/Hard) are tokenized
once and shared. The aqua workArea/barH constants are consumed by `lib/wm/geometry.ts` so the
chrome and the math never drift.

### 4.5 Icons / fonts

- **Icons:** `lucide-react` (the README confirms many prototype paths are Lucide-derived:
  clock, gamepad-2, file-text, …). 24×24 line icons, stroke ~1.9, round caps.
- **Fonts (Google Fonts, loaded in `index.html`):** Inter (400–700), Hanken Grotesk (400–800),
  JetBrains Mono (400–500), Tiro Devanagari Hindi (400). Aqua uses Inter (wordmark Inter);
  console wordmark JetBrains Mono; samagra body Hanken Grotesk, wordmark Tiro Devanagari Hindi
  (समग्र).
- **No raster assets.** Timer chime is generated at runtime via WebAudio (880Hz sine,
  try/catch graceful no-op).

---

## 5. Codebase placement

```
TeachingOS/
├─ samagra/                      # Python/FastAPI — unchanged except the serve seam
│  ├─ api/app.py                 # retire jinja index + /static; mount dist/assets; SPA fallback last
│  ├─ org.py                     # NEW (E2): static founder→board→workers registry (backs /api/org)
│  └─ portal/                    # RETIRED — route removed, kept in git history
├─ frontend/                     # NEW React 18 + TS + Vite app (own package.json)
│  ├─ package.json               # deepak bootstrap (single source — see §8)
│  ├─ vite.config.ts             # build outDir=dist, dev proxy, Vitest (jsdom) config
│  ├─ tsconfig.json (+ tsconfig.node.json)
│  ├─ index.html                 # Vite entry; fonts; #root
│  ├─ dist/                      # build output (gitignored) — FastAPI serves this
│  └─ src/
│     ├─ main.tsx                # mount point
│     ├─ App.tsx                 # top shell stub (imports WM + theme stores)
│     ├─ types/
│     │  └─ contracts.ts         # AppId union, AppMeta, WindowState, Theme/Device, ApiClient
│     ├─ os/                     # OS-level wiring (work-area, keyboard gating, interval hygiene)
│     ├─ shell/                  # TopBar, Dock, WindowFrame, ContextMenu, (E3: Taskbar/Rail)
│     ├─ store/                  # windowManager + theme/device Zustand stores
│     ├─ themes/                 # THEMES token maps (aqua E1; console/samagra forward-compat)
│     ├─ lib/                    # THE LINCHPIN — pure, headlessly-tested modules (§4.2)
│     │  ├─ wm/{geometry.ts,zorder.ts}
│     │  ├─ snake/{engine.ts,cell.ts}
│     │  ├─ clock/{analog.ts,stopwatch.ts,timer.ts,world.ts}
│     │  ├─ terminal/{parser.ts,dispatch.ts}
│     │  ├─ notes/model.ts
│     │  ├─ persistence.ts
│     │  └─ registry.ts          # APPS map + ORDER + mobile favorites (data)
│     ├─ apps/
│     │  ├─ Dashboard/           # E1
│     │  ├─ Settings/            # E1
│     │  ├─ Terminal/            # E1 (thin wrapper over lib/terminal)
│     │  ├─ Clock/               # E1 (thin wrapper over lib/clock)
│     │  ├─ Notes/               # E1 (thin wrapper over lib/notes + persistence)
│     │  ├─ Snake/               # E1 (thin wrapper over lib/snake)
│     │  └─ <E2 apps…>           # Pipelines, Assignments, Org, Questions, Lectures, Booklets,
│     │                          # INSP, Sims, mycontentdev, Munshi, Activity
│     ├─ components/             # shared leaf UI (Pill, Card, Chip, IconButton)
│     ├─ hooks/                  # useInterval, useLocalStorage wrapper, useWindowRect
│     └─ test/setup.ts           # jsdom + RTL setup
├─ pyproject.toml
└─ .gitignore                    # ADD node_modules/, frontend/dist|.vite|coverage, *.tsbuildinfo
```

> Note: the research `repo.md` names some store/lib files at slightly different paths (e.g.
> `src/stores/` vs `src/store/`, `lib/persistence.ts` at top of `lib/`). The companion
> implementation plan's **Shared Contracts** block freezes the exact final paths verbatim; the
> tree above is the canonical intent and the plan is authoritative on the literal strings.

**What retires:** `samagra/portal/` (jinja templates + `app.js` + `style.css`), the FastAPI
`index` jinja route, the `/static` mount, and `Jinja2Templates`. Kept in git history; not
deleted from history. `.gitignore` gains a node block; `frontend/package-lock.json` stays
tracked.

---

## 6. Backend / API surface (reuse vs new)

From `api.md`. The portal swap is clean; the API contract is stable. **Legend:** ✅ reuse
as-is · 🟡 reuse + optional thin additive endpoint · ❌ one genuinely missing backend.

| App (phase) | Endpoint(s) reused | New read-only work |
|---|---|---|
| Dashboard (E1) | `/api/overview` + `/api/pipelines` + `/api/assignments` | 🟡 optional `GET /api/dashboard` aggregator (flat hero stats) — removes fragile client glue; pure read-only aggregation, no new tables |
| Settings (E1) | `/api/overview` (per-source `available` 0/1 → integration pills) | 🟡 optional `GET /api/integrations`; theme/device are **client-only** |
| Terminal (E1) | optional `/api/overview` / `/api/pipelines` / `/api/org` for live `status/catalog/agents/pipelines` | none (can be canned for E1) |
| Clock / Notes / Snake (E1) | — | **none** — fully client-side, localStorage only |
| Pipelines (E2) | `GET /api/pipelines` (5 pipelines, per-phase status/owner/gate) | none (counts optional) |
| Assignments (E2) | `GET /api/assignments` → `assignments[]` (status → 4 kanban cols; `changes` = 5th) | none |
| Org Chart (E2) | — | ❌ **`GET /api/org`** backed by a static `samagra/org.py` (founder→board→workers; `id`s aligned to `state.PIPELINES[*].owners`). **The single hard gap.** No DB |
| Questions (E2) | `GET /api/questions` (LIVE QX) + `/api/facets` | optional `exam` field in the QX SELECT (additive) |
| Lectures (E2) | `GET /api/search?source=textbook` | optional `GET /api/lectures` (filesystem probe for thin/thick export status) |
| Booklets (E2) | `GET /api/search?source=booklets` | optional `meta.kind: theory|workbook` enrichment in the adapter |
| INSP (E2) | `GET /api/search?source=insp` (+ overview summary pills) | none |
| Simulations (E2) | `GET /api/search?source=sims` | none |
| mycontentdev (E2) | `GET /api/search?source=mycontentdev` | none (creds-gated + refresh-gated; GUI handles empty/absent source) |
| Munshi (E2) | `GET /api/search?source=munshi` (read-only) | none; **capture/write is OUT of scope** (no write endpoint exists) |
| Activity (E2) | `/api/assignments` → `events[]` | optional `GET /api/activity` passthrough alias |

**`/open` safety:** any open link must point inside `ALLOWED_ROOTS`
(`QX_ROOT, TEXTBOOK_ROOT, BOOKLETS_ROOT, INSP_ROOT, SIMS_ROOT, EXPORT_DIR`) or it 403s.

**Empty-state handling (data-state, not API gap):** governance.db ships empty (kanban/activity
empty on fresh DB); mcd/munshi appear only post-`/api/refresh` with creds. Every E2 app must
render graceful empty/absent states.

---

## 7. Testing strategy

Four headless, deterministic frontend gates + the Python gate + a separate human pass.

### 7.1 Vitest — the pure modules (primary)
`vitest run` (jsdom, `globals:true`, RTL `jest-dom` setup). Every `lib/` module ships with a
co-located `*.test.ts` asserting the **exact prototype constants** from `proto.md` (window
geometry px, snake death/grow/no-reverse with injected RNG, drift-free stopwatch with a fake
clock, timer ring math, terminal dispatch output + returned effect intents, notes seed +
derivations, localStorage round-trip + corrupt-parse fallback). These run with no real DOM,
no timers, no network — the fastest, most deterministic tier. Thin components get light RTL
smoke tests (renders, calls the store action) — **not** logic re-tests.

### 7.2 pytest — new backend endpoints
Any new read endpoint (`/api/org`, optional `/api/dashboard`, `/api/lectures`,
`/api/integrations`, `/api/activity`) gets a pytest, run as
`.venv\Scripts\python -m pytest -q` from the repo root (Python 3.11 `.venv`, PYTHONPATH=repo
root). `tests/conftest.py` autouse-isolates `DATA_DB`+`GOVERNANCE_DB` to tmp paths; **any new
module reading a real path must be redirected the same way**. No live HTTP/Codex — call route
functions directly, mock clients.

### 7.3 tsc + build gates
`tsc --noEmit` (`npm run typecheck`) catches contract drift against `types/contracts.ts`;
`vite build` proves the bundle compiles to `dist/`. ESLint (`@typescript-eslint`) is the style
gate. Wrapped as **`npm run verify` = lint → typecheck → test → build** (cheap→expensive,
fail-fast) — the single per-task "done" signal, mirroring the Python full-suite green gate.

### 7.4 SEPARATE human visual-fidelity QA pass (in neither loop)
Pixel/visual parity against the prototype + `screenshots/` reference captures is a **human QA
pass**, explicitly outside both agent loops. Loops gate only on the four headless checks. The
human opens the live preview (`npm run dev` or a built `samagra serve`) and compares colors,
typography, spacing, radii, shadows, density, and interaction feel against the hi-fi spec.
A loop never claims "looks right" — only "logic green, build green."

---

## 8. Two-agent execution model

Two agents, two disjoint worktrees, file-disjoint ownership, Codex-review-gated, rubric-driven.

- **claude-deepak** — `../samagra-deepak`, branch `agent/deepak`. CEO/integration/substrate.
  Lands the **blocking bootstrap prefix first** (the substrate every later file imports):
  `package.json`+lockfile, `vite.config.ts`, `tsconfig*`, `index.html`, `main.tsx`/`App.tsx`
  skeleton, `types/contracts.ts`, the WM + theme **store interfaces**, `lib/persistence.ts`,
  `themes/` (aqua), and a `registry.ts` **pre-seeded with all 6 E1 app slots** so the one
  shared file is frozen after commit 1. Then owns: **all of `lib/**`** (every pure engine +
  its Vitest spec), `store/**`, `shell/**`, `themes/**`, and the **integration-leaning apps
  Dashboard / Settings / Terminal**, plus the FastAPI serve seam and (E2) `org.py` + new
  endpoints.
- **claude-khanak** — `../samagra-khanak`, branch `agent/khanak`. COO/builder, **test-first**.
  After rebasing onto deepak's bootstrap, owns the **self-contained leaf utility apps**:
  `apps/Clock`, `apps/Notes`, `apps/Snake` (thin React wrappers over deepak's already-tested
  `lib/` engines — she imports engines, never reimplements them), plus `components/**`
  (Pill/Card/Chip/IconButton) and `hooks/**`. Because the hard logic is deepak's tested `lib/`,
  khanak's files are thin wrappers → the two never write the same file.

**Disjointness guarantees:** ownership is by directory; an agent reads (imports) the other's
exported types/stores but never writes them. The single natural hot-spot — `registry.ts` — is
pre-seeded with all 6 E1 slots in the bootstrap and **frozen for E1** (each owner only fills in
`apps/<App>/index.tsx`; the lazy import resolves when the file exists). E2/E3 new apps are
**append-only, one-app-per-PR** edits at the end of the registry.

**Merge protocol:** deepak bootstrap → `agent/deepak` → merge `main`; khanak `git rebase main`;
both build only in owned paths; integrate `agent/khanak` → `main` then `agent/deepak` → `main`.
Disjoint paths + shared bootstrap ⇒ no content conflicts.

**Gate + cadence (mirrors `conventions.md`):** every task is RED (write failing Vitest/pytest,
run, expect FAIL) → GREEN (minimal impl) → VERIFY (narrow then `npm run verify` / `pytest -q`)
→ one focused commit. Scaffolding/config/SVG/docs tasks are **verification-driven**
(grep/build/import/file-exists). Commits = Conventional Commits `type(scope): subject`,
imperative, no trailing period, ending with a blank line then
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. **Never `--no-verify`.** The active
advisory Codex gate (`core.hooksPath=.githooks` → `samagra review-staged`) runs on every commit
in every worktree; it blocks only on a two-pass confirmed-CRITICAL and never wedges. A loop
treats a gate exit-1 as a hard stop (fix + re-run), **never self-break-glasses**. Each phase
boundary = a full green gate task + a pointer-file sync (STATUS.html + SUMMARY.html +
HANDOFF.md).

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Pixel fidelity can't be loop-verified** — agents could green tests while the UI looks wrong | LINCHPIN: logic in tested `lib/`; components thin. Pixel parity is an explicit **separate human QA pass** (§7.4) with the prototype + `screenshots/` as reference — never a loop claim |
| **`registry.ts` merge conflict** (both agents register apps) | Pre-seed all 6 E1 slots in deepak's bootstrap; **freeze for E1**; append-only one-app-per-PR for E2/E3 |
| **Lockfile merge conflict** (two authors of `package.json`) | Single source: deepak lands `package.json`+`package-lock.json` in the blocking bootstrap; khanak `npm install`s against it, never edits it |
| **Org Chart has no backend** (the one hard gap) | Author static `samagra/org.py` (founder→board→workers, `id`s aligned to `state.PIPELINES[*].owners`) + `GET /api/org`; pytest it; no DB |
| **Heterogeneous `/api/overview` summary shape** drifts client glue | Optional `GET /api/dashboard` aggregator; otherwise type the per-source summary in `contracts.ts` and read defensively (the current portal already does this client-side) |
| **mcd/munshi creds-gated + refresh-gated** → empty/absent sources | Every data app renders graceful empty/absent states; check in-body `error` for `/api/questions`; treat absent source as "needs creds," not a crash |
| **SPA catch-all shadows `/api/*`** if mis-ordered | Declare the `/{full_path:path}` fallback **LAST**, after every real route; guard `full_path.startswith("api/")` → 404 |
| **Timer/interval drift + leak** (stopwatch/timer/snake/clock intervals) | Drift-free wall-anchor math in pure modules (injected `now()`); interval hygiene in `os/` — created on start, cleared on stop/pause/close/unmount; snake stops on close, pauses on minimize |
| **Keyboard hijack** (Snake keys stealing Terminal/Notes input) | `isSnakeActive()` gating: ignore when `activeElement` is INPUT/TEXTAREA and only drive snake when it's the top window / open mobile app |
| **Agent branches stale vs main** (all at `da9cab3`, main at `557e6a4`) | Rebase `agent/deepak` + `agent/khanak` onto `main` before frontend work so they share the bootstrap commit |
| **Active loop scope-creep** back into this track | Explicit non-goal (§3); no tick installed; `scheduler.py` kept but untouched |

---

## 10. Acceptance criteria for E1

E1 is **done** when all of the following hold (no human-fidelity item is a blocker for the
loop; fidelity is a separate sign-off):

1. **`frontend/` app builds and serves.** `cd frontend && npm run verify` is green
   (lint + `tsc --noEmit` + `vitest run` + `vite build`). FastAPI serves the built `dist/` at
   `/` (SPA fallback last) while `/api/*`, `/lecture/{slug}`, `/open` still respond; dev proxy
   (`:5173 → :8799`) works.
2. **Retirement landed.** The jinja `index` route + `/static` mount + `Jinja2Templates` are
   removed; `samagra/portal/` is route-detached (kept in git history); `.gitignore` has the node
   block; `package-lock.json` is tracked.
3. **Window manager works** (pure-module-backed): open/focus/close, drag (clamped x≥0, y≥barH),
   resize (min 360×280), minimize, maximize/restore (stores `prev`), cascade offset (+34x/+30y
   wrap-6 clamped to work area), z-order (init 20, focus bumps), tile (⌈√n⌉ grid, gap 12), and
   theme re-clamp — each asserted in `lib/wm/*` Vitest against the exact `proto.md` constants.
4. **Aqua shell renders**: top bar (30px, wordmark + active-window title + status pill + live
   clock), bottom-center Dock (radius 20, hover lift), window frame (radius 13, left
   traffic-lights, 38px title bar, double-click maximize, right-click context menu), work-area
   `{8,36,vw-16,vh-122}`. `pc` device; mobile not required in E1.
5. **Six E1 apps function on their tested engines:**
   - **Dashboard** — reads `/api/overview` + `/api/pipelines` + `/api/assignments` (or the
     optional aggregator); renders hero stats, pipeline bars, board + recent activity.
   - **Settings** — Appearance (aqua selected) + Device toggle + Integrations rows from
     `available` (theme/device client-only).
   - **Terminal** — `lib/terminal` parser+dispatch: all commands behave (help/status/catalog/
     agents/pipelines/ls/open/theme/device/neofetch/whoami/date/echo/about/sudo/clear/unknown),
     `open <app>` opens a window, `theme`/`device` mutate global state, prompt
     `devesh@samagra:~$`.
   - **Clock** — analog (correct hand angles, 1s step), stopwatch (drift-free, laps),
     timer (ring depletes, "Time!" + WebAudio chime at zero, presets), world (6 zones, day/night
     rule) — all on `lib/clock/*`.
   - **Notes/To-dos** — notes CRUD + autosave to `samagra.notes`; todos add/toggle/del/clearDone
     + filters to `samagra.todos`; seeded on first run; on `lib/notes` + `lib/persistence`.
   - **Snake** — 19×19, responsive cell, relaxed/normal levels, score/best persisted
     (`samagra.snake.{best,level}`), keyboard + D-pad, no-reverse, grow/death — on
     `lib/snake/*`; keyboard gated so it never hijacks Terminal/Notes input.
6. **localStorage persistence** verified for all 4 keys (round-trip + corrupt-JSON fallback) in
   `lib/persistence` Vitest.
7. **Codex gate clean.** Every commit passed the active advisory gate without `--no-verify` and
   without break-glass; no confirmed-CRITICAL outstanding.
8. **Pointer files synced** at the E1 boundary (STATUS.html + SUMMARY.html + HANDOFF.md), per the
   status-pointer-files convention.
9. **(Human sign-off, separate from the loop):** a visual-fidelity QA pass confirms aqua-theme
   parity against the prototype + `screenshots/` (colors, type, spacing, radii, shadows,
   density). This gate is owner-run, not loop-gated.
