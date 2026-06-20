// E1.25 RED — Card render-smoke (proto.md: themed leaf primitive; renders
// children, applies the accent prop). This is the ONE behavioural assertion the
// loop gates on. Pixel/parity is a separate human QA pass.
// Accent constant `#4f46e5` is verbatim from proto.md §0 (dashboard accent).
import { render, screen } from "@testing-library/react";
import Card from "./Card";

const ACCENT = "#4f46e5"; // proto.md §0 — dashboard accent (verbatim)

describe("Card (E1.25 smoke)", () => {
  it("renders its children", () => {
    render(
      <Card accent={ACCENT}>
        <p>Pipeline body</p>
      </Card>,
    );
    expect(screen.getByText("Pipeline body")).toBeInTheDocument();
  });

  it("applies the accent prop to the rendered element", () => {
    render(
      <Card accent={ACCENT}>
        <p>Pipeline body</p>
      </Card>,
    );
    const card = screen.getByText("Pipeline body").parentElement as HTMLElement;
    expect(card.getAttribute("style")).toContain(ACCENT);
  });
});
