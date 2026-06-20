// src/shell/WindowFrame.tsx — SAMAGRA OS window frame (CH1 aqua + CH2 console).
// Verbatim port of the prototype's renderWindow + winControls (.dc.html L921-969):
// an absolutely-positioned glass window whose radius/surface/blur/shadow come from
// the ACTIVE theme tokens (FD1). The 38px title bar adapts to the theme's control
// side:
//   - aqua/samagra (`controlSide:'left'` — mac branch): macOS traffic-lights on the
//     LEFT (close #ff5f57 / min #febc2e / zoom #28c840, 12×12 round), centered title.
//     Inactive → dots desaturate to #cdcdd4.
//   - console (`controlSide:'right'`): the app glyph + LEFT-aligned title, then the
//     three controls on the RIGHT as 28×23 icon buttons (minimize/maximize/close)
//     drawn as inline <svg>s (FD2 — never traffic-light dots). The bar gets a 2px TOP
//     accent border (full app accent when active, hexA(accent,0.35) when inactive) +
//     a 90deg accent→transparent wash; the active frame gains a neon glow ring
//     (0 0 0 1px hexA(accent,0.5), 0 0 34px hexA(accent,0.13)). Close-button hover
//     fills #ef4444; the other controls fill hexA(text,0.12).
// ALL geometry + z-order math lives in lib/wm/* (via the WM store); this component
// only positions the frame and dispatches intents up. Pixel parity is a separate
// human QA pass.
import type { ReactNode } from "react";
import type { WindowState, Theme } from "../types/contracts";
import { THEMES, INACTIVE_SHADOW } from "../themes";
import { APPS } from "../registry";
import { hexA } from "../components/icons-data";
import Icon from "../components/Icon";

// Inner top-edge highlight appended to every window shadow (renderWindow L957
// `inHi`): a 1px inset white that lights the surface's top edge. The console branch
// uses a fainter 0.06-alpha variant; aqua/samagra use 0.5. Verbatim from the proto.
const INSET_HIGHLIGHT_GLASS = "inset 0 1px 0 rgba(255,255,255,.5)";
const INSET_HIGHLIGHT_CONSOLE = "inset 0 1px 0 rgba(255,255,255,.06)";

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

/** A single console window control (winControls console branch L929-937): a 28×23
 *  radius-6 icon button holding a 12×12 inline <svg> glyph. Hover fills #ef4444 for
 *  the danger (close) control, else hexA(text,0.12); leave reverts to transparent. */
function ConsoleControl({
  d,
  label,
  muted,
  text,
  danger = false,
  onClick,
}: {
  d: string;
  label: string;
  muted: string;
  text: string;
  danger?: boolean;
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
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? "#ef4444" : hexA(text, 0.12);
        e.currentTarget.style.color = danger ? "#fff" : text;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = muted;
      }}
      style={{
        width: 28,
        height: 23,
        borderRadius: 6,
        border: "none",
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        background: "transparent",
        color: muted,
        transition: "background .12s",
      }}
    >
      <svg
        width={12}
        height={12}
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={d} />
      </svg>
    </button>
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
  const isConsole = t.kind === "console";
  const acc = APPS[win.app].accent;

  // renderWindow L956-958: console active windows gain a neon glow ring; the inset
  // top-edge highlight (fainter on console) is always the final shadow layer.
  const ring =
    isConsole && active
      ? `, 0 0 0 1px ${hexA(acc, 0.5)}, 0 0 34px ${hexA(acc, 0.13)}`
      : "";
  const inHi = isConsole ? INSET_HIGHLIGHT_CONSOLE : INSET_HIGHLIGHT_GLASS;
  const boxShadow = `${active ? t.shadow : INACTIVE_SHADOW}${ring}, ${inHi}`;

  // Console title-bar chrome (renderWindow L948-949): a 90deg accent→transparent
  // wash + a 2px top accent border (full accent active, hexA(accent,0.35) idle).
  const consoleBarBg = `linear-gradient(90deg,${hexA(acc, active ? 0.2 : 0.07)}, transparent 65%)`;
  const consoleTopBorder = `2px solid ${active ? acc : hexA(acc, 0.35)}`;

  // Console window controls = three 28×23 icon buttons in min/max/close order
  // (winControls console branch L935-937). Aqua/samagra = three traffic lights.
  const controls = isConsole ? (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      <ConsoleControl
        d="M2.5 6h7"
        label="Minimize"
        muted={t.muted}
        text={t.text}
        onClick={() => onMinimize?.(win.id)}
      />
      <ConsoleControl
        d="M3 3h6v6H3z"
        label="Maximize"
        muted={t.muted}
        text={t.text}
        onClick={() => onToggleMax?.(win.id)}
      />
      <ConsoleControl
        d="M3 3l6 6M9 3l-6 6"
        label="Close"
        muted={t.muted}
        text={t.text}
        danger
        onClick={() => onClose?.(win.id)}
      />
    </div>
  ) : (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <Light color="#ff5f57" active={active} label="Close" onClick={() => onClose?.(win.id)} />
      <Light color="#febc2e" active={active} label="Minimize" onClick={() => onMinimize?.(win.id)} />
      <Light color="#28c840" active={active} label="Maximize" onClick={() => onToggleMax?.(win.id)} />
    </div>
  );

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
        boxShadow,
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
          background: isConsole ? consoleBarBg : "transparent",
          borderTop: isConsole ? consoleTopBorder : undefined,
          borderBottom: `1px solid ${t.line}`,
          opacity: isConsole ? (active ? 1 : 0.82) : undefined,
          userSelect: "none",
        }}
      >
        {/* Left-side controls (aqua/samagra traffic lights). */}
        {!isConsole && controls}

        {/* Title row (renderWindow L951): mac centers it, console left-aligns it.
            pointerEvents:none so the bar's drag/double-click/right-click reach the
            bar itself. The console branch prefixes the app's accent-coloured glyph. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: 1,
            justifyContent: isConsole ? "flex-start" : "center",
            pointerEvents: "none",
          }}
        >
          {isConsole ? (
            <span style={{ color: acc, display: "flex" }}>
              <Icon name={win.app} size={16} />
            </span>
          ) : null}
          <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{title}</span>
        </div>

        {/* Right-side controls (console icon buttons). */}
        {isConsole && controls}
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
