// E1.25 RED — IconButton render-smoke (proto.md: themed leaf primitive; renders
// children, applies the accent prop). This is the ONE behavioural assertion the
// loop gates on. Pixel/parity is a separate human QA pass.
// Accent constant `#4f46e5` is verbatim from proto.md §0 (dashboard accent).
import { render, screen } from "@testing-library/react";
import IconButton from "./IconButton";

const ACCENT = "#4f46e5"; // proto.md §0 — dashboard accent (verbatim)

describe("IconButton (E1.25 smoke)", () => {
  it("renders its children as an accessible button", () => {
    render(
      <IconButton accent={ACCENT} label="Close">
        ×
      </IconButton>,
    );
    const btn = screen.getByRole("button", { name: /close/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("×");
  });

  it("applies the accent prop to the rendered button", () => {
    render(
      <IconButton accent={ACCENT} label="Close">
        ×
      </IconButton>,
    );
    const btn = screen.getByRole("button", { name: /close/i });
    expect(btn.getAttribute("style")).toContain(ACCENT);
  });
});
