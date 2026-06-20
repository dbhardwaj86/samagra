// E1.18 RED — ContextMenu smoke (proto.md §7: width 216, radius 12; item
// click fires its action). Thin presentational wrapper. Position-clamp pixels
// are human QA — only the headless residue (render + item dispatch) is asserted.
import { render, screen, fireEvent } from "@testing-library/react";
import ContextMenu from "./ContextMenu";

describe("ContextMenu (E1.18 smoke)", () => {
  const items = [
    { label: "Minimize", onSelect: () => {} },
    { label: "Maximize", onSelect: () => {} },
    { label: "Close", onSelect: () => {} },
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

  it("is 216px wide (proto.md §7)", () => {
    const { container } = render(<ContextMenu x={10} y={10} items={items} />);
    const menu = container.firstChild as HTMLElement;
    expect(menu.style.width).toBe("216px");
  });

  it("fires the item action when clicked", () => {
    const onSelect = vi.fn();
    render(
      <ContextMenu x={10} y={10} items={[{ label: "Close", onSelect }]} />,
    );
    fireEvent.click(screen.getByText("Close"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders a danger item (no crash on the destructive style branch)", () => {
    render(
      <ContextMenu x={10} y={10} items={[{ label: "Close", onSelect: () => {}, danger: true }]} />,
    );
    expect(screen.getByText("Close")).toBeInTheDocument();
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
});
