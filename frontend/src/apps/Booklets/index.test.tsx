import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Booklets from "./index";

const data = { results: [
  { uid: "b1", source: "booklets", kind: "booklet", title: "Mechanics WB", subject: "Physics",
    unit: null, chapter: null, status: null, path: "C:/b/mech.pdf", url: null, updated_at: null, meta: {} },
] };

describe("Booklets app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/search?source=booklets and lists rows", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Booklets />);
    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=booklets&limit=500");
    expect(screen.getByTestId("booklets")).toBeInTheDocument();
    expect(screen.getByText("Mechanics WB")).toBeInTheDocument();
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Booklets />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("booklets")).toBeInTheDocument();
  });
  it("empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Booklets />);
    expect(screen.getByTestId("catalog-empty")).toBeInTheDocument();
  });
});
