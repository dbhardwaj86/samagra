// src/components/Card.tsx — E1.25 themed leaf primitive (proto.md §6.5).
// Thin presentational wrapper: a surface with a subtle accent-tinted border.
// No logic; pixel/parity is a separate human QA pass.
import type { CSSProperties, ReactNode } from "react";

export interface CardProps {
  /** Accent color used for the card's border tint. */
  accent: string;
  children: ReactNode;
  style?: CSSProperties;
}

/** Rounded surface container with an accent-tinted border. */
export default function Card({ accent, children, style }: CardProps) {
  return (
    <div
      style={
        {
          // `--accent` carries the raw hex verbatim (consumed by the border tint below);
          // it also keeps the literal token in the serialized style for the smoke test.
          "--accent": accent,
          borderRadius: 12,
          padding: 14,
          border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)",
          background: "var(--card-bg, rgba(255,255,255,0.62))",
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
