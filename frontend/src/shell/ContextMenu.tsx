// src/shell/ContextMenu.tsx — SAMAGRA OS context menu (CH1 fidelity).
// Verbatim port of the prototype's renderMenu (.dc.html L896-917): a 216px-wide glass
// menu (radius 12, padding 6, blur 26px, shadow 0 18px 50px rgba(0,0,0,.4)) whose
// surface/text/line come from the ACTIVE theme tokens (FD1) so it is theme-correct
// under aqua / console / samagra. Items are a union of action rows, dividers, and
// section headers:
//   - action row: padding 7px 10px, radius 8, gap 9, weight 500; optional leading
//     <Icon> glyph (FD2 — inline <svg>), a flex-1 label, and a trailing ✓ for checked
//     radio items. Danger rows tint #ef4444 (the prototype danger value).
//   - divider: a 1px theme `line` rule (data-divider, never clickable).
//   - header: uppercase 10.5px muted caption (never clickable).
// The shell owns the menu's open/position state and supplies the items + actions;
// position-clamp pixels are a separate human QA pass.
import { THEMES } from "../themes";
import type { AppId, Theme } from "../types/contracts";
import Icon from "../components/Icon";

/** An action row that fires `onSelect` on click. */
export interface ContextMenuAction {
  label: string;
  onSelect: () => void;
  /** Render as a destructive (danger-tinted) item. */
  danger?: boolean;
  /** Disable the item (no action fires). */
  disabled?: boolean;
  /** Leading app glyph (rendered as an inline <Icon>). */
  icon?: AppId;
  /** Show a trailing ✓ (used for theme radio checks). */
  checked?: boolean;
}

/** A 1px separator rule. */
export interface ContextMenuDivider {
  divider: true;
}

/** An uppercase section caption. */
export interface ContextMenuHeader {
  header: string;
}

export type ContextMenuItem = ContextMenuAction | ContextMenuDivider | ContextMenuHeader;

export interface ContextMenuProps {
  /** Viewport x of the menu's top-left corner. */
  x: number;
  /** Viewport y of the menu's top-left corner. */
  y: number;
  items: ContextMenuItem[];
  /** Active theme — drives surface / text / line tokens (defaults aqua). */
  theme?: Theme;
}

function isDivider(it: ContextMenuItem): it is ContextMenuDivider {
  return (it as ContextMenuDivider).divider === true;
}
function isHeader(it: ContextMenuItem): it is ContextMenuHeader {
  return typeof (it as ContextMenuHeader).header === "string";
}

/** Per-theme menu surface (renderMenu L898) — samagra/console get bespoke opacity. */
function menuSurface(kind: string): string {
  if (kind === "samagra") return "rgba(255,251,243,0.97)";
  if (kind === "console") return "rgba(18,24,36,0.96)";
  return "rgba(255,255,255,0.96)";
}

const DANGER = "#ef4444";

export default function ContextMenu({ x, y, items, theme = "aqua" }: ContextMenuProps) {
  const t = THEMES[theme];

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
        background: menuSurface(t.kind),
        backdropFilter: "blur(26px)",
        WebkitBackdropFilter: "blur(26px)",
        border: `1px solid ${t.line}`,
        boxShadow: "0 18px 50px rgba(0,0,0,.4)",
        fontFamily: t.font,
        fontSize: 13,
        color: t.text,
        zIndex: 100000,
      }}
    >
      {items.map((item, i) => {
        if (isDivider(item)) {
          return (
            <div
              key={`div-${i}`}
              data-divider="true"
              style={{ height: 1, background: t.line, margin: "5px 8px" }}
            />
          );
        }
        if (isHeader(item)) {
          return (
            <div
              key={`hdr-${i}`}
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: t.muted,
                padding: "6px 10px 3px",
              }}
            >
              {item.header}
            </div>
          );
        }

        const color = item.danger ? DANGER : t.text;
        return (
          <button
            key={`${item.label}-${i}`}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) item.onSelect();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              width: "100%",
              textAlign: "left",
              padding: "7px 10px",
              border: "none",
              borderRadius: 8,
              background: "transparent",
              cursor: item.disabled ? "default" : "pointer",
              opacity: item.disabled ? 0.45 : 1,
              color,
              fontWeight: 500,
              font: "inherit",
            }}
          >
            {item.icon ? (
              <span style={{ display: "flex", color: item.danger ? DANGER : t.muted }}>
                <Icon name={item.icon} size={15} />
              </span>
            ) : null}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.checked ? (
              <span style={{ color: t.accent, fontWeight: 700 }}>{"✓"}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
