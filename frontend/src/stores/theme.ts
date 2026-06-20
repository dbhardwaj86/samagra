// Theme Zustand store (E1.7) — a THIN vanilla store holding `{ theme, device }`.
// `setTheme` switches the theme and asks the wired windowManager store to
// re-clamp every window into the new theme's work area (proto.md §1.9). All
// geometry math lives in lib/wm/geometry (delegated via wm.reclampForTheme).
import { createStore, type StoreApi } from "zustand/vanilla";
import type { Device, Theme } from "../types/contracts";
import type { WindowManagerStore } from "./windowManager";

export interface ThemeStoreOptions {
  /** The windowManager store whose windows re-clamp on theme change. */
  wm: WindowManagerStore;
}

export interface ThemeState {
  theme: Theme;
  device: Device;
  /** Switch theme, then re-clamp every window into the new work area (§1.9). */
  setTheme: (theme: Theme) => void;
  /** Toggle the device (proto.md §1.11). */
  setDevice: (device: Device) => void;
}

export type ThemeStore = StoreApi<ThemeState>;

export function createThemeStore(opts: ThemeStoreOptions): ThemeStore {
  const { wm } = opts;
  return createStore<ThemeState>((set) => ({
    theme: "aqua",
    device: "pc",

    setTheme: (theme) => {
      set({ theme });
      wm.getState().reclampForTheme(theme);
    },

    setDevice: (device) => set({ device }),
  }));
}
