// src/shell/ContextMenu.tsx — Aqua window context menu (E1.18, VISUAL).
// Thin presentational wrapper: width 216, radius 12 (proto.md §7). Renders the
// given items and fires each item's `onSelect` on click. The shell owns the menu's
// open/position state and supplies the items + their actions; position-clamp pixels
// are a separate human QA pass.
import { THEMES } from "../themes";

const aqua = THEMES.aqua;

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  /** Render as a destructive (danger-tinted) item. */
  danger?: boolean;
  /** Disable the item (no action fires). */
  disabled?: boolean;
}

export interface ContextMenuProps {
  /** Viewport x of the menu's top-left corner. */
  x: number;
  /** Viewport y of the menu's top-left corner. */
  y: number;
  items: ContextMenuItem[];
}

export default function ContextMenu({ x, y, items }: ContextMenuProps) {
  return (
    <div
      role="menu"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: "216px",
        padding: 6,
        borderRadius: 12,
        background: aqua.winBg,
        backdropFilter: aqua.winBlur,
        border: `1px solid ${aqua.line}`,
        boxShadow: aqua.shadow,
        font: `13px ${aqua.font}`,
        color: aqua.text,
        zIndex: 9999,
      }}
    >
      {items.map((item, i) => (
        <button
          key={`${item.label}-${i}`}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            if (!item.disabled) item.onSelect();
          }}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "7px 10px",
            border: "none",
            borderRadius: 8,
            background: "transparent",
            cursor: item.disabled ? "default" : "pointer",
            opacity: item.disabled ? 0.45 : 1,
            color: item.danger ? "#dc2626" : aqua.text,
            font: "inherit",
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
