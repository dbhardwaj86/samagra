// FD2 RED — <AppIcon> per-app accent gradient tile.
// Authoritative source: the prototype's dock / mobile-home tiles
// (.dc.html line ~1003 dock 46×46, ~1099 mobile-home 58×58). A rounded square
// filled with an accent gradient `linear-gradient(160deg, hexA(accent,.95),
// hexA(accent,.7))`, white glyph (the <Icon>), and a soft accent drop shadow.
// The tests pin the exact geometry/gradient/shadow tokens, the embedded inline
// <svg> glyph (NEVER a letter badge), and the a11y fidelity hooks.
import { render, screen } from "@testing-library/react";
import AppIcon from "./AppIcon";
import { APPS } from "../registry";
import { ICONS, hexA } from "./icons-data";

const DASH = APPS.dashboard.accent; // #4f46e5 (verbatim)

const tileOf = (container: HTMLElement) =>
  container.firstElementChild as HTMLElement;

describe("AppIcon — accent gradient tile (proto dock/home tile)", () => {
  it("renders the app's inline <svg> glyph, never a letter badge", () => {
    const { container } = render(<AppIcon app="dashboard" accent={DASH} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // verbatim glyph: 4 dashboard squares
    expect(container.querySelectorAll("path")).toHaveLength(
      ICONS.dashboard.split("|").length,
    );
    // not a text/letter badge
    expect(tileOf(container).textContent).toBe("");
  });

  it("fills the tile with the accent gradient (160deg, .95 → .7 alpha)", () => {
    const { container } = render(<AppIcon app="dashboard" accent={DASH} />);
    const bg = tileOf(container).style.background;
    expect(bg).toContain("linear-gradient(160deg");
    expect(bg).toContain(hexA(DASH, 0.95));
    expect(bg).toContain(hexA(DASH, 0.7));
  });

  it("applies the accent drop shadow (0 4px 12px @ .4 alpha)", () => {
    const { container } = render(<AppIcon app="dashboard" accent={DASH} />);
    expect(tileOf(container).style.boxShadow).toBe(`0 4px 12px ${hexA(DASH, 0.4)}`);
  });

  it("uses the dock tile geometry by default (46×46, radius 12, white glyph)", () => {
    const { container } = render(<AppIcon app="dashboard" accent={DASH} />);
    const tile = tileOf(container);
    expect(tile.style.width).toBe("46px");
    expect(tile.style.height).toBe("46px");
    expect(tile.style.borderRadius).toBe("12px");
    expect(tile.style.color).toBe("rgb(255, 255, 255)"); // #fff
    // default glyph size = 23 (dock), stroke 1.9
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.getAttribute("width")).toBe("23");
    expect(svg.getAttribute("stroke-width")).toBe("1.9");
  });

  it("supports the mobile-home tile geometry (58×58, radius 16, glyph 27)", () => {
    const { container } = render(
      <AppIcon app="dashboard" accent={DASH} size={58} radius={16} iconSize={27} />,
    );
    const tile = tileOf(container);
    expect(tile.style.width).toBe("58px");
    expect(tile.style.height).toBe("58px");
    expect(tile.style.borderRadius).toBe("16px");
    expect((container.querySelector("svg") as SVGSVGElement).getAttribute("width")).toBe("27");
  });

  it("drives the gradient from the per-app accent (theme-correct, not hardcoded)", () => {
    // Munshi green accent — gradient must follow the passed accent, no aqua bleed.
    const munshi = APPS.munshi.accent; // #059669
    const { container } = render(<AppIcon app="munshi" accent={munshi} />);
    const bg = tileOf(container).style.background;
    expect(bg).toContain(hexA(munshi, 0.95));
    expect(bg).not.toContain(hexA(DASH, 0.95));
  });

  // Theme correctness: the same tile renders faithfully under every theme palette
  // because the gradient is built purely from the passed accent. We pin the warm
  // samagra accent (#d9601a) and pin the exact stop ORDER — .95 then .7 at 160deg
  // (verbatim from the prototype dock tile) — so a future regression that swaps the
  // stops or the angle is caught, not just a substring presence.
  it("renders the exact 160deg stop order for any theme accent (samagra warm)", () => {
    const samagraAccent = "#d9601a"; // samagra theme accent (proto §6.3)
    const { container } = render(<AppIcon app="settings" accent={samagraAccent} />);
    const bg = tileOf(container).style.background;
    expect(bg).toBe(
      `linear-gradient(160deg,${hexA(samagraAccent, 0.95)},${hexA(samagraAccent, 0.7)})`,
    );
    // brighter stop precedes the dimmer stop (no inverted gradient).
    expect(bg.indexOf(hexA(samagraAccent, 0.95))).toBeLessThan(
      bg.indexOf(hexA(samagraAccent, 0.7)),
    );
  });

  describe("a11y fidelity hooks", () => {
    it("exposes the app name as an accessible label on the tile", () => {
      render(<AppIcon app="munshi" accent={APPS.munshi.accent} label="Munshi" />);
      const tile = screen.getByLabelText("Munshi");
      expect(tile.querySelector("svg")).not.toBeNull();
    });

    it("marks the inner glyph decorative so the label isn't doubled", () => {
      const { container } = render(
        <AppIcon app="munshi" accent={APPS.munshi.accent} label="Munshi" />,
      );
      expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    });
  });
});
