// src/components/Chip.tsx — E1.25 themed leaf primitive (proto.md §6.5).
// Thin presentational wrapper: a tiny tag/label (e.g. difficulty) tinted by `accent`.
// No logic; pixel/parity is a separate human QA pass.
import type { CSSProperties, ReactNode } from "react";

export interface ChipProps {
  /** Accent/status color (e.g. DIFFICULTY.* from themes/). */
  accent: string;
  children: ReactNode;
  style?: CSSProperties;
}

/** Small solid-tinted tag, used for difficulty/category labels. */
export default function Chip({ accent, children, style }: ChipProps) {
  return (
    <span
      style={
        {
          // `--accent` carries the raw hex verbatim (consumed by background below);
          // it also keeps the literal token in the serialized style for the smoke test.
          "--accent": accent,
          display: "inline-flex",
          alignItems: "center",
          padding: "1px 8px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.2,
          color: "#fff",
          background: "var(--accent)",
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </span>
  );
}
