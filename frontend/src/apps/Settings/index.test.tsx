// E1.20 RED — Settings smoke (api.md §2 Settings + proto.md §6 themes).
// The Settings app is a THIN presentational wrapper over the client-only theme
// store: Appearance radios mutate `theme`/`device` via the store actions, and the
// Integration rows render from `/api/overview` `sources[].available` (0/1 →
// active/needs-creds pills). The per-pixel Aqua/console/samagra parity is a
// separate human QA pass and is NOT tested here.
//
// The ONE behavioural assertion the loop gates on (the headless residue):
//   clicking the console theme radio calls `setTheme('console')`.
//
// Boundary mocking, mirroring the Dashboard smoke (E1.19):
//  - `../../App` exports the singleton `themeStore` — we replace it with a real
//    zustand-vanilla store whose `setTheme` is a `vi.fn` spy, so the click path is
//    pinned without dragging in the whole shell tree.
//  - `../../hooks/useApi` is stubbed to return a canned `/api/overview` so the
//    integration rows render deterministically (no network).
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- theme store boundary (../../App) ---------------------------------------
// A real vanilla store (so `useStore` subscriptions work) with spy actions. The
// console theme radio under test must call `setTheme('console')`.
// `vi.hoisted` so the store + spies exist when the hoisted `vi.mock` factory runs
// (a plain top-level const would be in its TDZ at factory-eval time). `createStore`
// is imported INSIDE the factory because a static import binding is itself in its
// TDZ when the hoisted block executes.
const { setTheme, setDevice, themeStore } = await vi.hoisted(async () => {
  const { createStore } = await import("zustand/vanilla");
  const setTheme = vi.fn();
  const setDevice = vi.fn();
  const themeStore = createStore(() => ({
    theme: "aqua" as const,
    device: "pc" as const,
    setTheme,
    setDevice,
  }));
  return { setTheme, setDevice, themeStore };
});

vi.mock("../../App", () => ({
  // Settings reads the singleton theme store from the shell assembly.
  themeStore,
}));

// --- /api/overview boundary (../../hooks/useApi) ----------------------------
// Canned overview: one available source (active pill) + one unavailable
// (needs-creds pill), per api.md §2 Settings (sources[].available 0/1).
const OVERVIEW = {
  refreshed_at: "2026-06-20T00:00:00Z",
  sources: [
    { source: "qx", label: "QX", available: 1, n_artifacts: 4000 },
    { source: "munshi", label: "Munshi", available: 0, n_artifacts: 0 },
  ],
};

vi.mock("../../hooks/useApi", () => ({
  useApi: vi.fn(() => ({ data: OVERVIEW, error: null, loading: false })),
}));

// Import AFTER the mocks are registered so Settings binds the mocked modules.
import Settings from "./index";

beforeEach(() => {
  setTheme.mockClear();
  setDevice.mockClear();
  themeStore.setState({ theme: "aqua", device: "pc", setTheme, setDevice });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Settings (E1.20 smoke)", () => {
  it("clicking the console theme radio calls setTheme('console')", () => {
    render(<Settings />);

    // The console theme appearance control — addressed by its accessible name.
    const consoleRadio = screen.getByRole("radio", { name: /console/i });
    fireEvent.click(consoleRadio);

    expect(setTheme).toHaveBeenCalledWith("console");
  });
});
