// src/shell/TopBar.tsx — Aqua top bar (E1.18, VISUAL).
// Thin presentational wrapper: 30px chrome bar (proto.md §1.1 aqua barH) with the
// SAMAGRA wordmark, the active window title, a status pill, and a live clock string.
// All values are passed in as props; this component holds NO logic. Pixel/Aqua
// parity vs the prototype is a separate human QA pass.
import { THEMES } from "../themes";

const aqua = THEMES.aqua;

export interface TopBarProps {
  /** Title of the currently-focused window (empty string when none). */
  activeTitle: string;
  /** Pre-formatted live clock string (e.g. "9:41 AM"). */
  clock: string;
  /** Status pill text (defaults to a ready marker). */
  status?: string;
}

export default function TopBar({ activeTitle, clock, status = "Ready" }: TopBarProps) {
  return (
    <div
      role="banner"
      style={{
        height: "30px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 12px",
        boxSizing: "border-box",
        background: aqua.bar,
        backdropFilter: aqua.barBlur,
        color: aqua.barText,
        font: `12px ${aqua.font}`,
        borderBottom: `1px solid ${aqua.line}`,
      }}
    >
      <span style={{ fontWeight: 700, letterSpacing: 0.4, fontFamily: aqua.wordmark }}>
        SAMAGRA
      </span>
      <span style={{ fontWeight: 600 }}>{activeTitle}</span>
      <span style={{ flex: 1 }} />
      <span
        style={{
          fontSize: 11,
          padding: "1px 8px",
          borderRadius: 999,
          background: aqua.subBg,
          color: aqua.muted,
        }}
      >
        {status}
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{clock}</span>
    </div>
  );
}
