# SAMAGRA OS · E1 — Autonomous Build Loops

Two long-running **Workflow scripts** (one per agent worktree) plus the shared
**rubric** they iterate against. They build **Phase E1** of SAMAGRA OS (the
windowing shell + aqua theme + six OS utilities) by draining each agent's
unblocked task queue under a TDD → gate → Codex-review → iterate → commit loop.

> **Status: authored for LATER launch — do NOT run now.** These are artifacts.
> Launching requires the two git worktrees to exist and deepak's bootstrap
> prefix to be on `main`. Nothing here scaffolds the frontend or runs a build.

## Files

| File | What it is |
|---|---|
| `deepak-loop.js` | claude-deepak loop — substrate, all pure `lib/**` engines, Zustand stores, FastAPI serve seam, aqua shell + Dashboard/Settings/Terminal, the E1.26 integration gate. 22 tasks (18 headless + 4 visual-residue). |
| `khanak-loop.js` | claude-khanak loop — four thin leaf apps/components (shared components, Clock, Notes, Snake) wrapping deepak's tested engines. 4 visual-residue tasks. |
| `RUBRIC.md` | the iterate-against acceptance contract: per-task gates, a 0–100 weighted score (Correctness 40 / Fidelity 20 / Code-quality+Review 25 / Type+Build 15), PASS=85, tracked metrics, STOP/ESCALATE conditions, and the **separate human visual-fidelity checklist** (outside both loops). |

## How they fit together

```
        deepak-loop.js                         khanak-loop.js
   ┌───────────────────────┐             ┌───────────────────────┐
   │ E1.1 bootstrap        │             │  (await-prefix)        │
   │ E1.2 contracts+reg ───┼─ merge main →│  git rebase main      │
   │ E1.3..E1.16 lib/**    │   engines on │  E1.25 components      │
   │ E1.7 stores           │   main ─────→│  E1.22 Clock           │
   │ E1.17 serve seam (py) │   unblock    │  E1.23 Notes           │
   │ E1.18 shell ──────────┼─ shell on ──→│  E1.24 Snake           │
   │ E1.19/20/21 apps      │   main       └───────────┬───────────┘
   │ E1.26 GATE + sync ◄───┼── integrate agent/khanak ─┘ then agent/deepak
   └───────────────────────┘
```

- **Both loops share `RUBRIC.md`** as their per-task done-contract and their
  STOP/ESCALATE rules. Each task: write the failing test → implement to green →
  `npm run verify` **+ `npm run test:cov` (coverage gate: ≥90% branch lib / ≥70%
  wrapper)** (+ `pytest` for Python) → `samagra review-staged` → iterate until
  rubric ≥ 85 and no confirmed-CRITICAL → commit (the active `core.hooksPath`
  gate re-runs Codex) → record metrics → next unblocked task. Each loop also runs
  a **startup `codex-preflight`** — if `codex` is not on PATH it enters an
  explicit, metrics-surfaced advisory-only degraded mode (never a silent allow).
- **deepak owns every shared/substrate file** (config, lockfile, contracts,
  frozen `registry.ts`, stores, themes, all `lib/**`, serve seam). **khanak owns
  only brand-new leaf files.** No path is written by both → the merge is
  mechanical (zero content conflict).
- **Visual tasks** (E1.18–E1.25) are looped on their **headless residue only**
  (render-smoke / fake-timer / mocked-storage / gating-predicate). **Pixel /
  interaction parity is a separate human QA pass** (owner = deepak, with preview
  tools), at the E1.26 boundary — never a loop completion signal.

## Launch order (strict)

1. **Prereqs:** the two worktrees exist — `../samagra-deepak` (branch
   `agent/deepak`) and `../samagra-khanak` (branch `agent/khanak`), both rebased
   onto `main`. The advisory Codex hook is active repo-wide
   (`core.hooksPath=.githooks` → `samagra review-staged`); `codex` on PATH.

2. **Launch `deepak-loop.js` FIRST**, inside `../samagra-deepak`:
   - It runs **E1.1 (bootstrap)** then **E1.2 (contracts + frozen registry)** and
     **merges `agent/deepak` → `main`** (the `mergePoint`). This is khanak's gate.
   - It continues through all `lib/**` engines, stores, serve seam, then the
     shell (E1.18) + Dashboard/Settings/Terminal.

3. **Launch `khanak-loop.js`** inside `../samagra-khanak`, **after** the prefix
   (E1.1 + E1.2) is on `main`:
   - It blocks in `await-prefix` until the prefix is merged, then `git rebase
     main` + `npm install`.
   - Each khanak task additionally waits (via `depsReady`) for the specific
     deepak engine(s) + the shell it wraps to land on `main` — it **never**
     reimplements deepak's `lib`. Natural first task: **E1.25 components** (needs
     only themes E1.4); then Clock/Notes/Snake as their engines + shell land.
   - The two loops then run **concurrently** from the rebase point onward.

> deepak-bootstrap-first is mandatory: a second author of `package.json` /
> lockfile / `registry.ts` would guarantee a merge conflict. Until E1.1+E1.2 are
> on `main`, khanak writes nothing.

## Merge / integration step (after both drain)

Owned by **deepak's E1.26** (the `integration` task):

1. Both queues drained (deepak through E1.21; khanak through E1.24/E1.25).
2. From `main`: **merge `agent/khanak` → `main`, then `agent/deepak` → `main`**
   (khanak-first per `repo.md` §4d — khanak's leaf files never collide).
3. **Full headless gate from `main`:** `cd frontend && npm run verify` (all
   `lib/*` specs + RTL smoke green; `dist/` builds) **and** `.venv\Scripts\python
   -m pytest -q` (existing + `test_serve_seam`).
4. **Sync pointer files:** `STATUS.html` (E1 ✅ + test summary + artefacts),
   `SUMMARY.html` (plain-language one-pager), `HANDOFF.md` (what landed / next =
   E2). Commit `docs(status): E1 … SHIPPED — sync pointer files`.
5. **Human visual-fidelity pass** (separate, owner-run): walk the §6 checklist
   in `RUBRIC.md` per surface vs `screenshots/`. This is **not** a loop step and
   **not** a blocker for any loop task — it is the final human sign-off.

## Guardrails (both loops)

- Valid Workflow scripts: pure-literal `meta`, `agent()/parallel()/pipeline()/
  phase()/log()` + an injected `budget`; **no `Date.now()` / `Math.random()` /
  `new Date()`** (determinism).
- **Never `--no-verify`. Never self-break-glass** (`SAMAGRA_REVIEW_BREAKGLASS` is
  human-only). A confirmed-CRITICAL is a hard stop — fix in-band or escalate.
- **Codex down → advisory allow, never wedge.** Each loop guards against it.
- Conventional-commit subjects + the `Co-Authored-By: Claude Opus 4.8` trailer;
  never amend.
