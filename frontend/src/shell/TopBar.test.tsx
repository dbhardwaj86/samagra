// E1.18 RED — TopBar smoke (proto.md §1.1: aqua barH = 30; wordmark + active
// title + status pill + live clock). Pixel/Aqua parity is a separate human QA
// pass, NOT asserted here. The TopBar is a thin presentational wrapper.
import { render, screen } from "@testing-library/react";
import TopBar from "./TopBar";

describe("TopBar (E1.18 smoke)", () => {
  it("renders the chrome bar without crashing", () => {
    const { container } = render(<TopBar activeTitle="Dashboard" clock="9:41 AM" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders the SAMAGRA wordmark", () => {
    render(<TopBar activeTitle="Dashboard" clock="9:41 AM" />);
    expect(screen.getByText(/SAMAGRA/i)).toBeInTheDocument();
  });

  it("renders the active window title", () => {
    render(<TopBar activeTitle="Terminal" clock="9:41 AM" />);
    expect(screen.getByText("Terminal")).toBeInTheDocument();
  });

  it("renders the live clock string", () => {
    render(<TopBar activeTitle="Dashboard" clock="12:34 PM" />);
    expect(screen.getByText("12:34 PM")).toBeInTheDocument();
  });

  it("is 30px tall (proto.md §1.1 aqua barH)", () => {
    const { container } = render(<TopBar activeTitle="Dashboard" clock="9:41 AM" />);
    const bar = container.firstChild as HTMLElement;
    expect(bar.style.height).toBe("30px");
  });
});
