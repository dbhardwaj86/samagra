import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Questions from "./index";

const payload = {
  results: [{
    q_uid: "q1", slug: "s1", q_type: "integer", subject: "physics", chapter: "Kinematics",
    difficulty: "easy", snippet: "a projectile [fig]",
    html: '<div class="stem">a projectile is launched '
        + '<span class="ktx" data-tex="\\sqrt{2}"></span></div>',
  }],
  total: 1, page: 1, page_size: 25, mode: "exact", degraded: false,
  facets: {
    subject: [["physics", 1]], chapter: [["Kinematics", 1]], qtype: [["integer", 1]],
  },
};

type Opts = { data?: unknown; loading?: boolean; error?: string | null };
function wire(opts: Opts = {}) {
  useApiMock.mockImplementation(() => ({
    data: opts.data ?? payload, loading: opts.loading ?? false, error: opts.error ?? null,
  }));
}

describe("Questions app (QX-backed)", () => {
  beforeEach(() => { useApiMock.mockReset(); });

  it("calls /api/questions (exact by default) and renders the QX-rendered HTML", () => {
    wire();
    render(<Questions />);
    expect(useApiMock).toHaveBeenCalledWith("/api/questions?mode=exact");
    expect(screen.getByTestId("questions")).toBeInTheDocument();
    expect(screen.getByTestId("question-row").innerHTML).toContain("stem");
    // raw LaTeX source must NOT be printed as text
    expect(screen.getByTestId("question-row").textContent).not.toContain("$");
  });

  it("typesets maths via KaTeX (the data-tex span becomes a .katex render)", async () => {
    wire();
    render(<Questions />);
    await waitFor(() => {
      const ktx = document.querySelector(".ktx");
      expect(ktx && ktx.querySelector(".katex")).toBeTruthy();
    });
  });

  it("switching to semantic refetches with mode=semantic", () => {
    wire();
    render(<Questions />);
    useApiMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /semantic/i }));
    expect(useApiMock).toHaveBeenCalledWith("/api/questions?mode=semantic");
  });

  it("submitting a query bakes q into the path", () => {
    wire();
    render(<Questions />);
    useApiMock.mockClear();
    fireEvent.change(screen.getByTestId("q-input"), { target: { value: "projectile" } });
    fireEvent.submit(screen.getByTestId("q-form"));
    expect(useApiMock).toHaveBeenCalledWith("/api/questions?q=projectile&mode=exact");
  });

  it("a subject facet chip filters the path", () => {
    wire();
    render(<Questions />);
    useApiMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "physics" }));
    expect(useApiMock).toHaveBeenCalledWith("/api/questions?mode=exact&subject=physics");
  });

  it("re-clicking the active subject clears it", () => {
    wire();
    render(<Questions />);
    const phys = screen.getByRole("button", { name: "physics" });
    fireEvent.click(phys);
    useApiMock.mockClear();
    fireEvent.click(phys);
    expect(useApiMock).toHaveBeenCalledWith("/api/questions?mode=exact");
  });

  it("shows a degraded note when semantic fell back to exact", () => {
    wire({ data: { ...payload, mode: "exact", degraded: true } });
    render(<Questions />);
    expect(screen.getByTestId("questions-degraded")).toBeInTheDocument();
  });

  it("backend-unavailable error shows a notice; still mounts", () => {
    wire({ data: {
      results: [], total: 0, page: 1, page_size: 0, mode: "exact",
      degraded: false, facets: {}, error: "questions backend unavailable",
    } });
    render(<Questions />);
    expect(screen.getByTestId("questions-notice")).toHaveTextContent(/unavailable/i);
    expect(screen.getByTestId("questions")).toBeInTheDocument();
  });

  it("sanitizes a hostile QX payload before injecting it (W1.2 XSS)", () => {
    wire({ data: { ...payload, results: [{
      ...payload.results[0],
      html: '<div class="stem">pwned</div><img src="x" onerror="window.__xss=1">'
          + '<script>window.__xss=1</script>',
    }] } });
    render(<Questions />);
    const row = screen.getByTestId("question-row");
    expect(row.innerHTML).toContain("pwned");          // safe content survives
    expect(row.innerHTML.toLowerCase()).not.toContain("onerror");
    expect(row.innerHTML.toLowerCase()).not.toContain("<script");
  });

  it("empty results render the empty state", () => {
    wire({ data: {
      results: [], total: 0, page: 1, page_size: 25, mode: "exact", degraded: false, facets: {},
    } });
    render(<Questions />);
    expect(screen.getByTestId("questions-empty")).toBeInTheDocument();
  });
});
