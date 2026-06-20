// src/shell/WindowFrame.tsx — Aqua window frame (E1.18, VISUAL).
// Thin presentational wrapper around an open window: radius 13 (proto.md §1.1
// aqua winRadius), left traffic-lights, a 38px title bar whose double-click
// toggles maximize, and a right-click that opens the ContextMenu. ALL geometry +
// z-order math lives in lib/wm/* (consumed via the WM store); this component only
// positions the frame from `win` and dispatches intents up. Pixel parity is a
// separate human QA pass.
import type { ReactNode } from "react";
import type { WindowState } from "../types/contracts";
import { THEMES } from "../themes";

const aqua = THEMES.aqua;

export interface WindowFrameProps {
  win: WindowState;
  title: string;
  children: ReactNode;
  /** Focus (z-bump) — wired to the WM store's `focus`. */
  onFocus?: (id: string) => void;
  /** Close — wired to the WM store's `closeApp`. */
  onClose?: (id: string) => void;
  /** Minimize — wired to the WM store's `minimize`. */
  onMinimize?: (id: string) => void;
  /** Maximize ↔ restore — wired to the WM store's `toggleMax`. */
  onToggleMax?: (id: string) => void;
  /** Right-click → open the context menu at the pointer (shell-owned state). */
  onContextMenu?: (id: string, x: number, y: number) => void;
}

/** A single Aqua traffic-light button (close / minimize / maximize). */
function Light({ color, label, onClick }: { color: string; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        padding: 0,
        background: color,
      }}
    />
  );
}

export default function WindowFrame({
  win,
  title,
  children,
  onFocus,
  onClose,
  onMinimize,
  onToggleMax,
  onContextMenu,
}: WindowFrameProps) {
  return (
    <div
      role="dialog"
      aria-label={title}
      onMouseDown={() => onFocus?.(win.id)}
      style={{
        position: "absolute",
        left: win.x,
        top: win.y,
        width: win.w,
        height: win.h,
        zIndex: win.z,
        display: win.min ? "none" : "flex",
        flexDirection: "column",
        borderRadius: "13px",
        overflow: "hidden",
        background: aqua.winBg,
        backdropFilter: aqua.winBlur,
        boxShadow: aqua.shadow,
        border: `1px solid ${aqua.line}`,
        font: `13px ${aqua.font}`,
        color: aqua.text,
      }}
    >
      <div
        data-testid="titlebar"
        onDoubleClick={() => onToggleMax?.(win.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(win.id, e.clientX, e.clientY);
        }}
        style={{
          height: 38,
          flex: "0 0 38px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
          borderBottom: `1px solid ${aqua.line}`,
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <Light color="#ff5f57" label="Close" onClick={() => onClose?.(win.id)} />
          <Light color="#febc2e" label="Minimize" onClick={() => onMinimize?.(win.id)} />
          <Light color="#28c840" label="Maximize" onClick={() => onToggleMax?.(win.id)} />
        </div>
        <span style={{ flex: 1, textAlign: "center", fontWeight: 600 }}>{title}</span>
        <span style={{ width: 44 }} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</div>
    </div>
  );
}
