// AP6 FIDELITY — Snake (README §Apps#14 Snake, #22c55e 480×680).
// The Snake app is a THIN presentational wrapper over the already-green pure
// `lib/snake/*` engine + cell math (deepak's E1.15/E1.16). This file pins TWO
// contracts:
//
//   1. BEHAVIOUR (kept from E1.24): the keyboard-gating residue the loop gates
//      on (proto.md §2.9, lines 165–177): `isSnakeActive` returns FALSE when
//      `document.activeElement` is an INPUT or TEXTAREA — so arrow/WASD/Space
//      keypresses are NOT hijacked away from a focused Terminal / Notes text
//      field. `isSnakeActive(ctx)` is a PURE predicate.
//
//   2. FIDELITY (AP6, new): the exact documented tokens/markup from the
//      prototype's `app_snake` (.dc.html L634–673 / README §Apps#14):
//        • Header — SCORE (10px/700 uppercase 0.07em muted label + 25px/800
//          value, tabular-nums) and BEST (same label + 25px/800 text value). The
//          score value is the FIXED snake green `#22c55e` (proto literal `A`),
//          NOT the theme accent — it reads green in all three screenshots even
//          though the theme accents differ (aqua indigo / console blue / samagra
//          ember). Only the chrome CONTAINERS track the theme (--samagra-*).
//        • Level toggle — a segmented control: a `LEVEL` label + Relaxed / Normal
//          buttons inside a cardBg / 1px-line / radius-10 / pad-4 container; the
//          SELECTED button is filled with the fixed green #22c55e (text `#04210f`),
//          the others are transparent/muted.
//        • Board — a relative wrapper at radius 14 with the proto's inset shadow
//          (`inset 0 0 0 1px <line>, inset 0 2px 26px rgba(0,0,0,0.45)`) holding a
//          <svg> of grid lines + the food (circle + halo) + the snake (rounded
//          rects, head solid #22c55e, body green fade). Board surface + food hue
//          are theme-kind-driven (dark navy / near-black / cream board; amber food,
//          or #d9601a in samagra) via local --snake-* vars overridden per
//          [data-theme] (FD1).
//        • Overlay — a blurred scrim (blur(2px)) with the Start / Resume /
//          Play-again CTA (fixed-green #22c55e bg, `#04210f` text, radius 999).
//        • Controls — a 3×2 D-pad of 50×46 keys (radius 12, subBg, 1px line) +
//          Pause/Resume + New game buttons.
// FD2: the SVG board IS a real inline <svg> (rounded-rect snake + circle food) —
// NEVER a letter/emoji grid. Per-pixel parity (head/body fade, food halo, speed
// ramp feel, death animation) is a SEPARATE human QA pass (RUBRIC §6, E1.24 row)
// and is NOT tested here.
import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Device, AppId } from "../../types/contracts";

import Snake, { isSnakeActive } from "./index";

// -------------------------------------------------------------------------- //
// BEHAVIOUR — keyboard-gating residue (kept from E1.24).                      //
// -------------------------------------------------------------------------- //

// A context in which snake WOULD be active (pc device, snake is the top window),
// so the only thing that can flip the predicate to false is the input-focus guard.
const SNAKE_ACTIVE_CTX: { device: Device; activeApp: AppId | null } = {
  device: "pc",
  activeApp: "snake",
};

// Track elements we attach so each case starts from a clean DOM / focus state.
const mounted: HTMLElement[] = [];

function focusEl(el: HTMLElement): void {
  document.body.appendChild(el);
  mounted.push(el);
  el.focus();
}

afterEach(() => {
  // Blur + detach anything we focused so activeElement resets to <body>.
  (document.activeElement as HTMLElement | null)?.blur?.();
  for (const el of mounted.splice(0)) el.remove();
});

describe("isSnakeActive (E1.24 keyboard-gating residue)", () => {
  it("returns false when activeElement is an INPUT", () => {
    focusEl(document.createElement("input"));
    expect(document.activeElement?.tagName).toBe("INPUT");

    expect(isSnakeActive(SNAKE_ACTIVE_CTX)).toBe(false);
  });

  it("returns false when activeElement is a TEXTAREA", () => {
    focusEl(document.createElement("textarea"));
    expect(document.activeElement?.tagName).toBe("TEXTAREA");

    expect(isSnakeActive(SNAKE_ACTIVE_CTX)).toBe(false);
  });

  it("returns true when snake is the active app and no text field is focused", () => {
    // Positive control: with no INPUT/TEXTAREA focused, the guard does NOT fire,
    // so the otherwise-active snake context drives the game.
    expect(["INPUT", "TEXTAREA"]).not.toContain(document.activeElement?.tagName);

    expect(isSnakeActive(SNAKE_ACTIVE_CTX)).toBe(true);
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — header SCORE / BEST (AP6 / FD1).                                 //
// -------------------------------------------------------------------------- //
describe("Snake (fidelity — header)", () => {
  it("renders the SCORE label + value, with the value in the FIXED snake green #22c55e (proto A, 25px/800 tabular-nums)", () => {
    render(<Snake />);
    // The uppercase SCORE label sits above the numeric value.
    const label = screen.getByTestId("snake-score-label");
    expect(label).toHaveTextContent(/^score$/i);
    expect(label).toHaveStyle({
      fontSize: "10px",
      fontWeight: "700",
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      color: "var(--samagra-muted)",
    });
    // The value: 25px/800, tabular-nums, in the prototype's FIXED snake green
    // `A='#22c55e'` — NOT the theme accent var. All three screenshots (aqua-18,
    // console-04, samagra-04) render the score green though the theme accents
    // differ (indigo / blue / ember), so the green is a brand literal, not accent.
    const value = screen.getByTestId("snake-score-value");
    expect(value).toHaveTextContent("0"); // fresh game, score 0
    expect(value).toHaveStyle({
      fontSize: "25px",
      fontWeight: "800",
      fontVariantNumeric: "tabular-nums",
      color: "#22c55e",
    });
    // Guard the regression: the score value must NOT be wired to --samagra-accent
    // (which would paint it ember in samagra, contradicting samagra-04-snake.png).
    expect(value.getAttribute("style") ?? "").not.toContain("--samagra-accent");
  });

  it("renders the BEST label + value (25px/800 tabular-nums, theme text var)", () => {
    render(<Snake />);
    const label = screen.getByTestId("snake-best-label");
    expect(label).toHaveTextContent(/^best$/i);
    expect(label).toHaveStyle({
      fontSize: "10px",
      fontWeight: "700",
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      color: "var(--samagra-muted)",
    });
    const value = screen.getByTestId("snake-best-value");
    // best defaults to 0 with no persisted value.
    expect(value).toHaveTextContent("0");
    expect(value).toHaveStyle({
      fontSize: "25px",
      fontWeight: "800",
      fontVariantNumeric: "tabular-nums",
      color: "var(--samagra-text)",
    });
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — Relaxed / Normal segmented level toggle (AP6 / FD1).            //
// -------------------------------------------------------------------------- //
describe("Snake (fidelity — level toggle)", () => {
  it("renders a LEVEL label + Relaxed / Normal segmented buttons in a themed container", () => {
    render(<Snake />);
    // The container carries the proto's cardBg / 1px-line / radius-10 / pad-4 (FD1).
    const group = screen.getByRole("group", { name: /difficulty/i });
    expect(group).toHaveStyle({
      background: "var(--samagra-card-bg)",
      border: "1px solid var(--samagra-line)",
      borderRadius: "10px",
      padding: "4px",
    });
    // The inline LEVEL caption.
    expect(within(group).getByText(/^level$/i)).toBeInTheDocument();
    // Both difficulty buttons, capitalised exactly as the prototype renders them.
    expect(within(group).getByRole("button", { name: /^relaxed$/i })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: /^normal$/i })).toBeInTheDocument();
  });

  it("fills the SELECTED level with the FIXED snake green #22c55e (text #04210f); the other stays transparent/muted", () => {
    render(<Snake />);
    const group = screen.getByRole("group", { name: /difficulty/i });
    // Default level = normal (proto §2.8 default) → Normal is the green-filled pill.
    // The fill is the proto's fixed `A='#22c55e'`, NOT the theme accent (the selected
    // pill reads green in all three screenshots, not the per-theme accent colour).
    const normal = within(group).getByRole("button", { name: /^normal$/i });
    const relaxed = within(group).getByRole("button", { name: /^relaxed$/i });
    expect(normal).toHaveAttribute("aria-pressed", "true");
    expect(normal).toHaveStyle({
      background: "#22c55e",
      color: "#04210f",
      fontSize: "12px",
      fontWeight: "700",
    });
    expect(relaxed).toHaveAttribute("aria-pressed", "false");
    expect(relaxed).toHaveStyle({
      background: "transparent",
      color: "var(--samagra-muted)",
    });
  });

  it("moves the green fill to whichever level is clicked (selection follows the click)", () => {
    render(<Snake />);
    const group = screen.getByRole("group", { name: /difficulty/i });
    const relaxed = within(group).getByRole("button", { name: /^relaxed$/i });
    const normal = within(group).getByRole("button", { name: /^normal$/i });

    fireEvent.click(relaxed);
    expect(relaxed).toHaveAttribute("aria-pressed", "true");
    expect(relaxed).toHaveStyle({ background: "#22c55e", color: "#04210f" });
    expect(normal).toHaveAttribute("aria-pressed", "false");
    expect(normal).toHaveStyle({ background: "transparent", color: "var(--samagra-muted)" });
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — themed board + grid + inset shadow + radius 14 (AP6 / FD1).     //
// -------------------------------------------------------------------------- //
describe("Snake (fidelity — board)", () => {
  it("renders the board wrapper at radius 14 with the proto's inset shadow + theme board surface (FD1)", () => {
    render(<Snake />);
    const wrap = screen.getByTestId("snake-board-wrap");
    expect(wrap).toHaveStyle({
      borderRadius: "14px",
      overflow: "hidden",
      position: "relative",
      // theme-kind board surface via a local var (overridden per [data-theme]).
      background: "var(--snake-board-bg)",
      // the proto's exact inset shadow: 1px line inset + a 26px soft inner shade.
      boxShadow:
        "inset 0 0 0 1px var(--samagra-line), inset 0 2px 26px rgba(0,0,0,0.45)",
    });
  });

  it("renders the board as a real inline <svg> (FD2) carrying the grid lines", () => {
    render(<Snake />);
    const svg = screen.getByLabelText("Snake board");
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg).toHaveAttribute("role", "img");
    // 18 interior vertical + 18 interior horizontal grid lines for a 19-col board
    // (proto: i from 1..cols-1). Each is a real <line> with the theme grid stroke.
    const grid = svg.querySelectorAll("line.snake-grid");
    expect(grid).toHaveLength(36);
    expect(grid[0]).toHaveAttribute("stroke", "var(--snake-grid)");
  });

  it("draws the snake body as rounded rects — head solid #22c55e, body in a green fade (FD2)", () => {
    render(<Snake />);
    const svg = screen.getByLabelText("Snake board");
    // init body = 3 segments [[9,9],[8,9],[7,9]].
    const segs = svg.querySelectorAll("rect.snake-seg");
    expect(segs).toHaveLength(3);
    // every seg is a rounded rect (proto rx 5 at the default 18px cell).
    for (const s of segs) expect(s).toHaveAttribute("rx", "5");
    // the head (index 0) is the SOLID prototype snake green `A='#22c55e'` — a fixed
    // brand literal, NOT the theme accent (so it stays green in samagra, not ember).
    const head = svg.querySelector("rect.snake-seg.is-head");
    expect(head).not.toBeNull();
    expect(head).toHaveAttribute("fill", "#22c55e");
    // a non-head seg fades that SAME green via color-mix (proto hex(A, 0.8-…)).
    const body = svg.querySelector("rect.snake-seg:not(.is-head)");
    expect(body!.getAttribute("fill")).toMatch(/color-mix\(in srgb, #22c55e /);
    // regression guard: NO snake segment may be wired to the theme accent var.
    for (const s of segs) {
      expect(s.getAttribute("fill") ?? "").not.toContain("--samagra-accent");
    }
  });

  it("draws the food as a filled circle + a halo ring, in the theme food var (FD1)", () => {
    render(<Snake />);
    const svg = screen.getByLabelText("Snake board");
    const food = svg.querySelector("circle.snake-food");
    const halo = svg.querySelector("circle.snake-food-halo");
    expect(food).not.toBeNull();
    expect(halo).not.toBeNull();
    // the filled disc uses the theme food var (amber, or #d9601a in samagra) — FD1.
    expect(food).toHaveAttribute("fill", "var(--snake-food)");
    // the halo is an unfilled ring (no fill) stroked in a tinted food var.
    expect(halo).toHaveAttribute("fill", "none");
    expect(halo).toHaveAttribute("stroke", "var(--snake-food-halo)");
  });

  it("scopes the theme-kind board + food hues to [data-theme] via a <style> block (FD1)", () => {
    const { container } = render(<Snake />);
    // The Snake root injects a scoped <style> that defines --snake-board-bg /
    // --snake-food / --snake-grid defaults and overrides them under each
    // [data-theme="console"|"samagra"] ancestor — so the surface recolours with
    // the active theme with NO store coupling.
    const style = container.querySelector("style");
    expect(style).not.toBeNull();
    const css = style!.textContent ?? "";
    // the aqua/default dark navy board, the console near-black, the samagra cream.
    expect(css).toContain("#0d1422"); // aqua/default board
    expect(css).toContain("#070b12"); // console board
    expect(css).toContain("#efe0c8"); // samagra board
    // the food hues: amber default, the samagra ember override.
    expect(css).toContain("#fbbf24"); // default food
    expect(css).toContain("#d9601a"); // samagra food
    // overrides are keyed off the [data-theme] ancestor (declarative FD1).
    expect(css).toMatch(/\[data-theme=["']?console["']?\]/);
    expect(css).toMatch(/\[data-theme=["']?samagra["']?\]/);
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — overlay scrim + CTA (AP6 / FD1).                                 //
// -------------------------------------------------------------------------- //
describe("Snake (fidelity — overlay)", () => {
  it("shows a blurred scrim overlay with the Start CTA on a fresh (idle) game", () => {
    const { container } = render(<Snake />);
    const overlay = screen.getByTestId("snake-overlay");
    // the proto's blurred scrim — a semi-opaque dark wash. (The 2px backdrop blur
    // is applied via the scoped `.snake-overlay` rule — jsdom's CSSOM drops the
    // unsupported `backdrop-filter` property from inline styles, so the blur is
    // asserted from the stylesheet text + the class hook below, not toHaveStyle.)
    expect(overlay).toHaveStyle({ background: "rgba(5,8,14,0.58)" });
    expect(overlay).toHaveClass("snake-overlay");
    const css = container.querySelector("style")!.textContent ?? "";
    expect(css).toMatch(/\.snake-overlay\s*\{[^}]*backdrop-filter\s*:\s*blur\(2px\)/);
    // the CTA pill: fixed snake-green bg (#22c55e, proto A — green in every theme),
    // #04210f text, fully-rounded (999) — proto exact.
    const cta = within(overlay).getByRole("button", { name: /^start$/i });
    expect(cta).toHaveStyle({
      background: "#22c55e",
      color: "#04210f",
      borderRadius: "999px",
      fontWeight: "800",
    });
    // the idle title + subtitle (the proto's "Snake" + the controls hint).
    expect(within(overlay).getByText(/^snake$/i)).toBeInTheDocument();
    expect(within(overlay).getByText(/arrows \/ wasd/i)).toBeInTheDocument();
  });

  it("dismisses the overlay once the game is running (Start clicked)", () => {
    render(<Snake />);
    const overlay = screen.getByTestId("snake-overlay");
    fireEvent.click(within(overlay).getByRole("button", { name: /^start$/i }));
    // a running game has no overlay scrim.
    expect(screen.queryByTestId("snake-overlay")).toBeNull();
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — D-pad + control buttons (AP6 / FD1).                            //
// -------------------------------------------------------------------------- //
describe("Snake (fidelity — controls)", () => {
  it("renders a 4-key D-pad of 50×46 keys (radius 12, subBg, 1px line) — FD1", () => {
    render(<Snake />);
    const dpad = screen.getByRole("group", { name: /d-pad/i });
    // the four directional keys (labelled for a11y, NOT bare unicode badges).
    for (const dir of ["Up", "Down", "Left", "Right"]) {
      const key = within(dpad).getByRole("button", { name: dir });
      expect(key).toHaveStyle({
        width: "50px",
        height: "46px",
        borderRadius: "12px",
        background: "var(--samagra-sub-bg)",
        border: "1px solid var(--samagra-line)",
      });
    }
  });

  it("renders the Pause + New game controls at the proto geometry (radius 11)", () => {
    render(<Snake />);
    // The side-control column is the proto's right stack (primary Start/Pause +
    // New game). It is scoped via its testid so the side "Start" is unambiguous
    // from the overlay CTA "Start" — on an idle game BOTH read "Start" (faithful
    // to the prototype: overlay CTA + side primary share the label).
    const side = screen.getByTestId("snake-side-controls");
    // a fresh (idle) game shows Start (not Pause) on the side control; once running
    // it flips to Pause. New game is always present, in the muted sub-bg style.
    expect(within(side).getByRole("button", { name: /new game/i })).toHaveStyle({
      borderRadius: "11px",
      background: "var(--samagra-sub-bg)",
      color: "var(--samagra-muted)",
    });
    // the idle side primary is a Start in the snake-green tint (proto hex(A,0.16)),
    // built off the fixed #22c55e (not the theme accent) so it stays green in every theme.
    const sideStart = within(side).getByRole("button", { name: /^start$/i });
    expect(sideStart).toHaveStyle({
      borderRadius: "11px",
      background: "color-mix(in srgb, #22c55e 16%, transparent)",
      color: "#22c55e",
    });
    // start the game → the side primary becomes a Pause in the proto's amber tint.
    fireEvent.click(sideStart);
    const pause = within(side).getByRole("button", { name: /pause/i });
    expect(pause).toHaveStyle({ borderRadius: "11px", color: "#d97706" });
  });
});
