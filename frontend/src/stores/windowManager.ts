// Window-manager Zustand store (E1.7) — a THIN vanilla store over lib/wm/*.
// All geometry math lives in lib/wm/geometry; all z-order math in lib/wm/zorder.
// The store only holds `{ windows[], z }` and wires those pure functions to
// window actions (proto.md §1.4–§1.11). ZERO duplicated math here.
import { createStore, type StoreApi } from "zustand/vanilla";
import type { AppId, Rect, Theme, WindowState } from "../types/contracts";
import { APPS } from "../registry";
import { THEMES } from "../themes";
import {
  clampDrag,
  clampResize,
  maximizeRect,
  openRect,
  reclampOnTheme,
  tile as tileRects,
  workArea,
} from "../lib/wm/geometry";
import { INITIAL_Z, bump } from "../lib/wm/zorder";

/**
 * Injectable engine hooks (proto.md §1.11). The snake engine is NOT imported
 * here — `closeApp`/`minimize` fire these so the store stays engine-free.
 */
export interface WindowManagerOptions {
  onClose?: (win: WindowState) => void;
  onMinimize?: (win: WindowState) => void;
}

export interface WindowManagerState {
  windows: WindowState[];
  z: number;
  /** The active theme (E3) — drives the work area + barH for every window op.
   * Kept in sync by `reclampForTheme`, which the theme store calls on setTheme. */
  theme: Theme;
  /** Open-or-focus an app (proto.md §1.4): never spawns a duplicate. */
  openApp: (id: AppId) => void;
  /** Drag move to an absolute target; clamps x≥0, y≥barH (proto.md §1.6). */
  move: (id: string, x: number, y: number) => void;
  /** Resize to an absolute size; clamps ≥360×280 (proto.md §1.7). */
  resize: (id: string, w: number, h: number) => void;
  /** Maximize ↔ restore, storing `prev` on the way up (proto.md §1.8). */
  toggleMax: (id: string) => void;
  /** Bump a window to the top of the z-stack (proto.md §1.5). */
  focus: (id: string) => void;
  /** Tile all non-minimized windows into a grid (proto.md §1.10). */
  tile: () => void;
  /** Close a window and fire the injected stop hook (proto.md §1.11). */
  closeApp: (id: string) => void;
  /** Minimize a window and fire the injected pause hook (proto.md §1.11). */
  minimize: (id: string) => void;
  /** Re-clamp every window into a (possibly new) theme's work area (§1.9). */
  reclampForTheme: (theme: Theme) => void;
}

export type WindowManagerStore = StoreApi<WindowManagerState>;

/** Live viewport (proto.md §1.2: `window.innerWidth||1440`, `||900`). */
function viewport(): { vw: number; vh: number } {
  return {
    vw: (typeof window !== "undefined" && window.innerWidth) || 1440,
    vh: (typeof window !== "undefined" && window.innerHeight) || 900,
  };
}

/** Work area for a theme at the current viewport. */
function wa(theme: Theme): Rect {
  const { vw, vh } = viewport();
  return workArea(theme, vw, vh);
}

// The default theme at boot (aqua). After the first theme switch the active theme
// is whatever `reclampForTheme` last applied, so non-aqua windows clamp correctly.
const WM_DEFAULT_THEME: Theme = "aqua";

export function createWindowManagerStore(
  opts: WindowManagerOptions = {},
): WindowManagerStore {
  return createStore<WindowManagerState>((set, get) => ({
    windows: [],
    z: INITIAL_Z,
    theme: WM_DEFAULT_THEME,

    openApp: (id) =>
      set((state) => {
        // §1.4 step 2 — already open: un-minimize + bump z (focus, no dup).
        const existing = state.windows.find((w) => w.app === id);
        if (existing) {
          const nz = bump(state.z);
          return {
            z: nz,
            windows: state.windows.map((w) =>
              w.id === existing.id ? { ...w, min: false, z: nz } : w,
            ),
          };
        }
        // §1.4 step 3 — new window: openRect cascade off the count-before-insert.
        const n = state.windows.length;
        const app = APPS[id];
        const rect = openRect({ w: app.w, h: app.h }, wa(state.theme), n);
        const nz = bump(state.z);
        const win: WindowState = {
          id: `w${Date.now()}${n}`,
          app: id,
          x: rect.x,
          y: rect.y,
          w: rect.w,
          h: rect.h,
          z: nz,
          min: false,
          max: false,
          prev: null,
        };
        return { z: nz, windows: [...state.windows, win] };
      }),

    move: (id, x, y) =>
      set((state) => {
        const barH = THEMES[state.theme].barH;
        const clamped = clampDrag(x, y, barH);
        return {
          windows: state.windows.map((w) =>
            w.id === id ? { ...w, x: clamped.x, y: clamped.y } : w,
          ),
        };
      }),

    resize: (id, w, h) =>
      set((state) => {
        const size = clampResize(w, h);
        return {
          windows: state.windows.map((win) =>
            win.id === id ? { ...win, w: size.w, h: size.h } : win,
          ),
        };
      }),

    toggleMax: (id) =>
      set((state) => {
        const nz = bump(state.z);
        return {
          z: nz,
          windows: state.windows.map((w) => {
            if (w.id !== id) return w;
            if (w.max && w.prev) {
              // restore
              return {
                ...w,
                x: w.prev.x,
                y: w.prev.y,
                w: w.prev.w,
                h: w.prev.h,
                max: false,
                prev: null,
                z: nz,
              };
            }
            // maximize — stash prev, fill the work area
            const rect = maximizeRect(wa(state.theme));
            return {
              ...w,
              prev: { x: w.x, y: w.y, w: w.w, h: w.h },
              x: rect.x,
              y: rect.y,
              w: rect.w,
              h: rect.h,
              max: true,
              z: nz,
            };
          }),
        };
      }),

    focus: (id) =>
      set((state) => {
        const nz = bump(state.z);
        return {
          z: nz,
          windows: state.windows.map((w) => (w.id === id ? { ...w, z: nz } : w)),
        };
      }),

    tile: () =>
      set((state) => {
        const live = state.windows.filter((w) => !w.min);
        if (live.length === 0) return {};
        const rects = tileRects(live.length, wa(state.theme));
        const byId = new Map<string, Rect>();
        live.forEach((w, i) => byId.set(w.id, rects[i]));
        return {
          windows: state.windows.map((w) => {
            const r = byId.get(w.id);
            if (!r) return w;
            return { ...w, x: r.x, y: r.y, w: r.w, h: r.h, max: false, min: false };
          }),
        };
      }),

    closeApp: (id) => {
      const win = get().windows.find((w) => w.id === id);
      set((state) => ({ windows: state.windows.filter((w) => w.id !== id) }));
      if (win) opts.onClose?.(win);
    },

    minimize: (id) => {
      const win = get().windows.find((w) => w.id === id);
      set((state) => ({
        windows: state.windows.map((w) => (w.id === id ? { ...w, min: true } : w)),
      }));
      if (win) opts.onMinimize?.(win);
    },

    reclampForTheme: (theme) =>
      set((state) => {
        const area = wa(theme);
        return {
          // Adopt the new theme as the active one so every subsequent window op
          // (open/move/maximize/tile) uses its work area + barH (E3 polish).
          theme,
          windows: state.windows.map((w) => {
            if (w.max) {
              const rect = maximizeRect(area);
              return { ...w, x: rect.x, y: rect.y, w: rect.w, h: rect.h };
            }
            const rect = reclampOnTheme({ x: w.x, y: w.y, w: w.w, h: w.h }, area);
            return { ...w, x: rect.x, y: rect.y };
          }),
        };
      }),
  }));
}
