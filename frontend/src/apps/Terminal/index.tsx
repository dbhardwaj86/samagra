// src/apps/Terminal/index.tsx
// AP3 FIDELITY — Terminal (README §Apps#15 Terminal, #10b981 740×480).
// THIN presentational wrapper (E1.21, VISUAL) over the pure `lib/terminal`
// engine (parser + dispatch, already green in E1.8/E1.9). The wrapper:
//   input → dispatch → render the returned `lines` (colored by LineClass from the
//   ACTIVE theme's `termPalette`) and EXECUTE the returned `effects`
//   (openApp / setTheme / setDevice) against the singleton WM / theme stores.
// All command logic lives in lib/terminal — there is ZERO command behaviour here.
//
// AP3 makes the surface a VERBATIM port of the prototype's `app_terminal`
// (.dc.html ~L842): a flex-column monospace shell —
//   • Root: JetBrains Mono 12.5px, background = the ACTIVE theme's termPalette.bg.
//   • Output: flex 1 / overflow auto / padding 12px 14px / lineHeight 1.5 / fg.
//     Each line is whiteSpace pre-wrap / wordBreak break-word; an `in` line renders
//     the literal prompt `devesh@samagra:~$ ` span (prompt color) + the typed body
//     span (fg color); other lines take their LineClass color (fg/dim/accent/ok/err).
//   • Input row: padding 10px 14px / gap 8 / 1px top border (hex(fg,0.12)) /
//     background hex(fg,0.02); the prompt label `devesh@samagra:~$` (prompt color,
//     nowrap) + a borderless transparent input (fg text, accent caret), fontFamily
//     inherit / fontSize 12.5.
//
// FIDELITY rules (FD1/FD2):
//   • FD1 — every color/size is driven by the ACTIVE theme's `termPalette[theme]`
//     (.dc.html `termPalette()`), NOT a hardcoded aqua, so the surface renders
//     correctly in aqua, console AND samagra. (The terminal has its own per-theme
//     palette, distinct from the `--samagra-*` chrome vars.)
//   • FD2 — the input-row glyph is a real 24×24 line-icon <svg> via <Icon>, NEVER a
//     letter badge.
//
// Two contracts are pinned (kept green by the tests):
//   1. BEHAVIOUR (E1.21): submitting `open snake` + Enter triggers the WM
//      `openApp('snake')` effect → the WM store gains a snake window.
//   2. FIDELITY (AP3): the exact documented tokens/markup above.
//
// The prototype runtime is read as SPEC ONLY. Per-pixel parity is a separate human
// QA pass and is NOT tested here.
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { themeStore, wmStore } from "../../App";
import Icon from "../../components/Icon";
import { APPS, ORDER } from "../../registry";
import { termPalette, TERM_ERR, TERM_OK, type TermPalette } from "../../themes";
import { dispatch, PROMPT } from "../../lib/terminal/dispatch";
import type {
  LineClass,
  TermCtx,
  TermEffect,
  TermLine,
} from "../../types/contracts";

// Welcome banner (proto.md §4 / .dc.html termWelcome ~L744): accent title, dim
// hint, blank. The hint is the VERBATIM prototype string — the title line plus the
// `e.g. status · agents · catalog · open questions · theme console` example
// commands (both screenshots show this full second line).
const WELCOME: TermLine[] = [
  { t: "SAMAGRA OS  ·  समग्र  ·  v1.0  —  agentic content OS", c: "accent" },
  {
    t: "Type 'help' for commands.   e.g.  status · agents · catalog · open questions · theme console",
    c: "dim",
  },
  { t: "", c: "fg" },
];

/** `#rrggbb` @ alpha → `rgba(...)` — the prototype's `hex()` (input-row chrome). */
function hexA(c: string, a: number): string {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Resolve a line's color from the ACTIVE theme's termPalette + shared ok/err.
 *  Mirrors the prototype's `renderTermLine` cmap (.dc.html L838). */
function lineColor(c: LineClass, p: TermPalette): string {
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

  // FD1: the ACTIVE theme drives the whole surface via its termPalette entry. The
  // prototype recomputes `this.termPalette()` on every render off `state.theme`.
  const theme = useStore(themeStore, (s) => s.theme);
  const p = termPalette[theme];

  // Context fed to the pure engine: app order + metadata (DATA only).
  const ctx = useMemo<TermCtx>(() => ({ order: ORDER, apps: APPS }), []);

  const [lines, setLines] = useState<TermLine[]>(WELCOME);
  const [input, setInput] = useState("");

  // The scrollable output + the command input. The prototype pins the scroll to
  // the bottom on every render (`el.scrollTop=el.scrollHeight`, .dc.html L845) and
  // focuses the input when the output is clicked (`this._termInput.focus()`), so a
  // click anywhere in the transcript resumes typing — terminal UX fidelity.
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the transcript pinned to the newest line after each append/clear (the
  // prototype's ref callback). Runs after `lines` paints so scrollHeight is fresh.
  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

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

    // The echoed input line (the typed body, rendered with the `in` LineClass so
    // the prototype's prompt-prefix split applies in the renderer below).
    const echoed: TermLine = { t: raw, c: "in" };

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
      data-theme={theme}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: p.bg,
        color: p.fg,
        fontFamily: "'JetBrains Mono',ui-monospace,monospace",
        fontSize: 12.5,
      }}
    >
      <div
        ref={outputRef}
        className="term-output"
        role="log"
        aria-label="Terminal output"
        // Prototype `onClick` (.dc.html L845): clicking the transcript focuses the
        // command input so typing resumes from anywhere in the scrollback.
        onClick={() => inputRef.current?.focus()}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "12px 14px",
          color: p.fg,
          lineHeight: 1.5,
        }}
      >
        {(() => {
          // `term-echo-N` indexes ONLY the `in` (echoed-command) lines, so the
          // first submitted command is always `term-echo-0` regardless of how many
          // banner/output lines precede it. A running counter assigns the index.
          let echoN = 0;
          return lines.map((ln, i) =>
          ln.c === "in" ? (
            // `in` line — the prototype's prompt-prefix split (.dc.html L839): a
            // prompt-color `devesh@samagra:~$` span + the typed body in fg. The
            // single separating space leads the body span so the prompt text node
            // stays the exact literal `devesh@samagra:~$`.
            <div
              key={i}
              data-testid={`term-echo-${echoN++}`}
              className="term-line term-in"
              style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "1px 0" }}
            >
              <span style={{ color: p.prompt }}>{PROMPT}</span>
              <span style={{ color: p.fg }}>{` ${ln.t}`}</span>
            </div>
          ) : (
            <div
              key={i}
              className={`term-line term-${ln.c}`}
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: lineColor(ln.c, p),
                margin: "1px 0",
              }}
            >
              {ln.t === "" ? " " : ln.t}
            </div>
          ),
          );
        })()}
      </div>
      <div
        className="term-inputline"
        data-testid="term-inputline"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          borderTop: `1px solid ${hexA(p.fg, 0.12)}`,
          background: hexA(p.fg, 0.02),
        }}
      >
        {/* FD2 — terminal glyph as a real 24×24 line-icon <svg>, never a badge.
            Inherits the prompt color via currentColor. */}
        <span style={{ color: p.prompt, display: "inline-flex", flex: "none" }}>
          <Icon name="terminal" size={16} label="Terminal prompt" />
        </span>
        <span
          className="term-prompt"
          data-testid="term-prompt"
          style={{ color: p.prompt, whiteSpace: "nowrap" }}
        >
          {PROMPT}
        </span>
        <input
          ref={inputRef}
          type="text"
          className="term-input"
          aria-label="Terminal input"
          spellCheck={false}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          style={{
            flex: 1,
            // The prototype's `border:'none'`. jsdom's CSSOM drops the `none`
            // shorthand, so express it as the explicit 0-width longhand (which
            // survives) — visually identical (no border box).
            borderWidth: 0,
            borderStyle: "none",
            outline: "none",
            background: "transparent",
            color: p.fg,
            caretColor: p.accent,
            fontFamily: "inherit",
            fontSize: 12.5,
          }}
        />
      </div>
    </div>
  );
}
