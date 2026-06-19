**Verdict: REQUEST-CHANGES**

The targeted fixes mostly hold, but the D5 hook still has a confirmed-CRITICAL downgrade path: an oversized but malformed dict-shaped cache can make `_save_cache()` raise during pruning before its `OSError` guard, and the outer never-wedge guard then returns `0`. Chairman should not push `main` or activate hooks/worktrees until this is fixed and covered by a regression test.

**Resolution Table**

- HIGH precommit never-wedge/cache: **PARTIAL**. Non-dict cache, non-dict entries, Codex-down, audit-write, and normal cache-write failure paths are handled, but `[precommit.py](C:/SandBox/claude_box/TeachingOS/samagra/review/precommit.py:114)` can still downgrade a confirmed-CRITICAL block to allow.
- MEDIUM `/api/assignments` conn leak: **RESOLVED**. `init_tables()` is inside `try`, and `finally` closes the connection at `[api/app.py](C:/SandBox/claude_box/TeachingOS/samagra/api/app.py:101)`.
- MEDIUM orphan assignment event: **RESOLVED**. `rowcount != 1` rolls back and raises before `append_event()` at `[store.py](C:/SandBox/claude_box/TeachingOS/samagra/governance/store.py:117)`.
- LOW break-glass raw reason: **RESOLVED** in code. `_sanitize_reason()` is used for both log and stderr at `[precommit.py](C:/SandBox/claude_box/TeachingOS/samagra/review/precommit.py:128)` and `[precommit.py](C:/SandBox/claude_box/TeachingOS/samagra/review/precommit.py:195)`.
- NIT commit-count wording: **RESOLVED**. `HANDOFF.md` / `STATUS.html` now use range `4b9e949..HEAD` instead of a brittle count.

**New Findings**

- [HIGH] [samagra/review/precommit.py](C:/SandBox/claude_box/TeachingOS/samagra/review/precommit.py:114) - `_save_cache` prune exception can downgrade confirmed CRITICAL to allow.  
  Evidence: with 257 dict cache entries and mixed JSON-valid `ts` types (`"2026"` and `[]`), a two-pass confirmed CRITICAL returned `0` via the outer guard: `TypeError("'<' not supported between instances of 'list' and 'str'")`.  
  Fix: make `_save_cache()` fully best-effort, including pruning and JSON serialization, or normalize the sort key with `str(...)` and catch broad exceptions inside `_save_cache()`. Add a regression asserting confirmed CRITICAL still returns `1` when `_save_cache` raises a non-`OSError`.

- [LOW] Status docs still claim `85/85` after five tests were added.  
  Static test count is now 90, but `STATUS.html`, `HANDOFF.md`, `SUMMARY.html`, and the plan still say 85/85. Update the canonical status artifacts after the next real suite run.

**Merge Checklist**

- Fix `_save_cache()` so no cache-shape/prune/serialization failure can escape or flip the confirmed-CRITICAL return.
- Add regression for confirmed-CRITICAL + `_save_cache` non-IO failure returning `1`.
- Rerun full suite in a writable environment. I could not run pytest here: the read-only sandbox has no usable temp directory, so pytest fails before collection.
- Update status artifacts from 85/85 to the verified 90/90 result.
- Then re-run this re-review; not clear to push yet.