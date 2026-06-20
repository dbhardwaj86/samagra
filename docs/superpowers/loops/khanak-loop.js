// =============================================================================
// SAMAGRA OS · E1 · claude-khanak autonomous build loop  (Workflow script)
// =============================================================================
//
// HOW TO LAUNCH (do NOT launch from this doc tree — launch later, inside the
// khanak worktree, and ONLY after deepak's blocking prefix is on main):
//
//   1. WAIT until deepak's E1.1 (bootstrap) + E1.2 (contracts + frozen
//      registry) are merged to main.  Until then khanak writes NOTHING.
//   2. cd ../samagra-khanak             # worktree for branch agent/khanak
//   3. git rebase main                  # pick up the bootstrap + frozen registry
//   4. npm install                      # against deepak's tracked lockfile
//   5. Run this file as a Workflow script:
//        scriptPath: docs/superpowers/loops/khanak-loop.js
//      with cwd = ../samagra-khanak  (the agent's own git worktree).
//
// WHAT IT DOES: iterates khanak's SHORT E1 queue — four thin leaf-app /
// component tasks (shared components, Clock, Notes, Snake), each a THIN visual
// wrapper over deepak's already-green pure engines (lib/clock/*, lib/notes,
// lib/snake/*, lib/persistence, themes). Per task it runs the same per-task
// loop as deepak: TDD on the SMALL new logic khanak owns (useInterval hygiene;
// save()-on-mutation; isSnakeActive keyboard gate; accent-prop on components) →
// GATE (`npm run verify`) → CODEX REVIEW (`samagra review-staged`) → ITERATE
// against RUBRIC.md → COMMIT (active hook re-runs Codex) → metrics → next task.
//
// CRITICAL GATING: every khanak task is additionally blocked by the specific
// deepak engine(s) it wraps AND by the shell (E1.18). The loop will NOT start a
// task whose engine dependencies are not yet on main — it polls/waits, never
// reimplements deepak's lib. (E1.25 components need only themes E1.4, so it is
// khanak's natural first task after the rebase.)
//
// VISUAL TASKS: all four khanak tasks are tagged `visual`. The loop runs ONLY
// their headless residue (fake-timer / mocked-storage / gating-predicate / RTL
// render-smoke tests, all inside `npm run verify`). Pixel / interaction parity
// vs the prototype + screenshots/ is a SEPARATE human QA pass (owner = deepak),
// NEVER a loop done-signal. See RUBRIC.md §"Human visual-fidelity checklist".
//
// SAFETY: never `--no-verify`; never self-break-glass; confirmed-CRITICAL is a
// hard stop. Codex down/absent → advisory allow (never wedge). No
// Date.now()/Math.random()/new Date(); time/budget come from injected `budget`.
// =============================================================================

export const meta = {
  name: "samagra-os-e1-khanak-loop",
  description:
    "Autonomous TDD build loop for claude-khanak's E1 queue: four thin visual leaf apps/components (shared components, Clock, Notes, Snake) wrapping deepak's tested pure engines. Headless-gated on each task's small new logic (useInterval hygiene, save-on-mutation, isSnakeActive gate, accent props) via npm run verify + the advisory Codex review; pixel parity is excluded.",
  agent: "claude-khanak",
  worktree: "../samagra-khanak",
  branch: "agent/khanak",
  phases: ["await-prefix", "components", "clock", "notes", "snake"],
};

// ---------------------------------------------------------------------------
// Tunables (pure literals — no runtime clock/random).
// ---------------------------------------------------------------------------
const CONFIG = {
  maxIterationsPerTask: 6,
  buildRedStopThreshold: 3,
  repeatedFindingStop: 2,
  rubricPassThreshold: 85,
  budgetFloor: 0.08,
  maxDepWaitTicks: 40, // hard cap on dep-wait re-checks per task → ESCALATE (budget-independent)
  maxTaskDispatches: 60, // hard ceiling on total outer-loop iterations (re-entry guard)
  repoRoot: "C:/SandBox/claude_box/TeachingOS",
  frontendDir: "frontend",
  verifyCmd: "npm run verify", // lint → tsc → vitest → build (fail-fast)
  covCmd: "npm run test:cov", // vitest run --coverage — per-module branch coverage
  covTargetWrapper: 70, // G2: ≥70% branch on thin wrappers (residue only)
  reviewDryRun: ".venv/Scripts/python -m samagra review-staged",
  coAuthor: "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>",
  // deepak-owned ids that must be on `main` before khanak tasks can start.
  // These are external dependencies — khanak waits, never reimplements.
  prefix: ["E1.1", "E1.2"], // bootstrap + frozen registry (the absolute gate)
};

// ---------------------------------------------------------------------------
// khanak's E1 task queue (ordered; respects external blockedBy).
// `externalDeps` = deepak-owned engine/shell ids that must be on main first.
// `kind` is always "visual" here, but each carries a looped HEADLESS residue.
// ---------------------------------------------------------------------------
const QUEUE = [
  {
    id: "E1.25",
    title: "Shared leaf components — Pill / Card / Chip / IconButton",
    kind: "visual",
    lang: "ts",
    tdd: true,
    externalDeps: ["E1.4"], // themes tokens
    files: [
      "frontend/src/components/Pill.tsx",
      "frontend/src/components/Card.tsx",
      "frontend/src/components/Chip.tsx",
      "frontend/src/components/IconButton.tsx",
      "frontend/src/components/Pill.test.tsx",
      "frontend/src/components/Card.test.tsx",
      "frontend/src/components/Chip.test.tsx",
      "frontend/src/components/IconButton.test.tsx",
    ],
    selector: "components",
    gate: "verify",
    commit:
      "feat(frontend): shared leaf components — Pill/Card/Chip/IconButton",
    note: "earliest khanak start — needs only themes (E1.4); fills the wait before engines+shell land",
    visualResidue:
      "RTL render-smoke per component: renders children + applies the accent prop",
  },
  {
    id: "E1.22",
    title: "Clock app — thin wrapper over lib/clock/* + useInterval",
    kind: "visual",
    lang: "ts",
    tdd: true,
    externalDeps: ["E1.10", "E1.11", "E1.12", "E1.13", "E1.18"],
    files: [
      "frontend/src/hooks/useInterval.ts",
      "frontend/src/hooks/useInterval.test.ts",
      "frontend/src/apps/Clock/index.tsx",
      "frontend/src/apps/Clock/index.test.tsx",
    ],
    selector: "useInterval Clock",
    gate: "verify",
    commit:
      "feat(apps): Clock wrapper — analog/stopwatch/timer/world over lib/clock",
    note: "all clock math already green in lib/clock/* — only useInterval hygiene is new",
    visualResidue:
      "fake-timer: useInterval fires at the interval + clears on unmount; RTL: Clock renders four tabs",
  },
  {
    id: "E1.23",
    title: "Notes/To-dos app — thin wrapper over lib/notes + persistence",
    kind: "visual",
    lang: "ts",
    tdd: true,
    externalDeps: ["E1.14", "E1.3", "E1.18"],
    files: [
      "frontend/src/apps/Notes/index.tsx",
      "frontend/src/apps/Notes/index.test.tsx",
    ],
    selector: "Notes",
    gate: "verify",
    commit: "feat(apps): Notes/To-dos wrapper over lib/notes + persistence",
    note: "note/todo logic + seed green in lib/notes/model — only autosave wiring is new",
    visualResidue:
      "RTL (mocked storage): adding a todo calls save('samagra.todos')",
  },
  {
    id: "E1.24",
    title: "Snake app — thin wrapper over lib/snake/* + keyboard gating",
    kind: "visual",
    lang: "ts",
    tdd: true,
    externalDeps: ["E1.16", "E1.15", "E1.3", "E1.18"],
    files: [
      "frontend/src/apps/Snake/index.tsx",
      "frontend/src/apps/Snake/index.test.tsx",
    ],
    selector: "Snake",
    gate: "verify",
    commit: "feat(apps): Snake wrapper over lib/snake + keyboard gating",
    note: "engine + cell math green in lib/snake/* — only the interval wiring + isSnakeActive gate are new",
    visualResidue:
      "headless gating: isSnakeActive returns false when activeElement is an INPUT/TEXTAREA",
  },
];

// ---------------------------------------------------------------------------
// Per-task inner loop: TDD → GATE → CODEX REVIEW → ITERATE → COMMIT.
// Identical contract to deepak-loop; khanak's tasks are visual-with-residue.
// ---------------------------------------------------------------------------
async function runTask(task, budget, metrics, degraded) {
  log(`▶ TASK ${task.id} [${task.kind}/${task.lang}] — ${task.title}`);
  log(`  (visual task — looped on headless residue only: ${task.visualResidue}; pixel parity → human QA)`);

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

  // ---- RED: write the failing residue test first.
  await phase(`${task.id}:red`, async () => {
    log(`  RED — write failing residue test (${task.visualResidue}); run, expect FAIL`);
    const t = await agent("claude-khanak", {
      intent: "write-failing-test",
      task,
      rubric: "docs/superpowers/loops/RUBRIC.md",
      innerTest: `cd ${CONFIG.frontendDir} && npm test -- ${task.selector}`,
      instructions: [
        "Test ONLY the small new logic khanak owns (hook hygiene / save-on-mutation / gating predicate / accent prop).",
        "Do NOT re-test deepak's engine math — it is already green in lib/**; import and trust it.",
        "Confirm the test fails before implementing.",
      ],
    });
    rec.testsAdded += t.testsAdded || 1;
  });

  // ---- ITERATE: build → gate → review → fix, capped + budget-guarded.
  // Guard on BOTH the hard per-task iteration cap AND the budget floor.
  // budget.remaining() is always honored against the floor (the defensive
  // default in run() supplies a sane ceiling so a null/0 token target can never
  // disable the guard). maxIterationsPerTask is the hard re-entry ceiling.
  let passed = false;
  while (
    rec.iterations < CONFIG.maxIterationsPerTask &&
    budget.remaining() > CONFIG.budgetFloor
  ) {
    rec.iterations += 1;
    log(`  ── iteration ${rec.iterations}/${CONFIG.maxIterationsPerTask} ──`);

    // (a) GREEN: implement the thin wrapper.
    await phase(`${task.id}:green#${rec.iterations}`, async () => {
      await agent("claude-khanak", {
        intent: "implement-to-green",
        task,
        innerTest: `cd ${CONFIG.frontendDir} && npm test -- ${task.selector}`,
        instructions: [
          "Implement the thin wrapper; delegate all real math to deepak's lib/** modules.",
          "Make the residue test pass; keep the component presentational.",
          "Re-run the narrowed selector; expect PASS before gating.",
        ],
      });
    });

    // (b) GATE: full headless verify (lint→tsc→vitest→build) PLUS a coverage
    // gate (`npm run test:cov`). GREEN only when verify is green AND the wrapper's
    // residue branch coverage clears the 70% target. A missing/low coverage
    // signal is treated as BELOW threshold so the loop iterates rather than
    // passing a tautological green.
    const gate = await phase(`${task.id}:gate#${rec.iterations}`, async () => {
      log(`  GATE — cd ${CONFIG.frontendDir} && ${CONFIG.verifyCmd}`);
      const g = await agent("claude-khanak", {
        intent: "run-gate",
        task,
        cmds: [`cd ${CONFIG.frontendDir} && ${CONFIG.verifyCmd}`],
        coverageCmd: `cd ${CONFIG.frontendDir} && ${CONFIG.covCmd}`,
        coverageTarget: CONFIG.covTargetWrapper,
        diffCheck: "no .only/.skip in the staged diff",
        expect: "all green; wrapper branch coverage ≥ 70%; no .only/.skip",
      });
      g.coverageTarget = CONFIG.covTargetWrapper;
      if (g.branchCoverage == null) g.branchCoverage = 0; // absent → BELOW target
      return g;
    });

    const covOk = gate.branchCoverage != null && gate.branchCoverage >= CONFIG.covTargetWrapper;
    if (!gate.green || !covOk) {
      rec.gateFails += 1;
      rec.consecutiveGateFails += 1;
      const why = !gate.green
        ? gate.failingStage || "unknown stage"
        : `branch coverage ${gate.branchCoverage}% < ${CONFIG.covTargetWrapper}%`;
      log(`  ✗ GATE RED (${why})`);
      if (rec.consecutiveGateFails >= CONFIG.buildRedStopThreshold) {
        rec.status = "escalated";
        rec.escalation = `gate red ${rec.consecutiveGateFails}x on ${task.id} (${why})`;
        log(`  ⛔ ESCALATE — ${rec.escalation}`);
        return rec;
      }
      continue;
    }
    rec.gatePasses += 1;
    rec.consecutiveGateFails = 0;
    log(`  ✓ GATE GREEN (branch coverage ${gate.branchCoverage}%)`);

    // (c) CODEX REVIEW.
    const review = await phase(`${task.id}:review#${rec.iterations}`, async () => {
      log(`  CODEX REVIEW — git add ${task.files.join(" ")} ; ${CONFIG.reviewDryRun}`);
      return await agent("claude-khanak", {
        intent: "codex-review-staged",
        task,
        stage: task.files,
        cmd: CONFIG.reviewDryRun,
        note: "exit 0 = clean | exit 1 = confirmed-CRITICAL (hard stop) | Codex down = advisory allow, NEVER wedge",
      });
    });

    // Codex-down-doesn't-wedge: transient/absent → advisory ALLOW, taken
    // STRUCTURALLY (mirror precommit.py never-wedge). Substitute a known-neutral
    // review object so confirmedCritical / repeated-finding / findings logic can
    // never read undefined fields — never depend on undefined being falsy.
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
      log(`  ⚠ Codex unavailable → advisory-allow (codex down); NOT wedging`);
      if (degraded.advisoryOnly) degraded.advisoryAllows += 1;
    }

    for (const sev of ["CRITICAL", "HIGH", "MED", "LOW"]) {
      rec.reviewFindings[sev] += (r.findings && r.findings[sev]) || 0;
    }

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

    if (r.confirmedCritical) {
      log(`  ✗ CONFIRMED-CRITICAL — fixing in-band (never --no-verify, never break-glass)`);
      await phase(`${task.id}:fix-critical#${rec.iterations}`, async () => {
        await agent("claude-khanak", {
          intent: "fix-review-finding",
          task,
          findings: r.criticalFindings,
          rubric: "docs/superpowers/loops/RUBRIC.md",
        });
      });
      continue;
    }

    // (d) RUBRIC.
    rec.rubricScore = (r.rubricScore != null
      ? r.rubricScore
      : scoreRubric(task, gate, r));
    log(`  RUBRIC ${rec.rubricScore}/100 (pass ≥ ${CONFIG.rubricPassThreshold})`);
    if (rec.rubricScore < CONFIG.rubricPassThreshold) {
      log(`  ↻ below threshold — iterate on the lowest-scoring dimension`);
      await phase(`${task.id}:rubric-fix#${rec.iterations}`, async () => {
        await agent("claude-khanak", {
          intent: "improve-to-rubric",
          task,
          rubric: "docs/superpowers/loops/RUBRIC.md",
          weakest: r.weakestDimension,
        });
      });
      continue;
    }

    passed = true;
    break;
  }

  if (!passed) {
    if (rec.status !== "escalated") {
      rec.status = "maxed";
      rec.escalation = `max iterations (${CONFIG.maxIterationsPerTask}) without rubric pass`;
      log(`  ⛔ STOP — ${rec.escalation}`);
    }
    return rec;
  }

  // ---- (e) COMMIT: active core.hooksPath gate re-runs Codex.
  await phase(`${task.id}:commit`, async () => {
    log(`  COMMIT — "${task.commit}" (+ Co-Authored-By trailer; gate re-runs on commit)`);
    const c = await agent("claude-khanak", {
      intent: "commit-task",
      task,
      stage: task.files,
      subject: task.commit,
      trailer: CONFIG.coAuthor,
      note: "never amend; never --no-verify; a confirmed-CRITICAL block at commit = hard stop",
    });
    if (c.blockedByHook) {
      rec.status = "escalated";
      rec.escalation = "pre-commit hook blocked a confirmed-CRITICAL at commit time";
      log(`  ⛔ ESCALATE — ${rec.escalation}`);
    }
  });

  if (rec.status !== "escalated") rec.status = "done";
  metrics.record(rec);
  log(`  ✓ TASK ${task.id} ${rec.status} — ${rec.iterations} iter, rubric ${rec.rubricScore}`);
  return rec;
}

// Fallback local rubric scorer. Coverage-aware + weight-aligned to RUBRIC.md
// (Correctness 40 / Fidelity 20 / Code-quality+Review 25 / Type+Build 15).
// Correctness counts ONLY when the gate is green AND wrapper residue coverage
// clears target AND the diff has no .only/.skip.
function scoreRubric(task, gate, review) {
  const target = gate.coverageTarget != null ? gate.coverageTarget : CONFIG.covTargetWrapper;
  const covOk = gate.branchCoverage != null && gate.branchCoverage >= target;
  const noOnlySkip = gate.onlySkip !== true && review.onlySkipInDiff !== true;
  const correctness = gate.green && covOk && noOnlySkip ? 40 : 0;
  const typeBuild = gate.green ? 15 : 0;
  const codeQuality = review.confirmedCritical
    ? 0
    : 25 - 5 * (review.findings ? review.findings.HIGH || 0 : 0);
  // Visual residue tasks carry no G8 proto constants (parity is human QA) → 12.
  const fidelity = 12;
  return Math.max(0, Math.min(100, correctness + typeBuild + Math.max(0, codeQuality) + fidelity));
}

// ---------------------------------------------------------------------------
// Dependency wait: a task only starts once its deepak engine/shell deps are on
// main. The agent verifies presence (file exists + imports resolve) before
// starting; if not ready, the loop waits one budget tick and re-checks.
// ---------------------------------------------------------------------------
async function depsReady(task) {
  const probe = await agent("claude-khanak", {
    intent: "check-deps-on-main",
    task,
    prefix: CONFIG.prefix,
    externalDeps: task.externalDeps || [],
    note: "git fetch + verify the prefix is merged and each external engine/shell file exists on main",
  });
  return probe.ready === true;
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
  // budget handle must STOP at the first guard check, never spin forever.
  // b.remaining() is always honored against budgetFloor below.
  const b = budget || { total: 1, remaining: () => 0 };
  const metrics = makeMetrics();
  const done = new Set();
  const degraded = { advisoryOnly: false, advisoryAllows: 0 }; // codex-down/absent mode

  log("=== SAMAGRA OS · E1 · claude-khanak loop START ===");
  log(`worktree=${meta.worktree} branch=${meta.branch} queue=${QUEUE.length} tasks`);
  log(`prefix-gate=${CONFIG.prefix.join("+")} (until on main, khanak writes nothing)`);

  // STARTUP PREFLIGHT (HIGH 3): the advisory Codex gate is only meaningful if
  // `codex` is invokable. A *missing* Codex exit-0 is NOT a clean review. If
  // absent, enter an explicit, logged, metrics-surfaced "advisory-only degraded"
  // mode (never indistinguishable from a real review) and ESCALATE for owner
  // awareness — never silently allow every commit while logging GATE GREEN.
  await phase("codex-preflight", async () => {
    const pf = await agent("claude-khanak", {
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

  // Phase 1: AWAIT the blocking prefix on main, then rebase.
  await phase("await-prefix", async () => {
    log("waiting for deepak E1.1 + E1.2 on main, then `git rebase main` + npm install");
    await agent("claude-khanak", {
      intent: "await-and-rebase",
      prefix: CONFIG.prefix,
      worktree: meta.worktree,
      note: "blocks here until bootstrap + frozen registry are merged; then rebases + npm install",
    });
  });

  // Phase 2..N: drive khanak's queue in order, each gated on its engine deps.
  let dispatches = 0; // hard ceiling on outer-loop re-entry (re-checks same task)
  let halted = false;
  await pipeline("khanak-e1", async () => {
    let idx = 0;
    let depWaitTicks = 0; // per-task dep-wait re-check counter (reset on advance)
    while (idx < QUEUE.length && b.remaining() > CONFIG.budgetFloor) {
      if (dispatches >= CONFIG.maxTaskDispatches) {
        log(`!! max task dispatches (${CONFIG.maxTaskDispatches}) reached — halting (re-entry ceiling)`);
        halted = true;
        break;
      }
      dispatches += 1;
      const task = QUEUE[idx];

      const ready = await depsReady(task);
      if (!ready) {
        // CRITICAL 1(a): bound the dep-wait independently of budget. After
        // maxDepWaitTicks re-checks on the SAME task, the dependency never
        // landed on main → ESCALATE and halt; do NOT re-continue forever.
        depWaitTicks += 1;
        if (depWaitTicks >= CONFIG.maxDepWaitTicks) {
          const esc = `dependency never landed on main for ${task.id} after ${depWaitTicks} ticks (${(task.externalDeps || []).join(",")})`;
          metrics.record({
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
            status: "escalated",
            escalation: esc,
          });
          log(`  ⛔ ESCALATE — ${esc}`);
          log("!! halting new-task dispatch — owner review required (see RUBRIC.md STOP/ESCALATE)");
          halted = true;
          break;
        }
        log(`… ${task.id} deps not yet on main (${(task.externalDeps || []).join(",")}); waiting a tick ${depWaitTicks}/${CONFIG.maxDepWaitTicks}`);
        // Wait one budget tick (no real clock) then re-check the SAME task.
        await phase(`${task.id}:wait-deps#${depWaitTicks}`, async () => {
          await agent("claude-khanak", {
            intent: "wait-tick",
            task,
            note: "git fetch; re-check deps; do not reimplement deepak's lib",
          });
        });
        if (b.remaining() <= CONFIG.budgetFloor) {
          log("!! budget floor reached while waiting on deepak deps — yielding");
          break;
        }
        continue; // re-evaluate the same task next loop turn
      }

      depWaitTicks = 0; // deps satisfied → reset the per-task wait counter
      const rec = await runTask(task, b, metrics, degraded);
      if (rec.status === "done") {
        done.add(task.id);
        idx += 1;
      } else {
        log(`!! ${task.id} ${rec.status}: ${rec.escalation}`);
        log("!! halting new-task dispatch — owner review required (see RUBRIC.md STOP/ESCALATE)");
        halted = true;
        break;
      }
    }
  });

  const s = metrics.summary();
  s.codexDegraded = degraded.advisoryOnly;
  s.advisoryAllows = degraded.advisoryAllows;
  s.halted = halted;
  log("=== SAMAGRA OS · E1 · claude-khanak loop END ===");
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
    "REMINDER: pixel/interaction parity for Clock/Notes/Snake/components is a SEPARATE human QA pass — NOT signalled by this loop. khanak does NOT do the final integration; deepak's E1.26 merges agent/khanak → main first.",
  );
  return { metrics: s };
}
