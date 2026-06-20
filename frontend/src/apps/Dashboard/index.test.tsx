// E1.19 RED — Dashboard smoke (api.md §2 Dashboard + §3 headline numbers).
// The Dashboard is a THIN presentational wrapper: it reads `/api/overview` via the
// `useApi` typed fetch hook and renders hero stats. The ONE behavioural assertion the
// loop gates on: mock `fetch` → canned `/api/overview` → a hero stat renders.
// Layout / density / pixel parity is a separate human QA pass (NOT tested here).
//
// Hero stat under test — Artifacts (total) = Σ sources[].n_artifacts (api.md §3,
// "Dashboard headline numbers"). The per-source `summary` shape is heterogeneous and
// must be read defensively; this RED test only pins the flat headline that always exists.
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./index";

// Canned /api/overview payload (api.md §2: sources[].{n_artifacts, available, summary}).
// Σ n_artifacts = 4000 + 3000 + 44 = 7044 (the live catalog count) → the Artifacts hero stat.
const OVERVIEW = {
  refreshed_at: "2026-06-20T00:00:00Z",
  sources: [
    {
      source: "qx",
      label: "QX",
      available: 1,
      n_artifacts: 4000,
      refreshed_at: "2026-06-20T00:00:00Z",
      summary: { questions: 12345, documents: 678 },
    },
    {
      source: "textbook",
      label: "physics-textbook",
      available: 1,
      n_artifacts: 3000,
      refreshed_at: "2026-06-20T00:00:00Z",
      summary: { chapters: 42, units: 9, by_status: { done: 30, queued: 12 } },
    },
    {
      source: "sims",
      label: "pratyaksh",
      available: 1,
      n_artifacts: 44,
      refreshed_at: "2026-06-20T00:00:00Z",
      summary: { sims: 44 },
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/overview")) {
        return new Response(JSON.stringify(OVERVIEW), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      // pipelines / assignments are optional for the hero-stat smoke — return empty shells.
      if (url.includes("/api/pipelines")) {
        return new Response(JSON.stringify({ pipelines: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/api/assignments")) {
        return new Response(JSON.stringify({ assignments: [], events: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Dashboard (E1.19 smoke)", () => {
  it("fetches /api/overview on mount", async () => {
    render(<Dashboard />);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    const calledOverview = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
      (c) => String(c[0]).includes("/api/overview"),
    );
    expect(calledOverview).toBe(true);
  });

  it("renders the Artifacts hero stat (Σ n_artifacts = 7044) from the canned overview", async () => {
    render(<Dashboard />);
    // 7044 = 4000 + 3000 + 44 — the live total-artifacts headline number.
    expect(await screen.findByText("7044")).toBeInTheDocument();
  });

  it("surfaces a non-2xx overview as an error and still renders a 0 hero stat (defensive)", async () => {
    // useApi error branch: !res.ok → error="HTTP 503"; Dashboard renders role=alert
    // and totalArtifacts(null) takes its Array.isArray-false branch → 0.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream down", { status: 503 })),
    );
    render(<Dashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 503");
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("surfaces a network/decode failure as an error (catch branch)", async () => {
    // useApi catch branch: fetch rejects → error=String(e). The hero stat falls
    // back to 0 since no overview payload ever arrives.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    render(<Dashboard />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("network down");
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
