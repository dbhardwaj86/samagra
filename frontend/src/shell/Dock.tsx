// src/shell/Dock.tsx — Aqua dock (E1.18, VISUAL).
// Thin presentational wrapper: floats bottom-center, radius 20 (proto.md §1.1),
// renders one launcher per app in the frozen `ORDER`, and calls `onOpen(appId)` on
// click. The dock dispatches intent only — all WM logic lives in the WM store; the
// shell wires `onOpen` to `wm.openApp`. Pixel/Aqua parity is a separate human QA pass.
import type { AppId } from "../types/contracts";
import { APPS, ORDER } from "../registry";
import { THEMES } from "../themes";

const aqua = THEMES.aqua;

export interface DockProps {
  /** Open-or-focus an app — wired to the WM store's `openApp`. */
  onOpen: (id: AppId) => void;
}

export default function Dock({ onOpen }: DockProps) {
  return (
    <div
      role="toolbar"
      aria-label="Dock"
      style={{
        position: "absolute",
        left: "50%",
        bottom: 14,
        transform: "translateX(-50%)",
        display: "flex",
        gap: 8,
        padding: "8px 10px",
        borderRadius: "20px",
        background: aqua.dockBg,
        backdropFilter: aqua.dockBlur,
        border: `1px solid ${aqua.dockBorder}`,
        boxShadow: aqua.shadow,
      }}
    >
      {ORDER.map((id) => {
        const app = APPS[id];
        return (
          <button
            key={id}
            type="button"
            aria-label={app.name}
            title={app.name}
            onClick={() => onOpen(id)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 700,
              fontFamily: aqua.font,
              background: app.accent,
            }}
          >
            {app.name.charAt(0)}
          </button>
        );
      })}
    </div>
  );
}
