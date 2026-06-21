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
- [ ] **A-1 · Production-serve audit.** `npm run build`, start uvicorn `:8799`, and with the `preview_*`
  tools open EACH of the 17 apps (aqua/pc). Screenshot each; record every broken/empty window or
  empty-icon glyph in a checklist here. (This drives A-2…A-7.)
- [ ] **A-2 · Register missing app icons.** Fix any empty-icon fallback in
  `frontend/src/components/icons-data.ts` so every app glyph renders a real `<svg>` (FD2) — likely some
  E2 apps. Add/extend the icon tests.
- [ ] **A-3 · Data paths per app.** For each app, confirm it renders real data from `/api/*` when
  FastAPI-served; creds-gated munshi/mcd show graceful states without creds and live data with them.
  Fix any app that renders empty/errored against the real backend.
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
