import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Pipelines from "./index";

const data = { pipelines: [{
  pipeline: "textbook", label: "Lectures (textbook)", created: "x", updated: "y", current: "approve",
  phases: {
    draft: { status: "done", owner: "codex", gate: false, started: null, finished: null, artifacts: [], error: null },
    approve: { status: "awaiting_gate", owner: "human", gate: true, started: null, finished: null, artifacts: [], error: null },
  },
}] };

describe("Pipelines app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/pipelines + /api/org and resolves owner tokens to display names", () => {
    const org = { owners: { codex: { name: "Codex", role: "Reviewer" } } };
    useApiMock.mockImplementation((p: string) =>
      p === "/api/org"
        ? { data: org, loading: false, error: null }
        : { data, loading: false, error: null });
    render(<Pipelines />);
    expect(useApiMock).toHaveBeenCalledWith("/api/pipelines");
    expect(useApiMock).toHaveBeenCalledWith("/api/org");
    expect(screen.getByTestId("pipelines")).toBeInTheDocument();
    expect(screen.getByText("Lectures (textbook)")).toBeInTheDocument();
    expect(screen.getAllByTestId("phase")).toHaveLength(2);
    // owner token "codex" rendered as the display name "Codex" (not the raw token)
    expect(screen.getAllByTestId("phase")[0]).toHaveTextContent("· Codex");
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 503" });
    render(<Pipelines />);
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 503");
    expect(screen.getByTestId("pipelines")).toBeInTheDocument();
  });
  it("loading aria-busy, empty no crash", () => {
    useApiMock.mockReturnValue({ data: null, loading: true, error: null });
    render(<Pipelines />);
    expect(screen.getByTestId("pipeline-grid")).toHaveAttribute("aria-busy", "true");
  });
});
