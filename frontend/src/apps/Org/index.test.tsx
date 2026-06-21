import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Org from "./index";

const org = {
  chairman: { id: "deepak", name: "Deepak Bhardwaj", role: "Founder & Chairman" },
  board: [{ id: "claude-deepak", name: "Claude-Deepak", role: "CEO" }],
  workers: [{ id: "gemini", name: "Gemini", role: "Research" }],
  owners: { codex: { name: "Codex", role: "Reviewer" } },
};

describe("Org app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/org and renders the hierarchy + owner roster", () => {
    useApiMock.mockReturnValue({ data: org, loading: false, error: null });
    render(<Org />);
    expect(useApiMock).toHaveBeenCalledWith("/api/org");
    expect(screen.getByTestId("org")).toBeInTheDocument();
    expect(screen.getByText("Deepak Bhardwaj")).toBeInTheDocument();
    expect(screen.getByText("Claude-Deepak")).toBeInTheDocument();
    expect(screen.getByText("Gemini")).toBeInTheDocument();
    expect(screen.getByTestId("org-owners")).toHaveTextContent("Codex");
  });
  it("renders error inline and still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Org />);
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 500");
    expect(screen.getByTestId("org")).toBeInTheDocument();
  });
  it("empty/loading: aria-busy, no crash", () => {
    useApiMock.mockReturnValue({ data: null, loading: true, error: null });
    render(<Org />);
    expect(screen.getByTestId("org-tree")).toHaveAttribute("aria-busy", "true");
  });
});
