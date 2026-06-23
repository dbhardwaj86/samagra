# Codex Review 25 — Content Factory Phase 1 — Re-review (post review-24 remediation)

**Branch:** `feature/content-factory-phase1`
**HEAD reviewed:** `91baeeb` (the review-24 remediation)
**Range:** `69cfd51..91baeeb` over the full `samagra/factory/` tree
**Reviewer:** Codex (codex-cli 0.140.0, high effort), independent of the in-loop reviews.

## Verdict: GO-WITH-CAVEATS — the single caveat was then closed (→ effectively GO)

All five review-24 findings **RESOLVED**; regressions clean; the Phase-1 local-only invariant holds end-to-end.

| Review-24 finding | Status | Evidence |
|---|---|---|
| H1 (HIGH) — factory build could upload to Google Docs | RESOLVED | `dispatch.run_line` passes `upload_gdocs=False`; `export.export_one` gates `gdocs.upload` on that flag; default lecture-engine callers still upload (backward compatible) |
| M1 (MED) — outbox emitted bridge cmds; no cross-workflow guard | RESOLVED | `factory/outbox.py` emits only `samagra factory …`; pipeline guards on `factory.approve`/`factory.build` + `bridge.approve`/`bridge.submit`; positive + negative tests |
| L1 (LOW) — newest-10000 event scan | RESOLVED | `store.list_events_for_assignment` (assignment-scoped, unbounded) backs both build guards |
| L2 (LOW) — raw seed_ref stored | RESOLVED | `plan()` strips `seed_ref` at entry; classify/store/validate agree; padded-input regression test |
| I1 (INFO) — guard-2 not isolated | RESOLVED | test injects `product_created` on an approved assignment and asserts `build()` refuses |

## New finding raised by review 25 — and its resolution

**LOW — `factory.approve_seed()` missing the pipeline firewall** (`samagra/factory/run.py::approve_seed`).
`approve_seed` flipped every in-review assignment matching the `seed_ref` regardless of pipeline — unlike `approve()`/`build()`, which now refuse non-factory lanes. A bridge (`mycontentdev`) assignment sharing a `seed_ref` could be flipped by `samagra factory approve-seed`.

**RESOLVED in this session** (commit follows the re-review): `approve_seed` now filters `pipeline in LINES`. Negative test `test_approve_seed_skips_non_factory_pipeline_with_same_seed_ref` confirms a same-`seed_ref` bridge assignment is left `in-review`. The four-entry-point workflow firewall (factory approve / approve-seed / build; bridge approve / submit) is now complete and consistent.

## Regression checks (all clean)
- Bridge legitimate `mycontentdev` path still works after the added guards: **YES**
- Five `build()` guards still correctly ordered and intact: **YES**
- Phase-1 invariant (factory writes only local artifacts + governance ledger; no external/subsystem write): **HOLDS**
- Threat model: single human operator, manual CLI (TOCTOU rated Low, not a blocker).

## Net arc
review-24 **NO-GO** → all 5 findings remediated TDD → review-25 **GO-WITH-CAVEATS** → the one new Low closed TDD → **effectively GO**. Gate: full suite **303 passed** (1 pre-existing `test_gdocs` env failure, factory-independent, proven by isolation).
