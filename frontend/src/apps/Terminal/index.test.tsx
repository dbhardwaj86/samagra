// AP3 FIDELITY — Terminal (README §Apps#15 Terminal, #10b981 740×480).
// The Terminal app is a THIN presentational wrapper over the pure `lib/terminal`
// engine (parser + dispatch, already green in E1.8/E1.9). The wrapper feeds input
// → parse → dispatch → renders the returned `lines` and **executes the returned
// `effects`** (openApp / setTheme / setDevice) against the singleton WM / theme
// stores. AP3 makes the surface a VERBATIM port of the prototype's `app_terminal`
// (.dc.html ~L842): a flex-column monospace shell —
//   • Root: JetBrains Mono 12.5px, background = the active theme's termPalette.bg.
//   • Output: flex 1 / overflow auto / padding 12px 14px / lineHeight 1.5 / fg.
//     Each line is whiteSpace pre-wrap; an `in` line renders the literal prompt
//     `deepak@samagra:~$ ` span (prompt color) + the typed body span (fg color);
//     other lines take their LineClass color (fg/dim/accent/ok/err).
//   • Input row: padding 10px 14px / gap 8 / 1px top border; the prompt label
//     `deepak@samagra:~$` (prompt color, nowrap) + a borderless transparent input
//     (fg text, accent caret), fontFamily inherit / fontSize 12.5.
//
// Two contracts are pinned:
//   1. BEHAVIOUR (kept from E1.21): submitting `open snake` + Enter triggers the WM
//      `openApp('snake')` effect → the WM store gains a snake window.
//   2. FIDELITY (AP3, new): the exact documented tokens/markup — JetBrains Mono /
//      12.5px, the per-theme palette (FD1) driving bg/fg/prompt/caret across aqua,
//      console AND samagra, the `deepak@samagra:~$` prompt, the input-row chrome,
//      and a real FD2 <svg> terminal glyph (NEVER a letter badge). Per-pixel parity
//      is a separate human pass.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { termPalette } from "../../themes";
import type { AppId, Device, Theme } from "../../types/contracts";

// --- WM + theme store boundary (../../App) -----------------------------------
// Real vanilla stores (so `useStore` subscriptions work) with spy actions. The WM
// store's `openApp` is a `vi.fn` spy that ALSO pushes a real `snake` window, so the
// effect-runner path is pinned both by the spy call AND by the resulting store
// state. `vi.hoisted` so the stores + spies exist when the hoisted `vi.mock`
// factory runs; `createStore` is imported INSIDE the factory because a static
// import binding is itself in its TDZ when the hoisted block executes.
const { openApp, openMobileApp, setTheme, setDevice, wmStore, themeStore } = await vi.hoisted(
  async () => {
    const { createStore } = await import("zustand/vanilla");

    // openApp spy that ALSO mutates the store so `windows` reflects the effect.
    const openApp = vi.fn((id: string) => {
      wmStore.setState((s: { windows: { id: string; app: string }[] }) => ({
        windows: s.windows.some((w) => w.app === id)
          ? s.windows
          : [...s.windows, { id: `w-${id}`, app: id }],
      }));
    });
    const openMobileApp = vi.fn();
    const setTheme = vi.fn();
    const setDevice = vi.fn();

    const wmStore = createStore(() => ({
      windows: [] as { id: string; app: string }[],
      z: 0,
      openApp,
    }));
    // `theme`/`device` typed as the full contract unions (not the narrowed literal)
    // so the per-theme `setState({ theme: 'console' | 'samagra' })` repaint tests
    // typecheck against the same store the production component subscribes to.
    const themeStore = createStore(() => ({
      theme: "aqua" as Theme,
      device: "pc" as Device,
      setTheme,
      setDevice,
      openMobileApp,
    }));

    return { openApp, openMobileApp, setTheme, setDevice, wmStore, themeStore };
  },
);

vi.mock("../../App", () => ({ wmStore, themeStore }));

// Import AFTER the mocks are registered so Terminal binds the mocked stores.
import Terminal from "./index";

beforeEach(() => {
  openApp.mockClear();
  openMobileApp.mockClear();
  setTheme.mockClear();
  setDevice.mockClear();
  wmStore.setState({ windows: [], z: 0, openApp });
  themeStore.setState({ theme: "aqua", device: "pc", setTheme, setDevice, openMobileApp });
});

afterEach(() => {
  vi.clearAllMocks();
});

// -------------------------------------------------------------------------- //
// BEHAVIOUR — the headless residue the loop gates on (kept from E1.21).       //
// -------------------------------------------------------------------------- //
describe("Terminal (behaviour — the effect runner)", () => {
  it("submitting `open snake` triggers the WM openApp effect → a snake window", () => {
    render(<Terminal />);

    // The single command-line input — addressed by its accessible name.
    const input = screen.getByRole("textbox", { name: /terminal input/i });
    fireEvent.change(input, { target: { value: "open snake" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    // (a) the effect ran: openApp('snake')
    expect(openApp).toHaveBeenCalledWith("snake");

    // (b) the plan's literal residue: the WM store gains a snake window.
    const windows = wmStore.getState().windows as { app: AppId }[];
    expect(windows.some((w) => w.app === "snake")).toBe(true);
  });

  it("routes `open` to the mobile shell when device is mobile (proto §1.4 step 1)", () => {
    // E3 fidelity fix: `openApp` is device-aware. On a phone the Terminal's
    // `open <app>` must show the app full-screen via openMobileApp, NOT spawn an
    // invisible desktop window (the mobile branch never renders WindowFrames).
    themeStore.setState({ theme: "aqua", device: "mobile", setTheme, setDevice, openMobileApp });
    render(<Terminal />);
    const input = screen.getByRole("textbox", { name: /terminal input/i });
    fireEvent.change(input, { target: { value: "open notes" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(openMobileApp).toHaveBeenCalledWith("notes");
    expect(openApp).not.toHaveBeenCalled(); // no desktop window spawned on mobile
  });

  it("echoes the typed command as an `in` line carrying the prompt prefix", () => {
    render(<Terminal />);
    const input = screen.getByRole("textbox", { name: /terminal input/i });
    fireEvent.change(input, { target: { value: "whoami" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    // The echoed line is split into a prompt span + the typed body, mirroring the
    // prototype's `renderTermLine` for an `in` line.
    const echoed = screen.getByTestId("term-echo-0");
    // The prompt label is the verbatim literal in the prompt color; the typed body
    // takes the fg color (the prototype's two-span split, FD1).
    const promptSpan = within(echoed).getByText("deepak@samagra:~$");
    expect(promptSpan).toHaveStyle({ color: termPalette.aqua.prompt }); // #7dd3fc
    const bodySpan = within(echoed).getByText("whoami");
    expect(bodySpan).toHaveStyle({ color: termPalette.aqua.fg }); // #e5e7eb
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — root shell: JetBrains Mono / 12.5px / per-theme bg (AP3 + FD1).   //
// -------------------------------------------------------------------------- //
describe("Terminal (fidelity — monospace shell + per-theme bg)", () => {
  it("renders the root as a JetBrains Mono 12.5px monospace shell", () => {
    render(<Terminal />);
    const root = screen.getByTestId("terminal");
    expect(root).toHaveStyle({
      fontFamily: "'JetBrains Mono',ui-monospace,monospace",
      fontSize: "12.5px",
    });
  });

  it("paints the root background from the AQUA termPalette (the active theme)", () => {
    render(<Terminal />);
    // store default theme = aqua → bg #1b1d24, fg #e5e7eb.
    expect(screen.getByTestId("terminal")).toHaveStyle({
      background: termPalette.aqua.bg,
      color: termPalette.aqua.fg,
    });
  });

  it("repaints from the CONSOLE termPalette when the active theme is console (FD1)", () => {
    themeStore.setState({ theme: "console", device: "pc", setTheme, setDevice });
    render(<Terminal />);
    // FD1: the surface is driven by termPalette[theme], not a hardcoded aqua.
    expect(screen.getByTestId("terminal")).toHaveStyle({
      background: termPalette.console.bg, // #05080e
      color: termPalette.console.fg, // #a7bdd6
    });
  });

  it("repaints from the SAMAGRA termPalette when the active theme is samagra (FD1)", () => {
    themeStore.setState({ theme: "samagra", device: "pc", setTheme, setDevice });
    render(<Terminal />);
    const root = screen.getByTestId("terminal");
    expect(root).toHaveStyle({
      background: termPalette.samagra.bg, // #241a11
      color: termPalette.samagra.fg, // #efe2cf
    });
    // The active theme is surfaced as a data-attribute hook for QA/E2E selection.
    expect(root).toHaveAttribute("data-theme", "samagra");
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — output area geometry (AP3).                                      //
// -------------------------------------------------------------------------- //
describe("Terminal (fidelity — output area)", () => {
  it("renders the scrollable output at the prototype geometry (pad 12px 14px, lineHeight 1.5)", () => {
    render(<Terminal />);
    const out = screen.getByRole("log", { name: /terminal output/i });
    expect(out).toHaveStyle({
      flex: "1",
      overflow: "auto",
      padding: "12px 14px",
      lineHeight: "1.5",
    });
  });

  it("colors the welcome banner from the active theme palette (accent + dim)", () => {
    render(<Terminal />);
    // The accent welcome title + the dim hint take the aqua palette colors (FD1).
    expect(screen.getByText(/agentic content OS/i)).toHaveStyle({
      color: termPalette.aqua.accent, // #a5b4fc
    });
    expect(screen.getByText(/Type 'help' for commands/i)).toHaveStyle({
      color: termPalette.aqua.dim, // #9aa0ad
    });
  });

  it("renders the VERBATIM welcome hint with the e.g. example commands (.dc.html ~L746)", () => {
    render(<Terminal />);
    // Both reference screenshots show the full second line, not a truncation: the
    // dim hint carries the `e.g. status · agents · catalog · open questions · theme
    // console` example commands verbatim from the prototype `termWelcome`.
    // `normalizer: trim:false / collapseWhitespace:false` so the verbatim double
    // spaces (`commands.   e.g.  status`) are asserted, not collapsed.
    expect(
      screen.getByText(
        "Type 'help' for commands.   e.g.  status · agents · catalog · open questions · theme console",
        { normalizer: (s) => s },
      ),
    ).toBeInTheDocument();
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — input row chrome + prompt (AP3 + FD1).                           //
// -------------------------------------------------------------------------- //
describe("Terminal (fidelity — input row + prompt)", () => {
  it("renders the literal deepak@samagra:~$ prompt in the prompt color (FD1)", () => {
    render(<Terminal />);
    const prompt = screen.getByTestId("term-prompt");
    expect(prompt).toHaveTextContent("deepak@samagra:~$");
    // FD1: the prompt label color is the active theme's palette prompt, nowrap.
    expect(prompt).toHaveStyle({
      color: termPalette.aqua.prompt, // #7dd3fc
      whiteSpace: "nowrap",
    });
  });

  it("repaints the prompt from the SAMAGRA palette when active (FD1)", () => {
    themeStore.setState({ theme: "samagra", device: "pc", setTheme, setDevice });
    render(<Terminal />);
    expect(screen.getByTestId("term-prompt")).toHaveStyle({
      color: termPalette.samagra.prompt, // #f0a35e
    });
  });

  it("renders a borderless transparent input with the accent caret + 12.5px inherit font", () => {
    render(<Terminal />);
    const input = screen.getByRole("textbox", { name: /terminal input/i }) as HTMLInputElement;
    expect(input).toHaveStyle({
      // The prototype's `border:'none'` — jsdom drops the `none` shorthand, so the
      // surviving, equivalent assertion is the 0-width longhand.
      borderWidth: "0px",
      background: "transparent",
      color: termPalette.aqua.fg, // #e5e7eb
      fontFamily: "inherit",
      fontSize: "12.5px",
    });
    // `caret-color` is not exposed via getComputedStyle in jsdom (so toHaveStyle
    // can't see it), but it IS in the inline CSSOM — assert the accent caret there.
    expect(input.style.caretColor).toBe(termPalette.aqua.accent); // #a5b4fc
  });

  it("repaints the input fg + accent caret from the CONSOLE palette when active (FD1)", () => {
    themeStore.setState({ theme: "console", device: "pc", setTheme, setDevice });
    render(<Terminal />);
    const input = screen.getByRole("textbox", { name: /terminal input/i }) as HTMLInputElement;
    expect(input).toHaveStyle({ color: termPalette.console.fg }); // #a7bdd6
    expect(input.style.caretColor).toBe(termPalette.console.accent); // #38bdf8
  });

  it("draws a 1px top border on the input row (the prototype's hex(fg,0.12) divider)", () => {
    render(<Terminal />);
    const row = screen.getByTestId("term-inputline");
    // The divider is a 1px solid top border + flex/gap-8 layout.
    expect(row).toHaveStyle({ display: "flex", gap: "8px", padding: "10px 14px" });
    expect(row.style.borderTop).toMatch(/^1px solid /);
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — FD2 glyph (a real <svg>, never a letter badge).                  //
// -------------------------------------------------------------------------- //
describe("Terminal (fidelity — FD2 icon)", () => {
  it("renders a real <svg> terminal glyph (never a letter badge)", () => {
    render(<Terminal />);
    const row = screen.getByTestId("term-inputline");
    // FD2: the terminal glyph is the <Icon> 24×24 viewBox svg, not a text badge.
    const svg = row.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    // It is a labelled FD2 line-icon (role=img + accessible name), and carries the
    // verbatim multi-segment glyph path data (≥1 <path>) — never a letter badge.
    expect(svg).toHaveAttribute("role", "img");
    expect(svg!.querySelectorAll("path").length).toBeGreaterThan(0);
    const glyph = within(row).getByRole("img", { name: /terminal prompt/i });
    expect(glyph).toBe(svg);
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — terminal UX behaviours (click-to-focus + auto-scroll, .dc.html  //
// L845). Real prototype shell behaviours, not invented chrome.               //
// -------------------------------------------------------------------------- //
describe("Terminal (fidelity — shell UX: focus + scroll)", () => {
  it("focuses the command input when the transcript (output) is clicked", () => {
    render(<Terminal />);
    const input = screen.getByRole("textbox", { name: /terminal input/i });
    const out = screen.getByRole("log", { name: /terminal output/i });

    // Move focus elsewhere first so the click→focus is observable, not incidental.
    input.blur();
    expect(input).not.toHaveFocus();

    // The prototype's `onClick:()=>this._termInput.focus()` (.dc.html L845): a click
    // anywhere in the scrollback resumes typing.
    fireEvent.click(out);
    expect(input).toHaveFocus();
  });

  it("pins the transcript to the newest line after a command (auto-scroll to bottom)", () => {
    render(<Terminal />);
    const out = screen.getByRole("log", { name: /terminal output/i }) as HTMLDivElement;

    // jsdom reports 0 for layout metrics, so stub a tall scrollHeight to prove the
    // component drives scrollTop := scrollHeight (the prototype's bottom-pin), not
    // that jsdom actually scrolled. A growing transcript must re-pin to the bottom.
    Object.defineProperty(out, "scrollHeight", { value: 999, configurable: true });
    out.scrollTop = 0;

    const input = screen.getByRole("textbox", { name: /terminal input/i });
    // `help` appends a multi-line block, growing the transcript past the viewport.
    fireEvent.change(input, { target: { value: "help" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    // The post-append effect pinned the scroll position to the bottom.
    expect(out.scrollTop).toBe(999);
  });
});
