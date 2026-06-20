// Pure z-order math for the SAMAGRA OS window manager.
// See proto.md §1.5 — monotonic z counter, focus bump, active/top rule.

/** Initial z-order counter (proto.md §1.5, line 38). */
export const INITIAL_Z = 20;

/** Focus bump: the next z value is one greater than the current top. */
export function bump(z: number): number {
  return z + 1;
}

/** Minimal shape needed to compute the active/top window. */
export interface ZWindow {
  id: string;
  z: number;
  min: boolean;
}

/**
 * Active (top) window = highest `z` among non-minimized windows.
 * Returns the window id, or null when there are no non-minimized windows.
 */
export function topWindow<T extends ZWindow>(windows: readonly T[]): string | null {
  let top: T | null = null;
  for (const win of windows) {
    if (win.min) continue;
    if (top === null || win.z > top.z) top = win;
  }
  return top === null ? null : top.id;
}
