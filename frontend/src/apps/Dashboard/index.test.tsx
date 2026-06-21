// AP1 FIDELITY — Dashboard (README §Apps#1 Dashboard, #4f46e5 940×610).
// The Dashboard is the agentic-OS control-plane home. It reads `/api/overview`
// via the `useApi` typed fetch hook (the live Σ-artifacts headline) and renders
// the documented surface: a greeting header + "● 11/11 tests green" pill, a
// stat grid (auto-fill minmax(140px,1fr)), a Pipelines card of labeled progress
// bars, a Board card (avatars + green status dots) and a Recent-activity
// accent-left-border timeline.
//
// Two contracts are pinned here:
//   1. BEHAVIOUR (kept from E1.19): mock `fetch` → canned `/api/overview` → the
//      Σ-n_artifacts headline renders; error branches surface role=alert + 0.
//   2. FIDELITY (AP1, new): the exact documented tokens/markup —
//      auto-fill 140px stat grid, 25px/700 tabular-nums colored stat numbers,
//      labeled progress bars at the documented widths, theme-var driven colors
//      (no hardcoded per-theme value where the prototype used `t.*`), real
//      <svg> line-icons (NEVER letter badges) via the FD2 <Icon>, and the
//      accent-left-border activity timeline.
import { render, screen, waitFor, within } from "@testing-library/react";
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

// -------------------------------------------------------------------------- //
// BEHAVIOUR — the useApi fetch path + Σ headline + error branches (E1.19).    //
// -------------------------------------------------------------------------- //
describe("Dashboard (behaviour — useApi + headline)", () => {
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

  it("renders the Artifacts stat (Σ n_artifacts = 7,044) from the canned overview", async () => {
    render(<Dashboard />);
    // 7044 = 4000 + 3000 + 44 — the live total-artifacts headline number, grouped.
    expect(await screen.findByText("7,044")).toBeInTheDocument();
  });

  it("surfaces a non-2xx overview as an error and still renders a 0 artifacts stat (defensive)", async () => {
    // useApi error branch: !res.ok → error="HTTP 503"; Dashboard renders role=alert
    // and totalArtifacts(null) takes its Array.isArray-false branch → 0.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream down", { status: 503 })),
    );
    render(<Dashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 503");
    // The Artifacts stat falls back to "0" — scope to its labelled stat tile.
    const artifactsStat = await screen.findByTestId("stat-artifacts");
    expect(within(artifactsStat).getByText("0")).toBeInTheDocument();
  });

  it("surfaces a network/decode failure as an error (catch branch)", async () => {
    // useApi catch branch: fetch rejects → error=String(e). The Artifacts stat
    // falls back to 0 since no overview payload ever arrives.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    render(<Dashboard />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("network down");
    const artifactsStat = await screen.findByTestId("stat-artifacts");
    expect(within(artifactsStat).getByText("0")).toBeInTheDocument();
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — exact documented markup/tokens (AP1).                            //
// -------------------------------------------------------------------------- //
describe("Dashboard (fidelity — greeting + tests pill)", () => {
  it("renders the greeting header and sub-line verbatim", async () => {
    render(<Dashboard />);
    expect(await screen.findByText("Good morning, Deepak")).toBeInTheDocument();
    expect(
      screen.getByText(/SAMAGRA control plane · Phase 0 done · Phase 1 \(adapters\) next/),
    ).toBeInTheDocument();
  });

  it("renders the green '11/11 tests green' status pill in the success color #16a34a", async () => {
    render(<Dashboard />);
    const pill = await screen.findByTestId("tests-pill");
    expect(pill).toHaveTextContent("11/11 tests green");
    // success green is hardcoded in the prototype (#16a34a), NOT the theme accent.
    expect(pill).toHaveStyle({ color: "#16a34a" });
  });
});

describe("Dashboard (fidelity — header icon, FD2)", () => {
  it("renders a real <svg> line-icon in the header (never a letter badge)", async () => {
    render(<Dashboard />);
    const header = await screen.findByTestId("dashboard-header");
    // FD2: the dashboard glyph is the <Icon> 24×24 viewBox svg, not a text badge.
    const svg = header.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    // The header has NO text node acting as a badge (e.g. a bare "D"): the glyph
    // is the svg. (A letter badge would put a 1-char text node beside the title.)
    expect(within(header).queryByText(/^[A-Z]$/)).toBeNull();
  });

  it("paints the header glyph with the THEME accent via currentColor (FD1 + FD2)", async () => {
    render(<Dashboard />);
    const header = await screen.findByTestId("dashboard-header");
    const svg = header.querySelector("svg")!;
    // The icon inherits color (stroke=currentColor); its wrapper sets the theme
    // accent var, so the glyph tracks the active theme — not a fixed hex.
    expect(svg).toHaveAttribute("stroke", "currentColor");
    const wrapper = svg.parentElement as HTMLElement;
    expect(wrapper).toHaveStyle({ color: "var(--samagra-accent)" });
  });
});

describe("Dashboard (fidelity — stat grid, auto-fill 140)", () => {
  it("lays the stat grid out as auto-fill minmax(140px,1fr)", async () => {
    render(<Dashboard />);
    const grid = await screen.findByTestId("stat-grid");
    expect(grid).toHaveStyle({
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))",
    });
  });

  it("renders all six documented stats with their exact numbers and labels", async () => {
    render(<Dashboard />);
    // Numbers and labels are verbatim from the prototype's `stats` array.
    expect(await screen.findByText("7,044")).toBeInTheDocument();
    expect(screen.getByText("Artifacts catalogued")).toBeInTheDocument();
    expect(screen.getByText("67,276")).toBeInTheDocument();
    expect(screen.getByText("Questions (QX)")).toBeInTheDocument();
    expect(screen.getByText("59")).toBeInTheDocument();
    expect(screen.getByText("Chapters")).toBeInTheDocument();
    expect(screen.getByText("1,554")).toBeInTheDocument();
    expect(screen.getByText("Simulations")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("Booklets")).toBeInTheDocument();
    expect(screen.getByText("136")).toBeInTheDocument();
    expect(screen.getByText("INSP items")).toBeInTheDocument();
  });

  it("groups the live Σ-artifacts headline with commas deterministically (ICU-independent)", async () => {
    // The Artifacts headline is a pinned UI value (7,044). Grouping is done with a
    // manual regex — NOT toLocaleString — so it renders "7,044" identically even on
    // a small-icu / ICU-less Node build (where toLocaleString may emit "7044").
    render(<Dashboard />);
    // Await the async Σ value first (the headline comes from the mocked /api/overview
    // fetch). `findByTestId` resolves on the always-present tile before the fetch
    // settles, so a synchronous getByText("7,044") was racy under full-suite load —
    // await the grouped text, then do the exact sync checks.
    const artifactsStat = await screen.findByTestId("stat-artifacts");
    expect(await within(artifactsStat).findByText("7,044")).toBeInTheDocument();
    // Exact match: the comma-grouped form is present, the un-grouped "7044" is not.
    expect(within(artifactsStat).queryByText("7044")).toBeNull();
  });

  it("renders stat numbers at 25px/700 with tabular-nums, in the documented colors", async () => {
    render(<Dashboard />);
    // Artifacts stat number is the THEME accent (var) — verify the value node.
    const artifactsStat = await screen.findByTestId("stat-artifacts");
    const value = within(artifactsStat).getByText("7,044");
    expect(value).toHaveStyle({
      fontSize: "25px",
      fontWeight: "700",
      fontVariantNumeric: "tabular-nums",
    });
    // Artifacts uses the theme accent (driven by the CSS var, not a fixed hex).
    expect(value).toHaveStyle({ color: "var(--samagra-accent)" });

    // Questions (QX) stat number is the hardcoded info-blue #2563eb (prototype).
    const questionsStat = screen.getByTestId("stat-questions");
    expect(within(questionsStat).getByText("67,276")).toHaveStyle({ color: "#2563eb" });

    // The stat TILE surface (not just the lower cards) is theme-var driven (FD1):
    // card background + 1px theme line read the active theme, so the tiles are
    // correct in aqua, console AND samagra.
    expect(artifactsStat).toHaveStyle({
      background: "var(--samagra-card-bg)",
      borderColor: "var(--samagra-line)",
    });
  });
});

describe("Dashboard (fidelity — Pipelines progress bars)", () => {
  it("renders the four documented pipelines with labels and percentages", async () => {
    render(<Dashboard />);
    const section = await screen.findByTestId("pipelines");
    expect(within(section).getByText("Pipelines")).toBeInTheDocument();
    expect(within(section).getByText("Lectures · thin/thick")).toBeInTheDocument();
    expect(within(section).getByText("74%")).toBeInTheDocument();
    expect(within(section).getByText("Questions · QX")).toBeInTheDocument();
    expect(within(section).getByText("91%")).toBeInTheDocument();
    expect(within(section).getByText("Print & Proofing")).toBeInTheDocument();
    expect(within(section).getByText("46%")).toBeInTheDocument();
    expect(within(section).getByText("Editorial seeds")).toBeInTheDocument();
    expect(within(section).getByText("33%")).toBeInTheDocument();
  });

  it("exposes each bar as an accessible progressbar with the documented fill width", async () => {
    render(<Dashboard />);
    const section = await screen.findByTestId("pipelines");
    const lectures = within(section).getByRole("progressbar", { name: /Lectures · thin\/thick/ });
    expect(lectures).toHaveAttribute("aria-valuenow", "74");
    // The visible fill element is widened to the documented percentage.
    const fill = within(lectures).getByTestId("bar-fill");
    expect(fill).toHaveStyle({ width: "74%" });
  });
});

describe("Dashboard (fidelity — Board avatars + green dots)", () => {
  it("renders the three board members with role + green status dots", async () => {
    render(<Dashboard />);
    const board = await screen.findByTestId("board");
    expect(within(board).getByText("Board — review & approval")).toBeInTheDocument();
    expect(within(board).getByText("Claude-Deepak")).toBeInTheDocument();
    expect(within(board).getByText("CEO")).toBeInTheDocument();
    expect(within(board).getByText("Claude-Khanak")).toBeInTheDocument();
    expect(within(board).getByText("COO")).toBeInTheDocument();
    expect(within(board).getByText("Claude-Codex")).toBeInTheDocument();
    expect(within(board).getByText("Architect")).toBeInTheDocument();

    // Each member has a status dot painted the success green #16a34a.
    const dots = within(board).getAllByTestId("status-dot");
    expect(dots).toHaveLength(3);
    dots.forEach((d) => expect(d).toHaveStyle({ background: "#16a34a" }));
  });
});

describe("Dashboard (fidelity — Recent activity timeline)", () => {
  it("renders the activity entries with an accent left-border timeline", async () => {
    render(<Dashboard />);
    const activity = await screen.findByTestId("activity");
    expect(within(activity).getByText("Recent activity")).toBeInTheDocument();
    expect(
      within(activity).getByText("Phase 0 complete — package renamed to samagra"),
    ).toBeInTheDocument();
    expect(
      within(activity).getByText("samagra.db rebuilt → 7,044 artifacts"),
    ).toBeInTheDocument();

    // The timeline rows carry a 2px accent-colored left border (var-driven).
    const rows = within(activity).getAllByTestId("activity-row");
    expect(rows.length).toBeGreaterThanOrEqual(3);
    rows.forEach((r) => {
      expect(r).toHaveStyle({ borderLeftWidth: "2px", borderLeftStyle: "solid" });
      // FD1: the accent left border is driven by the theme var (not a fixed hex),
      // so the timeline recolors per theme (aqua/console/samagra). The prototype
      // paints it at 50% alpha (`hex(accent,0.5)`) — modelled with `color-mix`
      // over the accent var, the codebase's accent-alpha pattern (cf. Card/Pill).
      expect(r).toHaveStyle({
        borderLeftColor: "color-mix(in srgb, var(--samagra-accent) 50%, transparent)",
      });
    });
  });
});

describe("Dashboard (E3 — responsive narrow grid, HIGH#2)", () => {
  it("lays the lower Pipelines/Board area out as an auto-fit grid that reflows when narrow", async () => {
    // HIGH#2: the lower area was a fixed `1.4fr 1fr` two-column grid that never
    // reflowed, so at a narrow window / mobile (392px) both columns squished into
    // an unreadable ~190px. It is now `repeat(auto-fit,minmax(260px,1fr))` — two
    // columns when wide, a single stacked column once the container falls below
    // ~534px. Pins the responsive template (the stat grid is already auto-fill).
    render(<Dashboard />);
    const lower = await screen.findByTestId("dashboard-lower");
    expect(lower).toHaveStyle({
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
    });
  });
});

describe("Dashboard (fidelity — theme-driven surface)", () => {
  it("drives card surfaces from theme CSS vars (no hardcoded per-theme value)", async () => {
    render(<Dashboard />);
    const pipelines = await screen.findByTestId("pipelines");
    // Cards read the active theme's card background + 1px line via CSS vars (FD1),
    // so the surface is correct in aqua, console AND samagra.
    expect(pipelines).toHaveStyle({
      background: "var(--samagra-card-bg)",
      borderColor: "var(--samagra-line)",
    });
  });
});
