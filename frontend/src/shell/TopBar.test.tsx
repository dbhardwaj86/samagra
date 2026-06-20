// CH1 fidelity — TopBar aqua chrome (proto.md §1.1 / .dc.html renderTopBar L977-985).
// The aqua top bar is a 30px (barH) glass strip: leading ◈ diamond + SAMAGRA
// wordmark + active window title, then a right cluster (activity glyph + समग्र +
// live clock). All colors/sizes are driven by the active theme tokens (FD1) so the
// bar renders faithfully under aqua / console / samagra; the activity mark is an
// inline <svg> from the <Icon> primitive (FD2), never a letter/text glyph.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TopBar from "./TopBar";
import { THEMES } from "../themes";

const aqua = THEMES.aqua;

// jsdom's CSSOM canonicalises rgba() to a space-separated form (e.g.
// "rgba(255,255,255,.55)" → "rgba(255, 255, 255, 0.55)") when a value round-trips
// through the `background` shorthand. The DESIGN INTENT is "paint from the theme
// token" — so we compare the rendered value against the token modulo that CSSOM
// whitespace normalization, keeping the assertion meaningful (still token-driven)
// without asserting an artefact of jsdom's serializer.
const norm = (s: string) => s.replace(/,\s+/g, ",");

// jsdom's CSSOM also re-quotes font-family names (single → double quotes) and
// re-spaces the comma list when a value round-trips through the `font-family`
// property — e.g. the token `'Tiro Devanagari Hindi',serif` serializes as
// `"Tiro Devanagari Hindi", serif`. normFont collapses both quote style and
// whitespace so we still assert "painted from the wordmark token" (the Devanagari
// family) without pinning a serializer artefact.
const normFont = (s: string) => s.replace(/["']/g, "").replace(/\s*,\s*/g, ",");

describe("TopBar (CH1 aqua chrome fidelity)", () => {
  it("renders the chrome bar without crashing", () => {
    const { container } = render(<TopBar activeTitle="Dashboard" clock="9:41 AM" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders the SAMAGRA wordmark", () => {
    render(<TopBar activeTitle="Dashboard" clock="9:41 AM" />);
    expect(screen.getByText("SAMAGRA")).toBeInTheDocument();
  });

  it("renders the active window title", () => {
    render(<TopBar activeTitle="Terminal" clock="9:41 AM" />);
    expect(screen.getByText("Terminal")).toBeInTheDocument();
  });

  it("renders the live clock string", () => {
    render(<TopBar activeTitle="Dashboard" clock="12:34 PM" />);
    expect(screen.getByText("12:34 PM")).toBeInTheDocument();
  });

  // --- exact prototype measurements (renderTopBar L978) ---
  it("is 30px tall (proto.md §1.1 aqua barH)", () => {
    const { container } = render(<TopBar activeTitle="Dashboard" clock="9:41 AM" />);
    const bar = container.firstChild as HTMLElement;
    expect(bar.style.height).toBe("30px");
  });

  it("uses the aqua bar gap / padding from the prototype (gap 18, padding 0 14px)", () => {
    const { container } = render(<TopBar activeTitle="Dashboard" clock="9:41 AM" />);
    const bar = container.firstChild as HTMLElement;
    expect(bar.style.gap).toBe("18px");
    expect(bar.style.padding).toBe("0px 14px");
  });

  // --- theme tokens (FD1): bar surface / text / blur come from THEMES, not literals ---
  it("paints the bar surface + text from the active theme tokens (aqua default)", () => {
    const { container } = render(<TopBar activeTitle="Dashboard" clock="9:41 AM" />);
    const bar = container.firstChild as HTMLElement;
    expect(norm(bar.style.background)).toBe(aqua.bar);
    expect(bar.style.color).toBe("rgb(29, 29, 31)"); // aqua.barText #1d1d1f
    expect(bar.style.backdropFilter).toBe(aqua.barBlur);
  });

  // --- FD2: the leading status mark is an inline <svg>, never a letter badge ---
  it("renders the activity status mark as an inline <svg> icon (not a text glyph)", () => {
    const { container } = render(<TopBar activeTitle="Dashboard" clock="9:41 AM" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders the समग्र (Devanagari) wordmark in the right cluster", () => {
    render(<TopBar activeTitle="Dashboard" clock="9:41 AM" />);
    expect(screen.getByText("समग्र")).toBeInTheDocument();
  });

  // --- clock affordance: clicking the clock opens the Clock app (proto L984) ---
  it("fires onOpenClock when the clock string is clicked", () => {
    const onOpenClock = vi.fn();
    render(<TopBar activeTitle="Dashboard" clock="9:41 AM" onOpenClock={onOpenClock} />);
    fireEvent.click(screen.getByText("9:41 AM"));
    expect(onOpenClock).toHaveBeenCalledTimes(1);
  });

  it("renders the clock with tabular-nums for stable digit width", () => {
    render(<TopBar activeTitle="Dashboard" clock="9:41 AM" />);
    const clock = screen.getByText("9:41 AM");
    expect(clock.style.fontVariantNumeric).toBe("tabular-nums");
  });

  // --- theme correctness (FD1): the SAME bar renders from console tokens when
  // the active theme is console — no aqua values bleed through. (renderTopBar
  // returns null for console in the prototype; the React port hides it the same
  // way by rendering nothing.)
  it("renders nothing for the console theme (console has no top bar)", () => {
    const { container } = render(
      <TopBar activeTitle="Dashboard" clock="9:41 AM" theme="console" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("paints the bar from samagra tokens when the active theme is samagra", () => {
    const { container } = render(
      <TopBar activeTitle="Dashboard" clock="9:41 AM" theme="samagra" />,
    );
    const bar = container.firstChild as HTMLElement;
    // samagra barH = 32, bar surface + text from samagra tokens (proto §6.3)
    expect(bar.style.height).toBe("32px");
    expect(norm(bar.style.background)).toBe(THEMES.samagra.bar);
    expect(bar.style.color).toBe("rgb(42, 33, 24)"); // samagra.barText #2a2118
  });

  // --- samagra right cluster (renderTopBar L992-993): Phase pill + clickable clock,
  // NOT the active window title (which the aqua bar shows instead). ---
  it("renders the samagra strip's Phase pill in the right cluster", () => {
    render(<TopBar activeTitle="Dashboard" clock="9:41 AM" theme="samagra" />);
    const pill = screen.getByText("Phase 1");
    // pill chrome from the proto `pill()` helper: radius 999, 11px/600, warning fg
    expect(pill.style.borderRadius).toBe("999px");
    expect(pill.style.fontSize).toBe("11px");
    expect(pill.style.color).toBe("rgb(217, 119, 6)"); // #d97706 warning
  });

  it("the samagra strip shows the wordmark sub-label, not the active window title", () => {
    render(<TopBar activeTitle="Dashboard" clock="9:41 AM" theme="samagra" />);
    expect(screen.getByText("SAMAGRA · content OS")).toBeInTheDocument();
    // the proto samagra strip does NOT surface the active window title
    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(screen.getByText("समग्र")).toBeInTheDocument();
  });

  it("fires onOpenClock from the samagra strip clock too", () => {
    const onOpenClock = vi.fn();
    render(
      <TopBar activeTitle="Dashboard" clock="9:41 AM" theme="samagra" onOpenClock={onOpenClock} />,
    );
    fireEvent.click(screen.getByText("9:41 AM"));
    expect(onOpenClock).toHaveBeenCalledTimes(1);
  });

  // --- CH3 samagra rail-offset: the strip starts at left = rail (66) so it sits to
  // the RIGHT of the left rail dock, not over it (renderTopBar samagra L988). ---
  it("offsets the samagra strip by the rail width so it clears the left rail", () => {
    const { container } = render(
      <TopBar activeTitle="Dashboard" clock="9:41 AM" theme="samagra" />,
    );
    const bar = container.firstChild as HTMLElement;
    // left is driven by the theme rail token (66), never 0 like the aqua bar
    expect(bar.style.left).toBe(`${THEMES.samagra.rail}px`);
    expect(bar.style.left).toBe("66px");
  });

  // --- CH3 Devanagari wordmark: समग्र rendered in the Tiro Devanagari wordmark font,
  // accent-colored, at the 18px display size (renderTopBar samagra L990). ---
  it("renders समग्र in the Devanagari wordmark font + accent color (not a generic span)", () => {
    render(<TopBar activeTitle="Dashboard" clock="9:41 AM" theme="samagra" />);
    const mark = screen.getByText("समग्र");
    expect(normFont(mark.style.fontFamily)).toBe(normFont(THEMES.samagra.wordmark));
    expect(mark.style.fontSize).toBe("18px");
    // colored with the samagra accent token (#d9601a), not the muted/text token
    expect(mark.style.color).toBe("rgb(217, 96, 26)");
  });

  // --- CH3 padding/gap: the samagra strip uses its own gap 14 / padding 0 16px,
  // distinct from the aqua bar's gap 18 / padding 0 14px. ---
  it("uses the samagra strip gap 14 / padding 0 16px (distinct from aqua)", () => {
    const { container } = render(
      <TopBar activeTitle="Dashboard" clock="9:41 AM" theme="samagra" />,
    );
    const bar = container.firstChild as HTMLElement;
    expect(bar.style.gap).toBe("14px");
    expect(bar.style.padding).toBe("0px 16px");
  });
});
