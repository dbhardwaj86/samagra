// src/components/Pill.tsx — E1.25 themed leaf primitive (proto.md §6.5).
// Thin presentational wrapper: a small rounded status label tinted by `accent`.
// No logic; pixel/parity is a separate human QA pass.
import type { CSSProperties, ReactNode } from "react";

export interface PillProps {
  /** Accent/status color (e.g. STATUS.* or theme.accent from themes/). */
  accent: string;
  children: ReactNode;
  style?: CSSProperties;
}

/** Compact rounded status label, tinted by the accent token. */
export default function Pill({ accent, children, style }: PillProps) {
  return (
    <span
      style={
        {
          // `--accent` carries the raw hex verbatim (consumed by color/border below);
          // it also keeps the literal token in the serialized style for the smoke test.
          "--accent": accent,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 10px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.4,
          color: "var(--accent)",
          background: `color-mix(in srgb, ${accent} 14%, transparent)`,
          border: "1px solid var(--accent)",
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </span>
  );
}
