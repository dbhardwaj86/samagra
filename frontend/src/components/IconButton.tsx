// src/components/IconButton.tsx — E1.25 themed leaf primitive (proto.md §6.5).
// Thin presentational wrapper: an accessible square button holding a glyph/icon.
// No logic; pixel/parity is a separate human QA pass.
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  /** Accent color used for the glyph. */
  accent: string;
  /** Accessible name (aria-label) — icon buttons have no visible text label. */
  label: string;
  children: ReactNode;
  style?: CSSProperties;
}

/** Square icon-only button with an accessible name. */
export default function IconButton({
  accent,
  label,
  children,
  style,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      style={
        {
          // `--accent` carries the raw hex verbatim (consumed by the glyph color below);
          // it also keeps the literal token in the serialized style for the smoke test.
          "--accent": accent,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          padding: 0,
          borderRadius: 8,
          border: "1px solid transparent",
          background: "transparent",
          color: "var(--accent)",
          cursor: "pointer",
          font: "inherit",
          lineHeight: 1,
          ...style,
        } as CSSProperties
      }
      {...rest}
    >
      {children}
    </button>
  );
}
