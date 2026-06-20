// src/App.tsx — SAMAGRA OS shell assembly (E1.18 + CH2 console chrome).
// Assembles the per-theme chrome over the WM + theme stores. The chrome that wraps
// the windows is theme-driven (FD1):
//   - aqua / samagra (`kind!=='console'`): a top bar (TopBar) + a bottom-center /
//     left-rail Dock.
//   - console (`kind==='console'`): NO top bar — a bottom Taskbar (Start button +
//     running-window strip + clock) with the Start-menu popover as its child.
// Every open window renders through one WindowFrame, themed to the active theme so
// its chrome (traffic-lights vs right-side icon controls, radius, glow ring) matches.
// This is a THIN shell — all window math lives in lib/wm/* (via the WM store) and all
// theme tokens in themes/.
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
import Taskbar from "./shell/Taskbar";
import StartMenu from "./shell/StartMenu";
import WindowFrame from "./shell/WindowFrame";
import ContextMenu, { type ContextMenuItem } from "./shell/ContextMenu";

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

  const theme = useStore(themeStore, (s) => s.theme);
  const t = THEMES[theme];
  const isConsole = t.kind === "console";

  const [menu, setMenu] = useState<MenuState | null>(null);
  const [startOpen, setStartOpen] = useState(false);
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

  // Taskbar click on a running window (renderTaskbar L1042): restore it if minimized
  // (openApp un-minimizes + bumps z for an already-open app — store §1.4 step 2),
  // else just focus it.
  const selectWindow = useCallback(
    (id: string) => {
      const w = wmStore.getState().windows.find((x) => x.id === id);
      if (!w) return;
      if (w.min) openApp(w.app);
      else focus(id);
    },
    [focus, openApp],
  );

  const handleOpen = useCallback(
    (id: AppId) => {
      openApp(id);
      setStartOpen(false);
    },
    [openApp],
  );

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
      onClick={() => {
        setMenu(null);
        setStartOpen(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: t.bg,
        font: `13px ${t.font}`,
        color: t.text,
      }}
    >
      {/* Top bar — aqua/samagra only (TopBar renders null for console). */}
      <TopBar
        theme={theme}
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
            theme={theme}
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

      {/* Bottom chrome — console gets the Taskbar + Start menu; the others a Dock. */}
      {isConsole ? (
        <Taskbar
          theme={theme}
          windows={windows}
          activeId={active?.id ?? null}
          clock={fmtClock(now)}
          startOpen={startOpen}
          onToggleStart={() => setStartOpen((v) => !v)}
          onSelectWindow={selectWindow}
          onWindowContextMenu={openContextMenu}
          onOpenClock={() => openApp("clock")}
        >
          {startOpen && <StartMenu theme={theme} onOpen={handleOpen} />}
        </Taskbar>
      ) : (
        <Dock theme={theme} onOpen={openApp} />
      )}

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} />}
    </div>
  );
}

export { wmStore, themeStore };
