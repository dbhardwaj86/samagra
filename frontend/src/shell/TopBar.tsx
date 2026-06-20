// src/shell/TopBar.tsx — SAMAGRA OS top bar (CH1 fidelity).
// Verbatim port of the prototype's renderTopBar (.dc.html L973-994): a glass chrome
// strip that is shown for the `mac` (aqua) and `samagra` theme kinds and rendered as
// NOTHING for `console` (which has no top bar). Layout/colours/sizes are driven by
// the ACTIVE theme tokens (FD1) so the bar renders faithfully under aqua / samagra:
//   - aqua: barH 30, gap 18, padding 0 14px — leading ◈ diamond + SAMAGRA wordmark +
//     active window title, then a right cluster of the activity <Icon> (FD2 — inline
//     <svg>, never a letter glyph) + the समग्र Devanagari wordmark + a clickable live
//     clock (→ opens the Clock app).
//   - samagra: barH 32, the समग्र wordmark in the theme accent + a SAMAGRA · content
//     OS sub-label, then a Phase pill + clickable clock.
// This component holds NO logic — geometry/state come from props; pixel parity is a
// separate human QA pass.
import { THEMES } from "../themes";
import type { Theme } from "../types/contracts";
import Icon from "../components/Icon";
import { hexA } from "../components/icons-data";

// Small rounded status pill (proto `pill(txt,fg,bg)` helper L249): inline-flex,
// gap 5, 11px/600, padding 3px 9px, radius 999, no wrap. fg/bg are passed in.
function Pill({ text, fg, bg }: { text: string; fg: string; bg: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 999,
        color: fg,
        background: bg,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export interface TopBarProps {
  /** Title of the currently-focused window (empty string when none). */
  activeTitle: string;
  /** Pre-formatted live clock string (e.g. "9:41 AM"). */
  clock: string;
  /** Active theme — drives every colour/size token (defaults to aqua). */
  theme?: Theme;
  /** Click handler for the live clock (the prototype opens the Clock app). */
  onOpenClock?: () => void;
}

export default function TopBar({ activeTitle, clock, theme = "aqua", onOpenClock }: TopBarProps) {
  const t = THEMES[theme];

  // console has no top bar (renderTopBar returns null for kind==='console').
  if (t.kind === "console") return null;

  // समग्र — Devanagari wordmark glyph.
  const samagra = "समग्र";

  // --- samagra native top strip (renderTopBar L988-994) ---
  if (t.kind === "samagra") {
    return (
      <div
        role="banner"
        style={{
          position: "absolute",
          top: 0,
          left: t.rail ?? 0,
          right: 0,
          height: `${t.barH}px`,
          zIndex: 9000,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 16px",
          boxSizing: "border-box",
          background: t.bar,
          backdropFilter: t.barBlur,
          WebkitBackdropFilter: t.barBlur,
          borderBottom: `1px solid ${t.line}`,
          color: t.barText,
        }}
      >
        <span style={{ fontFamily: t.wordmark, fontSize: 18, fontWeight: 400, color: t.accent }}>
          {samagra}
        </span>
        <span style={{ fontSize: 12, color: t.muted, letterSpacing: "0.04em" }}>
          SAMAGRA · content OS
        </span>
        {/* right cluster (renderTopBar L992-993): Phase pill + clickable clock */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 12.5,
            color: t.muted,
          }}
        >
          <Pill text="Phase 1" fg="#d97706" bg={hexA("#d97706", 0.13)} />
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
      </div>
    );
  }

  // --- aqua / mac top bar (renderTopBar L977-985) ---
  return (
    <div
      role="banner"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: `${t.barH}px`,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "0 14px",
        boxSizing: "border-box",
        background: t.bar,
        backdropFilter: t.barBlur,
        WebkitBackdropFilter: t.barBlur,
        borderBottom: `1px solid ${t.line}`,
        color: t.barText,
        fontSize: 13,
        fontFamily: t.font,
      }}
    >
      {/* leading ◈ diamond mark */}
      <span style={{ fontWeight: 800, fontSize: 14 }}>{"◈"}</span>
      <span style={{ fontWeight: 700, fontFamily: t.wordmark }}>SAMAGRA</span>
      {activeTitle ? <span style={{ fontWeight: 500, opacity: 0.7 }}>{activeTitle}</span> : null}
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 16,
          opacity: 0.85,
        }}
      >
        {/* FD2 — activity status mark is an inline <svg>, never a letter glyph */}
        <span style={{ display: "flex" }}>
          <Icon name="activity" size={15} />
        </span>
        <span style={{ fontWeight: 600, fontFamily: t.wordmark }}>{samagra}</span>
        <span
          onClick={onOpenClock}
          title="Open Clock"
          style={{
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            cursor: "pointer",
          }}
        >
          {clock}
        </span>
      </div>
    </div>
  );
}
