# SAMAGRA — Handoff

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
> **E1 (shell + aqua theme + OS utilities) is BUILT + GREEN on branch `e1/samagra-os` (2026-06-20), and a
> 3-theme + icon fidelity layer has now landed on top of it.**
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
> **QA1 fidelity gate (2026-06-20): `npm run verify` clean — lint + `tsc --noEmit` + 419 Vitest tests across
> 38 files + `vite build` writing `dist/`, no `.only`/`.skip` in the diff — and the backend `pytest` suite at
> 102/102 green (incl. `test_serve_seam.py`).** Linchpin held: all real behaviour lives in pure-TS
> headless-testable modules; **pixel/interaction fidelity is a separate browser-vision QA pass** (owner-run,
> never a loop completion signal) — **it has NOT run; pixel parity is NOT claimed.** The headless gate proves
> the markup, tokens and icon wiring are correct, not that the rendered pixels match the screenshots.
> **Next step = the browser-vision pixel pass** (owner-run, per-surface vs the prototype + `screenshots/`),
> then **E2** (data/control apps — read-only wiring over the existing `/api/*` contract; one hard backend
> gap = `GET /api/org`).
> **Phase 3 (active loop) is PARKED** (plan complete, resumes after the Experience track; will need live
> `MUNSHI_API_URL`/`MUNSHI_SECRET` in `.env`). Carried into Phase 3: F1/F4 refresh hardening.

**Repo:** github.com/dbhardwaj86/samagra · branch `e1/samagra-os` (E1 build) · local-first Python+FastAPI.
**State:** Spine + portal + thin/thick exporter + semi-autonomous loop + two read-only subsystem adapters
(mycontentdev seeds, munshi `library()`) reflecting into the catalog, **+ Phase-2 governance**: durable
`governance.db` store (assignments / events ledger / review overlay), `GET /api/assignments` + the
Assignments portal tab, an advisory Codex pre-commit gate (`samagra/review/`), the committed
`.githooks/pre-commit` shim, and per-agent board files (`board/{deepak,khanak,codex}/`), **+ SAMAGRA OS E1
+ fidelity layer**: the `frontend/` React+TS+Vite windowing shell (three themes — aqua/console/samagra chrome
· `Icon`/`AppIcon` SVG system · WM · six OS utilities on tested pure-TS engines) served by FastAPI from
`frontend/dist/`. **Backend 102/102 pytest green; frontend 419/419 Vitest green.**

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
npm run verify                   # the fidelity gate: lint + tsc --noEmit + vitest run (419) + vite build
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
- QX `subject` column is unpopulated (physics-only); facet on chapter/q_type instead.
- DOCX math: Pandoc `html+tex_math_dollars` converts `$...$` → OMML (verified: 130 eqns in vectors-thick).
- Don't write to `physics-textbook/queue.json` — SAMAGRA tracks approvals in its own `state/`.

## Open / needs user consent

**SAMAGRA OS (Experience track):**
0. **E1 BUILT + GREEN + 3-theme/icon fidelity layer landed (2026-06-20) on `e1/samagra-os`.** The full
   `frontend/` app shipped TDD (E1.1–E1.25); a fidelity layer then added theme-driven chrome for **aqua ·
   console · samagra** (all colours/sizes from the `themes/` token map — FD1) and the `Icon`/`AppIcon` SVG
   system (FD2) across every launcher + the six apps. **QA1 fidelity gate clean:** `npm run verify` (lint +
   `tsc` + **419 Vitest / 38 files** + `vite build`, no `.only`/`.skip`) and backend `pytest` 102/102 (incl.
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
