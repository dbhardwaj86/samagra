// =============================================================================
// SAMAGRA OS · E1 · COMBINED single-tree autonomous build loop (Workflow script)
// =============================================================================
//
// WHY THIS FILE EXISTS
// --------------------
// deepak-loop.js / khanak-loop.js are the *design* of the two-agent, two-worktree
// build. They are structured pseudo-code: their agent()/phase()/pipeline()/
// `export default run()` shapes do NOT match the real Workflow runtime API, and
// they assume cwd = a per-agent git worktree. They cannot be launched verbatim.
//
// This file is the RUNNABLE orchestration for the "one managing session drives
// the whole E1 build from here" model. It is API-correct (top-level body; real
// agent(prompt, opts) with JSON schemas; phase(title); plain sequential loop)
// and it runs against a SINGLE working tree (this checkout, on branch
// `e1/samagra-os`). Because there is one tree, the cross-worktree seams
// (mergePoint / verify-khanak-complete / integrate-branches) are unnecessary and
// removed — every task simply commits to the build branch in DAG order.
//
// It preserves, verbatim in spirit, the proven pieces from the two loops:
//   • the full 26-task E1 DAG (deepak substrate + khanak leaf apps, one queue)
//   • the per-task loop: RED (failing test) → GREEN → GATE (`npm run verify`
//     + `npm run test:cov` coverage gate, + pytest for py) → CODEX REVIEW
//     (`samagra review-staged`) → iterate-vs-RUBRIC → COMMIT (active hook re-runs
//     Codex)
//   • all guards: maxIterationsPerTask, buildRedStopThreshold, repeatedFindingStop,
//     a codex-on-PATH startup preflight + structural codex-down advisory-allow
//     (never wedge), a hard maxTaskDispatches re-entry ceiling, and a real token
//     budget floor (only when a budget target is set).
//
// SAFETY (unchanged): never `--no-verify`; never set SAMAGRA_REVIEW_BREAKGLASS;
// a confirmed-CRITICAL is a hard stop fixed in-band or escalated, never bypassed.
// Visual tasks (E1.18–E1.25) are looped on their HEADLESS RESIDUE only; pixel/
// interaction parity is a SEPARATE human QA pass (RUBRIC.md §6), never a loop
// done-signal. No Date.now()/Math.random()/new Date() (Workflow determinism).
// =============================================================================

export const meta = {
  name: "samagra-os-e1",
  description:
    "Combined single-tree autonomous TDD build for SAMAGRA OS Phase E1 (windowing shell + aqua theme + 6 OS utilities). Drives the full 26-task DAG (substrate + pure lib/** engines + Zustand stores + FastAPI serve seam + aqua shell + Dashboard/Settings/Terminal/Clock/Notes/Snake/components) from one managing session on branch e1/samagra-os. Per task: RED→GREEN→GATE(verify+coverage[+pytest])→Codex review→iterate-vs-RUBRIC→commit. Headless-gated; pixel parity is a separate human pass.",
  phases: [
    { title: "preflight", detail: "codex-on-PATH check; branch sanity" },
    { title: "bootstrap", detail: "E1.1 scaffold + E1.2 contracts/registry" },
    { title: "engines", detail: "pure lib/** + stores + FastAPI serve seam" },
    { title: "shell+apps", detail: "aqua chrome + 6 apps + shared components" },
    { title: "gate", detail: "E1.26 full headless gate + pointer-file sync" },
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
  maxTaskDispatches: 80, // hard ceiling on outer-loop re-entry (re-evaluates same set)
  tokenFloor: 60000, // stop popping new tasks when remaining() <= this MANY tokens
  branch: "e1/samagra-os",
  frontendDir: "frontend",
  planDoc: "docs/superpowers/plans/2026-06-20-samagra-os.md",
  rubricDoc: "docs/superpowers/loops/RUBRIC.md",
  protoDoc: "docs/superpowers/_research/samagra-os/proto.md",
  verifyCmd: "npm run verify", // lint → tsc → vitest → build (fail-fast)
  covCmd: "npm run test:cov", // vitest run --coverage — per-module branch coverage
  venvPytest: ".venv/Scripts/python -m pytest -q",
  reviewCmd: ".venv/Scripts/python -m samagra review-staged",
  covTargetLib: 90, // G2: ≥90% branch on pure lib/** modules under test
  covTargetWrapper: 70, // G2: ≥70% branch on thin wrappers (residue only)
  coAuthor: "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>",
};

// ---------------------------------------------------------------------------
// The combined E1 task queue (26 tasks, DAG order). Single-tree blockedBy: the
// khanak "externalDeps" become ordinary blockedBy ids. owner is informational.
// kind: "headless" fully loop-gated | "visual" looped on headless residue only.
// lang: "ts" → npm verify | "py" → pytest | "mixed" → both.
// ---------------------------------------------------------------------------
const QUEUE = [
  {
    id: "E1.1", owner: "deepak", group: "bootstrap", kind: "headless", lang: "ts",
    tdd: false, blockedBy: [],
    title: "Frontend bootstrap scaffold + FastAPI-serve config + tooling",
    files: [
      "frontend/package.json", "frontend/package-lock.json", "frontend/vite.config.ts",
      "frontend/tsconfig.json", "frontend/tsconfig.node.json", "frontend/index.html",
      "frontend/.eslintrc.cjs", "frontend/src/main.tsx", "frontend/src/App.tsx",
      "frontend/src/App.test.tsx", "frontend/src/test/setup.ts", ".gitignore",
    ],
    setup: "cd frontend && npm install",
    selector: "App", commit:
      "feat(frontend): bootstrap React+TS+Vite app + tooling + gitignore node block",
    note: "the only task unblocked at t0; defines npm scripts verify/test/test:cov/lint/typecheck/build/dev",
  },
  {
    id: "E1.2", owner: "deepak", group: "bootstrap", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.1"],
    title: "App-contract types + frozen 17-app registry (proto values)",
    files: [
      "frontend/src/types/contracts.ts", "frontend/src/registry.ts",
      "frontend/src/registry.test.ts",
    ],
    selector: "registry", commit:
      "feat(frontend): app-contract types + frozen 17-app registry (proto values)",
    note: "registry is FROZEN after this; App.tsx must reference apps only via registry React.lazy",
  },
  {
    id: "E1.3", owner: "deepak", group: "engines", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.2"],
    title: "lib/persistence localStorage layer + defensive parse",
    files: ["frontend/src/lib/persistence.ts", "frontend/src/lib/persistence.test.ts"],
    selector: "persistence", commit:
      "feat(frontend): persistence localStorage layer + defensive parse (pure TS)",
  },
  {
    id: "E1.4", owner: "deepak", group: "engines", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.2"],
    title: "themes/ aqua token map + console/samagra forward-compat",
    files: ["frontend/src/themes/index.ts", "frontend/src/themes/index.test.ts"],
    selector: "themes", commit:
      "feat(themes): aqua token map (E1) + console/samagra forward-compat tokens",
  },
  {
    id: "E1.6", owner: "deepak", group: "engines", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.2"],
    title: "lib/wm/zorder — monotonic z + focus + active rule",
    files: ["frontend/src/lib/wm/zorder.ts", "frontend/src/lib/wm/zorder.test.ts"],
    selector: "zorder", commit:
      "feat(wm): z-order counter + focus + active-window rule (pure TS)",
  },
  {
    id: "E1.8", owner: "deepak", group: "engines", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.2"],
    title: "lib/terminal/parser — tokenize c0/args/arg/clear/empty",
    files: ["frontend/src/lib/terminal/parser.ts", "frontend/src/lib/terminal/parser.test.ts"],
    selector: "parser", commit: "feat(terminal): command-line parser (pure TS)",
  },
  {
    id: "E1.5", owner: "deepak", group: "engines", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.4"],
    title: "lib/wm/geometry — workArea/openRect/clamp/maximize/reclamp/tile",
    files: ["frontend/src/lib/wm/geometry.ts", "frontend/src/lib/wm/geometry.test.ts"],
    selector: "geometry", commit:
      "feat(wm): work-area/openRect/clamp/maximize/reclamp/tile geometry (pure TS)",
  },
  {
    id: "E1.9", owner: "deepak", group: "engines", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.8"],
    title: "lib/terminal/dispatch — command engine returning effect intents",
    files: ["frontend/src/lib/terminal/dispatch.ts", "frontend/src/lib/terminal/dispatch.test.ts"],
    selector: "dispatch", commit:
      "feat(terminal): command dispatch table returning effect intents (pure TS)",
  },
  {
    id: "E1.10", owner: "deepak", group: "engines", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.2"],
    title: "lib/clock/analog — hand angles + face geometry",
    files: ["frontend/src/lib/clock/analog.ts", "frontend/src/lib/clock/analog.test.ts"],
    selector: "analog", commit: "feat(clock): analog hand angles + face geometry (pure TS)",
  },
  {
    id: "E1.11", owner: "deepak", group: "engines", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.2"],
    title: "lib/clock/stopwatch — drift-free elapsed + laps + fmtMs",
    files: ["frontend/src/lib/clock/stopwatch.ts", "frontend/src/lib/clock/stopwatch.test.ts"],
    selector: "stopwatch", commit:
      "feat(clock): drift-free stopwatch elapsed + laps + fmtMs (pure TS)",
  },
  {
    id: "E1.12", owner: "deepak", group: "engines", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.2"],
    title: "lib/clock/timer — remaining + ring math + presets + done",
    files: ["frontend/src/lib/clock/timer.ts", "frontend/src/lib/clock/timer.test.ts"],
    selector: "clock/timer", commit:
      "feat(clock): timer remaining + ring offset + presets + done (pure TS)",
  },
  {
    id: "E1.13", owner: "deepak", group: "engines", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.2"],
    title: "lib/clock/world — zone table + day/night rule",
    files: ["frontend/src/lib/clock/world.ts", "frontend/src/lib/clock/world.test.ts"],
    selector: "clock/world", commit: "feat(clock): world-clock zone table + day/night rule (pure TS)",
  },
  {
    id: "E1.14", owner: "deepak", group: "engines", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.3"],
    title: "lib/notes/model — note/todo CRUD + derivations + seed",
    files: ["frontend/src/lib/notes/model.ts", "frontend/src/lib/notes/model.test.ts"],
    selector: "notes/model", commit:
      "feat(notes): note/todo model — CRUD, derivations, seed (pure TS)",
  },
  {
    id: "E1.15", owner: "deepak", group: "engines", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.2"],
    title: "lib/snake/cell — responsive cell-size formula",
    files: ["frontend/src/lib/snake/cell.ts", "frontend/src/lib/snake/cell.test.ts"],
    selector: "snake/cell", commit: "feat(snake): responsive cell-size + board-px formula (pure TS)",
  },
  {
    id: "E1.16", owner: "deepak", group: "engines", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.15"],
    title: "lib/snake/engine — init/dir/step reducer with injected RNG",
    files: ["frontend/src/lib/snake/engine.ts", "frontend/src/lib/snake/engine.test.ts"],
    selector: "snake/engine", commit:
      "feat(snake): engine reducer — init/dir/step/food with injected RNG (pure TS)",
  },
  {
    id: "E1.7", owner: "deepak", group: "engines", kind: "headless", lang: "ts",
    tdd: true, blockedBy: ["E1.5", "E1.6"],
    title: "WM + theme Zustand stores (thin over lib/wm)",
    files: [
      "frontend/src/stores/windowManager.ts", "frontend/src/stores/windowManager.test.ts",
      "frontend/src/stores/theme.ts", "frontend/src/stores/theme.test.ts",
    ],
    selector: "windowManager theme", commit:
      "feat(os): windowManager + theme Zustand stores (thin over lib/wm)",
  },
  {
    id: "E1.17", owner: "deepak", group: "engines", kind: "headless", lang: "py",
    tdd: true, blockedBy: ["E1.1"],
    title: "FastAPI serve seam — retire jinja, serve dist/, SPA fallback",
    files: ["samagra/api/app.py", "tests/test_serve_seam.py", ".gitignore"],
    selector: "tests/test_serve_seam.py", commit:
      "feat(api): serve Vite dist/ with SPA fallback; retire jinja portal route",
    note: "Python task — gate is pytest; SPA fallback route MUST be registered AFTER all /api/* routes",
  },
  {
    id: "E1.18", owner: "deepak", group: "shell+apps", kind: "visual", lang: "ts",
    tdd: true, blockedBy: ["E1.7", "E1.4"],
    title: "Aqua shell chrome — TopBar/Dock/WindowFrame/ContextMenu",
    files: [
      "frontend/src/shell/TopBar.tsx", "frontend/src/shell/Dock.tsx",
      "frontend/src/shell/WindowFrame.tsx", "frontend/src/shell/ContextMenu.tsx",
      "frontend/src/shell/TopBar.test.tsx", "frontend/src/shell/Dock.test.tsx",
      "frontend/src/shell/WindowFrame.test.tsx", "frontend/src/shell/ContextMenu.test.tsx",
      "frontend/src/App.tsx",
    ],
    selector: "shell", commit:
      "feat(shell): aqua chrome — top bar, dock, window frame, context menu",
    note: "unblocks ALL app wrappers; App.tsx wires registry React.lazy apps only",
    visualResidue: "RTL: each chrome component renders; a Dock icon click dispatches openApp",
  },
  {
    id: "E1.25", owner: "khanak", group: "shell+apps", kind: "visual", lang: "ts",
    tdd: true, blockedBy: ["E1.4"],
    title: "Shared leaf components — Pill / Card / Chip / IconButton",
    files: [
      "frontend/src/components/Pill.tsx", "frontend/src/components/Card.tsx",
      "frontend/src/components/Chip.tsx", "frontend/src/components/IconButton.tsx",
      "frontend/src/components/Pill.test.tsx", "frontend/src/components/Card.test.tsx",
      "frontend/src/components/Chip.test.tsx", "frontend/src/components/IconButton.test.tsx",
    ],
    selector: "components", commit:
      "feat(frontend): shared leaf components — Pill/Card/Chip/IconButton",
    visualResidue: "RTL render-smoke per component: renders children + applies the accent prop",
  },
  {
    id: "E1.19", owner: "deepak", group: "shell+apps", kind: "visual", lang: "ts",
    tdd: true, blockedBy: ["E1.18"],
    title: "Dashboard app + /api data hook (useApi)",
    files: [
      "frontend/src/hooks/useApi.ts", "frontend/src/apps/Dashboard/index.tsx",
      "frontend/src/apps/Dashboard/index.test.tsx",
    ],
    selector: "Dashboard", commit: "feat(apps): Dashboard app + typed /api data hook",
    visualResidue: "RTL: mock fetch → canned /api/overview; a hero stat renders",
  },
  {
    id: "E1.20", owner: "deepak", group: "shell+apps", kind: "visual", lang: "ts",
    tdd: true, blockedBy: ["E1.18"],
    title: "Settings app — appearance + device + integrations",
    files: ["frontend/src/apps/Settings/index.tsx", "frontend/src/apps/Settings/index.test.tsx"],
    selector: "Settings", commit: "feat(apps): Settings — appearance, device, integration rows",
    visualResidue: "RTL: clicking the console theme radio calls setTheme('console')",
  },
  {
    id: "E1.21", owner: "deepak", group: "shell+apps", kind: "visual", lang: "ts",
    tdd: true, blockedBy: ["E1.9", "E1.18"],
    title: "Terminal app — thin wrapper over lib/terminal (effect runner)",
    files: ["frontend/src/apps/Terminal/index.tsx", "frontend/src/apps/Terminal/index.test.tsx"],
    selector: "Terminal", commit: "feat(apps): Terminal wrapper — render lines + run effect intents",
    visualResidue: "RTL: submit `open snake` → WM store gains a snake window (mocked store)",
  },
  {
    id: "E1.22", owner: "khanak", group: "shell+apps", kind: "visual", lang: "ts",
    tdd: true, blockedBy: ["E1.10", "E1.11", "E1.12", "E1.13", "E1.18"],
    title: "Clock app — thin wrapper over lib/clock/* + useInterval",
    files: [
      "frontend/src/hooks/useInterval.ts", "frontend/src/hooks/useInterval.test.ts",
      "frontend/src/apps/Clock/index.tsx", "frontend/src/apps/Clock/index.test.tsx",
    ],
    selector: "useInterval Clock", commit:
      "feat(apps): Clock wrapper — analog/stopwatch/timer/world over lib/clock",
    visualResidue: "fake-timer: useInterval fires at interval + clears on unmount; RTL: Clock renders four tabs",
  },
  {
    id: "E1.23", owner: "khanak", group: "shell+apps", kind: "visual", lang: "ts",
    tdd: true, blockedBy: ["E1.14", "E1.3", "E1.18"],
    title: "Notes/To-dos app — thin wrapper over lib/notes + persistence",
    files: ["frontend/src/apps/Notes/index.tsx", "frontend/src/apps/Notes/index.test.tsx"],
    selector: "Notes", commit: "feat(apps): Notes/To-dos wrapper over lib/notes + persistence",
    visualResidue: "RTL (mocked storage): adding a todo calls save('samagra.todos')",
  },
  {
    id: "E1.24", owner: "khanak", group: "shell+apps", kind: "visual", lang: "ts",
    tdd: true, blockedBy: ["E1.16", "E1.15", "E1.3", "E1.18"],
    title: "Snake app — thin wrapper over lib/snake/* + keyboard gating",
    files: ["frontend/src/apps/Snake/index.tsx", "frontend/src/apps/Snake/index.test.tsx"],
    selector: "Snake", commit: "feat(apps): Snake wrapper over lib/snake + keyboard gating",
    visualResidue: "headless gating: isSnakeActive returns false when activeElement is INPUT/TEXTAREA",
  },
  {
    id: "E1.26", owner: "deepak", group: "gate", kind: "headless", lang: "mixed",
    tdd: false, integration: true,
    blockedBy: ["E1.17", "E1.18", "E1.19", "E1.20", "E1.21", "E1.22", "E1.23", "E1.24", "E1.25"],
    title: "E1 green gate + pointer-file sync (single-tree: full gate + docs)",
    files: ["STATUS.html", "SUMMARY.html", "HANDOFF.md"],
    selector: null, commit:
      "docs(status): E1 shell + aqua + OS utilities SHIPPED — sync pointer files",
    note: "single tree: NO branch merges; run full headless gate from the branch, then sync trackers",
  },
];

// ---------------------------------------------------------------------------
// Prompt construction. Every subagent works in THIS checkout (cwd =
// repo root) on branch e1/samagra-os. It reads the exact test + proto constants
// from the plan doc by task id. Real behavior lives in pure lib/** modules.
// ---------------------------------------------------------------------------
const SAFETY = [
  "SAFETY (hard rules): never use `git commit --no-verify`; never set or export SAMAGRA_REVIEW_BREAKGLASS (human-only); never weaken/delete a test or lower a threshold to pass.",
  "A confirmed-CRITICAL Codex finding is a HARD STOP — fix it in-band and re-review, or report it; never bypass.",
  "Do not touch files outside this task's declared file list. Do not switch git branches. Do not run `uvicorn --reload`.",
].join(" ");

function envPreamble(task) {
  return [
    `You are build agent "${task.owner}" for SAMAGRA OS Phase E1, task ${task.id}: ${task.title}.`,
    `Working directory: C:/SandBox/claude_box/TeachingOS (repo root). Git branch: ${CONFIG.branch}. Do NOT change branches.`,
    `Authoritative task spec (EXACT failing test + proto constants — read it first): ${CONFIG.planDoc} — find the section headed "${task.id}".`,
    `Supporting: rubric ${CONFIG.rubricDoc}; proto constants ${CONFIG.protoDoc}.`,
    `This task's files (touch ONLY these): ${task.files.join(", ")}.`,
    task.visualResidue
      ? `This is a VISUAL task. Loop ONLY on the headless residue: ${task.visualResidue}. Do NOT attempt pixel parity — that is a separate human pass. Keep the React component a thin presentational wrapper; all real logic lives in the pure lib/** module it imports.`
      : `Push ALL real behavior into the pure module; keep any React wrapper thin.`,
    SAFETY,
  ].join("\n");
}

function innerTestCmd(task) {
  if (task.lang === "py") return `${CONFIG.venvPytest.replace(" -q", "")} ${task.selector} -q`;
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
function isPureLib(task) {
  return (task.files || []).some((f) => f.includes("/lib/") && f.endsWith(".ts"));
}
function coverageCmd(task) {
  if (task.lang !== "ts") return null;
  if (task.tdd === false) return null;
  return `cd ${CONFIG.frontendDir} && ${CONFIG.covCmd}`;
}
function coverageTarget(task) {
  return isPureLib(task) ? CONFIG.covTargetLib : CONFIG.covTargetWrapper;
}

// ---------------------------------------------------------------------------
// JSON schemas — force structured returns from each subagent.
// ---------------------------------------------------------------------------
const S_TEST = {
  type: "object", additionalProperties: false,
  properties: {
    testsAdded: { type: "number" },
    failedAsExpected: { type: "boolean" },
    note: { type: "string" },
  },
  required: ["testsAdded", "failedAsExpected", "note"],
};
const S_GREEN = {
  type: "object", additionalProperties: false,
  properties: {
    selectorPasses: { type: "boolean" },
    note: { type: "string" },
  },
  required: ["selectorPasses", "note"],
};
const S_GATE = {
  type: "object", additionalProperties: false,
  properties: {
    green: { type: "boolean" },
    failingStage: { type: ["string", "null"] },
    branchCoverage: { type: ["number", "null"] },
    onlySkip: { type: "boolean" },
    note: { type: "string" },
  },
  required: ["green", "failingStage", "branchCoverage", "onlySkip", "note"],
};
const S_REVIEW = {
  type: "object", additionalProperties: false,
  properties: {
    codexDown: { type: "boolean" },
    confirmedCritical: { type: "boolean" },
    findings: {
      type: "object", additionalProperties: false,
      properties: {
        CRITICAL: { type: "number" }, HIGH: { type: "number" },
        MED: { type: "number" }, LOW: { type: "number" },
      },
      required: ["CRITICAL", "HIGH", "MED", "LOW"],
    },
    criticalFindings: { type: "array", items: { type: "string" } },
    topFindingSignature: { type: ["string", "null"] },
    weakestDimension: { type: ["string", "null"] },
    rubricScore: { type: ["number", "null"] },
    g8Present: { type: ["boolean", "null"] },
    onlySkipInDiff: { type: "boolean" },
    note: { type: "string" },
  },
  required: [
    "codexDown", "confirmedCritical", "findings", "criticalFindings",
    "topFindingSignature", "weakestDimension", "rubricScore", "g8Present",
    "onlySkipInDiff", "note",
  ],
};
const S_COMMIT = {
  type: "object", additionalProperties: false,
  properties: {
    committed: { type: "boolean" },
    blockedByHook: { type: "boolean" },
    sha: { type: ["string", "null"] },
    note: { type: "string" },
  },
  required: ["committed", "blockedByHook", "sha", "note"],
};
const S_PREFLIGHT = {
  type: "object", additionalProperties: false,
  properties: {
    codexAvailable: { type: "boolean" },
    version: { type: ["string", "null"] },
    note: { type: "string" },
  },
  required: ["codexAvailable", "version", "note"],
};

// ---------------------------------------------------------------------------
// Fallback rubric scorer (coverage- + fidelity-aware), weights per RUBRIC.md
// (Correctness 40 / Fidelity 20 / Code-quality+Review 25 / Type+Build 15).
// ---------------------------------------------------------------------------
function scoreRubric(task, gate, review) {
  const target = coverageTarget(task);
  const covRequired = coverageCmd(task) != null;
  const covOk = !covRequired || (gate.branchCoverage != null && gate.branchCoverage >= target);
  const noOnlySkip = gate.onlySkip !== true && review.onlySkipInDiff !== true;
  const correctness = gate.green && covOk && noOnlySkip ? 40 : 0;
  const typeBuild = gate.green ? 15 : 0;
  const codeQuality = review.confirmedCritical
    ? 0
    : 25 - 5 * (review.findings ? review.findings.HIGH || 0 : 0);
  let fidelity;
  if (!task.tdd) fidelity = 12;
  else if (task.kind === "visual") fidelity = 12;
  else fidelity = review.g8Present === false ? 0 : 20;
  return Math.max(0, Math.min(100, correctness + typeBuild + Math.max(0, codeQuality) + fidelity));
}

// ---------------------------------------------------------------------------
// Scheduler: next UNBLOCKED task in queue order (single-tree — every blockedBy
// id must actually be in the done-set; no external-owner shortcut).
// ---------------------------------------------------------------------------
function nextUnblocked(queue, done, started) {
  for (const t of queue) {
    if (started.has(t.id)) continue;
    if (t.blockedBy.every((b) => done.has(b))) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Metrics accumulator (RUBRIC.md §3).
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
          for (const s of ["CRITICAL", "HIGH", "MED", "LOW"]) a[s] += r.reviewFindings[s];
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

// ---------------------------------------------------------------------------
// Per-task inner loop: RED → (GREEN → GATE → REVIEW → iterate) → COMMIT.
// ---------------------------------------------------------------------------
async function runTask(task, budgetOk, metrics, degraded) {
  phase(task.group);
  log(`▶ TASK ${task.id} [${task.kind}/${task.lang}, owner=${task.owner}] — ${task.title}`);
  if (task.visualResidue) log(`  (visual — headless residue only: ${task.visualResidue}; pixel parity → human QA)`);

  const rec = {
    id: task.id, kind: task.kind, iterations: 0, testsAdded: 0,
    gatePasses: 0, gateFails: 0, consecutiveGateFails: 0,
    reviewFindings: { CRITICAL: 0, HIGH: 0, MED: 0, LOW: 0 },
    lastFindingSignature: null, repeatedFindingCount: 0,
    rubricScore: 0, status: "pending", escalation: null,
  };
  const label = (s) => `${task.id}:${s}`;

  // ---- RED (or verification-driven setup).
  if (task.tdd) {
    const t = await agent(
      [
        envPreamble(task),
        `STEP = RED. Write the EXACT failing test(s) for ${task.id} from the plan doc — proto constants verbatim. Create the test file(s) in the declared file list. Then run the narrowed selector and CONFIRM it FAILS with the expected error:`,
        `  ${innerTestCmd(task)}`,
        `Do NOT write any production/source code in this step. Return testsAdded (count of test cases/files), failedAsExpected (true only if you ran it and saw the expected failure), and a short note.`,
      ].join("\n"),
      { label: label("red"), phase: task.group, schema: S_TEST },
    );
    rec.testsAdded += (t && t.testsAdded) || 1;
    if (t && t.failedAsExpected === false) {
      log(`  ⚠ RED did not fail as expected (${t.note}); proceeding to GREEN/GATE which will catch it`);
    }
  } else if (task.setup) {
    log(`  SETUP (verification-driven) — ${task.setup}`);
    await agent(
      [
        envPreamble(task),
        `STEP = SETUP/SCAFFOLD. Create the bootstrap files in the declared file list exactly per the plan doc ${task.id} section (package.json scripts MUST include: verify, test, test:cov, lint, typecheck, build, dev). Then run: ${task.setup}. Ensure node_modules installs and a smoke \`cd frontend && npm run verify\` is runnable. Report via the next gate step.`,
      ].join("\n"),
      { label: label("setup"), phase: task.group, schema: S_GREEN },
    );
  }

  // ---- ITERATE.
  let passed = false;
  while (rec.iterations < CONFIG.maxIterationsPerTask && budgetOk()) {
    rec.iterations += 1;
    log(`  ── iteration ${rec.iterations}/${CONFIG.maxIterationsPerTask} ──`);

    // (a) GREEN / scaffold-verify.
    await agent(
      [
        envPreamble(task),
        task.tdd
          ? `STEP = GREEN (iteration ${rec.iterations}). Implement the MINIMUM in the source file(s) to make the narrowed test pass. Keep React thin; real logic in the pure module. Re-run and expect PASS:`
          : `STEP = GREEN (iteration ${rec.iterations}). Finalize the scaffold/config so the full gate is green.`,
        task.tdd ? `  ${innerTestCmd(task)}` : "",
        `Return selectorPasses (did the narrowed selector pass) and a short note.`,
      ].join("\n"),
      { label: label(`green#${rec.iterations}`), phase: task.group, schema: S_GREEN },
    );

    // (b) GATE — full headless verify (+ coverage for TDD TS) and/or pytest.
    const covCmd = coverageCmd(task);
    const gate = await agent(
      [
        envPreamble(task),
        `STEP = GATE (iteration ${rec.iterations}). Run the full headless gate from ${CONFIG.frontendDir} (and pytest for py/mixed). Commands:`,
        ...gateCmds(task).map((c) => `  ${c}`),
        covCmd
          ? `Coverage gate (REQUIRED): ${covCmd} — report the MEASURED per-module branch coverage for THIS task's module under test as branchCoverage (a number 0-100). Target ≥ ${coverageTarget(task)}%. If you cannot measure it, return branchCoverage=null (treated as below target).`
          : `No coverage gate for this task — return branchCoverage=null.`,
        `Also check the staged/working diff for forbidden \`.only\`/\`.skip\` and return onlySkip accordingly.`,
        `Return green (true only if ALL gate commands pass), failingStage (the first failing stage name or null), branchCoverage, onlySkip, and a short note.`,
      ].join("\n"),
      { label: label(`gate#${rec.iterations}`), phase: task.group, schema: S_GATE },
    );
    // Absent coverage on a coverage-bearing task = below target.
    if (covCmd && gate.branchCoverage == null) gate.branchCoverage = 0;
    const covOk = !covCmd || (gate.branchCoverage != null && gate.branchCoverage >= coverageTarget(task));

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
      continue;
    }
    rec.gatePasses += 1;
    rec.consecutiveGateFails = 0;
    log(`  ✓ GATE GREEN (branch coverage ${gate.branchCoverage == null ? "n/a" : gate.branchCoverage + "%"})`);

    // (c) CODEX REVIEW — stage the diff, dry-run the advisory gate, parse verdict.
    const review = await agent(
      [
        envPreamble(task),
        `STEP = CODEX REVIEW (iteration ${rec.iterations}). Stage this task's files then run the advisory review:`,
        `  git add ${task.files.join(" ")}`,
        `  ${CONFIG.reviewCmd}`,
        `Interpret: exit 0 = clean (HIGH/MED/LOW are advisory). exit 1 = confirmed-CRITICAL (hard stop). If \`codex\` is NOT invokable / times out / errors transiently, set codexDown=true (advisory-allow — never wedge) and leave findings at 0.`,
        `Return: codexDown, confirmedCritical, findings{CRITICAL,HIGH,MED,LOW}, criticalFindings[] (short descriptions), topFindingSignature (a stable short string for the top finding, or null), weakestDimension (one of correctness/fidelity/code-quality/type-build, or null), rubricScore (0-100 if you scored it per RUBRIC.md, else null), g8Present (are the proto-constant assertions present — null if N/A), onlySkipInDiff, and a short note.`,
      ].join("\n"),
      { label: label(`review#${rec.iterations}`), phase: task.group, schema: S_REVIEW },
    );

    // Codex-down → structural advisory-allow (never read undefined fields).
    const neutral = {
      codexDown: true, findings: { CRITICAL: 0, HIGH: 0, MED: 0, LOW: 0 },
      confirmedCritical: false, criticalFindings: [], topFindingSignature: null,
      weakestDimension: null, rubricScore: review.rubricScore != null ? review.rubricScore : null,
      g8Present: review.g8Present, onlySkipInDiff: review.onlySkipInDiff, advisoryAllow: true,
    };
    const r = review.codexDown ? neutral : review;
    if (review.codexDown) {
      log(`  ⚠ Codex unavailable → advisory-allow (codex down); NOT wedging`);
      if (degraded.advisoryOnly) degraded.advisoryAllows += 1;
    }

    for (const sev of ["CRITICAL", "HIGH", "MED", "LOW"])
      rec.reviewFindings[sev] += (r.findings && r.findings[sev]) || 0;

    // Repeated identical finding → escalate (spinning).
    if (r.topFindingSignature) {
      if (r.topFindingSignature === rec.lastFindingSignature) rec.repeatedFindingCount += 1;
      else { rec.lastFindingSignature = r.topFindingSignature; rec.repeatedFindingCount = 1; }
      if (rec.repeatedFindingCount >= CONFIG.repeatedFindingStop) {
        rec.status = "escalated";
        rec.escalation = `same review finding ${rec.repeatedFindingCount}x: ${r.topFindingSignature}`;
        log(`  ⛔ ESCALATE — ${rec.escalation}`);
        return rec;
      }
    }

    // Confirmed-CRITICAL → fix in-band (never bypass).
    if (r.confirmedCritical) {
      log(`  ✗ CONFIRMED-CRITICAL — fixing in-band (never --no-verify, never break-glass)`);
      await agent(
        [
          envPreamble(task),
          `STEP = FIX-CRITICAL (iteration ${rec.iterations}). The advisory review confirmed CRITICAL finding(s): ${JSON.stringify(r.criticalFindings)}. Fix the ROOT CAUSE in this task's files, keeping the test green. Do NOT bypass. Report via the next gate iteration.`,
        ].join("\n"),
        { label: label(`fix-critical#${rec.iterations}`), phase: task.group, schema: S_GREEN },
      );
      continue; // re-gate + re-review
    }

    // (d) RUBRIC.
    rec.rubricScore = r.rubricScore != null ? r.rubricScore : scoreRubric(task, gate, r);
    log(`  RUBRIC ${rec.rubricScore}/100 (pass ≥ ${CONFIG.rubricPassThreshold})`);
    if (rec.rubricScore < CONFIG.rubricPassThreshold) {
      log(`  ↻ below threshold — iterate on the weakest dimension (${r.weakestDimension || "unknown"})`);
      await agent(
        [
          envPreamble(task),
          `STEP = IMPROVE-TO-RUBRIC (iteration ${rec.iterations}). Score below ${CONFIG.rubricPassThreshold}. Strengthen the weakest dimension (${r.weakestDimension || "see RUBRIC.md §2"}) — e.g. real edge-case assertions, raise branch coverage to target, remove a HIGH finding, tighten types. Keep tests green. Report via the next gate iteration.`,
        ].join("\n"),
        { label: label(`rubric-fix#${rec.iterations}`), phase: task.group, schema: S_GREEN },
      );
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

  // ---- COMMIT (active core.hooksPath gate re-runs Codex).
  const c = await agent(
    [
      envPreamble(task),
      `STEP = COMMIT. Stage exactly this task's files and commit. The active pre-commit hook (samagra review-staged) WILL run — do not bypass it.`,
      `  git add ${task.files.join(" ")}`,
      `  git commit -m "${task.commit}" -m "${CONFIG.coAuthor}"`,
      `Never amend; never --no-verify. If the hook BLOCKS on a confirmed-CRITICAL (commit fails, exit non-zero), set blockedByHook=true and committed=false — do NOT retry with a bypass. Otherwise return committed=true and the new commit sha.`,
    ].join("\n"),
    { label: label("commit"), phase: task.group, schema: S_COMMIT },
  );
  if (c.blockedByHook) {
    rec.status = "escalated";
    rec.escalation = "pre-commit hook blocked a confirmed-CRITICAL at commit time";
    log(`  ⛔ ESCALATE — ${rec.escalation}`);
    metrics.record(rec);
    return rec;
  }

  // ---- E1.26 single-tree integration = full gate + tracker sync (NO branch merges).
  if (task.integration) {
    const fin = await agent(
      [
        envPreamble(task),
        `STEP = E1 FINAL GATE + POINTER SYNC (single tree — there are NO sibling branches to merge; everything is already on ${CONFIG.branch}).`,
        `1) Run the full headless gate from the branch and confirm green:`,
        `   cd ${CONFIG.frontendDir} && ${CONFIG.verifyCmd}`,
        `   ${CONFIG.venvPytest}`,
        `2) Update the pointer files (${task.files.join(", ")}): mark E1 shipped, record the test summary (frontend specs + python suite counts) and the artefacts, set next = E2. Lift wording from HANDOFF.md/STATUS.html; keep SUMMARY.html jargon-free.`,
        `3) Commit: git add ${task.files.join(" ")} ; git commit -m "${task.commit}" -m "${CONFIG.coAuthor}".`,
        `If the gate is RED, do NOT sync the trackers as "shipped" — set committed=false, blockedByHook=false, and explain in note. Return committed/blockedByHook/sha/note.`,
      ].join("\n"),
      { label: label("final-gate"), phase: task.group, schema: S_COMMIT },
    );
    if (!fin.committed) {
      rec.status = "escalated";
      rec.escalation = `E1.26 final gate not green / not synced: ${fin.note}`;
      log(`  ⛔ ESCALATE — ${rec.escalation}`);
      metrics.record(rec);
      return rec;
    }
  }

  rec.status = "done";
  metrics.record(rec);
  log(`  ✓ TASK ${task.id} ${rec.status} — ${rec.iterations} iter, rubric ${rec.rubricScore}`);
  return rec;
}

// =============================================================================
// TOP-LEVEL BODY — the loop.
// =============================================================================
log("=== SAMAGRA OS · E1 · combined single-tree build loop START ===");
const b = budget && typeof budget.remaining === "function" ? budget : { total: null, remaining: () => Infinity };
const hasBudget = b.total != null && b.total !== Infinity;
const budgetOk = () => !hasBudget || b.remaining() > CONFIG.tokenFloor;
log(`branch=${CONFIG.branch} queue=${QUEUE.length} tasks rubric-pass≥${CONFIG.rubricPassThreshold} maxIter=${CONFIG.maxIterationsPerTask}`);
log(`budget: ${hasBudget ? `target=${b.total} floor=${CONFIG.tokenFloor}` : "no target → maxTaskDispatches ceiling is the backstop"}`);

const metrics = makeMetrics();
const done = new Set();
const started = new Set();
const degraded = { advisoryOnly: false, advisoryAllows: 0 };

// STARTUP PREFLIGHT — codex on PATH? A missing codex exit-0 is NOT a clean review.
phase("preflight");
const pf = await agent(
  [
    `You are the preflight check for the SAMAGRA OS E1 build, working in C:/SandBox/claude_box/TeachingOS.`,
    `Verify the advisory Codex reviewer is invokable. Run: \`codex --version\` (and \`where codex\`; check a CODEX_BIN env var).`,
    `Also confirm the current git branch is ${CONFIG.branch} (run \`git rev-parse --abbrev-ref HEAD\`) and that ${CONFIG.planDoc} exists.`,
    `Return codexAvailable (true only if codex --version succeeded), version (string or null), and a note that also states the current branch and whether the plan doc was found.`,
  ].join("\n"),
  { label: "codex-preflight", phase: "preflight", schema: S_PREFLIGHT },
);
if (pf.codexAvailable === true) {
  log(`  ✓ codex on PATH (${pf.version || "version unknown"}) — ${pf.note}`);
} else {
  degraded.advisoryOnly = true;
  log(`  ⚠ codex NOT invokable → ADVISORY-ONLY DEGRADED mode (gate non-enforcing). ${pf.note}`);
  log(`  ⚠ ESCALATE to owner: every 'GATE GREEN' below is advisory-allow, NOT a real Codex review.`);
}

// Drive the DAG in queue order, one task at a time (single tree → commits serialize).
let dispatches = 0;
while (budgetOk()) {
  if (dispatches >= CONFIG.maxTaskDispatches) {
    log(`!! max task dispatches (${CONFIG.maxTaskDispatches}) reached — halting (re-entry ceiling)`);
    break;
  }
  const task = nextUnblocked(QUEUE, done, started);
  if (!task) { log("queue drained (all E1 tasks dispatched)"); break; }
  started.add(task.id);
  dispatches += 1;
  const rec = await runTask(task, budgetOk, metrics, degraded);
  if (rec.status === "done") {
    done.add(task.id);
  } else {
    log(`!! ${task.id} ${rec.status}: ${rec.escalation}`);
    log("!! halting new-task dispatch — owner review required (see RUBRIC.md §4 STOP/ESCALATE)");
    break;
  }
}

const s = metrics.summary();
s.codexDegraded = degraded.advisoryOnly;
s.advisoryAllows = degraded.advisoryAllows;
phase("gate");
log("=== SAMAGRA OS · E1 · combined loop END ===");
if (degraded.advisoryOnly)
  log(`!! CODEX DEGRADED: advisory-only mode — ${degraded.advisoryAllows} advisory-allow(s); NOT a clean review record.`);
log(
  `done=${s.tasksDone}/${QUEUE.length} escalated=${s.tasksEscalated} avgIter=${s.avgIterationsPerTask.toFixed(2)} ` +
    `testsAdded=${s.testsAdded} gatePassRate=${(s.gatePassRate * 100).toFixed(0)}% ` +
    `findings(C/H/M/L)=${s.reviewFindings.CRITICAL}/${s.reviewFindings.HIGH}/${s.reviewFindings.MED}/${s.reviewFindings.LOW}`,
);
for (const e of s.escalations) log(`  escalation → ${e}`);
log("REMINDER: pixel/interaction parity (E1.18–E1.25) is a SEPARATE human QA pass — NOT signalled by this loop (RUBRIC.md §6).");
return { metrics: s, done: [...done], degraded: degraded.advisoryOnly };
