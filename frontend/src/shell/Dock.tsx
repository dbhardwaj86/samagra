// src/shell/Dock.tsx — SAMAGRA OS dock (CH1 fidelity).
// Verbatim port of the prototype's renderDock + dockItem (.dc.html L997-1004,
// L1016-1022): the aqua dock floats bottom-center (bottom 12, gap 10, padding
// 9px 14px, radius 20, glass blur, shadow 0 12px 40px rgba(0,0,0,.28)) and renders
// one launcher per app in the frozen ORDER. Each launcher is a hover-lift wrapper
// (translateY(-7px) scale(1.12) on mouse-enter) holding a 46×46 <AppIcon> tile
// (FD2 — an inline <svg> glyph at size 23, NEVER a letter badge). All colours/sizes
// are driven by the active theme tokens + per-app accents (FD1) so the dock is
// theme-correct. The dock dispatches intent only (onOpen); all WM logic lives in the
// WM store. Pixel parity is a separate human QA pass.
import type { AppId, Theme } from "../types/contracts";
import { APPS, ORDER } from "../registry";
import { THEMES } from "../themes";
import AppIcon from "../components/AppIcon";

export interface DockProps {
  /** Open-or-focus an app — wired to the WM store's `openApp`. */
  onOpen: (id: AppId) => void;
  /** Active theme — drives the dock glass + per-app tile colours (defaults aqua). */
  theme?: Theme;
}

export default function Dock({ onOpen, theme = "aqua" }: DockProps) {
  const t = THEMES[theme];

  return (
    <div
      role="toolbar"
      aria-label="Dock"
      style={{
        position: "absolute",
        bottom: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9000,
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        padding: "9px 14px",
        borderRadius: "20px",
        background: t.dockBg,
        backdropFilter: t.dockBlur,
        WebkitBackdropFilter: t.dockBlur,
        border: `1px solid ${t.dockBorder}`,
        boxShadow: "0 12px 40px rgba(0,0,0,.28)",
      }}
    >
      {ORDER.map((id) => {
        const app = APPS[id];
        // Per-app accent for the gradient tile: samagra unifies to the theme accent,
        // aqua/console use each app's own accent (dockItem L999).
        const accent = t.kind === "samagra" ? t.accent : app.accent;
        return (
          <button
            key={id}
            type="button"
            // No explicit aria-label: the button derives its accessible name from
            // the labelled <AppIcon> child (role="img" aria-label=app.name), so the
            // 46×46 tile is the single element addressable by that name. `title`
            // gives the hover tooltip without adding a second label match.
            title={app.name}
            onClick={() => onOpen(id)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-7px) scale(1.12)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "";
            }}
            style={{
              position: "relative",
              padding: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              transition: "transform .12s",
              display: "flex",
            }}
          >
            <AppIcon app={id} accent={accent} size={46} radius={12} iconSize={23} label={app.name} />
          </button>
        );
      })}
    </div>
  );
}
