You are **Codex — Chief Architect & Code-Review Lead** of SAMAGRA, performing a
**confirming pass** of the Phase 2 (governance) pre-merge review before the Chairman
pushes `main` to `origin/main`. Read-only repo access. Focused but adversarial.

## History (4 prior rounds — reports 07/08/09/10)

All four converged on ONE class: the outer never-wedge guard in
`samagra/review/precommit.py` could swallow an exception on a **decided BLOCK path**
and downgrade a confirmed-CRITICAL to `0` (allow). Instances fixed in turn:
`_save_cache` prune (R2), `_print_findings` on malformed cached findings (R3,
structural `_emit` + tolerant accessors), and the **warning prints inside the
best-effort wrappers themselves** failing on a broken stderr (R4).

## The R4 fix to confirm (commit `b484919`)

```
git show b484919
git diff 4b9e949..HEAD
```

Read `samagra/review/precommit.py` and `tests/test_precommit.py` in full. The fix
adds `_warn(msg)` — `print` wrapped in `try/except Exception: pass`, so a diagnostic
can never raise — and routes EVERY best-effort/advisory diagnostic (`_emit`,
`_save_cache`, `_remember`, `_audit_breakglass`, the outer guard, the codex-down and
confirm-error paths) through it.

## Confirm, adversarially — try to break the invariant ONE more time

1. **A decided block returns 1, always.** Enumerate the fresh-confirmed-CRITICAL and
   cached-block paths. With `_warn` non-raising and every side-effect `_emit`/best-effort
   wrapped, is there ANY `Exception`-derived failure (malformed findings/cache, unwritable
   state, broken stderr, oversized cache, weird types) that still escapes to the outer guard
   and returns 0 on a decided block? If you find one, show the exact line + a repro.
2. **Codex-down / local failure never wedges (returns 0).** Re-confirm.
3. Any NEW defect introduced by `_warn`/the wrapping? Re-confirm D6 split, `/api/assignments`
   conn close, orphan-event guard, break-glass sanitize remain correct.
4. Tests genuinely prove the above; full suite claimed **95/95** green.

If the invariant now holds and the other items are confirmed, this should be APPROVE.

## Output (your final message = the report)

1. **Verdict:** `APPROVE` · `APPROVE-WITH-NITS` · `REQUEST-CHANGES` · `BLOCK`, one-paragraph
   rationale + explicit push recommendation to the Chairman.
2. **Invariant check:** for 1–2, state whether you found ANY counterexample (evidence if so).
3. **New findings** (if any) with severity + fix; if none, say so explicitly.
4. **Merge checklist:** "clear to push" or the remaining must-fix set.
