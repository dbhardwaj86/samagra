# SAMAGRA — Handoff

> **▶▶ LATEST — Capture control plane is LIVE (2026-06-21).** The SAMAGRA OS now does **real
> owner-initiated captures end-to-end** and browses every read-only surface with live data, on branch
> **`feature/control-plane-capture`** (not yet merged). Built TDD + an **independent Codex review per
> implementation** (reports `docs/codex-reviews/14–17`).
> - **Munshi capture (write):** `POST /api/munshi/capture` → live `MunshiClient.create_item` →
>   `POST {MUNSHI_API_URL}/api/item` (cookie auth). Kinds **todo/note/followup** only (the worker's
>   deterministic set), per-kind required fields, server-validated, creds-gated.
> - **mycontentdev seed capture (write):** `POST /api/mcd/seeds` → live `McdClient.create_seed` →
>   `POST {apiUrl}/api/seeds` **form-encoded**, `x-mcd-admin: <adminKey>` (the existing read key
>   authorizes the write — verified; **no `APP_PASSWORD` needed**).
> - **Live-read passthroughs** `GET /api/munshi/library` + `GET /api/mcd/seeds` — the capture apps read
>   the **live deployed workers** (not the catalog), so real data shows without a refresh and a fresh
>   capture appears on refetch. (`/api/search?source=munshi|mycontentdev` was catalog-backed → empty.)
> - **Simulations = deployed-only:** `GET /api/sims` parses `pratyaksh-May-deploy/deployed-sims-by-grade.md`
>   (**482 sims**), grade-grouped, linking the canonical extensionless `pratyakshsims.com/sims/SIM<NNNN>/SIM<NNNN>_sim`.
> - **QX browser fixed + separate:** `GET /api/questions/facets` is question-scoped (`qx.summary()`),
>   the SIM-id chip bug is gone, and degenerate numeric subject codes are filtered (clean chips). The
>   Questions app stays a standalone read-only browser (50 live QX rows, real q-type chips).
> - **LIVE-VERIFIED this session:** captured a real Munshi todo (`item_id 53`, library 13→14) and a real
>   mcd seed (`seed_01KVNN90…`, status `captured`, seeds 1→2) through the running server; both appear in
>   the live-read apps. Negative guards (bad kind / empty text) → 400. Backend **134 pytest** + frontend
>   **514 vitest / 60 files** green; advisory gate clean. Two benign labelled smoke records remain in
>   prod (owner can dismiss/archive). **Pending: merge `feature/control-plane-capture` (PR).**
>
> **✅ DEC-3 AMENDMENT (2026-06-21, Chairman Deepak).** The morning's DEC-3 read-only firewall is amended:
> **owner-initiated capture** (a munshi item + an mcd seed) is now **in-scope** — the project's only two
> subsystem write paths. **Still binding & unchanged:** the human publish gate is **never automated**;
> **no automated munshi→mcd bridge** (promotion is a later explicit Chairman action); no app-platform
> scope (DEC-1); attention-ROI north-star + kill-criterion (DEC-2) + the pre-E3 gate (DEC-4) hold;
> Phase-3's full active loop stays parked (DEC-5). **New invariant wording: "read-only *except
> owner-initiated capture*."** Spec/plan: `docs/superpowers/{specs/2026-06-21-samagra-control-plane-capture-design.md,plans/2026-06-21-samagra-control-plane-capture.md}`.
>
> **▶ STATUS:** The project is **SAMAGRA** (package `samagra`) — a company-structured agent org
> folding in `mycontentdev` + `munshi`, with an advisory pre-commit Codex review and a CEO prompt-outbox.
> **Phase 0 (rename), Track A (stabilize) and Phase 1 (read-only subsystem adapters) are merged to `main`
> and pushed to `origin/main`.** **Phase 2 (governance) is now BUILT TDD on `main` (suite 63 → 98 green)**,
> reconciled to the runbook: **D6** (governance state lives in its own durable `governance.db`, separate from
> the rebuildable catalog `samagra.db`) and **D5** (the Codex pre-commit hook is **advisory-local** —
> confirmed-CRITICAL only, diff-hash cached, audited break-glass, never wedges; real enforcement = CI). The
> plan's Phase-2 code was stale (it self-flagged `SUPERSEDED by D5/D9`) and was reconciled before building.
> The live plan is under `docs/superpowers/` (original brief: [`SAMAGRA-HANDOFF.md`](SAMAGRA-HANDOFF.md)).
> **Pre-merge review: APPROVE** (Codex gpt-5.5/xhigh, 6 rounds + a CEO adversarial Workflow audit — see
> `docs/codex-reviews/07–13` + `12-workflow-invariant-audit.md`; all findings fixed TDD).
> **Phase 2 SHIPPED (2026-06-19):** `origin/main` holds Phase 2 through `da9cab3` (the end-of-session doc-sync
> commits after it are local-ahead until the next `git push origin main`); the advisory
> hook is ACTIVE (`core.hooksPath=.githooks`, so every commit + worktree now runs it — `codex` 0.140.0 on PATH);
> the three agent worktrees exist (`../samagra-{deepak,khanak,codex}` on `agent/{deepak,khanak,codex}`).
> **▶ NEW TOP PRIORITY (2026-06-20): SAMAGRA OS — the Experience track.** Replace the plain tabbed portal with
> an OS-style windowing GUI (17 apps · 3 themes · 2 device modes) in React + TypeScript + Vite, served by
> FastAPI. Own spec + phased plan + agent division + two autonomous loop scripts under `docs/superpowers/`
> (spec `specs/2026-06-20-samagra-os-experience-design.md`; plan `plans/2026-06-20-samagra-os.md`; division
> `plans/2026-06-20-samagra-os-division.md`; loops `loops/{deepak,khanak}-loop.js` + `RUBRIC.md`).
> **E1 (shell + ALL 3 themes + OS utilities) is BUILT, fidelity-passed, and MERGED to `main` (2026-06-20,
> `06d88a3`, fast-forward; 96 files / ~19k insertions).** On top of the fidelity layer the main session added
> draggable/resizable windows, the advisory HIGH#4 theme-index guard, Notes to-do keyboard a11y, and the
> owner's two asks: the **chairman renamed Devesh → Deepak Bhardwaj** (Dashboard greeting, terminal prompt
> `deepak@samagra:~$`, board + `whoami`) and **right-click context menus for all 3 themes** (desktop · window ·
> dock-icon; theme-driven surface, verified live in aqua/console/samagra). **PUSHED to `origin/main` 2026-06-21
> (`557e6a4..6d09693`, incl. the tracker doc-sync).**
> **▶ E2 (data/control apps) is now MERGED to `main` (fast-forward, `31aa5bb`) and pushed to `origin/main` on
> 2026-06-21.** The **eleven data/control
> apps** shipped as thin, **read-only** React wrappers over the existing FastAPI `/api/*` contract, plus the one
> new backend endpoint **`GET /api/org`** (static `samagra/org.py`). Apps: **Org Chart · Pipelines · Lectures ·
> mycontentdev · Munshi** (owner claude-deepak) and **Assignments (kanban) · Activity · Questions · Booklets ·
> INSP/Olympiad · Simulations** (owner claude-khanak). No new write paths; mcd/munshi render empty-or-unavailable
> states; Munshi capture/write is OUT of scope. All real logic lives in **seven pure-TS linchpin modules**
> (`lib/api/query` · `lib/catalog/rows` · `lib/pipelines/stages` · `lib/org/resolve` · `lib/kanban/columns` ·
> `lib/activity/format` · `lib/questions/facets`); the 11 app components are thin wrappers over these + `useApi`.
> Built TDD on branch **`e2/samagra-os`** as a single-tree DAG driven by two background Workflows (backend + 7
> linchpin modules, then the 11 app wrappers) with phase-boundary review — **22 commits**. A live-source
> verification workflow produced `docs/superpowers/_research/samagra-os/e2-grounding.md` — the verified `/api`
> contract, which **SUPERSEDES the stale `api.md`** (it caught 11 deltas: dual `meta_json`/`summary_json` keys,
> two empty-question bodies, hyphenated `in-review` status, a name-keyed `phases` Record, 7 owner ids, the
> chairman name living only in `dispatch.ts`, etc.). The dedicated plan
> `plans/2026-06-21-samagra-os-e2.md` cleared a **4-critic adversarial pass** (0 CRITICAL / 0 MAJOR; 6 minor
> polish fixes applied).
> **E2 test gate (just-run): BACKEND 106 pytest passing** (102 E1 + 4 new `tests/test_api_org.py`); **FRONTEND
> 501 vitest passing across 56 files** (497 at the E2 merge; the +4 are the post-merge `e1cb22a` Questions `/api/facets` tests) (439 E1 + 25 new lib tests incl. the catalog href/safeUrl tests + 33 app
> render-smoke), `tsc --noEmit` clean, `vite build` green emitting **22 lazy chunks** (one per app), no
> `.only`/`.skip`. **A Codex pre-merge review returned GO and three MEDIUM findings were fixed (commit
> `31aa5bb`):** **(a)** `org.py`'s worker roster shows "Gemini+NotebookLM" as ONE line (the owners map keeps the
> two tokens distinct); **(b)** the Pipelines app humanizes pipeline owner tokens via `GET /api/org` + `ownerName`;
> **(c)** `lib/catalog/rows` exposes a unified, scheme-guarded `href` so url-only mycontentdev/munshi rows are
> actionable. **Also reconciled during review:** `org.py` owner mapping is OWNER-CONFIRMED — `claude1` =
> **Claude-Deepak** (CEO — substrate & engine), `claude2` = **Claude-Khanak** (CTO — leaf apps & UX) — locked by
> `tests/test_api_org.py`; and a **pre-existing E1 production-serve bundling bug** — `App.tsx`'s
> `/* @vite-ignore */` dynamic import left every `apps/*/index.tsx` OUT of the production bundle, so FastAPI-served
> app windows rendered empty (only `npm run dev` worked) — was fixed by dropping `@vite-ignore` so Vite emits a
> lazy chunk per app (22 chunks); this affected all 17 apps in production, now fixed.
> **E2 status right now:** **MERGED to `main` (fast-forward, `31aa5bb`) and pushed to `origin/main` on 2026-06-21**
> after the Codex pre-merge review (GO; 3 MEDIUMs fixed) — see the merged PR
> <https://github.com/dbhardwaj86/samagra/pull/2>. **Pixel/interaction parity of the 11 apps is a
> separate owner-run browser-vision pass — NOT yet run, NOT claimed** (some E2 glyphs may still be unregistered
> in `components/icons-data` → empty-icon fallback; a visual-polish follow-up). **Next planned action: the
> owner-run browser-vision pixel-QA pass over the 11 E2 apps (now that the bundling fix makes them render when
> FastAPI-served, not just under `npm run dev`), then Phase E3 (mobile device mode + remaining per-theme re-skin
> polish — the 3 themes already shipped in E1).** The E2 LOW follow-up — the Questions app consuming
> `/api/facets` — was IMPLEMENTED this session (commit `e1cb22a`, pushed to `origin/main`) but **introduced a
> known bug; see ⚠ KNOWN BUG below.**
> The full `frontend/` app (React 18 + TS + Vite) shipped TDD across E1.1–E1.25: the bootstrap + frozen
> 17-app registry, every pure `lib/` engine (`wm/{geometry,zorder}`, `snake/{engine,cell}`,
> `clock/{analog,stopwatch,timer,world}`, `terminal/{parser,dispatch}`, `notes/model`, `persistence`), the
> `windowManager`/`theme` Zustand stores (thin over `lib/`), the aqua chrome shell (top bar · dock · window
> frame · context menu), the six OS-utility apps (Dashboard · Settings · Terminal · Clock · Notes · Snake) +
> shared leaf components, and the FastAPI serve seam (Vite `dist/` + SPA fallback, jinja portal route retired).
> **Fidelity layer (2026-06-20):** theme-driven chrome for all three themes — **aqua** (top bar + bottom-centre
> Dock + left traffic-lights), **console** (no top bar; bottom Taskbar + Start menu + right-side neon icon
> controls), **samagra** (Devanagari top strip + left **Rail** dock + warm window frame) — every colour/size
> driven by the `themes/` token map (**FD1**), plus the `Icon`/`AppIcon` SVG components (**FD2**) wired through
> every dock/rail/Start launcher and the six apps (no letter badges anywhere). The RTL suite was adapted to the
> new markup and pins the fidelity hooks: per-launcher inline `<svg>`, control aria-labels
> (Close/Minimize/Maximize), exact traffic-light token colours (`#ff5f57` live / `#cdcdd4` inactive), the 28×23
> right-side control geometry, the Devanagari wordmarks, and the full theme swap exercised through the real
> stores.
> **E1-merge gate (2026-06-20): `npm run verify` clean — lint + `tsc --noEmit` + 439 Vitest tests across
> 38 files + `vite build` writing `dist/`, no `.only`/`.skip` in the diff — and the backend `pytest` suite at
> 102/102 green (incl. `test_serve_seam.py`).** Linchpin held: all real behaviour lives in pure-TS
> headless-testable modules; **pixel/interaction fidelity is a separate browser-vision QA pass** (owner-run,
> never a loop completion signal) — **it has NOT run; pixel parity is NOT claimed.** The headless gate proves
> the markup, tokens and icon wiring are correct, not that the rendered pixels match the screenshots.
> **Next steps:** the **owner-run browser-vision pixel-QA pass over the 11 E2 apps** (now that the bundling fix
> makes them render when FastAPI-served, not just under `npm run dev`), then **E3** (mobile device mode + remaining
> per-theme re-skin polish + the deferred Dashboard narrow-grid HIGH#2). The **browser-vision pixel pass**
> (owner-run, per-surface vs the prototype + `screenshots/`) — now spanning the E1 shell + the 11 E2 apps —
> remains outstanding.
> **Phase 3 (active loop) is PARKED** (plan complete, resumes after the Experience track; will need live
> `MUNSHI_API_URL`/`MUNSHI_SECRET` in `.env`). Carried into Phase 3: F1/F4 refresh hardening.
>
> **⚠ KNOWN BUG (open — take up next session): Questions app subject chips show sim-ids, not subjects.**
> The Questions app (`frontend/src/apps/Questions/index.tsx`) renders its subject filter chips from
> `GET /api/facets`, whose `subjects` is **catalog-wide** (`select distinct subject from catalog`,
> `samagra/catalog.py:191`). The sims adapter writes each simulation's folder id (`SIM0018`…`SIM0626`) into the
> `subject` column (`samagra/adapters/sims.py:37`, `subject = after[0]`), so **~500 `SIM0xxx` ids dominate the
> chip list** (498 measured against `samagra.db` — 502 of 504 distinct catalog subjects come from the sims source). Global catalog facets ≠ the question bank's subject vocabulary;
> clicking a `SIM0xxx` chip filters `/api/questions?subject=SIM0xxx` → 0 QX rows. Compounded by QX's own
> `subject` column being physics-only/unpopulated (see Gotchas). **Introduced this session by the E2 LOW-finding
> fix `e1cb22a`** (already merged + pushed to `origin/main`). **Fix options (next session — keep it read-only,
> tests + `npm run verify` green):** (a) source the chips from a **question-scoped** subject list — QX
> `summary().subjects` (`samagra/adapters/qx.py:57`) via a new `/api/questions/facets` or the existing qx
> overview summary; (b) intersect `facets.subjects` with the subjects actually present in the returned
> questions; or (c) drop subject chips and facet on chapter/q_type per the Gotcha. **Deeper cause (audit 2026-06-21):**
> the `subject` column has *uneven semantics across adapters* — sims writes a folder id (`sims.py:37`),
> mcd/munshi hardcode `physics`, qx derives from the builder DB — so a catalog-wide `DISTINCT subject`
> (`catalog.py:199`) can never equal the question bank's subject vocabulary; the durable read-only fix is
> question-scoped facets (`qx.summary().subjects`), not catalog-wide facets.

## ✅ Direction-coherence DECISION (RATIFIED 2026-06-21 by Deepak, Founder & Chairman)

A dedicated coherence audit this session — an independent **Codex vision review** plus a **multi-agent
implementation audit** (4 mappers + 4 verifiers, live test runs) — found **execution coherence strong but
strategic direction drifting.** Execution verified clean: every merge claim holds (E1 `06d88a3`, E2 `31aa5bb`,
HEAD `e1cb22a`), the **read-only safety invariant held exactly at the time of that audit** (no `create_seed`
shipped; `GET /api/org` static; `useApi` GET-only; the 3 POST routes control-plane) — **superseded 2026-06-21
by the DEC-3 amendment** (see the LATEST banner at the top): the invariant is now *"read-only except
owner-initiated capture"* with exactly two write paths (`/api/munshi/capture`, `/api/mcd/seeds`), the
spec↔code mapping is exact (17 apps · 7 linchpin `lib/` modules · 12 engines · 3 themes · 8 shell components),
and live suites are **backend 106 pytest + frontend 501 vitest** green. **The drift is strategic, not factual:**

- The **2026-06-19 evolution spec deliberately retired the word "OS"** — *"the word 'OS' is retired because it
  silently licenses OS-sized scope"* — and bound the project to an **attention-ROI north-star + a kill-criterion**
  (freeze if not demonstrably saving the owner ~3 hrs/wk by Phase 2). One day later the project pivoted to a
  literal **17-app "SAMAGRA OS"** windowing GUI (incl. a Snake game, 3 themes, mobile mode) as the **top
  priority** and **parked the value-producing active loop** (munshi → seed → board-approve → publish — the
  mechanism that actually saves owner attention).
- The OS experience spec **half-reconciles** this (it argues the windowing metaphor is "the honest shape of the
  work" and firewalls write paths) but **never restates the attention-ROI metric or the kill-criterion**, and
  STATUS / SUMMARY / HANDOFF did not surface the tension at all until this audit.
- **Codex vision verdict: `DRIFTING`. Audit verdict: `COHERENT-WITH-CAVEATS`** (this is the caveat). Full
  reviews: `docs/superpowers/_research/samagra-os/_vision-review-output.md` (+ `_vision-review-prompt.md`,
  `_vision-review.log`); audit synthesis is summarised in STATUS.html → *Direction coherence*.

**Decision (ratified 2026-06-21 by Deepak — these are now BINDING):**
1. **DEC-1 · Scope.** SAMAGRA OS is a **bounded operator console — a UI metaphor only.** SAMAGRA remains a
   control plane; it does **not** acquire app-platform scope. The windowing GUI is inward-facing operator
   infrastructure, never a product.
2. **DEC-2 · North-star binding.** The **attention-ROI north-star** (minutes-of-owner-attention per published
   artifact) and the **kill-criterion** from the 2026-06-19 vision remain **BINDING** and are not voided by the
   OS track. Data source = the governance `events`/`review_overlay` ledger. (The ~3 hrs/wk figure stays the seed
   proposal; the owner ratifies the exact threshold when the DEC-4 gauge first runs.)
3. **DEC-3 · Scope firewall** (now a hard non-goal, mirrored into OS spec §3): **no** entertainment apps beyond
   E1's Snake; **no** third-party apps / app marketplace; **no** process- or scheduler-as-platform model; **no**
   user-facing product identity. Adding any of these is a Chairman decision, not routine engineering.
4. **DEC-4 · Attention-ROI acceptance gate before E3.** Before any E3 work (mobile device mode / further theme
   polish) begins, a gate must pass: pick **2–3 representative operator tasks** (e.g. (a) triage the day's munshi
   captures into seed-candidates vs ops; (b) read pipeline + gate status across all 5 pipelines; (c) locate and
   open a specific catalog artifact — owner-confirmable), **measure owner wall-clock time** doing each via
   SAMAGRA OS vs the prior tabbed portal / point tools. **Pass** = the GUI demonstrably *reduces* total owner
   time (net-positive attention-ROI). **Fail** = freeze GUI expansion (per DEC-2's kill-criterion) and
   reprioritize Phase 3.
5. **DEC-5 · Phase 3 is the primary value engine.** The active loop (munshi → seed → board-approve → publish)
   restarts **after the E2 visual-QA pass and the DEC-4 gate**, ahead of further theme/mobile polish — it is not
   optional. (No calendar date is set; it is gated on those two conditions.)

This decision is recorded across STATUS.html (*Direction coherence*), SUMMARY.html, both specs and CLAUDE.md, so
it travels with the project. Reviews that informed it: `docs/superpowers/_research/samagra-os/_vision-review-output.md`.

**Single next-action order (reconciled this session):**
1. Fix the Questions facets bug (read-only; `npm run verify` green) — see ⚠ KNOWN BUG above.
2. Owner **browser-vision pixel-QA** pass over the E1 shell + the 11 E2 apps.
3. **Run the DEC-4 attention-ROI acceptance gate** — required to pass before any E3 work begins.
4. **E3** — mobile device mode + remaining per-theme re-skin polish (gated on DEC-4).

(Backend pytest exits 1 on Windows from a tmpdir symlink-cleanup teardown *after* all 106 pass — cosmetic, not
a failure; run with `--basetemp` to silence.)

---

**Repo:** github.com/dbhardwaj86/samagra · `main` (E1 merged, `06d88a3`; **E2 merged, `31aa5bb`**) · **E2 MERGED to `main` (fast-forward, `31aa5bb`) and pushed to `origin/main` 2026-06-21 (Codex pre-merge review GO; 3 MEDIUMs fixed)** · local-first Python+FastAPI.
**State:** Spine + portal + thin/thick exporter + semi-autonomous loop + two read-only subsystem adapters
(mycontentdev seeds, munshi `library()`) reflecting into the catalog, **+ Phase-2 governance**: durable
`governance.db` store (assignments / events ledger / review overlay), `GET /api/assignments` + the
Assignments portal tab, an advisory Codex pre-commit gate (`samagra/review/`), the committed
`.githooks/pre-commit` shim, and per-agent board files (`board/{deepak,khanak,codex}/`), **+ SAMAGRA OS E1
+ fidelity layer**: the `frontend/` React+TS+Vite windowing shell (three themes — aqua/console/samagra chrome
· `Icon`/`AppIcon` SVG system · WM · six OS utilities on tested pure-TS engines) served by FastAPI from
`frontend/dist/`, + the chairman rename and right-click context menus. **Backend 102/102 pytest green; frontend 439/439 Vitest green.**

## Run it

```bash
cd C:\SandBox\claude_box\TeachingOS
set PYTHONPATH=%CD%                 # or: export PYTHONPATH=$(pwd) in bash
.venv\Scripts\python -m samagra refresh        # rebuild catalog (7,044 artifacts)
.venv\Scripts\python -m samagra status
.venv\Scripts\python -m samagra export --chapter vectors --variant both
.venv\Scripts\python -m samagra tick [--dry-run]
.venv\Scripts\python -m samagra gate textbook approve
# portal: preview harness (.claude/launch.json -> "samagra") OR:
.venv\Scripts\python -m uvicorn samagra.api.app:app --port 8799   # http://127.0.0.1:8799
```

```bash
# SAMAGRA OS (E1) frontend — from frontend/
cd frontend
npm install                      # first run only (generates node_modules from tracked lockfile)
npm run dev                      # Vite :5173, proxies /api,/lecture,/open -> uvicorn :8799
npm run verify                   # the gate: lint + tsc --noEmit + vitest run (439) + vite build
npm run build                    # writes frontend/dist/ (FastAPI serves it at / with an SPA fallback)
```

## Layout (source of truth)

- `samagra/adapters/` — read-only source adapters → common `Artifact` (incl. Phase 1 `mcd.py`, `munshi.py`).
- `samagra/clients/` — read-only subsystem HTTP clients: `McdClient` (mycontentdev admin API), `MunshiClient` (`library()`); secret-safe, never logged.
- `samagra/governance/store.py` — Phase 2 durable `governance.db` store (D6): `assignments`, `events`, `review_overlay` + `schema_version`/migration hook + `backup()`. **Never delete `governance.db` as a "catalog reset".**
- `samagra/review/` — Phase 2 advisory pre-commit Codex review (D5): `codex_dispatch.py` (vendored subprocess shim, lazy exe) + `precommit.py` (confirmed-CRITICAL + `state/review/` diff-hash cache + `SAMAGRA_REVIEW_BREAKGLASS` audit). CLI: `samagra review-staged`.
- `.githooks/pre-commit` — committed shim → `python -m samagra.review.precommit`. Activate (owner) with `git config core.hooksPath .githooks`.
- `board/{deepak,khanak,codex}/` — per-agent `AGENTS.md` + `outbox/` (indexed by `assignments`).
- `samagra/catalog.py` — `samagra.db` unified catalog (FTS5) + search/overview/facets.
- `samagra/state.py` — phase state machine; `state/<pipeline>.orchestrator_state.json` + `tracker.txt`.
- `samagra/scheduler.py` — `tick()`, `gate()`, Task Scheduler installer.
- `samagra/notify.py` — Telegram + email (creds-gated, always logs `state/notifications.log`).
- `samagra/lectures/` — `render.py` (content.json→HTML), `thin.py`, `export.py` (HTML/DOCX/GDocs), `gdocs.py`.
- `samagra/api/app.py` — FastAPI; serves the Vite build at `/` (mounts `frontend/dist/assets`, SPA fallback `GET /{full_path}` declared LAST, 404s `api/*`, 503 if not built); `/api/*`, `/lecture/{slug}`, `/open` are a frozen contract.
- `frontend/` — **SAMAGRA OS E1 + fidelity layer** (React 18 + TS + Vite; own `package.json`, lockfile tracked, `dist/` gitignored). `src/lib/**` = pure headless-testable engines (WM geometry/z-order, snake, clock, terminal, notes, persistence) each co-located with a `*.test.ts`; `src/stores/**` = thin Zustand over `lib/`; `src/themes/**` = the per-theme token map (aqua/console/samagra — **FD1**); `src/components/{Icon,AppIcon}.tsx` = the SVG icon system (**FD2**, `icons-data.ts`); `src/shell/**` = theme-driven chrome (`ThemeRoot` · `TopBar` · `Dock` · `Taskbar` · `StartMenu` · `Rail` · `WindowFrame` · `ContextMenu`); `src/apps/**` = the six OS utilities; `src/registry.ts` = the frozen 17-app table.

## Sources (read-only, paths in samagra/config.py / .env)

QX `C:\SandBox\gpt_box\gpt-extract-ques` · textbook `C:\SandBox\gpt_box\physics-textbook`
· booklets `claude-booklet-proofer` · INSP `claude-INSP-extract` · sims `pratyaksh-May-deploy` (never write).

## Gotchas

- Python 3.11 venv (`.venv`) for the portal; system Python is 3.14 (stdlib-only CLI works there too).
- Do **not** use `uvicorn --reload` here — an orphaned reload worker held the port once. Use the preview harness or plain uvicorn.
- QX `subject` column is unpopulated (physics-only); facet on chapter/q_type instead. **(Directly relevant to the ⚠ KNOWN BUG — `/api/facets.subjects` is catalog-wide, so the Questions chips surface sims `SIM0xxx` ids, not question subjects.)**
- DOCX math: Pandoc `html+tex_math_dollars` converts `$...$` → OMML (verified: 130 eqns in vectors-thick).
- Don't write to `physics-textbook/queue.json` — SAMAGRA tracks approvals in its own `state/`.

## Open / needs user consent

**SAMAGRA OS (Experience track):**
- **E2 (2026-06-21): MERGED to `main` (fast-forward, `31aa5bb`) and pushed to `origin/main`** — the 11 data apps
  + `GET /api/org`, after a Codex pre-merge review (GO; 3 MEDIUMs fixed) (backend 106/106 + frontend 501/501).
  Owner to-do = the browser-vision pixel-QA pass over the 11 E2 apps, then E3 (see the ▶ STATUS banner above for
  the full E2 write-up). The E1 detail below is retained for history.
0. **E1 BUILT + GREEN + 3-theme/icon fidelity layer landed (2026-06-20) on `e1/samagra-os`.** The full
   `frontend/` app shipped TDD (E1.1–E1.25); a fidelity layer then added theme-driven chrome for **aqua ·
   console · samagra** (all colours/sizes from the `themes/` token map — FD1) and the `Icon`/`AppIcon` SVG
   system (FD2) across every launcher + the six apps. **QA1 fidelity gate clean:** `npm run verify` (lint +
   `tsc` + **439 Vitest / 38 files** + `vite build`, no `.only`/`.skip`) and backend `pytest` 102/102 (incl.
   `test_serve_seam.py`). **Owner to-do now:** (a) the **browser-vision pixel QA pass** over the three-theme
   shell + apps (pixel/interaction parity — outside any loop, never a loop gate; **NOT yet run — pixel parity
   NOT claimed**); (b) the merge/integration decision for `e1/samagra-os` (see
   `superpowers:finishing-a-development-branch`). **Next build = E2** (data/control apps — read-only wiring
   over `/api/*`; one hard backend gap = `GET /api/org` via static `samagra/org.py`). **No new creds needed**
   (the GUI reads existing `/api/*`); E2's mcd/munshi apps render graceful creds-gated empty states.

   **Browser-vision pixel QA sign-off (fidelity boundary — owner-run, RUBRIC §6).** Per spec §7.4/§10-item-9
   and `docs/superpowers/loops/RUBRIC.md` §6, pixel & interaction parity is a **human / browser-vision QA
   pass, never a loop gate** — run once per surface with `npm run dev` (Vite :5173) or a built `samagra
   serve`, against the extracted prototype + `screenshots/`. The owner (deepak) signs each row here. **Status:
   all rows PENDING** (logic green, theming + icon wiring green, build green — *not yet* "looks right"; the
   headless gate proves the markup/tokens/icons, not the pixels). Surfaces:
   - [ ] **Theme chrome (×3)** — aqua (top bar **30px** · bottom-centre Dock **radius 20** + hover lift · left traffic-lights), console (no top bar · bottom Taskbar **50px** + Start menu · right-side neon icon controls · active glow ring), samagra (Devanagari **समग्र** top strip · left **Rail 66px** + active accent bar · warm window frame). WindowFrame radii aqua **13** / console **10** / samagra **15**; **38px** title bar; right controls 28×23; double-click maximize; ContextMenu **width 216**.
   - [ ] **Icons (FD2)** — every dock/rail/Start/app glyph is an inline 24×24 stroke `<svg>` via `Icon`/`AppIcon` (no letter badges); per-app accent colours from `APPS[id].accent`.
   - [ ] **Dashboard** — hero-stat layout, pipeline-bar density, board + recent-activity spacing.
   - [ ] **Settings** — Appearance (3 theme swatch cards) / Device toggle / Integration rows; pill active vs needs-creds states; this is the production theme + device switcher.
   - [ ] **Terminal** — prompt rendering, line-class colors from the per-theme palette, welcome banner.
   - [ ] **Clock** — hand sweep, ring depletion, chime, tab visuals.
   - [ ] **Notes/To-dos** — list/editor split, "● Autosaved" footer, filter chrome.
   - [ ] **Snake** — movement feel, speed ramp, death visuals, D-pad, themed board (cream in samagra).
   - [ ] **Components** — Pill/Card/Chip/IconButton accent + spacing parity across all three themes.

**Phase-2 owner-gated — ALL DONE (2026-06-19):**
1. **Pre-merge Codex review → APPROVE** (gpt-5.5, xhigh): 6 rounds + a CEO adversarial Workflow audit. Caught a never-wedge HIGH, a recurring "outer guard downgrades a confirmed-CRITICAL block" class (5 ever-deeper instances: cache prune, malformed cached findings, broken-stderr warnings, pathological exception str/repr, and a finding's raising `__eq__` on the dedup), + 2 MEDIUM + nits — all fixed TDD (+11 invariant regressions, suite 98). Reports `docs/codex-reviews/07–13` + `12-workflow-invariant-audit.md`.
2. **Hook ACTIVE** — `core.hooksPath=.githooks` set; every commit + worktree now runs the advisory gate (`codex` 0.140.0 on PATH).
3. **Worktrees created** — `../samagra-{deepak,khanak,codex}` on `agent/{deepak,khanak,codex}`.
4. **Pushed** — `origin/main` holds Phase 2 through `da9cab3`. (NOTE: this end-of-session tracker-sync commit is local-only/unpushed — `git push origin main` it at the start of the next session.)

**Creds (slice-1, unchanged):**
5. **Notification creds** — fill `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` + gmail `SMTP_PASS` in `.env`.
6. **Google Docs** — set `GOOGLE_OAUTH_CLIENT` (Desktop OAuth JSON); run an export to complete consent flow.
7. **Phase 3 munshi** — drop `MUNSHI_API_URL` + `MUNSHI_SECRET` into `.env` (live worker secret value) to switch on the active loop's munshi reads. mcd already reads live via `mcd-cloud.json`.

## Slice 2 (planned)

Real worker dispatch for `questions`/`papers`/`media` pipelines (Codex/Gemini/NotebookLM/Grok);
deploy QX + portal online (HF Space `QuestionDB` / Docker).
