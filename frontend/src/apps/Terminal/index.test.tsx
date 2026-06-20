// E1.21 RED — Terminal smoke (proto.md §4 Terminal + §6.4 termPalette).
// The Terminal app is a THIN presentational wrapper over the pure `lib/terminal`
// engine (parser + dispatch, already green in E1.8/E1.9). The wrapper feeds input
// → parse → dispatch → renders the returned `lines` and **executes the returned
// `effects`** (openApp / setTheme / setDevice) against the singleton WM / theme
// stores. Per-pixel Aqua/console/samagra parity (colors, JetBrains Mono, prompt
// chrome) is a separate human QA pass and is NOT tested here.
//
// The ONE behavioural assertion the loop gates on (the headless residue):
//   submitting `open snake` + Enter triggers the WM `openApp` effect → the WM
//   store gains a `snake` window.
//
// Boundary mocking, mirroring the Settings/Dashboard smokes (E1.19/E1.20):
//  - `../../App` exports the singletons `wmStore` + `themeStore` — we replace them
//    with real zustand-vanilla stores so `useStore` subscriptions work. The WM
//    store's `openApp` is a `vi.fn` spy that ALSO pushes a real `snake` window, so
//    the effect-runner path is pinned both by the spy call AND by the resulting
//    store state (the plan's literal "WM store gains a snake window").
//  - `vi.hoisted` so the stores + spies exist when the hoisted `vi.mock` factory
//    runs; `createStore` is imported INSIDE the factory because a static import
//    binding is itself in its TDZ when the hoisted block executes.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppId } from "../../types/contracts";

// --- WM + theme store boundary (../../App) -----------------------------------
const { openApp, setTheme, setDevice, wmStore, themeStore } = await vi.hoisted(
  async () => {
    const { createStore } = await import("zustand/vanilla");

    // openApp spy that ALSO mutates the store so `windows` reflects the effect.
    const openApp = vi.fn((id: string) => {
      wmStore.setState((s: { windows: { id: string; app: string }[] }) => ({
        windows: s.windows.some((w) => w.app === id)
          ? s.windows
          : [...s.windows, { id: `w-${id}`, app: id }],
      }));
    });
    const setTheme = vi.fn();
    const setDevice = vi.fn();

    const wmStore = createStore(() => ({
      windows: [] as { id: string; app: string }[],
      z: 0,
      openApp,
    }));
    const themeStore = createStore(() => ({
      theme: "aqua" as const,
      device: "pc" as const,
      setTheme,
      setDevice,
    }));

    return { openApp, setTheme, setDevice, wmStore, themeStore };
  },
);

vi.mock("../../App", () => ({ wmStore, themeStore }));

// Import AFTER the mocks are registered so Terminal binds the mocked stores.
import Terminal from "./index";

beforeEach(() => {
  openApp.mockClear();
  setTheme.mockClear();
  setDevice.mockClear();
  wmStore.setState({ windows: [], z: 0, openApp });
  themeStore.setState({ theme: "aqua", device: "pc", setTheme, setDevice });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Terminal (E1.21 smoke)", () => {
  it("submitting `open snake` triggers the WM openApp effect → a snake window", () => {
    render(<Terminal />);

    // The single command-line input — addressed by its textbox role.
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "open snake" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    // (a) the effect ran: openApp('snake')
    expect(openApp).toHaveBeenCalledWith("snake");

    // (b) the plan's literal residue: the WM store gains a snake window.
    const windows = wmStore.getState().windows as { app: AppId }[];
    expect(windows.some((w) => w.app === "snake")).toBe(true);
  });
});
