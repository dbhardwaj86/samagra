# SAMAGRA OS — Ralph-loop session handoff: ship it & tunnel to Cloudflare

> **For the NEXT session.** This is the entry point. Read this, then run the loop in
> [`PROMPT.md`](PROMPT.md) against the living [`BACKLOG.md`](BACKLOG.md) until the Definition
> of Done is met. The mission: **drive the SAMAGRA OS app to fully-working, then expose it at a
> custom URL via a Cloudflare tunnel to the local stack.**

---

## 0. State at handoff (2026-06-22)

- **Branch:** `e3/samagra-os` — open PR [samagra#4](https://github.com/dbhardwaj86/samagra/pull/4)
  (E3 mobile mode + theme-correct WM geometry + responsive Dashboard + the S3/S4 test-LOWs).
  Gates green: **backend 152 pytest · frontend 541 vitest / 61 files** + `tsc`/`vite build`.
  **Decide first:** merge PR #4 to `main` (or keep working on a fresh branch off it) before the loop
  starts piling on commits — see BACKLOG `C-0`.
- **DEC-4 attention-ROI gate: ASSUMED UNBLOCKED** (owner directive, 2026-06-22). The pre-E3 gate is
  treated as satisfied for this session — do **not** re-block GUI/deploy work on it. (DEC-1 bounded
  operator console and DEC-3 *read-only except owner-initiated capture* + the never-automated publish
  gate still hold — see §4 Guardrails.)
- **What's NOT done (this is the loop's job):** the owner browser-vision pixel/interaction pass was
  never run; some E2 app glyphs may still fall back to an empty icon; the app has never been served
  publicly. Questions depends on the QX sidecar running locally.

## 1. Mission & Definition of Done

The loop is **done** when ALL of the following hold and are *evidenced* (gates run + real-browser
proof), not asserted:

**A — App fully working (served from `frontend/dist/` by FastAPI, NOT just `npm run dev`):**
1. All **17 apps** open and render **real data** when FastAPI-served — no empty windows, no
   empty-icon fallbacks (every app glyph registered in `components/icons-data`).
2. **Mobile device mode** works for every app in the phone frame (open → Home, no overflow/clipping).
3. **All 3 themes** (aqua · console · samagra) render correctly across every app + shell; windows
   open/clamp in the right place per theme (the E3 theme-aware WM geometry).
4. **Questions** works end-to-end through the QX sidecar `:8783` (exact + semantic + KaTeX + figures);
   a graceful banner shows if QX is down.
5. **Capture** paths work with live creds (munshi todo/note/followup + mcd seed) and the live-read apps
   show real data; creds-absent → graceful states.
6. **Zero console errors** on a smoke pass of every app × {pc, mobile} × {aqua, console, samagra}.
7. **Gates green:** backend `pytest` + frontend `npm run verify` (lint + `tsc` + vitest + `vite build`),
   no `.only`/`.skip`.
8. An **adversarial-review workflow** over the diff comes back with no confirmed CRITICAL/HIGH/MEDIUM.

**B — Deployed to Cloudflare (custom URL → localhost tunnel):**
1. A **named `cloudflared` tunnel** routes a **custom hostname** (owner-confirmed; proposed
   `os.pratyakshsims.com`) → `http://localhost:8799`, served over Cloudflare-edge TLS.
2. The custom URL serves **all apps, both devices, all themes** end-to-end (same-origin `/api`, so no
   CORS). The QX sidecar runs locally so Questions works through the tunnel.
3. **Access control is in front of the tunnel** (Cloudflare Access policy, or an app-gateway auth) so
   the capture write-paths (`POST /api/munshi/capture`, `POST /api/mcd/seeds`) and admin keys are
   **NOT reachable unauthenticated**. *Hard requirement — see §4.*
4. A **repeatable bring-up**: one script builds the frontend and starts uvicorn `:8799` + the QX
   sidecar `:8783`; a second brings up the tunnel. Tunnel config is committed; **credentials are not**.
5. Public URL smoke-verified end-to-end (agent browser + a real external fetch); the Access gate is
   confirmed to block unauthenticated access to `/api/*` writes.

**C — Finish:** trackers (STATUS/HANDOFF/SUMMARY/memory) updated; branch merged or PR'd.

## 2. The local stack (what the tunnel points at)

| Component | Command (cwd) | Port | Notes |
|---|---|---|---|
| Frontend build | `npm install && npm run build` (`frontend/`) | — | emits `frontend/dist/`; FastAPI serves it at `/` with SPA fallback |
| Backend (serves dist + `/api`) | `set PYTHONPATH=%CD% && .venv\Scripts\python -m uvicorn samagra.api.app:app --host 127.0.0.1 --port 8799` (repo root) | **8799** | **same-origin** prod serve — the Vite dev proxy is dev-only and irrelevant here |
| QX sidecar (Questions) | `python -X utf8 gui/qx_browser.py` (`C:\SandBox\gpt_box\gpt-extract-ques`) | **8783** | hard dependency for Questions; `/api/questions` proxies it; keep it internal (NOT tunnelled) |
| Cloudflare tunnel | `cloudflared tunnel run <name>` | — | ingress: `<custom-host>` → `http://localhost:8799` |

- `.env` (gitignored) supplies live capture creds: `MUNSHI_API_URL`/`MUNSHI_SECRET` (munshi),
  `mcd-cloud.json` (mcd `adminKey`). Without them the capture/live-read apps show graceful states.
- Don't use `uvicorn --reload` here (an orphaned reload worker held the port once — see CLAUDE.md).
- Backend pytest exits 1 on Windows from a cosmetic tmpdir teardown *after* all pass — run with
  `--basetemp=.pytest_tmp` (and clean it up) to silence; **0 failures is the real signal**.

## 3. How to run the loop

This is a **ralph loop**: re-feed the same [`PROMPT.md`](PROMPT.md) every iteration; each pass picks the
single highest-priority unchecked [`BACKLOG.md`](BACKLOG.md) item, does it TDD, verifies, commits,
updates the backlog, and re-checks the DoD — stopping when the DoD is met.

- **Primary (harness-native):** `/loop` self-paced — pass the contents of `PROMPT.md` as the loop input
  (omit an interval so the model paces itself). It re-enters each turn until you stop it or the DoD
  gate trips.
- **Alternative (code phases):** a `Workflow` loop-until-done for the bulk fix phases (Phase A), with
  the deploy phase (Phase B) driven inline because its public-exposure step is owner-gated.
- **Manual fallback:** literally `while :; do <feed PROMPT.md to a fresh agent>; done`, stopping when
  the agent reports the DoD met.

Ultracode is on in this workspace — lean on adversarial-review workflows and real-browser verification
(the `preview_*` tools) rather than asserting success.

## 4. Guardrails (binding — encoded in PROMPT.md)

1. **The public-exposure step is OWNER-GATED.** The loop may build, fix, script, and *locally* test the
   tunnel, but it must **STOP and get explicit owner confirmation before first making the app reachable
   on the public internet** (custom hostname + DNS + `cloudflared` run). Exposing localhost is
   outward-facing and hard to reverse.
2. **Access control before exposure (hard DoD).** Never expose `:8799` publicly without auth in front —
   the capture write-paths + admin keys would otherwise be open to the world. Cloudflare Access is the
   preferred gate.
3. **Never commit secrets** — tunnel credentials (`*.json` cred file, `cert.pem`), `.env`, `mcd-cloud.json`,
   `MUNSHI_SECRET`. Add to `.gitignore`; commit only the non-secret tunnel `config.yml` (with the
   credentials path pointed outside the repo).
4. **Scope stays bounded (DEC-1/DEC-3).** No new apps beyond the frozen 17, no entertainment beyond
   Snake, no marketplace/scheduler-platform; read-only **except** the two owner-initiated capture
   write-paths; the **publish gate is never automated**; no munshi→mcd bridge.
5. **TDD + small commits + keep the branch green.** Write the failing test first; don't mark an item
   done with a red gate. For UI work, verify in a real browser (`preview_*`) and screenshot — pixel
   parity is the owner's call, but functional + no-console-errors is the loop's.
6. **Anti-thrash.** If a backlog item fails 3 iterations, log it as a `BLOCKED:` note in BACKLOG with
   the failure detail and move to the next item; don't loop on the same wall.
7. **Don't claim done without evidence** — paste the gate output and the public-URL smoke result.

## 5. Cloudflare specifics (cloudflared named tunnel)

Use the `cloudflare` / `wrangler` skills in this workspace. Outline (the loop fills in + verifies):
1. `cloudflared tunnel login` (owner-gated; opens a browser to authorize the **zone that owns the
   custom hostname** — confirm with the owner which zone, e.g. `pratyakshsims.com`).
2. `cloudflared tunnel create samagra-os` → writes a credentials JSON (keep OUTSIDE the repo / gitignore).
3. `config.yml` (committed, no secrets):
   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: <path outside repo>/<TUNNEL_ID>.json
   ingress:
     - hostname: os.pratyakshsims.com   # CONFIRM with owner
       service: http://localhost:8799
     - service: http_status:404
   ```
4. `cloudflared tunnel route dns samagra-os os.pratyakshsims.com` (creates the CNAME in the zone).
5. Put **Cloudflare Access** in front of `os.pratyakshsims.com` (email/one-time-PIN policy for the
   owner) BEFORE announcing it works.
6. `cloudflared tunnel run samagra-os` (or install as a service for persistence).
7. Smoke: load the custom URL in a real browser; confirm all apps + both devices; confirm `/api/*`
   writes require auth.

> Note: the full stack (Python + QX + the BGE index) can't run on Cloudflare Workers/Pages — that's
> *why* this is a tunnel to the local machine, not an edge deploy. Only `:8799` is tunnelled; QX `:8783`
> stays internal and is reached via the same-origin `/api/questions` proxy.

## 6. Pointers
- App serve seam: `samagra/api/app.py` (mounts `frontend/dist/assets`, SPA fallback last, `/api/*`).
- Config/ports: `samagra/config.py` (`PORT=8799`, `QX_SERVER_URL=:8783`, `SIMS_ROOT`).
- Frontend: `frontend/` (Vite; `npm run verify` is the gate). Mobile shell `src/shell/Mobile.tsx`;
  icons `src/components/icons-data.ts`.
- Run/gotchas: root `HANDOFF.md` → *Run it* + *Gotchas*; the E3 details + `e3-mobile-polish` memory.
- Prior loop infra for reference: `docs/superpowers/loops/{deepak,khanak}-loop.js`, `RUBRIC.md`.
