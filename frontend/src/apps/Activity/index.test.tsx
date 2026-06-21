import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Activity from "./index";

const data = { assignments: [], events: [
  { id: 2, ts: "2026-06-20T10:00", actor: "codex", verb: "status:approved",
    assignment_id: "A1", subsystem: null, subsystem_ref: null, note: "ok" },
] };

describe("Activity app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/assignments and renders event lines", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Activity />);
    expect(useApiMock).toHaveBeenCalledWith("/api/assignments");
    expect(screen.getByTestId("activity")).toBeInTheDocument();
    expect(screen.getByTestId("activity-row")).toHaveTextContent("status:approved");
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Activity />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("activity")).toBeInTheDocument();
  });
  it("empty state when no events", () => {
    useApiMock.mockReturnValue({ data: { assignments: [], events: [] }, loading: false, error: null });
    render(<Activity />);
    expect(screen.getByTestId("activity-empty")).toBeInTheDocument();
  });
});
