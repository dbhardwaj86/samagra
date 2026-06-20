// src/shell/StartMenu.tsx — SAMAGRA OS console Start menu (CH2 fidelity).
// Verbatim port of the prototype's renderStart (.dc.html L1051-1062): a 380px-wide
// popover anchored bottom 58 / left 12 (radius 16, padding 18) painted from the
// console glass tokens (t.dockBg / t.dockBlur / 1px t.dockBorder, shadow
// 0 24px 70px rgba(0,0,0,.6), popIn .15s). It holds an uppercase "All apps" heading
// (11px/700, letter-spacing 0.08em, muted) and a 4-column grid (gap 6) of ALL 17
// apps in the frozen ORDER. Each launcher is a column (gap 7, padding 12px 4px,
// radius 11) with a hover wash, holding a 42×42 / radius-11 accent-gradient tile
// (linear-gradient 160deg, hexA(accent,0.9) → hexA(accent,0.6)) that wraps the inline
// <Icon> glyph at size 21 (FD2 — never a letter badge) + the app-name label
// (10.5px). All colours/sizes come from the active theme tokens + per-app accents
// (FD1) so the menu is theme-correct. Pixel parity is a separate human QA pass.
import type { AppId, Theme } from "../types/contracts";
import { APPS, ORDER } from "../registry";
import { THEMES } from "../themes";
import { hexA } from "../components/icons-data";
import Icon from "../components/Icon";

export interface StartMenuProps {
  /** Open-or-focus an app — wired to the WM store's `openApp`. */
  onOpen: (id: AppId) => void;
  /** Active theme — drives the panel glass + per-app tile colours (defaults console). */
  theme?: Theme;
}

export default function StartMenu({ onOpen, theme = "console" }: StartMenuProps) {
  const t = THEMES[theme];

  return (
    <div
      role="menu"
      aria-label="All apps"
      style={{
        position: "absolute",
        bottom: "58px",
        left: "12px",
        width: "380px",
        zIndex: 9100,
        padding: "18px",
        borderRadius: "16px",
        background: t.dockBg,
        backdropFilter: t.dockBlur,
        WebkitBackdropFilter: t.dockBlur,
        border: `1px solid ${t.dockBorder}`,
        boxShadow: "0 24px 70px rgba(0,0,0,.6)",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: t.muted,
          marginBottom: 12,
        }}
      >
        All apps
      </div>

      <div
        data-testid="start-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}
      >
        {ORDER.map((id) => {
          const app = APPS[id];
          // Per-app gradient: samagra unifies to the theme accent, aqua/console use
          // each app's own accent (matches the dock convention).
          const accent = t.kind === "samagra" ? t.accent : app.accent;
          return (
            <button
              key={id}
              type="button"
              title={app.name}
              onClick={() => onOpen(id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = hexA("#ffffff", 0.06);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 7,
                padding: "12px 4px",
                borderRadius: 11,
                border: "none",
                cursor: "pointer",
                background: "transparent",
              }}
            >
              <div
                data-testid="start-tile"
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "11px",
                  background: `linear-gradient(160deg,${hexA(accent, 0.9)},${hexA(accent, 0.6)})`,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={id} size={21} />
              </div>
              <span
                style={{ fontSize: 10.5, color: t.text, textAlign: "center", lineHeight: 1.2 }}
              >
                {app.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
