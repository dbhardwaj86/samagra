# SAMAGRA OS — Task Division: claude-deepak ⇄ claude-khanak

> **Status:** Documentation artifact (no code). Authored 2026-06-20. Companion to
> [`2026-06-20-samagra-os.md`](2026-06-20-samagra-os.md) (the phased TDD plan),
> [`../specs/2026-06-20-samagra-os-experience-design.md`](../specs/2026-06-20-samagra-os-experience-design.md)
> (§8 two-agent model), and [`../_research/samagra-os/repo.md`](../_research/samagra-os/repo.md)
> (§4 conflict-surface analysis).
>
> This doc is the **operational division of labor** for the two agent worktrees so their branches
> merge **without content conflict**. It refines the hypothesis in the task brief against the
> authoritative plan/spec/research and freezes: (1) a file-disjoint OWNERSHIP MAP, (2) the BLOCKING
> PREFIX that gates khanak, (3) the two ordered QUEUES, (4) the VISUAL-QA QUARANTINE, and
> (5) BALANCE + RATIONALE.

**Worktrees (confirmed, `repo.md` §1):** repo root `C:\SandBox\claude_box\TeachingOS` (branch
`main` @ `557e6a4`). deepak → `../samagra-deepak` (branch `agent/deepak`). khanak →
`../samagra-khanak` (branch `agent/khanak`). Both agent branches sit at `da9cab3` and **must
`git rebase main`** before any frontend work, so they share the bootstrap commit.

**Merge model — CONTINUOUS engine publication (not a single mid-stream merge).** deepak does **not**
hold all engines on `agent/deepak` until E1.26. Instead, deepak **merges each greened task to
`main` as it lands** (fast-forward where possible), and **khanak `git rebase main` before each of
her tasks** so the engines + shell her wrappers import are already present in her worktree. This is
required for correctness: every khanak app imports a deepak engine (`lib/clock/*`, `lib/notes`,
`lib/snake/*`, `lib/persistence`, `themes/`) and the shell (`shell/*`), so unless those files are on
`main` at khanak's rebase point her `tsc`/`npm run verify` fails with `Cannot find module`. The
practical sync points: after **E1.2** (bootstrap + contracts + frozen registry) khanak rebases and
can start **E1.25** once **E1.4** is also on `main`; after **E1.4/E1.10–E1.16/E1.18** land on `main`
khanak rebases again and her app wrappers (E1.22–E1.24) unblock. See §2 for the per-task gating and
§5 item 3 for the integration order. The advisory Codex hook is active in every worktree
(`core.hooksPath=.githooks` → `samagra review-staged`); blocks only confirmed-CRITICAL, never
wedges; **never `--no-verify`, never self-break-glass.**

This division is **E1-scoped** (the immediate build). E2/E3 owners are pre-assigned from the plan
skeletons in the appendix, expanded at each phase boundary.

---

## 1. OWNERSHIP MAP — file-disjoint partition

**Rule:** an agent only ever *creates/edits* files under its owned paths. It may *read (import)*
the other's exported types/stores/engines but **never writes them**. The single natural hot-spot —
`registry.ts` — is landed once by deepak in the prefix and **frozen for E1** (neither agent edits
it; lazy app imports resolve when the leaf file appears). No two branches ever stage the same path.

### deepak — substrate · chrome · stores · ALL pure engines · integration apps · serve seam

| Path (under `frontend/` unless noted) | Kind | Task(s) |
|---|---|---|
| `package.json`, `package-lock.json` | bootstrap (single author) | E1.1 |
| `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `.eslintrc.cjs` | bootstrap config | E1.1 |
| `src/main.tsx`, `src/App.tsx` (+ later assembled in E1.18), `src/test/setup.ts`, `src/App.test.tsx` | bootstrap shell stub | E1.1, E1.18 † |
| `.gitignore` (repo root) | node block | E1.1 |
| `src/types/contracts.ts` | **contract types** (frozen prefix) | E1.2 |
| `src/registry.ts` + `src/registry.test.ts` | **APPS/ORDER/MOBILE_FAVORITES** (frozen for E1) | E1.2 |
| `src/lib/persistence.ts` + `.test.ts` | pure persistence | E1.3 |
| `src/themes/index.ts` + `.test.ts` | THEMES token maps (aqua + fwd-compat) | E1.4 |
| `src/lib/wm/geometry.ts` + `.test.ts` | pure window geometry | E1.5 |
| `src/lib/wm/zorder.ts` + `.test.ts` | pure z-order | E1.6 |
| `src/stores/windowManager.ts` + `.test.ts`, `src/stores/theme.ts` + `.test.ts` | Zustand stores (thin over lib/wm) | E1.7 |
| `src/lib/terminal/parser.ts` + `.test.ts` | pure parser | E1.8 |
| `src/lib/terminal/dispatch.ts` + `.test.ts` | pure command engine (effects returned) | E1.9 |
| `src/lib/clock/analog.ts` + `.test.ts` | pure trig | E1.10 |
| `src/lib/clock/stopwatch.ts` + `.test.ts` | pure drift-free elapsed | E1.11 |
| `src/lib/clock/timer.ts` + `.test.ts` | pure ring/preset math | E1.12 |
| `src/lib/clock/world.ts` + `.test.ts` | pure zone/day-night | E1.13 |
| `src/lib/notes/model.ts` + `.test.ts` | pure note/todo CRUD + seed | E1.14 |
| `src/lib/snake/cell.ts` + `.test.ts` | pure cell-size formula | E1.15 |
| `src/lib/snake/engine.ts` + `.test.ts` | pure snake reducer (injected RNG) | E1.16 |
| `samagra/api/app.py` (repo), `tests/test_serve_seam.py` (repo) | FastAPI serve seam + SPA fallback | E1.17 |
| `src/shell/{TopBar,Dock,WindowFrame,ContextMenu}.tsx` + `*.test.tsx` | aqua chrome (thin) | E1.18 |
| `src/hooks/useApi.ts`, `src/apps/Dashboard/index.tsx` + `index.test.tsx` | Dashboard wrapper + API hook | E1.19 |
| `src/apps/Settings/index.tsx` + `index.test.tsx` | Settings wrapper | E1.20 |
| `src/apps/Terminal/index.tsx` + `index.test.tsx` | Terminal wrapper (effect runner) | E1.21 |
| `STATUS.html`, `SUMMARY.html`, `HANDOFF.md` (repo) | E1 boundary pointer sync | E1.26 |

### khanak — self-contained leaf apps (thin wrappers over deepak's tested engines) · shared UI · hooks

| Path (under `frontend/src/`) | Kind | Task(s) |
|---|---|---|
| `hooks/useInterval.ts` + `hooks/useInterval.test.ts` | cleanup-safe interval hook (own logic) | E1.22 |
| `apps/Clock/index.tsx` + `index.test.tsx` | Clock wrapper over `lib/clock/*` | E1.22 |
| `apps/Notes/index.tsx` + `index.test.tsx` | Notes/To-dos wrapper over `lib/notes` + `lib/persistence` | E1.23 |
| `apps/Snake/index.tsx` + `index.test.tsx` | Snake wrapper over `lib/snake/*` + keyboard gating | E1.24 |
| `components/{Pill,Card,Chip,IconButton}.tsx` + `*.test.tsx` | shared leaf UI primitives | E1.25 |

**Disjointness proof.** Every path above appears in exactly one column. The two columns share **no
file**. `hooks/` is owned **solely by khanak** (only `useInterval` and `useApi` exist in E1;
`useApi` is co-located under deepak's `apps/Dashboard` task as `src/hooks/useApi.ts` — the one
`hooks/` file deepak writes). To keep `hooks/` strictly disjoint, the ownership is **by file, not
by directory**: deepak owns `hooks/useApi.ts` (E1.19), khanak owns `hooks/useInterval.ts` (E1.22).
Neither writes the other's hook file. `registry.ts` is written once (E1.2, deepak) and frozen — no
second writer. This corrects the brief's "hooks/ = mixed": it is **file-split, never co-edited**.

> **† App.tsx assembly must use ONLY the registry's lazy imports — never a static import of a khanak
> app.** `App.tsx` (created E1.1, assembled E1.18) is the shell assembly point; it renders open
> windows by resolving `apps/<App>/index.tsx` through the **frozen `registry.ts` lazy imports**
> (`React.lazy(() => import(...))`), which resolve only when the leaf file exists at integration. It
> must **not** `import Clock from "./apps/Clock"` (or Notes/Snake) statically: a static import of a
> khanak-owned leaf would make deepak's `App.tsx` fail to compile on `agent/deepak` before khanak's
> files exist, reintroducing a cross-branch build dependency and breaking the disjointness/
> lazy-resolution invariant. deepak's own apps (Dashboard/Settings/Terminal) follow the same
> lazy-via-registry rule for symmetry. This is enforced by the schema-freeze rule and is the one
> place a stray static import would re-couple the branches.

---

## 2. BLOCKING PREFIX — what deepak lands FIRST to unblock khanak

The substrate every later file imports. deepak lands it on `agent/deepak`, merges to `main`; khanak
then `git rebase main` and is unblocked **to begin her first task (E1.25, once E1.4 is also on
`main`)**. **Until this prefix is on `main`, khanak writes nothing.**

> **Important — the {E1.1, E1.2} prefix unblocks khanak's FIRST task, not all four.** Under the
> continuous-merge model (header), each khanak app additionally requires the specific deepak
> engine(s) it wraps **plus the shell** to be on `main` at khanak's rebase point — because her
> wrapper files `import` those modules and `npm run verify` (tsc) fails if they are absent. So the
> set that gates *all* khanak work to completion is the full
> `{E1.1, E1.2, E1.3, E1.4, E1.10–E1.16, E1.18}`, published incrementally; `{E1.1, E1.2}` is merely
> the prefix that lets khanak *start* (with E1.4 → E1.25). The per-app gating is enumerated below
> and matches the `blockedBy` tags in the plan exactly.

The starting prefix is exactly two tasks:

| Task | Deliverable | Why it gates khanak |
|---|---|---|
| **E1.1** | `package.json` + `package-lock.json`, `vite.config.ts`, `tsconfig*`, `index.html`, `.eslintrc.cjs`, `main.tsx`/`App.tsx` stub, `test/setup.ts`, `.gitignore` node block | khanak `npm install`s against this lockfile and compiles/tests under this config. A second author of `package.json`/lockfile = guaranteed merge conflict. |
| **E1.2** | `src/types/contracts.ts` (the app-contract types: `AppId`, `AppMeta`, `WindowState`, `Theme`, `Device`, `Note`, `Todo`, `TodoFilter`, `LineClass`, `ApiClient`, `MIN_W/MIN_H`) + `src/registry.ts` (frozen 17-app `APPS`/`ORDER`/`MOBILE_FAVORITES`) | Every khanak file imports these types; the registry slots resolve khanak's `apps/<App>/index.tsx` lazy imports. After E1.2 commits, **`registry.ts` is frozen for E1.** |

**The published contract khanak builds against** is the union of E1.1 + E1.2 **plus the green,
exported engine modules khanak's apps wrap** — which deepak also owns and lands before khanak's app
tasks unblock (see the per-app `blockedBy` in §3): `lib/clock/*` (E1.10–E1.13) for Clock,
`lib/notes/model` (E1.14) + `lib/persistence` (E1.3) for Notes, `lib/snake/{cell,engine}`
(E1.15–E1.16) + `lib/persistence` (E1.3) for Snake, `themes/index` (E1.4) for components, and the
shell (E1.18) that hosts the app windows.

**Gating summary:** **E1.1 → E1.2** gate *all* khanak tasks (nothing khanak owns can start until
the bootstrap + contracts + frozen registry are on `main`). Beyond that, each khanak app is
additionally gated by the specific deepak engine(s) it wraps and by the shell:

- **E1.25 (components)** unblocks after **E1.2 + E1.4** (themes tokens).
- **E1.22 (Clock)** unblocks after **E1.10, E1.10b, E1.11, E1.12, E1.13, E1.18**.
- **E1.23 (Notes)** unblocks after **E1.14, E1.3, E1.18**.
- **E1.24 (Snake)** unblocks after **E1.16, E1.15, E1.3, E1.18**.

So the **minimum prefix to START khanak at all = {E1.1, E1.2}**, and the minimum to start her
*first real component work* (E1.25) = **{E1.1, E1.2, E1.4}** — but the set required for khanak to
*finish* all four tasks is the full **{E1.1, E1.2, E1.3, E1.4, E1.10–E1.16, E1.18}**, which deepak
publishes to `main` incrementally (continuous-merge model) and khanak picks up by re-rebasing
before each app wrapper. No khanak task is dispatched until the engine(s) it imports are on `main`.

---

## 3. TWO QUEUES — ordered task lists (respecting `blockedBy`)

Legend: **▶ unblocked from the start** (only deepak's bootstrap is, initially). All others wait on
their `blockedBy`. `H` = headless (loop-completable). `V` = visual (logic-smoke is looped; pixel
parity is quarantined — see §4).

### deepak queue (ordered)

> **Reordered for khanak utilization (resolves the load-imbalance finding):** the shell-enabling
> chain `E1.5 → E1.6 → E1.7 → E1.18` is pulled to the FRONT of deepak's queue (right after the
> themes prefix), so the shell lands at deepak position **#7** instead of #18. This unblocks
> khanak's three app wrappers as soon as their per-app engine also lands, rather than starving her
> loop until ~80% through deepak's queue. The "✦ publish" column marks every task deepak merges to
> `main` immediately on green (continuous-merge model); khanak re-rebases at each publish she needs.

| # | Task | verify | blockedBy | ✦ publish → `main` on green | Note |
|---|---|---|---|---|---|
| 1 | **E1.1** bootstrap scaffold + tooling + gitignore | H | none | ✦ | **▶ UNBLOCKED — the only task unblocked at t0** |
| 2 | **E1.2** contract types + frozen 17-app registry | H | E1.1 | ✦ | **khanak rebases here → can start once E1.4 lands** |
| 3 | **E1.4** `themes/` aqua + fwd-compat tokens | H | E1.2 | ✦ | **unblocks khanak E1.25** (her first task) |
| 4 | **E1.5** `lib/wm/geometry` | H | E1.4 | ✦ | pulled up — feeds stores → shell |
| 5 | **E1.6** `lib/wm/zorder` | H | E1.2 | ✦ | pulled up — feeds stores |
| 6 | **E1.7** WM + theme Zustand stores | H | E1.5, E1.6 | ✦ | pulled up — feeds shell |
| 7 | **E1.18** aqua shell chrome (TopBar/Dock/WindowFrame/ContextMenu) | V | E1.7, E1.4 | ✦ | **pulled up — unblocks ALL app wrappers (deepak + khanak)** |
| 8 | **E1.3** `lib/persistence` | H | E1.2 | ✦ | unblocks (with E1.14/E1.18) khanak Notes & Snake |
| 9 | **E1.10** `lib/clock/analog` | H | E1.2 | ✦ | unblocks (with 10–13 + shell) khanak Clock |
| 10 | **E1.11** `lib/clock/stopwatch` | H | E1.2 | ✦ | |
| 11 | **E1.12** `lib/clock/timer` | H | E1.2 | ✦ | |
| 12 | **E1.13** `lib/clock/world` | H | E1.2 | ✦ | with 9–11 + shell, khanak Clock (E1.22) unblocks |
| 13 | **E1.14** `lib/notes/model` | H | E1.3 | ✦ | with E1.3 + shell, khanak Notes (E1.23) unblocks |
| 14 | **E1.15** `lib/snake/cell` | H | E1.2 | ✦ | |
| 15 | **E1.16** `lib/snake/engine` | H | E1.15 | ✦ | with E1.15 + E1.3 + shell, khanak Snake (E1.24) unblocks |
| 16 | **E1.8** `lib/terminal/parser` | H | E1.2 | ✦ | |
| 17 | **E1.9** `lib/terminal/dispatch` | H | E1.8 | ✦ | |
| 18 | **E1.17** FastAPI serve seam (Python) | H | E1.1 | ✦ | independent of the lib chain; any time after E1.1 |
| 19 | **E1.19** Dashboard + `useApi` | V | E1.18 | ✦ | |
| 20 | **E1.20** Settings | V | E1.18 | ✦ | |
| 21 | **E1.21** Terminal (effect runner) | V | E1.9, E1.18 | ✦ | |
| 22 | **E1.26** E1 green gate + pointer-file sync | H | E1.17–E1.25 (all) | — | final gate; both branches already converged on `main` |

**deepak count:** **22 tasks** (E1.1–E1.21 minus the three khanak-owned app tasks E1.22–E1.24 and
the khanak components task E1.25, plus the boundary gate E1.26). Headless: **18** (E1.1–E1.17 =
17, + E1.26 = 18). Visual: **4** (E1.18, E1.19, E1.20, E1.21).

### khanak queue (ordered)

Each khanak task is preceded by a `git rebase main` so the engines it imports are present before
`npm run verify` runs. The "rebase after" column names the deepak publish that must be on `main`
first.

| # | Task | verify | blockedBy | rebase after (on `main`) | Note |
|---|---|---|---|---|---|
| — | *(blocked at t0 — waits for deepak E1.1→E1.2 on `main`, then `git rebase main`)* | | | | |
| 1 | **E1.25** shared leaf components (Pill/Card/Chip/IconButton) | V | E1.4 | E1.4 | earliest khanak start (needs only themes tokens) |
| 2 | **E1.22** Clock wrapper + `useInterval` | V | E1.10, E1.10b, E1.11, E1.12, E1.13, E1.18 | E1.10–E1.13 (+E1.10b) + E1.18 | rebase picks up clock engines + shell |
| 3 | **E1.23** Notes/To-dos wrapper | V | E1.14, E1.3, E1.18 | E1.3, E1.14 + E1.18 | rebase picks up notes model + persistence + shell |
| 4 | **E1.24** Snake wrapper + keyboard gating | V | E1.16, E1.15, E1.3, E1.18 | E1.3, E1.15, E1.16 + E1.18 | rebase picks up snake engines + persistence + shell |

**khanak count:** **4 tasks.** Headless: **0 standalone** (every khanak task is `visual`, but each
carries a *headless* logic-smoke sub-test that IS looped — see §5). Visual: **4** (E1.22–E1.25).

> **Note on E1.25 ordering:** components depend only on `themes/` (E1.4), which lands early in
> deepak's reordered queue (#3) and is published to `main` immediately. So khanak can begin E1.25
> well before the shell exists — it is her natural first task after the first rebase, filling the
> wait until the clock/notes/snake engines + shell are green and on `main`. **E1.25 is genuinely
> startable here because `themes/index.ts` IS on `main` at this rebase point** (the earlier draft's
> claim that it could start "after the rebase" was only true once E1.4 had been published — which
> the continuous-merge model now guarantees). With the shell pulled to deepak #7, the three app
> wrappers (E1.22–E1.24) follow shortly after, each gated on its own engine publish + the shell, so
> khanak's loop has a backlog (E1.25 first, then the apps) instead of idling.

---

## 4. VISUAL-QA QUARANTINE — pulled OUT of both autonomous loops

Per spec §7.4 and §9, **pixel/interaction fidelity is a separate human QA pass, owner-run
(deepak), with preview tools — NOT in either agent loop.** The loops gate ONLY on the four headless
checks (`npm run verify` = lint → tsc → vitest → build, plus `pytest -q` for Python). A loop NEVER
claims "looks right"; only "logic green, build green."

**Quarantined visual-fidelity items (the pixel/interaction parity of these tasks — done by the
owner with `npm run dev` / a built `samagra serve` + Claude Preview / browser tools against the
prototype + `screenshots/`):**

| Task | App / surface | What the human signs off (NOT looped) |
|---|---|---|
| **E1.18** | Aqua shell chrome | Top bar 30px, Dock radius 20 + hover lift, window frame radius 13 + left traffic-lights + 38px title bar, context menu width 216, work-area framing |
| **E1.19** | Dashboard | Hero-stat layout, pipeline-bar density, board + activity spacing |
| **E1.20** | Settings | Appearance/Device/Integration row styling, pill states |
| **E1.21** | Terminal | Prompt rendering, line-class colors from `termPalette`, banner |
| **E1.22** | Clock | Hand sweep, ring depletion, chime, tab visuals |
| **E1.23** | Notes/To-dos | List/editor split, "● Autosaved" footer, filter chrome |
| **E1.24** | Snake | Movement feel, speed ramp, death visuals, D-pad |
| **E1.25** | Leaf components | Pill/Card/Chip/IconButton accent + spacing parity |

**Owner of the quarantine pass: deepak** (CEO/integration), run once per surface at/after the
E1.26 boundary. This is spec §10 item 9 ("Human sign-off, separate from the loop") — it is **not**
a blocker for any loop task's completion and **not** counted in either agent's headless task total.

> The **headless residue** of E1.18–E1.25 (RTL render-smoke + store-action + gating-predicate +
> fake-timer tests) **stays in the loop** — those are deterministic and ARE the loop's done-signal
> for these tasks. Only the *pixel/interaction* judgment is quarantined.

---

## 5. BALANCE + RATIONALE

### Headless task counts

| Agent | Total E1 tasks | Pure-headless (`[verify: headless]`) | Visual (`[verify: visual]`, looped on logic-smoke only) |
|---|---|---|---|
| **deepak** | 22 | **18** (E1.1–E1.17, E1.26) | 4 (E1.18–E1.21) |
| **khanak** | 4 | **0 pure** — but every task carries a looped headless sub-test | 4 (E1.22–E1.25) |

deepak carries the overwhelming majority of headless, fully-loop-gated work (all 16 pure `lib/**`
engines + their Vitest specs, both stores, the registry, persistence, themes, and the Python serve
seam). khanak carries a small, tight set of thin wrappers.

### Why khanak gets the maximally-pure/testable *leaf* logic (and why the split is balanced despite the lopsided count)

1. **The LINCHPIN puts the hard logic in `lib/**`, and `lib/**` is deepak's.** Window clamp math,
   snake death/grow/no-reverse, drift-free stopwatch, terminal dispatch, notes seed/derivations,
   and localStorage parse guards are exactly the bug-prone code that benefits most from red-green
   TDD — and exactly what a loop can verify without a human looking at pixels. Centralizing it under
   one owner (deepak = "substrate") means it is authored + tested **once**, and khanak imports it
   rather than reimplementing it. That is what makes khanak's files thin wrappers, which is what
   makes the two branches file-disjoint.

2. **khanak's tasks are the *self-contained interactive leaf apps* (Clock/Notes/Snake) — the leaves
   of the dependency DAG.** Their entire hard logic is already green in deepak's `lib/` before
   khanak's wrapper unblocks (see the `blockedBy` chains in §3). So khanak's *new* logic is minimal
   and maximally isolated: `useInterval` hygiene (fake-timer test), a `save()`-on-mutation
   assertion (mocked storage), an `isSnakeActive` keyboard-gating predicate (headless), and a
   theme-accent prop on the leaf components. Each of those IS a deterministic, looped headless
   sub-test — the leaf logic khanak owns is the *most* purely-testable residue precisely because
   everything beneath it is already proven.

3. **Conflict surface is minimized.** deepak owns every shared substrate file (config, lockfile,
   contracts, registry, stores, themes) — the files a second author would collide on. khanak only
   ever creates brand-new leaf files (`apps/Clock`, `apps/Notes`, `apps/Snake`, `components/*`,
   `hooks/useInterval`). There is **no path both write**, so the merge is mechanical (no content
   conflict in either direction).

   **Integration order — deepak's engines are ALREADY on `main` before khanak merges (continuous
   model), so the order is deepak-first, never khanak-first.** Under the continuous-merge model
   every engine/shell deepak builds is fast-forwarded to `main` as it greens, and khanak rebases on
   top before each app — so by the time khanak's last wrapper is done, her branch is already based
   on a `main` that contains all the engines she imports, and her merge is a trivial fast-forward of
   leaf files. `main` is **never red between merges**: each khanak app was genuinely green on
   `agent/khanak` (its imported engines were on her base at verify time), and merging it adds only
   new leaf files that resolve cleanly. **This corrects the earlier `agent/khanak`→`main` then
   `agent/deepak`→`main` ordering**, which would have made `main` reference not-yet-merged engines
   and broken `npm run verify` on the intermediate `main` — and would have meant khanak's per-task
   loop gate could never have passed in isolation. If, for some reason, the continuous model is
   abandoned and engines are held on `agent/deepak`, then the order MUST be **`agent/deepak` → `main`
   FIRST** (all engines/shell land), **then `agent/khanak` → `main`** — never the reverse.

4. **Parallelism is real, and the DAG (not just the narrative) was rebalanced to make it so.** Task
   *count* is lopsided (22 vs 4), but the gating constraint is the `blockedBy` chain, not task
   weight — so two concrete DAG changes were made rather than merely asserting balance:
   - **(a) Shell pulled forward.** `E1.5→E1.6→E1.7→E1.18` now sits at deepak positions **#4–#7**
     (was #16–#18). Since three of khanak's four tasks are gated on the shell (E1.18), this is what
     actually unblocks her app wrappers early instead of at ~80% through deepak's queue.
   - **(b) Continuous engine publication** (header + §2): each engine khanak imports is on `main`
     the moment it greens, so khanak's `blockedBy` items become *reachable as they land* — her loop
     is never idle waiting on unmerged commits.

   **Expected concurrent wall-clock (rough):** khanak's E1.25 starts after deepak #3 (E1.4) and runs
   alongside deepak #4–#7. The shell (deepak #7) plus the first clock engines (#9–#12) unblock
   khanak's Clock; Notes/Snake follow as #13/#14–#15 publish. So from roughly deepak-#3 onward the
   two loops overlap continuously, and khanak's four tasks interleave with deepak's #4–#21 rather
   than bunching after #18. khanak's loop still has fewer items, but it is **busy across the bulk of
   deepak's queue**, not starved until the end. The remaining imbalance (khanak idle only during
   deepak #1–#3, the unavoidable bootstrap/contracts/themes prefix) is intrinsic to the dependency
   structure, not the division. The brief's hypothesis is therefore
   adopted essentially verbatim — khanak = `apps/{clock,notes,snake}` + their wrappers' looped
   logic + `components/**` + `hooks/useInterval`; deepak = bootstrap + contracts + all `lib/**` +
   `stores/**` + `shell/**` + `themes/**` + `apps/{dashboard,settings,terminal}` + serve seam — with
   the one refinement that `hooks/` is **file-split** (deepak `useApi`, khanak `useInterval`) rather
   than "mixed", preserving strict file-disjointness.

### E2/E3 forward-assignment (from plan skeletons — for continuity, not part of the E1 division)

- **E2 deepak:** E2.1 `org.py`+`/api/org`, E2.2 Org Chart, E2.3 Pipelines, E2.7 Lectures, E2.11
  mycontentdev, E2.12 Munshi, E2.13 gate. **E2 khanak:** E2.4 Assignments kanban, E2.5 Activity,
  E2.6 Questions, E2.8 Booklets, E2.9 INSP, E2.10 Simulations.
- **E3 deepak:** E3.1 surface tokens, E3.2 console chrome, E3.3 samagra chrome, E3.5 mobile-WM
  tests, E3.7 gate. **E3 khanak:** E3.4 mobile frame + grid. **E3.6** re-skin = both (append-only,
  one-app-per-PR).

`registry.ts` stays frozen in E1; E2/E3 edits to it are **append-only, one-app-per-PR**, the only
coordinated touch of a shared file after the prefix.
