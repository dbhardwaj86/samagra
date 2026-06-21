import { fireEvent, render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Questions from "./index";

const questions = { results: [
  { q_uid: "q1", slug: "s1", q_type: "integer", subject: "Physics", chapter: "1",
    difficulty: "easy", text: "A block of mass…" },
] };
const facets = { sources: ["qx"], kinds: ["question"], subjects: ["Physics", "Chemistry"] };

// Route the mock per path: facets payload for /api/facets, questions payload for the rest.
function wire(opts: { qData?: unknown; loading?: boolean; error?: string | null } = {}) {
  useApiMock.mockImplementation((p: string) =>
    p === "/api/facets"
      ? { data: facets, loading: false, error: null }
      : { data: opts.qData ?? questions, loading: opts.loading ?? false, error: opts.error ?? null });
}

describe("Questions app", () => {
  // Brace the body so beforeEach returns undefined — mockReset() returns the mock,
  // and a function returned from beforeEach would be (wrongly) run as a teardown hook.
  beforeEach(() => { useApiMock.mockReset(); });

  it("calls /api/questions and lists rows", () => {
    wire();
    render(<Questions />);
    expect(useApiMock).toHaveBeenCalledWith("/api/questions?limit=50");
    expect(screen.getByTestId("questions")).toBeInTheDocument();
    expect(screen.getByTestId("question-row")).toHaveTextContent("A block of mass…");
  });

  it("fetches /api/facets and renders a subject chip per facet subject", () => {
    wire();
    render(<Questions />);
    expect(useApiMock).toHaveBeenCalledWith("/api/facets");
    const chips = screen.getAllByTestId("subject-chip");
    expect(chips.map((c) => c.textContent)).toEqual(["Physics", "Chemistry"]);
  });

  it("selecting a subject bakes it into the /api/questions path so the list refetches", () => {
    wire();
    render(<Questions />);
    useApiMock.mockClear();   // ignore the initial-mount fetch; assert on the click-driven refetch
    fireEvent.click(screen.getByRole("button", { name: "Physics" }));
    expect(useApiMock).toHaveBeenCalledWith("/api/questions?subject=Physics&limit=50");
  });

  it("re-selecting the active subject clears the filter back to the base path", () => {
    wire();
    render(<Questions />);
    const physics = screen.getByRole("button", { name: "Physics" });
    fireEvent.click(physics);   // select Physics
    useApiMock.mockClear();
    fireEvent.click(physics);   // deselect → back to no filter
    expect(useApiMock).toHaveBeenCalledWith("/api/questions?limit=50");
    expect(useApiMock).not.toHaveBeenCalledWith("/api/questions?subject=Physics&limit=50");
  });

  it("QX-absent in-body error shows a notice; still mounts", () => {
    wire({ qData: { results: [], error: "QX source not present" } });
    render(<Questions />);
    expect(screen.getByTestId("questions-notice")).toHaveTextContent(/QX/);
    expect(screen.getByTestId("questions")).toBeInTheDocument();
  });

  it("empty (no error key) still renders empty state", () => {
    wire({ qData: { results: [] } });
    render(<Questions />);
    expect(screen.getByTestId("questions-empty")).toBeInTheDocument();
  });
});
