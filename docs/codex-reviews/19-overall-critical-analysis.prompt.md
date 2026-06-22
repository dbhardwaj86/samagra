You are performing a FULL, INDEPENDENT, ADVERSARIAL critical analysis of the SAMAGRA repo
(Python/FastAPI backend `samagra/` + React/TS/Vite frontend `frontend/`). You run in a
read-only sandbox: read whatever you need across the repo. Do NOT trust the project's own
docs — verify every claim against the actual code.

## Your mission
The project's implementation/vision docs make many specific claims. Independently judge whether
the CODE actually delivers what the docs claim, and surface real risks. The authoritative claim
sources to audit against code:
- `HANDOFF.md` (lead tracker — deploy, capture, Questions/QX, E1/E2/E3, governance, invariants)
- `docs/superpowers/loops/ralph-deploy/BACKLOG.md` (deploy A1–A8, B1–B5, C1–C2 evidence)
- `docs/superpowers/specs/2026-06-20-samagra-os-experience-design.md` and
  `docs/superpowers/specs/2026-06-21-samagra-control-plane-capture-design.md`
- `docs/superpowers/specs/2026-06-19-samagra-evolution-design.md` (vision, attention-ROI north-star,
  kill-criterion, the retired "OS" scope)
- `CLAUDE.md`, `STATUS.html`, `SUMMARY.html`

## What to scrutinize hard (verify against code, cite file:line)
1. **Safety invariant** — docs claim "read-only EXCEPT owner-initiated capture", with "exactly two
   write paths": `POST /api/munshi/capture` and `POST /api/mcd/seeds`. But `samagra/api/app.py` also
   exposes `POST /api/refresh`, `POST /api/tick`, `POST /api/gate/{pipeline}/{decision}`. Is the
   "exactly two write paths" claim honest? Do those other POSTs mutate state / external systems?
   Does the frontend `useApi` stay GET-only? Is there any munshi→mcd bridge (forbidden)? Is any
   publish step automated (forbidden)?
2. **Capture write paths** — field whitelisting, validation, creds-gating, and CRITICALLY whether
   any upstream/secret detail can leak in an error response or log (`samagra/api/app.py`,
   `samagra/clients/{munshi_client,mcd_client}.py`). Does the server-side whitelist match the
   frontend TS contract (`frontend/src/lib/capture/{munshi,seed}.ts`)?
3. **Deploy / Cloudflare** — the docs say "Access is the SOLE gate; the origin does NOT fail
   closed." Confirm there is no `Cf-Access-*` header enforcement in the app — i.e. anyone who can
   reach `:8799` directly (bypassing Access) hits open write paths + admin-keyed reads. Judge this
   risk. Check `deploy/cloudflared/config.samagra.yml`, `scripts/serve-*.ps1`,
   `scripts/install-durable-task.ps1`, and `.gitignore` for committed secrets or weakened posture
   (e.g. ExecutionPolicy Bypass, world-exposed ports, secrets in committed files).
4. **Questions ⇄ QX** — `/api/questions` proxy + `samagra/questions_proxy.py` asset absolutization +
   `samagra/clients/qx_client.py`; graceful-when-down (never 500); `/api/questions/facets`
   question-scoped + the non-alpha subject filter. Is the SIM0xxx chip leak truly structurally gone?
   Any SSRF / open-redirect / asset-URL rewrite risk in the proxy?
5. **Sims** — `samagra/sims_manifest.py` parse robustness + `sim_url()` raising on bad ids;
   `GET /api/sims` (the "482 sims" claim — count it from the source file if present).
6. **Governance (Phase 2)** — `samagra/governance/store.py` (durable governance.db separate from the
   rebuildable catalog) + `samagra/review/precommit.py` advisory hook claims: confirmed-CRITICAL-only,
   diff-hash cache, audited break-glass, NEVER wedges a commit. Try to find a path where the hook
   wedges, or where a confirmed-CRITICAL is silently downgraded.
7. **Direction coherence** — the 2026-06-19 vision retired the word "OS" and bound an attention-ROI
   north-star + kill-criterion. The project then shipped a 17-app "SAMAGRA OS" GUI. Judge honestly:
   is the current scope coherent with the ratified DEC-1..DEC-5 decisions, or is there live drift?
8. Anything else genuinely risky: path traversal in `/open`, the SPA catch-all, secret handling,
   error-swallowing `except Exception` that could hide real failures, dead/contradictory claims.

## Output format
Write a concise report. For each finding: SEVERITY (CRITICAL/HIGH/MEDIUM/LOW), a one-line title,
`file:line`, what the doc claims vs what the code does, and a concrete fix. Group by the area above.
Separate "doc/code mismatches" from "genuine engineering/security risks." End with:
- a table of every major doc claim → VERIFIED / PARTIALLY-VERIFIED / CONTRADICTED / UNVERIFIABLE-FROM-CODE
- a final one-line verdict: GO / GO-WITH-FIXES / NO-GO on "do the docs honestly describe the code?"
Be skeptical and specific. Cite line numbers.
