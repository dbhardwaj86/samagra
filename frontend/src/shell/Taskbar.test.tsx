// CH2 fidelity — Console Taskbar (README §Global Layout / .dc.html renderTaskbar
// L1033-1049). The console theme has NO top bar; instead a 50px bottom taskbar holds
// a Start button (dashboard glyph + SAMAGRA wordmark), a 1px divider, a running-window
// button strip (each = app glyph + name; the active window tinted with the app accent
// + a 2px bottom border), and a right cluster (activity glyph + clickable live clock).
// All colours/sizes are driven by the active theme tokens (FD1); every glyph is an
// inline <svg> from the <Icon> primitive (FD2), never a letter badge. Pixel parity is
// a separate human QA pass.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Taskbar from "./Taskbar";
import { THEMES } from "../themes";
import { hexA } from "../components/icons-data";
import { APPS } from "../registry";
import type { WindowState } from "../types/contracts";

const con = THEMES.console;

// jsdom canonicalises rgba() to a space-separated form when it round-trips through
// the `background` shorthand. Compare against the theme token modulo that CSSOM
// whitespace so assertions stay token-driven without pinning a serializer quirk.
const norm = (s: string) => s.replace(/,\s+/g, ",");

// jsdom serializes an opaque hex border color to the `rgb(r, g, b)` form when it
// round-trips through the `border-bottom` shorthand. Derive the expected rgb string
// from the SAME app-accent token so the assertion stays token-driven, not a literal.
const rgbOf = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16},${(n >> 8) & 255},${n & 255})`;
};

function mkWin(over: Partial<WindowState> & { id: string; app: WindowState["app"] }): WindowState {
  return {
    x: 40,
    y: 60,
    w: 800,
    h: 500,
    z: 1,
    min: false,
    max: false,
    prev: null,
    ...over,
  };
}

const dashWin = mkWin({ id: "w1", app: "dashboard", z: 1 });
const termWin = mkWin({ id: "w2", app: "terminal", z: 2 });

describe("Taskbar (CH2 console chrome fidelity)", () => {
  it("renders the taskbar container without crashing", () => {
    const { container } = render(<Taskbar windows={[]} clock="2:58 PM" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  // --- exact taskbar geometry (renderTaskbar L1036) ---
  it("is a 50px bottom-anchored full-width bar (proto renderTaskbar L1036)", () => {
    const { container } = render(<Taskbar windows={[]} clock="2:58 PM" />);
    const bar = container.firstChild as HTMLElement;
    expect(bar.style.height).toBe("50px");
    expect(bar.style.bottom).toBe("0px");
    expect(bar.style.left).toBe("0px");
    expect(bar.style.right).toBe("0px");
    expect(bar.style.gap).toBe("8px");
    expect(bar.style.padding).toBe("0px 12px");
  });

  // --- theme tokens (FD1): the bar surface / blur / top border come from the console
  // dock tokens (renderTaskbar uses dockBg/dockBlur/dockBorder), not literals. ---
  it("paints the bar surface + blur + top border from the console theme tokens", () => {
    const { container } = render(<Taskbar windows={[]} clock="2:58 PM" />);
    const bar = container.firstChild as HTMLElement;
    expect(norm(bar.style.background)).toBe(con.dockBg);
    expect(bar.style.backdropFilter).toBe(con.dockBlur);
    expect(norm(bar.style.borderTop)).toBe(`1px solid ${con.dockBorder}`);
    expect(bar.style.color).toBe("rgb(231, 238, 248)"); // console text #e7eef8
  });

  // --- Start button (renderTaskbar L1038-1039): SAMAGRA wordmark + dashboard glyph ---
  it("renders a Start button with the SAMAGRA wordmark", () => {
    render(<Taskbar windows={[]} clock="2:58 PM" />);
    const start = screen.getByRole("button", { name: /start/i });
    expect(start).toBeInTheDocument();
    expect(screen.getByText("SAMAGRA")).toBeInTheDocument();
  });

  it("tints the Start button with the console accent when the Start menu is open", () => {
    const { rerender } = render(<Taskbar windows={[]} clock="2:58 PM" startOpen={false} />);
    const closed = screen.getByRole("button", { name: /start/i });
    // closed → faint white wash hex('#fff',0.05)
    expect(norm(closed.style.background)).toBe(norm(hexA("#ffffff", 0.05)));
    rerender(<Taskbar windows={[]} clock="2:58 PM" startOpen />);
    const open = screen.getByRole("button", { name: /start/i });
    // open → accent wash hex(accent,0.18)
    expect(norm(open.style.background)).toBe(norm(hexA(con.accent, 0.18)));
  });

  it("toggles the Start menu when the Start button is clicked", () => {
    const onToggleStart = vi.fn();
    render(<Taskbar windows={[]} clock="2:58 PM" onToggleStart={onToggleStart} />);
    fireEvent.click(screen.getByRole("button", { name: /start/i }));
    expect(onToggleStart).toHaveBeenCalledTimes(1);
  });

  // --- FD2: the Start button's leading mark is an inline <svg> dashboard glyph ---
  it("renders the Start button glyph as an inline <svg>, not a letter badge", () => {
    render(<Taskbar windows={[]} clock="2:58 PM" />);
    const start = screen.getByRole("button", { name: /start/i });
    expect(start.querySelector("svg")).not.toBeNull();
  });

  // --- running-window buttons (renderTaskbar L1041-1045) ---
  it("renders one running-window button per open window, each with an svg glyph", () => {
    render(
      <Taskbar windows={[dashWin, termWin]} activeId="w2" clock="2:58 PM" />,
    );
    // each running window surfaces its app name
    expect(screen.getByText(APPS.dashboard.name)).toBeInTheDocument();
    expect(screen.getByText(APPS.terminal.name)).toBeInTheDocument();
    // every running-window button carries an inline <svg> app glyph
    const dashBtn = screen.getByText(APPS.dashboard.name).closest('[data-testid="taskbar-window"]');
    expect(dashBtn?.querySelector("svg")).not.toBeNull();
  });

  it("tints the ACTIVE running-window button with the app accent + a 2px bottom border", () => {
    render(<Taskbar windows={[dashWin, termWin]} activeId="w2" clock="2:58 PM" />);
    const termBtn = screen
      .getByText(APPS.terminal.name)
      .closest('[data-testid="taskbar-window"]') as HTMLElement;
    // active → accent wash hex(accent,0.18), white text, 2px accent bottom border
    expect(norm(termBtn.style.background)).toBe(norm(hexA(APPS.terminal.accent, 0.18)));
    expect(termBtn.style.color).toBe("rgb(255, 255, 255)");
    expect(norm(termBtn.style.borderBottom)).toBe(`2px solid ${rgbOf(APPS.terminal.accent)}`);
  });

  it("leaves the INACTIVE running-window button untinted (transparent bottom border)", () => {
    render(<Taskbar windows={[dashWin, termWin]} activeId="w2" clock="2:58 PM" />);
    const dashBtn = screen
      .getByText(APPS.dashboard.name)
      .closest('[data-testid="taskbar-window"]') as HTMLElement;
    expect(norm(dashBtn.style.background)).toBe(norm(hexA("#ffffff", 0.04)));
    expect(dashBtn.style.borderBottom).toBe("2px solid transparent");
  });

  it("dims a minimized running-window button to 0.6 opacity", () => {
    const minWin = mkWin({ id: "w3", app: "notes", min: true });
    render(<Taskbar windows={[minWin]} activeId={null} clock="2:58 PM" />);
    const notesBtn = screen
      .getByText(APPS.notes.name)
      .closest('[data-testid="taskbar-window"]') as HTMLElement;
    expect(notesBtn.style.opacity).toBe("0.6");
  });

  it("dispatches onSelectWindow with the window id when a running button is clicked", () => {
    const onSelectWindow = vi.fn();
    render(
      <Taskbar
        windows={[dashWin, termWin]}
        activeId="w2"
        clock="2:58 PM"
        onSelectWindow={onSelectWindow}
      />,
    );
    fireEvent.click(screen.getByText(APPS.dashboard.name));
    expect(onSelectWindow).toHaveBeenCalledWith("w1");
  });

  // --- right cluster (renderTaskbar L1046): activity glyph + clickable clock ---
  it("renders the clock string with tabular-nums and fires onOpenClock when clicked", () => {
    const onOpenClock = vi.fn();
    render(<Taskbar windows={[]} clock="2:58 PM" onOpenClock={onOpenClock} />);
    const clock = screen.getByText("2:58 PM");
    expect(clock.style.fontVariantNumeric).toBe("tabular-nums");
    fireEvent.click(clock);
    expect(onOpenClock).toHaveBeenCalledTimes(1);
  });

  it("renders the right-cluster activity mark as an inline <svg> (FD2)", () => {
    const { container } = render(<Taskbar windows={[]} clock="2:58 PM" />);
    // beyond the Start glyph, the activity status mark is also an inline svg
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
  });

  // --- theme correctness (FD1): a samagra/aqua-token Taskbar paints from THOSE tokens
  // (the component is console-shaped but must remain token-driven, not hardcoded). ---
  it("paints the bar from samagra tokens when the active theme is samagra", () => {
    const { container } = render(
      <Taskbar windows={[]} clock="2:58 PM" theme="samagra" />,
    );
    const bar = container.firstChild as HTMLElement;
    expect(norm(bar.style.background)).toBe(THEMES.samagra.dockBg);
    expect(norm(bar.style.background)).not.toBe(con.dockBg);
  });

  // --- Start menu popover slot (renderTaskbar L1047): children render inside the bar ---
  it("renders children (the Start menu popover) inside the taskbar", () => {
    render(
      <Taskbar windows={[]} clock="2:58 PM" startOpen>
        <div data-testid="start-popover">menu</div>
      </Taskbar>,
    );
    expect(screen.getByTestId("start-popover")).toBeInTheDocument();
  });
});
