VERDICT: **GO-WITH-CAVEATS**

**Prior Findings**

1. **H3 re-scan duplicate: RESOLVED.** `_existing_assignment_for` is now status-blind: it returns the first assignment whose `seed_ref` matches, with no status predicate (`samagra/bridge/run.py:46-58`). `scan(dry=False)` checks that before minting a new id and continues with `reused=True` instead of writing a new `in-review` row (`samagra/bridge/run.py:89-96`). This covers `captured` and `changes`. Caveat: it also suppresses any future foreign row with the same `seed_ref`, but current bridge-created rows are `pipeline="mycontentdev", seed_ref=art.uid` (`samagra/bridge/run.py:107-113`), so I do not treat that as a blocker.

2. **H1 crash-window double-write: RESOLVED.** Normal first submit does not false-trip because `_submit_in_flight` only sees prior events and runs before the new intent is appended (`samagra/bridge/run.py:181-189`, `samagra/bridge/run.py:207-216`). The order is correct: status guard, already-captured guard, in-flight guard, payload load, validation, then `seed_submitting` before `create_seed` (`samagra/bridge/run.py:203-237`). A crash after create but before `seed_created` leaves `seed_submitting` without `seed_created`, so retry refuses before a second `create_seed`. A crash before create also safe-fails/refuses, which is conservative but intentional.

3. **H2 concurrent submit: RESOLVED AS ACCEPTED LOW.** The true two-process race still exists if two manual CLIs pass the guards before either commits `seed_submitting`. Under the actual deployment, I agree with accepting it as Low: bridge submit is exposed only by CLI (`samagra/__main__.py:205-214`), there is no bridge API endpoint in FastAPI, and the Phase 3 scope explicitly excludes GUI approve/submit buttons and autonomous scanning (`docs/superpowers/specs/2026-06-22-phase3-active-loop-design.md:40-44`). Add an atomic claim/upstream idempotency if this becomes GUI/scheduled.

4. **M1 route validation bypass: RESOLVED.** `validate_seed_payload` rejects bad `type` and non-string/blank/whitespace `raw_text` (`samagra/bridge/seed_payload.py:20-33`). `submit` calls it before `seed_submitting` and before `create_seed` (`samagra/bridge/run.py:217-237`), so validation failure does not write and does not wedge the assignment with an intent event.

5. **M2 munshi read crash: RESOLVED.** `adapter.artifacts()` is materialized inside a `try`, exceptions become `arts=[]`, and `conn.close()` remains in `finally` (`samagra/bridge/run.py:69-76`, `samagra/bridge/run.py:124-126`). Because the full list is built before the write loop, a mid-stream munshi read failure leaves no half-written assignments.

6. **Low classify substring / outbox id: RESOLVED.** `_PHYSICS_RE` now uses a left word boundary (`samagra/bridge/classify.py:25-28`), so `paperwork`/`network` no longer match `work`; suffix recall remains for `working`, `electrical`, and `gravitational` because there is no right boundary and the terms include `electric`/`gravitation` (`samagra/bridge/classify.py:14-18`). Full `assignment_id` slug validation is enforced before path/body interpolation (`samagra/bridge/outbox.py:19-30`).

**New Findings**

- **LOW:** `git diff --check main...HEAD` fails on whitespace: `docs/codex-reviews/22-phase3-premerge.report.md:39: new blank line at EOF.` No runtime impact, but it can trip a whitespace gate.
- **LOW/NIT:** `samagra/bridge/run.py:6-7` still says re-scanning skips only “non-terminal” assignments, but the code is now intentionally status-blind. The comment should be corrected, but the implementation is right.

**Safety Invariants**

Confirmed for merge: no new web endpoint; bridge uses the existing `McdClient.create_seed` MCD write (`samagra/clients/mcd_client.py:58-69`); bridge submit is approval-gated (`samagra/bridge/run.py:203-216`); same-assignment retry is idempotent or safe-fail; no automated publish path was added; bridge outbox/events contain payload/pointers, not credentials (`samagra/bridge/outbox.py:37-57`, `samagra/bridge/run.py:115-120`). I did not run pytest because this was a read-only review; verification here is from direct code tracing and read-only git/search commands. Mergeable after the whitespace/doc nits if your gate cares about them.
