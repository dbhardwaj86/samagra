// AP2 FIDELITY — Settings (README §Apps#17 Settings, #475569 760×580).
// Settings is the production home for theme + device switching. The surface is a
// VERBATIM port of the prototype's `app_settings` (.dc.html ~L490):
//   • Appearance — 3 theme swatch cards (repeat(3,1fr) grid, gap 10). Each card is
//     padding 4 / radius 12 with a 2px border (accent when selected, else
//     transparent); the inner swatch is height 64 / radius 9 painted with the
//     theme's gradient; the centred label is 12px/600 (accent when selected).
//     Clicking a card calls `setTheme(id)` — this IS the real switcher.
//   • Device — a 2-cell segmented toggle (Desktop=pc / Mobile=mobile), gap 8.
//     The selected cell is accent-tinted (bg color-mix accent 13% / accent text /
//     accent-13% border); clicking calls `setDevice(value)`.
//   • Integrations — the prototype's 5 fixed status rows (cardBg / 1px line /
//     radius 10 / padding 11px 13px), each a label + a status Pill: the three
//     "needs OK"/"creds" rows in the warning color #d97706, the two "active" rows
//     in the success color #16a34a.
//
// Two contracts are pinned:
//   1. BEHAVIOUR (kept from E1.20): clicking the console swatch calls
//      `setTheme('console')`; clicking Mobile calls `setDevice('mobile')`.
//   2. FIDELITY (AP2, new): the exact documented tokens/markup — the 3-up swatch
//      grid + 64px/radius-9 gradient swatches, the selected card's accent border
//      driven by the theme var (FD1), the device segmented toggle, the five
//      status rows with warning/success pills, and the FD2 header <Icon> (a real
//      24×24 <svg>, NEVER a letter badge). Per-pixel parity is a separate human pass.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- theme store boundary (../../App) ---------------------------------------
// A real vanilla store (so `useStore` subscriptions work) with spy actions. The
// swatch / device controls under test must call `setTheme` / `setDevice`.
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

// Import AFTER the mocks are registered so Settings binds the mocked store.
import Settings from "./index";

beforeEach(() => {
  setTheme.mockClear();
  setDevice.mockClear();
  themeStore.setState({ theme: "aqua", device: "pc", setTheme, setDevice });
});

afterEach(() => {
  vi.clearAllMocks();
});

// -------------------------------------------------------------------------- //
// BEHAVIOUR — the headless residue the loop gates on (E1.20 + device).        //
// -------------------------------------------------------------------------- //
describe("Settings (behaviour — the real switcher)", () => {
  it("clicking the Console swatch card calls setTheme('console')", () => {
    render(<Settings />);
    // The Console appearance control — addressed by its accessible name.
    const consoleCard = screen.getByRole("radio", { name: /console/i });
    fireEvent.click(consoleCard);
    expect(setTheme).toHaveBeenCalledWith("console");
  });

  it("clicking the Samagra swatch card calls setTheme('samagra')", () => {
    render(<Settings />);
    const samagraCard = screen.getByRole("radio", { name: /samagra/i });
    fireEvent.click(samagraCard);
    expect(setTheme).toHaveBeenCalledWith("samagra");
  });

  it("clicking the Mobile device cell calls setDevice('mobile')", () => {
    render(<Settings />);
    const mobile = screen.getByRole("radio", { name: /mobile/i });
    fireEvent.click(mobile);
    expect(setDevice).toHaveBeenCalledWith("mobile");
  });

  it("clicking the Desktop device cell calls setDevice('pc')", () => {
    render(<Settings />);
    const desktop = screen.getByRole("radio", { name: /desktop/i });
    fireEvent.click(desktop);
    expect(setDevice).toHaveBeenCalledWith("pc");
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — Appearance: the 3-up swatch grid (AP2).                          //
// -------------------------------------------------------------------------- //
describe("Settings (fidelity — appearance swatch cards)", () => {
  it("renders the three section headers verbatim (uppercase prototype h2)", () => {
    render(<Settings />);
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Device")).toBeInTheDocument();
    expect(screen.getByText("Integrations")).toBeInTheDocument();
  });

  it("lays the three swatch cards out as a repeat(3,1fr) grid with gap 10", () => {
    render(<Settings />);
    const grid = screen.getByTestId("appearance-grid");
    expect(grid).toHaveStyle({
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: "10px",
    });
    // Exactly the three documented themes (aqua/console/samagra).
    expect(within(grid).getAllByRole("radio")).toHaveLength(3);
  });

  it("renders each swatch card at the prototype geometry (radius 12, padding 4, inner 64px swatch)", () => {
    render(<Settings />);
    const card = screen.getByTestId("swatch-aqua");
    expect(card).toHaveStyle({ borderRadius: "12px", padding: "4px", cursor: "pointer" });
    // The inner gradient chip is height 64 / radius 9 (the prototype's swatch body).
    const chip = within(card).getByTestId("swatch-chip-aqua");
    expect(chip).toHaveStyle({ height: "64px", borderRadius: "9px" });
  });

  it("paints each swatch chip with its documented theme gradient (verbatim)", () => {
    render(<Settings />);
    expect(screen.getByTestId("swatch-chip-aqua")).toHaveStyle({
      background: "linear-gradient(135deg,#c7d2fe,#a5f3fc,#fbcfe8)",
    });
    expect(screen.getByTestId("swatch-chip-console")).toHaveStyle({
      background: "linear-gradient(135deg,#0b1220,#1e293b)",
    });
    expect(screen.getByTestId("swatch-chip-samagra")).toHaveStyle({
      background: "linear-gradient(135deg,#fbf3e5,#e9b07a)",
    });
  });

  it("draws the SELECTED card's accent border from the theme var (FD1), and a transparent border otherwise", () => {
    // aqua is the active theme (store default) → its card carries the accent border.
    render(<Settings />);
    const selected = screen.getByTestId("swatch-aqua");
    // 2px solid <accent>; accent is the theme var so the border recolours per theme.
    expect(selected).toHaveStyle({ border: "2px solid var(--samagra-accent)" });
    expect(selected).toHaveAttribute("aria-checked", "true");
    // A non-selected card has a transparent 2px border (no layout shift on select).
    const other = screen.getByTestId("swatch-console");
    expect(other).toHaveStyle({ border: "2px solid transparent" });
    expect(other).toHaveAttribute("aria-checked", "false");
  });

  it("tints the SELECTED card label with the theme accent var (FD1)", () => {
    render(<Settings />);
    const label = screen.getByTestId("swatch-label-aqua");
    expect(label).toHaveTextContent("Aqua");
    // 12px / 600 centred; selected label is the theme accent var.
    expect(label).toHaveStyle({ fontSize: "12px", fontWeight: "600", color: "var(--samagra-accent)" });
    // An unselected label uses the theme text var, not the accent.
    expect(screen.getByTestId("swatch-label-console")).toHaveStyle({ color: "var(--samagra-text)" });
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — Device segmented toggle (AP2).                                   //
// -------------------------------------------------------------------------- //
describe("Settings (fidelity — device toggle)", () => {
  it("renders a 2-cell Desktop/Mobile toggle with gap 8", () => {
    render(<Settings />);
    const toggle = screen.getByTestId("device-toggle");
    expect(toggle).toHaveStyle({ display: "flex", gap: "8px" });
    expect(within(toggle).getByText("Desktop")).toBeInTheDocument();
    expect(within(toggle).getByText("Mobile")).toBeInTheDocument();
    expect(within(toggle).getAllByRole("radio")).toHaveLength(2);
  });

  it("tints the SELECTED device cell with the theme accent var (FD1)", () => {
    // pc is the active device (store default) → Desktop is selected.
    render(<Settings />);
    const desktop = screen.getByTestId("device-pc");
    expect(desktop).toHaveAttribute("aria-checked", "true");
    // selected cell text is the theme accent var (recolours per theme), 13px / 600.
    expect(desktop).toHaveStyle({ color: "var(--samagra-accent)", fontWeight: "600" });
    // the unselected cell uses the muted var.
    const mobile = screen.getByTestId("device-mobile");
    expect(mobile).toHaveAttribute("aria-checked", "false");
    expect(mobile).toHaveStyle({ color: "var(--samagra-muted)" });
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — Integrations status rows (AP2).                                  //
// -------------------------------------------------------------------------- //
describe("Settings (fidelity — integration rows)", () => {
  it("renders the five documented integration rows verbatim", () => {
    render(<Settings />);
    expect(screen.getByText("Hourly scheduled task")).toBeInTheDocument();
    expect(screen.getByText("Telegram + email notify")).toBeInTheDocument();
    expect(screen.getByText("Google Docs export")).toBeInTheDocument();
    expect(screen.getByText("HTML + DOCX export")).toBeInTheDocument();
    expect(screen.getByText("Codex pre-commit review")).toBeInTheDocument();
    const list = screen.getByTestId("integrations-list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);
  });

  it("renders each row at the prototype geometry (cardBg / 1px line var / radius 10)", () => {
    render(<Settings />);
    const row = screen.getByTestId("integration-row-0");
    expect(row).toHaveStyle({
      background: "var(--samagra-card-bg)",
      borderRadius: "10px",
      border: "1px solid var(--samagra-line)",
    });
  });

  it("colours the status pills by semantic status (warning #d97706 / success #16a34a)", () => {
    render(<Settings />);
    // "needs OK" + the two "creds" rows are warning-coloured.
    const warnPill = screen.getByText("needs OK");
    expect(warnPill).toHaveStyle({ color: "#d97706" });
    expect(screen.getAllByText("creds")).toHaveLength(2);
    // the two "active" rows are success-coloured.
    const activePills = screen.getAllByText("active");
    expect(activePills).toHaveLength(2);
    expect(activePills[0]).toHaveStyle({ color: "#16a34a" });
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — header glyph (FD2).                                              //
// -------------------------------------------------------------------------- //
describe("Settings (fidelity — header icon, FD2)", () => {
  it("renders a real <svg> line-icon in the header (never a letter badge)", () => {
    render(<Settings />);
    const header = screen.getByTestId("settings-header");
    // FD2: the settings glyph is the <Icon> 24×24 viewBox svg, not a text badge.
    const svg = header.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    // No bare 1-char text node acting as a letter badge beside the title.
    expect(within(header).queryByText(/^[A-Z]$/)).toBeNull();
  });
});
