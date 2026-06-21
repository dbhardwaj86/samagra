// RED tests for the windowManager Zustand store (E1.7).
// The store is a THIN vanilla Zustand store over lib/wm/geometry + lib/wm/zorder;
// every numeric expectation below is the same proto.md §1.4–§1.10 value the pure
// modules already encode — these tests assert the store WIRES them correctly and
// holds `{ windows[], z }` with z starting at INITIAL_Z (20).
import { describe, it, expect, beforeEach } from "vitest";
import { createWindowManagerStore } from "./windowManager";
import { workArea } from "../lib/wm/geometry";
import { INITIAL_Z } from "../lib/wm/zorder";
import { APPS } from "../registry";

// proto.md §1.2: vw=window.innerWidth||1440, vh=window.innerHeight||900.
// The plan pins the headless viewport to 1440×900 so cascade/clamp math is exact.
beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true, writable: true });
  Object.defineProperty(window, "innerHeight", { value: 900, configurable: true, writable: true });
});

const make = () => createWindowManagerStore();
const WA = workArea("aqua", 1440, 900); // {x:8, y:36, w:1424, h:778}

describe("windowManager store — initial state", () => {
  it("starts with no windows and z = INITIAL_Z (20)", () => {
    const s = make().getState();
    expect(s.windows).toEqual([]);
    expect(s.z).toBe(INITIAL_Z);
  });
});

describe("openApp — spawn inside work area (proto.md §1.4)", () => {
  it("spawns a window whose first rect uses openRect cascade (n=0: inset 24x/12y, size=min(app, wa-24/-20))", () => {
    const store = make();
    store.getState().openApp("dashboard"); // app 940×610
    const s = store.getState();
    expect(s.windows).toHaveLength(1);
    const w = s.windows[0];
    expect(w.app).toBe("dashboard");
    expect(w.w).toBe(Math.min(APPS.dashboard.w, WA.w - 24)); // 940
    expect(w.h).toBe(Math.min(APPS.dashboard.h, WA.h - 20)); // 610
    expect(w.x).toBe(WA.x + 24); // 32
    expect(w.y).toBe(WA.y + 12); // 48
    expect(w.min).toBe(false);
    expect(w.max).toBe(false);
    expect(w.prev).toBeNull();
  });

  it("each new window bumps z so later windows sit on top (z starts 20 → first window z=21)", () => {
    const store = make();
    store.getState().openApp("dashboard");
    expect(store.getState().windows[0].z).toBe(INITIAL_Z + 1); // 21
    expect(store.getState().z).toBe(INITIAL_Z + 1);
    store.getState().openApp("notes");
    const ws = store.getState().windows;
    expect(ws[1].z).toBe(INITIAL_Z + 2); // 22
    expect(store.getState().z).toBe(INITIAL_Z + 2);
  });

  it("second distinct app cascades +34x/+30y (n=1 before insert)", () => {
    const store = make();
    store.getState().openApp("dashboard");
    store.getState().openApp("notes"); // app 840×600, n=1
    const w = store.getState().windows[1];
    expect(w.x).toBe(WA.x + 24 + 1 * 34); // 66
    expect(w.y).toBe(WA.y + 12 + 1 * 30); // 78
  });
});

describe("openApp — focus-or-open, never duplicate (proto.md §1.4 step 2)", () => {
  it("opening the same app again does NOT spawn a duplicate", () => {
    const store = make();
    store.getState().openApp("dashboard");
    store.getState().openApp("dashboard");
    expect(store.getState().windows).toHaveLength(1);
  });

  it("re-opening un-minimizes and bumps z (focus)", () => {
    const store = make();
    store.getState().openApp("dashboard");
    const id = store.getState().windows[0].id;
    store.getState().minimize(id);
    expect(store.getState().windows[0].min).toBe(true);
    store.getState().openApp("dashboard");
    const w = store.getState().windows[0];
    expect(w.min).toBe(false);
    expect(w.z).toBe(store.getState().z); // bumped to the new top
  });
});

describe("move — drag clamp (proto.md §1.6: x≥0, y≥barH)", () => {
  it("clamps x at 0 and y at the theme barH (aqua barH=30)", () => {
    const store = make();
    store.getState().openApp("dashboard");
    const id = store.getState().windows[0].id;
    store.getState().move(id, -50, -50);
    const w = store.getState().windows[0];
    expect(w.x).toBe(0);
    expect(w.y).toBe(30); // aqua barH
  });

  it("leaves an in-bounds move unclamped (no right/bottom clamp during drag)", () => {
    const store = make();
    store.getState().openApp("dashboard");
    const id = store.getState().windows[0].id;
    store.getState().move(id, 99999, 99999);
    const w = store.getState().windows[0];
    expect(w.x).toBe(99999);
    expect(w.y).toBe(99999);
  });
});

describe("resize — clamp (proto.md §1.7: ≥360×280)", () => {
  it("clamps below the 360×280 minimum", () => {
    const store = make();
    store.getState().openApp("dashboard");
    const id = store.getState().windows[0].id;
    store.getState().resize(id, 100, 100);
    const w = store.getState().windows[0];
    expect(w.w).toBe(360);
    expect(w.h).toBe(280);
  });

  it("passes a larger size through unchanged", () => {
    const store = make();
    store.getState().openApp("dashboard");
    const id = store.getState().windows[0].id;
    store.getState().resize(id, 900, 600);
    const w = store.getState().windows[0];
    expect(w.w).toBe(900);
    expect(w.h).toBe(600);
  });
});

describe("toggleMax — store prev then restore (proto.md §1.8)", () => {
  it("first toggle stores prev and fills the work area; second restores prev", () => {
    const store = make();
    store.getState().openApp("dashboard");
    const id = store.getState().windows[0].id;
    const before = { ...store.getState().windows[0] };

    store.getState().toggleMax(id);
    const maxed = store.getState().windows[0];
    expect(maxed.max).toBe(true);
    expect(maxed.prev).toEqual({ x: before.x, y: before.y, w: before.w, h: before.h });
    expect({ x: maxed.x, y: maxed.y, w: maxed.w, h: maxed.h }).toEqual(WA);

    store.getState().toggleMax(id);
    const restored = store.getState().windows[0];
    expect(restored.max).toBe(false);
    expect(restored.prev).toBeNull();
    expect({ x: restored.x, y: restored.y, w: restored.w, h: restored.h }).toEqual({
      x: before.x,
      y: before.y,
      w: before.w,
      h: before.h,
    });
  });
});

describe("focus — bumps z (proto.md §1.5)", () => {
  it("focusing the back window makes it the top (highest z)", () => {
    const store = make();
    store.getState().openApp("dashboard");
    store.getState().openApp("notes");
    const backId = store.getState().windows[0].id; // dashboard, lower z
    store.getState().focus(backId);
    const s = store.getState();
    const back = s.windows.find((w) => w.id === backId)!;
    const other = s.windows.find((w) => w.id !== backId)!;
    expect(back.z).toBe(s.z);
    expect(back.z).toBeGreaterThan(other.z);
  });
});

describe("tile — lay out non-minimized windows (proto.md §1.10)", () => {
  it("tiles every non-min window into the ceil(sqrt(n)) grid and clears max/min", () => {
    const store = make();
    store.getState().openApp("dashboard");
    store.getState().openApp("notes");
    store.getState().openApp("clock");
    store.getState().openApp("terminal"); // 4 → 2×2 grid
    store.getState().tile();
    const ws = store.getState().windows;
    expect(ws).toHaveLength(4);
    const cw = Math.round((WA.w - 12) / 2);
    const ch = Math.round((WA.h - 12) / 2);
    // i=0 → top-left cell at the work-area origin
    expect({ x: ws[0].x, y: ws[0].y, w: ws[0].w, h: ws[0].h }).toEqual({
      x: WA.x,
      y: WA.y,
      w: cw,
      h: ch,
    });
    for (const w of ws) {
      expect(w.max).toBe(false);
      expect(w.min).toBe(false);
    }
  });

  it("skips minimized windows", () => {
    const store = make();
    store.getState().openApp("dashboard");
    store.getState().openApp("notes");
    const minId = store.getState().windows[1].id;
    store.getState().minimize(minId);
    store.getState().tile();
    const minWin = store.getState().windows.find((w) => w.id === minId)!;
    // minimized window is not laid into the grid → stays minimized
    expect(minWin.min).toBe(true);
  });
});

// E3 polish — the WM is theme-aware: once the active theme changes (via the theme
// store's setTheme, which calls reclampForTheme), every subsequent window op
// (open/move/maximize/tile) uses THAT theme's work area + barH, not aqua's.
// geometry.workArea already supports all three themes; this pins the store wiring.
describe("theme-aware geometry (E3 — non-aqua work area)", () => {
  it("opens a window into the ACTIVE theme's work area after a theme switch (console)", () => {
    const store = make();
    store.getState().reclampForTheme("console"); // becomes the active WM theme
    store.getState().openApp("dashboard");
    const w = store.getState().windows[0];
    const WAc = workArea("console", 1440, 900); // { x:8, y:8, ... }
    expect(w.x).toBe(WAc.x + 24); // 32
    expect(w.y).toBe(WAc.y + 12); // 20 — NOT aqua's 48 (y=36+12)
  });

  it("clamps a drag to the ACTIVE theme's barH (console barH=0, not aqua 30)", () => {
    const store = make();
    store.getState().reclampForTheme("console");
    store.getState().openApp("dashboard");
    const id = store.getState().windows[0].id;
    store.getState().move(id, -50, -50);
    const w = store.getState().windows[0];
    expect(w.x).toBe(0);
    expect(w.y).toBe(0); // console barH=0
  });

  it("maximizes into the ACTIVE theme's full work area (samagra rail+bar)", () => {
    const store = make();
    store.getState().reclampForTheme("samagra");
    store.getState().openApp("dashboard");
    const id = store.getState().windows[0].id;
    store.getState().toggleMax(id);
    const w = store.getState().windows[0];
    expect({ x: w.x, y: w.y, w: w.w, h: w.h }).toEqual(workArea("samagra", 1440, 900));
  });

  it("tiles into the ACTIVE theme's work area origin (samagra rail offset)", () => {
    const store = make();
    store.getState().reclampForTheme("samagra");
    store.getState().openApp("dashboard");
    store.getState().openApp("notes");
    store.getState().tile();
    const WAs = workArea("samagra", 1440, 900); // x = rail+8 = 74
    const ws = store.getState().windows;
    expect(ws[0].x).toBe(WAs.x); // top-left cell sits at the samagra work-area origin
    expect(ws[0].y).toBe(WAs.y);
  });
});

describe("closeApp / minimize — engine hooks (proto.md §1.11)", () => {
  it("closeApp removes the window and fires the injected stop hook", () => {
    let stopped = 0;
    const store = createWindowManagerStore({ onClose: () => (stopped += 1) });
    store.getState().openApp("snake");
    const id = store.getState().windows[0].id;
    store.getState().closeApp(id);
    expect(store.getState().windows).toHaveLength(0);
    expect(stopped).toBe(1);
  });

  it("minimize sets min:true and fires the injected pause hook", () => {
    let paused = 0;
    const store = createWindowManagerStore({ onMinimize: () => (paused += 1) });
    store.getState().openApp("snake");
    const id = store.getState().windows[0].id;
    store.getState().minimize(id);
    expect(store.getState().windows[0].min).toBe(true);
    expect(paused).toBe(1);
  });
});
