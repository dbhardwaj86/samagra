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
});
