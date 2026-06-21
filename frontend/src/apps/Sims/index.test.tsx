import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Sims from "./index";

const data = { sims: [
  { id: "0020", title: "Vector Lab", subject: "Physics", grade: "Class 11",
    url: "https://pratyakshsims.com/sims/SIM0020/SIM0020_sim.html" },
], total: 1 };

describe("Sims app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("reads /api/sims and links rows to pratyakshsims.com", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Sims />);
    expect(useApiMock).toHaveBeenCalledWith("/api/sims");
    expect(useApiMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/search?source=sims"));
    expect(screen.getByTestId("sims")).toBeInTheDocument();
    expect(screen.getByText("Vector Lab")).toBeInTheDocument();
    const row = screen.getByTestId("catalog-row");
    const link = row.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toContain("pratyakshsims.com");
    // No SIM0xxx subject chips.
    for (const chip of screen.queryAllByTestId("subject-chip")) {
      expect(chip.textContent ?? "").not.toMatch(/^SIM\d/);
    }
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Sims />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("sims")).toBeInTheDocument();
  });
  it("empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { sims: [], total: 0 }, loading: false, error: null });
    render(<Sims />);
    expect(screen.getByTestId("catalog-empty")).toBeInTheDocument();
  });
});
