// Snake responsive cell-size + board-px formula — pure TS, headless-testable.
// Spec: docs/superpowers/_research/samagra-os/proto.md §2.2 (app_snake, lines 637–639).

/** Grid dimensions (19 × 19). */
export const COLS = 19;
export const ROWS = 19;

/** Default cell size in px when no window rect is supplied. */
export const DEFAULT_CELL = 18;

/** Clamp bounds for the responsive cell size. */
export const MIN_CELL = 11;
export const MAX_CELL = 28;

/** Window rect (only width/height matter for the cell formula). */
export interface WinRect {
  w: number;
  h: number;
}

/**
 * Responsive cell size in px.
 * - No window rect → DEFAULT_CELL (18).
 * - With a rect: availW = w-40, availH = h-38-250 (= h-288);
 *   cell = clamp(MIN_CELL, MAX_CELL, floor(min(availW, availH) / COLS)).
 */
export function cellSize(win?: WinRect): number {
  if (!win) return DEFAULT_CELL;
  const availW = win.w - 40;
  const availH = win.h - 38 - 250;
  const raw = Math.floor(Math.min(availW, availH) / COLS);
  return Math.max(MIN_CELL, Math.min(MAX_CELL, raw));
}

/** Board pixel dimensions for a given cell size: COLS*cell × ROWS*cell. */
export function boardPx(cell: number): { w: number; h: number } {
  return { w: COLS * cell, h: ROWS * cell };
}
