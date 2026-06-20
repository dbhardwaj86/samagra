// =============================================================================
// SAMAGRA OS · FIDELITY PASS · single-tree Workflow  (runs on branch e1/samagra-os)
// =============================================================================
//
// PURPOSE. E1 shipped correct BEHAVIOR (engines/wm/apps all headless-green) but
// the visual layer is bare: aqua-only, letter-badge icons, unstyled app bodies.
// This workflow ports the design prototype's EXACT look into the React layer:
//   • all 3 themes (aqua / console / samagra) — distinct chrome, not color swaps
//   • real icons (the prototype's exact 24×24 SVG ICONS paths, inline)
//   • pixel-faithful restyle of the shell + the 6 BUILT apps
//
// WHY A WORKFLOW + A SEPARATE HUMAN/VISION PASS. Fidelity is a VISUAL property a
// headless gate cannot certify. So each task ports the EXACT documented CSS from
// the prototype (.dc.html) and matches the reference screenshot it is given to
// READ — low-ambiguity porting, headless-gated only for non-breakage (lint→tsc→
// vitest→build stays green; tests are adapted to the new markup). PIXEL/INTERACTION
// PARITY IS THEN VERIFIED BY A BROWSER-VISION QA PASS (owner/main session) per
// surface×theme against screenshots/ — that pass is OUTSIDE this loop and is the
// real fidelity sign-off. Coverage is ADVISORY here (presentational code).
//
// REFERENCES (read-only, on disk — absolute paths):
//   HTML prototype : .design-ref/design_handoff_samagra_os/SAMAGRA OS.dc.html
//   README spec    : .design-ref/design_handoff_samagra_os/README.md
//   Screenshots    : .design-ref/design_handoff_samagra_os/screenshots/<name>.png
//   THEMES tokens  : .dc.html lines ~59-95   | ICONS paths : lines ~96-114
//   APPS meta      : .dc.html lines ~115-133 | term palettes: lines ~752-754
//
// SAFETY (unchanged from E1): never --no-verify; never self-break-glass; a
// confirmed-CRITICAL is a hard stop; codex-down → advisory-allow (never wedge);
// no Date.now()/Math.random()/new Date(). Keep all real logic in the already-green
// pure lib/** modules — this pass is STYLE + MARKUP + THEMING only, do not change
// engine math.
// =============================================================================

export const meta = {
  name: "samagra-os-fidelity",
  description:
    "Fidelity pass for SAMAGRA OS: port the prototype's exact 3 themes (aqua/console/samagra chrome), real inline-SVG icons, and pixel-faithful restyle of the shell + 6 built apps (Dashboard/Settings/Terminal/Clock/Notes/Snake). Ports exact documented CSS/tokens/icon-paths against the reference screenshots; headless-gated for non-breakage; pixel parity is a separate browser-vision pass.",
  phases: [
    { title: "preflight", detail: "codex + branch + design-ref present" },
    { title: "foundation", detail: "theme tokens (3) + provider + fonts; real icons" },
    { title: "chrome", detail: "aqua / console / samagra shell chrome" },
    { title: "apps", detail: "restyle Dashboard/Settings/Terminal/Clock/Notes/Snake" },
    { title: "gate", detail: "full headless gate + tracker note (visual QA pending)" },
  ],
};

const CONFIG = {
  maxIterationsPerTask: 6,
  buildRedStopThreshold: 3,
  repeatedFindingStop: 2,
  rubricPassThreshold: 80, // slightly below E1's 85 — fidelity dimension is partly human-verified
  maxTaskDispatches: 60,
  tokenFloor: 60000,
  branch: "e1/samagra-os",
  frontendDir: "frontend",
  designRoot: ".design-ref/design_handoff_samagra_os",
  designHtml: ".design-ref/design_handoff_samagra_os/SAMAGRA OS.dc.html",
  designReadme: ".design-ref/design_handoff_samagra_os/README.md",
  shots: ".design-ref/design_handoff_samagra_os/screenshots",
  verifyCmd: "npm run verify",
  venvPytest: ".venv/Scripts/python -m pytest -q",
  reviewCmd: ".venv/Scripts/python -m samagra review-staged",
  coAuthor: "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>",
};

// ---------------------------------------------------------------------------
// Fidelity task queue. `shots` = reference screenshot basenames the agent MUST
// Read (vision target). `htmlHint` = where the exact values live in .dc.html.
// `kind` is always visual-fidelity → coverage advisory; verify is the hard gate.
// ---------------------------------------------------------------------------
const QUEUE = [
  {
    id: "FD1", group: "foundation", blockedBy: [],
    title: "Theme system — port all 3 THEMES token sets + CSS-var provider + fonts + 3-theme store",
    files: [
      "frontend/src/themes/index.ts", "frontend/src/themes/index.test.ts",
      "frontend/src/stores/theme.ts", "frontend/src/stores/theme.test.ts",
      "frontend/src/shell/ThemeRoot.tsx", "frontend/src/shell/ThemeRoot.test.tsx",
      "frontend/index.html",
    ],
    selector: "themes theme ThemeRoot",
    htmlHint: "THEMES map at .dc.html lines ~59-95 (aqua/console/samagra: bg, winBg/winBlur, bar, text/muted/line, cardBg/subBg, accent/accent2, winRadius, shadow, dock*, font/wordmark, kind/dockPos/controlSide/barH/rail). README §Design Tokens.",
    shots: ["aqua-01-dashboard", "console-01-dashboard", "samagra-01-dashboard"],
    commit: "feat(themes): port all 3 theme token sets + CSS-var ThemeRoot + fonts + 3-theme store",
    note: "ThemeRoot applies the active theme's tokens as CSS custom properties on a root element; load Inter/Hanken Grotesk/JetBrains Mono/Tiro Devanagari Hindi via index.html <link>; theme store cycles all 3.",
  },
  {
    id: "FD2", group: "foundation", blockedBy: ["FD1"],
    title: "Icon system — port exact ICONS SVG paths to an inline <Icon> + per-app accent AppIcon tile",
    files: [
      "frontend/src/components/icons-data.ts",
      "frontend/src/components/Icon.tsx", "frontend/src/components/Icon.test.tsx",
      "frontend/src/components/AppIcon.tsx", "frontend/src/components/AppIcon.test.tsx",
    ],
    selector: "Icon AppIcon",
    htmlHint: "ICONS map at .dc.html lines ~96-114 — copy each path string VERBATIM (split multi-path on '|' into multiple <path>). 24×24 viewBox, stroke 1.9, round caps/joins, fill none. APPS accents lines ~115-133.",
    shots: ["aqua-01-dashboard"],
    commit: "feat(icons): inline-SVG Icon from exact ICONS paths + per-app accent AppIcon tile",
    note: "Icon renders the verbatim prototype path data (NOT lucide-react substitutes) for pixel-identity. AppIcon = rounded tile with the app's accent gradient fill, used in the dock.",
  },
  {
    id: "CH1", group: "chrome", blockedBy: ["FD2"],
    title: "Aqua chrome fidelity — TopBar (30px) + floating Dock (46px icon tiles, hover-lift) + WindowFrame (traffic-lights, r13, 38px bar) + ContextMenu (216)",
    files: [
      "frontend/src/shell/TopBar.tsx", "frontend/src/shell/TopBar.test.tsx",
      "frontend/src/shell/Dock.tsx", "frontend/src/shell/Dock.test.tsx",
      "frontend/src/shell/WindowFrame.tsx", "frontend/src/shell/WindowFrame.test.tsx",
      "frontend/src/shell/ContextMenu.tsx", "frontend/src/shell/ContextMenu.test.tsx",
      "frontend/src/App.tsx",
    ],
    selector: "shell TopBar Dock WindowFrame ContextMenu App",
    htmlHint: "README §Global Layout (aqua), §Windows (radius 13, 38px title bar, traffic lights #ff5f57/#febc2e/#28c840 left, inactive dots #cdcdd4), §Context menus (216/r12). Dock 46×46 gradient tiles, hover translateY(-7px) scale(1.12), radius 20.",
    shots: ["aqua-01-dashboard", "aqua-21-settings", "aqua-19-terminal"],
    commit: "feat(shell): aqua chrome fidelity — top bar, floating icon dock, traffic-light frame, context menu",
    note: "Use AppIcon tiles in the dock (no letter badges). WindowFrame consumes theme tokens (winBg/winBlur/winRadius/shadow). App.tsx still lazy-loads apps via the frozen registry.",
  },
  {
    id: "CH2", group: "chrome", blockedBy: ["CH1"],
    title: "Console chrome — dark bg+grid, bottom Taskbar (50px) + Start button/menu, right-side neon window controls (28×23) + 2px top accent + glow ring, r10",
    files: [
      "frontend/src/shell/Taskbar.tsx", "frontend/src/shell/Taskbar.test.tsx",
      "frontend/src/shell/StartMenu.tsx", "frontend/src/shell/StartMenu.test.tsx",
      "frontend/src/shell/WindowFrame.tsx", "frontend/src/shell/WindowFrame.test.tsx",
      "frontend/src/App.tsx",
    ],
    selector: "Taskbar StartMenu WindowFrame App",
    htmlHint: "README §Global Layout (console: no top bar, taskbar 50px + Start menu + running-window buttons + clock; work area y:8 h:vh-66), §Windows (console controls right as 28×23 icon buttons minimize/maximize/close, close hover #ef4444, 2px top accent border + neon glow ring when active, radius 10). console-07-start-menu for the Start menu.",
    shots: ["console-01-dashboard", "console-06-terminal", "console-07-start-menu"],
    commit: "feat(shell): console theme chrome — taskbar + Start menu + right-side neon window controls",
    note: "WindowFrame gains a per-theme variant (controlSide from theme). When theme=console, App renders Taskbar instead of TopBar/Dock. Active window gets the accent glow ring.",
  },
  {
    id: "CH3", group: "chrome", blockedBy: ["CH2"],
    title: "Samagra chrome — warm cream bg, top bar (32px, Devanagari समग्र wordmark), left rail Dock (66px, active accent bar), right-side controls, r15",
    files: [
      "frontend/src/shell/Rail.tsx", "frontend/src/shell/Rail.test.tsx",
      "frontend/src/shell/TopBar.tsx", "frontend/src/shell/TopBar.test.tsx",
      "frontend/src/shell/WindowFrame.tsx", "frontend/src/shell/WindowFrame.test.tsx",
      "frontend/src/App.tsx",
    ],
    selector: "Rail TopBar WindowFrame App",
    htmlHint: "README §Global Layout (samagra: top bar 32px Devanagari wordmark समग्र, left rail dock width 66 with active app left accent bar, work area x:rail+8). §Windows radius 15, right controls. samagra-01-dashboard shows rail + bar.",
    shots: ["samagra-01-dashboard", "samagra-05-settings"],
    commit: "feat(shell): samagra theme chrome — Devanagari top bar + left rail dock + warm window frame",
    note: "When theme=samagra, App renders TopBar (Devanagari wordmark) + left Rail (AppIcon tiles, active = left accent bar). Work area shifts right by the rail width.",
  },
  {
    id: "AP1", group: "apps", blockedBy: ["CH3"],
    title: "Dashboard fidelity — greeting + tests-green pill, stat grid (auto-fill 140), Pipelines bars, Board avatars+dots, Recent activity timeline",
    files: ["frontend/src/apps/Dashboard/index.tsx", "frontend/src/apps/Dashboard/index.test.tsx"],
    selector: "Dashboard",
    htmlHint: "README §Apps#1 Dashboard (#4f46e5, 940×610). Stat numbers 24-25px/700 tabular-nums, colored. Pipelines = labeled progress bars (Lectures 74% / Questions·QX 91% / Print&Proofing 46% / Editorial seeds 33%). Board = avatars+green dots (Claude-Deepak CEO / Khanak COO / Codex Architect). Recent activity = accent left-border timeline. Keep the existing useApi hook; style its rendered data.",
    shots: ["aqua-01-dashboard", "console-01-dashboard", "samagra-01-dashboard"],
    commit: "feat(apps): Dashboard fidelity — stat grid, pipeline bars, board, recent activity",
    note: "Use Card/Pill/Chip components + theme tokens so it renders correctly in all 3 themes.",
  },
  {
    id: "AP2", group: "apps", blockedBy: ["CH3"],
    title: "Settings fidelity — Appearance (3 theme swatch cards = the real switcher) + Device toggle + Integration rows",
    files: ["frontend/src/apps/Settings/index.tsx", "frontend/src/apps/Settings/index.test.tsx"],
    selector: "Settings",
    htmlHint: "README §Apps#17 Settings (#475569, 760×580). Appearance: 3 theme swatch cards, selected = accent border, clicking sets theme (wire to theme store setTheme). Device: Desktop/Mobile toggle. Integrations: status rows with active / needs-creds pills.",
    shots: ["aqua-21-settings", "console-05-settings", "samagra-05-settings"],
    commit: "feat(apps): Settings fidelity — theme swatch switcher, device toggle, integration rows",
    note: "The 3 swatch cards are the production theme switcher — each previews its theme's gradient and calls setTheme on click.",
  },
  {
    id: "AP3", group: "apps", blockedBy: ["CH3"],
    title: "Terminal fidelity — monospace shell, per-theme palette, prompt devesh@samagra:~$",
    files: ["frontend/src/apps/Terminal/index.tsx", "frontend/src/apps/Terminal/index.test.tsx"],
    selector: "Terminal",
    htmlHint: "README §Apps#15 Terminal (#10b981, 740×480, JetBrains Mono 12.5px). Per-theme palette at .dc.html lines ~752-754 (console bg#05080e fg#a7bdd6 prompt#34d399; samagra bg#241a11 fg#efe2cf prompt#f0a35e; aqua default bg#1b1d24). Keep lib/terminal dispatch — style the line rendering + prompt only.",
    shots: ["aqua-19-terminal", "console-06-terminal"],
    commit: "feat(apps): Terminal fidelity — mono shell, per-theme palette, line-class colors",
    note: "Do not change parser/dispatch logic (already green in lib/terminal). Style output lines + prompt + welcome banner.",
  },
  {
    id: "AP4", group: "apps", blockedBy: ["CH3"],
    title: "Clock fidelity — analog SVG face, stopwatch, timer ring, world list (4 tabs)",
    files: ["frontend/src/apps/Clock/index.tsx", "frontend/src/apps/Clock/index.test.tsx"],
    selector: "Clock",
    htmlHint: "README §Apps#13 Clock (#0ea5e9, 560×640). Analog: 300×300 SVG, 60 ticks (every 5th bold), 12/3/6/9 numerals, hour/min/sec hands (sec in accent 2px + tail), center pin, digital HH:MM:SS AM/PM 38px tabular-nums + date + tz. Stopwatch MM:SS 62px + .cs accent. Timer ring r110 stroke13 + presets 1/5/10/25. World zone rows day/night chip. All math already in lib/clock/* — render only.",
    shots: ["aqua-14-clock-analog", "aqua-15-clock-stopwatch", "aqua-16-clock-timer", "aqua-17-clock-world"],
    commit: "feat(apps): Clock fidelity — analog face, stopwatch, timer ring, world clock",
    note: "Consume lib/clock/{analog,stopwatch,timer,world} outputs; build the SVG face + ring from their returned geometry.",
  },
  {
    id: "AP5", group: "apps", blockedBy: ["CH3"],
    title: "Notes fidelity — Notes tab (200px list + editor + Autosaved footer) & To-dos tab (checkboxes, filter chips)",
    files: ["frontend/src/apps/Notes/index.tsx", "frontend/src/apps/Notes/index.test.tsx"],
    selector: "Notes",
    htmlHint: "README §Apps#12 Notes (#f59e0b, 840×600). Notes: left list 200px + '+ New note', editor title input 18px/700, meta 'N words · edited <date>', body textarea 14px lh1.65, footer '● Autosaved' + Delete(red), selected = accent tint + 1px accent border. To-dos: add input + Add, filter chips All/Active/Done, 20×20 checkbox (filled accent + white check), strikethrough+muted when done, hover × delete, footer 'N tasks left' + 'Clear completed'. lib/notes/model + persistence already green.",
    shots: ["aqua-12-notes", "aqua-13-notes-todos", "console-03-notes", "samagra-03-notes"],
    commit: "feat(apps): Notes fidelity — notes list/editor + to-dos with filters",
    note: "Keep autosave wiring (save on mutation) and lib/notes model; style only.",
  },
  {
    id: "AP6", group: "apps", blockedBy: ["CH3"],
    title: "Snake fidelity — themed board (grid lines, inset, r14), score/best header, level toggle, D-pad, overlay",
    files: ["frontend/src/apps/Snake/index.tsx", "frontend/src/apps/Snake/index.test.tsx"],
    selector: "Snake",
    htmlHint: "README §Apps#14 Snake (#22c55e, 480×680). Board themed dark/cream + subtle grid + inset shadow + radius 14; snake = rounded rects (head solid accent, body fades), food = filled circle + halo (#fbbf24, or #d9601a in samagra). Header Score(accent)+Best. Relaxed/Normal segmented toggle. D-pad 50px keys + Pause/Resume + New game. Overlay = blurred scrim + Start/Resume/Play-again. lib/snake/{engine,cell} already green.",
    shots: ["aqua-18-snake", "console-04-snake", "samagra-04-snake"],
    commit: "feat(apps): Snake fidelity — themed board, header, level toggle, D-pad, overlay",
    note: "Keep engine/cell math + keyboard gating; this is board/controls styling only.",
  },
  {
    id: "QA1", group: "gate", blockedBy: ["AP1", "AP2", "AP3", "AP4", "AP5", "AP6"],
    title: "Fidelity gate — full headless verify + pytest + tracker note (browser-vision QA pending)",
    files: ["STATUS.html", "SUMMARY.html", "HANDOFF.md"],
    selector: null, tdd: false, integration: true,
    htmlHint: "n/a — verification + docs only.",
    shots: [],
    commit: "docs(status): SAMAGRA OS fidelity pass (3 themes + icons) — headless green; visual QA pending",
    note: "Run npm run verify + pytest from the branch; confirm green; note in trackers that the 3-theme fidelity layer landed and the browser-vision pixel pass is the next (human/main-session) step.",
  },
];

// ---------------------------------------------------------------------------
const SAFETY =
  "SAFETY: never `git commit --no-verify`; never set SAMAGRA_REVIEW_BREAKGLASS; never weaken/delete a test to pass; a confirmed-CRITICAL is a HARD STOP (fix in-band or report). Do NOT change engine math in lib/** — this is STYLE/MARKUP/THEMING only. Touch ONLY this task's declared files. Do not switch git branches.";

function envPreamble(task) {
  const shotList = (task.shots || []).map((s) => `${CONFIG.shots}/${s}.png`);
  return [
    `You are a FIDELITY agent for SAMAGRA OS, task ${task.id}: ${task.title}.`,
    `Working dir: C:/SandBox/claude_box/TeachingOS (repo root). Branch: ${CONFIG.branch}. Do NOT change branches.`,
    `GOAL: make this surface look EXACTLY like the design. Two authoritative references — READ BOTH:`,
    `  1) The prototype's exact values: ${CONFIG.designHtml} — ${task.htmlHint}`,
    `  2) The visual target screenshot(s) — use the Read tool on each (they render as images): ${shotList.join(" ; ") || "(none — verification/docs task)"}`,
    `Also available: the spec ${CONFIG.designReadme}.`,
    `Port the EXACT documented tokens/CSS/paths (colors, radii, sizes, shadows, fonts, spacing) — do not invent values. Match the screenshot layout/density. The prototype runtime support.js must NOT be ported — read it as spec only.`,
    `Theme correctness: drive all colors/sizes from the theme tokens (FD1) so the surface renders correctly in aqua, console AND samagra. Use the <Icon>/<AppIcon> components (FD2) — never letter badges.`,
    `Files (touch ONLY these): ${task.files.join(", ")}.`,
    `Tests: adapt the existing RTL tests to the new markup and ADD assertions for the fidelity hooks you introduce (aria-labels, presence of <svg> icons, theme data-attribute/CSS-var application, key measurements from the exact tokens). Keep them meaningful, not tautological. Keep all engine/lib tests untouched and green.`,
    SAFETY,
  ].join("\n");
}

function gateCmds(task) {
  const cmds = [`cd ${CONFIG.frontendDir} && ${CONFIG.verifyCmd}`];
  if (task.integration) cmds.push(CONFIG.venvPytest);
  return cmds;
}

// Schemas (same shapes as the E1 loop).
const S_TEST = { type: "object", additionalProperties: false, properties: { testsAdded: { type: "number" }, failedAsExpected: { type: "boolean" }, note: { type: "string" } }, required: ["testsAdded", "failedAsExpected", "note"] };
const S_GREEN = { type: "object", additionalProperties: false, properties: { selectorPasses: { type: "boolean" }, note: { type: "string" } }, required: ["selectorPasses", "note"] };
const S_GATE = { type: "object", additionalProperties: false, properties: { green: { type: "boolean" }, failingStage: { type: ["string", "null"] }, fidelitySelfScore: { type: ["number", "null"] }, onlySkip: { type: "boolean" }, note: { type: "string" } }, required: ["green", "failingStage", "fidelitySelfScore", "onlySkip", "note"] };
const S_REVIEW = { type: "object", additionalProperties: false, properties: { codexDown: { type: "boolean" }, confirmedCritical: { type: "boolean" }, findings: { type: "object", additionalProperties: false, properties: { CRITICAL: { type: "number" }, HIGH: { type: "number" }, MED: { type: "number" }, LOW: { type: "number" } }, required: ["CRITICAL", "HIGH", "MED", "LOW"] }, criticalFindings: { type: "array", items: { type: "string" } }, topFindingSignature: { type: ["string", "null"] }, weakestDimension: { type: ["string", "null"] }, rubricScore: { type: ["number", "null"] }, onlySkipInDiff: { type: "boolean" }, note: { type: "string" } }, required: ["codexDown", "confirmedCritical", "findings", "criticalFindings", "topFindingSignature", "weakestDimension", "rubricScore", "onlySkipInDiff", "note"] };
const S_COMMIT = { type: "object", additionalProperties: false, properties: { committed: { type: "boolean" }, blockedByHook: { type: "boolean" }, sha: { type: ["string", "null"] }, note: { type: "string" } }, required: ["committed", "blockedByHook", "sha", "note"] };
const S_PRE = { type: "object", additionalProperties: false, properties: { codexAvailable: { type: "boolean" }, designRefPresent: { type: "boolean" }, branch: { type: "string" }, note: { type: "string" } }, required: ["codexAvailable", "designRefPresent", "branch", "note"] };

function scoreRubric(task, gate, review) {
  // Fidelity workflow: hard gate is verify-green; coverage is advisory. Weight:
  // Correctness/no-break 35, Fidelity(self+review) 35, Code-quality 20, Type/Build 10.
  const noOnlySkip = gate.onlySkip !== true && review.onlySkipInDiff !== true;
  const correctness = gate.green && noOnlySkip ? 35 : 0;
  const typeBuild = gate.green ? 10 : 0;
  const codeQuality = review.confirmedCritical ? 0 : 20 - 5 * (review.findings ? review.findings.HIGH || 0 : 0);
  const fid = gate.fidelitySelfScore != null ? Math.max(0, Math.min(35, Math.round(gate.fidelitySelfScore * 0.35))) : 24;
  return Math.max(0, Math.min(100, correctness + typeBuild + Math.max(0, codeQuality) + fid));
}

function nextUnblocked(queue, done, started) {
  for (const t of queue) {
    if (started.has(t.id)) continue;
    if (t.blockedBy.every((b) => done.has(b))) return t;
  }
  return null;
}

function makeMetrics() {
  const records = [];
  return {
    records, record: (r) => records.push(r),
    summary() {
      const done = records.filter((r) => r.status === "done");
      const esc = records.filter((r) => r.status !== "done");
      const it = records.reduce((a, r) => a + r.iterations, 0);
      const f = records.reduce((a, r) => { for (const s of ["CRITICAL", "HIGH", "MED", "LOW"]) a[s] += r.reviewFindings[s]; return a; }, { CRITICAL: 0, HIGH: 0, MED: 0, LOW: 0 });
      return { tasksDone: done.length, tasksEscalated: esc.length, avgIterationsPerTask: records.length ? it / records.length : 0, reviewFindings: f, escalations: esc.map((r) => `${r.id}: ${r.escalation}`) };
    },
  };
}

// Guard: a transient terminal API failure makes agent() return null (after the
// runtime's own retries). Never deref null — substitute a safe fallback so one
// dropped call degrades gracefully (gate→red→retry, review→advisory-allow,
// commit→escalate) instead of crashing the whole run. Resume re-runs the dropped
// call live; identical (prompt,opts) keep every completed call a cache hit.
async function agentOr(prompt, opts, fallback) {
  const r = await agent(prompt, opts);
  if (r == null) { log(`  ⚠ agent ${opts.label} returned null (transient) → safe fallback`); return fallback; }
  return r;
}

async function runTask(task, budgetOk, metrics, degraded) {
  phase(task.group);
  log(`▶ ${task.id} [${task.group}] — ${task.title}`);
  const rec = { id: task.id, iterations: 0, gatePasses: 0, gateFails: 0, consecutiveGateFails: 0, reviewFindings: { CRITICAL: 0, HIGH: 0, MED: 0, LOW: 0 }, lastFindingSignature: null, repeatedFindingCount: 0, rubricScore: 0, status: "pending", escalation: null };
  const label = (s) => `${task.id}:${s}`;
  const tdd = task.tdd !== false;

  if (tdd) {
    const t = await agent(
      [envPreamble(task),
        `STEP = RED/TESTS. First Read the reference screenshot(s) and the prototype values. Then update/author the RTL tests for the new markup + fidelity hooks (icon <svg> present, theme CSS-vars applied, key measurements). Run the narrowed selector and note the state:`,
        `  cd ${CONFIG.frontendDir} && npm test -- ${task.selector}`,
        `Return testsAdded, failedAsExpected (true if new assertions fail pre-implementation), note.`].join("\n"),
      { label: label("red"), phase: task.group, schema: S_TEST });
    log(`  tests: +${(t && t.testsAdded) || 0} (${t && t.note ? t.note.slice(0, 80) : ""})`);
  } else {
    log(`  (verification/docs task — no RED)`);
  }

  let passed = false;
  while (rec.iterations < CONFIG.maxIterationsPerTask && budgetOk()) {
    rec.iterations += 1;
    log(`  ── iter ${rec.iterations}/${CONFIG.maxIterationsPerTask} ──`);

    await agent(
      [envPreamble(task),
        task.integration
          ? `STEP = FINALIZE (iteration ${rec.iterations}). Run the full gate and update the trackers (${task.files.join(", ")}): note the 3-theme + icon fidelity layer landed and that the browser-vision pixel pass is the next step. Do not claim pixel parity.`
          : `STEP = IMPLEMENT (iteration ${rec.iterations}). Port the exact styling/markup to match the screenshot + documented tokens. Make the narrowed tests pass; keep components presentational (logic stays in lib/**). Re-run: cd ${CONFIG.frontendDir} && npm test -- ${task.selector}.`,
        `Return selectorPasses + a short note.`].join("\n"),
      { label: label(`impl#${rec.iterations}`), phase: task.group, schema: S_GREEN });

    const gate = await agentOr(
      [envPreamble(task),
        `STEP = GATE (iteration ${rec.iterations}). Run from the repo root:`,
        ...gateCmds(task).map((c) => `  ${c}`),
        `Then self-assess fidelity vs the reference screenshot you Read: fidelitySelfScore 0-100 (honest — how closely does the rendered markup/tokens match the screenshot's layout, colors, sizes, icons?).`,
        `Check the diff for forbidden .only/.skip. Return green (all gate cmds pass), failingStage (or null), fidelitySelfScore, onlySkip, note.`].join("\n"),
      { label: label(`gate#${rec.iterations}`), phase: task.group, schema: S_GATE },
      { green: false, failingStage: "agent-unavailable (transient API)", fidelitySelfScore: null, onlySkip: false, note: "agent returned null" });

    if (!gate.green) {
      rec.gateFails += 1; rec.consecutiveGateFails += 1;
      log(`  ✗ GATE RED (${gate.failingStage || "?"})`);
      if (rec.consecutiveGateFails >= CONFIG.buildRedStopThreshold) {
        rec.status = "escalated"; rec.escalation = `gate red ${rec.consecutiveGateFails}x on ${task.id} (${gate.failingStage})`;
        log(`  ⛔ ESCALATE — ${rec.escalation}`); return rec;
      }
      continue;
    }
    rec.gatePasses += 1; rec.consecutiveGateFails = 0;
    log(`  ✓ GATE GREEN (fidelity self-score ${gate.fidelitySelfScore == null ? "n/a" : gate.fidelitySelfScore})`);

    const review = await agentOr(
      [envPreamble(task),
        `STEP = CODEX REVIEW (iteration ${rec.iterations}). Stage this task's files then run the advisory review:`,
        `  git add ${task.files.join(" ")}`,
        `  ${CONFIG.reviewCmd}`,
        `exit 0 = clean | exit 1 = confirmed-CRITICAL (hard stop) | codex not invokable/timeout → set codexDown=true (advisory-allow, never wedge).`,
        `Return codexDown, confirmedCritical, findings{C,H,M,L}, criticalFindings[], topFindingSignature(or null), weakestDimension(or null), rubricScore(0-100 or null), onlySkipInDiff, note.`].join("\n"),
      { label: label(`review#${rec.iterations}`), phase: task.group, schema: S_REVIEW },
      { codexDown: true, confirmedCritical: false, findings: { CRITICAL: 0, HIGH: 0, MED: 0, LOW: 0 }, criticalFindings: [], topFindingSignature: null, weakestDimension: null, rubricScore: null, onlySkipInDiff: false, note: "agent returned null" });

    const neutral = { codexDown: true, findings: { CRITICAL: 0, HIGH: 0, MED: 0, LOW: 0 }, confirmedCritical: false, criticalFindings: [], topFindingSignature: null, weakestDimension: null, rubricScore: review.rubricScore != null ? review.rubricScore : null, onlySkipInDiff: review.onlySkipInDiff };
    const r = review.codexDown ? neutral : review;
    if (review.codexDown) { log(`  ⚠ codex down → advisory-allow (not wedging)`); if (degraded.advisoryOnly) degraded.advisoryAllows += 1; }
    for (const s of ["CRITICAL", "HIGH", "MED", "LOW"]) rec.reviewFindings[s] += (r.findings && r.findings[s]) || 0;

    if (r.topFindingSignature) {
      if (r.topFindingSignature === rec.lastFindingSignature) rec.repeatedFindingCount += 1;
      else { rec.lastFindingSignature = r.topFindingSignature; rec.repeatedFindingCount = 1; }
      if (rec.repeatedFindingCount >= CONFIG.repeatedFindingStop) {
        rec.status = "escalated"; rec.escalation = `same finding ${rec.repeatedFindingCount}x: ${r.topFindingSignature}`;
        log(`  ⛔ ESCALATE — ${rec.escalation}`); return rec;
      }
    }
    if (r.confirmedCritical) {
      log(`  ✗ CONFIRMED-CRITICAL — fixing in-band`);
      await agent([envPreamble(task), `STEP = FIX-CRITICAL. Fix the root cause of: ${JSON.stringify(r.criticalFindings)}. Keep tests green. Never bypass.`].join("\n"),
        { label: label(`fix#${rec.iterations}`), phase: task.group, schema: S_GREEN });
      continue;
    }

    rec.rubricScore = r.rubricScore != null ? r.rubricScore : scoreRubric(task, gate, r);
    log(`  RUBRIC ${rec.rubricScore}/100 (pass ≥ ${CONFIG.rubricPassThreshold})`);
    if (rec.rubricScore < CONFIG.rubricPassThreshold) {
      log(`  ↻ below threshold — improve ${r.weakestDimension || "fidelity"}`);
      await agent([envPreamble(task), `STEP = IMPROVE (iteration ${rec.iterations}). Score below ${CONFIG.rubricPassThreshold}. Improve the weakest dimension (${r.weakestDimension || "fidelity vs the screenshot"}). Keep tests green.`].join("\n"),
        { label: label(`improve#${rec.iterations}`), phase: task.group, schema: S_GREEN });
      continue;
    }
    passed = true; break;
  }

  if (!passed) {
    if (rec.status !== "escalated") { rec.status = "maxed"; rec.escalation = `max iterations without rubric pass`; log(`  ⛔ STOP — ${rec.escalation}`); }
    return rec;
  }

  const c = await agentOr(
    [envPreamble(task),
      `STEP = COMMIT. Stage exactly this task's files and commit (the pre-commit hook runs — do not bypass):`,
      `  git add ${task.files.join(" ")}`,
      `  git commit -m "${task.commit}" -m "${CONFIG.coAuthor}"`,
      `Never amend; never --no-verify. If the hook BLOCKS a confirmed-CRITICAL, set blockedByHook=true, committed=false. Else committed=true + sha.`].join("\n"),
    { label: label("commit"), phase: task.group, schema: S_COMMIT },
    { committed: false, blockedByHook: false, sha: null, note: "commit agent returned null (transient API)" });
  if (!c.committed) {
    rec.status = "escalated"; rec.escalation = c.blockedByHook ? "pre-commit hook blocked a confirmed-CRITICAL" : ("commit did not complete: " + c.note);
    log(`  ⛔ ESCALATE — ${rec.escalation}`); metrics.record(rec); return rec;
  }

  rec.status = "done"; metrics.record(rec);
  log(`  ✓ ${task.id} done — ${rec.iterations} iter, rubric ${rec.rubricScore}`);
  return rec;
}

// =============================================================================
log("=== SAMAGRA OS · FIDELITY PASS · START ===");
const b = budget && typeof budget.remaining === "function" ? budget : { total: null, remaining: () => Infinity };
const hasBudget = b.total != null && b.total !== Infinity;
const budgetOk = () => !hasBudget || b.remaining() > CONFIG.tokenFloor;
log(`branch=${CONFIG.branch} queue=${QUEUE.length} tasks rubric≥${CONFIG.rubricPassThreshold} maxIter=${CONFIG.maxIterationsPerTask}`);

const metrics = makeMetrics();
const done = new Set();
const started = new Set();
const degraded = { advisoryOnly: false, advisoryAllows: 0 };

phase("preflight");
const pf = await agentOr(
  [`Preflight for the SAMAGRA OS fidelity pass, in C:/SandBox/claude_box/TeachingOS.`,
    `Run: \`codex --version\`; \`git rev-parse --abbrev-ref HEAD\` (expect ${CONFIG.branch}); confirm the design reference exists: list \`${CONFIG.designRoot}\` and confirm \`${CONFIG.shots}\` has aqua-/console-/samagra- PNGs.`,
    `Return codexAvailable, designRefPresent (true only if the screenshots + .dc.html are readable), branch, note.`].join("\n"),
  { label: "preflight", phase: "preflight", schema: S_PRE },
  { codexAvailable: false, designRefPresent: true, branch: CONFIG.branch, note: "preflight agent returned null — assuming design-ref present (it was committed earlier) to allow resume" });
if (!pf.designRefPresent) {
  log(`!! ABORT — design reference not present/readable (${pf.note}). Cannot match fidelity without it.`);
  return { aborted: true, reason: "design-ref missing", preflight: pf };
}
if (pf.codexAvailable === true) log(`  ✓ codex on PATH; branch=${pf.branch}; design-ref OK`);
else { degraded.advisoryOnly = true; log(`  ⚠ codex NOT invokable → advisory-only degraded mode. ${pf.note}`); }
if (pf.branch !== CONFIG.branch) log(`  ⚠ on branch ${pf.branch}, expected ${CONFIG.branch} — proceeding (commits land on current branch)`);

let dispatches = 0;
while (budgetOk()) {
  if (dispatches >= CONFIG.maxTaskDispatches) { log(`!! max dispatches reached — halting`); break; }
  const task = nextUnblocked(QUEUE, done, started);
  if (!task) { log("queue drained"); break; }
  started.add(task.id); dispatches += 1;
  const rec = await runTask(task, budgetOk, metrics, degraded);
  if (rec.status === "done") done.add(task.id);
  else { log(`!! ${task.id} ${rec.status}: ${rec.escalation}`); log("!! halting new-task dispatch — owner review required"); break; }
}

const s = metrics.summary();
s.codexDegraded = degraded.advisoryOnly;
phase("gate");
log("=== SAMAGRA OS · FIDELITY PASS · END ===");
if (degraded.advisoryOnly) log(`!! CODEX DEGRADED: advisory-only — ${degraded.advisoryAllows} allow(s).`);
log(`done=${s.tasksDone}/${QUEUE.length} escalated=${s.tasksEscalated} avgIter=${s.avgIterationsPerTask.toFixed(2)} findings(C/H/M/L)=${s.reviewFindings.CRITICAL}/${s.reviewFindings.HIGH}/${s.reviewFindings.MED}/${s.reviewFindings.LOW}`);
for (const e of s.escalations) log(`  escalation → ${e}`);
log("REMINDER: pixel/interaction parity across the 3 themes is verified by a SEPARATE browser-vision QA pass (main session) against screenshots/ — NOT signalled by this loop.");
return { metrics: s, done: [...done], degraded: degraded.advisoryOnly };
