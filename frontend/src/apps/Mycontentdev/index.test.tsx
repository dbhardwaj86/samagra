import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
const useApiMock = vi.fn();
vi.mock("../../hooks/useApi", () => ({ useApi: (p: string) => useApiMock(p) }));
import Mcd from "./index";

const data = { results: [
  { uid: "s1", source: "mycontentdev", kind: "concept", title: "Seed A", subject: null,
    unit: null, chapter: null, status: "captured", path: null, url: "x", updated_at: null, meta: {} },
] };

describe("mycontentdev app", () => {
  beforeEach(() => useApiMock.mockReset());
  it("calls /api/search?source=mycontentdev and lists seeds", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Mcd />);
    expect(useApiMock).toHaveBeenCalledWith("/api/search?source=mycontentdev&limit=200");
    expect(screen.getByTestId("mycontentdev")).toBeInTheDocument();
    expect(screen.getByText("Seed A")).toBeInTheDocument();
  });
  it("creds-gated empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Mcd />);
    expect(screen.getByTestId("catalog-empty")).toHaveTextContent(/creds/i);
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Mcd />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("mycontentdev")).toBeInTheDocument();
  });
  it("captures a seed", async () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, seed: { id: "s1", status: "captured" } }),
        { status: 200, headers: { "content-type": "application/json" } }));
    render(<Mcd />);
    fireEvent.change(screen.getByTestId("seed-type"), { target: { value: "rough_idea" } });
    fireEvent.change(screen.getByLabelText("raw_text"), { target: { value: "tidal locking demo" } });
    fireEvent.click(screen.getByTestId("seed-submit"));
    await waitFor(() => expect(spy).toHaveBeenCalledWith("/api/mcd/seeds", expect.objectContaining({ method: "POST" })));
    spy.mockRestore();
  });
});
