**Verdict: REQUEST-CHANGES**

Do not push `main` to `origin/main` or activate `.githooks` yet. The D6 database split is real, and the D5 Codex-unavailable path is mostly advisory as intended, but I found a real never-wedge violation in the hook’s local cache/state handling plus two governance reliability issues. These are small fixes, but they touch the exact contracts Phase 2 is supposed to guarantee.

**Findings**

`CRITICAL`: none.

`[HIGH] samagra/review/precommit.py:94 — Corrupt or unwritable review cache can still wedge commits`

What’s wrong: `_load_cache()` only catches JSON parse/read exceptions, but returns any valid JSON type. A valid-but-wrong cache like `[]` reaches `cache.get(...)` at line 161 and raises `AttributeError`. Separately, `_save_cache()` at line 109 is outside the advisory try/catch; if `state/review` is unwritable, a passing review raises `OSError` instead of allowing.

Why it matters: D5 says corrupt/missing cache and local hook failures must never wedge commits. I verified both paths by monkeypatch: wrong-shape cache raises `AttributeError`; cache write failure raises `OSError`.

Concrete fix: validate cache shape in `_load_cache()` and return `{}` unless it is a dict of dict-like verdict entries. Make cache write/log IO best-effort or catch `OSError` around `_load_cache()`, `_save_cache()`, and `_audit_breakglass()`. Add regression tests for valid JSON non-dict cache and `_save_cache` failure.

`[MEDIUM] samagra/api/app.py:101 — /api/assignments leaks the SQLite connection if init_tables fails`

What’s wrong: `conn = gstore.connect()` is followed by `gstore.init_tables(conn)` before the `try/finally`. If schema creation or migration fails, `conn.close()` is never reached.

Why it matters: this endpoint calls init per request. A locked/corrupt DB or bad future migration can leak handles and make the failure mode worse.

Concrete fix: move `gstore.init_tables(conn)` inside the `try` block:

```python
conn = gstore.connect()
try:
    gstore.init_tables(conn)
    return {"assignments": ..., "events": ...}
finally:
    conn.close()
```

`[MEDIUM] samagra/governance/store.py:117 — Missing assignment IDs still create status events`

What’s wrong: `set_assignment_status()` updates by `id`, but never checks `cursor.rowcount`. Calling it with a nonexistent assignment writes an event like `status:running` for an assignment that does not exist.

Why it matters: this is the durable governance ledger. A typo or stale assignment ID can create false audit history. I verified with an in-memory DB: zero assignments, one orphan status event.

Concrete fix: store the update cursor, require `rowcount == 1`, and raise/rollback before `append_event()` if no assignment was updated. Add a regression test.

`[LOW] samagra/review/precommit.py:116 — Break-glass reason is logged raw`

What’s wrong: `SAMAGRA_REVIEW_BREAKGLASS` is written and printed verbatim. Newlines/tabs can forge extra-looking audit lines, and an operator who accidentally puts a secret in the reason will echo it to stderr and `breakglass.log`.

Why it matters: not a secret leak by itself, but audit logs should be single-line and bounded.

Concrete fix: normalize whitespace, cap length, and log the sanitized reason.

`[NIT] HANDOFF.md:67 / STATUS.html:436 — Phase 2 commit count is inconsistent with the reviewed range`

What’s wrong: docs say 9 commits, but `git log --oneline 4b9e949..HEAD` returns 10 commits. `80f464a..HEAD` is 9 because it excludes `80f464a`.

Concrete fix: say “10 commits in `4b9e949..HEAD`” or “9 commits after `80f464a`” consistently.

**What’s Solid**

- `store.connect()` really opens `config.GOVERNANCE_DB`, not `DATA_DB`; catalog refresh code still only touches `samagra.db`.
- `PRAGMA user_version = {int(cur)}` is injection-safe for this usage; PRAGMA cannot bind params and `cur` is coerced to `int`.
- Governance SQL user/data values are parameterized.
- `backup()` uses `sqlite3.Connection.backup()`, creates parent dirs, and closes both connections on its own exception paths.
- The hook blocks only confirmed CRITICALs in the normal Codex path; Codex missing/errors from `_review_once()` return 0.
- `.githooks/pre-commit` is LF, executable in git metadata, and runs `python -m samagra.review.precommit`; that direct import path is stdlib-only apart from optional caught `dotenv`.
- Assignment rendering escapes dynamic values via `esc()`.

**Merge Checklist**

Must fix before push/activation:
- Harden precommit cache/state IO so corrupt cache and unwritable `state/review` never cause accidental exit 1.
- Close `/api/assignments` connections even when `init_tables()` fails.
- Prevent orphan status events for nonexistent assignments.
- Add focused tests for those three cases, then rerun the full suite.

Follow-up nits:
- Sanitize break-glass reason logging.
- Fix Phase 2 commit-count wording in status docs.

Verification note: I ran the requested git log/stat/diff, inspected the changed implementation/tests/docs, checked hook EOL, ran `git diff --check`, and smoke-tested both hook entry points with empty staged diff under `python -B` on Python 3.14. Full pytest could not run in this read-only sandbox because Python/pytest had no usable writable temp directory.