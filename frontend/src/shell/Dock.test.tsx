// E1.18 RED — Dock smoke (proto.md §1.1: aqua dock floats bottom-center,
// radius 20; renders ORDER; a Dock icon click calls the WM store `openApp`).
// This is the ONE behavioural assertion the loop gates on. Pixels are human QA.
import { render, screen, fireEvent } from "@testing-library/react";
import Dock from "./Dock";
import { ORDER } from "../registry";

describe("Dock (E1.18 smoke)", () => {
  it("renders the dock container without crashing", () => {
    const { container } = render(<Dock onOpen={() => {}} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders one launcher per app in ORDER", () => {
    render(<Dock onOpen={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(ORDER.length);
  });

  it("has the aqua dock radius of 20 (proto.md §1.1)", () => {
    const { container } = render(<Dock onOpen={() => {}} />);
    const dock = container.firstChild as HTMLElement;
    expect(dock.style.borderRadius).toBe("20px");
  });

  it("dispatches openApp with the app id when an icon is clicked", () => {
    const onOpen = vi.fn();
    render(<Dock onOpen={onOpen} />);
    // First launcher corresponds to ORDER[0] === 'dashboard'.
    const first = screen.getByRole("button", { name: /dashboard/i });
    fireEvent.click(first);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(ORDER[0]);
  });

  it("dispatches openApp for a non-first app id", () => {
    const onOpen = vi.fn();
    render(<Dock onOpen={onOpen} />);
    const terminal = screen.getByRole("button", { name: /terminal/i });
    fireEvent.click(terminal);
    expect(onOpen).toHaveBeenCalledWith("terminal");
  });
});
