// =============================================================================
// SAMAGRA OS · E1 · claude-deepak autonomous build loop  (Workflow script)
// =============================================================================
//
// HOW TO LAUNCH (do NOT launch from this doc tree — launch later, inside the
// deepak worktree, once the worktrees + plan are ready):
//
//   1. cd ../samagra-deepak              # worktree for branch agent/deepak
//   2. git rebase main                   # share the bootstrap commit base
//   3. Run this file as a Workflow script:
//        scriptPath: docs/superpowers/loops/deepak-loop.js
//      with cwd = ../samagra-deepak  (the agent's own git worktree).
//
// WHAT IT DOES: iterates deepak's ordered, dependency-respecting E1 queue
// (bootstrap → contracts/registry → all pure lib/** engines → stores → serve
// seam → aqua shell + Dashboard/Settings/Terminal wrappers → E1.26 gate). For
// each task it runs the per-task loop: TDD (write failing test → implement →
// green) → GATE (`npm run verify` = lint→tsc→vitest→build, plus `pytest -q`
// for Python tasks) → CODEX REVIEW (`samagra review-staged`, parse verdict) →
// ITERATE against docs/superpowers/loops/RUBRIC.md until the rubric PASSes and
// no confirmed-CRITICAL remains → COMMIT (the active core.hooksPath gate re-runs
// Codex). Then it records metrics, marks the task done, and pops the next
// UNBLOCKED task. Loops until the queue drains, a STOP/ESCALATE condition trips,
// or the budget is exhausted.
//
// VISUAL TASKS ARE EXCLUDED FROM LOOP COMPLETION: E1.18–E1.21 are tagged
// `visual`. The loop runs ONLY their headless residue (RTL render-smoke +
// store-action + effect-runner tests, all inside `npm run verify`). Pixel /
// interaction parity vs the prototype + screenshots/ is a SEPARATE human QA
// pass (owner = deepak), done with preview tools after E1.26 — it is NEVER a
// loop done-signal. See RUBRIC.md §"Human visual-fidelity checklist".
//
// SAFETY: never `--no-verify`; never self-break-glass (never set
// SAMAGRA_REVIEW_BREAKGLASS); a confirmed-CRITICAL is a hard stop, not a thing
// to bypass. A Codex that is down/absent → advisory allow (never wedge the loop).
// No Date.now()/Math.random()/new Date() anywhere (Workflow determinism rule);
// all time/budget come from the injected `budget` handle.
// =============================================================================

export const meta = {
  name: "samagra-os-e1-deepak-loop",
  description:
    "Autonomous TDD build loop for claude-deepak's E1 queue: substrate, all pure lib/** engines, Zustand stores, FastAPI serve seam, aqua shell + Dashboard/Settings/Terminal wrappers, and the E1 boundary gate. Headless-gated (vitest/tsc/build/eslint + pytest) with the advisory Codex review; visual pixel parity is excluded.",
  agent: "claude-deepak",
  worktree: "../samagra-deepak",
  branch: "agent/deepak",
  phases: [
    "bootstrap-prefix",
    "pure-engines",
    "stores-and-serve-seam",
    "shell-and-apps",
    "boundary-gate",
  ],
};

// ---------------------------------------------------------------------------
// Tunables (pure literals — no runtime clock/random).
// ---------------------------------------------------------------------------
const CONFIG = {
  maxIterationsPerTask: 6, // hard cap on build→gate→review→fix cycles per task
  buildRedStopThreshold: 3, // N consecutive red gates on one task → ESCALATE
  repeatedFindingStop: 2, // same review finding signature N times → ESCALATE
  rubricPassThreshold: 85, // 0–100; from RUBRIC.md
  budgetFloor: 0.08, // stop popping new tasks when remaining() <= this fraction
  maxTaskDispatches: 80, // hard ceiling on total task dispatches (outer-loop re-entry guard)
  repoRoot: "C:/SandBox/claude_box/TeachingOS",
  frontendDir: "frontend",
  venvPytest: ".venv/Scripts/python -m pytest -q",
  verifyCmd: "npm run verify", // lint → tsc → vitest → build (fail-fast)
  covCmd: "npm run test:cov", // vitest run --coverage — measures per-module branch coverage
  covTargetLib: 90, // G2: ≥90% branch on pure lib/** modules under test
  covTargetWrapper: 70, // G2: ≥70% branch on thin wrappers (residue only)
  reviewDryRun: ".venv/Scripts/python -m samagra review-staged",
  coAuthor: "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>",
};

// ---------------------------------------------------------------------------
// deepak's E1 task queue — ids + titles + paths + EXACT test+gate commands.
// `kind`: "headless" = fully loop-gated. "visual" = looped on headless residue
//         only (pixel parity quarantined to human QA).
// `lang`: "ts" → `npm run verify` is the gate; "py" → pytest; "mixed" → both.
// `selector`: the narrowed `npm test -- <selector>` for the RED/GREEN inner loop.
// `blockedBy`: task ids that must be done before this can start.
// `commit`: the conventional-commit subject (trailer appended automatically).
// Ordered to respect blockedBy (see plan §Appendix DAG + division §3).
// ---------------------------------------------------------------------------
const QUEUE = [
  {
    id: "E1.1",
    title: "Frontend bootstrap scaffold + FastAPI-serve config + tooling",
    kind: "headless",
    lang: "ts",
    tdd: false, // verification-driven (npm install + smoke verify)
    blockedBy: [],
    files: [
      "frontend/package.json",
      "frontend/package-lock.json",
      "frontend/vite.config.ts",
      "frontend/tsconfig.json",
      "frontend/tsconfig.node.json",
      "frontend/index.html",
      "frontend/.eslintrc.cjs",
      "frontend/src/main.tsx",
      "frontend/src/App.tsx",
      "frontend/src/App.test.tsx",
      "frontend/src/test/setup.ts",
      ".gitignore",
    ],
    setup: "cd frontend && npm install",
    selector: "App",
    gate: "verify",
    commit:
      "feat(frontend): bootstrap React+TS+Vite app + tooling + gitignore node block",
    note: "the only task unblocked at t0; lands first then merges to main",
  },
  {
    id: "E1.2",
    title: "App-contract types + frozen 17-app registry (proto values)",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.1"],
    files: [
      "frontend/src/types/contracts.ts",
      "frontend/src/registry.ts",
      "frontend/src/registry.test.ts",
    ],
    selector: "registry",
    gate: "verify",
    commit:
      "feat(frontend): app-contract types + frozen 17-app registry (proto values)",
    note: "MERGE GATE — after this, merge agent/deepak → main so khanak can rebase",
    mergePoint: true,
  },
  {
    id: "E1.3",
    title: "lib/persistence localStorage layer + defensive parse",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.2"],
    files: [
      "frontend/src/lib/persistence.ts",
      "frontend/src/lib/persistence.test.ts",
    ],
    selector: "persistence",
    gate: "verify",
    commit:
      "feat(frontend): persistence localStorage layer + defensive parse (pure TS)",
  },
  {
    id: "E1.4",
    title: "themes/ aqua token map + console/samagra forward-compat",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.2"],
    files: ["frontend/src/themes/index.ts", "frontend/src/themes/index.test.ts"],
    selector: "themes",
    gate: "verify",
    commit:
      "feat(themes): aqua token map (E1) + console/samagra forward-compat tokens",
    note: "unblocks khanak E1.25 (components)",
  },
  {
    id: "E1.6",
    title: "lib/wm/zorder — monotonic z + focus + active rule",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.2"],
    files: [
      "frontend/src/lib/wm/zorder.ts",
      "frontend/src/lib/wm/zorder.test.ts",
    ],
    selector: "zorder",
    gate: "verify",
    commit: "feat(wm): z-order counter + focus + active-window rule (pure TS)",
  },
  {
    id: "E1.8",
    title: "lib/terminal/parser — tokenize c0/args/arg/clear/empty",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.2"],
    files: [
      "frontend/src/lib/terminal/parser.ts",
      "frontend/src/lib/terminal/parser.test.ts",
    ],
    selector: "parser",
    gate: "verify",
    commit: "feat(terminal): command-line parser (pure TS)",
  },
  {
    id: "E1.5",
    title: "lib/wm/geometry — workArea/openRect/clamp/maximize/reclamp/tile",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.4"],
    files: [
      "frontend/src/lib/wm/geometry.ts",
      "frontend/src/lib/wm/geometry.test.ts",
    ],
    selector: "geometry",
    gate: "verify",
    commit:
      "feat(wm): work-area/openRect/clamp/maximize/reclamp/tile geometry (pure TS)",
    note: "highest-value TDD task; consumes aqua chrome constants from themes",
  },
  {
    id: "E1.9",
    title: "lib/terminal/dispatch — command engine returning effect intents",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.8"],
    files: [
      "frontend/src/lib/terminal/dispatch.ts",
      "frontend/src/lib/terminal/dispatch.test.ts",
    ],
    selector: "dispatch",
    gate: "verify",
    commit:
      "feat(terminal): command dispatch table returning effect intents (pure TS)",
  },
  {
    id: "E1.10",
    title: "lib/clock/analog — hand angles + face geometry",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.2"],
    files: [
      "frontend/src/lib/clock/analog.ts",
      "frontend/src/lib/clock/analog.test.ts",
    ],
    selector: "analog",
    gate: "verify",
    commit: "feat(clock): analog hand angles + face geometry (pure TS)",
    note: "with E1.11–E1.13 unblocks khanak Clock",
  },
  {
    id: "E1.11",
    title: "lib/clock/stopwatch — drift-free elapsed + laps + fmtMs",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.2"],
    files: [
      "frontend/src/lib/clock/stopwatch.ts",
      "frontend/src/lib/clock/stopwatch.test.ts",
    ],
    selector: "stopwatch",
    gate: "verify",
    commit:
      "feat(clock): drift-free stopwatch elapsed + laps + fmtMs (pure TS)",
  },
  {
    id: "E1.12",
    title: "lib/clock/timer — remaining + ring math + presets + done",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.2"],
    files: [
      "frontend/src/lib/clock/timer.ts",
      "frontend/src/lib/clock/timer.test.ts",
    ],
    selector: "clock/timer",
    gate: "verify",
    commit:
      "feat(clock): timer remaining + ring offset + presets + done (pure TS)",
  },
  {
    id: "E1.13",
    title: "lib/clock/world — zone table + day/night rule",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.2"],
    files: [
      "frontend/src/lib/clock/world.ts",
      "frontend/src/lib/clock/world.test.ts",
    ],
    selector: "clock/world",
    gate: "verify",
    commit: "feat(clock): world-clock zone table + day/night rule (pure TS)",
  },
  {
    id: "E1.14",
    title: "lib/notes/model — note/todo CRUD + derivations + seed",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.3"],
    files: [
      "frontend/src/lib/notes/model.ts",
      "frontend/src/lib/notes/model.test.ts",
    ],
    selector: "notes/model",
    gate: "verify",
    commit:
      "feat(notes): note/todo model — CRUD, derivations, seed (pure TS)",
    note: "unblocks khanak Notes",
  },
  {
    id: "E1.15",
    title: "lib/snake/cell — responsive cell-size formula",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.2"],
    files: [
      "frontend/src/lib/snake/cell.ts",
      "frontend/src/lib/snake/cell.test.ts",
    ],
    selector: "snake/cell",
    gate: "verify",
    commit: "feat(snake): responsive cell-size + board-px formula (pure TS)",
  },
  {
    id: "E1.16",
    title: "lib/snake/engine — init/dir/step reducer with injected RNG",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.15"],
    files: [
      "frontend/src/lib/snake/engine.ts",
      "frontend/src/lib/snake/engine.test.ts",
    ],
    selector: "snake/engine",
    gate: "verify",
    commit:
      "feat(snake): engine reducer — init/dir/step/food with injected RNG (pure TS)",
    note: "unblocks khanak Snake",
  },
  {
    id: "E1.7",
    title: "WM + theme Zustand stores (thin over lib/wm)",
    kind: "headless",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.5", "E1.6"],
    files: [
      "frontend/src/stores/windowManager.ts",
      "frontend/src/stores/windowManager.test.ts",
      "frontend/src/stores/theme.ts",
      "frontend/src/stores/theme.test.ts",
    ],
    selector: "windowManager theme",
    gate: "verify",
    commit:
      "feat(os): windowManager + theme Zustand stores (thin over lib/wm)",
  },
  {
    id: "E1.17",
    title: "FastAPI serve seam — retire jinja, serve dist/, SPA fallback",
    kind: "headless",
    lang: "py",
    tdd: true,
    blockedBy: ["E1.1"],
    files: ["samagra/api/app.py", "tests/test_serve_seam.py", ".gitignore"],
    selector: "tests/test_serve_seam.py",
    gate: "pytest",
    commit:
      "feat(api): serve Vite dist/ with SPA fallback; retire jinja portal route",
    note: "Python task — gate is pytest, not npm verify; independent of the lib chain",
  },
  {
    id: "E1.18",
    title: "Aqua shell chrome — TopBar/Dock/WindowFrame/ContextMenu",
    kind: "visual",
    lang: "ts",
    tdd: true, // RTL render-smoke + dock-click-dispatches-openApp (headless residue)
    blockedBy: ["E1.7", "E1.4"],
    files: [
      "frontend/src/shell/TopBar.tsx",
      "frontend/src/shell/Dock.tsx",
      "frontend/src/shell/WindowFrame.tsx",
      "frontend/src/shell/ContextMenu.tsx",
      "frontend/src/shell/TopBar.test.tsx",
      "frontend/src/shell/Dock.test.tsx",
      "frontend/src/shell/WindowFrame.test.tsx",
      "frontend/src/shell/ContextMenu.test.tsx",
      "frontend/src/App.tsx",
    ],
    selector: "shell",
    gate: "verify",
    commit:
      "feat(shell): aqua chrome — top bar, dock, window frame, context menu",
    note: "unblocks ALL app wrappers (deepak + khanak); pixel parity = human QA",
    visualResidue:
      "RTL: each chrome component renders; a Dock icon click dispatches openApp",
  },
  {
    id: "E1.19",
    title: "Dashboard app + /api data hook (useApi)",
    kind: "visual",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.18"],
    files: [
      "frontend/src/hooks/useApi.ts",
      "frontend/src/apps/Dashboard/index.tsx",
      "frontend/src/apps/Dashboard/index.test.tsx",
    ],
    selector: "Dashboard",
    gate: "verify",
    commit: "feat(apps): Dashboard app + typed /api data hook",
    visualResidue:
      "RTL: mock fetch → canned /api/overview; a hero stat renders",
  },
  {
    id: "E1.20",
    title: "Settings app — appearance + device + integrations",
    kind: "visual",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.18"],
    files: [
      "frontend/src/apps/Settings/index.tsx",
      "frontend/src/apps/Settings/index.test.tsx",
    ],
    selector: "Settings",
    gate: "verify",
    commit: "feat(apps): Settings — appearance, device, integration rows",
    visualResidue:
      "RTL: clicking the console theme radio calls setTheme('console')",
  },
  {
    id: "E1.21",
    title: "Terminal app — thin wrapper over lib/terminal (effect runner)",
    kind: "visual",
    lang: "ts",
    tdd: true,
    blockedBy: ["E1.9", "E1.18"],
    files: [
      "frontend/src/apps/Terminal/index.tsx",
      "frontend/src/apps/Terminal/index.test.tsx",
    ],
    selector: "Terminal",
    gate: "verify",
    commit: "feat(apps): Terminal wrapper — render lines + run effect intents",
    visualResidue:
      "RTL: submit `open snake` → WM store gains a snake window (mocked store)",
  },
  {
    id: "E1.26",
    title: "E1 green gate + pointer-file sync",
    kind: "headless",
    lang: "mixed",
    tdd: false, // verification-driven: full gate + docs, no new feature files
    blockedBy: [
      "E1.17",
      "E1.18",
      "E1.19",
      "E1.20",
      "E1.21",
      "E1.22",
      "E1.23",
      "E1.24",
      "E1.25",
    ],
    files: ["STATUS.html", "SUMMARY.html", "HANDOFF.md"],
    selector: null,
    gate: "both",
    commit:
      "docs(status): E1 shell + aqua + OS utilities SHIPPED — sync pointer files",
    note: "integrate both branches → main (khanak first, then deepak), final full gate",
    integration: true,
  },
];

// ---------------------------------------------------------------------------
// Per-task inner loop: TDD → GATE → CODEX REVIEW → ITERATE → COMMIT.
// Returns a metrics record for the task.
// ---------------------------------------------------------------------------
async function runTask(task, budget, metrics, degraded) {
  log(`▶ TASK ${task.id} [${task.kind}/${task.lang}] — ${task.title}`);
  if (task.visualResidue) {
    log(
      `  (visual task — looped on headless residue only: ${task.visualResidue}; pixel parity → human QA)`,
    );
  }

  const rec = {
    id: task.id,
    kind: task.kind,
    iterations: 0,
    testsAdded: 0,
    gatePasses: 0,
    gateFails: 0,
    consecutiveGateFails: 0,
    reviewFindings: { CRITICAL: 0, HIGH: 0, MED: 0, LOW: 0 },
    lastFindingSignature: null,
    repeatedFindingCount: 0,
    rubricScore: 0,
    status: "pending",
    escalation: null,
  };

  // ---- TDD bootstrap: write the failing test first (RED), unless verification-driven.
  if (task.tdd) {
    await phase(`${task.id}:red`, async () => {
      log(`  RED — write failing ${task.selector} test from the plan, run, expect FAIL`);
      const t = await agent("claude-deepak", {
        intent: "write-failing-test",
        task,
        rubric: "docs/superpowers/loops/RUBRIC.md",
        innerTest: gateInnerTestCmd(task),
        instructions: [
          "Paste the exact failing test from the plan task body (proto.md constants verbatim).",
          "Run the narrowed selector and CONFIRM it fails with the named error before implementing.",
          "Do not write production code in this phase.",
        ],
      });
      rec.testsAdded += t.testsAdded || 1;
    });
  } else {
    log(`  (verification-driven — scaffold/docs/gate task; no red-green pair)`);
    if (task.setup) {
      await phase(`${task.id}:setup`, async () => {
        log(`  SETUP — ${task.setup}`);
        await agent("claude-deepak", { intent: "run-setup", task, cmd: task.setup });
      });
    }
  }

  // ---- ITERATE: build → gate → review → fix, capped + budget-guarded.
  // Guard the inner loop on BOTH the hard per-task iteration cap AND the budget
  // floor. budget.remaining() is always honored against the floor (the defensive
  // default — see run() — supplies a sane ceiling so a null/0 token target can
  // never disable the guard). `maxIterationsPerTask` is the hard re-entry ceiling.
  let passed = false;
  while (
    rec.iterations < CONFIG.maxIterationsPerTask &&
    budget.remaining() > CONFIG.budgetFloor
  ) {
    rec.iterations += 1;
    log(`  ── iteration ${rec.iterations}/${CONFIG.maxIterationsPerTask} ──`);

    // (a) GREEN: implement the minimum to satisfy the test(s) / scaffold.
    await phase(`${task.id}:green#${rec.iterations}`, async () => {
      await agent("claude-deepak", {
        intent: task.tdd ? "implement-to-green" : "scaffold",
        task,
        innerTest: gateInnerTestCmd(task),
        instructions: [
          "Implement the minimum to make the narrowed test pass.",
          "Keep React components thin; push real behavior into the pure lib/** module.",
          "Re-run the narrowed selector; expect PASS before gating.",
        ],
      });
    });

    // (b) GATE: full headless verify (lint→tsc→vitest→build) and/or pytest,
    // PLUS a coverage gate (`npm run test:cov`) for TS tasks. The gate is GREEN
    // only when verify is green AND per-module branch coverage clears the target
    // (90 lib / 70 wrapper). A missing/low coverage signal is treated as BELOW
    // threshold so the loop iterates rather than passing a tautological green.
    const gate = await phase(`${task.id}:gate#${rec.iterations}`, async () => {
      log(`  GATE — ${describeGate(task)}`);
      const g = await agent("claude-deepak", {
        intent: "run-gate",
        task,
        cmds: gateCmds(task),
        coverageCmd: coverageCmd(task),
        coverageTarget: coverageTarget(task),
        diffCheck: "no .only/.skip in the staged diff",
        expect: "all green; per-module branch coverage ≥ target; no .only/.skip",
      });
      g.coverageTarget = coverageTarget(task);
      // Treat an absent coverage signal on a coverage-bearing task as BELOW target.
      if (coverageCmd(task) && g.branchCoverage == null) g.branchCoverage = 0;
      return g;
    });

    const covOk = !coverageCmd(task) || (gate.branchCoverage != null &&
      gate.branchCoverage >= coverageTarget(task));
    if (!gate.green || !covOk) {
      rec.gateFails += 1;
      rec.consecutiveGateFails += 1;
      const why = !gate.green
        ? gate.failingStage || "unknown stage"
        : `branch coverage ${gate.branchCoverage}% < ${coverageTarget(task)}%`;
      log(`  ✗ GATE RED (${why})`);
      if (rec.consecutiveGateFails >= CONFIG.buildRedStopThreshold) {
        rec.status = "escalated";
        rec.escalation = `gate red ${rec.consecutiveGateFails}x on ${task.id} (${why})`;
        log(`  ⛔ ESCALATE — ${rec.escalation}`);
        return rec;
      }
      continue; // back to GREEN with the failure context
    }
    rec.gatePasses += 1;
    rec.consecutiveGateFails = 0;
    log(`  ✓ GATE GREEN (branch coverage ${gate.branchCoverage == null ? "n/a" : gate.branchCoverage + "%"})`);

    // (c) CODEX REVIEW: stage the diff, dry-run the advisory gate, parse verdict.
    const review = await phase(`${task.id}:review#${rec.iterations}`, async () => {
      log(`  CODEX REVIEW — git add ${task.files.join(" ")} ; ${CONFIG.reviewDryRun}`);
      return await agent("claude-deepak", {
        intent: "codex-review-staged",
        task,
        stage: task.files,
        cmd: CONFIG.reviewDryRun,
        note: "exit 0 = clean | exit 1 = confirmed-CRITICAL (hard stop) | Codex down = advisory allow, NEVER wedge",
      });
    });

    // Codex-down-doesn't-wedge: transient/absent → advisory ALLOW. Take the
    // allow path STRUCTURALLY (mirror precommit.py never-wedge): substitute a
    // known-neutral review object so the confirmedCritical / repeated-finding /
    // findings logic below can't read undefined fields. Never depend on
    // undefined being falsy.
    const neutralReview = {
      codexDown: true,
      findings: { CRITICAL: 0, HIGH: 0, MED: 0, LOW: 0 },
      confirmedCritical: false,
      criticalFindings: [],
      topFindingSignature: null,
      weakestDimension: null,
      rubricScore: review.rubricScore != null ? review.rubricScore : null,
      g8Present: review.g8Present,
      onlySkipInDiff: review.onlySkipInDiff,
      advisoryAllow: true,
      note: "advisory-allow (codex down)",
    };
    const r = review.codexDown ? neutralReview : review;
    if (review.codexDown) {
      log(`  ⚠ Codex unavailable (timeout/not-on-PATH) → advisory-allow (codex down); NOT wedging`);
      if (degraded.advisoryOnly) degraded.advisoryAllows += 1;
    }

    // Accumulate findings by severity.
    for (const sev of ["CRITICAL", "HIGH", "MED", "LOW"]) {
      rec.reviewFindings[sev] += (r.findings && r.findings[sev]) || 0;
    }

    // Repeated identical finding → escalate (the loop is spinning).
    if (r.topFindingSignature) {
      if (r.topFindingSignature === rec.lastFindingSignature) {
        rec.repeatedFindingCount += 1;
      } else {
        rec.lastFindingSignature = r.topFindingSignature;
        rec.repeatedFindingCount = 1;
      }
      if (rec.repeatedFindingCount >= CONFIG.repeatedFindingStop) {
        rec.status = "escalated";
        rec.escalation = `same review finding ${rec.repeatedFindingCount}x: ${r.topFindingSignature}`;
        log(`  ⛔ ESCALATE — ${rec.escalation}`);
        return rec;
      }
    }

    // Confirmed-CRITICAL is a HARD STOP — fix in-band, never break-glass.
    // (When codex is down, r.confirmedCritical is structurally false → skipped.)
    if (r.confirmedCritical) {
      log(`  ✗ CONFIRMED-CRITICAL — fixing in-band (never --no-verify, never break-glass)`);
      await phase(`${task.id}:fix-critical#${rec.iterations}`, async () => {
        await agent("claude-deepak", {
          intent: "fix-review-finding",
          task,
          findings: r.criticalFindings,
          rubric: "docs/superpowers/loops/RUBRIC.md",
        });
      });
      continue; // re-gate + re-review the fix
    }

    // (d) RUBRIC: score the task; iterate if below threshold.
    rec.rubricScore = (r.rubricScore != null
      ? r.rubricScore
      : await scoreRubric(task, gate, r));
    log(`  RUBRIC ${rec.rubricScore}/100 (pass ≥ ${CONFIG.rubricPassThreshold})`);
    if (rec.rubricScore < CONFIG.rubricPassThreshold) {
      log(`  ↻ below threshold — iterate on the lowest-scoring dimension`);
      await phase(`${task.id}:rubric-fix#${rec.iterations}`, async () => {
        await agent("claude-deepak", {
          intent: "improve-to-rubric",
          task,
          rubric: "docs/superpowers/loops/RUBRIC.md",
          weakest: r.weakestDimension,
        });
      });
      continue;
    }

    passed = true;
    break; // rubric PASS + no confirmed-CRITICAL → ready to commit
  }

  if (!passed) {
    if (rec.status !== "escalated") {
      rec.status = "maxed";
      rec.escalation = `max iterations (${CONFIG.maxIterationsPerTask}) without rubric pass`;
      log(`  ⛔ STOP — ${rec.escalation}`);
    }
    return rec;
  }

  // ---- (e) COMMIT: real commit; the active core.hooksPath gate re-runs Codex.
  await phase(`${task.id}:commit`, async () => {
    log(`  COMMIT — "${task.commit}" (+ Co-Authored-By trailer; gate re-runs on commit)`);
    const c = await agent("claude-deepak", {
      intent: "commit-task",
      task,
      stage: task.files,
      subject: task.commit,
      trailer: CONFIG.coAuthor,
      note: "never amend; never --no-verify; if the hook blocks confirmed-CRITICAL, treat as hard stop",
    });
    if (c.blockedByHook) {
      rec.status = "escalated";
      rec.escalation = "pre-commit hook blocked a confirmed-CRITICAL at commit time";
      log(`  ⛔ ESCALATE — ${rec.escalation}`);
    }
  });

  // Merge/integration side-effects for the special points.
  if (task.mergePoint && rec.status !== "escalated") {
    await phase(`${task.id}:merge`, async () => {
      log(`  MERGE POINT — merge agent/deepak → main so khanak can rebase`);
      await agent("claude-deepak", {
        intent: "merge-to-main",
        task,
        note: "khanak rebases onto this; the bootstrap + frozen registry are now shared",
      });
    });
  }
  if (task.integration && rec.status !== "escalated") {
    // EARLY-INTEGRATION GUARD (CRITICAL 5): the scheduler treats KHANAK_OWNED
    // blockers as satisfied so E1.26 can be *reached*, but khanak may not have
    // finished. Before merging anything, explicitly verify agent/khanak is
    // present on/mergeable into main AND its four leaf apps/components exist.
    // KHANAK_OWNED.includes() in the scheduler is NOT a substitute for this.
    const kc = await phase(`${task.id}:verify-khanak-complete`, async () => {
      log(`  VERIFY-KHANAK-COMPLETE — agent/khanak committed + 4 leaf apps/components on its branch`);
      return await agent("claude-deepak", {
        intent: "verify-khanak-complete",
        task,
        branch: "agent/khanak",
        requiredFiles: KHANAK_LEAF_FILES,
        note: "git fetch; confirm agent/khanak HEAD has E1.22/23/24/25 leaf files; do NOT proceed on KHANAK_OWNED.includes() alone",
      });
    });
    if (kc.complete !== true) {
      rec.status = "escalated";
      rec.escalation = `khanak not complete at E1.26 integration (missing: ${(kc.missing || ["agent/khanak"]).join(", ")})`;
      log(`  ⛔ ESCALATE — ${rec.escalation}`);
      metrics.record(rec);
      return rec;
    }
    await phase(`${task.id}:integrate`, async () => {
      log(`  INTEGRATION — merge agent/khanak → main, then agent/deepak → main; final gate`);
      await agent("claude-deepak", {
        intent: "integrate-branches",
        task,
        order: ["agent/khanak", "agent/deepak"],
        finalGate: gateCmds(task),
      });
    });
  }

  if (rec.status !== "escalated") rec.status = "done";
  metrics.record(rec);
  log(`  ✓ TASK ${task.id} ${rec.status} — ${rec.iterations} iter, rubric ${rec.rubricScore}`);
  return rec;
}

// ---------------------------------------------------------------------------
// Gate command helpers (string commands the agent runs in the worktree).
// ---------------------------------------------------------------------------
function gateInnerTestCmd(task) {
  // Compose the py command explicitly (no .replace games → no double space / single -q strip).
  if (task.lang === "py") return `.venv/Scripts/python -m pytest ${task.selector} -q`;
  if (task.selector) return `cd ${CONFIG.frontendDir} && npm test -- ${task.selector}`;
  return null;
}
function gateCmds(task) {
  const cmds = [];
  if (task.lang === "ts" || task.lang === "mixed")
    cmds.push(`cd ${CONFIG.frontendDir} && ${CONFIG.verifyCmd}`);
  if (task.lang === "py" || task.lang === "mixed") cmds.push(CONFIG.venvPytest);
  return cmds;
}
function describeGate(task) {
  if (task.lang === "py") return CONFIG.venvPytest;
  if (task.lang === "mixed") return `${CONFIG.verifyCmd} + ${CONFIG.venvPytest}`;
  return CONFIG.verifyCmd;
}
// Is this task on the pure lib/** spine (hard 90% target) vs a thin wrapper (70%)?
function isPureLib(task) {
  return (task.files || []).some((f) => f.includes("/lib/") && f.endsWith(".ts"));
}
// The coverage command — only TS tasks with real source modules carry a coverage gate.
// Verification-driven scaffold/docs/integration tasks (no new pure module) are exempt.
function coverageCmd(task) {
  if (task.lang !== "ts") return null; // py + mixed-integration tasks: no TS branch-coverage gate
  if (task.tdd === false) return null; // scaffold/docs tasks have no unit under coverage
  return `cd ${CONFIG.frontendDir} && ${CONFIG.covCmd}`;
}
function coverageTarget(task) {
  return isPureLib(task) ? CONFIG.covTargetLib : CONFIG.covTargetWrapper;
}
// Fallback local rubric scorer when the agent doesn't return one. Coverage- AND
// fidelity-aware, weights aligned to RUBRIC.md (Correctness 40 / Fidelity 20 /
// Code-quality+Review 25 / Type+Build 15). Correctness counts ONLY when the gate
// is green AND coverage clears target AND the diff has no .only/.skip. Fidelity
// requires the task's G8 proto-constant assertions to be present (TDD tasks).
async function scoreRubric(task, gate, review) {
  const target = gate.coverageTarget != null ? gate.coverageTarget : coverageTarget(task);
  const covRequired = coverageCmd(task) != null;
  const covOk = !covRequired || (gate.branchCoverage != null && gate.branchCoverage >= target);
  const noOnlySkip = gate.onlySkip !== true && review.onlySkipInDiff !== true;
  const correctness = gate.green && covOk && noOnlySkip ? 40 : 0;
  const typeBuild = gate.green ? 15 : 0;
  const codeQuality = review.confirmedCritical
    ? 0
    : 25 - 5 * (review.findings ? review.findings.HIGH || 0 : 0);
  // Fidelity (20): G8 proto-constant assertions must be present for TDD tasks.
  // Verification-driven (non-TDD) tasks carry no G8 constants → partial credit.
  let fidelity;
  if (!task.tdd) fidelity = 12;
  else fidelity = review.g8Present === false ? 0 : 20;
  return Math.max(0, Math.min(100, correctness + typeBuild + Math.max(0, codeQuality) + fidelity));
}

// ---------------------------------------------------------------------------
// Scheduler: pop the next UNBLOCKED task in queue order, run it, repeat.
// "Unblocked" = every id in blockedBy is in the done-set. khanak-owned ids
// (E1.22–E1.25) are satisfied externally — but this only governs SCHEDULING
// (letting E1.26 be *reached*). It is NOT proof khanak finished: the E1.26
// integration step runs an explicit verify-khanak-complete gate before merging
// (see runTask :verify-khanak-complete), which escalates if khanak is absent.
// ---------------------------------------------------------------------------
const KHANAK_OWNED = ["E1.22", "E1.23", "E1.24", "E1.25"];
// The four leaf surfaces khanak must have landed before E1.26 may integrate.
const KHANAK_LEAF_FILES = [
  "frontend/src/components/Pill.tsx", // E1.25 shared components
  "frontend/src/apps/Clock/index.tsx", // E1.22 Clock
  "frontend/src/apps/Notes/index.tsx", // E1.23 Notes
  "frontend/src/apps/Snake/index.tsx", // E1.24 Snake
];

function nextUnblocked(queue, done, started) {
  for (const t of queue) {
    if (started.has(t.id)) continue;
    const ok = t.blockedBy.every(
      (b) => done.has(b) || KHANAK_OWNED.includes(b),
    );
    if (ok) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Metrics accumulator (tracked per RUBRIC.md §Metrics).
// ---------------------------------------------------------------------------
function makeMetrics() {
  const records = [];
  return {
    records,
    record: (r) => records.push(r),
    summary() {
      const done = records.filter((r) => r.status === "done");
      const escalated = records.filter((r) => r.status !== "done");
      const totalIter = records.reduce((a, r) => a + r.iterations, 0);
      const testsAdded = records.reduce((a, r) => a + r.testsAdded, 0);
      const gatePass = records.reduce((a, r) => a + r.gatePasses, 0);
      const gateFail = records.reduce((a, r) => a + r.gateFails, 0);
      const findings = records.reduce(
        (a, r) => {
          for (const s of ["CRITICAL", "HIGH", "MED", "LOW"])
            a[s] += r.reviewFindings[s];
          return a;
        },
        { CRITICAL: 0, HIGH: 0, MED: 0, LOW: 0 },
      );
      return {
        tasksDone: done.length,
        tasksEscalated: escalated.length,
        avgIterationsPerTask: records.length ? totalIter / records.length : 0,
        testsAdded,
        gatePassRate: gatePass + gateFail ? gatePass / (gatePass + gateFail) : 0,
        reviewFindings: findings,
        escalations: escalated.map((r) => `${r.id}: ${r.escalation}`),
      };
    },
  };
}

// =============================================================================
// ENTRYPOINT — the loop.
// =============================================================================
export default async function run({ budget } = {}) {
  // Defensive default = a REAL ceiling (total:1, remaining:()=>0): a missing
  // budget handle must STOP the loop at the first guard check, never spin
  // forever. b.remaining() is always honored against budgetFloor below.
  const b = budget || { total: 1, remaining: () => 0 };
  const metrics = makeMetrics();
  const done = new Set();
  const started = new Set();
  const degraded = { advisoryOnly: false, advisoryAllows: 0 }; // codex-down/absent mode

  log("=== SAMAGRA OS · E1 · claude-deepak loop START ===");
  log(`worktree=${meta.worktree} branch=${meta.branch} queue=${QUEUE.length} tasks`);
  log(`rubric-pass≥${CONFIG.rubricPassThreshold} maxIter=${CONFIG.maxIterationsPerTask} budgetFloor=${CONFIG.budgetFloor}`);

  // STARTUP PREFLIGHT (HIGH 3): the advisory Codex gate is only meaningful if
  // `codex` is invokable. A *missing* Codex exit-0 is NOT a clean review. If
  // absent, enter an explicit, logged, metrics-surfaced "advisory-only degraded"
  // mode (never indistinguishable from a real review) and ESCALATE for owner
  // awareness — do not silently allow every commit while logging GATE GREEN.
  await phase("codex-preflight", async () => {
    const pf = await agent("claude-deepak", {
      intent: "codex-preflight",
      checks: ["codex --version", "where codex", "CODEX_BIN env"],
      note: "verify codex is on PATH (or CODEX_BIN set) before trusting the advisory gate",
    });
    if (pf.codexAvailable === true) {
      log(`  ✓ codex on PATH (${pf.version || "version unknown"})`);
    } else {
      degraded.advisoryOnly = true;
      log("  ⚠ codex NOT invokable → entering ADVISORY-ONLY DEGRADED mode (gate is non-enforcing).");
      log("  ⚠ ESCALATE to owner: every 'GATE GREEN' below is advisory-allow, NOT a real Codex review.");
    }
  });

  // The five named phases are the human-readable spine; tasks flow through them
  // via the scheduler. We drive by the queue (DAG order) inside one pipeline.
  let dispatches = 0; // hard ceiling on outer-loop re-entry (re-evaluates same set)
  await pipeline("deepak-e1", async () => {
    while (b.remaining() > CONFIG.budgetFloor) {
      if (dispatches >= CONFIG.maxTaskDispatches) {
        log(`!! max task dispatches (${CONFIG.maxTaskDispatches}) reached — halting (re-entry ceiling)`);
        break;
      }
      const task = nextUnblocked(QUEUE, done, started);
      if (!task) {
        log("queue drained (all deepak tasks dispatched)");
        break;
      }
      started.add(task.id);
      dispatches += 1;
      const rec = await runTask(task, b, metrics, degraded);
      if (rec.status === "done") {
        done.add(task.id);
      } else {
        // STOP/ESCALATE: surface, do NOT silently skip a blocked-down dependency.
        log(`!! ${task.id} ${rec.status}: ${rec.escalation}`);
        log("!! halting new-task dispatch — owner review required (see RUBRIC.md STOP/ESCALATE)");
        break;
      }
    }
  });

  const s = metrics.summary();
  s.codexDegraded = degraded.advisoryOnly;
  s.advisoryAllows = degraded.advisoryAllows;
  log("=== SAMAGRA OS · E1 · claude-deepak loop END ===");
  if (degraded.advisoryOnly) {
    log(`!! CODEX DEGRADED: ran in advisory-only mode — ${degraded.advisoryAllows} advisory-allow(s); NOT a clean review record.`);
  }
  log(
    `done=${s.tasksDone} escalated=${s.tasksEscalated} avgIter=${s.avgIterationsPerTask.toFixed(2)} ` +
      `testsAdded=${s.testsAdded} gatePassRate=${(s.gatePassRate * 100).toFixed(0)}% ` +
      `findings(C/H/M/L)=${s.reviewFindings.CRITICAL}/${s.reviewFindings.HIGH}/${s.reviewFindings.MED}/${s.reviewFindings.LOW}`,
  );
  for (const e of s.escalations) log(`  escalation → ${e}`);
  log(
    "REMINDER: visual pixel/interaction parity (E1.18–E1.21) is a SEPARATE human QA pass — NOT signalled by this loop.",
  );
  return { metrics: s };
}
