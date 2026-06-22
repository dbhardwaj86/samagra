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
- [x] **A-6 · Theme pass. DONE 2026-06-22.** Exercised **console + samagra** across **all 17 apps + shell
  chrome** in a real browser (opened all 17 windows in aqua, then live-switched themes so every open
  window reskins via the `--samagra-*` CSS vars). **No aqua-only leakage found** — the leaf apps are
  var-driven by construction (static scan confirmed every hardcoded hue is an intentional fixed
  semantic/brand/data-viz color: danger `#ef4444`, success `#16a34a`, Clock day/night, Dashboard chart
  series, Snake's own `[data-theme]` board vars, Settings' theme-preview gradients).
  - **Per-app reskin** (luminance sweep of each window's largest text block): **console** (text
    `#e7eef8`) → all 17 light, **0 dark-text leakage** (min lum 0.42 = readable muted); **samagra** (text
    `#2a2118`) → all 17 dark-on-warm, **0 light-text leakage**. Theme CSS vars verified switching: console
    `bar-h:0px/rail:0px`, samagra `bar-h:32px/rail:66px/accent:#d9601a`.
  - **Shell chrome correct per theme** (screenshots): console = bottom Taskbar (Start + running strip +
    clock) · **no top bar** · right-side window controls; samagra = top bar (`समग्र` wordmark + Phase
    pill + clock) · **left Rail** of warm icons · right-side controls; status pills + accents recolor.
  - **Theme-aware WM geometry confirmed** (`lib/wm/geometry.workArea`): a fresh window opened *in* samagra
    lands at x=86,y=50,w=895 (clears rail+topbar, fits work area + viewport); *in* console at x=32,y=20,
    w=941 (origin {8,8}, no topbar); `reclampOnTheme` on switch kept **0/17 windows under the rail or top
    bar** (minX=74, minY=48). *(Noted: §1.9 reclamp intentionally does NOT resize, so a window wider than
    the new work area — e.g. opened in wide aqua/console then switched to samagra's rail-inset area —
    overflows the right edge on the cross-theme switch only, not the normal per-theme open path.)*
  - **0 console errors** in both themes. **No production code change** (verification pass, like A-4) — the
    3-theme system from E1/E3 is correct. Tree byte-identical to A-5 HEAD, so gates hold (frontend 546 /
    backend 154).
- [x] **A-7 · Console-error sweep. DONE 2026-06-22.** Swept **every app × {pc, mobile} × {aqua, console,
  samagra}** — the full 17×6 = 102 app-instance matrix — with `preview_console_logs` (error level)
  reading **zero errors** in every cell:
  | device \ theme | aqua | console | samagra |
  |---|---|---|---|
  | **pc** | ✅ 0 (A-1) | ✅ 0 (A-6) | ✅ 0 (A-6) |
  | **mobile** | ✅ 0 (A-5) | ✅ 0 (A-7) | ✅ 0 (A-7) |
  This iteration filled the two uncovered cells: **mobile+console** (17/17 open→Home, text `#e7eef8`) and
  **mobile+samagra** (17/17 open→Home, accent `#d9601a` — launcher icons correctly unify to the samagra
  accent; max overflow 1px, so the A-5 clip fixes hold under samagra too). Across two page sessions
  covering all the activity (17 desktop windows, theme reskins, WM geometry, both mobile sweeps) the error
  buffer stayed empty. Verification pass — no code change. Screenshots: mobile+console (dark), mobile+
  samagra (warm).
- [x] **A-8 · Adversarial review + gates. DONE 2026-06-22.** Ran a scoped **adversarial-review Workflow**
  (`wm31jrc5a`: 4 review dimensions over the accumulated diff `396ca50..HEAD` + refute-by-default
  verification of every finding): **0 raw findings, 0 confirmed** — no CRITICAL/HIGH/MEDIUM/LOW. Dimensions:
  CSS-fix desktop-regression · vitest-guard rigor/non-vacuity · backend A-3 test correctness · a11y/contract
  + config. (4 agents · 108 tool-uses · ~6.7 min.) The diff is only the A-5 CSS fixes + test guards + A-3
  backend tests + config + docs — all sound. **Final gates green (clean tree):** backend **154 passed / 0
  failures**; frontend `npm run verify` → **62 files / 546 tests passed** + lint + tsc + `vite build ✓
  1.91s`. No `.only`/`.skip` (0 matches in `frontend/src`). **✅ Functional DoD A (A1–A8) is COMPLETE.**

## Phase B — deploy via Cloudflare tunnel (DoD B1–B5) — public step is OWNER-GATED
- [x] **B-0 · Owner confirm. DONE 2026-06-22.** Owner authorized **proceed** with hostname
  **`samagra.pratyakshsims.com`** (zone `pratyakshsims.com`). Discovery via the `cloudflare` skill +
  read-only checks: `cloudflared` 2025.8.1 installed and authenticated (`~/.cloudflared/cert.pem` present);
  the account already has **3 legacy, not-live tunnels** (`bhautiki-prashnavali`/hermes → `:8765`,
  `mycontentdev-api`, `quizrag-demo`) + a default `~/.cloudflared/config.yml` for hermes — so `samagra-os`
  will be a **separate dedicated tunnel run with its own `--config`** (NEVER touching the hermes default).
  **Still to verify at route-dns time:** that `pratyakshsims.com` is a zone IN this CF account (else the
  owner re-runs `cloudflared tunnel login` for it). hermes is the template: dedicated tunnel + Access-OTP
  before exposure.
- [x] **B-1 · Local bring-up script. DONE 2026-06-22.** `scripts/serve-local.ps1` (Windows is the deploy
  host the tunnel points at): builds `frontend/dist` (unless `-SkipBuild`), starts the same-origin FastAPI
  on `:8799` + the QX sidecar on `:8783`, **idempotent** (reuses a server already passing its health check;
  `-Restart` forces a clean relaunch, clearing stale listeners per D-1), **health-checked** with cold-start
  tolerance (`/api/overview` ≤45s; QX `/api/qsearch?q=ping` ≤60s), and prints a status summary. **No
  secrets** — reports only whether `.env` / `mcd-cloud.json` EXIST (never contents); logs → gitignored
  `.serve-logs/`. ASCII-only (Win PS 5.1 reads BOM-less `.ps1` as ANSI — first write tripped this). Verified
  BOTH paths in a real shell: **reuse** (`-SkipBuild` → api+qx already HEALTHY, reused, exit 0) and **fresh
  start** (`-ApiPort 8899 -NoQx` → started uvicorn + health-checked HEALTHY, exit 0; test proc cleaned up,
  preview `:8799` preserved). No app-source change → backend 154 / frontend 546 gates unaffected.
- [x] **B-2 · Access/auth in front (HARD). DONE 2026-06-22.** Owner created a **Cloudflare Access**
  application (Zero Trust, one-time-PIN to owner email) on the live hostname. **Verified the gate bites:**
  an unauthenticated `GET https://samagra.bhautikiplusprashnavali.com/api/overview` returns **HTTP 302** →
  `Location: https://jolly-sound-164b.cloudflareaccess.com/cdn-cgi/access/login/...` + `Www-Authenticate:
  Cloudflare-Access` (NOT a 200 with API data). So `/api/*` writes + admin keys are not open. (The origin
  does not itself fail-closed — Access is the sole gate — so this smoke-test is load-bearing, not optional.)
- [x] **B-3 · Tunnel config. DONE 2026-06-22.** `cloudflared tunnel create samagra-os` → id
  `9b7a3df8-6fda-4500-b97c-4592c2dd101e` (creds JSON written to `~/.cloudflared/<id>.json`, OUTSIDE the
  repo, gitignored — never committed). Filled the committed `deploy/cloudflared/config.samagra.yml` with the
  real id + creds path (a tunnel UUID is not a secret; matches the hermes config convention) and the final
  ingress hostname. `cloudflared tunnel --config deploy/cloudflared/config.samagra.yml ingress validate`
  → **OK**.
- [x] **B-4 · Bring up + DNS (OWNER-GATED public step). DONE 2026-06-22.** Final hostname is
  **`samagra.bhautikiplusprashnavali.com`** (NOT pratyakshsims — see D-7). Local stack up via
  `serve-local.ps1` (FastAPI `:8799` HEALTHY + QX `:8783` HEALTHY, fresh `dist`). DNS routed
  (`cloudflared tunnel --config … route dns samagra-os samagra.bhautikiplusprashnavali.com`) → proxied
  CNAME → our tunnel `9b7a3df8…`. Tunnel running in background (`cloudflared tunnel --config … run
  samagra-os`) — **4 QUIC edge connections registered** (maa05/bom08/bom09). Gate smoke-test passed (B-2).
  **LIVE at https://samagra.bhautikiplusprashnavali.com behind Access.** Remaining human check: browser OTP
  login → walk apps × devices × themes over TLS (owner does this; can't OTP via curl).
- [x] **B-5 · Persistence + runbook. DONE 2026-06-22.** `docs/deploy-tunnel.md` updated to the as-shipped
  reality (bhautiki hostname, real tunnel id, cert-zone gotcha D-7, Access verified, junk-record cleanup D-8).
  **Durability via a logon Scheduled Task** (chosen over `cloudflared service install`, which would hijack the
  hermes default `~/.cloudflared/config.yml`): `scripts/serve-durable.ps1` brings the stack up (reuses healthy
  servers + the built `dist`, no npm needed) + starts the `samagra-os` tunnel **detached** (survives the
  shell), idempotent, touching ONLY the samagra `--config`; `scripts/install-durable-task.ps1`
  registers/removes the **"SAMAGRA-OS"** task that runs it **at logon** (user context, no stored password — so
  the URL is up once the owner is logged in, not at the pre-login lock screen; documented). **Verified:**
  detached `cloudflared` (pid on `config.samagra.yml`), task State=Ready, gate live (`/api/overview` → 302).
  Tradeoff for 24/7 pre-login uptime: a Windows service (separate from hermes) — noted in the runbook §8.

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
- **D-6 · Review Workflows must isolate from the working tree (2026-06-22).** The A-8 adversarial-review
  Workflow was launched WITHOUT `isolation: 'worktree'`, so its agents ran in the shared repo. Prompted to
  "verify each guard fails if the fix were reverted," they reverted/re-modified source in place to watch the
  guards bite, transiently churning the working tree (a concurrent gate run saw a false-red — 3 of my own
  A-5 guards "failing" on agent-reverted source). They restored byte-identical on completion and the
  committed HEAD was never at risk. **For future review/audit Workflows: pass `isolation: 'worktree'` OR
  instruct agents to be strictly read-only (no Edit/Write/git checkout); never run a gate while a
  tree-mutating Workflow is active.**
- **D-7 · cloudflared cert.pem is zone-scoped (2026-06-22).** `~/.cloudflared/cert.pem` (from a prior
  `cloudflared tunnel login`) is scoped to the **`bhautikiplusprashnavali.com`** zone. Even though
  `pratyakshsims.com` is on the SAME Cloudflare account (identical NS `elly`/`kenneth.ns.cloudflare.com`),
  `cloudflared tunnel route dns … samagra.pratyakshsims.com` could not write that zone — it **mangled** the
  name to `samagra.pratyakshsims.com.bhautikiplusprashnavali.com` (treated it as a relative label under the
  cert's zone). Using pratyakshsims.com would require re-running `cloudflared tunnel login` and selecting it
  (browser, owner-only). **Owner decision: use `samagra.bhautikiplusprashnavali.com`** (cert already covers
  it) — DNS routed first try. Also: always pass `--config <the tunnel's own config>` to `route dns` — without
  it cloudflared loaded the default hermes config and targeted the wrong tunnel (`40f0e7b2`).
- **D-8 · Junk DNS record to delete (2026-06-22).** The first mis-routed attempt left a stray CNAME
  **`samagra.pratyakshsims.com.bhautikiplusprashnavali.com`** → hermes tunnel `40f0e7b2`. Harmless (a weird
  FQDN nobody hits; does NOT affect `hermes.bhautikiplusprashnavali.com` or the real samagra host), but it
  should be deleted in the Cloudflare DNS dashboard (`cloudflared` has no `route dns delete`, and no CF API
  token is available locally). **Owner: delete it.**
