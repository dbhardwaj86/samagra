import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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
  it("reads /api/mcd/seeds (live) and lists seeds", () => {
    useApiMock.mockReturnValue({ data, loading: false, error: null });
    render(<Mcd />);
    expect(useApiMock).toHaveBeenCalledWith("/api/mcd/seeds");
    expect(screen.getByTestId("mycontentdev")).toBeInTheDocument();
    expect(screen.getByText("Seed A")).toBeInTheDocument();
  });
  it("creds-gated empty state when no rows", () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    render(<Mcd />);
    expect(screen.getByTestId("catalog-empty")).toHaveTextContent(/available|adminKey/i);
  });
  it("error inline + still mounts", () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: "HTTP 500" });
    render(<Mcd />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("mycontentdev")).toBeInTheDocument();
  });
  it("surfaces an upstream read error (200 body) instead of the misleading creds empty-state (F1)", () => {
    // /api/mcd/seeds returns 200 {results:[], error} on an upstream read failure,
    // so useApi's hook error is null. The empty-state must show the real read
    // error, not the "set mcd-cloud.json adminKey" line.
    useApiMock.mockReturnValue({ data: { results: [], error: "mycontentdev read failed" }, loading: false, error: null });
    render(<Mcd />);
    expect(screen.getByTestId("catalog-empty")).toHaveTextContent("mycontentdev read failed");
    expect(screen.getByTestId("catalog-empty")).not.toHaveTextContent(/adminKey/i);
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
  it("ignores rapid double-submit (no duplicate production write)", async () => {
    useApiMock.mockReturnValue({ data: { results: [] }, loading: false, error: null });
    let resolve!: (r: Response) => void;
    const spy = vi.spyOn(globalThis, "fetch").mockReturnValue(
      new Promise<Response>((r) => { resolve = r; }) as Promise<Response>);
    render(<Mcd />);
    fireEvent.change(screen.getByLabelText("raw_text"), { target: { value: "dup demo" } });
    const btn = screen.getByTestId("seed-submit");
    // Two clicks in the SAME synchronous tick — before React re-renders and the
    // disabled={posting} flag can take effect. This is the production race
    // (Enter+click / rapid double-click). A ref guard must block the second.
    act(() => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(spy).toHaveBeenCalledTimes(1);
    resolve(new Response(JSON.stringify({ ok: true, seed: { id: "s1", status: "captured" } }),
      { status: 200, headers: { "content-type": "application/json" } }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    spy.mockRestore();
  });
});
