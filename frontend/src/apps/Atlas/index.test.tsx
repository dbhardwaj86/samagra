import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Atlas from "./index";

const data = {
  lanes: ["paper", "samadhan"],
  concepts: [{ concept_id: 1, label: "gauss law", chapter_id: "physics.electrostatics", demand_size: 700, paper_count: 50 }],
  cells: [
    { concept_id: 1, lane: "paper", state: "base", produced_n: 0, base_n: 50 },
    { concept_id: 1, lane: "samadhan", state: "gap", produced_n: 0, base_n: 0 },
  ],
  gaps: [{ rank: 1, concept_id: 1, lane: "samadhan", cell_state: "gap", demand_size: 700,
           existing_corpus_n: 0, deficit_score: 700, suggested_seed_ref: "textbook:gauss-law",
           plan_command: "samagra factory plan textbook:gauss-law --lane samadhan" }],
  meta: {},
};

describe("Atlas app", () => {
  beforeEach(() => useApiMock.mockReset());

  it("fetches /api/coverage and renders the heatmap + gap queue", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Atlas />);
    expect(useApiMock).toHaveBeenCalledWith("/api/coverage");
    expect(screen.getByTestId("atlas")).toBeInTheDocument();
    expect(screen.getByText("gauss law")).toBeInTheDocument();
    expect(screen.getByText(/factory plan textbook:gauss-law --lane samadhan/)).toBeInTheDocument();
  });

  it("shows the not-built hint when the API returns an error payload", () => {
    useApiMock.mockReturnValue({ data: { ...data, concepts: [], gaps: [], error: "not built" }, loading: false, error: null });
    render(<Atlas />);
    expect(screen.getByTestId("atlas")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("not built");
  });

  it("loading sets aria-busy", () => {
    useApiMock.mockReturnValue({ data: null, loading: true, error: null });
    render(<Atlas />);
    expect(screen.getByTestId("atlas-grid")).toHaveAttribute("aria-busy", "true");
  });
});
