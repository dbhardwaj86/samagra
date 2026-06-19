You are **Codex — Chief Architect & Code-Review Lead** of SAMAGRA, performing a
**blocking pre-merge review** before the Chairman (Deepak, human) pushes the
**Phase 2 (governance)** work from local `main` to `origin/main` and activates the
hook/worktrees. The CEO (Claude-Deepak) has requested this review per the runbook
(§1: "CEO re-invokes Codex before any merge"). Be adversarial and precise. You have
read-only repo access — run commands yourself.

## What to review

Phase 2 is the **9 commits** on `main` after the last Phase-1 commit. Run and read
the full diff plus the changed files in their entirety:

```
git log --oneline 4b9e949..HEAD
git diff --stat 4b9e949..HEAD
git diff 4b9e949..HEAD
```

(Ignore the unstaged `CLAUDE.md` change — it is an external scribe-managed block.)

## Critical context — review against the AS-BUILT contract, not the stale plan

The plan's Phase-2 section (`docs/superpowers/plans/2026-06-19-samagra-evolution.md`)
was **stale** and self-flagged `SUPERSEDED by D5/D9`. It was reconciled to the
authoritative runbook (`docs/codex-reviews/PHASE1-loop-runbook.md`, decisions D5/D6/D9/D11)
**before** building. Review against the runbook + the as-built code, NOT the stale plan
code blocks. The two binding decisions:

- **D6 — DB split.** Governance state is **durable** and lives in its OWN
  `config.GOVERNANCE_DB` = `governance.db`, SEPARATE from the rebuildable catalog
  `config.DATA_DB` = `samagra.db`. The store adds `SCHEMA_VERSION` (PRAGMA user_version),
  a migration hook, and a consistent `backup()`. `governance.db` must NEVER be deleted as
  a "catalog reset".
- **D5 — advisory hook (NOT fail-closed).** The pre-commit Codex gate blocks ONLY a
  *confirmed* CRITICAL — a second Codex pass over the same staged diff must independently
  agree. Verdicts are memoized by staged-diff hash. An audited break-glass
  (`SAMAGRA_REVIEW_BREAKGLASS="<reason>"`, logged to `state/review/breakglass.log`) allows
  override. A Codex that errors / times out / is absent **MUST NOT wedge commits** — it
  warns and allows (exit 0). Real enforcement = CI / branch protection. The old
  "fail-closed / no escape hatch" language is retired (D11 explicitly forbids re-importing it).

## Verify each claim actually holds

**Governance store — `samagra/governance/store.py`, `samagra/config.py`, `tests/conftest.py`:**
- Does `connect()` open `config.GOVERNANCE_DB` (NOT `DATA_DB`)? Could any code path put
  governance tables into the catalog DB? Is the separation real and testable?
- `init_tables()` idempotency: safe to call on every API request? `_apply_migrations()` +
  `PRAGMA user_version` — the version is written via an f-string (`PRAGMA user_version = {int(cur)}`):
  is that injection-safe (PRAGMA cannot bind params)? Is `int()` coercion sufficient?
- Are ALL queries parameterized (no SQL string interpolation of user/data values)?
- `backup()` via `sqlite3.Connection.backup` — consistent snapshot? Connections closed on
  every path (exceptions)? Does it create parent dirs? Could it clobber/duplicate?
- Status/verdict allow-lists (`ASSIGNMENT_STATUS`, `REVIEW_VERDICT`) — enforced on every
  mutation? Per D11, is the ledger metadata-free (verdict + free-text rationale only, no
  enumerated reason columns)?
- Does the S-01 autouse fixture now redirect `GOVERNANCE_DB` too, so tests never touch a
  real `governance.db`? Any test or import that could still write the real DB?

**Advisory hook — `samagra/review/precommit.py`, `samagra/review/codex_dispatch.py`,
`.githooks/pre-commit`, `samagra/__main__.py`:**
- **Never-wedge:** trace every exception path. If `codex` is absent / errors / times out /
  returns malformed JSON twice, does `review_staged_diff()` return 0 (allow)? Confirm there
  is NO path that returns 1 on Codex unavailability. Empty staged diff → 0 without calling Codex?
- **Confirmed-CRITICAL:** does a single CRITICAL pass NOT block? Does blocking require a
  SECOND agreeing Codex pass? If the confirm pass errors or disagrees, is the result advisory
  (allow), not block?
- **Diff-hash cache** (`state/review/diff_cache.json`): keyed by sha256 of the staged diff?
  A cached `block` returns 1 without re-running Codex; a cached `pass` returns 0. Corrupt/missing
  cache → never wedges (returns {} and proceeds)? Any cache-poisoning or cap/growth issue?
- **Break-glass:** `SAMAGRA_REVIEW_BREAKGLASS` allows + appends an audited line; does it leak
  any secret? Is it clearly the only override, and is its bypass acceptable given the advisory model?
- `dispatch_codex` resolves the exe LAZILY (so the module imports without `codex`)? Read-only
  sandbox, stdin prompt, temp-file cleanup on all paths, schema temp-file cleanup?
- The committed `.githooks/pre-commit` shim: LF endings, correct module, runs from repo root,
  works under bare `python` (system 3.11/3.14) — does the precommit import chain pull in any
  third-party dep (requests/dotenv) that would break a clean `python -m samagra.review.precommit`?
- **Prompt-injection / threat model:** the staged diff is interpolated into the Codex prompt.
  Note any realistic risk and whether the advisory model + human publish gate (Gate 1) bounds it.

**API + portal — `samagra/api/app.py`, `samagra/portal/...`:**
- `GET /api/assignments` reads governance.db (init per request) — any info-leak (secrets?),
  injection, or error-handling gap? Connection closed on every path?
- Portal `renderAssignments()` — all dynamic values escaped via `esc()` (XSS)? Tab registration correct?

**Also check:**
- **Regressions** to slice-1: the `config.py` addition, the `conftest.py` change, the
  `api/app.py` import — do they break existing behavior? Full suite is claimed 85/85 green.
- **Tests prove the claim:** do `tests/test_precommit.py` (9) and `tests/test_governance.py` (13)
  genuinely exercise never-wedge, confirm, cache, break-glass, and D6 separation — or are any
  tautological / always-green? (Context: the API test calls the route function directly instead
  of `TestClient` because the venv lacks `httpx` — intentional, not a defect. Windows pytest
  convention is `--basetemp=.pytmp`.)
- **Docs ↔ code consistency:** does any shipped artifact (README, board `AGENTS.md`, STATUS.html
  org SVG, HANDOFF) still carry retired "fail-closed / no escape hatch" wording, contradicting D5/D11?
- **Windows portability:** sqlite backup, file paths, the hook shebang/exec.

## Output (your final message = the report)

Produce a tight, technical structured markdown report read by the CEO and Chairman:

1. **Verdict:** one of `APPROVE` · `APPROVE-WITH-NITS` · `REQUEST-CHANGES` · `BLOCK`, with a
   one-paragraph rationale and an explicit push/merge recommendation to the Chairman.
2. **Findings**, each: `[SEVERITY] file:line — title`, then *what's wrong*, *why it matters*,
   *concrete fix*. Severity ∈ CRITICAL / HIGH / MEDIUM / LOW / NIT. If nothing at a severity, say so.
   Default to skepticism — try hard to find a path where the hook wedges a commit, where
   governance state can land in the catalog DB, or where a query is injectable.
3. **What's solid:** a short list of what is genuinely well done.
4. **Merge checklist:** the minimal must-fix set (if any) before push/merge, vs. nits for follow-up.
