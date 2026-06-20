// src/shell/Rail.tsx — SAMAGRA OS left Rail dock (CH3 fidelity).
// Verbatim port of the prototype's renderDock samagra branch (.dc.html L1024-1028)
// + dockItem samagra branch (L1006-1011): the samagra "dock" is a vertical LEFT rail
// (width 66, full height, flex-column, gap 7, padding 12px 0, dockBg glass, a 1px
// `dockBorder` divider on the right) whose FIRST child is a 40×40 r12 "स" wordmark tile
// (linear-gradient(150deg, accent, #b8480f), white glyph, t.wordmark, 20px), followed
// by a scrolling column of one launcher per app in the frozen ORDER.
//
// Each launcher is a 46×46 r13 tile holding the app's inline <svg> glyph at size 23
// (FD2 — NEVER a letter badge). It is idle-transparent with a muted glyph; a RUNNING
// app tints to accent @ 0.14, flips the glyph to the accent, and grows a LEFT accent
// bar (3×18 r3, left:-9, vertically centered). All colours/sizes are driven by the
// ACTIVE samagra theme tokens + the unified theme accent (FD1) — no aqua/console
// values bleed in. This is a THIN, presentational dock: it dispatches intent only
// (onOpen); all WM logic lives in the WM store. Pixel parity is a separate human pass.
import type { AppId, Theme } from "../types/contracts";
import { APPS, ORDER } from "../registry";
import { THEMES } from "../themes";
import { hexA } from "../components/icons-data";
import Icon from "../components/Icon";

export interface RailProps {
  /** Open-or-focus an app — wired to the WM store's `openApp`. */
  onOpen: (id: AppId) => void;
  /** Ids of apps with at least one open window — drives the running tint + accent bar. */
  running?: AppId[];
  /** Active theme — the rail is a samagra-only dock; tokens default to samagra. */
  theme?: Theme;
}

export default function Rail({ onOpen, running = [], theme = "samagra" }: RailProps) {
  const t = THEMES[theme];
  const isRunning = (id: AppId) => running.includes(id);

  return (
    <div
      role="toolbar"
      aria-label="Rail"
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        width: `${t.rail ?? 0}px`,
        zIndex: 9000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7,
        padding: "12px 0",
        boxSizing: "border-box",
        background: t.dockBg,
        backdropFilter: t.dockBlur,
        WebkitBackdropFilter: t.dockBlur,
        // renderDock samagra L1024: the rail's right divider is the dockBorder token
        // (rgba(42,33,24,0.10)), NOT the slightly darker `line` token — port verbatim.
        borderRight: `1px solid ${t.dockBorder}`,
      }}
    >
      {/* स wordmark tile — accent gradient header (renderDock samagra L1027). */}
      <div
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(150deg,${t.accent},#b8480f)`,
          color: "#fff",
          fontFamily: t.wordmark,
          fontSize: 20,
          marginBottom: 8,
        }}
      >
        स
      </div>

      {/* Scrolling launcher column — one per app in the frozen ORDER. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 5,
          overflow: "auto",
        }}
      >
        {ORDER.map((id) => {
          const app = APPS[id];
          const run = isRunning(id);
          return (
            <button
              key={id}
              type="button"
              // The glyph is decorative (aria-hidden), so the button carries its own
              // accessible name via aria-label; `title` gives the hover tooltip.
              aria-label={app.name}
              title={app.name}
              onClick={() => onOpen(id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = t.accent;
                e.currentTarget.style.background = hexA(t.accent, 0.1);
              }}
              onMouseLeave={(e) => {
                if (!run) {
                  e.currentTarget.style.color = t.muted;
                  e.currentTarget.style.background = "transparent";
                }
              }}
              style={{
                position: "relative",
                width: 46,
                height: 46,
                borderRadius: 13,
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: run ? hexA(t.accent, 0.14) : "transparent",
                color: run ? t.accent : t.muted,
                transition: "background .15s,color .15s",
              }}
            >
              <Icon name={id} size={23} />
              {/* LEFT accent bar on a running launcher (dockItem samagra L1011). */}
              {run ? (
                <span
                  data-testid="rail-active-bar"
                  style={{
                    position: "absolute",
                    left: -9,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 3,
                    height: 18,
                    borderRadius: 3,
                    background: t.accent,
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
