// src/shell/Taskbar.tsx — SAMAGRA OS console taskbar (CH2 fidelity).
// Verbatim port of the prototype's renderTaskbar (.dc.html L1033-1049): the console
// theme has NO top bar — instead a 50px bottom-anchored full-width taskbar holds
//   1. a Start button — the dashboard glyph (FD2 inline <svg>) + the SAMAGRA wordmark
//      (padding 8px 13px, radius 9). Closed → a faint hexA('#ffffff',0.05) wash; open
//      → an accent wash hexA(accent,0.18).
//   2. a 1px × 24 divider in the theme line colour.
//   3. a running-window button strip (flex 1, overflow auto, gap 5): one button per
//      open window = the app glyph (FD2) + name. The ACTIVE window is tinted with the
//      app accent (hexA(accent,0.18)), white text, and a 2px accent bottom border;
//      inactive buttons get a faint hexA('#ffffff',0.04) wash + transparent border;
//      minimized buttons drop to 0.6 opacity.
//   4. a right cluster: the activity glyph (FD2) + a clickable tabular-nums clock
//      (→ opens the Clock app).
// Every colour/size is driven by the active theme tokens + per-app accents (FD1) so
// the bar stays theme-correct; children (the Start-menu popover) render inside the
// bar. Pixel parity is a separate human QA pass.
import type { ReactNode } from "react";
import type { AppId, Theme, WindowState } from "../types/contracts";
import { APPS } from "../registry";
import { THEMES } from "../themes";
import { hexA } from "../components/icons-data";
import Icon from "../components/Icon";

export interface TaskbarProps {
  /** Open windows, in z/open order — rendered as running-window buttons. */
  windows: WindowState[];
  /** Id of the topmost (active) non-minimized window, if any. */
  activeId?: string | null;
  /** Pre-formatted live clock string (e.g. "2:58 PM"). */
  clock: string;
  /** Whether the Start menu is currently open (drives the Start button tint). */
  startOpen?: boolean;
  /** Active theme — drives every colour/size token (defaults to console). */
  theme?: Theme;
  /** Toggle the Start menu (Start button click). */
  onToggleStart?: () => void;
  /** Focus or restore a running window (taskbar button click). */
  onSelectWindow?: (id: string) => void;
  /** Right-click a running window → context menu at the pointer. */
  onWindowContextMenu?: (id: string, x: number, y: number) => void;
  /** Click the clock → open the Clock app. */
  onOpenClock?: () => void;
  /** Children (e.g. the Start menu popover) rendered inside the taskbar. */
  children?: ReactNode;
}

export default function Taskbar({
  windows,
  activeId,
  clock,
  startOpen = false,
  theme = "console",
  onToggleStart,
  onSelectWindow,
  onWindowContextMenu,
  onOpenClock,
  children,
}: TaskbarProps) {
  const t = THEMES[theme];

  return (
    <div
      role="toolbar"
      aria-label="Taskbar"
      // The shell root dismisses the Start menu / context menu on any click; the
      // taskbar is chrome, so clicks inside it (Start button, running buttons, the
      // Start-menu popover child) must NOT bubble up and self-dismiss.
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "50px",
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "0px 12px",
        background: t.dockBg,
        backdropFilter: t.dockBlur,
        WebkitBackdropFilter: t.dockBlur,
        borderTop: `1px solid ${t.dockBorder}`,
        color: t.text,
      }}
    >
      {/* Start button (renderTaskbar L1038-1039) */}
      <button
        type="button"
        aria-label="Start"
        title="Start"
        onClick={onToggleStart}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 13px",
          borderRadius: 9,
          border: "none",
          cursor: "pointer",
          background: startOpen ? hexA(t.accent, 0.18) : hexA("#ffffff", 0.05),
          color: t.accent,
        }}
      >
        <Icon name="dashboard" size={17} />
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: t.wordmark, color: t.text }}>
          SAMAGRA
        </span>
      </button>

      {/* divider (renderTaskbar L1040) */}
      <div style={{ width: 1, height: 24, background: t.line }} />

      {/* running-window strip (renderTaskbar L1041-1045) */}
      <div style={{ display: "flex", gap: 5, flex: 1, overflow: "auto" }}>
        {windows.map((w) => {
          const app = APPS[w.app];
          const isActive = !w.min && activeId === w.id;
          return (
            <div
              key={w.id}
              data-testid="taskbar-window"
              role="button"
              tabIndex={0}
              onClick={() => onSelectWindow?.(w.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                onWindowContextMenu?.(w.id, e.clientX, e.clientY);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 12.5,
                fontWeight: 500,
                background: isActive ? hexA(app.accent, 0.18) : hexA("#ffffff", 0.04),
                color: isActive ? "#fff" : t.muted,
                borderBottom: `2px solid ${isActive ? app.accent : "transparent"}`,
                opacity: w.min ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ color: app.accent, display: "flex" }}>
                <Icon name={w.app} size={15} />
              </span>
              <span>{app.name}</span>
            </div>
          );
        })}
      </div>

      {/* right cluster (renderTaskbar L1046): activity glyph + clickable clock */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, color: t.muted, fontSize: 12.5 }}>
        <span style={{ display: "flex" }}>
          <Icon name="activity" size={15} />
        </span>
        <span
          onClick={onOpenClock}
          title="Open Clock"
          style={{
            fontWeight: 600,
            color: t.text,
            fontVariantNumeric: "tabular-nums",
            cursor: "pointer",
          }}
        >
          {clock}
        </span>
      </div>

      {/* Start-menu popover slot (renderTaskbar L1047) */}
      {children}
    </div>
  );
}

export type { AppId };
