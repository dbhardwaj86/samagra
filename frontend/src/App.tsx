// src/App.tsx — SAMAGRA OS shell assembly (E1.18, VISUAL).
// Assembles the Aqua chrome over the WM + theme stores: top bar, dock, one window
// frame per open window, and a right-click context menu. This is a THIN shell — all
// window math lives in lib/wm/* (via the WM store) and all theme tokens in themes/.
//
// Cross-branch build invariant (division §1 †): open windows render ONLY through a
// runtime-resolved lazy import of `apps/<App>/index.tsx`. There is NO static import
// of any app module (including khanak-owned Clock/Notes/Snake), so this file
// compiles on agent/deepak before the leaf app files exist; each lazy import
// resolves only when a window of that app is actually opened at integration.
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { useStore } from "zustand";
import type { AppId, WindowState } from "./types/contracts";
import { APPS } from "./registry";
import { THEMES } from "./themes";
import { createWindowManagerStore } from "./stores/windowManager";
import { createThemeStore } from "./stores/theme";
import TopBar from "./shell/TopBar";
import Dock from "./shell/Dock";
import WindowFrame from "./shell/WindowFrame";
import ContextMenu, { type ContextMenuItem } from "./shell/ContextMenu";

const aqua = THEMES.aqua;

// Wire the two stores once for the app lifetime (WM first, theme references it).
const wmStore = createWindowManagerStore();
const themeStore = createThemeStore({ wm: wmStore });

// Map an AppId to its `apps/<Dir>` folder. The dynamic import below is built from a
// VARIABLE specifier so the bundler does not statically resolve it at build time —
// this is what keeps App.tsx compilable before the leaf app files land.
const APP_DIR: Record<AppId, string> = {
  dashboard: "Dashboard",
  pipelines: "Pipelines",
  assignments: "Assignments",
  org: "Org",
  questions: "Questions",
  lectures: "Lectures",
  booklets: "Booklets",
  insp: "Insp",
  sims: "Sims",
  mycontentdev: "Mycontentdev",
  munshi: "Munshi",
  activity: "Activity",
  settings: "Settings",
  terminal: "Terminal",
  clock: "Clock",
  notes: "Notes",
  snake: "Snake",
};

const lazyCache = new Map<AppId, ComponentType>();

/** Lazy app component, resolved at render time (never at build time). */
function appComponent(id: AppId): ComponentType {
  const cached = lazyCache.get(id);
  if (cached) return cached;
  const dir = APP_DIR[id];
  const Comp = lazy(() =>
    import(/* @vite-ignore */ `./apps/${dir}/index.tsx`).catch(() => ({
      default: () => null,
    })),
  ) as ComponentType;
  lazyCache.set(id, Comp);
  return Comp;
}

/** Format the live clock as the proto's `9:41 AM` 12-hour string. */
function fmtClock(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

interface MenuState {
  winId: string;
  x: number;
  y: number;
}

export default function App() {
  const windows = useStore(wmStore, (s) => s.windows);
  const openApp = useStore(wmStore, (s) => s.openApp);
  const closeApp = useStore(wmStore, (s) => s.closeApp);
  const minimize = useStore(wmStore, (s) => s.minimize);
  const toggleMax = useStore(wmStore, (s) => s.toggleMax);
  const focus = useStore(wmStore, (s) => s.focus);

  const [menu, setMenu] = useState<MenuState | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Live clock — 1s tick, cleared on unmount.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const openContextMenu = useCallback((id: string, x: number, y: number) => {
    setMenu({ winId: id, x, y });
  }, []);

  // Active = the top-most (highest z) non-minimized window.
  const active = useMemo<WindowState | null>(() => {
    const live = windows.filter((w) => !w.min);
    if (live.length === 0) return null;
    return live.reduce((a, b) => (b.z > a.z ? b : a));
  }, [windows]);

  const menuItems = useMemo<ContextMenuItem[]>(() => {
    if (!menu) return [];
    const id = menu.winId;
    return [
      { label: "Minimize", onSelect: () => { minimize(id); setMenu(null); } },
      { label: "Maximize", onSelect: () => { toggleMax(id); setMenu(null); } },
      { label: "Close", danger: true, onSelect: () => { closeApp(id); setMenu(null); } },
    ];
  }, [menu, minimize, toggleMax, closeApp]);

  return (
    <div
      id="samagra-os-shell"
      onClick={() => setMenu(null)}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: aqua.bg,
        font: `13px ${aqua.font}`,
        color: aqua.text,
      }}
    >
      <TopBar
        activeTitle={active ? APPS[active.app].name : ""}
        clock={fmtClock(now)}
        onOpenClock={() => openApp("clock")}
      />

      {windows.map((win) => {
        const Body = appComponent(win.app);
        return (
          <WindowFrame
            key={win.id}
            win={win}
            title={APPS[win.app].name}
            active={active?.id === win.id}
            onFocus={focus}
            onClose={closeApp}
            onMinimize={minimize}
            onToggleMax={toggleMax}
            onContextMenu={openContextMenu}
          >
            <Suspense fallback={null}>
              <Body />
            </Suspense>
          </WindowFrame>
        );
      })}

      <Dock onOpen={openApp} />

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} />}
    </div>
  );
}

export { wmStore, themeStore };
