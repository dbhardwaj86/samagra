// CH2 fidelity — Console Start menu (README §console-07-start-menu / .dc.html
// renderStart L1051-1062). A 380px-wide popover anchored bottom 58 / left 12, radius
// 16, padding 18, console glass blur, with an uppercase "All apps" heading and a
// 4-column grid of ALL 17 apps in ORDER. Each launcher is a 42×42 (radius 11)
// accent-gradient tile holding the inline <Icon> glyph (FD2 — never a letter badge)
// + the app name label. All colours/sizes come from the active theme tokens + per-app
// accents (FD1) so the menu is theme-correct. Pixel parity is a separate human pass.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import StartMenu from "./StartMenu";
import { APPS, ORDER } from "../registry";
import { THEMES } from "../themes";
import { hexA } from "../components/icons-data";

const con = THEMES.console;

const norm = (s: string) => s.replace(/,\s+/g, ",");

describe("StartMenu (CH2 console chrome fidelity)", () => {
  it("renders the Start-menu panel without crashing", () => {
    const { container } = render(<StartMenu onOpen={() => {}} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  // --- exact panel geometry (renderStart L1053) ---
  it("is a 380px popover anchored bottom 58 / left 12 with radius 16 / padding 18", () => {
    const { container } = render(<StartMenu onOpen={() => {}} />);
    const panel = container.firstChild as HTMLElement;
    expect(panel.style.width).toBe("380px");
    expect(panel.style.bottom).toBe("58px");
    expect(panel.style.left).toBe("12px");
    expect(panel.style.borderRadius).toBe("16px");
    expect(panel.style.padding).toBe("18px");
  });

  it("paints the panel glass + border from the console theme tokens (FD1)", () => {
    const { container } = render(<StartMenu onOpen={() => {}} />);
    const panel = container.firstChild as HTMLElement;
    expect(norm(panel.style.background)).toBe(con.dockBg);
    expect(panel.style.backdropFilter).toBe(con.dockBlur);
    expect(norm(panel.style.border)).toBe(`1px solid ${con.dockBorder}`);
  });

  // --- "All apps" heading (renderStart L1055): 11px/700, uppercase, tracked, muted ---
  it("renders the uppercase 'All apps' section heading", () => {
    render(<StartMenu onOpen={() => {}} />);
    const heading = screen.getByText("All apps");
    expect(heading.style.textTransform).toBe("uppercase");
    expect(heading.style.fontSize).toBe("11px");
    expect(heading.style.fontWeight).toBe("700");
    expect(heading.style.color).toBe("rgb(133, 149, 171)"); // console muted #8595ab
  });

  // --- 4-column grid of ALL 17 apps (renderStart L1056) ---
  it("lays the apps out in a 4-column grid", () => {
    const { container } = render(<StartMenu onOpen={() => {}} />);
    const grid = container.querySelector('[data-testid="start-grid"]') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe("repeat(4,1fr)");
  });

  it("renders one launcher per app in ORDER (all 17 apps)", () => {
    render(<StartMenu onOpen={() => {}} />);
    const launchers = screen.getAllByRole("button");
    expect(launchers).toHaveLength(ORDER.length);
    // every app name from the registry is present
    for (const id of ORDER) {
      expect(screen.getByText(APPS[id].name)).toBeInTheDocument();
    }
  });

  // --- FD2: each launcher tile is an inline <svg> glyph, NEVER a letter badge ---
  it("renders each launcher glyph as an inline <svg>, never a letter badge", () => {
    const { container } = render(<StartMenu onOpen={() => {}} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBe(ORDER.length);
    // the dashboard launcher button has no bare text glyph beyond its name label
    const dash = screen.getByRole("button", { name: /dashboard/i });
    expect(dash.querySelector("svg")).not.toBeNull();
  });

  // --- 42×42 radius-11 accent-gradient tile (renderStart L1059) ---
  it("fills the dashboard tile with its per-app accent gradient at 42×42 / radius 11", () => {
    const { container } = render(<StartMenu onOpen={() => {}} />);
    const dashAccent = APPS.dashboard.accent; // #4f46e5
    const html = container.innerHTML;
    expect(html).toContain("linear-gradient(160deg");
    expect(html).toContain(hexA(dashAccent, 0.9));
    // the tile carries explicit 42×42 geometry + radius 11
    const tile = container.querySelector('[data-testid="start-tile"]') as HTMLElement;
    expect(tile.style.width).toBe("42px");
    expect(tile.style.height).toBe("42px");
    expect(tile.style.borderRadius).toBe("11px");
    // glyph drawn at size 21 (renderStart L1059 icon(id,21))
    expect((tile.querySelector("svg") as SVGSVGElement).getAttribute("width")).toBe("21");
  });

  // --- behaviour: clicking a launcher opens that app ---
  it("dispatches onOpen with the app id when a launcher is clicked", () => {
    const onOpen = vi.fn();
    render(<StartMenu onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /terminal/i }));
    expect(onOpen).toHaveBeenCalledWith("terminal");
  });

  it("dispatches onOpen for the first app (dashboard) too", () => {
    const onOpen = vi.fn();
    render(<StartMenu onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /dashboard/i }));
    expect(onOpen).toHaveBeenCalledWith(ORDER[0]);
  });

  // --- theme correctness (FD1): under samagra the panel glass follows samagra tokens;
  // the per-app gradient unifies to the samagra accent (matches the dock convention). ---
  it("paints the panel glass from samagra tokens when the active theme is samagra", () => {
    const { container } = render(<StartMenu onOpen={() => {}} theme="samagra" />);
    const panel = container.firstChild as HTMLElement;
    expect(norm(panel.style.background)).toBe(THEMES.samagra.dockBg);
    expect(norm(panel.style.background)).not.toBe(con.dockBg);
  });
});
