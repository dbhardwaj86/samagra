// E1.25 RED — Chip render-smoke (proto.md: themed leaf primitive; renders
// children, applies the accent prop). This is the ONE behavioural assertion the
// loop gates on. Pixel/parity is a separate human QA pass.
// Accent constant `#4f46e5` is verbatim from proto.md §0 (dashboard accent).
import { render, screen } from "@testing-library/react";
import Chip from "./Chip";

const ACCENT = "#4f46e5"; // proto.md §0 — dashboard accent (verbatim)

describe("Chip (E1.25 smoke)", () => {
  it("renders its children", () => {
    render(<Chip accent={ACCENT}>Hard</Chip>);
    expect(screen.getByText("Hard")).toBeInTheDocument();
  });

  it("applies the accent prop to the rendered element", () => {
    render(<Chip accent={ACCENT}>Hard</Chip>);
    const el = screen.getByText("Hard");
    expect(el.getAttribute("style")).toContain(ACCENT);
  });
});
