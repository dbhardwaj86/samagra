# Multi-agent adversarial doc-claim audit — SAMAGRA

- **Method:** dynamic Workflow, 11 feature dimensions, 51 agents, 632 tool-uses, ~20 min.
- **Per dimension:** adversarial auditor (claim->code) -> 2 refute-by-default skeptics per flagged finding (correctness + impact lenses) -> completeness critic -> synthesis.
- **All agents strictly read-only** (enforcing the repo's own D-6 lesson). Test counts injected (backend 154 pytest / frontend 546 vitest, both green at HEAD).
- **Tally:** 96 findings across 11 dimensions; 16 CONFIRMED, 2 DISPUTED.
- **Companion:** Codex independent analysis at `docs/codex-reviews/19-overall-critical-analysis.report.md`.

---

# SAMAGRA doc-claim adversarial audit — synthesis

## 1. Verdict

**GO-WITH-CAVEATS.** The implementation and vision docs are unusually honest: every load-bearing capability claim (capture write-paths, QX proxy, sims parser, governance hook, the spine, the 17-app GUI, the DEC-1..DEC-5 decisions) is VERIFIED in code, and the docs openly admit their own weakest points rather than hiding them. The caveats are real but bounded: the security posture rests entirely on an external gate the origin does not back up (HIGH), the "exactly two write paths" invariant undercounts the actual mutating routes (MEDIUM), and the project's behavior is in live tension with its own ratified attention-ROI gate (MEDIUM).

## 2. Confirmed issues (ranked by severity)

### HIGH — Origin does not fail closed; Cloudflare Access is the sole gate over live write paths
- **Status:** CONFIRMED (both skeptics upheld, high confidence) · **ID:** DEP-08 / RO-8
- **Evidence:** `samagra/api/app.py` (entire 295-line module) has zero `add_middleware` / `Depends`-auth / `Cf-Access-*` header checks. Open write paths: `POST /api/munshi/capture` (app.py:174-203) and `POST /api/mcd/seeds` (app.py:210-230). Admin-keyed live reads: `/api/munshi/library` (app.py:260-268), `/api/mcd/seeds` GET (app.py:271-279). Control-plane mutating POSTs with no auth at all: `/api/refresh` (118-121), `/api/tick` (124-126), `/api/gate/{pipeline}/{decision}` (129-137). The origin holds the production credentials server-side (`munshi_client.py:21,26-31`; `mcd_client.py:42,46,51,64`), so an unauthenticated caller who reaches `:8799` needs no credential of their own.
- **Gap:** Docs admit it (`docs/deploy-tunnel.md:22-23` "the origin does not itself fail closed, so Access is the only gate") but frame the fix as "optional, later" (`:115-118`) and scope that hardening note to the *capture* write-paths only — omitting the most dangerous route, `/api/gate/textbook/approve`, which can advance a human publish gate via a single unauthenticated POST. Today the listener is loopback-only (`serve-local.ps1:107` binds `127.0.0.1`) and Access fronts the tunnel, so practical exposure is contained — but there is no defence-in-depth: one edge misconfig (0.0.0.0 bind, second tunnel, LAN proxy, Windows-service path) fully opens production writes.
- **Fix:** Make the FastAPI origin fail closed for remote requests on a missing `Cf-Access-Authenticated-User-Email` / `Cf-Access-Jwt-Assertion` header, and gate **all five** mutating POSTs (not just the two capture routes) — promote this from "optional, later" to recommended.

### MEDIUM — Control-plane POSTs under-enumerated in the deploy threat model
- **Status:** completeness-critic gap (severity-if-true MEDIUM) · reinforced by RO-8
- **Evidence:** `docs/deploy-tunnel.md:18-25` enumerates only the two capture writes + admin keys as the at-risk surface. But `/api/gate/{pipeline}/{decision}` calls `scheduler.gate → state.set_phase(...,"done",approved_at=...)` (`scheduler.py:219-220`), i.e. it can **approve/reject a human hard gate**; `/api/tick` defaults `dry_run=False` (app.py:125) and runs `catalog.refresh()` + `_run_pending_exports()` (`scheduler.py:170,185`).
- **Gap:** A reader patching the gate per the runbook would whitelist only the two capture routes and leave the approve path open. "Publish gate never automated" is true for *scheduled* automation but false for *a single unauthenticated POST* if the edge gate fails.
- **Fix:** Expand the deploy runbook's threat model to list all five mutating POSTs; fold the gate/tick/refresh routes into the same origin auth requirement.

### MEDIUM — "Exactly two write paths" invariant undercounts the mutating routes
- **Status:** DISPUTED (correctness upheld; impact lens called the severity inflated) · **ID:** RO-1
- **Evidence:** Five POST routes exist (app.py:118, 124, 129, 174, 210), not two. Three mutate **local** state (refresh rebuilds the catalog DB via `catalog.py:119-133`; tick advances pipeline JSON + runs exports; gate persists phase state via `state.py:187`); two write to **external** subsystems.
- **Gap:** The literal "exactly two write paths" is accurate only under the implicit narrowing "two *external/subsystem* write paths." The authoritative carriers actually carry the qualifier — the spec says "the only two new **subsystem** write paths" (`specs/2026-06-21-...-design.md:29`), and `HANDOFF.md:264` separately enumerates "the 3 POST routes control-plane." The one unqualified gloss is `STATUS.html:548`, inside a sentence scoped to "owner-initiated capture."
- **Why DISPUTED:** The impact skeptic argued the authoritative docs are precise and only the STATUS.html changelog drops "subsystem," so a reader is unlikely to over-trust the whole API as read-only. Net: real wording imprecision, low blast radius.
- **Fix:** One-word edit to `STATUS.html:548` — "exactly two **subsystem** write paths" (or "two external capture write paths").

### MEDIUM — DEC-4 attention-ROI gate ratified as binding/pre-E3 but never run; E3 + public deploy shipped ahead of it
- **Status:** CONFIRMED (both lenses upheld) · **ID:** DC-5 (reinforced by DC-8)
- **Evidence:** Gate defined as binding-before-E3 (`specs/2026-06-20-...-design.md:84-88`; `HANDOFF.md:294-303`). E3 actually shipped: commit `73a97b7` is an ancestor of HEAD; `frontend/src/shell/Mobile.tsx` exists. Public deploy shipped to main: `cce285d` + `5db7886`. Gate never run: no attention-ROI artifact anywhere (`Glob **/*attention*`, `**/*roi-gate*` → no files); `HANDOFF.md:315-316` still lists it as pending.
- **Gap:** The docs are scrupulously honest ("consciously DEFERRED by the Chairman... DEC-4 is NOT satisfied... deferred, not voided", `HANDOFF.md:26-29`), but the *lived sequence* contradicts the spirit of "binding": two rounds of exactly the GUI expansion the gate was meant to throttle shipped ahead of it, while the value engine (Phase 3) stays parked — the same GUI-first drift the coherence audit flagged. This is a governance/coherence risk, not a code defect.
- **Fix:** Either run the DEC-4 gauge before any further GUI/deploy investment, or formally re-scope DEC-4 (the override is the Chairman's to make) so the docs stop describing as "binding" a gate the project routinely ships past.

### LOW — confirmed (cosmetic / doc-precision)
- **CAP-9** (CONFIRMED): munshi rejects non-string field values with 400 (app.py:188-189); mcd silently `str()`-coerces them (app.py:213,223). Claim "both routes reject non-string values" is half-true. No injection vector (owner-only, form-encoded). *Fix: coerce-or-reject symmetrically.*
- **CAP-10** (CONFIRMED): spec body lists `detail?` (`specs/...-design.md:186`) but the mcd handler forwards only `type/raw_text/title/source_ref` (app.py:221-225). Dropped optional field no caller supplies. *Fix: drop `detail?` from the spec or wire it through.*
- **QX-5** (CONFIRMED): The SIM0xxx chip leak IS gone, but via the `/api/questions` response facets (`Questions/index.tsx:64` → `facets.ts:52-55`), **not** the `/api/questions/facets` endpoint the docs credit (`STATUS.html:159`). That endpoint is dead relative to the live UI (no caller; only `contracts.ts:123` defines the unused type). *Fix: correct the doc provenance one line.*
- **F4** (CONFIRMED): adapter registry key for the editorial adapter is `mycontentdev` (`mcd.py:22`), not the doc shorthand `mcd`; `get_adapter("mcd")` returns None. All 8 sources present; real callers use the right key (app.py:273). *Fix: use `mycontentdev` in docs.*
- **F6** (CONFIRMED): mcd/munshi client classes expose write methods (`create_item`/`create_seed`) on the same classes the read-only adapters hold; boundary is by-convention, not type-enforced. No current defect. *Fix (optional): read-only client interface for adapters.*
- **PRE-7** (CONFIRMED): `_review_once` does `result.parsed.get("findings")` (`precommit.py:219`) with no `isinstance` guard; a non-dict Codex JSON would `AttributeError`. Mitigated entirely by the two outer try/except→allow wrappers (270-277, 288-294), so it degrades to advisory-allow, never wedges. *Fix: one-line `isinstance` guard for symmetry.*
- **E1-09** (CONFIRMED): Chairman rename present everywhere; Dashboard uses first-name "Deepak" + labels him "CEO" while terminal/org use full "Deepak Bhardwaj / Founder & Chairman." Benign per-surface wording.
- **E3-7** (CONFIRMED): both E3 commits (`73a97b7` + `82edd06`) are ancestors of HEAD; `82edd06` is the review-fix commit touching tests, which is why path-scoped logs on the 3 core files showed only `73a97b7`. (Minor: actual HEAD is `95a6270`, one docs-only commit past the prompt's stated `5db7886`.)
- **DC-6 / DC-7** (CONFIRMED): kill-criterion is manual-by-design (no ROI gauge computed in code — spec forbids it, `specs/2026-06-19-...:50`); SUMMARY.html carries DEC-1..DEC-5 as faithful lay paraphrase, not labeled — both LOW doc-precision nuances.

## 3. Disputed / dismissed (checked and cleared)

- **E2-7 — Sims app "uses no named linchpin": DISMISSED** (both lenses refuted). The finding's central grep ("no lib/ import") is provably false — `Sims/index.tsx:4` imports `{ filterSims, groupByGrade } from "../../lib/sims/deployed"` and uses them at `:17`. Sims *follows* the linchpin discipline; `lib/sims/deployed` is simply an 8th lib module not in the originally-named seven. No deviation.
- **SIM-2 — "grade-grouped" shape: DISPUTED.** Parser returns a flat list with per-row `grade`, not a nested container (`sims_manifest.py:24-42`; `app.py:239`). Correctness lens upheld the imprecision; impact lens noted the authoritative spec already documents the true flat shape + client-side grouping, so the two-word "grade-grouped" gloss misleads no one.
- **RO-1 severity — DISPUTED** (see MEDIUM above): genuine undercount, but the impact lens showed the authoritative docs carry the "subsystem" qualifier, capping real blast radius.

## 4. Claim-verification table

| Dimension | Claim | Verdict |
|---|---|---|
| **Deploy/tunnel** | config.samagra.yml secret-free (UUID + path only) | VERIFIED |
| | Ingress → localhost:8799 + 404 catch-all | VERIFIED |
| | cert.pem / creds JSON / .env / mcd-cloud.json gitignored | VERIFIED |
| | No committed private keys / tokens / real secrets | VERIFIED |
| | serve-local.ps1 idempotent, health-checked, no secret print, no Bypass | VERIFIED |
| | serve-durable.ps1 detached, touches only samagra --config | VERIFIED |
| | install-durable-task.ps1 logon task, no stored password | VERIFIED |
| | **Origin does NOT fail closed; Access sole gate** | **CONTRADICTED (defence-in-depth) — HIGH** |
| | Live URL / 302 gate / 4 QUIC connections | UNVERIFIABLE-FROM-CODE |
| | D-8 stray CNAME cleanup owed | UNVERIFIABLE-FROM-CODE |
| **Capture writes** | whitelists mirror TS; leak-safe; only-write; HIGH+500 fixed | VERIFIED |
| | both routes reject non-string values | PARTIALLY-VERIFIED (mcd coerces) |
| | mcd body has `detail` per spec | PARTIALLY-VERIFIED (dropped) |
| | live e2e round-trip works | UNVERIFIABLE-FROM-CODE |
| **Read-only invariant** | "exactly two write paths" | PARTIALLY-VERIFIED (5 POSTs; 2 external) |
| | two named routes are the only external writes | VERIFIED |
| | useApi GET-only | VERIFIED |
| | captures go through useApiPost only (2 callers) | VERIFIED |
| | frontend never POSTs refresh/tick/gate | VERIFIED |
| | no automated munshi→mcd bridge | VERIFIED |
| | human publish gate never automated | VERIFIED (no scheduled invocation) |
| | control-plane POSTs unauthenticated at origin | PARTIALLY-VERIFIED — MEDIUM |
| | live / gate-302 runtime claims | UNVERIFIABLE-FROM-CODE |
| **Questions/QX** | /api/questions proxies QX with documented contract | VERIFIED |
| | absolutize_assets no SSRF/open-redirect | VERIFIED |
| | QX down → graceful 200, never 500 | VERIFIED |
| | /api/questions/facets question-scoped, drops non-alpha | VERIFIED |
| | facets endpoint feeds the UI chips / kills SIM0xxx | PARTIALLY-VERIFIED (UI uses response facets) |
| | catalog-wide facets no longer feeds chips | VERIFIED |
| | search + toggle + chips + KaTeX (XSS note) | VERIFIED (LOW residual trust) |
| | BGE/67k / live counts | UNVERIFIABLE-FROM-CODE |
| **Sims manifest** | /api/sims parses md → total==482 | VERIFIED |
| | "grade-grouped" shape | PARTIALLY-VERIFIED (flat list, per-row grade) |
| | sim_url raises on bad id | VERIFIED |
| | canonical extensionless URL | VERIFIED |
| | h2/h3 disambiguation, count-strip, em-dash, italics-ignore, subject-reset, over-length drop | VERIFIED (all) |
| | SimsAdapter distinct from manifest parser | VERIFIED |
| **E2 apps** | 11 data apps + GET /api/org (static, no DB) | VERIFIED |
| | org owner mapping / Gemini+NotebookLM one entry | VERIFIED |
| | 7 pure-TS linchpins w/ co-located tests | VERIFIED |
| | data apps thin wrappers | VERIFIED (10/11) |
| | Sims uses a named linchpin | DISMISSED (uses lib/sims/deployed) |
| | @vite-ignore dropped → lazy chunk per app | VERIFIED |
| | 22-chunk / empty-windows symptom | UNVERIFIABLE-FROM-CODE |
| **E1 shell** | frozen 17-app registry | VERIFIED |
| | 3 themes token-driven | VERIFIED |
| | pure-TS headless engines + tests | VERIFIED |
| | 8 shell components | VERIFIED |
| | draggable/resizable windows | VERIFIED |
| | right-click menus for ALL 3 themes (desktop/window/dock-icon) | PARTIALLY-VERIFIED (console dock-icon gap) — MEDIUM |
| | context-menu surface theme-token-driven | VERIFIED |
| | SVG icon system, no letter badges | VERIFIED |
| | Chairman rename across surfaces | VERIFIED (LOW first-name/CEO nit) |
| **E3 mobile** | mobileApp + openMobileApp/goHome; setDevice resets | VERIFIED |
| | Mobile.tsx phone frame dims/grid/dock/home | VERIFIED |
| | App.tsx branches on device, keeps vars | VERIFIED |
| | WM tracks active theme (not always aqua) | VERIFIED |
| | responsive Dashboard auto-fit minmax | VERIFIED |
| | Terminal open device-aware | VERIFIED |
| | E3 commits landed, tree clean | PARTIALLY-VERIFIED (both commits are ancestors; HEAD 95a6270) |
| **Governance/hook** | governance.db separate durable DB | VERIFIED |
| | tables + schema_version + migration + backup | VERIFIED |
| | /api/assignments reads governance.db | VERIFIED |
| | hook blocks only on 2-pass confirmed-CRITICAL | VERIFIED |
| | diff-hash cache deterministic, skips Codex | VERIFIED |
| | audited sanitized break-glass | VERIFIED |
| | never silently downgrades confirmed-CRITICAL | VERIFIED |
| | never wedges on infra failure | VERIFIED |
| | committed shim via core.hooksPath | VERIFIED |
| | malformed Codex output can't wedge | PARTIALLY-VERIFIED (guarded only by outer wrappers) |
| | confirm pass over same diff | VERIFIED |
| **Spine** | unified samagra.db FTS5 catalog | VERIFIED |
| | refresh() last-known-good safe | VERIFIED |
| | callers survive failed adapter (None not summed) | VERIFIED |
| | get_adapter covers 8 sources | PARTIALLY-VERIFIED (key is `mycontentdev` not `mcd`) |
| | adapters never WRITE (read path) | VERIFIED |
| | client classes expose write methods | PARTIALLY-VERIFIED (by-convention boundary) |
| | serve seam mounts dist/assets if present | VERIFIED |
| | SPA catch-all last, 404 api/, 503 unbuilt | VERIFIED |
| | /open traversal/symlink/prefix-safe | VERIFIED |
| | 7,044 artifacts historically | UNVERIFIABLE-FROM-CODE |
| **Direction/vision** | 2026-06-19 spec retired "OS" | VERIFIED |
| | attention-ROI north-star + kill-criterion bound | VERIFIED |
| | DEC-1 bounded console honored in code | VERIFIED |
| | DEC-3 scope firewall holds (1 game, no marketplace) | VERIFIED |
| | DEC-4 gate binding/pre-E3, "deferred not voided" | PARTIALLY-VERIFIED (shipped E3+deploy ahead) — MEDIUM |
| | kill-criterion measurable from code | PARTIALLY-VERIFIED (manual by design) |
| | DEC-1..DEC-5 across all carriers incl SUMMARY.html | PARTIALLY-VERIFIED (SUMMARY = paraphrase) |
| | 17-app GUI didn't re-introduce OS scope | PARTIALLY-VERIFIED (partially re-introduced, then bounded) — MEDIUM |

## 5. Coverage gaps (from the completeness critic)

The ten audited dimensions skipped several first-class surfaces named in CLAUDE.md "Layout" / HANDOFF. The critic verified them in code (no CONTRADICTED claim, no correctness/security defect) but flagged these residual gaps:

1. **Lecture exporter untested (LOW).** `tests/test_lectures.py` covers only `render_chapter_html` + `build_thin`. The Pandoc DOCX subprocess (`export.py:26-37`) and Google Docs upload (`gdocs.py:30-61`) have **zero** test coverage, yet the scheduler drives `lex.run()` on the approved-textbook path. "TDD throughout" is accurate for GUI/capture/governance but not for this documented first-class feature; the "130 eqns verified" figure is a one-off manual observation, not a regression assertion.
2. **Notifications untested (LOW).** Only coverage mocks `notify.notify` out entirely (`test_scheduler.py:85`); the live `_telegram` (`notify.py:30-44`) and `_email` (`:47-67`) channels are unverified — a wiring regression would pass the suite. Stale comment: docstring says "via Hermes bot" but it posts directly to the Telegram Bot API.
3. **`samagra serve --reload` contradicts a hard gotcha (LOW).** `__main__.py:142-143` registers `--reload` → `uvicorn.run(reload=...)`, but HANDOFF Gotchas explicitly forbid `uvicorn --reload` (the D-1 orphaned-worker-held-:8799 incident). Guardrail is prose-only; no code guard.
4. **Tracker count staleness (LOW).** HANDOFF carries 4+ different backend counts (102/106/134/142/152) and 7+ frontend counts (439…546) across layered banners; the lead banner's 152/541 is stale vs the current 154/546. Plus the 7,044-artifact figure is a runtime fact never asserted in code.
5. **Control-plane POSTs under-enumerated in deploy threat model (MEDIUM).** Promoted to a confirmed MEDIUM above.
6. **Divergent math stacks (LOW).** Lecture preview hard-codes a MathJax 3 jsDelivr CDN (`render.py:48-49`); Questions uses KaTeX. Consistent but undocumented; the public `/lecture/{slug}` GET route (app.py:55-61) silently loses math offline / behind a strict CSP now that the app is tunnelled.
7. **questiondb stub reports healthy (LOW).** `questiondb.py:19` returns `available()=True` unconditionally while yielding 0 artifacts and a static "offline (HF Space private)" summary — surfaced as an "OK" source in `overview()`/`samagra status`/Dashboard. A hardcoded "live" status; harmless today but an operator-console honesty gap.
8. **Scheduled-task naming collision (LOW).** `SAMAGRA-tick` (the explicitly-retired enrichment tick, installable via `samagra schedule-install`) vs the new logon task `SAMAGRA-OS` (durable serve). Two similarly named tasks invite accidental removal of the wrong one or re-introduction of the retired tick. Not a defect; an operator footgun.
