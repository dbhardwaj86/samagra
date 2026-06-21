// src/shell/Mobile.tsx — E3 mobile device mode (proto.md §7 mobile frame + §1.4/§1.11).
//
// A PURE presentational phone shell. State (`device`, `mobileApp`) lives in the
// theme store; Mobile only renders props and dispatches intent (onOpen/onHome).
// Two screens:
//   • home (mobileApp === null): a 4-column app grid over EVERY app (ORDER) plus a
//     bottom favorites dock (MOBILE_FAVORITES) — proto §0/§7 (grid icons 58×58 r16,
//     dock icons 50×50).
//   • app (mobileApp set): the app full-screen in a scrollable screen, with the
//     iOS-style home-indicator rendered as a "Home" button that returns to the grid.
//
// Frame dimensions are verbatim from proto.md §7: 392×812 (max-height 94vh), bezel
// #05070b, screen radius 42, notch 120×26, status bar 44, home-indicator 130×5.
// All in-screen colour is theme-driven via the `--samagra-*` CSS vars (FD1) so the
// phone reskins with the active theme. Pixel/interaction parity is the separate
// human QA pass (RUBRIC §6).
import type { CSSProperties, ReactNode } from "react";
import type { AppId, Theme } from "../types/contracts";
import { APPS, ORDER, MOBILE_FAVORITES } from "../registry";
import { THEMES } from "../themes";
import AppIcon from "../components/AppIcon";

export interface MobileProps {
  /** Status-bar clock (12-hour AM/PM), supplied by the shell's live tick. */
  clock: string;
  /** The app shown full-screen; null → the home grid (proto §1.4 step 1). */
  mobileApp: AppId | null;
  /** Open an app full-screen (wired to the theme store's openMobileApp). */
  onOpen: (id: AppId) => void;
  /** Return to the home grid (wired to the theme store's goHome). */
  onHome: () => void;
  /** The resolved app body to render when `mobileApp` is set. */
  appBody?: ReactNode;
  /** Active theme — unifies launcher accents under samagra (default aqua). */
  theme?: Theme;
}

// Theme CSS vars (FD1) — the in-screen surface tracks the active theme.
const V = {
  bg: "var(--samagra-bg)",
  text: "var(--samagra-text)",
  muted: "var(--samagra-muted)",
  barText: "var(--samagra-bar-text)",
  font: "var(--samagra-font)",
} as const;

const BEZEL = "#05070b"; // proto §7 — bezel / notch fill (fixed device chrome)

/** One launcher button: an AppIcon tile + caption, dispatching onOpen(id). The
 *  button's accessible name comes from the labelled AppIcon (role=img), matching
 *  the Dock/Rail launcher pattern so `getByRole('button', {name})` resolves. */
function Launcher({
  id,
  accent,
  size,
  caption,
  onOpen,
}: {
  id: AppId;
  accent: string;
  size: number;
  caption: boolean;
  onOpen: (id: AppId) => void;
}) {
  return (
    <button
      type="button"
      title={APPS[id].name}
      onClick={() => onOpen(id)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: V.text,
      }}
    >
      <AppIcon app={id} accent={accent} size={size} radius={16} iconSize={Math.round(size * 0.47)} label={APPS[id].name} />
      {caption ? (
        <span style={{ fontSize: 11, fontWeight: 500, color: V.text, textAlign: "center", lineHeight: 1.1 }}>
          {APPS[id].name}
        </span>
      ) : null}
    </button>
  );
}

export default function Mobile({ clock, mobileApp, onOpen, onHome, appBody, theme = "aqua" }: MobileProps) {
  const t = THEMES[theme];
  // Per-app accent — samagra unifies to the theme accent (matches Dock L999/Rail).
  const accentFor = (id: AppId) => (t.kind === "samagra" ? t.accent : APPS[id].accent);

  const screenStyle: CSSProperties = {
    position: "relative",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    borderRadius: 42,
    overflow: "hidden",
    background: V.bg,
    color: V.text,
    fontFamily: V.font,
  };

  return (
    // Backdrop fills the shell and centers the phone.
    <div
      data-testid="mobile-root"
      style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {/* Phone bezel (proto §7: 392×812, max-height 94vh). */}
      <div
        data-testid="mobile-frame"
        style={{
          position: "relative",
          width: 392,
          height: 812,
          maxHeight: "94vh",
          background: BEZEL,
          borderRadius: 54,
          padding: 12,
          boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.04)",
          display: "flex",
        }}
      >
        <div style={screenStyle}>
          {/* Notch (decorative). */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 120,
              height: 26,
              background: BEZEL,
              borderRadius: "0 0 16px 16px",
              zIndex: 5,
            }}
          />

          {/* Status bar (height 44): clock + status glyphs. */}
          <div
            data-testid="mobile-statusbar"
            style={{
              height: 44,
              flex: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 22px",
              fontSize: 13,
              fontWeight: 600,
              color: V.barText,
            }}
          >
            <span>{clock}</span>
            <span aria-hidden="true" style={{ letterSpacing: 2, opacity: 0.85 }}>
              ▪▪▪ ⌃ 100%
            </span>
          </div>

          {mobileApp === null ? (
            // ── Home screen: app grid + favorites dock ──────────────────────────
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 18px 12px" }}>
                <div
                  data-testid="mobile-grid"
                  role="list"
                  aria-label="Apps"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: 18,
                    justifyItems: "center",
                  }}
                >
                  {ORDER.map((id) => (
                    <Launcher key={id} id={id} accent={accentFor(id)} size={58} caption onOpen={onOpen} />
                  ))}
                </div>
              </div>

              {/* Favorites dock (icons 50×50). */}
              <div
                data-testid="mobile-dock"
                role="list"
                aria-label="Favorites"
                style={{
                  flex: "none",
                  margin: "0 14px 14px",
                  padding: "12px 14px 16px",
                  display: "flex",
                  justifyContent: "space-around",
                  gap: 10,
                  borderRadius: 26,
                  background: "color-mix(in srgb, var(--samagra-text) 8%, transparent)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                }}
              >
                {MOBILE_FAVORITES.map((id) => (
                  <Launcher key={id} id={id} accent={accentFor(id)} size={50} caption={false} onOpen={onOpen} />
                ))}
              </div>

              {/* Home indicator (decorative on the home screen). */}
              <div
                aria-hidden="true"
                style={{ alignSelf: "center", width: 130, height: 5, borderRadius: 3, marginBottom: 8, background: "color-mix(in srgb, var(--samagra-text) 35%, transparent)" }}
              />
            </>
          ) : (
            // ── App screen: full-screen app + a Home control ────────────────────
            <>
              <div data-testid="mobile-app" style={{ flex: 1, overflowY: "auto" }}>
                {appBody}
              </div>
              {/* Home indicator doubles as the Home button (return to the grid). */}
              <button
                type="button"
                data-testid="mobile-home-indicator"
                aria-label="Home"
                onClick={onHome}
                style={{
                  alignSelf: "center",
                  width: 130,
                  height: 5,
                  borderRadius: 3,
                  margin: "8px 0 10px",
                  border: "none",
                  cursor: "pointer",
                  background: "color-mix(in srgb, var(--samagra-text) 45%, transparent)",
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
