// E1.25 RED — Pill render-smoke (proto.md: themed leaf primitive; renders
// children, applies the accent prop). This is the ONE behavioural assertion the
// loop gates on. Pixel/parity is a separate human QA pass.
// Accent constant `#4f46e5` is verbatim from proto.md §0 (dashboard accent).
import { render, screen } from "@testing-library/react";
import Pill from "./Pill";

const ACCENT = "#4f46e5"; // proto.md §0 — dashboard accent (verbatim)

describe("Pill (E1.25 smoke)", () => {
  it("renders its children", () => {
    render(<Pill accent={ACCENT}>Running</Pill>);
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("applies the accent prop to the rendered element", () => {
    render(<Pill accent={ACCENT}>Running</Pill>);
    const el = screen.getByText("Running");
    // Accent must appear somewhere in the element's inline style (color/bg/border).
    expect(el.getAttribute("style")).toContain(ACCENT);
  });
});
