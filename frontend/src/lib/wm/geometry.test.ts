import { describe, it, expect } from "vitest";
import { workArea, openRect, clampDrag, clampResize, maximizeRect, reclampOnTheme, tile } from "./geometry";

describe("workArea", () => {
  it("aqua: {x:8, y:barH+6, w:vw-16, h:vh-barH-92} → barH=30 ⇒ {8,36,vw-16,vh-122}", () => {
    expect(workArea("aqua", 1440, 900)).toEqual({ x: 8, y: 36, w: 1424, h: 778 });
  });
  it("console: {x:8, y:8, w:vw-16, h:vh-66}", () => {
    expect(workArea("console", 1440, 900)).toEqual({ x: 8, y: 8, w: 1424, h: 834 });
  });
  it("samagra: rail=66,barH=32 ⇒ {74,38,vw-82,vh-44}", () => {
    expect(workArea("samagra", 1440, 900)).toEqual({ x: 74, y: 38, w: 1358, h: 856 });
  });
  it("defaults vw||1440, vh||900 when zero", () => {
    expect(workArea("aqua", 0, 0)).toEqual({ x: 8, y: 36, w: 1424, h: 778 });
  });
});

describe("openRect — sizing + cascade + clamp", () => {
  const wa = workArea("aqua", 1440, 900); // {8,36,1424,778}
  it("first window (n=0): size=min(app, wa-24/-20), inset 24x/12y", () => {
    const r = openRect({ w: 940, h: 610 }, wa, 0);
    expect(r.w).toBe(940);            // min(940, 1424-24)
    expect(r.h).toBe(610);            // min(610, 778-20)
    expect(r.x).toBe(8 + 24);         // wa.x + 24 + 0
    expect(r.y).toBe(36 + 12);        // wa.y + 12 + 0
  });
  it("cascade steps +34x/+30y, wraps every 6", () => {
    const r2 = openRect({ w: 940, h: 610 }, wa, 2);
    expect(r2.x).toBe(8 + 24 + 2 * 34);
    expect(r2.y).toBe(36 + 12 + 2 * 30);
  });
  it("clamps to keep window inside work area (12px right/bottom margin)", () => {
    const r = openRect({ w: 1400, h: 760 }, wa, 5);
    expect(r.x).toBeLessThanOrEqual(wa.x + wa.w - r.w - 12);
    expect(r.x).toBeGreaterThanOrEqual(wa.x);
    expect(r.y).toBeGreaterThanOrEqual(wa.y);
  });
});

describe("clampDrag", () => {
  it("x floored at 0, y floored at barH", () => {
    expect(clampDrag(-50, -50, 30)).toEqual({ x: 0, y: 30 });
    expect(clampDrag(100, 200, 30)).toEqual({ x: 100, y: 200 });
  });
  it("NO right/bottom clamp during drag (proto §1.6 — unlike openRect/reclamp)", () => {
    expect(clampDrag(99999, 99999, 30)).toEqual({ x: 99999, y: 99999 });
  });
});

describe("clampResize", () => {
  it("min 360 x 280", () => {
    expect(clampResize(100, 100)).toEqual({ w: 360, h: 280 });
    expect(clampResize(900, 600)).toEqual({ w: 900, h: 600 });
  });
});

describe("maximizeRect", () => {
  it("returns the full work area", () => {
    const wa = workArea("aqua", 1440, 900);
    expect(maximizeRect(wa)).toEqual({ x: 8, y: 36, w: 1424, h: 778 });
  });
});

describe("reclampOnTheme", () => {
  it("normal window clamped with 8px inset, not resized", () => {
    const wa = workArea("aqua", 1440, 900);
    const out = reclampOnTheme({ x: 5000, y: 5000, w: 400, h: 300 }, wa);
    expect(out.w).toBe(400);
    expect(out.h).toBe(300);
    expect(out.x).toBe(wa.x + wa.w - 400 - 8);
    expect(out.y).toBe(wa.y + wa.h - 300 - 8);
  });
});

describe("tile", () => {
  it("cols=⌈√n⌉, gap 12, rounded rects; n=4 ⇒ 2x2", () => {
    const wa = workArea("aqua", 1440, 900);
    const rects = tile(4, wa);
    expect(rects).toHaveLength(4);
    const cw = Math.round((wa.w - 12) / 2);
    expect(rects[0]).toEqual({ x: wa.x, y: wa.y, w: cw, h: Math.round((wa.h - 12) / 2) });
  });
  it("n=0 ⇒ []", () => {
    expect(tile(0, workArea("aqua", 1440, 900))).toEqual([]);
  });
});
