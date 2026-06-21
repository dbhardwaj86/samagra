import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Munshi from "./index";

const data = { results: [
  { uid: "m1", source: "munshi", kind: "todo", title: "Call vendor", subject: null,
    unit: null, chapter: null, status: "open", path: null, url: null, updated_at: null, meta: {} },
] };

describe("Munshi app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("reads /api/munshi/library (live) and lists items", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Munshi />);
    expect(useApiMock).toHaveBeenCalledWith("/api/munshi/library");
    expect(screen.getByTestId("munshi")).toBeInTheDocument();
    expect(screen.getByText("Call vendor")).toBeInTheDocument();
  });
  it("creds-gated empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Munshi />);
    expect(screen.getByTestId("catalog-empty")).toHaveTextContent(/creds|available/i);
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Munshi />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("munshi")).toBeInTheDocument();
  });
});

describe("Munshi capture composer", () => {
  beforeEach(() => {
    useApiMock.mockReset();
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    vi.spyOn(globalThis, "fetch").mockImplementation((url) =>
      Promise.resolve(new Response(
        String(url).includes("/api/munshi/capture")
          ? JSON.stringify({ ok: true, item: { item_id: 1 } })
          : JSON.stringify({ results: [] }),
        { status: 200, headers: { "content-type": "application/json" } })));
  });
  it("captures a todo", async () => {
    render(<Munshi />);
    fireEvent.change(screen.getByTestId("capture-kind"), { target: { value: "todo" } });
    fireEvent.change(screen.getByLabelText("assignee"), { target: { value: "Ravi" } });
    fireEvent.change(screen.getByLabelText("task"), { target: { value: "Call parent" } });
    fireEvent.click(screen.getByTestId("capture-submit"));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith("/api/munshi/capture", expect.objectContaining({ method: "POST" })));
  });
});
