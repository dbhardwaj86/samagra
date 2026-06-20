// Terminal command engine — pure, headless-testable (proto.md §4.2).
//
// Effects (openApp / setTheme / setDevice) are RETURNED as intents, never
// executed here. This is the linchpin that lets the whole command table be
// tested without a DOM: the thin React wrapper (E1.21) runs the returned
// effects and appends the returned lines to its buffer.

import type {
  AppId,
  Device,
  LineClass,
  TermCtx,
  TermEffect,
  TermLine,
  Theme,
} from "../../types/contracts";
import { parse } from "./parser";

/** Shell prompt (proto.md §4.1 — chairman login). */
export const PROMPT = "deepak@samagra:~$";

/** Result of dispatching one command line. */
export interface DispatchResult {
  /** Output lines to append to the terminal buffer. */
  lines: TermLine[];
  /** Effect intents for the wrapper to run (openApp / setTheme / setDevice). */
  effects: TermEffect[];
  /** `clear` empties the buffer instead of appending lines. */
  clear?: boolean;
}

const VALID_THEMES: Theme[] = ["aqua", "console", "samagra"];
const VALID_DEVICES: Device[] = ["pc", "mobile"];

/** Right-pad `s` to width `n` (proto.md §4.2 `pad`). */
function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

const line = (t: string, c: LineClass): TermLine => ({ t, c });

// ── Canned banner content (proto.md §4.2) ───────────────────────────────────

const HELP_ROWS: Array<[string, string]> = [
  ["help", "show this list"],
  ["status", "project status snapshot"],
  ["catalog", "content sources & artifact counts"],
  ["agents", "the board & worker roster"],
  ["pipelines", "production pipeline progress"],
  ["ls", "list installed apps"],
  ["open <app>", "open an app window"],
  ["theme <name>", "aqua | console | samagra"],
  ["device <pc|mobile>", "switch device frame"],
  ["neofetch", "system info card"],
  ["whoami", "current user"],
  ["date", "current date/time"],
  ["echo", "print a line"],
  ["clear", "clear the screen"],
];

const CATALOG_ROWS: Array<[string, string, string]> = [
  ["QX", "2,910", "Question bank — JEE/NEET physics"],
  ["physics-textbook", "1,604", "Chapter notes & second brain"],
  ["booklet-proofer", "612", "Print booklets, proofing passes"],
  ["INSP-extract", "498", "Olympiad / INSPIRE extractions"],
  ["pratyaksh", "744", "Interactive physics simulations"],
  ["mycontentdev", "401", "Content seeds & scheduling"],
  ["munshi", "275", "Seed capture & rough drafts"],
];

const PIPELINES: Array<[string, number]> = [
  ["Lectures", 74],
  ["Questions", 91],
  ["Print & Proofing", 46],
  ["Editorial seeds", 33],
];

// ── Command builders ────────────────────────────────────────────────────────

function cmdHelp(): TermLine[] {
  const out: TermLine[] = [line("Available commands:", "accent")];
  for (const [verb, desc] of HELP_ROWS) {
    out.push(line(`${pad(verb, 20)}${desc}`, "fg"));
  }
  return out;
}

function cmdStatus(): TermLine[] {
  return [
    line("SAMAGRA — Phase 0 complete · Phase 1 (adapters) next", "ok"),
    line(pad("Artifacts", 12) + "7,044", "fg"),
    line(pad("Tests", 12) + "11/11 green", "fg"),
    line(pad("Repo", 12) + "github.com/dbhardwaj86/samagra", "fg"),
  ];
}

function cmdCatalog(): TermLine[] {
  const out: TermLine[] = [
    line(`${pad("SOURCE", 18)}${pad("ARTIFACTS", 12)}HEADLINE`, "accent"),
  ];
  for (const [src, count, headline] of CATALOG_ROWS) {
    out.push(line(`${pad(src, 18)}${pad(count, 12)}${headline}`, "fg"));
  }
  return out;
}

/** agents / org / board — byte-identical line arrays (proto.md §4.2). */
function cmdAgents(): TermLine[] {
  return [
    line("BOARD", "accent"),
    line(pad("Deepak Bhardwaj", 18) + "Founder & Chairman", "fg"),
    line(pad("Claude-Deepak", 18) + "CEO — substrate & engine", "fg"),
    line(pad("Claude-Khanak", 18) + "CTO — leaf apps & UX", "fg"),
    line(pad("Codex", 18) + "Reviewer — pre-merge gate", "fg"),
    line("", "fg"),
    line("WORKERS", "accent"),
    line(pad("Gemini+NotebookLM", 18) + "Research & synthesis", "fg"),
    line(pad("Grok", 18) + "Real-time search", "fg"),
    line(pad("Hermes", 18) + "Kanban / scheduling", "fg"),
  ];
}

function cmdPipelines(): TermLine[] {
  const out: TermLine[] = [
    line("status-flow: seed → draft → review → publish", "dim"),
  ];
  for (const [label, pct] of PIPELINES) {
    const n = Math.round(pct / 5);
    const bar = "█".repeat(n) + "·".repeat(20 - n);
    out.push(line(`${pad(label, 18)}${bar} ${pct}%`, "fg"));
  }
  return out;
}

function cmdLs(ctx: TermCtx): TermLine[] {
  return [line(ctx.order.join("   "), "fg")];
}

function cmdNeofetch(): TermLine[] {
  return [
    line("समग्र  SAMAGRA OS", "accent"),
    line(pad("OS", 10) + "SAMAGRA OS v1.0", "fg"),
    line(pad("Host", 10) + "agentic content OS", "fg"),
    line(pad("Catalog", 10) + "7,044 artifacts", "fg"),
    line(pad("Agents", 10) + "4 board · 3 workers", "fg"),
    line(pad("Tests", 10) + "11/11 green", "fg"),
    line(pad("Stack", 10) + "React + TS + Vite", "fg"),
  ];
}

function cmdAbout(): TermLine[] {
  return [
    line("SAMAGRA OS · समग्र · v1.0", "accent"),
    line("An agentic content OS that turns handwritten physics notes into", "fg"),
    line("lectures, question banks, booklets and simulations.", "fg"),
  ];
}

/**
 * Resolve `open` target: `args[0].toLowerCase()` against ORDER ids plus
 * single-word display names (proto.md §4.2 resolution note).
 */
function resolveApp(token: string, ctx: TermCtx): AppId | null {
  const key = token.toLowerCase();
  for (const id of ctx.order) {
    if (id.toLowerCase() === key) return id;
    if (ctx.apps[id].name.toLowerCase() === key) return id;
  }
  return null;
}

function cmdOpen(args: string[], ctx: TermCtx): DispatchResult {
  const token = args[0] ?? "";
  const id = token ? resolveApp(token, ctx) : null;
  if (!id) {
    return {
      lines: [line(`open: unknown app '${token}' (try: ls)`, "err")],
      effects: [],
    };
  }
  return {
    lines: [line(`opening ${ctx.apps[id].name} …`, "ok")],
    effects: [{ kind: "openApp", value: id }],
  };
}

function cmdTheme(args: string[]): DispatchResult {
  const name = (args[0] ?? "").toLowerCase();
  if ((VALID_THEMES as string[]).includes(name)) {
    return {
      lines: [line(`theme → ${name}`, "ok")],
      effects: [{ kind: "setTheme", value: name as Theme }],
    };
  }
  return {
    lines: [line("theme: choose aqua | console | samagra", "err")],
    effects: [],
  };
}

function cmdDevice(args: string[]): DispatchResult {
  const name = (args[0] ?? "").toLowerCase();
  if ((VALID_DEVICES as string[]).includes(name)) {
    return {
      lines: [line(`device → ${name}`, "ok")],
      effects: [{ kind: "setDevice", value: name as Device }],
    };
  }
  return {
    lines: [line("device: choose pc | mobile", "err")],
    effects: [],
  };
}

// ── Engine ───────────────────────────────────────────────────────────────────

/**
 * Dispatch one command line to its handler.
 *
 * Returns `{ lines, effects, clear? }`. Effects are intents the wrapper runs;
 * `clear` signals the wrapper to empty its buffer.
 */
export function dispatch(input: string, ctx: TermCtx): DispatchResult {
  const { c0, args, arg, clear, empty } = parse(input);

  if (clear) return { lines: [], effects: [], clear: true };
  if (empty) return { lines: [], effects: [] };

  switch (c0) {
    case "help":
      return { lines: cmdHelp(), effects: [] };
    case "status":
      return { lines: cmdStatus(), effects: [] };
    case "catalog":
      return { lines: cmdCatalog(), effects: [] };
    case "agents":
    case "org":
    case "board":
      return { lines: cmdAgents(), effects: [] };
    case "pipelines":
    case "pipe":
      return { lines: cmdPipelines(), effects: [] };
    case "ls":
      return { lines: cmdLs(ctx), effects: [] };
    case "open":
      return cmdOpen(args, ctx);
    case "theme":
      return cmdTheme(args);
    case "device":
      return cmdDevice(args);
    case "neofetch":
      return { lines: cmdNeofetch(), effects: [] };
    case "about":
      return { lines: cmdAbout(), effects: [] };
    case "whoami":
      return { lines: [line("Deepak Bhardwaj — Founder & Chairman", "fg")], effects: [] };
    case "date":
      return { lines: [line(new Date().toString(), "fg")], effects: [] };
    case "echo":
      return { lines: [line(arg, "fg")], effects: [] };
    case "sudo":
      return {
        lines: [
          line(
            "nice try — only the board (Deepak · Khanak · Codex) may approve writes.",
            "err",
          ),
        ],
        effects: [],
      };
    default:
      return {
        lines: [line(`command not found: ${c0}   (try 'help')`, "err")],
        effects: [],
      };
  }
}
