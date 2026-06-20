# SAMAGRA OS · E1 — Iterate-Against RUBRIC (autonomous loops)

> The objective acceptance contract the two loops (`deepak-loop.js`,
> `khanak-loop.js`) iterate against. A task is **done** only when it clears the
> per-task acceptance gates **and** scores ≥ the PASS threshold **and** carries
> **no confirmed-CRITICAL** review finding. Pixel/interaction fidelity is **NOT**
> in this rubric — it is a separate human pass (last section).
>
> Authoritative sources: `docs/superpowers/plans/2026-06-20-samagra-os.md`
> (per-task tests + constants), `…-division.md` (ownership + visual quarantine),
> `docs/superpowers/_research/samagra-os/conventions.md` (gate mechanics).

---

## 1. Per-task acceptance gates (all must hold — binary)

A task does not advance to COMMIT until **every** applicable gate is green.

| # | Gate | How verified | Applies to |
|---|---|---|---|
| G1 | **Tests added + green** | The task's failing test was written first (RED) and now passes (GREEN); the narrowed selector `npm test -- <selector>` / `pytest <file>` is green | every TDD task |
| G2 | **Module branch coverage (MEASURED + ENFORCED)** | The pure module's logic branches are exercised — death/no-reverse/grow/speed-ramp (snake), every clamp branch (geometry), every command class (dispatch), corrupt/array-guard/missing (persistence), each line-class (terminal). **Coverage is actually measured** via `npm run test:cov` (= `vitest run --coverage`, v8 provider). Target **≥ 90% branch on the pure `lib/**` module under test** (hard, lib tasks); **≥ 70% on thin wrappers** (residue only). **The gate FAILS / the score is capped when per-module branch coverage < target.** A missing coverage signal is treated as BELOW threshold (the loop iterates, never passes a tautological green). | TS pure modules (hard), wrappers (soft) |
| G3 | **Typecheck clean** | `npm run typecheck` (`tsc --noEmit`) exits 0 — catches contract drift vs `types/contracts.ts` | every TS task |
| G4 | **Build OK** | `npm run build` (`tsc --noEmit && vite build`) writes `dist/` with no error | every TS task |
| G5 | **Lint clean** | `npm run lint` (eslint `src/**/*.{ts,tsx}`) exits 0 | every TS task |
| G6 | **Backend suite green** | `.venv\Scripts\python -m pytest -q` green (existing + new), `conftest.py` isolation honored, no live HTTP/Codex | Python tasks (E1.17, E1.26) |
| G7 | **Codex review: no confirmed-CRITICAL** | `samagra review-staged` over the staged diff exits 0 (or HIGH/MED/LOW advisory only). A **two-pass confirmed-CRITICAL** (exit 1) is a hard block | every commit |
| G8 | **Fidelity-to-proto constants** | Every asserted constant equals `proto.md` verbatim (registry accents/sizes, `LEVELS`, `INITIAL_Z=20`, work-area formulae, `RING_C=2π·110`, `ZONES`, seed ids/titles, `KEYS`, `termPalette`) | every TDD task |

> **G1–G5 are exactly `npm run verify`** (lint → typecheck → test → build,
> fail-fast). The loop runs `npm run verify` as one command; **G2 adds a second
> command `npm run test:cov` (`vitest run --coverage`) on every TDD TS task** —
> the gate is GREEN only when verify is green AND per-module branch coverage ≥
> the G2 target (90 lib / 70 wrapper). G6 adds pytest for Python tasks; G7 is the
> staged-diff Codex dry-run + the active commit hook.
>
> **Visual tasks (E1.18–E1.25):** G1–G7 apply to the **headless residue only**
> (RTL render-smoke + store-action + fake-timer + gating-predicate tests).
> G8/visual parity is **excluded** — see §6.

---

## 2. 0–100 weighted score (iterate until ≥ PASS)

After the gates are green, score the task across four weighted dimensions. The
loop iterates on the **lowest-scoring** dimension until the total ≥ PASS.

| Dimension | Weight | What earns full marks | What loses marks |
|---|---:|---|---|
| **Correctness / Tests** | **40** | RED-then-GREEN cadence followed; the test asserts the real behavior + edge cases; branch coverage ≥ G2 target; no skipped/`.only` tests | weak/tautological assertions; missing edge case (e.g. snake tail-exempt, persistence array-guard); coverage below target |
| **Fidelity-to-spec** | **20** | every constant matches `proto.md` verbatim (G8); signatures match the Shared-Contracts block; effects **returned not executed** where specified (dispatch) | invented constants/names; behavior drift from the plan; engine logic leaking into a React wrapper |
| **Code-quality / Review** | **25** | clean Codex review (no CRITICAL, ≤1 HIGH); pure module has zero React/DOM imports; no dead code; conventional-commit subject correct | confirmed-CRITICAL (→ 0 on this dimension, hard stop); ≥2 HIGH; DOM in a pure module; `any` without cause |
| **Type + Build health** | **15** | `tsc --noEmit` + `vite build` clean first try; no `@ts-ignore`; types flow from `contracts.ts` | type errors needing suppression; build warnings; loose `unknown` casts that defeat the contract |

**Fallback scorer** (when the agent doesn't return a score) — weights match this
table exactly (Correctness 40 / Fidelity 20 / Code-quality+Review 25 / Type+Build
15) and the score is **coverage- AND fidelity-aware**:

- `correctness = 40` **only if** `gateGreen` **AND** branch coverage ≥ G2 target
  **AND** no `.only`/`.skip` in the diff — else `0`. (A green-but-uncovered or
  `.only`-gamed test earns zero correctness, so it cannot reach PASS.)
- `typeBuild = 15·gateGreen` (was erroneously 20 — now aligned to the 15 weight).
- `codeQuality = 25 − 5·HIGHcount` (0 if confirmed-CRITICAL).
- `fidelity = 20` for a TDD task **only if its G8 proto-constant assertions are
  present** (else `0`); `12` for a visual-residue task (no proto constants — parity
  is human QA).

See `scoreRubric()` in each loop.

### PASS threshold

- **PASS = 85 / 100**, **and** zero confirmed-CRITICAL, **and** all §1 gates green.
- Below 85 → iterate (cap: `maxIterationsPerTask = 6`). At the cap without a
  pass → STOP/ESCALATE (§4).

---

## 3. Tracked METRICS (accumulated per task, summarized at loop end)

Emitted by each loop's `makeMetrics()` / `summary()`:

| Metric | Definition |
|---|---|
| **tasksDone** | tasks that reached COMMIT with status `done` |
| **tasksEscalated** | tasks that hit a STOP/ESCALATE condition |
| **iterations / task** | build→gate→review→fix cycles per task (avg + per-task) |
| **testsAdded** | new test cases/files written (RED step) |
| **reviewFindings by severity** | running `{CRITICAL, HIGH, MED, LOW}` totals from Codex |
| **gatePassRate** | `gatePasses / (gatePasses + gateFails)` across all iterations |
| **budgetSpent** | `1 − budget.remaining()` at loop end (when a budget handle is provided) |

Healthy E1 targets (informational, not gates): avg iterations/task ≤ 2.0;
gatePassRate ≥ 0.6; CRITICAL findings = 0 at loop end; every queued task `done`.

---

## 4. STOP / ESCALATE conditions (halt new-task dispatch, surface to owner)

A loop **must not** silently skip or paper over these. On any trip it records
the escalation, stops popping new tasks, and yields for owner review.

| Condition | Trigger | Loop constant |
|---|---|---|
| **Max iterations exceeded** | a task runs `maxIterationsPerTask` (6) cycles without a rubric PASS | `maxIterationsPerTask` |
| **Repeated identical review finding** | the same top finding signature recurs `repeatedFindingStop` (2) times — the loop is spinning, not converging | `repeatedFindingStop` |
| **Build red N times** | `buildRedStopThreshold` (3) consecutive red gates on one task | `buildRedStopThreshold` |
| **Confirmed-CRITICAL at commit** | the active pre-commit hook blocks (exit 1) at commit time | hard stop (no bypass) |
| **Budget exhausted** | `budget.remaining() ≤ budgetFloor` (0.08) — stop popping new tasks | `budgetFloor` |
| **Dependency not on main** (khanak) | an external deepak engine/shell dep never lands within budget | wait-tick → yield |

**Never** resolve a STOP by `--no-verify`, by setting
`SAMAGRA_REVIEW_BREAKGLASS`, by deleting/weakening a test, or by lowering the
PASS threshold. Break-glass is **human-only, audited, exceptional**. A
confirmed-CRITICAL is fixed in-band and re-reviewed, or escalated — never bypassed.

> **Codex-down mid-run is NOT a wedge.** A Codex that errors / times out / is not
> on PATH *during a task* is **advisory allow** (never wedge): the loop logs the
> warning, takes the allow path **structurally** (a known-neutral review object,
> never reading undefined `findings`/`confirmedCritical`), and proceeds.
>
> **Startup codex-on-PATH preflight is MANDATORY.** Each loop's `run()` runs a
> `codex-preflight` step (`codex --version` / `where codex` / `CODEX_BIN`) BEFORE
> any task. If `codex` is absent the loop enters an explicit, logged,
> metrics-surfaced **advisory-only degraded** mode and ESCALATES the condition to
> the owner — a *missing* Codex exit-0 is **NOT** a clean review and must never be
> indistinguishable from one. (The loop end-summary carries `codexDegraded` +
> `advisoryAllows` so a degraded run is never mistaken for a reviewed one.)

---

## 5. Worked thresholds per task family (quick reference)

| Family | G2 coverage focus | G8 key constants |
|---|---|---|
| `lib/wm/geometry` | every clamp/cascade/wrap/tile branch | work-area `{8,36,vw-16,vh-122}`; cascade `+34/+30`; min `360×280`; tile `cols=⌈√n⌉,gap12` |
| `lib/wm/zorder` | non-min filter + empty/all-min | `INITIAL_Z=20`; `bump=z+1` |
| `lib/snake/engine` | death (wall/self, tail-exempt), grow, no-reverse, speed floor, food resample | `LEVELS`; `COLS=ROWS=19`; `+10`/food; `speed=max(floor,speed-dec)` |
| `lib/clock/*` | angles, drift-free elapsed, ring frac edge (total=0), day/night boundary | `secA=s*6`…; `RING_C=2π·110`; `PRESETS`; `ZONES`; `isNight=h<6||h>=19` |
| `lib/terminal/{parser,dispatch}` | every command class + unknown + each line-class | effects **returned**; prompt `devesh@samagra:~$` |
| `lib/notes/model` | CRUD + filters + title/wordCount fallbacks | seed ids `n1/n2`, `t1..t4` done flags `[F,F,T,F]` |
| `lib/persistence` | corrupt JSON, array-guard, missing key | `KEYS` 4 keys verbatim |
| serve seam (py) | SPA 404 on `api/`, 503 unbuilt, index when built, jinja gone | route declared LAST |
| visual residue | render-smoke + the one new predicate/hook/save call | (no proto constants — parity is human QA) |

---

## 6. SEPARATE human VISUAL-FIDELITY checklist  — explicitly OUTSIDE both loops

> Per spec §7.4 / §9 and division §4: **pixel & interaction parity is a human QA
> pass, owner-run (deepak), with `npm run dev` / a built `samagra serve` +
> Claude Preview / browser tools against the prototype + `screenshots/`.** It is
> run once per surface at/after the E1.26 boundary. It is **never** a loop
> completion signal, **never** counted in either agent's headless task total, and
> **never** unblocks a downstream task. The loops sign off "logic green, build
> green" — *never* "looks right".

Per-app pixel/interaction parity (human signs each row vs `screenshots/`):

- [ ] **E1.18 Aqua shell** — top bar **30px** (wordmark · active title · status pill · live clock); Dock bottom-center **radius 20** + hover lift; WindowFrame **radius 13**, left traffic-lights, **38px** title bar, double-click maximize; ContextMenu **width 216**; work-area framing `{8,36,vw-16,vh-122}`.
- [ ] **E1.19 Dashboard** — hero-stat layout, pipeline-bar density, board + recent-activity spacing.
- [ ] **E1.20 Settings** — Appearance / Device / Integration row styling; pill active vs needs-creds states.
- [ ] **E1.21 Terminal** — prompt rendering, line-class colors from `termPalette`, welcome banner.
- [ ] **E1.22 Clock** — hand sweep, ring depletion, chime, tab visuals.
- [ ] **E1.23 Notes/To-dos** — list/editor split, "● Autosaved" footer, filter chrome.
- [ ] **E1.24 Snake** — movement feel, speed ramp, death visuals, D-pad.
- [ ] **E1.25 Components** — Pill/Card/Chip/IconButton accent + spacing parity.

**Sign-off:** owner (deepak) records the pass per surface in `HANDOFF.md` /
`STATUS.html` at the E1 boundary. This is spec §10 item 9 ("Human sign-off,
separate from the loop").
