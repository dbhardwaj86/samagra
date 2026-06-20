// src/apps/Terminal/index.tsx
// THIN presentational wrapper (E1.21, VISUAL) over the pure `lib/terminal`
// engine (parser + dispatch, already green in E1.8/E1.9). The wrapper:
//   input → dispatch → render the returned `lines` (colored by LineClass from
//   the aqua `termPalette`) and EXECUTE the returned `effects`
//   (openApp / setTheme / setDevice) against the singleton WM / theme stores.
// All command logic lives in lib/terminal — there is ZERO command behaviour here.
//
// The headless residue the loop gates on is the effect-runner path: submitting
// `open snake` + Enter triggers the WM `openApp('snake')` effect. Per-pixel
// Aqua/console/samagra parity (JetBrains Mono, prompt chrome) is a separate
// human QA pass and is NOT tested here.
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { themeStore, wmStore } from "../../App";
import { APPS, ORDER } from "../../registry";
import { termPalette, TERM_ERR, TERM_OK } from "../../themes";
import { dispatch, PROMPT } from "../../lib/terminal/dispatch";
import type {
  LineClass,
  TermCtx,
  TermEffect,
  TermLine,
} from "../../types/contracts";

// Welcome banner (proto.md §4): accent title, dim hint, blank.
const WELCOME: TermLine[] = [
  { t: "SAMAGRA OS · समग्र · v1.0 — agentic content OS", c: "accent" },
  { t: "Type 'help' for commands.", c: "dim" },
  { t: "", c: "fg" },
];

/** Resolve a line's color from the aqua termPalette + shared ok/err. */
function lineColor(c: LineClass): string {
  const p = termPalette.aqua;
  switch (c) {
    case "in":
      return p.prompt;
    case "dim":
      return p.dim;
    case "accent":
      return p.accent;
    case "ok":
      return TERM_OK;
    case "err":
      return TERM_ERR;
    case "fg":
    default:
      return p.fg;
  }
}

export default function Terminal() {
  // Singleton stores from the shell assembly. The effect runner calls these.
  const openApp = useStore(wmStore, (s) => s.openApp);
  const setTheme = useStore(themeStore, (s) => s.setTheme);
  const setDevice = useStore(themeStore, (s) => s.setDevice);

  // Context fed to the pure engine: app order + metadata (DATA only).
  const ctx = useMemo<TermCtx>(() => ({ order: ORDER, apps: APPS }), []);

  const [lines, setLines] = useState<TermLine[]>(WELCOME);
  const [input, setInput] = useState("");

  /** Run the effect intents the engine returned against the live stores. */
  function runEffect(effect: TermEffect): void {
    switch (effect.kind) {
      case "openApp":
        openApp(effect.value);
        break;
      case "setTheme":
        setTheme(effect.value);
        break;
      case "setDevice":
        setDevice(effect.value);
        break;
    }
  }

  function submit(): void {
    const raw = input;
    const result = dispatch(raw, ctx);

    // The echoed input line (prompt + what was typed), per proto §4.1.
    const echoed: TermLine = { t: `${PROMPT} ${raw}`, c: "in" };

    if (result.clear) {
      // `clear` empties the buffer instead of appending lines.
      setLines([]);
    } else {
      setLines((prev) => [...prev, echoed, ...result.lines]);
    }

    // Execute the returned effect intents (openApp / setTheme / setDevice).
    for (const effect of result.effects) runEffect(effect);

    setInput("");
  }

  return (
    <div
      className="app-terminal"
      data-testid="terminal"
      style={{ background: termPalette.aqua.bg, color: termPalette.aqua.fg }}
    >
      <div className="term-output" role="log" aria-label="Terminal output">
        {lines.map((ln, i) => (
          <div key={i} className={`term-line term-${ln.c}`} style={{ color: lineColor(ln.c) }}>
            {ln.t}
          </div>
        ))}
      </div>
      <div className="term-inputline">
        <span className="term-prompt" style={{ color: termPalette.aqua.prompt }}>
          {PROMPT}
        </span>
        <input
          type="text"
          className="term-input"
          aria-label="Terminal input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
      </div>
    </div>
  );
}
