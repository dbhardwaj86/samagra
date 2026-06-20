// CH1 fidelity — Aqua ContextMenu (proto.md §7 / .dc.html renderMenu L896-917).
// Width 216, radius 12, blur 26px, padding 6, item rows gap 9 / padding 7px 10px /
// radius 8 / weight 500, danger rows tinted #ef4444 (proto value), dividers as 1px
// lines, optional uppercase headers, optional leading <Icon> glyph (FD2), and a
// trailing ✓ for checked radio items. All colors come from the active theme tokens
// (FD1) so the menu is theme-correct under aqua / console / samagra.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ContextMenu from "./ContextMenu";
import { THEMES } from "../themes";

describe("ContextMenu (CH1 aqua chrome fidelity)", () => {
  const items = [
    { label: "Minimize", onSelect: () => {} },
    { label: "Maximize", onSelect: () => {} },
    { label: "Close", onSelect: () => {}, danger: true },
  ];

  it("renders the menu without crashing", () => {
    const { container } = render(<ContextMenu x={10} y={10} items={items} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders each item label", () => {
    render(<ContextMenu x={10} y={10} items={items} />);
    expect(screen.getByText("Minimize")).toBeInTheDocument();
    expect(screen.getByText("Maximize")).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  // --- exact menu container tokens (renderMenu L903-905) ---
  it("is 216px wide (proto.md §7)", () => {
    const { container } = render(<ContextMenu x={10} y={10} items={items} />);
    const menu = container.firstChild as HTMLElement;
    expect(menu.style.width).toBe("216px");
  });

  it("uses radius 12, padding 6, and the 26px blur from the prototype", () => {
    const { container } = render(<ContextMenu x={10} y={10} items={items} />);
    const menu = container.firstChild as HTMLElement;
    expect(menu.style.borderRadius).toBe("12px");
    expect(menu.style.padding).toBe("6px");
    expect(menu.style.backdropFilter).toContain("blur(26px)");
    expect(menu.style.boxShadow).toBe("0 18px 50px rgba(0,0,0,.4)");
  });

  // --- item row tokens (renderMenu L912) ---
  it("renders item rows with the exact prototype padding + radius", () => {
    render(<ContextMenu x={10} y={10} items={items} />);
    const row = screen.getByText("Minimize").closest('[role="menuitem"]') as HTMLElement;
    expect(row.style.padding).toBe("7px 10px");
    expect(row.style.borderRadius).toBe("8px");
  });

  // --- row weight (renderMenu L912): rows are fontWeight 500. The button must
  // inherit the menu family/size WITHOUT a `font` shorthand clobbering the weight. ---
  it("keeps menu rows at the prototype's 500 weight (font shorthand must not reset it)", () => {
    render(<ContextMenu x={10} y={10} items={items} />);
    const row = screen.getByText("Minimize").closest('[role="menuitem"]') as HTMLElement;
    // the row weight survives at 500 (a `font: "inherit"` shorthand would have reset
    // it back to the inherited 400 — this is the regression the advisory caught).
    expect(row.style.fontWeight).toBe("500");
    // family/size still inherit from the menu container onto the <button>
    expect(row.style.fontFamily).toBe("inherit");
    expect(row.style.fontSize).toBe("inherit");
    // jsdom recomposes the shorthand getter from the longhands; the 500 weight must
    // be reflected there too (never collapsed to a bare "inherit" that drops weight).
    expect(row.style.font).toContain("500");
  });

  it("tints a danger item with the prototype danger color #ef4444", () => {
    render(<ContextMenu x={10} y={10} items={items} />);
    const close = screen.getByText("Close").closest('[role="menuitem"]') as HTMLElement;
    expect(close.style.color).toBe("rgb(239, 68, 68)"); // #ef4444
  });

  // --- divider support (renderMenu L907) ---
  it("renders a divider as a thin 1px line, not a clickable item", () => {
    const { container } = render(
      <ContextMenu
        x={10}
        y={10}
        items={[
          { label: "A", onSelect: () => {} },
          { divider: true },
          { label: "B", onSelect: () => {} },
        ]}
      />,
    );
    // two real menu items, the divider is not one of them
    expect(container.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
    const divider = container.querySelector('[data-divider="true"]') as HTMLElement;
    expect(divider).not.toBeNull();
    expect(divider.style.height).toBe("1px");
  });

  // --- header support (renderMenu L908) ---
  it("renders a section header label (uppercase, non-clickable)", () => {
    render(
      <ContextMenu
        x={10}
        y={10}
        items={[{ header: "Appearance" }, { label: "Aqua", onSelect: () => {} }]}
      />,
    );
    const header = screen.getByText("Appearance");
    expect(header.style.textTransform).toBe("uppercase");
    expect(header.closest('[role="menuitem"]')).toBeNull();
  });

  // --- leading icon (FD2) + checked ✓ (renderMenu L913-915) ---
  it("renders a leading inline <svg> glyph when an item supplies an icon", () => {
    const { container } = render(
      <ContextMenu
        x={10}
        y={10}
        items={[{ label: "Open Dashboard", onSelect: () => {}, icon: "dashboard" }]}
      />,
    );
    const row = container.querySelector('[role="menuitem"]') as HTMLElement;
    expect(row.querySelector("svg")).not.toBeNull();
  });

  it("renders a ✓ check mark on a checked item", () => {
    render(
      <ContextMenu
        x={10}
        y={10}
        items={[{ label: "Aqua", onSelect: () => {}, checked: true }]}
      />,
    );
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  // --- behaviours ---
  it("fires the item action when clicked", () => {
    const onSelect = vi.fn();
    render(<ContextMenu x={10} y={10} items={[{ label: "Close", onSelect }]} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not fire the action for a disabled item", () => {
    const onSelect = vi.fn();
    render(
      <ContextMenu
        x={10}
        y={10}
        items={[{ label: "Minimize", onSelect, disabled: true }]}
      />,
    );
    fireEvent.click(screen.getByText("Minimize"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  // --- theme correctness (FD1): under samagra the menu text + line follow samagra
  // tokens; no aqua text color bleeds through.
  it("paints the menu text from samagra tokens when the active theme is samagra", () => {
    const { container } = render(
      <ContextMenu x={10} y={10} items={items} theme="samagra" />,
    );
    const menu = container.firstChild as HTMLElement;
    expect(menu.style.color).toBe("rgb(42, 33, 24)"); // samagra.text #2a2118
    expect(menu.style.color).not.toBe(THEMES.aqua.text);
  });
});
