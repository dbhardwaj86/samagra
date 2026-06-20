// src/shell/WindowFrame.tsx — SAMAGRA OS window frame (CH1 fidelity).
// Verbatim port of the prototype's renderWindow + winControls (.dc.html L921-969):
// an absolutely-positioned glass window whose radius/surface/blur/shadow come from
// the ACTIVE theme tokens (FD1) — aqua radius 13 glass, samagra radius 15 opaque
// cream. The 38px title bar carries the aqua macOS traffic-lights on the LEFT
// (close #ff5f57 / min #febc2e / zoom #28c840, 12×12 round), a centered title, and a
// bottom-right resize grip rendered as an inline <svg> (18×18). When the window is
// inactive the traffic-light dots desaturate to #cdcdd4 and the active shadow drops
// to INACTIVE_SHADOW. Double-click the bar maximizes; right-click opens the context
// menu. ALL geometry + z-order math lives in lib/wm/* (via the WM store); this
// component only positions the frame and dispatches intents up. Pixel parity is a
// separate human QA pass.
import type { ReactNode } from "react";
import type { WindowState, Theme } from "../types/contracts";
import { THEMES, INACTIVE_SHADOW } from "../themes";

// Inner top-edge highlight appended to every aqua/samagra window shadow
// (renderWindow L957 `inHi` for the non-console branch): a 1px white inset that
// gives the glass surface its lit top edge. Verbatim from the prototype.
const INSET_HIGHLIGHT = "inset 0 1px 0 rgba(255,255,255,.5)";

export interface WindowFrameProps {
  win: WindowState;
  title: string;
  children: ReactNode;
  /** Active theme — drives radius / surface / shadow tokens (defaults aqua). */
  theme?: Theme;
  /** Whether this window is the topmost (active) one — drives the live/idle chrome. */
  active?: boolean;
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

/** A single Aqua traffic-light dot (winControls L924-925): 12×12 round; the live
 *  colour shows when active, desaturating to #cdcdd4 when the window is inactive. */
function Light({
  color,
  active,
  label,
  onClick,
}: {
  color: string;
  active: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{
        width: 12,
        height: 12,
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        padding: 0,
        background: active ? color : "#cdcdd4",
      }}
    />
  );
}

export default function WindowFrame({
  win,
  title,
  children,
  theme = "aqua",
  active = true,
  onFocus,
  onClose,
  onMinimize,
  onToggleMax,
  onContextMenu,
}: WindowFrameProps) {
  const t = THEMES[theme];

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
        borderRadius: `${t.winRadius}px`,
        overflow: "hidden",
        background: t.winBg,
        backdropFilter: t.winBlur,
        WebkitBackdropFilter: t.winBlur,
        // renderWindow L958: `(active?shadow:inactive) + ring + ', ' + inHi`.
        // ring is empty for aqua/samagra; the inset highlight is always appended.
        boxShadow: `${active ? t.shadow : INACTIVE_SHADOW}, ${INSET_HIGHLIGHT}`,
        border: `1px solid ${t.line}`,
        font: `13px ${t.font}`,
        color: t.text,
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
          gap: 10,
          padding: "0 12px",
          borderBottom: `1px solid ${t.line}`,
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Light color="#ff5f57" active={active} label="Close" onClick={() => onClose?.(win.id)} />
          <Light
            color="#febc2e"
            active={active}
            label="Minimize"
            onClick={() => onMinimize?.(win.id)}
          />
          <Light
            color="#28c840"
            active={active}
            label="Maximize"
            onClick={() => onToggleMax?.(win.id)}
          />
        </div>
        {/* Centered title (renderWindow L951): a flex-1 row that centers the title
            span within the space left of the traffic lights. pointerEvents:none so
            the bar's drag/double-click/right-click reach the bar itself. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: 1,
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{title}</span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</div>

      {/* bottom-right resize grip — inline <svg> (renderWindow L966-968) */}
      <div
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: 18,
          height: 18,
          cursor: "nwse-resize",
          color: t.muted,
          zIndex: 3,
        }}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 18 18"
          style={{ position: "absolute", right: 2, bottom: 2, opacity: 0.5 }}
          aria-hidden="true"
        >
          <path
            d="M16 6 6 16M16 11l-5 5"
            stroke="currentColor"
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
