# SAMAGRA OS — Frontend Integration: Repo & Worktree Map

_Research note. Generated 2026-06-20. Maps the existing repo for the SAMAGRA OS frontend (React 18 + TS + Vite) build. Ground-truth decisions are in the task brief / runbook — this doc records the **integration mechanics** only._

Repo root: `C:\SandBox\claude_box\TeachingOS` (branch `main`). Backend package: `samagra/` (Python + FastAPI). Server: `samagra serve` → `uvicorn samagra.api.app:app` on `127.0.0.1:8799`.

---

## 1. Confirmed worktree + branch state

`git worktree list` (verified 2026-06-20):

```
C:/SandBox/claude_box/TeachingOS     557e6a4 [main]
C:/SandBox/claude_box/samagra-codex  da9cab3 [agent/codex]
C:/SandBox/claude_box/samagra-deepak da9cab3 [agent/deepak]
C:/SandBox/claude_box/samagra-khanak da9cab3 [agent/khanak]
```

`git branch -a`:

```
  agent/codex
  agent/deepak
  agent/khanak
* main
  phase1-stabilize
  slice-1
  remotes/origin/HEAD -> origin/main
  remotes/origin/main
  remotes/origin/slice-1
```

CONFIRMED: all three agent worktrees exist as siblings of the main checkout, each on its own branch — `../samagra-deepak` (agent/deepak), `../samagra-khanak` (agent/khanak), `../samagra-codex` (agent/codex). All three branches currently sit at `da9cab3` (the Phase 2 SHIPPED commit); `main` is one commit ahead at `557e6a4` (a docs/handoff wording fix). The agent branches need a `git rebase main` / fast-forward before frontend work starts so they share the bootstrap commit (see §4).

Note: `phase1-stabilize` and `slice-1` are stale local/remote branches from earlier phases — not part of the frontend track; ignore.

The advisory Codex pre-commit hook is active repo-wide via `core.hooksPath=.githooks` (→ `samagra/review/precommit.py`, CLI verb `samagra review-staged`). It blocks only confirmed-CRITICAL and never wedges; it will run on commits in every worktree. It reviews the staged **diff**, so it sees frontend/ changes too — keep that in mind for large generated-lockfile commits (see §2 on what stays untracked).

---

## 2. Where `frontend/` lives + `.gitignore` additions

**Location:** a NEW top-level app at the repo root: `C:\SandBox\claude_box\TeachingOS\frontend\`. It is a self-contained npm/Vite project with its OWN `package.json` (NOT merged into pyproject; the Python and JS toolchains stay independent). It sits beside `samagra/`, never inside it — `samagra/` is a Python package (`[tool.setuptools.packages.find] include = ["samagra*"]`) and a `frontend/` nested under it would pollute the wheel and the import namespace.

```
TeachingOS/
├─ samagra/            # Python/FastAPI (unchanged; portal/ retired in place)
│  ├─ api/app.py       # mounts the built bundle (see §3)
│  └─ portal/          # RETIRED — left in git history, route removed
├─ frontend/           # NEW React 18 + TS + Vite app (own package.json)
│  ├─ package.json
│  ├─ vite.config.ts
│  ├─ index.html
│  ├─ src/
│  └─ dist/            # Vite build output  ← FastAPI serves this
├─ pyproject.toml
└─ .gitignore
```

**Current `.gitignore` already covers `dist/` and `build/`** at lines 14–15:

```
build/
dist/
```

That bare `dist/` is **dangerous for this layout** — it is unanchored, so it ignores `dist/` at *any* depth, which is what we want for `frontend/dist/`, but it would *also* swallow any future `src/.../dist/` and is easy to misread. Make the frontend intent explicit and add the one entry that is genuinely missing — `node_modules`:

**Add to `.gitignore` (new "frontend (node)" block):**

```gitignore
# --- frontend (node / vite) ---
node_modules/
frontend/dist/
frontend/.vite/
frontend/coverage/
*.tsbuildinfo
```

- `node_modules/` — **MISSING today; must be added** (unanchored so it catches `frontend/node_modules/` and any future workspace package).
- `frontend/dist/` — explicit anchor; the build artifact FastAPI serves is generated, never committed. (The existing bare `dist/` already matches it, but the anchored form documents intent and survives anyone tightening the bare rule.)
- `frontend/.vite/` — Vite's dev cache.
- `frontend/coverage/` — Vitest coverage output.
- `*.tsbuildinfo` — TS incremental build cache.

**Keep `frontend/package-lock.json` TRACKED** (do not ignore it) — it is the reproducible-install lockfile and belongs in git. Only `node_modules/` is ignored.

---

## 3. Integration seam — FastAPI serves Vite's `dist/` at `/`, keeps `/api/*`

### Current state (`samagra/api/app.py`)
- `PORTAL = .../samagra/portal`
- `app.mount("/static", StaticFiles(directory=PORTAL/"static"), name="static")`
- `@app.get("/", response_class=HTMLResponse)` → `templates.TemplateResponse("portal.html", ...)` (Jinja)
- Explicit JSON routes under `/api/*`, plus `/lecture/{slug}`, `/open`.

### Target state — replace the portal route, keep the API
The portal route (`index`), the Jinja `templates` object, and the `/static` mount are **retired**. The built SPA is served instead. Two clean options; **Option A (SPA catch-all) is recommended** because the OS shell is a single-page app with client-side window state (no server routes per app).

**Option A — serve `index.html` as SPA fallback, mount hashed assets (RECOMMENDED):**

```python
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# repo_root / "frontend" / "dist"  (config.REPO_ROOT is already available)
FRONTEND_DIST = config.REPO_ROOT / "frontend" / "dist"

app = FastAPI(title="SAMAGRA", version=samagra.__version__)

# --- API routes are declared FIRST so they always win over the SPA fallback ---
#     (all existing @app.get("/api/...") / "/lecture/..." / "/open" stay as-is)

# Vite emits hashed assets under dist/assets/ — mount them directly.
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

# SPA fallback: any non-API path returns index.html (client router/WM takes over).
@app.get("/{full_path:path}")
def spa(full_path: str):
    # never shadow the API — those routes are matched earlier; this only runs for misses
    if full_path.startswith("api/"):
        raise HTTPException(404)
    index = FRONTEND_DIST / "index.html"
    if not index.exists():
        raise HTTPException(503, "frontend not built — run `npm run build` in frontend/")
    return FileResponse(str(index))
```

Key rules for the seam:
- **Declaration order matters in FastAPI/Starlette.** Keep every `/api/*`, `/lecture/{slug}`, and `/open` route **declared above** the `/{full_path:path}` catch-all so specific routes match first. The catch-all is the LAST route in the module.
- Serving favicon/manifest/etc.: they live at `dist/` root with hashed siblings under `dist/assets/`. The SPA fallback returns `index.html` for unknown roots; for true root static files (e.g. `/favicon.ico`) either let Vite inline them or add a small explicit handler — defer to the builder, not blocking.
- `config.REPO_ROOT` already resolves to the repo root (`samagra/config.py:20`), so `FRONTEND_DIST` needs no new config. Optionally add `FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"` to `config.py` for symmetry with `BUILD_DIR`/`EXPORT_DIR`.

**Option B — single mount with `html=True`** (`app.mount("/", StaticFiles(directory=dist, html=True))`). Simpler, but a root mount on `/` must be added **after** all API routes and does NOT do SPA-style fallback for unknown deep paths (returns 404, not index.html). Acceptable for E1 (the shell uses in-memory window state, not URL routes) but Option A is more future-proof. **Pick A.**

### Dev proxy (Vite dev server → FastAPI)
In development the two servers run side by side: Vite dev server (default `:5173`) serves the app with HMR; FastAPI runs on `127.0.0.1:8799` (`config.PORT`). Vite proxies API calls so the browser only ever talks to `:5173`.

`frontend/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // FastAPI owns /api, /lecture, /open — proxy them to uvicorn :8799
      "/api":     "http://127.0.0.1:8799",
      "/lecture": "http://127.0.0.1:8799",
      "/open":    "http://127.0.0.1:8799",
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
  test: {                 // Vitest
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

Dev loop: terminal 1 `samagra serve` (uvicorn :8799), terminal 2 `npm run dev` in `frontend/` (Vite :5173). Prod loop: `npm run build` → `dist/` → `samagra serve` serves the bundle at `/` and the API at `/api/*` on a single origin (no proxy, no CORS).

---

## 4. CONFLICT-SURFACE analysis (deepak vs khanak, same `frontend/`, separate branches)

Both agents build the SAME `frontend/` tree on SEPARATE worktrees (`../samagra-deepak` / `agent/deepak`, `../samagra-khanak` / `agent/khanak`). To merge without conflict, partition the tree so **no file is written by both branches**, and have ONE agent (deepak) land a **blocking shared bootstrap prefix** first that the other rebases onto.

### 4a. Blocking shared bootstrap — deepak lands FIRST (prefix commit on `main`)
This is the substrate every later file imports. It MUST exist and be merged/rebased into both worktrees before khanak writes a line. deepak (CEO/integration/substrate) owns it:

| File | Why it must be first |
|---|---|
| `frontend/package.json` + `package-lock.json` | Defines React/TS/Vite/Vitest/zustand/lucide-react deps + scripts. Both agents `npm install` against it. **Single source — a second author = guaranteed lockfile merge conflict.** |
| `frontend/vite.config.ts` | Build outDir, dev proxy, Vitest config (§3). |
| `frontend/tsconfig.json` (+ `tsconfig.node.json`) | TS compiler settings every module compiles under. |
| `frontend/index.html` | Vite entry HTML (fonts, root div). |
| `frontend/src/main.tsx` + `frontend/src/App.tsx` (skeleton) | Mount point + top-level shell stub that imports the WM store + theme store. |
| `frontend/src/types/contracts.ts` | **The app-contract types**: `AppId` union, `AppMeta` (`{id, title, accent, defaultSize, icon}`), `WindowState` (`{id,app,x,y,w,h,z,min,max,prev}`), `Theme`/`Device` unions, `ApiClient` interface for `/api/*`. Every app + the WM imports these. |
| `frontend/src/stores/windowManager.ts` (interface + store skeleton) | **The WM store interface**: `openApp/closeApp/focus/move/resize/minimize/toggleMax/tile`, `windows[]`, `z`, selectors. deepak lands the zustand store shape + the pure geometry module it delegates to (`src/lib/wm/geometry.ts`: clamp/z-order/tile math) WITH its Vitest spec. |
| `frontend/src/stores/theme.ts` (interface + skeleton) | Theme/device store shape (`theme`, `device`, `setTheme`, `setDevice`) + the `THEMES` token map type. |
| `frontend/src/lib/persistence.ts` | The localStorage layer (`load/save` keyed `samagra.*`) every persisted app (notes/todos/snake) imports. Land the pure module + spec. |
| `frontend/src/registry.ts` | The `APPS` registry mapping `AppId → {meta, lazy component}`. This is the ONE shared mutation point — see 4c for how to avoid it becoming a conflict hot-spot. |
| `frontend/vitest` setup `frontend/src/test/setup.ts` | jsdom + RTL setup imported by every test. |

deepak commits this bootstrap to `agent/deepak`, it merges to `main`, and khanak rebases `agent/khanak` onto it. **Until that merge lands, khanak is blocked.** Everything below assumes the bootstrap is present.

### 4b. Exclusive ownership split (file-disjoint after bootstrap)
Once the bootstrap exists, the two agents own **disjoint directories**. Rule: an agent only ever creates/edits files under its owned paths; it may *read* (import) the other's exported types/stores but never write them.

**deepak owns (substrate, chrome, OS-utility apps + their pure engines):**
```
frontend/src/lib/wm/**            # window geometry / z-order / clamp / tile (pure, tested)
frontend/src/lib/clock/**         # clock / stopwatch / timer math (pure, tested)
frontend/src/lib/terminal/**      # command parser + dispatch (pure, tested)
frontend/src/lib/snake/**         # snake engine (pure, tested)
frontend/src/lib/persistence.ts   # localStorage layer (owned, after bootstrap)
frontend/src/stores/**            # windowManager + theme/device stores
frontend/src/shell/**             # TopBar, Dock, Taskbar, ContextMenu, WindowFrame, work-area
frontend/src/themes/**            # THEMES token maps (aqua first; console/samagra in E3)
frontend/src/apps/Dashboard/**    # E1 OS apps owned by deepak (integration-facing)
frontend/src/apps/Settings/**
frontend/src/apps/Terminal/**
```

**khanak owns (test-first builder — the self-contained interactive apps):**
```
frontend/src/apps/Clock/**        # consumes deepak's lib/clock pure module
frontend/src/apps/Notes/**        # notes + todos UI; consumes lib/persistence
frontend/src/apps/Snake/**        # consumes lib/snake engine
frontend/src/components/**        # shared leaf UI primitives (Pill, Card, Chip, IconButton)
frontend/src/hooks/**             # reusable hooks (useInterval, useLocalStorage wrapper)
```

The split is along a clean seam: **deepak owns the substrate + the OS chrome + the stores + ALL the pure `lib/` engines (with their Vitest specs), plus the three integration-leaning apps (Dashboard/Settings/Terminal).** khanak owns the three self-contained interactive apps (Clock/Notes/Snake) as thin React wrappers over deepak's already-tested engines, plus the shared leaf component library. Because the hard logic (snake engine, clock math, terminal parser) lives in `lib/` under deepak and is unit-tested headlessly, khanak's app files are thin visual wrappers — they import the engines, never reimplement them, so the two never touch the same file.

Per the LINCHPIN decision, the pure engines belong with whoever can land+test them first. deepak landing them as part of/just after the bootstrap means khanak's app work is unblocked and conflict-free. If parallelism matters more than this grouping, an alternative is to give khanak ownership of `lib/snake` + `lib/clock` (the engines for her apps) — but then those must NOT be in deepak's bootstrap. **Recommended: keep all `lib/` with deepak in the prefix; it is the smaller blocking surface and matches "deepak = substrate".**

### 4c. The one shared mutation hot-spot: the app registry
`frontend/src/registry.ts` is the single file BOTH agents would naturally edit (each registering their new apps). To keep it conflict-free:
- deepak lands `registry.ts` in the bootstrap pre-populated with **all 6 E1 app entries** (Dashboard, Settings, Terminal, Clock, Notes, Snake) pointing at `React.lazy(() => import('./apps/<App>'))`. Each app component is created later by its owner, but the registry slot exists from commit 1.
- After that, **neither agent edits `registry.ts` for E1** — they only fill in their own `apps/<App>/index.tsx`. The lazy import resolves once the file exists. Registry stays untouched → zero merge conflict on the hot-spot.
- For E2/E3 (new apps), append-only edits at the END of the registry list, coordinated one-app-per-PR, keep conflicts to trivial 3-way appends.

### 4d. Merge protocol
1. deepak: bootstrap prefix → `agent/deepak` → merge to `main`.
2. khanak: `git rebase main` onto `agent/khanak` (now has bootstrap).
3. Both build only inside their owned paths (§4b); registry untouched (§4c).
4. Integrate: merge `agent/khanak` → `main`, then `agent/deepak` → `main` (or via PRs). Disjoint paths + shared-prefix bootstrap ⇒ no content conflicts; the only shared file (`registry.ts`) was frozen after bootstrap.
5. The advisory Codex hook runs on each commit in each worktree (staged-diff review); it never wedges, so it won't block the merge protocol.

---

## Summary (6 lines)
1. Worktrees CONFIRMED: `../samagra-deepak` (agent/deepak), `../samagra-khanak` (agent/khanak), `../samagra-codex` (agent/codex), all at `da9cab3`; `main` at `557e6a4` — agent branches must rebase onto main before frontend work.
2. New app lives at repo-root `frontend/` (own package.json, beside `samagra/`, never inside it — `samagra/` is a Python wheel package); Vite builds to `frontend/dist/`.
3. `.gitignore` already ignores `dist/` + `build/`; ADD `node_modules/` (missing) plus anchored `frontend/dist/`, `frontend/.vite/`, `frontend/coverage/`, `*.tsbuildinfo`; keep `package-lock.json` tracked.
4. Integration seam: retire the Jinja `/` route + `/static` mount; serve `frontend/dist/index.html` via a `/{full_path:path}` SPA fallback declared AFTER all `/api/*`/`/lecture`/`/open` routes, mount `dist/assets` at `/assets`; dev = Vite `:5173` proxying `/api,/lecture,/open` → uvicorn `:8799`.
5. Conflict-free split: deepak EXCLUSIVELY owns `lib/**` (all pure engines+specs), `stores/**`, `shell/**`, `themes/**`, and apps Dashboard/Settings/Terminal; khanak owns apps Clock/Notes/Snake, `components/**`, `hooks/**` — file-disjoint, no shared writes.
6. Blocking prefix (deepak lands FIRST, then khanak rebases): `package.json`+lockfile, `vite/tsconfig/index.html`, `src/types/contracts.ts` (app-contract types), `src/stores/windowManager.ts`+`theme.ts` (store interfaces), `lib/persistence.ts`, and `registry.ts` pre-seeded with all 6 E1 app slots so the one shared file is frozen after commit 1.
