# Plan — post-audit hardening + DEC-4 ROI-gate rescoping (next session)

**Created:** 2026-06-22 (end of the adversarial-audit session) · **for:** the next working session.
**Source of work:** the consolidated critical review
[`docs/codex-reviews/21-consolidated-critical-review.md`](../../codex-reviews/21-consolidated-critical-review.md)
(multi-agent workflow `20-…` + Codex `19-…`). Both reviewers: **GO-WITH-CAVEATS — the docs are honest.**
Ground truth at HEAD `95a6270`: backend **154 pytest** + frontend **546 vitest**, green.

> **Discipline:** TDD throughout (red→green), strictly read-only audits, `npm run verify` + `pytest` green before
> any merge. Keep the read-only-except-owner-capture invariant. Do **not** auto-snapshot/merge — owner-gated.
> Suggest `/snap-pre` before the security edits.

---

## Workstream 1 — Security hardening (do first)

### W1.1 · HIGH — Make the FastAPI origin fail closed (defence-in-depth behind Access)
**Problem:** `samagra/api/app.py` has no auth at all; Cloudflare Access is the *sole* gate over **five**
unauthenticated mutating POSTs (`/api/refresh`, `/api/tick`, `/api/gate/{pipeline}/{decision}`,
`/api/munshi/capture`, `/api/mcd/seeds`) plus admin-keyed reads. The origin holds prod creds server-side, so
anyone who reaches `:8799` directly (an edge misconfig, a `0.0.0.0` bind, a second tunnel) needs no credential —
incl. `/api/gate/textbook/approve`, which advances a human publish gate.

**Fix (design in-session, TDD):**
- Add FastAPI middleware that, for **remote** requests, requires a valid Cloudflare Access identity
  (`Cf-Access-Jwt-Assertion`) — full version validates the JWT against the Access app's `AUD` + the team JWKS
  (`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`); cheaper interim = require the
  `Cf-Access-Authenticated-User-Email` header to equal the owner email. Decide which in-session.
- **Loopback / dev bypass:** requests from `127.0.0.1`/`::1` (the normal local + tunnel-origin path) and a
  `SAMAGRA_DISABLE_ORIGIN_AUTH` dev flag must pass, so local dev + the existing tunnel keep working.
- Gate **all five** mutating POSTs (not just the two capture routes) + the two admin-keyed live reads.
- Tests: remote-no-header → 403; remote-valid-identity → 200; loopback → 200; per route.

### W1.2 · MED — Sanitize QX HTML before render (XSS)
`frontend/src/apps/Questions/index.tsx:176` injects QX HTML via `dangerouslySetInnerHTML`. Sanitize to a safe
subset (KaTeX spans + `<img>` from the QX asset host only), or have QX emit a strict safe subset. Add a test with
a hostile `<script>`/`onerror` payload.

### W1.3 · MED — Validate `SAMAGRA_QX_SERVER_URL` (SSRF / asset-host)
`samagra/clients/qx_client.py` + `questions_proxy.py` trust the configured QX base URL for both the backend fetch
and the absolutized figure URLs. Constrain it to loopback (or an explicit allowlist) at config load; test a
poisoned URL is rejected.

### W1.4 · MED — Move schema DDL/migration off the GET hot-path
`catalog.connect()` runs DDL and `/api/assignments` calls `gstore.init_tables` on every read, so GET routes are
not side-effect-free. Run migrations once at startup (FastAPI lifespan) / CLI; open SQLite read-only for reads.

### W1.5 · MED — Expand the deploy threat model + tighten `/open`
- `docs/deploy-tunnel.md` §5: enumerate **all five** mutating POSTs (esp. `/api/gate/*` = gate approve), fold
  them into the W1.1 origin-auth requirement; drop the "optional, later" framing.
- `/open` (`app.py:141-151`) serves any file under the broad source roots. Prefer open-by-catalog-id and/or an
  extension allowlist + deny hidden/secret patterns (defence-in-depth; traversal is already blocked).
- `.gitignore`: add `**/cloudflared/*.json` so a tunnel-cred copied beside the committed config can't be committed.

## Workstream 2 — Doc-precision fixes (fast, low-risk)
- "exactly two write paths" → "exactly two **subsystem** write paths" in `STATUS.html:548` + `CLAUDE.md`
  (the spec + HANDOFF already qualify it).
- Correct the SIM0xxx provenance: the live Questions chips come from the `/api/questions` payload facets
  (`facets.ts:52`), **not** `/api/questions/facets` (a dead endpoint); either wire the endpoint to the UI **with**
  its non-alpha filter, or fix the doc line + delete the dead endpoint/type.
- Refresh stale counts: HANDOFF lead banner 152/541 → **154/546**; reconcile the 4+ backend / 7+ frontend counts
  to one current figure.
- Use `mycontentdev` (not `mcd`) for the adapter key in docs (`get_adapter("mcd")` returns `None`).
- Resolve `detail?` in the seed spec (`specs/2026-06-21-…:186`) — drop it or wire it through.
- Note the MathJax (lectures) vs KaTeX (questions) split; the public `/lecture/{slug}` loses math offline/CSP.
- Symmetric non-string handling in mcd vs munshi capture (munshi rejects, mcd coerces).

## Workstream 3 — Test debt (LOW; tighten "TDD throughout")
- Lecture exporter: cover `export._html_to_docx` (Pandoc subprocess) + `gdocs.upload` (mock the subprocess/Drive).
- Notifications: test `_telegram` + `_email` wiring (mock `requests`/SMTP); fix the stale "via Hermes bot" docstring.
- Guard / deprecate `samagra serve --reload` (contradicts the D-1 orphaned-worker gotcha).
- `questiondb` stub: stop reporting `available()=True` while yielding 0 artifacts (operator-console honesty).

## Workstream 4 — DEC-4 attention-ROI gate: rescope (owner-gated decision)
**The tension (not a code defect):** DEC-4 was ratified "binding — run *before* E3," but E3 **and** the public
deploy shipped ahead of it, and Phase 3 (the value engine) stays parked. The docs are honest ("deferred, not
voided") but the project keeps building past its own gate. Decide deliberately rather than drift. **Options:**

- **(A) Run the original gate now.** Pick 2–3 real operator tasks (triage the day's munshi captures into
  seed-candidates vs ops; read pipeline + gate status across the 5 pipelines; locate+open a specific artifact),
  time them in SAMAGRA OS vs the old portal/point-tools. Pass = GUI reduces total owner time → continue;
  Fail = freeze GUI expansion, reprioritize Phase 3. *(Honors the 2026-06-19 vision literally.)*
- **(B) Rescope the gate.** Re-tie it to the next real expansion (Phase 3 / further polish) instead of the
  already-shipped E3; or replace the wall-clock stopwatch with a lighter, repeatable check (e.g. a per-task
  step-count, or instrument the governance `events`/`review_overlay` ledger to compute minutes-per-published-
  artifact automatically). Re-ratify the threshold (the ~3 hrs/wk figure was a seed proposal).
- **(C) Formally retire/relax DEC-4** if the owner judges the bounded-console GUI already proven — and update the
  docs so nothing is described as "binding" that the project ships past.

**This is the Chairman's (Deepak's) call** — present A/B/C, capture the decision, then mirror it into HANDOFF /
STATUS / SUMMARY / both specs / CLAUDE.md (the same carriers DEC-1..DEC-5 live in). Recommended: **(B)** — keep
the north-star binding but make the gauge cheap + automatable from the ledger, and tie it to the *next* expansion
(Phase 3) rather than re-litigating shipped work.

---

## Suggested order & gating
1. W1.1 (HIGH) → verify gate bites with tests + a manual remote-vs-loopback check.
2. W1.2–W1.5 (MED security) → `pytest` + `npm run verify` green.
3. W4 decision (owner) — ideally before W2/W3 so the docs are rewritten once, consistently.
4. W2 doc fixes + W3 test debt (batchable).
5. Sync HANDOFF / STATUS.html / SUMMARY.html (+ specs/CLAUDE.md for W4); suggest `/record-plan` for this file.

**Out of scope / unchanged:** read-only-except-capture invariant; never-automated publish gate; no munshi→mcd
bridge; DEC-1 bounded-console scope; the live deploy stays as-is (W1.1 is additive defence-in-depth, not a
re-architecture).
