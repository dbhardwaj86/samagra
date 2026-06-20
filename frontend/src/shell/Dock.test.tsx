// CH1 fidelity — Aqua Dock (proto.md §1.1 / .dc.html renderDock L1019-1022 +
// dockItem L1000-1004). The aqua dock floats bottom-center, radius 20, glass blur,
// rendering one 46×46 accent-gradient tile per app in the frozen ORDER. Each tile
// is an <AppIcon> (FD2 — inline <svg> glyph, NEVER a letter badge) wrapped in a
// hover-lift element (translateY(-7px) scale(1.12)). All colors/sizes come from the
// active theme tokens + per-app accents (FD1) so the dock is theme-correct.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Dock from "./Dock";
import { APPS, ORDER } from "../registry";
import { THEMES } from "../themes";
import { hexA } from "../components/icons-data";

const aqua = THEMES.aqua;

// jsdom canonicalises rgba() to a space-separated form when it round-trips through
// the `background` shorthand. Compare against the token modulo that CSSOM whitespace
// so the assertion stays "painted from the dock token" without pinning a serializer
// quirk.
const norm = (s: string) => s.replace(/,\s+/g, ",");

describe("Dock (CH1 aqua chrome fidelity)", () => {
  it("renders the dock container without crashing", () => {
    const { container } = render(<Dock onOpen={() => {}} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders one launcher per app in ORDER", () => {
    render(<Dock onOpen={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(ORDER.length);
  });

  // --- exact dock container tokens (renderDock L1019-1021) ---
  it("has the aqua dock radius of 20 (proto.md §1.1)", () => {
    const { container } = render(<Dock onOpen={() => {}} />);
    const dock = container.firstChild as HTMLElement;
    expect(dock.style.borderRadius).toBe("20px");
  });

  it("floats bottom-center with the prototype's dock geometry", () => {
    const { container } = render(<Dock onOpen={() => {}} />);
    const dock = container.firstChild as HTMLElement;
    expect(dock.style.bottom).toBe("12px");
    expect(dock.style.left).toBe("50%");
    expect(dock.style.transform).toBe("translateX(-50%)");
    expect(dock.style.gap).toBe("10px");
    expect(dock.style.padding).toBe("9px 14px");
  });

  it("paints the dock glass surface + shadow from the active theme tokens (aqua)", () => {
    const { container } = render(<Dock onOpen={() => {}} />);
    const dock = container.firstChild as HTMLElement;
    expect(norm(dock.style.background)).toBe(aqua.dockBg);
    expect(dock.style.backdropFilter).toBe(aqua.dockBlur);
    expect(dock.style.boxShadow).toBe("0 12px 40px rgba(0,0,0,.28)");
  });

  // --- FD2: tiles are <AppIcon> inline <svg> glyphs, NEVER letter badges ---
  it("renders each launcher as an inline <svg> app glyph, never a letter badge", () => {
    const { container } = render(<Dock onOpen={() => {}} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(ORDER.length);
    // no launcher shows a bare first-letter text label
    const dash = screen.getByRole("button", { name: /dashboard/i });
    expect(dash.textContent).toBe("");
  });

  it("fills the first tile with the per-app accent gradient (theme-correct)", () => {
    const { container } = render(<Dock onOpen={() => {}} />);
    const dashAccent = APPS.dashboard.accent; // #4f46e5
    // the AppIcon tile is the gradient-filled element somewhere in the first launcher
    const html = container.innerHTML;
    expect(html).toContain("linear-gradient(160deg");
    expect(html).toContain(hexA(dashAccent, 0.95));
  });

  it("sizes the tiles at the prototype's 46×46 dock geometry", () => {
    const { container } = render(<Dock onOpen={() => {}} />);
    // The AppIcon tile carries explicit 46px width — find one labelled tile.
    const tile = screen.getByLabelText("Dashboard");
    // the labelled element is the AppIcon tile itself (46×46)
    expect(tile.style.width).toBe("46px");
    expect(tile.style.height).toBe("46px");
    // glyph rendered at dock size 23
    expect((tile.querySelector("svg") as SVGSVGElement).getAttribute("width")).toBe("23");
    expect(container).toBeTruthy();
  });

  // --- hover-lift: the wrapper carries the exact transform on mouse-enter ---
  it("lifts a tile on hover (translateY(-7px) scale(1.12))", () => {
    render(<Dock onOpen={() => {}} />);
    const first = screen.getByRole("button", { name: /dashboard/i });
    fireEvent.mouseEnter(first);
    expect(first.style.transform).toBe("translateY(-7px) scale(1.12)");
    fireEvent.mouseLeave(first);
    expect(first.style.transform).toBe("");
  });

  // --- behaviour: click dispatches openApp ---
  it("dispatches openApp with the app id when an icon is clicked", () => {
    const onOpen = vi.fn();
    render(<Dock onOpen={onOpen} />);
    const first = screen.getByRole("button", { name: /dashboard/i });
    fireEvent.click(first);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(ORDER[0]);
  });

  it("dispatches openApp for a non-first app id", () => {
    const onOpen = vi.fn();
    render(<Dock onOpen={onOpen} />);
    const terminal = screen.getByRole("button", { name: /terminal/i });
    fireEvent.click(terminal);
    expect(onOpen).toHaveBeenCalledWith("terminal");
  });

  // --- theme correctness (FD1): under samagra, the dock glass + per-app gradient
  // both follow the samagra tokens; no aqua dockBg bleeds through.
  it("paints the dock glass from samagra tokens when the active theme is samagra", () => {
    const { container } = render(<Dock onOpen={() => {}} theme="samagra" />);
    const dock = container.firstChild as HTMLElement;
    expect(norm(dock.style.background)).toBe(THEMES.samagra.dockBg);
    expect(norm(dock.style.background)).not.toBe(aqua.dockBg);
  });
});
