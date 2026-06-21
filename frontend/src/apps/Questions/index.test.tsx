import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Questions from "./index";

const data = { results: [
  { q_uid: "q1", slug: "s1", q_type: "integer", subject: "Physics", chapter: "1",
    difficulty: "easy", text: "A block of mass…" },
] };

describe("Questions app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/questions and lists rows", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Questions />);
    expect(useApiMock).toHaveBeenCalledWith("/api/questions?limit=50");
    expect(screen.getByTestId("questions")).toBeInTheDocument();
    expect(screen.getByTestId("question-row")).toHaveTextContent("A block of mass…");
  });
  it("QX-absent in-body error shows a notice; still mounts", () => {
    useApiMock.mockReturnValue({ data: { results: [], error: "QX source not present" }, loading: false, error: null });
    render(<Questions />);
    expect(screen.getByTestId("questions-notice")).toHaveTextContent(/QX/);
    expect(screen.getByTestId("questions")).toBeInTheDocument();
  });
  it("empty (no error key) still renders empty state", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Questions />);
    expect(screen.getByTestId("questions-empty")).toBeInTheDocument();
  });
});
