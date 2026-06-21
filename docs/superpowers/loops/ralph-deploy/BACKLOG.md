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
- [ ] **A-3 · Data paths per app.** **AUDIT (A-1): live-data path VERIFIED** for all 17 against the real
  FastAPI backend (data apps show real catalog data; munshi/mcd show **live** data with `.env` creds;
  Activity/Assignments show correct graceful empties). **Remaining:** verify the **creds-absent** graceful
  states for munshi/mcd (temporarily unset creds, confirm no 500 / friendly empty), then check off.
- [ ] **A-4 · Questions ⇄ QX.** Start the QX sidecar `:8783`; verify Questions exact + semantic + KaTeX
  + figures through the tunnel-bound backend. Add a health-check banner when QX is down (don't 500).
- [ ] **A-5 · Mobile pass.** In the phone frame, open every app via the grid + favorites dock; fix
  overflow/clipping; verify open → Home for each. Screenshot a representative set.
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
