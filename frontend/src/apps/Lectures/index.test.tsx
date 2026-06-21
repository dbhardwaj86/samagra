import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Lectures from "./index";

const data = { results: [
  { uid: "u1", source: "textbook", kind: "chapter", title: "Vectors", subject: "Physics",
    unit: "Mechanics", chapter: "1", status: "approved", path: "C:/t/vectors.html",
    url: null, updated_at: null, meta: {} },
] };

describe("Lectures app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/search?source=textbook and lists rows", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Lectures />);
    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=textbook&limit=200");
    expect(screen.getByTestId("lectures")).toBeInTheDocument();
    expect(screen.getByText("Vectors")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-row")).toBeInTheDocument();
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Lectures />);
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 500");
    expect(screen.getByTestId("lectures")).toBeInTheDocument();
  });
  it("empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Lectures />);
    expect(screen.getByTestId("catalog-empty")).toBeInTheDocument();
  });
});
