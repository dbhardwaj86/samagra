import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Munshi from "./index";

const data = { results: [
  { uid: "m1", source: "munshi", kind: "todo", title: "Call vendor", subject: null,
    unit: null, chapter: null, status: "open", path: null, url: null, updated_at: null, meta: {} },
] };

describe("Munshi app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/search?source=munshi and lists items", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Munshi />);
    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=munshi&limit=200");
    expect(screen.getByTestId("munshi")).toBeInTheDocument();
    expect(screen.getByText("Call vendor")).toBeInTheDocument();
  });
  it("creds-gated empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Munshi />);
    expect(screen.getByTestId("catalog-empty")).toHaveTextContent(/creds|available/i);
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Munshi />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("munshi")).toBeInTheDocument();
  });
});
