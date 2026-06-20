// src/components/Icon.tsx — FD2 inline-SVG line-icon primitive.
// Verbatim port of the prototype's `icon()` helper (.dc.html lines ~242-244):
// a 24×24 viewBox svg, fill none, stroke currentColor, round caps/joins, with the
// glyph's path-data split on `|` into one <path> per segment. Color is inherited
// (currentColor) so the consumer/theme drives it. Decorative by default
// (aria-hidden); pass `label` to surface it as a labelled img-role graphic.
// Pixel/parity is a separate human QA pass.
import { ICONS, ICON_STROKE, ICON_DEFAULT_SIZE } from "./icons-data";
import type { AppId } from "../types/contracts";

export interface IconProps {
  /** Which app glyph to render (key into the verbatim ICONS map). */
  name: AppId;
  /** Render size in px (square). Default 20 — the prototype's `size||20`. */
  size?: number;
  /** Stroke width. Default 1.9 — the prototype's `sw||1.9`. */
  strokeWidth?: number;
  /** Accessible name. When set, the svg becomes role="img"; otherwise decorative. */
  label?: string;
}

/** 24×24 stroke line-icon, path data verbatim from the prototype's ICONS map. */
export default function Icon({
  name,
  size = ICON_DEFAULT_SIZE,
  strokeWidth = ICON_STROKE,
  label,
}: IconProps) {
  const segments = (ICONS[name] ?? "").split("|");
  const labelled = label != null && label !== "";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={labelled ? "img" : undefined}
      aria-label={labelled ? label : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      {segments.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
