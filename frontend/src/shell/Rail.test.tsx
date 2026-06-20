// CH3 fidelity — Samagra left Rail dock (README §Global Layout / .dc.html renderDock
// samagra branch L1024-1028 + dockItem samagra branch L1006-1011). The samagra dock is
// a vertical LEFT rail (width 66, full height, flex-column, gap 7, padding 12px 0,
// borderRight 1px dockBorder, dockBg glass) whose FIRST child is a 40×40 r12 "स" wordmark
// tile (linear-gradient(150deg, accent, #b8480f), white, t.wordmark, 20px) followed by
// a scrolling column of one launcher per app in the frozen ORDER. Each launcher is a
// 46×46 r13 tile holding the app's inline <svg> glyph at size 23 (FD2 — NEVER a letter
// badge); a RUNNING app tints to accent @ 0.14 and shows a LEFT accent bar
// (3×18 r3, left:-9, vertically centered). All colors/sizes are driven by the active
// samagra theme tokens + the unified theme accent (FD1) — no aqua/console values bleed
// in. Pixel parity is a separate human QA pass.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Rail from "./Rail";
import { ORDER } from "../registry";
import { THEMES } from "../themes";
import { hexA } from "../components/icons-data";

const sam = THEMES.samagra;

// jsdom canonicalises rgba()/hex round-tripped through the `background` shorthand to a
// space-separated form, and trims a redundant trailing zero in an alpha channel
// (e.g. the `dockBorder` token `rgba(42,33,24,0.10)` serializes back as
// `rgba(42,33,24,0.1)`). norm collapses both that whitespace and the `0.10`→`0.1`
// alpha trim so the assertion stays "painted from the token", not a serializer quirk.
const norm = (s: string) => s.replace(/,\s+/g, ",").replace(/(\.\d*?)0+\)/g, "$1)").replace(/\.\)/g, ")");

// jsdom's CSSOM re-quotes font-family names (single → double) and re-spaces the
// comma list when a value round-trips through `font-family` — e.g. the token
// `'Tiro Devanagari Hindi',serif` serializes as `"Tiro Devanagari Hindi", serif`.
// normFont collapses both quote style and whitespace so we still assert "painted
// from the wordmark token" without pinning that serializer artefact.
const normFont = (s: string) => s.replace(/["']/g, "").replace(/\s*,\s*/g, ",");

describe("Rail (CH3 samagra chrome fidelity)", () => {
  it("renders the rail container without crashing", () => {
    const { container } = render(<Rail onOpen={() => {}} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  // --- exact rail container geometry (renderDock samagra L1025) ---
  it("is a full-height LEFT rail of width 66 (README samagra rail width)", () => {
    const { container } = render(<Rail onOpen={() => {}} />);
    const rail = container.firstChild as HTMLElement;
    expect(rail.style.position).toBe("absolute");
    expect(rail.style.left).toBe("0px");
    expect(rail.style.top).toBe("0px");
    expect(rail.style.bottom).toBe("0px");
    // width comes from the theme rail token (66), not a literal
    expect(rail.style.width).toBe(`${sam.rail}px`);
    expect(rail.style.width).toBe("66px");
  });

  it("stacks its launchers vertically (flex column, centered, gap 7, padding 12px 0)", () => {
    const { container } = render(<Rail onOpen={() => {}} />);
    const rail = container.firstChild as HTMLElement;
    expect(rail.style.flexDirection).toBe("column");
    expect(rail.style.alignItems).toBe("center");
    expect(rail.style.gap).toBe("7px");
    expect(rail.style.padding).toBe("12px 0px");
  });

  it("paints the rail glass + right divider from the active samagra tokens (FD1)", () => {
    const { container } = render(<Rail onOpen={() => {}} />);
    const rail = container.firstChild as HTMLElement;
    expect(norm(rail.style.background)).toBe(sam.dockBg);
    expect(rail.style.backdropFilter).toBe(sam.dockBlur);
    // borderRight 1px dockBorder token (renderDock samagra L1024) — not a
    // bottom-center floating dock, and NOT the slightly darker `line` token.
    expect(norm(rail.style.borderRight)).toBe(norm(`1px solid ${sam.dockBorder}`));
  });

  // --- स Devanagari wordmark tile (renderDock samagra L1027) ---
  it("leads with a 40×40 स wordmark tile in the samagra accent gradient", () => {
    render(<Rail onOpen={() => {}} />);
    const mark = screen.getByText("स");
    expect(mark.style.width).toBe("40px");
    expect(mark.style.height).toBe("40px");
    expect(mark.style.borderRadius).toBe("12px");
    // accent gradient: linear-gradient(150deg, accent, #b8480f) — accent from tokens
    expect(mark.style.background).toContain("linear-gradient(150deg");
    expect(norm(mark.style.background)).toContain(norm(sam.accent));
    // rendered in the Devanagari wordmark font, white glyph
    expect(normFont(mark.style.fontFamily)).toBe(normFont(sam.wordmark));
    expect(mark.style.color).toBe("rgb(255, 255, 255)");
  });

  // --- one launcher per app, FD2 inline <svg> glyphs (never letter badges) ---
  it("renders one launcher per app in ORDER, each an inline <svg> glyph", () => {
    render(<Rail onOpen={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(ORDER.length);
    // every launcher carries an inline app glyph; no bare first-letter text label
    const dash = screen.getByRole("button", { name: /dashboard/i });
    expect(dash.querySelector("svg")).not.toBeNull();
    expect(dash.textContent).toBe("");
  });

  it("sizes each launcher tile at the prototype's 46×46 r13 geometry, glyph 23", () => {
    render(<Rail onOpen={() => {}} />);
    const dash = screen.getByRole("button", { name: /dashboard/i });
    expect(dash.style.width).toBe("46px");
    expect(dash.style.height).toBe("46px");
    expect(dash.style.borderRadius).toBe("13px");
    expect((dash.querySelector("svg") as SVGSVGElement).getAttribute("width")).toBe("23");
  });

  // --- idle launcher: transparent fill, muted glyph (dockItem samagra L1008) ---
  it("renders an idle (not-running) launcher transparent with a muted glyph color", () => {
    render(<Rail onOpen={() => {}} />);
    const dash = screen.getByRole("button", { name: /dashboard/i });
    expect(dash.style.background).toBe("transparent");
    expect(norm(dash.style.color)).toBe("rgb(147,127,99)"); // samagra.muted #937f63
    // an idle launcher shows NO left accent bar
    expect(dash.querySelector('[data-testid="rail-active-bar"]')).toBeNull();
  });

  // --- running launcher: accent tint + LEFT accent bar (dockItem samagra L1008/L1011) ---
  it("tints a RUNNING launcher to the accent and shows a left accent bar", () => {
    render(<Rail onOpen={() => {}} running={["terminal"]} />);
    const term = screen.getByRole("button", { name: /terminal/i });
    // accent @ 0.14 tint, accent-colored glyph
    expect(norm(term.style.background)).toBe(norm(hexA(sam.accent, 0.14)));
    expect(norm(term.style.color)).toBe("rgb(217,96,26)"); // samagra.accent #d9601a
    // the LEFT accent bar: 3×18 r3, left:-9, vertically centered, accent fill
    const bar = term.querySelector('[data-testid="rail-active-bar"]') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar.style.width).toBe("3px");
    expect(bar.style.height).toBe("18px");
    expect(bar.style.left).toBe("-9px");
    expect(norm(bar.style.background)).toBe("rgb(217,96,26)"); // accent
  });

  it("shows the active bar ONLY on the running launcher, not on idle ones", () => {
    render(<Rail onOpen={() => {}} running={["terminal"]} />);
    const term = screen.getByRole("button", { name: /terminal/i });
    const dash = screen.getByRole("button", { name: /dashboard/i });
    expect(term.querySelector('[data-testid="rail-active-bar"]')).not.toBeNull();
    expect(dash.querySelector('[data-testid="rail-active-bar"]')).toBeNull();
  });

  // --- behaviour: click dispatches openApp ---
  it("dispatches openApp with the app id when a launcher is clicked", () => {
    const onOpen = vi.fn();
    render(<Rail onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /dashboard/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(ORDER[0]);
  });

  it("dispatches openApp for a non-first app id", () => {
    const onOpen = vi.fn();
    render(<Rail onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /terminal/i }));
    expect(onOpen).toHaveBeenCalledWith("terminal");
  });
});
