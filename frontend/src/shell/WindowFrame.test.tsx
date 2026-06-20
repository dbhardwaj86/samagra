// E1.18 RED — WindowFrame smoke (proto.md §1.1: aqua winRadius = 13; left
// traffic-lights; 38px title bar; double-click maximize; right-click →
// ContextMenu). Thin presentational wrapper; geometry already lives in
// lib/wm/*. Pixel parity is a separate human QA pass — not asserted here.
import { render, screen, fireEvent } from "@testing-library/react";
import WindowFrame from "./WindowFrame";

const win = {
  id: "w1",
  app: "dashboard" as const,
  x: 40,
  y: 60,
  w: 940,
  h: 610,
  z: 21,
  min: false,
  max: false,
  prev: null,
};

describe("WindowFrame (E1.18 smoke)", () => {
  it("renders the frame and its children without crashing", () => {
    render(
      <WindowFrame win={win} title="Dashboard">
        <div>body</div>
      </WindowFrame>,
    );
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("renders the window title in the title bar", () => {
    render(
      <WindowFrame win={win} title="Dashboard">
        <div />
      </WindowFrame>,
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("uses the aqua window radius of 13 (proto.md §1.1)", () => {
    const { container } = render(
      <WindowFrame win={win} title="Dashboard">
        <div />
      </WindowFrame>,
    );
    const frame = container.firstChild as HTMLElement;
    expect(frame.style.borderRadius).toBe("13px");
  });

  it("double-click on the title bar toggles maximize (proto.md §1.8)", () => {
    const onToggleMax = vi.fn();
    const { getByTestId } = render(
      <WindowFrame win={win} title="Dashboard" onToggleMax={onToggleMax}>
        <div />
      </WindowFrame>,
    );
    fireEvent.doubleClick(getByTestId("titlebar"));
    expect(onToggleMax).toHaveBeenCalledWith("w1");
  });

  it("right-click on the title bar opens the context menu (proto.md §1.1)", () => {
    const onContextMenu = vi.fn();
    const { getByTestId } = render(
      <WindowFrame win={win} title="Dashboard" onContextMenu={onContextMenu}>
        <div />
      </WindowFrame>,
    );
    fireEvent.contextMenu(getByTestId("titlebar"), { clientX: 120, clientY: 80 });
    expect(onContextMenu).toHaveBeenCalledWith("w1", 120, 80);
  });
});
