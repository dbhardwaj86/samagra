**Verdict: REQUEST-CHANGES**

Do not push `main` or activate hooks/worktrees yet. Commit `1691e03` fixes the round-2 `_save_cache` downgrade for a fresh two-pass confirmed CRITICAL, but I found a remaining HIGH in the cached-block path: a malformed cache entry for the current diff with `verdict: "block"` and bad `findings` can still raise during printing and get swallowed by the outer guard, returning `0`.

**Confirmation**

- Round-2 HIGH: **RESOLVED for fresh confirmed blocks**. `_save_cache()` wraps prune/sort/JSON/write in `except Exception`, and `_remember()` catches `_save_cache` failure; my probe with `_save_cache` raising returned `1`.
- Round-1 HIGH cache/IO wedge: **RESOLVED for allow-path wedge cases**. `_load_cache()` rejects non-dict/wrong-shape cache entries; `_save_cache()` is best-effort.
- `/api/assignments` connection leak: **RESOLVED**. `init_tables()` is inside `try`, with `conn.close()` in `finally`.
- Orphan ledger event: **RESOLVED**. `set_assignment_status()` checks `rowcount`, rolls back, and raises before appending an event.
- Break-glass sanitization: **RESOLVED**. Reason is whitespace-collapsed and capped before log/stderr use.
- D6 split: **HOLDS**. `config.GOVERNANCE_DB` is separate from `DATA_DB`; `store.connect()` targets `GOVERNANCE_DB`.

**New Findings**

`[HIGH] samagra/review/precommit.py:219` cached confirmed block can downgrade to allow if cached `findings` is malformed.

Evidence: with `_load_cache()` returning `{current_hash: {"verdict": "block", "findings": ["not-a-dict"], "ts": []}}`, `review_staged_diff()` printed the cached-block header, hit `AttributeError("'str' object has no attribute 'get'")` in `_print_findings()`, then the outer guard returned `0`.

Fix: validate/sanitize cached block entries before use, or make `_print_findings()` tolerate non-dict findings. A cached `verdict: "block"` must return `1` even if findings are missing/malformed. Add a regression for malformed cached block findings returning `1`.

**Merge Checklist**

Not clear to push. Remaining must-fix set:

- Harden cached confirmed-block handling against malformed `findings`.
- Add the regression above.
- Rerun full suite in a writable environment. I could not rerun pytest here because Python reported no usable temp directory; static count is 92 tests.