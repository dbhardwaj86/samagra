# RALPH LOOP — SAMAGRA OS: ship it & tunnel to Cloudflare

You are one iteration of an autonomous improvement loop. This same prompt is fed to you every
iteration. Do **one** unit of high-value work, verify it, commit it, update the backlog, then re-check
whether the mission is complete. Be surgical, not sprawling.

## Mission
Drive the SAMAGRA OS app to **fully working** (served from `frontend/dist/` by FastAPI), then **deploy
it to Cloudflare via a `cloudflared` tunnel at a custom URL pointing to the local stack** — until the
Definition of Done in `HANDOFF.md` §1 is met. Full context, the local stack, ports, env, and the
Cloudflare outline are in `docs/superpowers/loops/ralph-deploy/HANDOFF.md`. The prioritized,
checkable task list is `docs/superpowers/loops/ralph-deploy/BACKLOG.md`.

## Each iteration — do exactly this
1. **Orient.** Read `HANDOFF.md` (§1 DoD, §2 stack, §4 guardrails) and `BACKLOG.md`. Run the gates to
   learn the true current state — don't trust prior claims:
   - backend: `PYTHONPATH=$(pwd) .venv/Scripts/python -m pytest -p no:cacheprovider --basetemp=.pytest_tmp`
     (`.pytest_tmp/` is gitignored and disposable — no cleanup command needed; **0 failures is the real
     signal**, the Windows tmpdir-teardown exit-1 is cosmetic)
   - frontend: `cd frontend && npm run verify`
2. **Re-check the DoD (HANDOFF §1).** If EVERY item A1–A8, B1–B5, C is satisfied *with evidence*
   (gate output + real-browser/public-URL proof) → **STOP the loop**: write a closing summary, update
   trackers (STATUS/HANDOFF/SUMMARY/memory), and finish the branch. Do not keep looping.
3. **Pick ONE item** — the highest-priority unchecked `[ ]` task in `BACKLOG.md` (top to bottom; Phase A
   before Phase B before C). Skip any marked `BLOCKED:` unless you can now unblock it.
4. **Do it, TDD.** For code: write the failing test first, watch it fail, implement the minimum to pass,
   then run the narrow test AND the full gate. For UI: change source, then **verify in a real browser**
   with the `preview_*` tools (start the dev or built server, smoke the surface, screenshot, check
   `preview_console_logs` for errors). For infra/deploy: do the step and verify its effect.
5. **Verify green.** Backend pytest + `npm run verify` must pass. No `.only`/`.skip`. Zero new console
   errors. If you can't get green, revert the change rather than leave the tree red.
6. **Commit** small and descriptive (Co-Authored-By footer per repo convention). **Update `BACKLOG.md`**:
   check off the item, append any newly-discovered work, and record `BLOCKED:` notes with detail.
7. End the iteration. (The loop re-feeds this prompt for the next unit.)

## Guardrails (do not violate)
- **OWNER-GATED public exposure.** You may build, script, and *locally* test the tunnel, but **STOP and
  ask the owner for explicit confirmation before first making the app reachable on the public internet**
  (custom hostname + DNS + `cloudflared tunnel run`). It is outward-facing and hard to reverse.
- **Access control before exposure (hard DoD B3).** Never expose `:8799` publicly without auth in front
  (Cloudflare Access preferred) — capture write-paths + admin keys must not be open to the world.
- **Never commit secrets** — tunnel creds (`*.json`, `cert.pem`), `.env`, `mcd-cloud.json`,
  `MUNSHI_SECRET`. Gitignore them; commit only the non-secret `config.yml`.
- **Scope stays bounded (DEC-1/DEC-3):** the frozen 17 apps only; read-only **except** the two
  owner-initiated capture write-paths; the publish gate is **never** automated; no munshi→mcd bridge.
  DEC-4 is assumed unblocked for this session.
- **Anti-thrash:** if an item fails 3 iterations, mark it `BLOCKED:` with the failure detail and move on.
- **Evidence, not assertions:** never report an item or the mission done without pasting the gate output
  and (for UI/deploy) the browser/public-URL smoke result.

## Notes
- Prod serve is **same-origin** (FastAPI serves `dist/` + `/api`) — no CORS in production; the Vite dev
  proxy is dev-only. Questions needs the QX sidecar on `:8783` (separate repo `gpt-extract-ques`).
- Use the `cloudflare` / `wrangler` skills for the tunnel + Access work.
- Prefer adversarial-review workflows before declaring the functional DoD (A) met.
