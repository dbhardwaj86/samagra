# Codex Review 24 — Content Factory Phase 1 (dispatch spine) — Pre-merge

**Branch:** `feature/content-factory-phase1`
**Range:** `bb88bd8..69cfd51`
**Scope:** the new `samagra/factory/` package (`lines.py`, `dispatch.py`, `run.py`) + CLI wiring in `samagra/__main__.py`, with the `build()` write boundary (the DEC-7 surface) as the primary focus.
**Reviewer:** Codex (codex-cli 0.140.0, high reasoning effort), independent of the in-loop opus adversarial review.

## Verdict: NO-GO (remediate + re-review)

The five `build()` guards are correctly ordered and implemented, connection handling uses `finally` throughout, dedup is status-blind, and intent events are recorded before production. **One HIGH invariant violation blocks merge.**

## Findings

### H1 (HIGH) — factory build can write to Google Docs — `samagra/factory/dispatch.py:36`
`build()` → `run_line` → `lectures.export.export_one()` calls `gdocs.upload()` after DOCX generation. With Google OAuth creds configured + `pandoc` present, a factory build creates a Google Drive/Docs file — an **external subsystem write** that violates the Phase-1 invariant (factory writes ONLY local artifacts + `governance.db`). Strictly, this is a new prod write path the phase forbids.
**Disposition: FIX.** Add `upload_gdocs: bool = True` to `export_one`; gate the `gdocs.upload` call on it; have factory `run_line` pass `upload_gdocs=False`. Add a test that fails if `gdocs.upload` is invoked during `factory.build()`.

### M1 (MEDIUM) — factory plan writes bridge/mcd outbox instructions — `samagra/factory/run.py:51`
`plan(dry=False)` reuses the bridge outbox helper, whose body tells the operator to run `samagra bridge approve <id>` / `samagra bridge submit <id>` — the wrong workflow for a factory assignment. (Note: `bridge submit` on a factory assignment actually fails-safe — no valid bridge payload → `ValueError` before any prod write — but `bridge approve` would wrongly mutate a factory assignment's status, and the misleading instructions are a real footgun.)
**Disposition: FIX.** Add a factory-specific outbox writer emitting correct `samagra factory approve-seed`/`build` commands; add explicit workflow-firewall pipeline guards to both workflows' approve/build entry points (factory refuses non-factory-lane pipelines; bridge refuses non-`mycontentdev`).

### L1 (LOW) — event guards scan newest 10 000 events — `samagra/factory/run.py:112,120`
`_has_event`/`_build_in_flight` use `list_events(limit=10000)`. Effectively unbounded for a single-operator ledger (matches the merged bridge pattern), but an assignment-scoped SQL query is more correct.
**Disposition: FIX (cheap).** Add `store.list_events_for_assignment(conn, id)` (unbounded, scoped) and use it in both helpers.

### L2 (LOW) — seed_ref normalized for classify but stored raw — `samagra/factory/lines.py:32` / `run.py`
`classify` strips whitespace, but `plan` stores the raw `seed_ref`; a leading-space ref classifies/plans yet fails `validate_seed_for_line` at build time.
**Disposition: FIX (cheap).** Normalize (`strip`) `seed_ref` once at `plan` entry.

### I1 (INFO) — double-build test proves guard 1, not guard 2 independently — `tests/test_factory_run.py`
After a successful build the status is `captured`, so a retry hits guard 1 first; guard 2 (`product_created` event) is never exercised alone.
**Disposition: ADD TEST.** Inject a `product_created` event on an `approved` assignment and assert `build()` refuses (guard 2 in isolation).

## Notes
- The independent Codex pass caught H1, which the in-loop opus adversarial review missed (it traced "no McdClient/HTTP" but did not follow into `export_one`'s gdoc branch) — vindicating the two-reviewer defense-in-depth (cf. the project's bridge review-22 learning that one reviewer can miss a class an independent lens catches).
- All findings remediated TDD; re-review tracked as review 25.
