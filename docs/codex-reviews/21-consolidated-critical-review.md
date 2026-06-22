# SAMAGRA — consolidated critical review (multi-agent + Codex), 2026-06-22

Two independent adversarial reviews of the **whole codebase vs. every feature/detail claimed in the
implementation & vision docs**, cross-checked against each other:

1. **Multi-agent workflow** — 11 feature dimensions × (auditor → 2 refute-by-default skeptics) →
   completeness critic → synthesis. 51 agents, read-only. Full report:
   [`20-multiagent-doc-claim-audit.report.md`](20-multiagent-doc-claim-audit.report.md).
2. **Codex `gpt-5.5`** — independent static read-only pass. Full report:
   [`19-overall-critical-analysis.report.md`](19-overall-critical-analysis.report.md).

**Ground truth (run this session):** HEAD `95a6270` == `main` == `origin/main`; backend **154 pytest**
+ frontend **546 vitest / 62 files**, both green. Only `CLAUDE.md` (mod) + `AGENTS.md` (untracked) are uncommitted.

## Convergent verdict

**The docs are honest. The code does what it claims.** Both reviewers independently reached
**GO-WITH-CAVEATS / GO-WITH-FIXES on doc-honesty**: every load-bearing capability claim (capture
write-paths, QX proxy, sims parser=482, governance hook never-wedge, the spine, the 17-app GUI,
DEC-1..DEC-5) is VERIFIED in code, and the docs openly admit their own weakest points rather than
hiding them. The caveats are about **security posture** and **wording precision**, not invented features.

## Findings BOTH reviews independently confirmed (highest confidence)

| Severity | Finding | Evidence |
|---|---|---|
| **HIGH** | **Origin does not fail closed — Cloudflare Access is the sole gate over 5 unauthenticated mutating POSTs.** No `add_middleware`/`Cf-Access-*` check anywhere. The origin holds prod creds server-side, so any caller reaching `:8799` directly needs no credential. Today contained (loopback bind + Access on the tunnel) but zero defence-in-depth — one edge misconfig opens production writes incl. `/api/gate/textbook/approve`. | `samagra/api/app.py` (118,124,129,174,210); `munshi_client.py`/`mcd_client.py`; `deploy/cloudflared/config.samagra.yml:25` |
| **HIGH→MED** | **"Exactly two write paths" undercounts the mutating routes** — there are 5 POSTs (refresh/tick/gate + 2 capture). Codex rated HIGH; the workflow downgraded to **MEDIUM/DISPUTED** after finding the *authoritative* docs already carry the qualifier ("two **subsystem** write paths", spec:29; "3 POST routes control-plane", HANDOFF:264) — only `STATUS.html:548` + `CLAUDE.md` drop "subsystem." So: real wording imprecision, low blast radius. | `app.py:118-130,174,210` |
| **MED** | **DEC-4 attention-ROI gate was ratified "binding / before E3" but never run** — E3 *and* the public deploy shipped ahead of it; no ROI artifact exists; Phase 3 (the value engine) stays parked. Docs are scrupulously honest ("deferred, not voided") but the lived sequence is the exact GUI-first drift the coherence audit flagged. Governance/coherence risk, not a code defect. | `specs/2026-06-20:84-88`; `HANDOFF.md:26-29,315-316` |
| **MED** | **The non-alpha subject filter / SIM0xxx fix is on a *dead* endpoint.** `GET /api/questions/facets` has the guard, but the live Questions UI reads facets from the `/api/questions` payload (`Questions/index.tsx:64` → `facets.ts:52`). The SIM0xxx leak *is* structurally gone (UI no longer touches catalog-wide `/api/facets`), but the docs credit the wrong mechanism, and the proxied facets the UI shows are **unfiltered**. | `app.py:242-252` vs `Questions/index.tsx:64`, `lib/questions/facets.ts:52` |
| **LOW** | **Spec lists a `detail?` seed field that both server and TS silently drop.** | `specs/2026-06-21:186`; `seed.ts:13`; `app.py:221-225` |
| **VERIFIED clean (both)** | `useApi` GET-only; capture whitelists mirror the TS contract; **no secret/upstream leak** on capture failure (test-covered); **no munshi→mcd bridge**; QX-down is graceful (never 500); `governance.db` separate from the catalog; `sim_url()` rejects bad ids; **482 sims** (Codex counted the file); serve-seam + `/open` traversal-safe. | — |

## Codex-unique findings (worth folding in)

- **MEDIUM — QX HTML rendered via `dangerouslySetInnerHTML`** (`Questions/index.tsx:176`): XSS surface if a
  QX payload is malicious. *(The workflow saw this too but rated it LOW "residual trust" — a real severity divergence.)*
- **MEDIUM — QX base URL is config-driven SSRF / open asset-host:** a poisoned `SAMAGRA_QX_SERVER_URL` makes the
  backend fetch + the frontend asset URLs point anywhere. *(Divergence: the workflow judged `absolutize_assets`
  itself SSRF-safe — both are right: the rewrite fn is safe, the trust hinges on the config + the unsanitized HTML.)*
  *Fix: validate the QX URL as loopback/allowlist.* `qx_client.py:23`; `questions_proxy.py:17`
- **MEDIUM — GET routes are not side-effect-free:** `catalog.connect()` runs schema DDL and `/api/assignments`
  calls `init_tables` on every read. *Fix: migrate at startup, open read-only for reads.* `catalog.py:29`; `app.py:105`
- **MEDIUM — "no publish automation" is too broad:** no MCD bridge, but `tick()` runs lecture exports and can
  upload to Google Docs after a gate is marked done. `scheduler.py:109-143`; `gdocs.py:30`
- **MEDIUM — `/open` broad file disclosure:** traversal is blocked, but *any* file under the (broad) source roots
  is servable by path. *Fix: open by catalog artifact id; restrict extensions; deny hidden/secret patterns.*
- **LOW — `.gitignore` misses `deploy/cloudflared/*.json`:** a tunnel-cred JSON copied beside the committed config
  would NOT be ignored. *Fix: add `**/cloudflared/*.json`.*

## Workflow-unique findings (completeness gaps Codex didn't surface)

- **MEDIUM — right-click context menu has a console-theme dock-icon gap** (E1 claim "menus for all 3 themes ×
  desktop/window/dock-icon" is PARTIALLY-VERIFIED).
- **LOW — lecture exporter is untested** despite "TDD throughout": the Pandoc DOCX subprocess (`export.py:26`) +
  Google Docs upload (`gdocs.py:30`) have **zero** test coverage, yet the scheduler drives them. "130 eqns verified"
  is a one-off manual note, not a regression guard.
- **LOW — notifications untested:** the only test mocks `notify.notify` out; live `_telegram`/`_email` are unverified.
  Stale docstring says "via Hermes bot" but it posts directly to the Telegram Bot API.
- **LOW — `samagra serve --reload` contradicts a hard gotcha** (the D-1 orphaned-worker incident); the guardrail is
  prose-only, still reachable from the CLI (`__main__.py:142`).
- **LOW — `questiondb` adapter is a permanent `available()=True` stub** yielding 0 artifacts → surfaced as an "OK"
  source in the operator console. Hardcoded-healthy honesty gap. `questiondb.py:19`
- **LOW — Scheduled-task naming collision:** `SAMAGRA-tick` (the explicitly-retired enrichment tick) vs the new
  `SAMAGRA-OS` logon task — operator footgun (clean up / re-enable the wrong one).
- **LOW — tracker count staleness:** HANDOFF's lead banner says 152/541; current is **154/546**. The file carries
  4+ backend and 7+ frontend counts across layered banners — hard to trust at a glance.
- **LOW — divergent math stacks:** lecture preview hard-codes a MathJax 3 CDN (`render.py:48`) while Questions uses
  KaTeX; the public `/lecture/{slug}` GET loses math offline / behind a strict CSP now that it's tunnelled.
- **mcd vs munshi asymmetry:** munshi rejects non-string fields (400); mcd silently `str()`-coerces. (CAP-9)
- **`get_adapter("mcd")` returns None** — the registry key is `mycontentdev` (docs use the `mcd` shorthand). (F4)

## Prioritized fix list

1. **(HIGH) Make the origin fail closed.** Add FastAPI middleware validating `Cf-Access-Authenticated-User-Email`
   / `Cf-Access-Jwt-Assertion` for remote requests, gating **all five** mutating POSTs (+ admin-keyed reads), with
   an explicit loopback/dev bypass. Promote from the runbook's "optional, later" to done.
2. **(MED) Expand the deploy threat model** to enumerate all five POSTs (esp. `/api/gate/*` = human-gate approve).
3. **(MED) Sanitize QX HTML** (or emit a safe subset) and **validate `SAMAGRA_QX_SERVER_URL`** as loopback/allowlist.
4. **(MED) Move schema DDL/migration to startup**, open SQLite read-only on GET paths.
5. **(LOW, fast) Doc fixes:** STATUS.html/CLAUDE.md → "two **subsystem** write paths"; correct the `/api/questions/facets`
   provenance; drop or wire `detail?`; refresh the stale 152/541 → 154/546; use `mycontentdev` not `mcd`.
6. **(LOW) Test debt:** add coverage for the lecture exporter (Pandoc/GDocs) and notification channels.
7. **(GOVERNANCE) Run the DEC-4 attention-ROI gate** before further GUI/deploy investment, or formally re-scope it.

## Where the two reviews diverged (and the reconciliation)
- **QX `dangerouslySetInnerHTML`:** Codex MEDIUM, workflow LOW → treat as **MEDIUM** (it's a tunnelled prod surface).
- **QX SSRF:** Codex flagged the config trust; workflow cleared the rewrite fn → **both correct**, fix = validate the config.
- **"Two write paths":** Codex HIGH, workflow MEDIUM/DISPUTED → **MEDIUM** (authoritative docs are precise; only the changelog/CLAUDE gloss drops "subsystem").
