// E1.24 RED — Snake keyboard-gating predicate (proto.md §2.9, lines 165–177).
// The Snake app is a THIN presentational wrapper over the already-green pure
// `lib/snake/*` engine + cell math (deepak's E1.15/E1.16). khanak's wrapper owns
// the canvas/SVG board, the per-level interval, best/level persistence, and the
// keyboard handling. The ONE behavioural assertion the loop gates on (the
// headless residue, per the plan E1.24 Step 1 + proto.md §2.9):
//
//   `isSnakeActive` returns FALSE when `document.activeElement` is an INPUT or
//   TEXTAREA — so arrow/WASD/Space keypresses are NOT hijacked away from a
//   focused Terminal / Notes text field (proto.md §2.9:
//   "false if document.activeElement is INPUT/TEXTAREA").
//
// `isSnakeActive(ctx)` is a PURE predicate: `ctx.activeApp` is the already-
// resolved active app (top non-minimized window for pc, `mobileApp` for mobile
// — the z-order math lives in the wrapper, proto.md §1.5/§2.9), and the predicate
// reads `document.activeElement` from the DOM. With `activeApp === 'snake'` it is
// otherwise active; the input-focus guard must short-circuit it to false anyway.
//
// Per-pixel / interaction parity (board rendering, head/body fade, food halo,
// D-pad, speed ramp feel, death) is a SEPARATE human QA pass (RUBRIC §6, E1.24
// row) and is NOT tested here.
import { afterEach, describe, expect, it } from "vitest";
import type { Device, AppId } from "../../types/contracts";

import { isSnakeActive } from "./index";

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
