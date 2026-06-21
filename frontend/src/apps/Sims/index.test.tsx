import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Sims from "./index";

const data = { results: [
  { uid: "s1", source: "sims", kind: "sim", title: "Projectile", subject: "Physics",
    unit: null, chapter: null, status: null, path: "C:/s/proj.html", url: null, updated_at: null, meta: { grade: "11" } },
] };

describe("Sims app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/search?source=sims and lists rows + subject chips", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Sims />);
    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=sims&limit=2000");
    expect(screen.getByTestId("sims")).toBeInTheDocument();
    expect(screen.getByText("Projectile")).toBeInTheDocument();
    expect(screen.getByTestId("subject-chip")).toHaveTextContent("Physics");
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Sims />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("sims")).toBeInTheDocument();
  });
  it("empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Sims />);
    expect(screen.getByTestId("catalog-empty")).toBeInTheDocument();
  });
});
