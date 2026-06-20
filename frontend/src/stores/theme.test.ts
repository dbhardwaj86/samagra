// RED tests for the theme Zustand store (E1.7).
// Holds `{ theme, device }`. `setTheme` updates the theme AND re-clamps every
// window in the wired windowManager store via lib/wm/geometry.reclampOnTheme
// (proto.md §1.9); `setDevice` toggles the device (proto.md §1.11).
import { describe, it, expect, beforeEach } from "vitest";
import { createThemeStore } from "./theme";
import { createWindowManagerStore } from "./windowManager";
import { workArea, reclampOnTheme } from "../lib/wm/geometry";

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true, writable: true });
  Object.defineProperty(window, "innerHeight", { value: 900, configurable: true, writable: true });
});

describe("theme store — initial state", () => {
  it("defaults to aqua / pc", () => {
    const wm = createWindowManagerStore();
    const t = createThemeStore({ wm }).getState();
    expect(t.theme).toBe("aqua");
    expect(t.device).toBe("pc");
  });
});

describe("setTheme — update theme + re-clamp every window (proto.md §1.9)", () => {
  it("updates the current theme", () => {
    const wm = createWindowManagerStore();
    const theme = createThemeStore({ wm });
    theme.getState().setTheme("samagra");
    expect(theme.getState().theme).toBe("samagra");
  });

  // FD1 — the store must drive ALL THREE themes (aqua/console/samagra), since
  // ThemeRoot maps the active theme's tokens to CSS vars. A store that only
  // honored aqua/samagra would silently break console fidelity.
  it("can switch to every supported theme", () => {
    const wm = createWindowManagerStore();
    const theme = createThemeStore({ wm });
    for (const t of ["console", "samagra", "aqua"] as const) {
      theme.getState().setTheme(t);
      expect(theme.getState().theme).toBe(t);
    }
  });

  it("re-clamps every normal window into the new theme's work area (8px inset, not resized)", () => {
    const wm = createWindowManagerStore();
    const theme = createThemeStore({ wm });
    wm.getState().openApp("dashboard");
    const id = wm.getState().windows[0].id;
    // park it far off-screen so the re-clamp must move it
    wm.getState().move(id, 5000, 5000);
    const moved = wm.getState().windows[0];

    theme.getState().setTheme("samagra");

    const wa = workArea("samagra", 1440, 900);
    const expected = reclampOnTheme({ x: moved.x, y: moved.y, w: moved.w, h: moved.h }, wa);
    const after = wm.getState().windows[0];
    expect(after.x).toBe(expected.x);
    expect(after.y).toBe(expected.y);
    expect(after.w).toBe(moved.w); // normal window is NOT resized
    expect(after.h).toBe(moved.h);
  });

  it("refits a maximized window to the new theme's full work area", () => {
    const wm = createWindowManagerStore();
    const theme = createThemeStore({ wm });
    wm.getState().openApp("dashboard");
    const id = wm.getState().windows[0].id;
    wm.getState().toggleMax(id); // now maximized to aqua work area

    theme.getState().setTheme("console");

    const wa = workArea("console", 1440, 900);
    const after = wm.getState().windows[0];
    expect(after.max).toBe(true);
    expect({ x: after.x, y: after.y, w: after.w, h: after.h }).toEqual(wa);
  });
});

describe("setDevice — toggle device (proto.md §1.11)", () => {
  it("switches device to mobile and back to pc", () => {
    const wm = createWindowManagerStore();
    const theme = createThemeStore({ wm });
    theme.getState().setDevice("mobile");
    expect(theme.getState().device).toBe("mobile");
    theme.getState().setDevice("pc");
    expect(theme.getState().device).toBe("pc");
  });
});
