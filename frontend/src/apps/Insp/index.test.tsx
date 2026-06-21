import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Insp from "./index";

const data = { results: [
  { uid: "i1", source: "insp", kind: "exam-set", title: "NSEP 2024", subject: null,
    unit: null, chapter: null, status: null, path: null, url: null, updated_at: null, meta: { pdfs: 5 } },
] };

describe("INSP app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/search?source=insp and lists rows", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Insp />);
    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=insp&limit=500");
    expect(screen.getByTestId("insp")).toBeInTheDocument();
    expect(screen.getByText("NSEP 2024")).toBeInTheDocument();
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Insp />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("insp")).toBeInTheDocument();
  });
  it("empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Insp />);
    expect(screen.getByTestId("catalog-empty")).toBeInTheDocument();
  });
});
