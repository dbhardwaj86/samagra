# RALPH BACKLOG — SAMAGRA OS ship & tunnel

Living, prioritized task list for the loop in `PROMPT.md`. Work top-to-bottom (Phase A → B → C). Check
off `[x]` when done *with evidence*; append discovered work; record `BLOCKED:` notes inline. Each item
should be one focused, committable unit.

## Phase 0 — setup
- [x] **C-0 · Branch base.** **DONE 2026-06-22.** Decision: **Option B** — branched `ship/samagra-os`
  off `e3/samagra-os` HEAD (`396ca50`) **without** merging PR
  [samagra#4](https://github.com/dbhardwaj86/samagra/pull/4) to `main`. Rationale: merging to the
  shared `main` is outward-facing + the owner's call and isn't required for the loop; branching off the
  PR head keeps #4 reviewable, lands loop commits on the fresh branch, and is fully reversible. The
  #4→main merge defers to the owner / C-2. PR #4 confirmed OPEN + MERGEABLE. Baseline gates **green on
  this exact tree**: **backend 152 pytest** (3×72/72/8 dots, 0 failures) + **frontend `npm run verify`**
  (lint→tsc→vitest→`vite build ✓ 1.83s`, 22 lazy chunks). Branch creation is a pointer change (tree
  byte-identical), so the gate result carries. Hygiene: gitignored the stray `Web OS GUI design.zip`
  binary + pre-emptive Phase-B tunnel-secret patterns (`*.pem`, `cloudflared/*.json`, `mcd-cloud.json`).

## Phase A — make it fully working (functional DoD A1–A8)
- [x] **A-1 · Production-serve audit. DONE 2026-06-22.** Built `dist/` (via `npm run verify`), served by
  FastAPI on `:8799` (preview-owned; killed a stale orphan uvicorn first — see Discovered). Walked all
  **17 apps in aqua/pc** with `preview_*` (dock-launcher click → read window `[role=dialog]` innerText →
  close). **Result: 17/17 open and render real data — 0 empty windows, 0 empty-icon glyphs, 0 console
  errors.** Evidence: Dashboard + Pipelines screenshots; per-app innerText capture (Org tree, Questions
  search+facets 7KB, Lectures 4.5KB, INSP 6KB, Simulations 24KB, Munshi **live** items w/ creds, mcd
  live seeds, Notes/Clock/Terminal/Snake interactive, Activity+Assignments graceful empties, Settings).
  - **Non-bug found & cleared:** Pipelines first appeared empty at a 1.4s batch wait — it's the *first*
    `/api` hit after cold server start and fires two calls (`/api/pipelines`+`/api/org`); at 3s it fully
    renders 5 pipeline cards. Cold-start latency only — note for any timed smoke test.
  - Drives A-2 (no-op, see below) and substantially satisfies A-3's live-data path.
- [x] **A-2 · Register missing app icons. DONE 2026-06-22.** A-1 found NO missing glyphs (all 17 AppIds
  have a non-empty `ICONS` entry; every dock tile rendered a real `<svg>`), so no production fix was
  needed. Locked it in with a **regression guard** `frontend/src/components/icons-data.test.ts` (TDD:
  proved it bites — temporarily set `ICONS.pipelines=""` → test went RED with
  `ICONS["pipelines"] is empty → empty-icon fallback`, then restored byte-identical). It asserts, keyed
  off the authoritative `registry.ORDER`, that every launched AppId has real non-empty path data (each
  `|`-segment non-empty, starts with `M`) and that `keys(ICONS) === keys(APPS)` — gaps the existing
  `Icon.test.tsx` (`Object.keys(ICONS)` loop) could not catch. Gate: frontend **543 vitest / 62 files**
  (+2) green; lint+tsc+`vite build` green. No backend change.
- [x] **A-3 · Data paths per app. DONE 2026-06-22.** Live-data path VERIFIED in A-1 (all 17 render real
  `/api/*` data; munshi/mcd live with `.env` creds; Activity/Assignments graceful empties). Creds-absent
  graceful path now VERIFIED with durable tests: the live-read passthroughs (`GET /api/munshi/library`,
  `GET /api/mcd/seeds`) return **200 + `{results:[], error}`** (never a 500) when the adapter is
  unconfigured or the upstream read fails, and **never leak secret detail**. Completed the asymmetric
  test matrix in `tests/test_api_live_reads.py` (added munshi read-failure-no-leak + mcd-unconfigured;
  each endpoint now covers live/unconfigured/read-failure-no-leak). TDD: proved the new munshi no-leak
  test bites (temporarily leaked `e` in the except branch → RED on `tok_abc`/`MUNSHI_SECRET`, restored).
  Write paths already had `*_unconfigured → 503` coverage. Frontend renders it gracefully
  (`Munshi/index.tsx` shows `data.error ?? "Munshi not available — set MUNSHI_API_URL/MUNSHI_SECRET."`).
  Gate: backend **154 pytest / 0 failures** (live_reads 4→6). No production code change.
- [x] **A-4 · Questions ⇄ QX. DONE 2026-06-22.** QX sidecar already up on `:8783`; verified end-to-end
  through the FastAPI `:8799` proxy. **Exact** `q=capacitor` → 488 results, 25 rows (browser screenshot
  shows a real question with a **rendered circuit-diagram figure** + options + `mcq_single · physics ·
  Electrostatics`), `degraded:false`. **Semantic** `q=projectile motion` → 67,276 results, `degraded:false`.
  **KaTeX**: 15 math spans, all 15 typeset (`.katex` count == `.ktx[data-tex]` count). **Figures**: 26
  rendered. Filter-scoped facet chips (subject/chapter/qtype) present. **Zero console errors.** Graceful
  banner already present: frontend `Questions/index.tsx` renders `error`/`questions-notice`/
  `questions-degraded`; backend `tests/test_api_questions.py::test_graceful_when_qx_unreachable` proves a
  QX "connection refused" returns a graceful `{error: "…unavailable…"}` (no 500). No code change needed.
- [x] **A-5 · Mobile pass. DONE 2026-06-22.** Switched to mobile device mode (desktop right-click →
  "Switch to Mobile") and walked all **17 apps** in the phone frame (`shell/Mobile.tsx`, 392×812) via the
  17-app grid + 4-app favorites dock. **Result: 17/17 open, render real data, and open → Home works; max
  horizontal overflow now 1px** (sims sub-pixel rounding) — **0 console errors**. Found & FIXED **2 real
  clipping bugs** (the phone screen is `overflow:hidden`, so horizontal overflow is *cut off*, not
  scrollable):
  - **INSP** was **145px** over (content 522 vs 377 screen): the `catalog-list` `<section>` had no
    explicit grid column, so its single implicit `auto` track grew to the rows' max-content (long
    single-line filename titles). Fixed with `gridTemplateColumns: minmax(0,1fr)` (caps the column to
    the container) **and** `minWidth:0` + `overflowWrap:break-word` on the flex title block (so long
    unbreakable tokens wrap). Re-measured **0px**, titles wrap, 136 rows.
  - **Assignments** was **15px** over: the rigid `repeat(5, 1fr)` kanban grid (`1fr` has a min-content
    floor). Fixed with `repeat(auto-fit, minmax(96px,1fr))` — the 5 columns reflow to 3+2 rows on the
    phone yet still fill the row on desktop (test still sees 5 columns). Re-measured **0px**.
  Added **3 durable regression guards** (jsdom has no layout engine, so they assert the shrink-capable
  CSS contract — all provably bite vs the prior source): Assignments grid uses `auto-fit`+`minmax` (not
  `repeat(5`); INSP title block has `min-width:0` + `overflow-wrap:break-word`; INSP list column is
  `minmax(0,…)`. Gates: **frontend 546 vitest / 62 files** (+3) + lint+tsc+`vite build ✓`; **backend 154
  pytest / 0 failures** (no backend change). Browser proof: home-grid, Assignments (reflowed 3+2), INSP
  (wrapped titles) screenshots.
- [ ] **A-6 · Theme pass.** Exercise console + samagra across every app + the shell chrome; fix any
  aqua-only leakage; confirm windows open/clamp correctly per theme (E3 theme-aware WM geometry).
- [ ] **A-7 · Console-error sweep.** Across every app × {pc, mobile} × {aqua, console, samagra}, confirm
  `preview_console_logs` shows zero errors; fix any that appear.
- [ ] **A-8 · Adversarial review + gates.** Run an adversarial-review workflow over the accumulated diff;
  fix confirmed findings. Final gate: backend pytest + `npm run verify`, no `.only`/`.skip`. Paste output.

## Phase B — deploy via Cloudflare tunnel (DoD B1–B5) — public step is OWNER-GATED
- [ ] **B-0 · Owner confirm (STOP point).** Get from the owner: the exact **custom hostname** (proposed
  `os.pratyakshsims.com`), which **Cloudflare zone** owns it, and authorization to run
  `cloudflared tunnel login`. Do not expose anything publicly before this.
- [ ] **B-1 · Local bring-up script.** `scripts/serve-local.(ps1|sh)`: build frontend → start uvicorn
  `:8799` → start QX sidecar `:8783`; idempotent; prints health. Commit (no secrets).
- [ ] **B-2 · Access/auth in front (HARD).** Stand up Cloudflare Access (owner email / one-time-PIN
  policy) for the custom hostname, OR an app-gateway auth, so `/api/*` writes + admin keys are not
  open. Verify an unauthenticated request to a write path is blocked. *Must precede B-4.*
- [ ] **B-3 · Tunnel config.** `cloudflared tunnel create samagra-os`; write committed `config.yml`
  (ingress `<host>` → `http://localhost:8799`, 404 fallback; `credentials-file` path OUTSIDE the repo).
  Gitignore the creds JSON + `cert.pem`. Use the `cloudflare`/`wrangler` skills.
- [ ] **B-4 · Bring up + DNS (OWNER-GATED public step).** With owner go-ahead: route DNS
  (`cloudflared tunnel route dns …`) and `cloudflared tunnel run`. Then load the custom URL in a real
  browser and smoke ALL apps × both devices × themes over TLS (same-origin `/api`, so no CORS).
- [ ] **B-5 · Persistence + runbook.** Make the tunnel restartable (service or documented run cmd);
  write a `docs/deploy-tunnel.md` runbook (bring-up order, the QX `:8783` dependency, restart, teardown).
  Confirm the public URL recovers after a restart.

## Phase C — finish
- [ ] **C-1 · Trackers + memory.** Update STATUS.html / HANDOFF.md / SUMMARY.html + the project memory
  with the working+deployed state and the public URL (note Access-gated).
- [ ] **C-2 · Finish the branch.** Merge or PR `ship/samagra-os` (use
  `superpowers:finishing-a-development-branch`).

---
### Discovered / blocked (append below)
_(loop appends new tasks and `BLOCKED:` notes here)_

- **D-1 · Stale orphan uvicorn on `:8799` (2026-06-22, handled).** On entry, a prior-session `python`
  uvicorn (PID from `01:37`) still held `:8799` (the gotcha HANDOFF §2 warned about). A-1 killed it and
  let `preview_start` own a fresh serve. **Action for B-1:** the bring-up script should detect/clear a
  stale `:8799` listener before starting (and likewise the QX `:8783`).
- **D-2 · `preview_start` must own the server.** It refuses to attach to an externally-started uvicorn;
  set `"autoPort": false` on the `samagra` config in `.claude/launch.json` (done) and free `:8799` first,
  then `preview_start({name:"samagra"})` spawns it on 8799. Recorded so later UI iterations don't re-derive.
- **D-3 · Cold-start latency.** First `/api/*` request after uvicorn start can take ~2–3s (catalog/init).
  Any automated smoke/health check must allow for it (warm the server with one request before asserting).
- **D-4 · QX sidecar is a hard deploy dependency.** Questions only works while the QX engine runs on
  `:8783` (separate repo `C:\SandBox\gpt_box\gpt-extract-ques`, `python -X utf8 gui/qx_browser.py`) with
  the `GET /api/qsearch` code active. It's currently up and serving real exact+semantic results. **B-1**
  must start/health-check `:8783` alongside `:8799`; **B-5** runbook must document it. Keep `:8783`
  internal — only `:8799` is tunnelled (reached via the same-origin `/api/questions` proxy). If QX isn't
  running, Questions degrades gracefully (banner) rather than 500 — verified.
- **D-5 · Driving mobile mode in the browser (2026-06-22).** The stores aren't on `window`. To enter
  mobile: dispatch a `contextmenu` MouseEvent on `#samagra-os-shell` (the bare-desktop handler checks
  `e.target===e.currentTarget`, so dispatching on the shell node itself passes) → click the
  `button[role=menuitem]` "Switch to Mobile". **Mobile mode has NO desktop context menu** (by design —
  no right-click on a phone), so to switch *back* to PC use the Settings app DEVICE toggle **or** just
  reload (`device` is in-memory, defaults `pc`, `stores/theme.ts:36`). Launchers are
  `[data-testid=mobile-grid] button[title="<AppName>"]`; Home is `[data-testid=mobile-home-indicator]`.
  Overflow/clip metric: `mobile-app.scrollWidth - clientWidth` (screen is `overflow:hidden`). Reused by
  A-6/A-7.
