# SAMAGRA OS — Experience Track Implementation Plan

> **▶ PROGRESS (updated 2026-06-20):** **E1 (Shell + Aqua + OS utilities) ⬜ NOT STARTED ·
> E2 (data/control apps) ⬜ NOT STARTED (skeleton) · E3 (console + samagra themes + mobile)
> ⬜ NOT STARTED (skeleton).** E1 is the immediate build, decomposed in full TDD detail below.
> Per-task checkboxes are NOT individually ticked — these per-phase banners are the tracker of
> record. E2/E3 are task skeletons (filled in at their phase boundary).

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Every task heading carries three fields —
> `[owner: deepak|khanak] [verify: headless|visual] [blockedBy: <task-ids or none>]`.
> `headless` = fully gated by vitest/tsc/eslint/vite-build/pytest (loop-completable). `visual` =
> needs a human pixel/interaction QA pass (NOT in any loop; see §Testing).

**Goal:** Recreate the extracted hi-fi SAMAGRA OS prototype as a **React 18 + TypeScript + Vite**
app in a new `frontend/` at the repo root, served in production by the existing FastAPI control
plane (build → `frontend/dist/`; FastAPI serves it at `/` and keeps `/api/*`), with **all real
behavior pushed into pure, headlessly-testable TypeScript modules** (the *linchpin*) and React
components kept as thin visual wrappers. E1 delivers the windowing shell + aqua theme + six OS
utilities (Dashboard, Settings, Terminal, Clock, Notes/To-dos, Snake). E2 wires the eleven
data/control apps to existing backends (read-only). E3 adds the console + samagra themes and the
mobile device mode (re-skin only). **The backend "active loop" is parked** (kept planned,
deprioritized — explicit non-goal here).

**Architecture:** One `frontend/` app, three experience phases (E1/E2/E3), each ending on a full
green gate before the next. The keystone is the **LINCHPIN**: every pure-logic module
(`lib/wm/*`, `lib/snake/*`, `lib/clock/*`, `lib/terminal/*`, `lib/notes/*`, `lib/persistence`,
`lib/registry`) is its own TDD task (failing Vitest → minimal impl → green) asserting the
**verbatim prototype constants** from `proto.md`. Zustand stores (`stores/windowManager`,
`stores/theme`) hold state and delegate math to `lib/`. React components in `shell/**` and
`apps/**` are thin wrappers assembled after the engines are green; their pixel/interaction
fidelity is a **separate human QA pass**, in neither agent loop. Two agents own disjoint
worktrees: **deepak** lands the blocking bootstrap prefix + all `lib/**`, `stores/**`, `shell/**`,
`themes/**`, and apps Dashboard/Settings/Terminal + the FastAPI serve seam; **khanak** rebases
onto the bootstrap and owns apps Clock/Notes/Snake + `components/**` + `hooks/**` as thin
wrappers over deepak's tested engines.

**Tech Stack:** React 18 + TypeScript + Vite (`frontend/`, own `package.json`); Zustand stores;
lucide-react icons; Vitest + React Testing Library + jsdom; ESLint + `@typescript-eslint`; fonts
Inter / Hanken Grotesk / JetBrains Mono / Tiro Devanagari Hindi. Python 3.11 (`.venv`) + FastAPI
control plane (serve seam + E2 `org.py`/new read endpoints); advisory Codex pre-commit gate
active via `core.hooksPath=.githooks`.

**Spec:** [`docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md`](../specs/2026-06-20-samagra-os-experience-design.md)
— read it first (§4 architecture, §7 testing, §8 two-agent model, §9 risks, §10 E1 acceptance).
**Research:** `docs/superpowers/_research/samagra-os/{proto,api,conventions,repo}.md` —
`proto.md` is the authoritative source of every test-assertion constant below.

---

## Shared Contracts — single source of truth for names

Every task below uses these verbatim. Do not invent alternative names or paths.

**Repo & worktrees:** repo root `C:\SandBox\claude_box\TeachingOS` (branch `main` at `557e6a4`).
deepak worktree `../samagra-deepak` (branch `agent/deepak`); khanak worktree `../samagra-khanak`
(branch `agent/khanak`). Both agent branches sit at `da9cab3` and **must `git rebase main`**
before frontend work so they share the bootstrap commit. The advisory Codex hook is active
repo-wide (`core.hooksPath=.githooks` → `python -m samagra.review.precommit`, CLI verb
`samagra review-staged`); it runs on every commit in every worktree, blocks only on a two-pass
confirmed-CRITICAL, never wedges. **Never `--no-verify`. A loop never self-break-glasses.**

**Frontend location:** new top-level `frontend/` at the repo root, **beside `samagra/`, never
inside it** (`samagra/` is a Python wheel package). Its own `package.json`. Vite builds to
`frontend/dist/` (gitignored). `frontend/package-lock.json` stays **tracked**.

**Frontend file tree (final, authoritative paths):**
```
frontend/
├─ package.json · package-lock.json · vite.config.ts · tsconfig.json · tsconfig.node.json
├─ index.html · .eslintrc.cjs
└─ src/
   ├─ main.tsx · App.tsx
   ├─ types/contracts.ts        # AppId, AppMeta, WindowState, Theme, Device, ApiClient
   ├─ registry.ts               # APPS map + ORDER + MOBILE_FAVORITES (data) — frozen for E1
   ├─ lib/
   │  ├─ persistence.ts
   │  ├─ wm/{geometry.ts,zorder.ts}
   │  ├─ snake/{engine.ts,cell.ts}
   │  ├─ clock/{analog.ts,stopwatch.ts,timer.ts,world.ts}
   │  ├─ terminal/{parser.ts,dispatch.ts}
   │  └─ notes/model.ts
   ├─ stores/{windowManager.ts,theme.ts}
   ├─ themes/index.ts           # THEMES token maps (aqua E1; console/samagra forward-compat)
   ├─ shell/{TopBar.tsx,Dock.tsx,WindowFrame.tsx,ContextMenu.tsx}
   ├─ apps/
   │  ├─ Dashboard/index.tsx · Settings/index.tsx · Terminal/index.tsx   # deepak
   │  └─ Clock/index.tsx · Notes/index.tsx · Snake/index.tsx              # khanak
   ├─ components/{Pill.tsx,Card.tsx,Chip.tsx,IconButton.tsx}              # khanak
   ├─ hooks/{useInterval.ts,useApi.ts}                                    # mixed
   └─ test/setup.ts
```
Each `lib/` module ships with a **co-located `*.test.ts`** (e.g. `lib/wm/geometry.test.ts`).

**Pure-module signatures (the LINCHPIN contract — assert exact `proto.md` constants):**
- `lib/wm/geometry.ts`: `workArea(theme,vw,vh)->{x,y,w,h}`; `openRect(app,workArea,n)->{x,y,w,h}`
  (cascade `+34x/+30y`, wrap `n%6`, base inset `24x/12y`, right/bottom margin 12, sized
  `min(app.w,wa.w-24) × min(app.h,wa.h-20)`); `clampDrag(x,y,barH)->{x,y}` (`x≥0`, `y≥barH`);
  `clampResize(w,h)->{w,h}` (`≥360×280`); `maximizeRect(workArea)`; `reclampOnTheme(win,workArea)`
  (8px inset); `tile(n,workArea)->Rect[]` (`cols=⌈√n⌉`, `gap=12`, rounded).
- `lib/wm/zorder.ts`: `INITIAL_Z=20`; `bump(z)->z+1`; `topWindow(windows)->id|null` (max-z, non-min).
- `lib/snake/engine.ts`: `LEVELS={relaxed:{base:215,floor:135,dec:2},normal:{base:135,floor:70,dec:3}}`;
  `COLS=19,ROWS=19`; `init(level,rng)->State`; `setDir(state,[dx,dy])->State` (no-reverse vs
  committed `dir`); `step(state,rng)->State` (eat/grow/death); `food(body,rng)->[x,y]` (rejection
  resample). Score `+10`/food; speed `max(floor, speed-dec)`.
- `lib/snake/cell.ts`: `cellSize(win?)->number` (`clamp(11,28, floor(min(win.w-40, win.h-288)/19))`,
  default `18`); `boardPx(cell)->{w,h}` (`19*cell`).
- `lib/clock/analog.ts`: `handAngles(date)->{secA,minA,hrA}` (`secA=s*6`, `minA=m*6+s*0.1`,
  `hrA=(hr%12)*30+m*0.5`); `handEndpoint(cx,cy,ang,len,tail)->{x1,y1,x2,y2}`; tick/numeral geometry
  (300×300, R=120).
- `lib/clock/stopwatch.ts`: drift-free `elapsed(now,start)`; `fmtMs(ms)->"MM:SS.cc"`; lap-split math.
- `lib/clock/timer.ts`: `remaining(now,end)`; `ringOffset(remaining,total)` (`C=2π·110`,
  `offset=C*(1-frac)`); `PRESETS=[[60,'1 min'],[300,'5 min'],[600,'10 min'],[1500,'25 min']]`;
  `isDone(running,total,remaining)`.
- `lib/clock/world.ts`: `ZONES` (6, exact order); `isNight(hourNum)->hourNum<6||hourNum>=19`
  (day = 06:00–18:59).
- `lib/terminal/parser.ts`: `parse(line)->{c0,args,arg,clear:boolean,empty:boolean}`.
- `lib/terminal/dispatch.ts`: `dispatch(line,ctx)->{lines:{t,c}[], effects:Effect[]}` where
  `Effect = {kind:'openApp'|'setTheme'|'setDevice', value}` (**returned, not executed**); line
  classes `c ∈ in|fg|dim|accent|ok|err`; prompt `devesh@samagra:~$`.
- `lib/notes/model.ts`: `seedNotes()`/`seedTodos()`; `newNote/updNote(ts-restamp)/delNote`;
  `addTodo/toggleTodo/delTodo/clearDone`; `noteTitle(note)`; `wordCount(s)`; `notePreview(body)`;
  `filterTodos(todos,filter)`.
- `lib/persistence.ts`: `load<T>(key,fallback)->T` / `save<T>(key,v)->void` over keys
  `KEYS = {notes:'samagra.notes', todos:'samagra.todos', snakeBest:'samagra.snake.best',
  snakeLevel:'samagra.snake.level'}`; defensive parse (`Array.isArray` guard, level→`normal`);
  injected `Storage`.
- `lib/registry.ts` (data): `APPS` (17 id→`{name,accent,w,h}`), `ORDER` (17 ids), `MOBILE_FAVORITES`.

**Zustand stores:** `stores/windowManager.ts` — state `{windows:WindowState[], z}`; actions
`openApp/closeApp/focus/move/resize/minimize/toggleMax/tile`; delegates geometry/z to `lib/wm/*`.
`stores/theme.ts` — state `{theme:Theme, device:Device}`; actions `setTheme` (re-clamps via
`lib/wm/geometry.reclampOnTheme`), `setDevice`.

**Contract types (`types/contracts.ts`):** `AppId` (17-id union); `AppMeta = {id:AppId; name:string;
accent:string; w:number; h:number}`; `WindowState = {id:string; app:AppId; x,y,w,h,z:number;
min,max:boolean; prev:Rect|null}`; `Rect = {x,y,w,h}`; `Theme = 'aqua'|'console'|'samagra'`;
`Device = 'pc'|'mobile'`; `ApiClient` (typed `/api/*` getters); `LineClass`, `TermLine`,
`TermEffect`, `TermCtx`; `Note`, `Todo`, `TodoFilter`.

**npm scripts (`package.json`):** `dev`=`vite`; `build`=`tsc --noEmit && vite build`;
`preview`=`vite preview`; `test`=`vitest run`; `test:watch`=`vitest`;
`test:cov`=`vitest run --coverage`; `typecheck`=`tsc --noEmit`;
`lint`=`eslint "src/**/*.{ts,tsx}"`; `lint:fix`=`… --fix`;
**`verify`=`npm run lint && npm run typecheck && npm run test && npm run build`** — the single
per-task loop gate (cheap→expensive, fail-fast).

**Commands.** Frontend tests from `frontend/`: `npm test -- <selector>` (one module),
`npm test` (all), `npm run verify` (gate). Backend tests from the repo root:
`.venv\Scripts\python -m pytest -q` (PYTHONPATH = repo root, Python 3.11 `.venv`);
`tests/conftest.py` autouse-isolates `DATA_DB`+`GOVERNANCE_DB` to tmp paths; **any new backend
module reading a real path must be redirected the same way.** No live HTTP/Codex in tests — call
route functions directly, mock clients.

**FastAPI serve seam (`samagra/api/app.py`):** retire the Jinja `index` route + `/static` mount +
`Jinja2Templates`; `FRONTEND_DIST = config.REPO_ROOT / "frontend" / "dist"`; mount
`app.mount("/assets", StaticFiles(directory=FRONTEND_DIST/"assets"))`; add a
`GET /{full_path:path}` SPA fallback **declared LAST** that 404s `full_path.startswith("api/")`
and otherwise returns `FileResponse(FRONTEND_DIST/"index.html")` (503 if not built).
`/api/*`, `/lecture/{slug}`, `/open` are a **frozen contract**, unchanged. Dev: Vite `:5173`
proxies `/api`, `/lecture`, `/open` → uvicorn `:8799`.

**`.gitignore` additions (frontend node block):** `node_modules/`, `frontend/dist/`,
`frontend/.vite/`, `frontend/coverage/`, `*.tsbuildinfo`. Keep `frontend/package-lock.json`
tracked.

**Commits:** Conventional Commits `type(scope): subject` (imperative, lower-case, no trailing
period). Scopes: `frontend`, `os`, `wm`, `snake`, `clock`, `terminal`, `notes`, `shell`, `themes`,
`apps`, `api`, `org`, `gitignore`. Multi-line body via heredoc (bash) / here-string (PowerShell).
**Every commit ends with a blank line then:**
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```
Never amend (create a new commit); never `--no-verify`.

**Schema-freeze rule (E1).** `registry.ts` is pre-seeded with **all 17 app slots** in the
bootstrap and **frozen for E1** — each owner only creates `apps/<App>/index.tsx`; the lazy import
resolves when the file exists. Neither agent edits `registry.ts` during E1. E2/E3 wiring is
append-only, one-app-per-PR.

**Safety (all phases):** every backend touch is **read-only**. No new write path. The only new
*content* endpoint is `GET /api/org` (E2, static `samagra/org.py`). Munshi capture/write is OUT of
scope. The active loop is parked — no tick installed, `scheduler.py` untouched. Never log/commit a
secret value. Pixel fidelity is a **separate human QA pass**, never a loop completion signal.

---

## Phase E1 — Shell + Aqua theme + OS utilities

> **(status banner — ⬜ NOT STARTED)**

E1 stands up the `frontend/` app, the FastAPI serve seam, the windowing shell (aqua chrome:
top-bar + Dock + window frame + context menu), and the six OS utilities. Per the LINCHPIN, **each
pure-logic module is its own TDD task** (failing Vitest → minimal impl → green, asserting exact
`proto.md` constants); the Zustand stores delegate to those modules; the React shell + app
components are thin wrappers assembled last (tagged `visual` — human pixel QA, outside the loop).
The phase ends on a full `npm run verify` green gate + a pointer-file sync. deepak lands the
blocking bootstrap (E1.1–E1.2) and all `lib/**`/`stores/**`/`shell/**`/`themes/**` + apps
Dashboard/Settings/Terminal + the serve seam; khanak rebases and owns apps Clock/Notes/Snake +
`components/**`/`hooks/**`.

**Files:**
- **Create** `frontend/package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`,
  `tsconfig.node.json`, `index.html`, `.eslintrc.cjs`, `src/test/setup.ts`,
  `src/main.tsx`, `src/App.tsx` (bootstrap — E1.1).
- **Create** `frontend/src/types/contracts.ts`, `src/registry.ts` (contract prefix — E1.2).
- **Create** `frontend/src/lib/persistence.ts` + `.test.ts` (E1.3).
- **Create** `frontend/src/themes/index.ts` + `.test.ts` (aqua tokens — E1.4).
- **Create** `frontend/src/lib/wm/geometry.ts` + `.test.ts` (E1.5).
- **Create** `frontend/src/lib/wm/zorder.ts` + `.test.ts` (E1.6).
- **Create** `frontend/src/stores/windowManager.ts`, `src/stores/theme.ts` + tests (E1.7).
- **Create** `frontend/src/lib/terminal/parser.ts` + `.test.ts` (E1.8).
- **Create** `frontend/src/lib/terminal/dispatch.ts` + `.test.ts` (E1.9).
- **Create** `frontend/src/lib/clock/{analog,digital,stopwatch,timer,world}.ts` + tests (E1.10–E1.13, incl. E1.10b digital).
- **Create** `frontend/src/lib/notes/model.ts` + `.test.ts` (E1.14).
- **Create** `frontend/src/lib/snake/{cell,engine}.ts` + tests (E1.15–E1.16).
- **Modify** `samagra/api/app.py`; **Create** `tests/test_serve_seam.py`; **Modify** `.gitignore`
  (serve seam — E1.17).
- **Create** `frontend/src/shell/{TopBar,Dock,WindowFrame,ContextMenu}.tsx` (E1.18, VISUAL).
- **Create** `frontend/src/apps/Dashboard/index.tsx`, `src/hooks/useApi.ts` (E1.19, VISUAL).
- **Create** `frontend/src/apps/Settings/index.tsx` (E1.20, VISUAL).
- **Create** `frontend/src/apps/Terminal/index.tsx` (E1.21, VISUAL).
- **Create** `frontend/src/apps/Clock/index.tsx`, `src/hooks/useInterval.ts` (E1.22, VISUAL).
- **Create** `frontend/src/apps/Notes/index.tsx` (E1.23, VISUAL).
- **Create** `frontend/src/apps/Snake/index.tsx` (E1.24, VISUAL).
- **Create** `frontend/src/components/{Pill,Card,Chip,IconButton}.tsx` (E1.25, VISUAL).
- **None** — full green gate + pointer-file sync (E1.26).

---

### Task E1.1: Frontend bootstrap scaffold + FastAPI-serve config + tooling [owner: deepak] [verify: headless] [blockedBy: none]

**Files:**
- Create `frontend/package.json`, `frontend/package-lock.json`
- Create `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/tsconfig.node.json`
- Create `frontend/index.html`, `frontend/.eslintrc.cjs`
- Create `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/test/setup.ts`
- Modify `.gitignore`

The blocking shared bootstrap (`repo.md` §4a). Verification-driven — gated by
`npm install` + `npm run verify` (with one trivial smoke test), not red-green. Everything below
imports this substrate, so it lands FIRST on `agent/deepak` and merges to `main` before khanak
writes a line.

- [ ] **Step 1: Create `frontend/package.json`** with the decided deps + scripts.
```json
{
  "name": "samagra-os-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:cov": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "eslint \"src/**/*.{ts,tsx}\"",
    "lint:fix": "eslint \"src/**/*.{ts,tsx}\" --fix",
    "verify": "npm run lint && npm run typecheck && npm run test && npm run build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.5",
    "lucide-react": "^0.460.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@typescript-eslint/eslint-plugin": "^8.15.0",
    "@typescript-eslint/parser": "^8.15.0",
    "@vitejs/plugin-react": "^4.3.3",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@vitest/coverage-v8": "^2.1.5",
    "eslint": "^8.57.1",
    "eslint-plugin-react-hooks": "^5.0.0",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 2: Create `frontend/vite.config.ts`** (build outDir, dev proxy, Vitest jsdom).
```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8799",
      "/lecture": "http://127.0.0.1:8799",
      "/open": "http://127.0.0.1:8799",
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: false,
  },
});
```

- [ ] **Step 3: Create `frontend/tsconfig.json` + `frontend/tsconfig.node.json`.**
```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2021",
    "useDefineForClassFields": true,
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```
```jsonc
// tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `frontend/index.html`** (fonts + `#root`).
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SAMAGRA OS</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&family=Hanken+Grotesk:wght@400..800&family=JetBrains+Mono:wght@400;500&family=Tiro+Devanagari+Hindi&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `frontend/.eslintrc.cjs`, `src/main.tsx`, `src/App.tsx`, `src/test/setup.ts`.**
```cjs
// .eslintrc.cjs
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2021, sourceType: "module" },
  plugins: ["@typescript-eslint", "react-hooks"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { browser: true, es2021: true, node: true },
  ignorePatterns: ["dist", "coverage", "*.cjs"],
  rules: { "@typescript-eslint/no-explicit-any": "warn" },
};
```
```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```
```tsx
// src/App.tsx — shell stub; real chrome lands in E1.18
export default function App() {
  return <div id="samagra-os-shell" />;
}
```
```ts
// src/test/setup.ts
import "@testing-library/jest-dom";
```

- [ ] **Step 6: Add the frontend node block to `.gitignore`.** Append:
```gitignore
# --- frontend (node / vite) ---
node_modules/
frontend/dist/
frontend/.vite/
frontend/coverage/
*.tsbuildinfo
```

- [ ] **Step 7: Install + generate the lockfile, then verify the toolchain.**
```bash
cd frontend && npm install
```
Expected: `node_modules/` populates and `frontend/package-lock.json` is generated. (Add a single
smoke test `src/App.test.tsx` asserting `App` renders `#samagra-os-shell` so `vitest run` has
≥1 test, then:)
```bash
cd frontend && npm run verify
```
Expected: lint clean, `tsc --noEmit` clean, `vitest run` `1 passed`, `vite build` writes `dist/`.

- [ ] **Step 8: Commit the bootstrap** (lockfile tracked; `node_modules`/`dist` ignored).
```bash
cd /c/SandBox/claude_box/TeachingOS
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts \
  frontend/tsconfig.json frontend/tsconfig.node.json frontend/index.html \
  frontend/.eslintrc.cjs frontend/src .gitignore
git commit -m "feat(frontend): bootstrap React+TS+Vite app + tooling + gitignore node block

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: commit succeeds; the advisory Codex gate runs and allows (a large lockfile diff is not a
CRITICAL finding).

---

### Task E1.2: App-contract TYPES + WM/theme store interfaces + frozen registry [owner: deepak] [verify: headless] [blockedBy: E1.1]

**Files:**
- Create `frontend/src/types/contracts.ts`
- Create `frontend/src/registry.ts`
- Test `frontend/src/registry.test.ts`

The **blocking prefix** every later file imports: the app-contract types, the store-shape types,
and the `APPS`/`ORDER`/`MOBILE_FAVORITES` data tables (asserted exactly against `proto.md` §0).
Types are typecheck-gated; the registry data gets a real Vitest (`registry.test.ts`) so its
17-app table is frozen by a green assertion. After this lands, `registry.ts` is **frozen for E1**.

- [ ] **Step 1: Write the failing registry test.** Create `frontend/src/registry.test.ts` with the
  verbatim `proto.md` §0 table:
```ts
import { describe, it, expect } from "vitest";
import { APPS, ORDER, MOBILE_FAVORITES } from "./registry";

describe("APPS registry", () => {
  it("has all 17 apps with exact accent + default size", () => {
    expect(APPS.dashboard).toEqual({ id: "dashboard", name: "Dashboard", accent: "#4f46e5", w: 940, h: 610 });
    expect(APPS.pipelines).toEqual({ id: "pipelines", name: "Pipelines", accent: "#db2777", w: 960, h: 600 });
    expect(APPS.assignments).toEqual({ id: "assignments", name: "Assignments", accent: "#0891b2", w: 1000, h: 630 });
    expect(APPS.org).toEqual({ id: "org", name: "Org Chart", accent: "#4338ca", w: 920, h: 640 });
    expect(APPS.questions).toEqual({ id: "questions", name: "Questions", accent: "#2563eb", w: 900, h: 610 });
    expect(APPS.lectures).toEqual({ id: "lectures", name: "Lectures", accent: "#0d9488", w: 840, h: 600 });
    expect(APPS.booklets).toEqual({ id: "booklets", name: "Booklets", accent: "#b45309", w: 780, h: 560 });
    expect(APPS.insp).toEqual({ id: "insp", name: "INSP / Olympiad", accent: "#ca8a04", w: 800, h: 580 });
    expect(APPS.sims).toEqual({ id: "sims", name: "Simulations", accent: "#7c3aed", w: 880, h: 600 });
    expect(APPS.mycontentdev).toEqual({ id: "mycontentdev", name: "mycontentdev", accent: "#c026d3", w: 840, h: 610 });
    expect(APPS.munshi).toEqual({ id: "munshi", name: "Munshi", accent: "#059669", w: 430, h: 720 });
    expect(APPS.activity).toEqual({ id: "activity", name: "Activity", accent: "#ea580c", w: 480, h: 600 });
    expect(APPS.settings).toEqual({ id: "settings", name: "Settings", accent: "#475569", w: 760, h: 580 });
    expect(APPS.terminal).toEqual({ id: "terminal", name: "Terminal", accent: "#10b981", w: 740, h: 480 });
    expect(APPS.clock).toEqual({ id: "clock", name: "Clock", accent: "#0ea5e9", w: 560, h: 640 });
    expect(APPS.notes).toEqual({ id: "notes", name: "Notes", accent: "#f59e0b", w: 840, h: 600 });
    expect(APPS.snake).toEqual({ id: "snake", name: "Snake", accent: "#22c55e", w: 480, h: 680 });
    expect(Object.keys(APPS)).toHaveLength(17);
  });
  it("ORDER is the exact dock/start order (not alpha, not APPS-key order)", () => {
    expect(ORDER).toEqual([
      "dashboard", "pipelines", "assignments", "org", "questions", "lectures", "booklets",
      "insp", "sims", "mycontentdev", "munshi", "notes", "clock", "terminal", "snake",
      "activity", "settings",
    ]);
  });
  it("mobile favorites + min-size constant", () => {
    expect(MOBILE_FAVORITES).toEqual(["dashboard", "notes", "clock", "munshi"]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- registry
```
Expected: `Cannot find module './registry'` (red).

- [ ] **Step 3: Implement `types/contracts.ts` then `registry.ts`.**
```ts
// src/types/contracts.ts
export type AppId =
  | "dashboard" | "pipelines" | "assignments" | "org" | "questions" | "lectures"
  | "booklets" | "insp" | "sims" | "mycontentdev" | "munshi" | "activity"
  | "settings" | "terminal" | "clock" | "notes" | "snake";

export interface AppMeta { id: AppId; name: string; accent: string; w: number; h: number; }
export interface Rect { x: number; y: number; w: number; h: number; }
export interface WindowState {
  id: string; app: AppId; x: number; y: number; w: number; h: number;
  z: number; min: boolean; max: boolean; prev: Rect | null;
}
export type Theme = "aqua" | "console" | "samagra";
export type Device = "pc" | "mobile";

export const MIN_W = 360;
export const MIN_H = 280;

// Terminal
export type LineClass = "in" | "fg" | "dim" | "accent" | "ok" | "err";
export interface TermLine { t: string; c: LineClass; }
export type TermEffect =
  | { kind: "openApp"; value: AppId }
  | { kind: "setTheme"; value: Theme }
  | { kind: "setDevice"; value: Device };
export interface TermCtx { order: AppId[]; apps: Record<AppId, AppMeta>; }

// Notes / todos
export interface Note { id: string; title: string; body: string; ts: number; }
export interface Todo { id: string; text: string; done: boolean; }
export type TodoFilter = "all" | "active" | "done";

// Backend
export interface ApiClient {
  overview(): Promise<unknown>;
  pipelines(): Promise<unknown>;
  assignments(): Promise<unknown>;
}
```
```ts
// src/registry.ts — DATA ONLY; frozen for E1
import type { AppId, AppMeta } from "./types/contracts";

export const APPS: Record<AppId, AppMeta> = {
  dashboard: { id: "dashboard", name: "Dashboard", accent: "#4f46e5", w: 940, h: 610 },
  pipelines: { id: "pipelines", name: "Pipelines", accent: "#db2777", w: 960, h: 600 },
  assignments: { id: "assignments", name: "Assignments", accent: "#0891b2", w: 1000, h: 630 },
  org: { id: "org", name: "Org Chart", accent: "#4338ca", w: 920, h: 640 },
  questions: { id: "questions", name: "Questions", accent: "#2563eb", w: 900, h: 610 },
  lectures: { id: "lectures", name: "Lectures", accent: "#0d9488", w: 840, h: 600 },
  booklets: { id: "booklets", name: "Booklets", accent: "#b45309", w: 780, h: 560 },
  insp: { id: "insp", name: "INSP / Olympiad", accent: "#ca8a04", w: 800, h: 580 },
  sims: { id: "sims", name: "Simulations", accent: "#7c3aed", w: 880, h: 600 },
  mycontentdev: { id: "mycontentdev", name: "mycontentdev", accent: "#c026d3", w: 840, h: 610 },
  munshi: { id: "munshi", name: "Munshi", accent: "#059669", w: 430, h: 720 },
  activity: { id: "activity", name: "Activity", accent: "#ea580c", w: 480, h: 600 },
  settings: { id: "settings", name: "Settings", accent: "#475569", w: 760, h: 580 },
  terminal: { id: "terminal", name: "Terminal", accent: "#10b981", w: 740, h: 480 },
  clock: { id: "clock", name: "Clock", accent: "#0ea5e9", w: 560, h: 640 },
  notes: { id: "notes", name: "Notes", accent: "#f59e0b", w: 840, h: 600 },
  snake: { id: "snake", name: "Snake", accent: "#22c55e", w: 480, h: 680 },
};

export const ORDER: AppId[] = [
  "dashboard", "pipelines", "assignments", "org", "questions", "lectures", "booklets",
  "insp", "sims", "mycontentdev", "munshi", "notes", "clock", "terminal", "snake",
  "activity", "settings",
];

export const MOBILE_FAVORITES: AppId[] = ["dashboard", "notes", "clock", "munshi"];
```

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- registry
```
Expected: 3 tests pass.

- [ ] **Step 5: Gate + commit** (this freezes `registry.ts` for E1).
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/types/contracts.ts frontend/src/registry.ts frontend/src/registry.test.ts
git commit -m "feat(frontend): app-contract types + frozen 17-app registry (proto values)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: verify green; commit succeeds. **deepak now merges `agent/deepak` → `main`; khanak
`git rebase main`.** All later tasks assume the bootstrap + this prefix are present.

---

### Task E1.3: `lib/persistence` localStorage layer (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.2]

**Files:**
- Test `frontend/src/lib/persistence.test.ts`
- Create `frontend/src/lib/persistence.ts`

Typed `load<T>(key, fallback)` / `save<T>(key, v)` over the 4 keys, with defensive parse
(`Array.isArray` guard for arrays, level validation → `normal` on invalid). Storage is **injected**
so the test runs against a fake (no jsdom dependency). Constants from `proto.md` §2.8 / §5.2.

- [ ] **Step 1: Write the failing test.**
```ts
import { describe, it, expect } from "vitest";
import { load, save, KEYS } from "./persistence";

function fakeStorage(seed: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(seed));
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

describe("persistence", () => {
  it("exposes the 4 localStorage keys verbatim", () => {
    expect(KEYS).toEqual({
      notes: "samagra.notes", todos: "samagra.todos",
      snakeBest: "samagra.snake.best", snakeLevel: "samagra.snake.level",
    });
  });
  it("round-trips a value", () => {
    const s = fakeStorage();
    save(KEYS.notes, [{ id: "n1" }], s);
    expect(load(KEYS.notes, [], s)).toEqual([{ id: "n1" }]);
  });
  it("falls back on corrupt JSON", () => {
    const s = fakeStorage({ "samagra.notes": "{not json" });
    expect(load(KEYS.notes, ["seed"], s)).toEqual(["seed"]);
  });
  it("falls back when an array key holds a non-array", () => {
    const s = fakeStorage({ "samagra.todos": '{"x":1}' });
    expect(load(KEYS.todos, [], s)).toEqual([]);
  });
  it("missing key returns the fallback", () => {
    expect(load(KEYS.snakeBest, 0, fakeStorage())).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- persistence
```
Expected: `Cannot find module './persistence'` (red).

- [ ] **Step 3: Implement `lib/persistence.ts`.**
```ts
const _ls: Storage | undefined =
  typeof localStorage !== "undefined" ? localStorage : undefined;

export const KEYS = {
  notes: "samagra.notes",
  todos: "samagra.todos",
  snakeBest: "samagra.snake.best",
  snakeLevel: "samagra.snake.level",
} as const;

export function load<T>(key: string, fallback: T, storage: Storage | undefined = _ls): T {
  if (!storage) return fallback;
  const raw = storage.getItem(key);
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    // Defensive: if the fallback is an array, the parsed value must be too.
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T, storage: Storage | undefined = _ls): void {
  if (!storage) return;
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* quota — no-op */ }
}
```

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- persistence
```
Expected: 5 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/persistence.ts frontend/src/lib/persistence.test.ts
git commit -m "feat(frontend): persistence localStorage layer + defensive parse (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.4: `themes/` aqua token map (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.2]

**Files:**
- Test `frontend/src/themes/index.test.ts`
- Create `frontend/src/themes/index.ts`

The `THEMES` token map. aqua is authored + asserted for E1; console/samagra are authored
forward-compatibly (per `proto.md` §6.2/§6.3) but only aqua is surfaced. Test asserts the
aqua chrome constants that `lib/wm/geometry` consumes (so chrome + math never drift) and the
key color tokens verbatim from `proto.md` §6.1.

- [ ] **Step 1: Write the failing test.**
```ts
import { describe, it, expect } from "vitest";
import { THEMES } from "./index";

describe("THEMES.aqua", () => {
  const a = THEMES.aqua;
  it("chrome constants drive work-area + clamps", () => {
    expect(a.kind).toBe("mac");
    expect(a.dockPos).toBe("bottom");
    expect(a.controlSide).toBe("left");
    expect(a.barH).toBe(30);
    expect(a.winRadius).toBe(13);
  });
  it("core color tokens are exact", () => {
    expect(a.accent).toBe("#4f46e5");
    expect(a.accent2).toBe("#0d9488");
    expect(a.text).toBe("#1d1d1f");
    expect(a.muted).toBe("#6e6e76");
    expect(a.winBg).toBe("rgba(255,255,255,0.78)");
    expect(a.font).toContain("Inter");
  });
  it("console + samagra exist forward-compat with their barH/rail", () => {
    expect(THEMES.console.barH).toBe(0);
    expect(THEMES.console.winRadius).toBe(10);
    expect(THEMES.samagra.barH).toBe(32);
    expect(THEMES.samagra.rail).toBe(66);
    expect(THEMES.samagra.winRadius).toBe(15);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- themes
```
Expected: `Cannot find module './index'` (red).

- [ ] **Step 3: Implement `themes/index.ts`** — paste the aqua/console/samagra token maps verbatim
  from `proto.md` §6 (each carrying `kind, dockPos, controlSide, barH, rail?, winRadius, bg, winBg,
  winBlur, bar, barText, barBlur, text, muted, line, cardBg, subBg, accent, accent2, shadow,
  dockBg, dockBlur, dockBorder, font, wordmark`). Add `termPalette` (§6.4) and shared
  semantic/status colors (§6.5) as exported constants. Type the map as
  `Record<Theme, ThemeTokens>`.

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- themes
```
Expected: 3 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/themes/index.ts frontend/src/themes/index.test.ts
git commit -m "feat(themes): aqua token map (E1) + console/samagra forward-compat tokens

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.5: `lib/wm/geometry` — work-area / openRect / clamp / maximize / reclamp / tile (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.4]

**Files:**
- Test `frontend/src/lib/wm/geometry.test.ts`
- Create `frontend/src/lib/wm/geometry.ts`

The window-geometry keystone. Pure rect math over `(theme, vw, vh, windows[])` with **zero DOM**.
Every constant is verbatim from `proto.md` §1.2–§1.10. This is the highest-value TDD task.

- [ ] **Step 1: Write the failing test** (exact `proto.md` constants).
```ts
import { describe, it, expect } from "vitest";
import { workArea, openRect, clampDrag, clampResize, maximizeRect, reclampOnTheme, tile } from "./geometry";

describe("workArea", () => {
  it("aqua: {x:8, y:barH+6, w:vw-16, h:vh-barH-92} → barH=30 ⇒ {8,36,vw-16,vh-122}", () => {
    expect(workArea("aqua", 1440, 900)).toEqual({ x: 8, y: 36, w: 1424, h: 778 });
  });
  it("console: {x:8, y:8, w:vw-16, h:vh-66}", () => {
    expect(workArea("console", 1440, 900)).toEqual({ x: 8, y: 8, w: 1424, h: 834 });
  });
  it("samagra: rail=66,barH=32 ⇒ {74,38,vw-82,vh-44}", () => {
    expect(workArea("samagra", 1440, 900)).toEqual({ x: 74, y: 38, w: 1358, h: 856 });
  });
  it("defaults vw||1440, vh||900 when zero", () => {
    expect(workArea("aqua", 0, 0)).toEqual({ x: 8, y: 36, w: 1424, h: 778 });
  });
});

describe("openRect — sizing + cascade + clamp", () => {
  const wa = workArea("aqua", 1440, 900); // {8,36,1424,778}
  it("first window (n=0): size=min(app, wa-24/-20), inset 24x/12y", () => {
    const r = openRect({ w: 940, h: 610 }, wa, 0);
    expect(r.w).toBe(940);            // min(940, 1424-24)
    expect(r.h).toBe(610);            // min(610, 778-20)
    expect(r.x).toBe(8 + 24);         // wa.x + 24 + 0
    expect(r.y).toBe(36 + 12);        // wa.y + 12 + 0
  });
  it("cascade steps +34x/+30y, wraps every 6", () => {
    const r2 = openRect({ w: 940, h: 610 }, wa, 2);
    expect(r2.x).toBe(8 + 24 + 2 * 34);
    expect(r2.y).toBe(36 + 12 + 2 * 30);
  });
  it("clamps to keep window inside work area (12px right/bottom margin)", () => {
    const r = openRect({ w: 1400, h: 760 }, wa, 5);
    expect(r.x).toBeLessThanOrEqual(wa.x + wa.w - r.w - 12);
    expect(r.x).toBeGreaterThanOrEqual(wa.x);
    expect(r.y).toBeGreaterThanOrEqual(wa.y);
  });
});

describe("clampDrag", () => {
  it("x floored at 0, y floored at barH", () => {
    expect(clampDrag(-50, -50, 30)).toEqual({ x: 0, y: 30 });
    expect(clampDrag(100, 200, 30)).toEqual({ x: 100, y: 200 });
  });
  it("NO right/bottom clamp during drag (proto §1.6 — unlike openRect/reclamp)", () => {
    expect(clampDrag(99999, 99999, 30)).toEqual({ x: 99999, y: 99999 });
  });
});

describe("clampResize", () => {
  it("min 360 x 280", () => {
    expect(clampResize(100, 100)).toEqual({ w: 360, h: 280 });
    expect(clampResize(900, 600)).toEqual({ w: 900, h: 600 });
  });
});

describe("maximizeRect", () => {
  it("returns the full work area", () => {
    const wa = workArea("aqua", 1440, 900);
    expect(maximizeRect(wa)).toEqual({ x: 8, y: 36, w: 1424, h: 778 });
  });
});

describe("reclampOnTheme", () => {
  it("normal window clamped with 8px inset, not resized", () => {
    const wa = workArea("aqua", 1440, 900);
    const out = reclampOnTheme({ x: 5000, y: 5000, w: 400, h: 300 }, wa);
    expect(out.w).toBe(400);
    expect(out.h).toBe(300);
    expect(out.x).toBe(wa.x + wa.w - 400 - 8);
    expect(out.y).toBe(wa.y + wa.h - 300 - 8);
  });
});

describe("tile", () => {
  it("cols=⌈√n⌉, gap 12, rounded rects; n=4 ⇒ 2x2", () => {
    const wa = workArea("aqua", 1440, 900);
    const rects = tile(4, wa);
    expect(rects).toHaveLength(4);
    const cw = Math.round((wa.w - 12) / 2);
    expect(rects[0]).toEqual({ x: wa.x, y: wa.y, w: cw, h: Math.round((wa.h - 12) / 2) });
  });
  it("n=0 ⇒ []", () => {
    expect(tile(0, workArea("aqua", 1440, 900))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- geometry
```
Expected: `Cannot find module './geometry'` (red).

- [ ] **Step 3: Implement `lib/wm/geometry.ts`** translating `proto.md` §1.2–§1.10 (consume the
  aqua chrome constants from `themes/index` `barH`/`rail` so chrome + math share one source). All
  functions are pure; `openRect` takes `(app:{w,h}, wa:Rect, n:number)`, `tile` takes `(n, wa)`.

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- geometry
```
Expected: all geometry tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/wm/geometry.ts frontend/src/lib/wm/geometry.test.ts
git commit -m "feat(wm): work-area/openRect/clamp/maximize/reclamp/tile geometry (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.6: `lib/wm/zorder` — monotonic z + focus + active rule (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.2]

**Files:**
- Test `frontend/src/lib/wm/zorder.test.ts`
- Create `frontend/src/lib/wm/zorder.ts`

Pure z-order math. Initial counter **20** (`proto.md` §1.5); `bump(z)→z+1`; active/top window =
highest `z` among non-minimized.

- [ ] **Step 1: Write the failing test.**
```ts
import { describe, it, expect } from "vitest";
import { INITIAL_Z, bump, topWindow } from "./zorder";

describe("zorder", () => {
  it("initial z counter is 20", () => { expect(INITIAL_Z).toBe(20); });
  it("bump increments", () => { expect(bump(20)).toBe(21); });
  it("topWindow = highest z among non-minimized", () => {
    const wins = [
      { id: "a", z: 21, min: false }, { id: "b", z: 25, min: false }, { id: "c", z: 99, min: true },
    ];
    expect(topWindow(wins)).toBe("b");
  });
  it("topWindow null when all minimized or empty", () => {
    expect(topWindow([{ id: "a", z: 5, min: true }])).toBeNull();
    expect(topWindow([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- zorder
```
Expected: `Cannot find module './zorder'` (red).

- [ ] **Step 3: Implement `lib/wm/zorder.ts`** (`INITIAL_Z=20`, `bump`, `topWindow` filtering
  `!min` then `max z`).

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- zorder
```
Expected: 4 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/wm/zorder.ts frontend/src/lib/wm/zorder.test.ts
git commit -m "feat(wm): z-order counter + focus + active-window rule (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.7: WM + theme Zustand stores (TDD, thin over lib) [owner: deepak] [verify: headless] [blockedBy: E1.5, E1.6]

**Files:**
- Test `frontend/src/stores/windowManager.test.ts`
- Create `frontend/src/stores/windowManager.ts`
- Test `frontend/src/stores/theme.test.ts`
- Create `frontend/src/stores/theme.ts`

The stores hold `{windows[], z}` / `{theme, device}` and **delegate all math to `lib/wm/*`**.
Tests drive the store actions headlessly (Zustand vanilla store, no React) and assert behaviors
from `proto.md` §1.4–§1.9 (open focus-or-spawn, no-duplicate, drag/resize clamps, maximize stores
`prev`, theme change re-clamps).

- [ ] **Step 1: Write the failing tests** for `windowManager` (open spawns inside work area; opening
  the same app focuses, never duplicates; `move` clamps `x≥0,y≥barH`; `resize` clamps `≥360×280`;
  `toggleMax` stores `prev` then restores; `focus` bumps z; `tile` lays out non-min windows) and
  for `theme` (`setTheme` updates theme and re-clamps every window via `reclampOnTheme`; `setDevice`
  toggles device). Use `createStore` from `zustand/vanilla` and call `.getState()` actions; stub
  `window.innerWidth/Height` to 1440×900 in `beforeEach`.

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- windowManager theme
```
Expected: `Cannot find module './windowManager'` (red).

- [ ] **Step 3: Implement `stores/windowManager.ts` + `stores/theme.ts`** — thin Zustand stores
  delegating to `lib/wm/geometry` + `lib/wm/zorder`. `openApp` implements `proto.md` §1.4
  (mobile → `mobileApp`; already-open → un-min + bump; else `openRect`). `closeApp/minimize` carry
  the snake stop/pause hooks as injectable callbacks (so the engine isn't imported here).

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- windowManager theme
```
Expected: all store tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/stores
git commit -m "feat(os): windowManager + theme Zustand stores (thin over lib/wm)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.8: `lib/terminal/parser` (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.2]

**Files:**
- Test `frontend/src/lib/terminal/parser.test.ts`
- Create `frontend/src/lib/terminal/parser.ts`

Tokenize per `proto.md` §4.1: `clear` special-cased; split on `/\s+/`; `c0=parts[0].toLowerCase()`;
`args=parts.slice(1)`; `arg=args.join(' ')`; empty input flagged.

- [ ] **Step 1: Write the failing test.**
```ts
import { describe, it, expect } from "vitest";
import { parse } from "./parser";

describe("terminal parse", () => {
  it("splits c0/args/arg and lowercases c0", () => {
    expect(parse("Open Snake")).toMatchObject({ c0: "open", args: ["Snake"], arg: "Snake", clear: false, empty: false });
  });
  it("collapses whitespace", () => {
    expect(parse("echo   a   b")).toMatchObject({ c0: "echo", arg: "a b" });
  });
  it("flags clear as special", () => {
    expect(parse("clear").clear).toBe(true);
  });
  it("flags empty input", () => {
    expect(parse("   ").empty).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- parser
```
Expected: `Cannot find module './parser'` (red).

- [ ] **Step 3: Implement `lib/terminal/parser.ts`.**

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- parser
```
Expected: 4 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/terminal/parser.ts frontend/src/lib/terminal/parser.test.ts
git commit -m "feat(terminal): command-line parser (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.9: `lib/terminal/dispatch` — command engine returning effect intents (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.8]

**Files:**
- Test `frontend/src/lib/terminal/dispatch.test.ts`
- Create `frontend/src/lib/terminal/dispatch.ts`

The command table from `proto.md` §4.2. **Effects (`openApp`/`setTheme`/`setDevice`) are RETURNED,
not executed** — the linchpin that makes the engine headlessly testable. Assert output lines +
returned effect intents + line classes. Prompt `devesh@samagra:~$`.

- [ ] **Step 1: Write the failing test** (exact behaviors).
```ts
import { describe, it, expect } from "vitest";
import { dispatch, PROMPT } from "./dispatch";
import { APPS, ORDER } from "../../registry";

const ctx = { order: ORDER, apps: APPS };

describe("terminal dispatch", () => {
  it("open <app> resolves an id and returns an openApp effect", () => {
    const r = dispatch("open snake", ctx);
    expect(r.effects).toContainEqual({ kind: "openApp", value: "snake" });
    expect(r.lines.some((l) => l.c === "ok")).toBe(true);
  });
  it("open <name> resolves a single-word display name", () => {
    const r = dispatch("open clock", ctx);
    expect(r.effects).toContainEqual({ kind: "openApp", value: "clock" });
  });
  it("open unknown errors and emits no effect", () => {
    const r = dispatch("open zzz", ctx);
    expect(r.effects).toHaveLength(0);
    expect(r.lines.some((l) => l.c === "err")).toBe(true);
  });
  it("theme valid → setTheme effect; invalid → err", () => {
    expect(dispatch("theme console", ctx).effects).toContainEqual({ kind: "setTheme", value: "console" });
    expect(dispatch("theme nope", ctx).effects).toHaveLength(0);
  });
  it("device valid → setDevice effect", () => {
    expect(dispatch("device mobile", ctx).effects).toContainEqual({ kind: "setDevice", value: "mobile" });
  });
  it("ls joins ORDER ids", () => {
    const out = dispatch("ls", ctx).lines.map((l) => l.t).join("\n");
    expect(out).toContain("dashboard");
    expect(out).toContain("settings");
  });
  it("whoami is exact", () => {
    expect(dispatch("whoami", ctx).lines.map((l) => l.t).join("")).toContain("devesh — Founder & Chairman");
  });
  it("sudo easter egg errors with the board line", () => {
    const r = dispatch("sudo rm", ctx);
    expect(r.lines.some((l) => l.c === "err" && l.t.includes("only the board"))).toBe(true);
  });
  it("unknown command", () => {
    const r = dispatch("frobnicate", ctx);
    expect(r.lines.some((l) => l.c === "err" && l.t.includes("command not found: frobnicate"))).toBe(true);
  });
  it("echo prints the arg", () => {
    expect(dispatch("echo hello world", ctx).lines.map((l) => l.t).join("")).toContain("hello world");
  });

  // ── Prototype-fidelity guards (proto.md §4.1–§4.2) ─────────────────────────
  const text = (cmd: string) => dispatch(cmd, ctx).lines.map((l) => l.t).join("\n");

  it("prompt constant is devesh@samagra:~$ (proto §4.1)", () => {
    expect(PROMPT).toBe("devesh@samagra:~$");
  });
  it("help lists every documented verb (proto §4.2)", () => {
    const out = text("help");
    for (const verb of [
      "help", "status", "catalog", "agents", "pipelines", "ls",
      "open", "theme", "device", "neofetch", "whoami", "date", "echo", "clear",
    ]) {
      expect(out).toContain(verb);
    }
  });
  it("status carries the artifacts/tests/repo facts (proto §4.2)", () => {
    const out = text("status");
    expect(out).toContain("7,044");
    expect(out).toContain("11/11");
    expect(out).toContain("github.com/dbhardwaj86/samagra");
  });
  it("agents === org === board (all three aliases identical, proto §4.2)", () => {
    expect(text("agents")).toBe(text("org"));
    expect(text("org")).toBe(text("board"));
  });
  it("pipelines emits 4 bars with pcts 74/91/46/33 (proto §4.2)", () => {
    const lines = dispatch("pipelines", ctx).lines;
    const bars = lines.filter((l) => /[█·]{20}/.test(l.t)); // each bar rendered to width 20
    expect(bars).toHaveLength(4);
    // bar fill length = round(pct/5); width 20
    const filled = (l: { t: string }) => (l.t.match(/█/g) || []).length;
    expect(bars.map(filled)).toEqual([74, 91, 46, 33].map((p) => Math.round(p / 5)));
  });
  it("catalog has the accent header + 7 source rows (proto §4.2)", () => {
    const lines = dispatch("catalog", ctx).lines;
    const rows = lines.filter((l) => l.c === "fg"); // header is accent, rows are fg
    expect(rows).toHaveLength(7);
  });
  it("neofetch is a 7-line system card (proto §4.2)", () => {
    expect(dispatch("neofetch", ctx).lines).toHaveLength(7);
  });
  it("about emits the accent title + 2 description lines (proto §4.2)", () => {
    const lines = dispatch("about", ctx).lines;
    expect(lines.some((l) => l.c === "accent")).toBe(true);
    expect(lines.filter((l) => l.c === "fg")).toHaveLength(2);
  });
  it("date returns a Date string (proto §4.2 — new Date().toString())", () => {
    expect(text("date")).toContain(String(new Date().getFullYear()));
  });
  it("clear empties the buffer (proto §4.2 — special-cased)", () => {
    const r = dispatch("clear", ctx);
    expect(r.lines).toEqual([]);
    expect(r.clear).toBe(true);
  });
});
```

> **Note for Step 3:** export the prompt constant `PROMPT = "devesh@samagra:~$"` from `dispatch.ts`
> and import it in the test (`import { dispatch, PROMPT } from "./dispatch";`). `clear` returns
> `{ lines: [], effects: [], clear: true }` so the wrapper can reset its buffer. The 7 catalog rows
> are the sources QX / physics-textbook / booklet-proofer / INSP-extract / pratyaksh / mycontentdev /
> munshi (proto §4.2). neofetch's 7 lines = समग्र SAMAGRA OS / OS / Host / Catalog / Agents / Tests /
> Stack. Pipeline bar = `█`×round(pct/5) + `·`×(20−round(pct/5)), labels Lectures 74 / Questions 91 /
> Print & Proofing 46 / Editorial seeds 33.

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- dispatch
```
Expected: `Cannot find module './dispatch'` (red).

- [ ] **Step 3: Implement `lib/terminal/dispatch.ts`** — the full command table (help/status/catalog/
  agents·org·board/pipelines·pipe/ls/open/theme/device/neofetch/whoami/date/echo/about/sudo/clear/
  unknown) per `proto.md` §4.2, returning `{lines, effects, clear?}`. Export `PROMPT =
  "devesh@samagra:~$"`. `open` resolves `args[0].toLowerCase()` against `ORDER` ids + single-word
  display names. `status`/`catalog`/`agents`/`pipelines` emit the canned banner text (live `/api`
  is optional — out of E1 dispatch scope); `pipelines` renders each bar as `█`×round(pct/5) +
  `·`×(20−round(pct/5)) for pcts 74/91/46/33; `agents`/`org`/`board` return byte-identical line
  arrays; `clear` returns `{lines:[], effects:[], clear:true}`.

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- dispatch
```
Expected: all dispatch tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/terminal/dispatch.ts frontend/src/lib/terminal/dispatch.test.ts
git commit -m "feat(terminal): command dispatch table returning effect intents (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.10: `lib/clock/analog` — hand angles + face geometry (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.2]

**Files:**
- Test `frontend/src/lib/clock/analog.test.ts`
- Create `frontend/src/lib/clock/analog.ts`

Pure trig over a `Date` (`proto.md` §3.1). `secA=s*6`, `minA=m*6+s*0.1`, `hrA=(hr%12)*30+m*0.5`;
endpoints on 300×300, R=120, second-hand tail 30.

- [ ] **Step 1: Write the failing test.**
```ts
import { describe, it, expect } from "vitest";
import { handAngles, handEndpoint } from "./analog";

describe("clock analog", () => {
  it("hand angles at 03:15:30", () => {
    const d = new Date(2026, 5, 20, 3, 15, 30);
    expect(handAngles(d)).toEqual({ secA: 180, minA: 93, hrA: 97.5 });
  });
  it("12 o'clock maps to 0deg hour angle", () => {
    expect(handAngles(new Date(2026, 5, 20, 12, 0, 0)).hrA).toBe(0);
  });
  it("endpoint of a 0deg hand points straight up from center", () => {
    const e = handEndpoint(150, 150, 0, 102, 30);
    expect(Math.round(e.x2)).toBe(150);
    expect(Math.round(e.y2)).toBe(48); // 150 - 102
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- analog
```
Expected: `Cannot find module './analog'` (red).

- [ ] **Step 3: Implement `lib/clock/analog.ts`** (angles + `handEndpoint(cx,cy,ang,len,tail)` using
  `rad=(ang-90)π/180`; export tick/numeral geometry helpers per §3.1).

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- analog
```
Expected: 3 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/clock/analog.ts frontend/src/lib/clock/analog.test.ts
git commit -m "feat(clock): analog hand angles + face geometry (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.10b: `lib/clock/digital` — 12-hour readout + pad2 (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.2]

**Files:**
- Test `frontend/src/lib/clock/digital.test.ts`
- Create `frontend/src/lib/clock/digital.ts`

The digital readout the analog task left untested. Pure string math over a `Date` (`proto.md` §3.2):
`pad2(n) = (n<10?'0':'')+n`; `fmt12(d)` →
`pad2(hr%12===0?12:hr%12) + ':' + pad2(m) + ':' + pad2(s) + ' ' + (hr<12?'AM':'PM')`. Midnight and
noon both read **12** (never 00); zero DOM, no `Intl`.

- [ ] **Step 1: Write the failing test** (exact `proto.md` §3.2 values).
```ts
import { describe, it, expect } from "vitest";
import { pad2, fmt12 } from "./digital";

describe("clock digital readout", () => {
  it("pad2 zero-pads single digits (proto §3.2)", () => {
    expect(pad2(5)).toBe("05");
    expect(pad2(0)).toBe("00");
    expect(pad2(12)).toBe("12");
  });
  it("midnight reads 12:..:.. AM (hr%12===0 ⇒ 12, not 00)", () => {
    expect(fmt12(new Date(2026, 5, 20, 0, 3, 9))).toEqual({ time: "12:03:09", ampm: "AM" });
  });
  it("noon reads 12:00:00 PM (hr<12 false ⇒ PM)", () => {
    expect(fmt12(new Date(2026, 5, 20, 12, 0, 0))).toEqual({ time: "12:00:00", ampm: "PM" });
  });
  it("afternoon hour wraps mod 12 (13 ⇒ 01 PM)", () => {
    expect(fmt12(new Date(2026, 5, 20, 13, 5, 7))).toEqual({ time: "01:05:07", ampm: "PM" });
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- "clock/digital"
```
Expected: `Cannot find module './digital'` (red).

- [ ] **Step 3: Implement `lib/clock/digital.ts`** — `pad2(n)` and `fmt12(d): {time, ampm}` exactly
  per §3.2 (`hr%12===0?12:hr%12`, `hr<12?'AM':'PM'`). `time` is the `HH:MM:SS` segment; `ampm` the
  meridiem — the component concatenates `time + ' ' + ampm`. Reuse `pad2` across the clock lib (the
  stopwatch/timer formatters import it rather than redefining).

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- "clock/digital"
```
Expected: 4 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/clock/digital.ts frontend/src/lib/clock/digital.test.ts
git commit -m "feat(clock): 12-hour digital readout + pad2 (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.11: `lib/clock/stopwatch` — drift-free elapsed + laps + fmtMs (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.2]

**Files:**
- Test `frontend/src/lib/clock/stopwatch.test.ts`
- Create `frontend/src/lib/clock/stopwatch.ts`

Wall-anchor drift-free elapsed (`start=now-elapsed`), lap splits, `fmtMs` per `proto.md` §3.3.
`now()` is **injected** (fake clock) so there's no real 33ms interval in the test.

- [ ] **Step 1: Write the failing test.**
```ts
import { describe, it, expect } from "vitest";
import { fmtMs, fmtSwMain, elapsedFrom, lapSplit } from "./stopwatch";

describe("stopwatch", () => {
  it("fmtMs formats MM:SS.cc", () => {
    expect(fmtMs(0)).toBe("00:00.00");
    expect(fmtMs(65430)).toBe("01:05.43"); // 1m 5s 43cs
  });
  it("fmtSwMain shows the hours segment only when hrs>0 (proto §3.3)", () => {
    expect(fmtSwMain(3_725_000)).toBe("01:02:05"); // 1h 2m 5s ⇒ HH:MM:SS
    expect(fmtSwMain(125_000)).toBe("02:05");       // 2m 5s, no hours ⇒ MM:SS
  });
  it("drift-free elapsed from an injected now", () => {
    const start = 1000; // anchored start
    expect(elapsedFrom(4210, start)).toBe(3210);
  });
  it("lap split is laps[i] - laps[i-1] (first minus 0)", () => {
    expect(lapSplit([1200, 3500], 0)).toBe(1200);
    expect(lapSplit([1200, 3500], 1)).toBe(2300);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- stopwatch
```
Expected: `Cannot find module './stopwatch'` (red).

- [ ] **Step 3: Implement `lib/clock/stopwatch.ts`** (`elapsedFrom(now,start)=now-start`,
  `fmtMs` with `cs/sec/min` per §3.3, `lapSplit`, and the main display `fmtSwMain(ms) =
  (hrs>0?pad2(hrs)+':':'') + pad2(min)+':'+pad2(sec)` per §3.3 — `hrs=floor(ms/3600000)`,
  `min=floor(ms/60000)%60`, `sec=floor(ms/1000)%60`).

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- stopwatch
```
Expected: 4 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/clock/stopwatch.ts frontend/src/lib/clock/stopwatch.test.ts
git commit -m "feat(clock): drift-free stopwatch elapsed + laps + fmtMs (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.12: `lib/clock/timer` — remaining + ring math + presets + done (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.2]

**Files:**
- Test `frontend/src/lib/clock/timer.test.ts`
- Create `frontend/src/lib/clock/timer.ts`

Remaining math, ring `frac`/`dashoffset` (`C=2π·110`), preset table, done detection per
`proto.md` §3.4. `now()` injected.

- [ ] **Step 1: Write the failing test.**
```ts
import { describe, it, expect } from "vitest";
import { PRESETS, remainingFrom, ringOffset, isDone, RING_C, CHIME } from "./timer";

describe("timer", () => {
  it("preset table = 1/5/10/25 min in seconds", () => {
    expect(PRESETS).toEqual([[60, "1 min"], [300, "5 min"], [600, "10 min"], [1500, "25 min"]]);
  });
  it("ring circumference C = 2*pi*110", () => {
    expect(RING_C).toBeCloseTo(2 * Math.PI * 110, 6);
  });
  it("remaining = end - now, floored at 0", () => {
    expect(remainingFrom(900, 1000)).toBe(100);
    expect(remainingFrom(2000, 1000)).toBe(0);
  });
  it("ringOffset = C*(1-frac); full at total=0", () => {
    expect(ringOffset(0, 0)).toBeCloseTo(0, 6);            // frac=1 ⇒ offset 0
    expect(ringOffset(50, 100)).toBeCloseTo(RING_C * 0.5, 6);
  });
  it("isDone when not running, total>0, remaining<=0", () => {
    expect(isDone(false, 1000, 0)).toBe(true);
    expect(isDone(true, 1000, 0)).toBe(false);
    expect(isDone(false, 0, 0)).toBe(false);
  });
  it("chime config = 880Hz sine + envelope (proto §3.4 — headless guard for beep())", () => {
    expect(CHIME).toEqual({
      freq: 880, type: "sine", gainPeak: 0.18, attack: 0.02, release: 0.7, stopAfter: 0.72,
    });
    // the load-bearing pitch — the WebAudio call in the component reads this constant
    expect(CHIME.freq).toBe(880);
    expect(CHIME.type).toBe("sine");
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- "clock/timer"
```
Expected: `Cannot find module './timer'` (red).

- [ ] **Step 3: Implement `lib/clock/timer.ts`** (`PRESETS`, `RING_C=2π*110`, `remainingFrom`,
  `ringOffset(remaining,total)` with `frac=total>0?max(0,remaining/total):1`, `isDone`, and
  `export const CHIME = {freq:880,type:"sine",gainPeak:0.18,attack:0.02,release:0.7,stopAfter:0.72}`
  per §3.4). The actual WebAudio `OscillatorNode` lives in the (visual) Clock wrapper (E1.22), but it
  **reads `CHIME`** for its frequency/type/envelope — the 880 constant is locked here, headlessly.

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- "clock/timer"
```
Expected: 6 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/clock/timer.ts frontend/src/lib/clock/timer.test.ts
git commit -m "feat(clock): timer remaining + ring offset + presets + done (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.13: `lib/clock/world` — zone table + day/night rule (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.2]

**Files:**
- Test `frontend/src/lib/clock/world.test.ts`
- Create `frontend/src/lib/clock/world.ts`

6 zones in exact order + day/night rule `day = 06:00–18:59 local` per `proto.md` §3.5. `hourNum`
is the function input (no real `Intl` dependency in the rule test).

- [ ] **Step 1: Write the failing test.**
```ts
import { describe, it, expect } from "vitest";
import { ZONES, isNight } from "./world";

describe("world clock", () => {
  it("6 zones in exact order", () => {
    expect(ZONES).toEqual([
      ["New Delhi", "Asia/Kolkata"], ["London", "Europe/London"], ["New York", "America/New_York"],
      ["San Francisco", "America/Los_Angeles"], ["Tokyo", "Asia/Tokyo"], ["Dubai", "Asia/Dubai"],
    ]);
  });
  it("day = 06:00–18:59 local; else night", () => {
    expect(isNight(5)).toBe(true);
    expect(isNight(6)).toBe(false);
    expect(isNight(18)).toBe(false);
    expect(isNight(19)).toBe(true);
    expect(isNight(0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- "clock/world"
```
Expected: `Cannot find module './world'` (red).

- [ ] **Step 3: Implement `lib/clock/world.ts`** (`ZONES` const + `isNight(h)=h<6||h>=19`; also a
  thin `zoneTime(date,tz)` helper over `Intl` for the component, not asserted in the rule test).

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- "clock/world"
```
Expected: 2 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/clock/world.ts frontend/src/lib/clock/world.test.ts
git commit -m "feat(clock): world-clock zone table + day/night rule (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.14: `lib/notes/model` — note/todo CRUD + derivations + seed (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.3]

**Files:**
- Test `frontend/src/lib/notes/model.test.ts`
- Create `frontend/src/lib/notes/model.ts`

Pure array transforms for note/todo CRUD, title/word-count/preview derivations, filters, and the
exact seed objects per `proto.md` §5.

- [ ] **Step 1: Write the failing test.**
```ts
import { describe, it, expect } from "vitest";
import {
  seedNotes, seedTodos, newNote, updNote, delNote, noteTitle, wordCount,
  addTodo, toggleTodo, delTodo, clearDone, filterTodos,
} from "./model";

describe("notes model", () => {
  it("seeds two notes with exact ids/titles", () => {
    const s = seedNotes(1_000_000_000_000);
    expect(s.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(s[0].title).toBe("Capacitor energy explainer");
    expect(s[1].title).toBe("Rotational motion — Aarav");
  });
  it("seeds four todos with exact done flags", () => {
    const t = seedTodos();
    expect(t.map((x) => x.id)).toEqual(["t1", "t2", "t3", "t4"]);
    expect(t.map((x) => x.done)).toEqual([false, false, true, false]);
  });
  it("newNote prepends an empty note", () => {
    const out = newNote([], 5);
    expect(out[0]).toMatchObject({ title: "", body: "", ts: 5 });
  });
  it("updNote re-stamps ts", () => {
    const [n] = newNote([], 5);
    const out = updNote([n], n.id, "title", "X", 9);
    expect(out[0]).toMatchObject({ title: "X", ts: 9 });
  });
  it("noteTitle falls back to first body line then Untitled", () => {
    expect(noteTitle({ id: "x", title: "  ", body: "Hello\nworld", ts: 0 })).toBe("Hello");
    expect(noteTitle({ id: "x", title: "", body: "", ts: 0 })).toBe("Untitled");
  });
  it("wordCount counts non-space runs", () => {
    expect(wordCount("  a  bb   ccc ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
  it("todo CRUD + filters", () => {
    let t = addTodo([], "buy", 7);
    expect(t[0]).toMatchObject({ text: "buy", done: false });
    t = addTodo(t, "   ", 8); // blank → no-op
    expect(t).toHaveLength(1);
    t = toggleTodo(t, t[0].id);
    expect(filterTodos(t, "done")).toHaveLength(1);
    expect(filterTodos(t, "active")).toHaveLength(0);
    t = clearDone(t);
    expect(t).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- "notes/model"
```
Expected: `Cannot find module './model'` (red).

- [ ] **Step 3: Implement `lib/notes/model.ts`** — pure transforms + the verbatim seed objects from
  `proto.md` §5.3 (seed bodies exactly; `seedNotes(now)` stamps `now-3600e3` / `now-7200e3`).
  `noteTitle = title.trim() || firstLine(body).trim() || 'Untitled'`;
  `wordCount = (String(s).trim().match(/\S+/g)||[]).length`.

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- "notes/model"
```
Expected: all notes-model tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/notes/model.ts frontend/src/lib/notes/model.test.ts
git commit -m "feat(notes): note/todo model — CRUD, derivations, seed (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.15: `lib/snake/cell` — responsive cell-size formula (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.2]

**Files:**
- Test `frontend/src/lib/snake/cell.test.ts`
- Create `frontend/src/lib/snake/cell.ts`

Responsive cell formula per `proto.md` §2.2: default 18; with a window rect
`availW=win.w-40`, `availH=win.h-38-250`, `cell=clamp(11,28, floor(min(availW,availH)/19))`.

- [ ] **Step 1: Write the failing test.**
```ts
import { describe, it, expect } from "vitest";
import { cellSize, boardPx } from "./cell";

describe("snake cell", () => {
  it("default cell = 18 with no window", () => {
    expect(cellSize()).toBe(18);
    expect(boardPx(18)).toEqual({ w: 342, h: 342 }); // 19*18
  });
  it("scales from window rect, clamped 11..28", () => {
    // availW=w-40, availH=h-288; cell=floor(min/19)
    expect(cellSize({ w: 480, h: 680 })).toBe(Math.min(28, Math.max(11, Math.floor(Math.min(440, 392) / 19))));
    expect(cellSize({ w: 200, h: 200 })).toBe(11); // tiny → floor at 11
    expect(cellSize({ w: 2000, h: 2000 })).toBe(28); // huge → cap at 28
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- "snake/cell"
```
Expected: `Cannot find module './cell'` (red).

- [ ] **Step 3: Implement `lib/snake/cell.ts`** (`cellSize(win?)`, `boardPx(cell)=19*cell`).

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- "snake/cell"
```
Expected: 2 tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/snake/cell.ts frontend/src/lib/snake/cell.test.ts
git commit -m "feat(snake): responsive cell-size + board-px formula (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.16: `lib/snake/engine` — init/dir/step reducer with injected RNG (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.15]

**Files:**
- Test `frontend/src/lib/snake/engine.test.ts`
- Create `frontend/src/lib/snake/engine.ts`

The snake reducer per `proto.md` §2.1–§2.7. Pure `(state,input)→state` with **injected RNG** for
food (deterministic), so death/no-reverse/grow/speed-ramp are all asserted without a canvas or
interval.

- [ ] **Step 1: Write the failing test.**
```ts
import { describe, it, expect } from "vitest";
import { LEVELS, COLS, ROWS, init, setDir, step, food } from "./engine";

const rng0 = () => 0; // deterministic: food at [0,0] (resampled off-body)

describe("snake engine", () => {
  it("level table is exact", () => {
    expect(LEVELS.relaxed).toEqual({ base: 215, floor: 135, dec: 2 });
    expect(LEVELS.normal).toEqual({ base: 135, floor: 70, dec: 3 });
    expect([COLS, ROWS]).toEqual([19, 19]);
  });
  it("init: body [[9,9],[8,9],[7,9]], dir right, speed base, idle", () => {
    const s = init("normal", rng0);
    expect(s.body).toEqual([[9, 9], [8, 9], [7, 9]]);
    expect(s.dir).toEqual([1, 0]);
    expect(s.speed).toBe(135);
    expect(s.status).toBe("idle");
    expect(s.score).toBe(0);
  });
  it("no-reverse: cannot set dir opposite to committed dir", () => {
    const s = { ...init("normal", rng0), status: "running" as const };
    expect(setDir(s, [-1, 0]).next).toEqual(s.dir); // ignored
    expect(setDir(s, [0, -1]).next).toEqual([0, -1]); // allowed
  });
  it("step moves head, trims tail when no eat (constant length)", () => {
    const s = { ...init("normal", rng0), status: "running" as const, food: [15, 15] as [number, number] };
    const out = step(s, rng0);
    expect(out.body[0]).toEqual([10, 9]); // head moved right
    expect(out.body).toHaveLength(3);     // grew head, dropped tail
  });
  it("death on wall hit clears to dead", () => {
    let s = { ...init("normal", rng0), status: "running" as const };
    s = { ...s, body: [[18, 9], [17, 9], [16, 9]], dir: [1, 0], next: [1, 0] };
    const out = step(s, rng0);
    expect(out.status).toBe("dead");
  });
  it("eat grows + scores +10 + ramps speed by dec floored", () => {
    const s = { ...init("normal", rng0), status: "running" as const, food: [10, 9] as [number, number] };
    const out = step(s, rng0);
    expect(out.score).toBe(10);
    expect(out.body).toHaveLength(4);      // grew (no trim)
    expect(out.speed).toBe(135 - 3);       // base - dec
  });
  it("following your own tail is legal (tail cell exempt)", () => {
    // a body where the head would land on the current tail cell after it vacates
    const s = {
      ...init("normal", rng0), status: "running" as const,
      body: [[10, 9], [10, 10], [9, 10], [9, 9]], dir: [-1, 0], next: [-1, 0], food: [0, 0] as [number, number],
    };
    // head -> [9,9] which is the LAST cell (tail) → not a death
    expect(step(s, rng0).status).toBe("running");
  });
  it("food rejection-resamples off the body", () => {
    // rng forces [9,9] (on body) first, then a free cell
    let calls = 0;
    const rng = () => (calls++ < 2 ? 9 / 19 : 0); // first sample on body, then [0,0]
    const f = food([[9, 9], [8, 9], [7, 9]], rng);
    expect(f).not.toEqual([9, 9]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd frontend && npm test -- "snake/engine"
```
Expected: `Cannot find module './engine'` (red).

- [ ] **Step 3: Implement `lib/snake/engine.ts`** per §2 — `LEVELS`, `COLS/ROWS=19`,
  `init(level,rng)`, `food(body,rng)` (rejection resample), `setDir(state,[dx,dy])` (reverse guard
  vs committed `dir`), `step(state,rng)` (death checks incl. tail-exempt self-collision; eat → grow
  + `+10` + `speed=max(floor,speed-dec)`; no-eat → trim tail). No interval/canvas here.

- [ ] **Step 4: Run — expect PASS.**
```bash
cd frontend && npm test -- "snake/engine"
```
Expected: all engine tests pass.

- [ ] **Step 5: Gate + commit.**
```bash
cd frontend && npm run verify
cd /c/SandBox/claude_box/TeachingOS
git add frontend/src/lib/snake/engine.ts frontend/src/lib/snake/engine.test.ts
git commit -m "feat(snake): engine reducer — init/dir/step/food with injected RNG (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.17: FastAPI serve seam — retire jinja, serve dist/, SPA fallback (TDD) [owner: deepak] [verify: headless] [blockedBy: E1.1]

**Files:**
- Modify `samagra/api/app.py`
- Test `tests/test_serve_seam.py`
- Modify `.gitignore` (if not already done in E1.1)

Retire the jinja `index` route + `/static` mount + `Jinja2Templates`; mount `dist/assets`; add a
`GET /{full_path:path}` SPA fallback **declared LAST** that 404s `api/*` and returns
`dist/index.html` (503 if unbuilt). `/api/*`, `/lecture/{slug}`, `/open` unchanged. pytest calls
the route functions directly (no live server); `conftest.py` isolation applies. This is a **Python
backend** task — run `.venv\Scripts\python -m pytest`.

- [ ] **Step 1: Write the failing test** `tests/test_serve_seam.py`:
```python
"""Serve-seam tests: SPA fallback never shadows the API; serves index when built."""
from __future__ import annotations

import importlib
from pathlib import Path

import pytest
from fastapi import HTTPException

from samagra import config
from samagra.api import app as app_module


def test_spa_fallback_404s_api_paths():
    with pytest.raises(HTTPException) as ei:
        app_module.spa("api/overview")
    assert ei.value.status_code == 404


def test_spa_fallback_503_when_not_built(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "REPO_ROOT", tmp_path)  # dist absent
    importlib.reload(app_module)
    with pytest.raises(HTTPException) as ei:
        app_module.spa("dashboard")
    assert ei.value.status_code == 503
    importlib.reload(app_module)  # restore real module


def test_spa_fallback_serves_index_when_built(monkeypatch, tmp_path):
    dist = tmp_path / "frontend" / "dist"
    dist.mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><div id=root>", encoding="utf-8")
    monkeypatch.setattr(config, "REPO_ROOT", tmp_path)
    importlib.reload(app_module)
    resp = app_module.spa("notes")
    assert Path(resp.path).name == "index.html"
    importlib.reload(app_module)


def test_jinja_index_route_is_gone():
    paths = {r.path for r in app_module.app.routes}
    assert "/static" not in paths  # /static mount removed
```

- [ ] **Step 2: Run — expect FAIL.**
```bash
cd /c/SandBox/claude_box/TeachingOS
.venv\Scripts\python -m pytest tests/test_serve_seam.py -q
```
Expected: `AttributeError: module 'samagra.api.app' has no attribute 'spa'` (red).

- [ ] **Step 3: Implement the seam** in `samagra/api/app.py` per `repo.md` §3 / `api.md` §4:
  delete the jinja `index` route, the `/static` mount, and `Jinja2Templates`; add
  `FRONTEND_DIST = config.REPO_ROOT / "frontend" / "dist"`; mount
  `app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST/"assets")), name="assets")`
  (guarded by `FRONTEND_DIST.exists()`); add the `spa(full_path)` catch-all as the **LAST** route
  (404 on `full_path.startswith("api/")`, 503 if `index.html` missing, else `FileResponse`).
  Keep every `/api/*`, `/lecture/{slug}`, `/open` route above it.

- [ ] **Step 4: Run — expect PASS** + confirm the existing suite still green.
```bash
cd /c/SandBox/claude_box/TeachingOS
.venv\Scripts\python -m pytest tests/test_serve_seam.py -q
.venv\Scripts\python -m pytest -q
```
Expected: serve-seam tests pass; full suite green (existing count + the 4 new).

- [ ] **Step 5: Gate + commit.**
```bash
cd /c/SandBox/claude_box/TeachingOS
git add samagra/api/app.py tests/test_serve_seam.py .gitignore
git commit -m "feat(api): serve Vite dist/ with SPA fallback; retire jinja portal route

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task E1.18: Aqua shell chrome — TopBar / Dock / WindowFrame / ContextMenu (thin wrappers) [owner: deepak] [verify: visual] [blockedBy: E1.7, E1.4]

> **VISUAL task — pixel/interaction fidelity is a separate human QA pass (§Testing §7.4 of the
> spec), NOT a loop completion signal.** The loop gate is only `npm run verify` (lint/tsc/build +
> light RTL smoke tests that the component renders and calls the store action). Aqua parity
> against the prototype + `screenshots/` is owner-signed-off.

**Files:**
- Create `frontend/src/shell/TopBar.tsx`, `Dock.tsx`, `WindowFrame.tsx`, `ContextMenu.tsx`
- Modify `frontend/src/App.tsx` (assemble the shell)
- Test `frontend/src/shell/*.test.tsx` (RTL smoke only)

Thin React wrappers over the WM/theme stores + `themes/` tokens. TopBar 30px (wordmark + active
title + status pill + live clock); Dock bottom-center radius 20 (renders `ORDER`, calls
`openApp`); WindowFrame radius 13, left traffic-lights, 38px title bar, double-click maximize,
right-click → ContextMenu (width 216). Work-area `{8,36,vw-16,vh-122}` consumed from
`lib/wm/geometry`. RTL smoke tests assert render + that a Dock click dispatches `openApp`; pixels
are human QA.

- [ ] **Step 1: RTL smoke tests** — each shell component renders without crashing; a Dock icon
  click calls the WM store `openApp`. (No pixel assertions.)
- [ ] **Step 2: Run — expect FAIL** (`Cannot find module './TopBar'`).
- [ ] **Step 3: Implement the four chrome components** as thin wrappers over the stores +
  `themes.aqua`, mirroring the prototype's aqua chrome (constants from `proto.md` §1.1, §7).
  **Cross-branch build invariant:** when assembling `App.tsx` here, render open windows ONLY via
  the frozen `registry.ts` lazy imports (`React.lazy(() => import("./apps/<App>"))`). **Never add a
  static `import` of a khanak-owned app** (`apps/Clock`, `apps/Notes`, `apps/Snake`) — a static
  import would make `App.tsx` fail to compile on `agent/deepak` before khanak's leaf files exist,
  reintroducing a cross-branch build dependency. deepak's own apps use the same lazy-via-registry
  path for symmetry. (See division §1 † and the schema-freeze rule.)
- [ ] **Step 4: Run — expect PASS** (smoke green); `npm run verify`.
- [ ] **Step 5: Commit** `feat(shell): aqua chrome — top bar, dock, window frame, context menu`.
- [ ] **Step 6 (human, separate):** owner opens `npm run dev` and signs off aqua parity vs
  `screenshots/`. Not a loop gate.

---

### Task E1.19: Dashboard app + `/api` data hook (thin wrapper) [owner: deepak] [verify: visual] [blockedBy: E1.18]

> **VISUAL task.** Loop gates on `npm run verify` + an RTL smoke test that mocks `fetch` and
> asserts the app renders hero stats from a canned `/api/overview` payload. Layout/density parity
> is human QA.

**Files:**
- Create `frontend/src/hooks/useApi.ts`, `frontend/src/apps/Dashboard/index.tsx`
- Test `frontend/src/apps/Dashboard/index.test.tsx` (RTL, mocked fetch)
- (Optional, separate pytest) `samagra/api/app.py` `GET /api/dashboard` aggregator + `tests/test_dashboard_api.py`

Reads `/api/overview` + `/api/pipelines` + `/api/assignments` (per `api.md` §2 Dashboard) and
renders hero stats / pipeline bars / board + recent activity. `useApi` is a typed thin fetch hook
against the `ApiClient` contract; the per-source `summary` shape is read defensively (heterogeneous
— do not assume flat). The optional flat `GET /api/dashboard` aggregator (pure read-only over
`catalog.overview()` + `state.all_states()` + `gstore.list_events`) gets its own headless pytest
if built.

- [ ] **Step 1:** RTL smoke test (mock `fetch` → canned overview; assert a hero stat renders). If
  building `/api/dashboard`: write `tests/test_dashboard_api.py` first (RED).
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3:** Implement `useApi` + `Dashboard/index.tsx` (+ optional aggregator endpoint).
- [ ] **Step 4: Run — expect PASS;** `npm run verify` (+ `pytest -q` if endpoint built).
- [ ] **Step 5: Commit** `feat(apps): Dashboard app + typed /api data hook`.
- [ ] **Step 6 (human):** parity sign-off.

---

### Task E1.20: Settings app — appearance + device + integrations (thin wrapper) [owner: deepak] [verify: visual] [blockedBy: E1.18]

> **VISUAL task.** Loop gates on `npm run verify` + RTL smoke (theme radio sets `theme` store;
> integration rows render from a mocked `/api/overview`).

**Files:**
- Create `frontend/src/apps/Settings/index.tsx`
- Test `frontend/src/apps/Settings/index.test.tsx` (RTL)

Appearance (aqua selected; theme/device **client-only** via the theme store), Device toggle, and
Integration rows derived from `/api/overview` `sources[].available` (0/1 → active/needs-creds
pills, per `api.md` §2 Settings). Theme/device mutations are store actions — assert them in the
smoke test (headless part); visuals are human QA.

- [ ] **Step 1:** RTL smoke: clicking the console theme radio calls `setTheme('console')`.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3:** Implement `Settings/index.tsx`.
- [ ] **Step 4: Run — expect PASS;** `npm run verify`.
- [ ] **Step 5: Commit** `feat(apps): Settings — appearance, device, integration rows`.
- [ ] **Step 6 (human):** parity sign-off.

---

### Task E1.21: Terminal app — thin wrapper over `lib/terminal` (effect runner) [owner: deepak] [verify: visual] [blockedBy: E1.9, E1.18]

> **VISUAL task.** The *logic* is already green in `lib/terminal` (E1.8/E1.9). The wrapper only
> renders lines + runs returned effects against the stores. Loop gates on `npm run verify` + RTL
> smoke (typing `open snake` + Enter triggers the WM `openApp`).

**Files:**
- Create `frontend/src/apps/Terminal/index.tsx`
- Test `frontend/src/apps/Terminal/index.test.tsx` (RTL)

The wrapper feeds input → `parse` → `dispatch` → renders `lines` (colored by `LineClass` from the
aqua `termPalette`) and **executes the returned `effects`** (`openApp`/`setTheme`/`setDevice`)
against the WM/theme stores. Prompt `devesh@samagra:~$`. Keyboard input must not be hijacked by
Snake (the Snake-active gate, E1.24).

- [ ] **Step 1:** RTL smoke: submit `open snake` → WM store gains a snake window (mock the store).
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3:** Implement `Terminal/index.tsx` (effect runner; welcome banner from §4).
- [ ] **Step 4: Run — expect PASS;** `npm run verify`.
- [ ] **Step 5: Commit** `feat(apps): Terminal wrapper — render lines + run effect intents`.
- [ ] **Step 6 (human):** parity sign-off.

---

### Task E1.22: Clock app — thin wrapper over `lib/clock/*` + `useInterval` [owner: khanak] [verify: visual] [blockedBy: E1.10, E1.10b, E1.11, E1.12, E1.13, E1.18]

> **VISUAL task.** All clock math is already green in `lib/clock/*` (deepak). khanak's wrapper
> renders the four tabs and wires a `useInterval` (1s clock / 33ms sw / 200ms timer) — **interval
> hygiene** (created on mount, cleared on unmount/stop/pause) is the only new logic and gets a
> small RTL/fake-timer test; angles/elapsed/ring/zones are NOT re-tested here.

**Files:**
- Create `frontend/src/hooks/useInterval.ts`, `frontend/src/apps/Clock/index.tsx`
- Test `frontend/src/hooks/useInterval.test.ts` (fake timers), `frontend/src/apps/Clock/index.test.tsx` (RTL smoke)

Tabs `clock | stopwatch | timer | world` (default `clock`). Analog face from `lib/clock/analog` +
digital readout from `lib/clock/digital` (`fmt12`/`pad2`); stopwatch from `lib/clock/stopwatch`
(`fmtSwMain` + laps); timer from `lib/clock/timer` (ring + `beep()` WebAudio chime reading `CHIME`
— `type`/`frequency`/envelope from the const, try/catch no-op); world from `lib/clock/world`.
`useInterval` is a tested cleanup-safe hook.

- [ ] **Step 1:** `useInterval` fake-timer test (fires at the interval; clears on unmount) — RED.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3:** Implement `useInterval` + `Clock/index.tsx` (four tabs over the lib engines).
- [ ] **Step 4: Run — expect PASS;** `npm run verify`.
- [ ] **Step 5: Commit** `feat(apps): Clock wrapper — analog/stopwatch/timer/world over lib/clock`.
- [ ] **Step 6 (human):** parity sign-off (hand sweep, ring depletion, chime).

---

### Task E1.23: Notes/To-dos app — thin wrapper over `lib/notes` + persistence [owner: khanak] [verify: visual] [blockedBy: E1.14, E1.3, E1.18]

> **VISUAL task.** Note/todo logic + seed are green in `lib/notes/model` (deepak); persistence in
> `lib/persistence`. khanak's wrapper renders the two tabs and autosaves through `persistence` on
> every mutation. Loop gates on `npm run verify` + RTL smoke (add a todo → `save('samagra.todos')`
> called with a mocked storage).

**Files:**
- Create `frontend/src/apps/Notes/index.tsx`
- Test `frontend/src/apps/Notes/index.test.tsx` (RTL, mocked storage)

Notes tab (list 200px + editor, "● Autosaved" footer) + Todos tab (input, filters all/active/done,
"N task(s) left" + Clear completed). Seeds on first run via `seedNotes/seedTodos`; every mutation
calls `save(KEYS.notes|todos)`. Title/word-count/preview from `lib/notes`.

- [ ] **Step 1:** RTL smoke: adding a todo persists via a mocked storage. RED.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3:** Implement `Notes/index.tsx` (tabs over `lib/notes` + `persistence`).
- [ ] **Step 4: Run — expect PASS;** `npm run verify`.
- [ ] **Step 5: Commit** `feat(apps): Notes/To-dos wrapper over lib/notes + persistence`.
- [ ] **Step 6 (human):** parity sign-off.

---

### Task E1.24: Snake app — thin wrapper over `lib/snake/*` + keyboard gating [owner: khanak] [verify: visual] [blockedBy: E1.16, E1.15, E1.3, E1.18]

> **VISUAL task.** Engine + cell math are green in `lib/snake/*` (deepak). khanak's wrapper renders
> the board (canvas/SVG), wires the per-level interval, persists best/level via `persistence`, and
> implements **keyboard gating** (`isSnakeActive`: ignore when `activeElement` is INPUT/TEXTAREA;
> drive snake only when it's the top window) — the gating predicate gets a small headless test;
> rendering is human QA.

**Files:**
- Create `frontend/src/apps/Snake/index.tsx`
- Test `frontend/src/apps/Snake/index.test.tsx` (RTL/gating)

Board 19×19 at responsive `cellSize`; relaxed/normal levels; score/best persisted to
`samagra.snake.{best,level}`; Arrows + WASD + Space; D-pad. Snake stops on window close, pauses on
minimize (the store hooks from E1.7). `isSnakeActive` keyboard guard prevents hijacking
Terminal/Notes input.

- [ ] **Step 1:** Headless gating test: `isSnakeActive` returns false when `activeElement` is an
  INPUT. RED.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3:** Implement `Snake/index.tsx` (board + interval + persistence + gating).
- [ ] **Step 4: Run — expect PASS;** `npm run verify`.
- [ ] **Step 5: Commit** `feat(apps): Snake wrapper over lib/snake + keyboard gating`.
- [ ] **Step 6 (human):** parity sign-off (movement feel, speed ramp, death).

---

### Task E1.25: Shared leaf components — Pill / Card / Chip / IconButton [owner: khanak] [verify: visual] [blockedBy: E1.4] 

> **VISUAL task.** Presentational primitives consumed by the apps. Loop gates on `npm run verify`
> + trivial RTL render-smoke (renders children, applies the accent prop). Pixels are human QA.

**Files:**
- Create `frontend/src/components/{Pill,Card,Chip,IconButton}.tsx`
- Test `frontend/src/components/*.test.tsx` (RTL render-smoke)

Themed leaf UI consuming `themes/` tokens (semantic/status colors from `proto.md` §6.5). No logic;
thin and reusable. May land early (only depends on the theme tokens) so the app wrappers import
them.

- [ ] **Step 1:** RTL render-smoke per component. RED.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3:** Implement the four primitives.
- [ ] **Step 4: Run — expect PASS;** `npm run verify`.
- [ ] **Step 5: Commit** `feat(frontend): shared leaf components — Pill/Card/Chip/IconButton`.

---

### Task E1.26: E1 green gate + pointer-file sync (verification-driven) [owner: deepak] [verify: headless] [blockedBy: E1.17, E1.18, E1.19, E1.20, E1.21, E1.22, E1.23, E1.24, E1.25]

**Files:**
- None (verification) → then **Modify** `STATUS.html`, `SUMMARY.html`, `HANDOFF.md`

The phase-boundary gate. Under the continuous-merge model (see division doc header + §5 item 3),
deepak's engines/shell are published to `main` as they green and khanak rebases on top, so by this
point both branches have largely converged on `main`; any residual `agent/khanak` leaf commits
fast-forward in last. **Integration order is deepak-first: never merge `agent/khanak` → `main`
before deepak's engines are on `main`** (a khanak-first merge would make `main` reference
not-yet-merged engines and fail `npm run verify`). Then run the full headless gate from `main` and
sync the pointer files. No new feature files here — verification + docs only.

- [ ] **Step 1: Full frontend gate from `main`.**
```bash
cd frontend && npm run verify
```
Expected: lint clean, `tsc --noEmit` clean, `vitest run` all green (every `lib/*` spec + RTL
smoke), `vite build` writes `dist/`.

- [ ] **Step 2: Full backend gate from the repo root.**
```bash
cd /c/SandBox/claude_box/TeachingOS
.venv\Scripts\python -m pytest -q
```
Expected: full suite green (existing + `test_serve_seam` + any new endpoint tests).

- [ ] **Step 3: Build + serve smoke** (manual, optional): `samagra serve` then load `/` — the aqua
  shell renders, `/api/overview` still responds. (This is the boundary smoke, not a per-task gate.)

- [ ] **Step 4: Sync pointer files** — update `STATUS.html` (phase grid: E1 ✅; test-suite summary;
  artefacts), `SUMMARY.html` (plain-language one-pager), and `HANDOFF.md` (what landed, what's
  next = E2). Per the status-pointer-files convention; lift wording from this plan.

- [ ] **Step 5: Commit the boundary.**
```bash
cd /c/SandBox/claude_box/TeachingOS
git add STATUS.html SUMMARY.html HANDOFF.md
git commit -m "docs(status): E1 shell + aqua + OS utilities SHIPPED — sync pointer files

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: commit succeeds. **E1 acceptance (spec §10) holds:** app builds + serves; window
manager + aqua shell + six apps work on their tested engines; persistence verified; gate clean;
pointer files synced. Human visual-fidelity sign-off is separate (owner-run).

---

## Phase E2 — Data/control apps (read-only wiring) — SKELETON

> **(status banner — ⬜ NOT STARTED)** — filled to full TDD detail at the E1→E2 boundary.

E2 adds the eleven data/control apps as thin wrappers over the **existing** read-only `/api/*`
contract (no new write paths). The single hard backend gap is `GET /api/org` (static
`samagra/org.py`); everything else reuses `/api/search`, `/api/pipelines`, `/api/assignments`,
`/api/questions`, `/api/facets` (per `api.md`). Optional additive read endpoints
(`/api/dashboard`, `/api/lectures`, `/api/integrations`, `/api/activity`) each get a headless
pytest. Every data app renders graceful empty/absent states (governance.db empty on fresh DB;
mcd/munshi creds+refresh-gated). `registry.ts` edits are append-only, one-app-per-PR. Each phase
ends on a full green gate + pointer-file sync.

**Task skeleton (to be expanded):**

- [ ] **Task E2.1: `samagra/org.py` + `GET /api/org` (TDD)** [owner: deepak] [verify: headless]
  [blockedBy: E1.26] — static founder→board→workers registry, `id`s aligned to
  `state.PIPELINES[*].owners`; pytest the route function directly.
- [ ] **Task E2.2: Org Chart app — SVG tree wrapper** [owner: deepak] [verify: visual]
  [blockedBy: E2.1].
- [ ] **Task E2.3: Pipelines app** [owner: deepak] [verify: visual] [blockedBy: E1.26] — over
  `GET /api/pipelines` (5 pipelines, per-phase status/owner/gate).
- [ ] **Task E2.4: Assignments kanban app** [owner: khanak] [verify: visual] [blockedBy: E1.26] —
  over `GET /api/assignments` (`status` → 4 columns; `changes` = 5th flag).
- [ ] **Task E2.5: Activity app** [owner: khanak] [verify: visual] [blockedBy: E1.26] — `events[]`
  from `/api/assignments` (optional `/api/activity` alias).
- [ ] **Task E2.6: Questions app** [owner: khanak] [verify: visual] [blockedBy: E1.26] — over
  `GET /api/questions` (LIVE QX) + `/api/facets`; in-body `error` handling.
- [ ] **Task E2.7: Lectures app (+ optional `/api/lectures` thin/thick probe, TDD)** [owner: deepak]
  [verify: visual] [blockedBy: E1.26] — over `GET /api/search?source=textbook`.
- [ ] **Task E2.8: Booklets app (+ optional `meta.kind` adapter enrichment)** [owner: khanak]
  [verify: visual] [blockedBy: E1.26] — `GET /api/search?source=booklets`.
- [ ] **Task E2.9: INSP/Olympiad app** [owner: khanak] [verify: visual] [blockedBy: E1.26] —
  `GET /api/search?source=insp`.
- [ ] **Task E2.10: Simulations app** [owner: khanak] [verify: visual] [blockedBy: E1.26] —
  `GET /api/search?source=sims`.
- [ ] **Task E2.11: mycontentdev app (read-only, creds/refresh-gated empty state)** [owner: deepak]
  [verify: visual] [blockedBy: E1.26] — `GET /api/search?source=mycontentdev`.
- [ ] **Task E2.12: Munshi app (read-only; capture/write OUT of scope)** [owner: deepak]
  [verify: visual] [blockedBy: E1.26] — `GET /api/search?source=munshi`.
- [ ] **Task E2.13: E2 green gate + pointer-file sync (verification-driven)** [owner: deepak]
  [verify: headless] [blockedBy: E2.1–E2.12].

---

## Phase E3 — Console + Samagra themes + mobile device mode — SKELETON

> **(status banner — ⬜ NOT STARTED)** — filled to full TDD detail at the E2→E3 boundary.

E3 adds the `console` + `samagra` themes and the `mobile` device mode. **No new apps** — all 17 are
re-skinned + mobile-framed. Theme/device are client-only (already surfaced via the theme store +
Settings + Terminal `theme`/`device` effects from E1). The console/samagra token maps were authored
forward-compatibly in E1 (`themes/index`); E3 surfaces them and adds the per-theme chrome
(console taskbar 50px, samagra left rail 66px) + the mobile frame (392×812, 4-col app grid,
favorites dock). The WM re-clamp + work-area math already branch on theme/device (`lib/wm/geometry`
covers all three kinds). Pure additions get headless tests; chrome/frame parity is human QA.

**Task skeleton (to be expanded):**

- [ ] **Task E3.1: Surface console + samagra theme tokens (verification-driven/TDD)** [owner: deepak]
  [verify: headless] [blockedBy: E2.13] — assert the already-authored console/samagra token maps +
  `termPalette` per theme (`proto.md` §6.2–§6.4); wire `setTheme` to all three.
- [ ] **Task E3.2: Console chrome — taskbar (50px) + right-side controls** [owner: deepak]
  [verify: visual] [blockedBy: E3.1].
- [ ] **Task E3.3: Samagra chrome — left rail (66px) + wordmark समग्र** [owner: deepak]
  [verify: visual] [blockedBy: E3.1].
- [ ] **Task E3.4: Mobile device frame (392×812) + app grid + favorites dock** [owner: khanak]
  [verify: visual] [blockedBy: E3.1] — single `mobileApp` branch (already in the WM store), 4-col
  icons 58×58, home dock `MOBILE_FAVORITES`.
- [ ] **Task E3.5: Mobile-mode WM branch tests (TDD)** [owner: deepak] [verify: headless]
  [blockedBy: E3.4] — assert `openApp` mobile path sets `mobileApp` and spawns no window
  (`proto.md` §1.4 / §1.11 `setDevice`).
- [ ] **Task E3.6: Per-app mobile/console/samagra re-skin pass** [owner: both] [verify: visual]
  [blockedBy: E3.2, E3.3, E3.4] — append-only, one-app-per-PR.
- [ ] **Task E3.7: E3 green gate + pointer-file sync (verification-driven)** [owner: deepak]
  [verify: headless] [blockedBy: E3.1–E3.6].

---

## Appendix — E1 task DAG (dependency order)

```
E1.1 bootstrap ─┬─ E1.2 contracts+registry (FROZEN) ─┬─ E1.3 persistence ─┬─ E1.14 notes/model
                │                                     ├─ E1.4 themes(aqua) ─┬─ E1.5 wm/geometry ─┐
                │                                     │                     └─ E1.25 components   │
                │                                     ├─ E1.6 wm/zorder ───────────────────────── ┤
                │                                     ├─ E1.8 parser ── E1.9 dispatch             │
                │                                     ├─ E1.10 analog · E1.10b digital · E1.11 sw · E1.12 timer · E1.13 world
                │                                     └─ E1.15 snake/cell ── E1.16 snake/engine    │
                └─ E1.17 serve seam (Python)                                   E1.5+E1.6 ─► E1.7 stores
   (all lib/* green) ─► E1.18 shell ─► E1.19 Dashboard · E1.20 Settings · E1.21 Terminal
                                       E1.22 Clock · E1.23 Notes · E1.24 Snake  ─► E1.26 GATE + sync
```

Legend: `headless` (loop-completable) = E1.1–E1.17, E1.26 + the smoke/gating sub-tests inside
E1.18–E1.25. `visual` (human QA, not in any loop) = the pixel/interaction parity of E1.18–E1.25.
