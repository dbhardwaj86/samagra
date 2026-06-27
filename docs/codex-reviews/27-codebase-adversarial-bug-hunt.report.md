# Review 27 — Codebase-wide adversarial bug hunt

**Date:** 2026-06-27
**Scope:** Whole `samagra/` Python package (~7,000 LOC) at `main` (HEAD `e848e95`, post Phase G1).
**Method:** 7 Codex agents (codex-cli 0.140.0), one per dimension, each briefed on the 8 project
invariants and a priority file list. Every raw Codex finding was then handed to an independent
**Claude skeptic** (Opus, high reasoning effort, *refute-framed* — default to FALSE unless the exact
code path is confirmed). Cross-engine verification: Codex hunts, Claude disproves.
**Cost:** 27 agents · ~1.67M tokens · ~13 min wall-clock. Workflow `wf_1da3fb19-2fe`.

## Verdict

**20 raw findings → 15 confirmed, 5 refuted. Confirmed severity (post-verification): 0 HIGH · 3 MED · 12 LOW.**

Codex initially graded **8 findings HIGH**; the adversarial verifiers down-graded *all eight* —
each either duplicated a previously-accepted-LOW item under the documented single-operator
manual-CLI threat model, was guarded by an existing check the hunter missed, or had no reachable
consumer for the claimed impact. No finding breaches a load-bearing invariant: the read-only
firewall, the never-automated publish gate, the 5 build() crash-guards, secret handling, the DEC-8
reviewer firewall, governance append-only/no-migration, and the answer-leak guard all **held**.

The clean dimensions — **no real bug found**: SQL/FTS5 injection, ANTHROPIC key leakage, DEC-8
reviewer firewall, governance migration safety, `connect_ro`, coverage rebuild idempotency, CLI
dispatch routing, the core assignment state machine, the coverage 3-state/gap-ranking rules.

---

## Confirmed findings

| # | Sev | Dimension | Title | Location |
|---|-----|-----------|-------|----------|
| 1 | **MED** | error-robustness | MCD-availability not preflighted → mcd seed assignment wedges before any write | `factory/run.py:380` |
| 2 | **MED** | web/cli | Unauthenticated `/open` serves answer-bearing QX source files | `api/app.py:54` |
| 3 | **MED** | web/cli | `_PROTECTED_GETS` misses cached Munshi/MCD data via `/api/search` + `/api/assignments`; `limit=-1` dumps cache | `api/origin_auth.py:44` |
| 4 | LOW | crash | Concurrent `build()` can double-write (incl. mcd `create_seed`) | `factory/run.py:365` |
| 5 | LOW | crash | Republish overwrites authoritative bytes before the new record is written | `factory/publish/run.py:151` |
| 6 | LOW | crash | publish/unpublish governance events can orphan/duplicate if `write_publication` fails | `factory/publish/run.py:169` |
| 7 | LOW | security | Answer-leak guard runs *after* paper/drill artifacts are written (no cleanup) | `factory/paper.py:156` |
| 8 | LOW | security | QX question HTML embedded verbatim into artifacts (stored-XSS shape) | `factory/paper.py:112` |
| 9 | LOW | firewall | Scheduler reflector auto-`done`s a human publish gate (dead code) | `scheduler.py:94` |
| 10 | LOW | logic | Explicit `--lane seed` on a munshi seed silently returns empty plan | `factory/run.py:168` |
| 11 | LOW | logic | `mine_deltas` accepts any `samadhan:`-prefixed review row, not just factory-lane | `factory/style/learn.py:86` |
| 12 | LOW | error-robustness | Crash after `product_created` but before terminal status strands a completed build | `factory/run.py:422` |
| 13 | LOW | web/cli | MCD capture POST raises `TypeError` (500) on non-string `type` instead of 400 | `api/app.py:295` |
| 14 | LOW | data | StyleSeed version-file write is non-atomic (crash → truncated current profile) | `factory/style/profile.py:57` |
| 15 | LOW | data | StyleSeed `ratify` non-idempotent — crash+retry double-applies the signed step | `factory/style/learn.py:186` |

### MED-1 — MCD-availability not preflighted (`factory/run.py:380`)
The mcd lane validates the proposed payload *shape* (`validate_seed_payload`) before recording the
`product_building` intent, but never checks that MCD is configured/reachable. With no
`MCD_API_URL`/admin key and no `mcd-cloud.json`, `build()` records intent, then
`dispatch.run_seed()` → `McdClient().create_seed` → `requests.post("/api/seeds", …)` raises
`MissingSchema` **after** the intent is durable. The `except` deliberately skips
`product_build_failed` for `kind=="mcd"` (the fail-safe anti-double-write wedge), so the assignment
sits permanently `product_building`; `_build_in_flight` refuses every retry and `reopen` refuses the
mcd lane on kind grounds → only a manual governance-row edit recovers it.
**Why MED not HIGH:** the wedge is deliberate-by-design (mcd can't distinguish "never left the
machine" from "may have committed"), no data lost, no double-write, single-operator threat model.
But the validate-before-intent pattern is applied to payload shape and *not* to MCD availability —
a real gap. **Fix:** add an `McdClient.available()` preflight *before* recording intent (pass the
checked client into `run_seed`); keep the wedge only for failures after the request may have landed.

### MED-2 — Unauthenticated `/open` serves answer-bearing QX files (`api/app.py:54`)
`ALLOWED_ROOTS` includes `config.QX_ROOT`, `_OPEN_ALLOWED_EXT` includes `.json`, and `/open` has no
auth (`_PROTECTED_GETS` covers only two paths). Empirically reproduced: answer-bearing QX QC reports
exist at `QX_ROOT/codex_jobs/*/reports/*.report.json` (with `answer_audit` + explicit answers); a
`GET /open?path=<that file>` returns 200 with the answer body.
**Why MED not HIGH:** path-knowledge-gated (no directory listing; `QX_ROOT` is an operator-only
absolute path not exposed by the API), the leaked data is internal QC audit not the student corpus,
and the primary deploy sits behind Cloudflare Access. The factory `_assert_no_answer_leak` invariant
is about *produced* artifacts, not this source-file server — so it's an information-disclosure /
defense-in-depth gap, not an invariant breach. **Fix:** drop `QX_ROOT` (or its `codex_jobs`/`reports`
subtrees) from `ALLOWED_ROOTS`, or gate `/open` + move to an artifact-id allowlist.

### MED-3 — `_PROTECTED_GETS` cache bypass (`api/origin_auth.py:44`)
`_PROTECTED_GETS = {"/api/munshi/library", "/api/mcd/seeds"}` gates the *live* upstream reads, but
the same admin-keyed Munshi `meta.payload` is returned unauthenticated through the **cache** via
`GET /api/search?source=munshi` (`catalog.search` reparses `meta_json` → `meta`), and governance
proposal `note`s leak via `GET /api/assignments`. `limit=-1` is passed straight to SQL (SQLite treats
it as no-limit) → full-cache dump.
**Why MED not HIGH:** the origin gate is explicit defense-in-depth *behind* Cloudflare Access, so
this is a second-layer bypass + an unbounded-dump amplifier, not a sole-gate breach. **Fix:** add
`/api/search` + `/api/assignments` to `_PROTECTED_GETS` (or strip `meta_json`/`note` for
unauthenticated callers) and clamp `limit` to a positive max.

### LOW findings (condensed)
- **4 — Concurrent build double-write:** read-then-check guards with no per-assignment lock/CAS. *Already adjudicated LOW* in review 23 (H2) under the single-operator manual-CLI model; mcd keeps its in-flight wedge. Optional hardening: optimistic `UPDATE … WHERE status='approved'` CAS.
- **5 — Republish overwrites bytes before record:** crash after `write_published_file` but before `write_publication` leaves disk ahead of the record's sha256. No consumer exists yet (G2 reader deferred) and a retry self-heals. **Harden before G2 ships a reader:** write to `published/<chapter>/<pub_id>/<basename>` (content/pub-namespaced) so paths are never overwritten.
- **6 — Orphan/dup publish events:** events-before-record (the deliberate MED#1 fix) accepts the inverse window — events committed, record crash → retry appends a second event set. Audit-only (events are never consumed for control flow). Optional: deterministic `publication_id` + idempotent event append.
- **7 — Answer-leak guard runs after write:** `build_paper` writes JSON+HTML, *then* `validate_product` scans (and doesn't delete). No live leak (QX search render is answer-free by construction); guard is defense-in-depth for a hypothetical QX regression. **Harden:** validate-before-write or delete-on-failure inside the engine.
- **8 — QX HTML verbatim (stored-XSS shape):** question `body` interpolated unescaped into the artifact (metadata *is* escaped). Same un-sanitized HTML already flows through live `GET /api/questions`; QX is the owner's own curated read-only corpus. **Harden:** sanitize/allowlist QX HTML at the SAMAGRA boundary.
- **9 — Reflector auto-`done`s publish gate:** `_reflect_mycontentdev` sets the `publish` phase `done` though `state.py` declares it `human`-owned. **Dead code** — never called from `tick()`; the real gate is the factory/governance boundary, and nothing reads this JSON field. Cleanup nit: raise to `awaiting_gate`, not `done`.
- **10 — `--lane seed` silent empty plan:** `plan()` routes munshi seeds only when `lane is None`; `--lane seed` falls through the generic loop and `continue`s past mcd-kind, returning `[]` with no error. **Fix:** route munshi seeds when `lane in (None,'seed')`, or raise "omit --lane for munshi seeds".
- **11 — `mine_deltas` subsystem filter missing:** query filters on `verdict='changes' AND artifact_uid LIKE 'samadhan:%'` but not `subsystem`. A foreign subsystem colliding on the `samadhan:` prefix pollutes the *proposed* queue (ratify stays owner-gated → no auto-mutation). **Fix:** add `AND subsystem='factory'`.
- **12 — Strand after `product_created`:** crash between the `product_created` commit and `set_assignment_status` leaves status `approved`; build refuses (guard 2), reopen refuses (needs `changes`), publish skips (needs `captured`) → stranded but not lost. Same non-atomic-FS/DB class accepted LOW before. **Fix:** finalize status idempotently from a prior `product_created`, or one-transaction the pair.
- **13 — MCD capture `TypeError`:** `if typ not in _SEED_TYPES` with no `isinstance` guard → unhashable `type:[…]` raises `TypeError` (500) instead of 400. The sibling munshi endpoint already guards (`isinstance(kind,str)`); mcd is the outlier. **Fix:** `if not isinstance(typ,str) or typ not in _SEED_TYPES`.
- **14 — StyleSeed non-atomic write:** `profile.save()` is a plain `write_text` (no temp+`os.replace`, no existence guard); `current_version()` trusts the max-version filename without validating content → crash mid-write yields a truncated "current" profile. Git-committed `styleseed/` makes it owner-recoverable; accepted-LOW class. **Fix:** atomic temp+`os.replace`, validate JSON on load.
- **15 — StyleSeed `ratify` non-idempotent:** `save(v+1)` happens *before* the `UPDATE … status='ratified'` commit. Crash in between → retry re-applies the signed step to v+1, producing v+2 with double the delta. Authors document the window (git-visible recovery); accepted-LOW class. **Fix:** reserve target version + content-hash idempotency key before the file write; one-transaction the status update + audit event.

---

## Refuted findings (5)

1. **build() product_created-before-status framed as HIGH "retry re-produces"** — *refuted*: guard 2 (`_already_built`) refuses the retry; the engine does not re-run. The milder real variant (stranding) is confirmed as LOW-12.
2. **Origin-auth spoofable `Cf-Access-Authenticated-User-Email` fallback (HIGH)** — *refuted*: documented, intentional weaker-interim posture, explicitly defense-in-depth behind Cloudflare Access, auto-retired once AUD+team domain are configured; wrong-email is still 403. Hardening (fail-closed) optional, not a defect.
3. **`McdClient.query` can issue arbitrary write SQL (HIGH)** — *refuted*: the server `/api/admin/query` enforces `^(select|with|pragma)` and strips trailing `;`, so DML/DDL is rejected; the only callers pass hardcoded SELECTs. Read-only firewall intact.
4. **Publish idempotency ignores file paths (MED)** — *refuted to NIT*: `unchanged_lanes` compares sha256 sets only, but artifact basenames are a deterministic pure function of (slug, lane), so "same bytes, different path within a lane" is unreachable. Tuple-compare is optional hardening.
5. **`classify_item` drops person-tagged questions as ops (MED)** — *refuted*: intended-by-design per the Phase-3 spec, and the munshi capture whitelist makes `kind="question" + person` impossible on real data (question isn't a capturable munshi kind; `person` is whitelisted only for `followup`).

---

## Recommended remediation order

**Worth fixing now (small, clearly correct, pattern-consistent):**
- MED-1 `McdClient.available()` preflight before mcd build intent.
- MED-3 add `/api/search` + `/api/assignments` to `_PROTECTED_GETS`; clamp `limit`.
- MED-2 narrow `/open` (drop QX subtrees from `ALLOWED_ROOTS`).
- LOW-13 `isinstance` guard on the mcd capture `type` (one line, matches munshi sibling).
- LOW-11 `AND subsystem='factory'` in `mine_deltas`.
- LOW-10 raise (not silent `[]`) on `--lane seed` for munshi.

**Harden before Phase G2 ships an outward reader:**
- LOW-5 pub-id-namespaced published paths; LOW-7 validate-before-write in `paper`; LOW-8 sanitize QX HTML at the boundary.

**Accept-as-LOW (already adjudicated / out of single-operator threat model):**
- LOW-4, 6, 12, 14, 15 — non-atomic FS+DB ordering & manual-CLI concurrency; git/owner-recoverable.

**Cleanup nit:** LOW-9 reflector `awaiting_gate` instead of `done`.

> Note: most LOWs are pre-accepted under the project's documented single-operator manual-CLI threat
> model and would matter only once a multi-writer / server-invoked / outward-reader surface exists.
> The two web MEDs (2, 3) are the most worth closing because they touch the one genuinely
> network-exposed surface, even behind Cloudflare Access.

---

## Remediation (2026-06-27)

The "worth fixing now" set was remediated TDD (failing test → fix → green) on branch
`fix/codex-review-27-remediation`. Six findings closed:

| # | Sev | Fix | Files |
|---|-----|-----|-------|
| MED-1 | MED | `McdClient.available()` preflight before the mcd `build()` records intent — unconfigured mcd now refuses cleanly + retryably (no wedge); a configured-but-unreachable write still keeps the fail-safe wedge. | `factory/run.py` |
| MED-2 | MED | Dropped `QX_ROOT` from `/open`'s `ALLOWED_ROOTS` — closes the absolute-path answer-audit surface; QX stays served via the answer-safe `/api/questions` proxy (catalog QX rows use relative paths that never resolved there). | `api/app.py` |
| MED-3 | MED | Added `/api/search` + `/api/assignments` to `_PROTECTED_GETS`; clamped `/api/search` `limit` to `[1, 500]` (kills the `limit=-1` dump). | `api/origin_auth.py`, `api/app.py` |
| LOW-10 | LOW | `plan()` routes a munshi seed for `lane in (None, "seed")` — explicit `--lane seed` no longer returns a silent empty plan. | `factory/run.py` |
| LOW-11 | LOW | `mine_deltas` query scoped with `AND subsystem='factory'` — a foreign row colliding on the `samadhan:` prefix can't pollute the style queue. | `factory/style/learn.py` |
| LOW-13 | LOW | `isinstance(typ, str)` guard before the `_SEED_TYPES` membership test — a non-string `type` now returns 400, not a TypeError 500. | `api/app.py` |

**+11 tests** (1 reframed: the DEC-7 fail-safe-wedge fake now models a *configured* client, distinct
from the new unconfigured-refusal test). Gate: **545 passed, 1 skipped** (opt-in live-LLM smoke; the
lone pre-existing env red `test_gdocs` is unrelated). No invariant touched — the fixes only *tighten*
the firewall (narrower `/open`, more gated GETs, earlier mcd refusal) and harden input validation.

**Deferred (not in this batch, by design):** LOW-4/6/12/14/15 (pre-accepted non-atomic-FS+DB / manual-CLI
concurrency, git/owner-recoverable); LOW-5/7/8 (harden before Phase G2 ships an outward reader);
LOW-9 (dead-code reflector cleanup nit).
