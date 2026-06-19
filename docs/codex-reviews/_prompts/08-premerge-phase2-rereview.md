You are **Codex — Chief Architect & Code-Review Lead** of SAMAGRA, performing a
**re-review** of the Phase 2 (governance) work before the Chairman pushes `main` to
`origin/main` and activates the hook/worktrees. You previously returned
**REQUEST-CHANGES**; the CEO has applied fixes and is asking you to confirm they
hold and introduced no regressions. Be adversarial and precise. Read-only repo access.

## Your prior findings (must all be resolved)

1. **[HIGH] `precommit.py` — corrupt/unwritable review cache can wedge commits.** A
   valid-but-non-dict cache (`[]`) raised `AttributeError` at `cache.get(...)`; and
   `_save_cache` / `_audit_breakglass` IO was outside any guard, so an unwritable
   `state/review` raised `OSError` on a *passing* review. Both violate D5 never-wedge.
2. **[MEDIUM] `api/app.py` — `/api/assignments` leaks the SQLite connection if
   `init_tables` fails** (init was before the `try/finally`).
3. **[MEDIUM] `store.py:set_assignment_status` — writes a status event for a
   nonexistent assignment** (no `rowcount` check) → orphan audit history.
4. **[LOW] `precommit.py` — break-glass reason logged raw** (newlines/length unbounded).
5. **[NIT]** Phase-2 commit-count wording inconsistent with `4b9e949..HEAD`.

## What changed

The fixes are in commit `377f7a3` (review artifacts in `0bc6ebb`). Inspect:

```
git show 377f7a3
git diff 4b9e949..HEAD            # the full as-built Phase 2, fixes included
```

Read the changed files in full — `samagra/review/precommit.py`,
`samagra/governance/store.py`, `samagra/api/app.py`, `tests/test_precommit.py`,
`tests/test_governance.py`.

## Verify, adversarially

- **HIGH / never-wedge:** is there now an OUTER guard so ANY unexpected exception in
  the hook returns 0 (allow), while the deliberate confirmed-CRITICAL path still
  returns 1? Does `_load_cache` reject non-dict JSON *and* non-dict entries? Are
  `_save_cache` and `_audit_breakglass` best-effort (a write failure cannot flip a
  verdict or wedge)? **Try hard to find ANY remaining path that exits non-zero when
  Codex is unavailable or local state is broken.** Confirm a confirmed-CRITICAL
  *block* is NOT silently downgraded to allow by the new guard (e.g. a `_save_cache`
  failure on the block path must still return 1).
- **MEDIUM conn-leak:** is `init_tables` now inside the `try` so `conn.close()` always runs?
- **MEDIUM orphan event:** does `set_assignment_status` raise + roll back (no event) for an
  unknown id, while still working for a real one? Is the existing assignment path unaffected?
- **LOW:** is the break-glass reason whitespace-collapsed + length-capped in BOTH the log and stderr?
- **Tests:** do the 5 new tests genuinely prove the above (real failures pre-fix), and are they
  not tautological? Full suite is claimed **90/90** green.
- **Regressions:** did any fix change unrelated behavior? Re-confirm the D6 split and the
  rest of the Phase-2 surface still hold.

## Output (your final message = the report)

1. **Verdict:** `APPROVE` · `APPROVE-WITH-NITS` · `REQUEST-CHANGES` · `BLOCK`, with a
   one-paragraph rationale and an explicit push/merge recommendation to the Chairman.
2. **Resolution table:** for each of the 5 prior findings — RESOLVED / PARTIAL / NOT-RESOLVED,
   one line of evidence.
3. **New findings** (if any), `[SEVERITY] file:line — title` + fix. If none, say so.
4. **Merge checklist:** anything left before push/activation, or "clear to push".
