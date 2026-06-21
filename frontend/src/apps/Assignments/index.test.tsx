import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Assignments from "./index";

const data = { assignments: [
  { id: "A1", agent: "codex", outbox_path: "x", pipeline: "textbook", seed_ref: null, artifact_ref: null,
    expected_output: null, review_by: null, status: "in-review", created_at: "t", updated_at: "t" },
], events: [] };

describe("Assignments app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/assignments and renders 5 columns + a card in in-review", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Assignments />);
    expect(useApiMock).toHaveBeenCalledWith("/api/assignments");
    expect(screen.getByTestId("assignments")).toBeInTheDocument();
    expect(screen.getAllByTestId("kanban-column")).toHaveLength(5);
    expect(screen.getByTestId("col-in-review")).toHaveTextContent("A1");
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Assignments />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("assignments")).toBeInTheDocument();
  });
  it("empty DB: 5 empty columns, no crash", () => {
    useApiMock.mockReturnValue({ data: { assignments: [], events: [] }, loading: false, error: null });
    render(<Assignments />);
    expect(screen.getAllByTestId("kanban-column")).toHaveLength(5);
  });
  // A-5 (ship loop) mobile no-overflow guard: in the phone frame the screen is
  // overflow:hidden, so a rigid `repeat(5, 1fr)` board (1fr has a min-content floor)
  // overflows ~15px and gets CLIPPED. The fix uses auto-fit + minmax so the 5 columns
  // reflow/shrink on a narrow screen (and still fill the row on desktop). jsdom can't
  // measure layout, so assert the shrink-capable CSS contract that prevents the clip.
  it("kanban grid is shrink-capable, not a rigid 5×1fr (A-5 mobile-overflow guard)", () => {
    useApiMock.mockReturnValue({ data: { assignments: [], events: [] }, loading: false, error: null });
    render(<Assignments />);
    const section = screen.getAllByTestId("kanban-column")[0].parentElement as HTMLElement;
    const tmpl = section.style.gridTemplateColumns;
    expect(tmpl).toMatch(/auto-fit/);
    expect(tmpl).toMatch(/minmax/);
    expect(tmpl).not.toMatch(/repeat\(\s*5/); // the rigid template that clipped
  });
});
