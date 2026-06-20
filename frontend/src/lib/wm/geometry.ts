// Pure window-geometry math for the SAMAGRA OS window manager — ZERO DOM.
// Every constant is verbatim from proto.md §1.2–§1.10. Chrome constants
// (barH / rail) are consumed from themes/index so chrome + math share one source.
import type { Rect, Theme } from "../../types/contracts";
import { THEMES } from "../../themes";

/** App default size used by openRect (proto.md §1.4). */
export interface Size {
  w: number;
  h: number;
}

/**
 * §1.2 Work area — `{x,y,w,h}` available for windows under the given theme.
 * `vw`/`vh` default to 1440/900 when falsy (proto: `window.innerWidth||1440`).
 */
export function workArea(theme: Theme, vw: number, vh: number): Rect {
  const t = THEMES[theme];
  const W = vw || 1440;
  const H = vh || 900;
  const barH = t.barH;
  const rail = t.rail ?? 0;

  switch (t.kind) {
    case "console":
      // { x:8, y:8, w: vw-16, h: vh-66 }
      return { x: 8, y: 8, w: W - 16, h: H - 66 };
    case "samagra":
      // { x: rail+8, y: barH+6, w: vw-rail-16, h: vh-barH-12 }
      return { x: rail + 8, y: barH + 6, w: W - rail - 16, h: H - barH - 12 };
    case "mac":
    default:
      // aqua: { x:8, y: barH+6, w: vw-16, h: vh-barH-92 }
      return { x: 8, y: barH + 6, w: W - 16, h: H - barH - 92 };
  }
}

/**
 * §1.4 Open rect — size (clamped to work area), cascade offset, and edge clamp.
 * `n` is the window count BEFORE insert; cascade steps +34x/+30y, wrapping every 6.
 */
export function openRect(app: Size, wa: Rect, n: number): Rect {
  const w = Math.min(app.w, wa.w - 24);
  const h = Math.min(app.h, wa.h - 20);
  const step = n % 6;
  const x = Math.max(wa.x, Math.min(wa.x + 24 + step * 34, wa.x + wa.w - w - 12));
  const y = Math.max(wa.y, Math.min(wa.y + 12 + step * 30, wa.y + wa.h - h - 12));
  return { x, y, w, h };
}

/**
 * §1.6 Drag clamp — x floored at 0, y floored at the theme `barH`.
 * NO right/bottom clamp during drag (unlike openRect / reclampOnTheme).
 */
export function clampDrag(x: number, y: number, barH: number): { x: number; y: number } {
  return { x: Math.max(0, x), y: Math.max(barH, y) };
}

/** §1.7 Resize clamp — minimum window size 360 × 280. */
export function clampResize(w: number, h: number): Size {
  return { w: Math.max(360, w), h: Math.max(280, h) };
}

/** §1.8 Maximize — the rect becomes the full work area. */
export function maximizeRect(wa: Rect): Rect {
  return { x: wa.x, y: wa.y, w: wa.w, h: wa.h };
}

/**
 * §1.9 Theme-switch re-clamp for a NORMAL window: keep it on-screen with an
 * 8px right/bottom inset; the window is not resized.
 */
export function reclampOnTheme(win: Rect, wa: Rect): Rect {
  const x = Math.max(wa.x, Math.min(win.x, wa.x + wa.w - Math.min(win.w, wa.w) - 8));
  const y = Math.max(wa.y, Math.min(win.y, wa.y + wa.h - Math.min(win.h, wa.h) - 8));
  return { x, y, w: win.w, h: win.h };
}

/**
 * §1.10 Tile `n` windows in a grid: cols = ⌈√n⌉, rows = ⌈n/cols⌉, gap 12.
 * All rect fields are rounded. `n === 0` → `[]`.
 */
export function tile(n: number, wa: Rect): Rect[] {
  if (n <= 0) return [];
  const gap = 12;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cw = (wa.w - gap * (cols - 1)) / cols;
  const ch = (wa.h - gap * (rows - 1)) / rows;
  const rects: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    rects.push({
      x: Math.round(wa.x + c * (cw + gap)),
      y: Math.round(wa.y + r * (ch + gap)),
      w: Math.round(cw),
      h: Math.round(ch),
    });
  }
  return rects;
}
