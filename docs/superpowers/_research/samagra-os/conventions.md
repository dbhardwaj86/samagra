# SAMAGRA OS — House Conventions for the New Plan + Autonomous Loops

> Authoritative conventions extracted from the live repo (`C:\SandBox\claude_box\TeachingOS`) so the
> SAMAGRA OS Experience-track plan and the two agent loops (claude-deepak / claude-khanak) match what
> already ships. Sourced from `tests/conftest.py`, `tests/test_governance.py`, `tests/test_precommit.py`,
> `samagra/review/precommit.py`, `samagra/review/codex_dispatch.py`, `samagra/__main__.py`,
> `.githooks/pre-commit`, `pyproject.toml`, `README.md`, `HANDOFF.md`, and
> `docs/superpowers/plans/2026-06-19-samagra-evolution.md`. Date: 2026-06-20.

This is a **conventions reference**, not the plan. It does NOT relitigate the approved SAMAGRA OS
decisions (React 18 + TS + Vite in `frontend/`, retired jinja portal, Zustand stores, E1/E2/E3 phasing,
pure-TS linchpin modules, the two worktrees). It tells the plan-author and the loops *how this repo
does TDD, gates commits, and shapes plan tasks* so the new work is indistinguishable in style.

---

## 1. How tests run (Python backend) + TDD red-green-commit cadence

### 1.1 Python test invocation (the one true command)

- **Runner:** `pytest`, configured in `pyproject.toml` under `[tool.pytest.ini_options]`:
  `testpaths = ["tests"]`, `addopts = "-q"` (quiet by default).
- **Interpreter:** the project venv `.venv` (Python 3.11). System Python is 3.14 — **always** invoke
  the venv explicitly; never bare `pytest` or bare `python`.
- **PYTHONPATH = repo root.** Run from `C:\SandBox\claude_box\TeachingOS` so `import samagra` resolves
  (there is no `pip install -e` in the test loop; cwd/PYTHONPATH does the resolution). HANDOFF.md sets it
  explicitly for shells that need it.

Exact commands (Windows-first; this repo is Windows-native):

```powershell
# from the repo root, PowerShell
cd C:\SandBox\claude_box\TeachingOS
$env:PYTHONPATH = (Get-Location).Path        # belt-and-suspenders; cwd usually suffices
.venv\Scripts\python -m pytest -q            # whole suite (currently 98 passed)
.venv\Scripts\python -m pytest tests/test_precommit.py -q          # one file
.venv\Scripts\python -m pytest tests/test_precommit.py -k munshi -q # one selector
```

```bash
# Git-Bash equivalent (some plan steps run in bash)
cd /c/SandBox/claude_box/TeachingOS
export PYTHONPATH=$(pwd)
.venv/Scripts/python.exe -m pytest -q
```

- **Test isolation is automatic.** `tests/conftest.py` defines an `autouse`, function-scoped fixture
  `isolate_data_db` that monkeypatches **both** `config.DATA_DB` (catalog `samagra.db`) and
  `config.GOVERNANCE_DB` (durable `governance.db`) to per-test `tmp_path` files. Every test is isolated
  from the real DBs without opting in. **Any new module that reads a real file/DB/path at call time
  must be redirected the same way** (a per-test fixture monkeypatching the relevant `config.*` constant or
  module attribute) — see `test_precommit.py::isolate_review_state` redirecting `config.STATE_DIR` and
  clearing `SAMAGRA_REVIEW_BREAKGLASS`.
- **No live external calls in tests.** HTTP clients and Codex are **mocked** (monkeypatch the module's
  `requests` / `dispatch_codex` attribute, or inject a fake). The precommit tests monkeypatch
  `precommit.get_staged_diff` and `precommit.dispatch_codex` so neither real git nor real Codex runs.
  API routes are exercised by **calling the route function directly** (e.g.
  `from samagra.api import app; app.api_assignments()`) rather than spinning an HTTP server.

### 1.2 Red-green-commit cadence (per task)

The repo's TDD rhythm, repeated verbatim across every `(TDD)` task in the plan:

1. **RED — write the failing test first.** Add/append the test(s) for exactly the behavior the task
   delivers. Run the narrowed selector and *watch it fail*:
   `.venv\Scripts\python -m pytest tests/test_<x>.py -q` → expect `ModuleNotFoundError` / `ImportError` /
   assertion failure. The plan step literally says "Run — expect FAIL" and names the expected error.
2. **GREEN — implement the minimum.** Write the production code to make the test pass. Import any
   monkeypatch-target by name into the module under test (e.g. `from .codex_dispatch import dispatch_codex`)
   so tests can patch `precommit.dispatch_codex`.
3. **VERIFY — run green + guard against regressions.** Re-run the narrowed selector (`expect PASS`), then
   for anything touching shared surfaces re-run the broader suite/spine to confirm no regression
   (the plan does this explicitly at registration/integration tasks).
4. **COMMIT — one focused commit per task** with a conventional-commits message + the trailer (below).
5. **Verification-driven (not TDD) tasks** exist too — pure scaffolding, renames, hook installation, SVG,
   docs — and are gated by `grep`/import/`--dry-run`/file-exists checks instead of red-green. Mark them
   "verification-driven" in the task header, exactly as the plan does (e.g. Task 1.1, 2.2, 2.4, 2.7, 2.8).
6. **Phase green gate.** Each phase ends with a *full-suite green* task (no new files; verification only)
   before the next phase begins — e.g. Task 2.9, Task 3.7.

### 1.3 Commit message style (mandatory)

- **Conventional Commits** prefix: `type(scope): subject`. Observed types in history/plan: `feat`, `fix`,
  `refactor`, `test`, `chore`, `docs`. Scope is the subsystem (`clients`, `review`, `governance`,
  `handoff`, `status`, `os`, `frontend`, …). Subject is imperative, lower-case, no trailing period.
- **Every commit ends with the Co-Authored-By trailer**, separated by a blank line:

```
feat(os): window-manager geometry/z-order/clamp math (pure TS)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

  Real examples from history: `docs(handoff): fix in-sync wording flagged by the pre-commit gate`,
  `fix(review): _safe_str + variadic _warn — stringify caught exceptions inside the guard`. Multi-line
  commit bodies use a heredoc (bash) or a single-quoted here-string `@'...'@` (PowerShell). **Do not
  amend; create a new commit.** **Never `--no-verify`** — the advisory gate must run on every commit.

---

## 2. The Codex pre-commit review gate — exact mechanics

### 2.1 What is wired

- `.githooks/pre-commit` is a committed POSIX shim: `exec python -m samagra.review.precommit`.
- The hook is **ACTIVE**: `git config core.hooksPath .githooks` is set (verified live). Because
  `core.hooksPath` is a repo-level config that all worktrees share, **the gate runs on every commit in the
  main checkout AND in `../samagra-deepak` and `../samagra-khanak`** — no per-worktree install needed.
- The same logic is reachable as a CLI verb: **`python -m samagra review-staged`**
  (`samagra/__main__.py::cmd_review_staged` → `review_staged_diff()`; exits 0 allow / 1 block).
- `python -m samagra.review.precommit` and `samagra review-staged` are interchangeable entry points to the
  identical `review_staged_diff()` — use the latter for a manual/loop dry-run, the former is what the hook calls.

### 2.2 What `review_staged_diff()` does (runbook D5 — advisory-local, never fail-closed)

1. `get_staged_diff()` = `git diff --cached --unified=3`. **Empty staged diff → return 0** (allow) without
   ever calling Codex.
2. **Break-glass short-circuit.** If env `SAMAGRA_REVIEW_BREAKGLASS="<reason>"` is set, the commit is
   **allowed (return 0)** and an audited, sanitized (single-line, ≤200 char) entry is appended to
   `state/review/breakglass.log` — *before* Codex is ever consulted. This overrides even a confirmed-CRITICAL.
3. **Diff-hash cache.** Verdicts are cached by `sha256(diff)` in `state/review/diff_cache.json` (cap 256,
   pruned oldest-first). A cached `block` re-returns 1; a cached `pass` re-returns 0 — Codex is not re-run for
   an identical staged diff. (`state/` is gitignored.)
4. **Review pass.** On a cache miss, `dispatch_codex` reviews the diff against `FINDINGS_SCHEMA`
   (severity ∈ CRITICAL/HIGH/MED/LOW). **HIGH/MED/LOW print but never block.**
5. **Confirmed-CRITICAL only.** A CRITICAL in pass 1 triggers a **second confirming Codex pass over the same
   diff**. It **blocks (return 1) only if the confirm pass also reports a CRITICAL**. A lone/unconfirmed
   CRITICAL (confirm disagrees) is treated as advisory → allow (absorbs single-pass false positives).
6. **Never wedges.** A Codex that errors / times out / is not on PATH is **advisory**: it warns and
   **allows (return 0)**, and does NOT cache the transient failure. An outer never-wedge guard wraps the whole
   hook so ANY unexpected error returns 0. Defense-in-depth: once a block is *decided*, every side-effect
   (prints, cache writes, dedup `__eq__`, stringification) is best-effort/non-throwing so nothing can
   downgrade the `return 1` (this class of bug — an outer guard silently swallowing the block path — is
   covered by ~12 regression tests in `test_precommit.py`; preserve them).
7. **Severity policy.** CRITICAL is reserved for: secret/credential leaks, destructive shell/SQL
   (`rm -rf`, `DROP`/`DELETE` without `WHERE`), command/SQL injection, or data-corrupting / build-breaking
   changes. Everything else is HIGH/MED/LOW (advisory, non-blocking).

**Requirements:** `codex` on PATH (`npm i -g @openai/codex`, currently 0.140.0) or `CODEX_BIN` set. Absent →
advisory allow, never a wedge. Real enforcement is CI / branch protection; the human publish gate is the only
sacred, never-automated block.

### 2.3 How an autonomous loop should invoke the gate

- **Do not bypass it.** Loops commit normally (`git commit`); the active `core.hooksPath` runs the gate
  automatically inside each worktree. Never pass `--no-verify`.
- **Pre-flight a dry-run before staging risky work** so the loop can react in-band:
  `git add -A` then `.venv\Scripts\python -m samagra review-staged` — exit 0 = clean to commit, exit 1 =
  confirmed-CRITICAL (the loop should treat this as a hard stop, surface the printed findings, fix, and
  re-run, NOT break-glass past it).
- **Break-glass is human-only, audited, and exceptional.** A loop must NOT set `SAMAGRA_REVIEW_BREAKGLASS`
  on its own; reserve it for an explicit owner-approved emergency (it leaves an audit line).
- **A non-zero exit from the gate is a real failure signal** the loop's rubric must honor — count it as a
  blocked iteration, not a flake. (A *missing* Codex → exit 0 advisory is NOT a gate pass in spirit; if the
  loop relies on the gate for safety it should verify `codex` is on PATH at startup.)

---

## 3. Frontend test stack + the commands the loops gate on

The linchpin decision pushes all real behavior into **pure TypeScript modules** that are unit-testable
headlessly. The loop's "done" signal for a frontend task is the **same red-green-commit cadence** as Python,
but gated on four fast, headless, deterministic checks (no browser, no pixels):

| Gate | Tool | Command | What it proves |
|---|---|---|---|
| Unit/logic tests | **Vitest** + React Testing Library + jsdom | `npm test` (CI) / `npm run test:watch` (dev) | the pure TS modules + thin components behave |
| Typecheck | **tsc** | `npm run typecheck` | no type errors (catches contract drift) |
| Build | **Vite** | `npm run build` | the bundle compiles to `dist/` |
| Lint | **ESLint** (+ `@typescript-eslint`) | `npm run lint` | style/anti-pattern gate |

### 3.1 Proposed `frontend/package.json` scripts

```jsonc
{
  "scripts": {
    "dev": "vite",                                  // dev server; proxies /api -> FastAPI :8799
    "build": "tsc --noEmit && vite build",          // typecheck THEN bundle to dist/
    "preview": "vite preview",
    "test": "vitest run",                           // headless, single-shot (CI + loop gate)
    "test:watch": "vitest",                         // interactive dev
    "test:cov": "vitest run --coverage",            // coverage (v8 provider)
    "typecheck": "tsc --noEmit",                    // standalone typecheck gate
    "lint": "eslint \"src/**/*.{ts,tsx}\"",
    "lint:fix": "eslint \"src/**/*.{ts,tsx}\" --fix",
    "verify": "npm run lint && npm run typecheck && npm run test && npm run build"
  }
}
```

- **`npm run verify` is the single loop-gate command** for a frontend task — green = task complete, mirroring
  the Python "full-suite green" phase gate. Order is cheap→expensive (lint, typecheck, test, build) so the
  loop fails fast.
- **Vitest config:** `environment: 'jsdom'`, `globals: true`, `setupFiles` for RTL `@testing-library/jest-dom`.
  Keep window-manager / snake / clock / terminal-parser / notes-todos / localStorage logic in **pure modules
  with zero React imports** so the bulk of tests run with no DOM at all (fastest, most deterministic).
- **Dev/prod serving (decided, restated for the gate):** Vite dev server proxies `/api` → FastAPI `:8799`;
  `vite build` emits to `dist/`, which FastAPI serves at `/` while keeping `/api/*`. The loop should NOT
  start a long-lived dev server as a gate — build + headless tests are the gate; live preview is human QA.
- **Pixel/visual fidelity is explicitly OUT of both loops** — it is a separate human QA pass. The loops gate
  only on the four headless checks above.

---

## 4. Plan task-format template (mirror this exactly)

The new SAMAGRA OS plan must reuse the existing plan's structure verbatim so the executing-plans /
subagent-driven-development skills drive it identically. Template:

### 4.1 Document header (top of the plan)

```markdown
# SAMAGRA OS — <track> Implementation Plan

> **▶ PROGRESS (updated YYYY-MM-DD):** one-line per-phase tracker of record (the per-task
> checkboxes are NOT individually ticked; these banners are the tracker).

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** <one paragraph>.
**Architecture:** <how the phases compose>.
**Tech Stack:** React 18 + TS + Vite (`frontend/`), Zustand, Vitest/RTL/jsdom, lucide-react,
  Python 3.11 (`.venv`) + FastAPI control plane, advisory Codex pre-commit gate.
**Spec:** [link to the SAMAGRA OS design handoff / spec] — read it first.

## Shared Contracts — single source of truth for names
<verbatim module names, store names, file paths, pure-TS module signatures, npm scripts,
 the exact test command, the commit trailer — "Every task below uses these verbatim.">
```

### 4.2 Phase + Task skeleton

```markdown
## Phase E1 — Shell + Aqua theme + OS utilities

> **(status banner — ⬜ NOT STARTED / 🟡 IN PROGRESS / ✅ COMPLETE (YYYY-MM-DD))**

<2-3 sentences: what this phase delivers, that each phase ends green before the next>.

**Files:**
- **Create** `frontend/src/os/windowManager.ts` — pure geometry/z-order/clamp/tile math.
- **Test** `frontend/src/os/windowManager.test.ts` — headless Vitest unit tests.
- **Modify** `frontend/src/...` — <one line each, Create/Modify/Test/Rename verb up front>.

---

### Task E1.1: <pure-TS module name> (TDD)

**Files:**
- Test `frontend/src/os/windowManager.test.ts`
- Create `frontend/src/os/windowManager.ts`

<1-2 sentences describing the exact behavior + the contract it satisfies>.

- [ ] **Step 1: Write the failing test.** <exact test file, full code block to paste>.
- [ ] **Step 2: Run — expect FAIL.**
  ```bash
  cd frontend && npm test -- windowManager
  ```
  Expected: `Cannot find module './windowManager'` (red).
- [ ] **Step 3: Implement <module>.** <full code block to paste>.
- [ ] **Step 4: Run — expect PASS.**
  ```bash
  cd frontend && npm test -- windowManager
  ```
  Expected: the N tests pass.
- [ ] **Step 5: Gate + commit.**
  ```bash
  cd frontend && npm run verify
  git add frontend/src/os/windowManager.ts frontend/src/os/windowManager.test.ts
  git commit -m "feat(os): window-manager geometry/z-order/clamp math (pure TS)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```
  Expected: verify green; commit succeeds (the advisory Codex gate runs and allows).
```

### 4.3 Format rules carried over from the existing plan

- **Numbering:** `Task <Phase>.<N>` (E1.1, E1.2 …). Tag `(TDD)` for red-green tasks and
  **`(verification-driven)`** for scaffolding/build-config/install/SVG/docs tasks.
- **Each task lists its `**Files:**`** with a Create/Modify/Test/Rename verb per line, before the steps.
- **Steps are `- [ ]` checkboxes**, each a bold imperative (`**Step N: …**`), with the **exact command**
  and the **expected output** ("Expected: …") — including the expected RED error string on the fail step.
- **Failing-test-first:** every TDD task is Step1 write test → Step2 run/expect FAIL → Step3 implement →
  Step4 run/expect PASS → Step5 gate+commit. Verification-driven tasks substitute grep/build/import/file
  checks for the red-green pair.
- **Exact code blocks:** paste-ready full file contents (not prose descriptions). Reuse existing
  helpers by name (Python: `jget`/`esc`/`activate` in the old portal had analogues; TS: shared store
  selectors, `esc`-style helpers) rather than reinventing.
- **One commit per task**, conventional-commits + the Co-Authored-By trailer, never `--no-verify`.
- **Phase boundary = a full-suite green gate task** (`npm run verify` for frontend; `pytest -q` for any
  backend touched) with no new files, then a tracker/pointer-file sync (STATUS.html + SUMMARY.html +
  HANDOFF.md per the status-pointer-files convention).
- **Superseded blocks:** if a task's body is later reconciled against the runbook, leave it in place with a
  `> **SUPERSEDED by …**` blockquote at the top rather than deleting — matches how D5/D9 reconciliation is
  recorded in the existing plan.

---

## 6-line summary

1. **Tests:** `.venv\Scripts\python -m pytest -q` from the repo root (PYTHONPATH=repo root, Python 3.11 `.venv`); `tests/conftest.py` autouse-isolates `DATA_DB`+`GOVERNANCE_DB` to tmp paths; all external/HTTP/Codex calls are mocked, API routes called directly.
2. **TDD cadence:** RED (write failing test, run, "expect FAIL") → GREEN (minimal impl) → VERIFY (narrow then broad) → one focused commit per task; scaffolding/config tasks are "verification-driven" (grep/build/import checks) instead.
3. **Commits:** Conventional Commits `type(scope): subject`, imperative, no trailing period, multi-line via heredoc/here-string, always ending with a blank line then `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; never amend, never `--no-verify`.
4. **Codex gate:** `.githooks/pre-commit` → `python -m samagra.review.precommit` (= CLI `samagra review-staged`), active via `core.hooksPath=.githooks` so it runs on every commit in every worktree; blocks (exit 1) ONLY on a two-pass confirmed-CRITICAL surviving the sha256 diff-cache, never wedges (broken/absent Codex → advisory allow), audited `SAMAGRA_REVIEW_BREAKGLASS` override; loops commit normally + may dry-run `samagra review-staged`, must treat exit 1 as a hard stop and never self-break-glass.
5. **Frontend gate:** Vitest (headless `vitest run`) + `tsc --noEmit` + `vite build` + ESLint, wrapped as `npm run verify` (lint→typecheck→test→build, fail-fast) — the loop's single per-task "done" signal; pure-TS linchpin modules keep tests DOM-free; pixel/visual fidelity is a separate human QA pass outside both loops.
6. **Plan format:** mirror `docs/superpowers/plans/2026-06-19-samagra-evolution.md` — progress-banner header + Shared-Contracts name block; `Task E<phase>.<N>` tagged `(TDD)`/`(verification-driven)`; `**Files:**` with Create/Modify/Test verbs; `- [ ]` steps = write-test→expect-FAIL→implement→expect-PASS→gate+commit with exact commands, expected output, and paste-ready code blocks; each phase ends with a full-suite green gate + pointer-file sync.
