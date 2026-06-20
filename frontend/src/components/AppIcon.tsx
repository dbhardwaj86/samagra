// src/components/AppIcon.tsx — FD2 per-app accent gradient tile.
// Verbatim port of the prototype's dock / mobile-home app tiles
// (.dc.html line ~1003 dock 46×46 r12 glyph23; ~1099 mobile-home 58×58 r16 glyph27):
// a rounded square filled with `linear-gradient(160deg, hexA(accent,.95),
// hexA(accent,.7))`, white glyph, soft accent drop shadow `0 4px 12px hexA(accent,.4)`.
// The glyph is the inline <Icon> (NEVER a letter badge). All color is driven by the
// passed `accent` so the tile is theme/app correct. Pixel/parity is a separate human pass.
import type { CSSProperties } from "react";
import Icon from "./Icon";
import { hexA } from "./icons-data";
import type { AppId } from "../types/contracts";

export interface AppIconProps {
  /** App id — selects the glyph drawn inside the tile. */
  app: AppId;
  /** Accent color (`APPS[app].accent`) — drives the gradient + shadow. */
  accent: string;
  /** Tile edge length in px. Default 46 — the prototype's dock tile. */
  size?: number;
  /** Tile corner radius in px. Default 12 — the prototype's dock tile. */
  radius?: number;
  /** Glyph size in px. Default 23 — the prototype's dock glyph. */
  iconSize?: number;
  /** Accessible name for the tile (e.g. the app's display name). */
  label?: string;
  style?: CSSProperties;
}

/** Accent-gradient rounded tile holding an app's white line-icon. */
export default function AppIcon({
  app,
  accent,
  size = 46,
  radius = 12,
  iconSize = 23,
  label,
  style,
}: AppIconProps) {
  const labelled = label != null && label !== "";
  return (
    <div
      role={labelled ? "img" : undefined}
      aria-label={labelled ? label : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        // accent gradient — verbatim from the prototype: 160deg, .95 → .7 alpha
        background: `linear-gradient(160deg,${hexA(accent, 0.95)},${hexA(accent, 0.7)})`,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 4px 12px ${hexA(accent, 0.4)}`,
        flex: "none",
        ...style,
      }}
    >
      <Icon name={app} size={iconSize} />
    </div>
  );
}
