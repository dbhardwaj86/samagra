// Theme Zustand store (E1.7) — a THIN vanilla store holding `{ theme, device }`.
// `setTheme` switches the theme and asks the wired windowManager store to
// re-clamp every window into the new theme's work area (proto.md §1.9). All
// geometry math lives in lib/wm/geometry (delegated via wm.reclampForTheme).
import { createStore, type StoreApi } from "zustand/vanilla";
import type { AppId, Device, Theme } from "../types/contracts";
import { DEFAULT_THEME, isTheme } from "../themes";
import type { WindowManagerStore } from "./windowManager";

export interface ThemeStoreOptions {
  /** The windowManager store whose windows re-clamp on theme change. */
  wm: WindowManagerStore;
}

export interface ThemeState {
  theme: Theme;
  device: Device;
  /** The app shown full-screen in mobile (proto.md §1.4 step 1); null = home grid. */
  mobileApp: AppId | null;
  /** Switch theme, then re-clamp every window into the new work area (§1.9). */
  setTheme: (theme: Theme) => void;
  /** Toggle the device (proto.md §1.11) — also resets `mobileApp` to the home grid. */
  setDevice: (device: Device) => void;
  /** Open an app in mobile — shows it full-screen (proto.md §1.4 step 1). */
  openMobileApp: (id: AppId) => void;
  /** Return to the mobile home grid (`mobileApp = null`). */
  goHome: () => void;
}

export type ThemeStore = StoreApi<ThemeState>;

export function createThemeStore(opts: ThemeStoreOptions): ThemeStore {
  const { wm } = opts;
  return createStore<ThemeState>((set) => ({
    theme: "aqua",
    device: "pc",
    mobileApp: null,

    setTheme: (theme) => {
      // Coerce an undefined/unknown value to the default so no consumer ever
      // indexes THEMES with a bad key (advisory HIGH #4 — root-cause guard).
      const t = isTheme(theme) ? theme : DEFAULT_THEME;
      set({ theme: t });
      wm.getState().reclampForTheme(t);
    },

    // proto.md §1.11 — switching device clears any open mobile app so a stale app
    // never lingers across a device change (it would otherwise re-show on return).
    setDevice: (device) => set({ device, mobileApp: null }),

    openMobileApp: (id) => set({ mobileApp: id }),
    goHome: () => set({ mobileApp: null }),
  }));
}
