// AP5 FIDELITY — Notes / To-dos (README §Apps#12 Notes, #f59e0b 840×600).
// The Notes app is a THIN presentational wrapper over the already-green
// `lib/notes/model` transforms (note/todo CRUD + derivations + seeds) and the
// `lib/persistence` save/load seam (E1.3). This test pins two contracts:
//   1. BEHAVIOUR (kept from E1.23): adding a todo persists via the mocked storage
//      — it calls `save('samagra.todos', …)` (the headless residue the loop gates
//      on; proto.md §5.2 / §5.5).
//   2. FIDELITY (AP5, new): the exact documented tokens/markup from the prototype's
//      `app_notes` / `notesEditor` / `notesTodos` (.dc.html L701-740):
//        • Tab strip — flex-1 pill tabs `Notes | To-dos` (12.5px/600, pad 8px 0,
//          radius 9). SELECTED tab text + bg driven by the theme accent var (FD1):
//          color var(--samagra-accent), bg accent@12%.
//        • Notes — a 200px left list with the `+ New note` button (accent@13% bg,
//          accent text, 12.5px/700), title (12.5px/600 text var) + preview
//          (11px muted var, sliced 42) rows; SELECTED row = accent@12% bg + 1px
//          accent@25% border. Right editor: title <input> (18px/700 text var),
//          meta line `N words · edited <date>` (11px muted), body <textarea>
//          (14px, line-height 1.65). Footer: a 6px accent2-var dot + "Autosaved"
//          (11px muted) and a Delete control in the fixed #ef4444 hue.
//        • To-dos — add <input> (1px line var border, sub-bg var, radius 10) + an
//          Add button (accent@15% bg / accent text); filter chips All/Active/Done
//          (radius 999, selected accent@13%/accent else sub-bg/muted); task rows
//          (card-bg var / 1px line var / radius 11) each with a 20×20 radius-6
//          checkbox (2px border, filled accent + a white <svg> check when done),
//          strikethrough + muted text when done, and a hover-revealed `×` delete.
//          Footer: "N tasks left" + "Clear completed".
// FD1: every surface colour is driven off the theme tokens via the `--samagra-*`
// CSS vars so the surface renders correctly in aqua, console AND samagra — no baked
// hexes except the prototype's fixed semantic hues (#ef4444 Delete). FD2: the
// done-checkbox glyph is a real inline <svg> check — NEVER a unicode/letter badge.
// Per-pixel parity (note list/editor chrome, hover-reveal timing) is a SEPARATE
// human QA pass (RUBRIC §6) and is NOT tested here.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- persistence boundary (../../lib/persistence) ---------------------------
// Mock the save/load seam so the wrapper writes through a spy instead of real
// localStorage. `load` returns the seed arrays (defensive fallback path) so the
// Notes + Todos tabs render deterministically; `save` is the spy we assert on.
// `KEYS` is re-exported verbatim (proto.md §5.2: `samagra.notes` / `samagra.todos`).
const { save, load, KEYS } = await vi.hoisted(async () => {
  const save = vi.fn();
  const KEYS = {
    notes: "samagra.notes",
    todos: "samagra.todos",
    snakeBest: "samagra.snake.best",
    snakeLevel: "samagra.snake.level",
  } as const;
  // `load(key, fallback)` returns the fallback (seed) — first-run behaviour.
  const load = vi.fn(<T,>(_key: string, fallback: T): T => fallback);
  return { save, load, KEYS };
});

vi.mock("../../lib/persistence", () => ({ save, load, KEYS }));

// Import AFTER the mock is registered so Notes binds the mocked persistence.
import Notes from "./index";

beforeEach(() => {
  save.mockClear();
  load.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

/** Switch to the To-dos tab and return the Notes root for scoping. */
function gotoTodos() {
  render(<Notes />);
  fireEvent.click(screen.getByRole("tab", { name: /to-?dos/i }));
}

// -------------------------------------------------------------------------- //
// BEHAVIOUR — the headless residue the loop gates on.                         //
// -------------------------------------------------------------------------- //
describe("Notes (behaviour — persistence residue)", () => {
  it("adding a todo persists via save('samagra.todos')", () => {
    render(<Notes />);

    // Switch to the Todos tab.
    fireEvent.click(screen.getByRole("tab", { name: /to-?dos/i }));

    // Type a new todo and submit it (Add button or Enter).
    const input = screen.getByRole("textbox", { name: /add (a )?todo|add a task/i });
    fireEvent.change(input, { target: { value: "Mark E1.23 done" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    // The headless residue: the mutation writes through to the todos key.
    expect(save).toHaveBeenCalledWith(
      KEYS.todos,
      expect.arrayContaining([
        expect.objectContaining({ text: "Mark E1.23 done", done: false }),
      ]),
    );
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — tab strip pill geometry + selected accent (AP5 / FD1).           //
// -------------------------------------------------------------------------- //
describe("Notes (fidelity — tab strip)", () => {
  it("renders the two tabs Notes | To-dos, defaulting to Notes", () => {
    render(<Notes />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(screen.getByRole("tab", { name: /^notes$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /to-?dos/i })).toBeInTheDocument();
    // default tab = notes → the 200px note list is present.
    expect(screen.getByTestId("notes-list")).toBeInTheDocument();
  });

  it("renders each tab as a flex-1 pill at the prototype geometry (12.5px/600, pad 8px 0, radius 9)", () => {
    render(<Notes />);
    const tab = screen.getByRole("tab", { name: /^notes$/i });
    expect(tab).toHaveStyle({
      flex: 1,
      fontSize: "12.5px",
      fontWeight: "600",
      padding: "8px 0",
      borderRadius: "9px",
    });
    // the strip is a flex row with the prototype's 12px 14px 4px padding + gap 4.
    const strip = screen.getByRole("tablist", { name: /notes modes/i });
    expect(strip).toHaveStyle({ display: "flex", gap: "4px", padding: "12px 14px 4px" });
  });

  it("drives the SELECTED tab's text + background from the theme accent var (FD1)", () => {
    render(<Notes />);
    const selected = screen.getByRole("tab", { name: /^notes$/i });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected).toHaveStyle({ color: "var(--samagra-accent)" });
    expect(selected).toHaveStyle({
      background: "color-mix(in srgb, var(--samagra-accent) 12%, transparent)",
    });
    const other = screen.getByRole("tab", { name: /to-?dos/i });
    expect(other).toHaveAttribute("aria-selected", "false");
    expect(other).toHaveStyle({ color: "var(--samagra-muted)" });
    expect(other).toHaveStyle({ background: "transparent" });
  });

  it("moves the accent pill to whichever tab is clicked", () => {
    render(<Notes />);
    const notesTab = screen.getByRole("tab", { name: /^notes$/i });
    const todosTab = screen.getByRole("tab", { name: /to-?dos/i });
    fireEvent.click(todosTab);
    expect(todosTab).toHaveAttribute("aria-selected", "true");
    expect(todosTab).toHaveStyle({
      color: "var(--samagra-accent)",
      background: "color-mix(in srgb, var(--samagra-accent) 12%, transparent)",
    });
    expect(notesTab).toHaveAttribute("aria-selected", "false");
    expect(notesTab).toHaveStyle({ color: "var(--samagra-muted)", background: "transparent" });
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — Notes tab: list + editor chrome (AP5 / FD1).                      //
// -------------------------------------------------------------------------- //
describe("Notes (fidelity — note list)", () => {
  it("renders the left list at exactly 200px with a 1px theme-line right border (FD1)", () => {
    render(<Notes />);
    const list = screen.getByTestId("notes-list");
    expect(list).toHaveStyle({ width: "200px", borderRight: "1px solid var(--samagra-line)" });
  });

  it("renders the `+ New note` button (accent@13% bg / accent text, 12.5px/700) (FD1)", () => {
    render(<Notes />);
    const btn = screen.getByRole("button", { name: /new note/i });
    expect(btn).toHaveStyle({
      background: "color-mix(in srgb, var(--samagra-accent) 13%, transparent)",
      color: "var(--samagra-accent)",
      fontSize: "12.5px",
      fontWeight: "700",
      borderRadius: "9px",
    });
  });

  it("renders each note row with a 12.5px/600 title + 11px muted preview (FD1)", () => {
    render(<Notes />);
    const list = screen.getByTestId("notes-list");
    const titles = within(list).getAllByTestId("note-row-title");
    expect(titles.length).toBeGreaterThan(0);
    expect(titles[0]).toHaveStyle({
      fontSize: "12.5px",
      fontWeight: "600",
      color: "var(--samagra-text)",
    });
    const preview = within(list).getAllByTestId("note-row-preview")[0];
    expect(preview).toHaveStyle({ fontSize: "11px", color: "var(--samagra-muted)" });
  });

  it("tints the SELECTED note row with accent@12% bg + a 1px accent@25% border (FD1)", () => {
    render(<Notes />);
    const list = screen.getByTestId("notes-list");
    const rows = within(list).getAllByTestId("note-row");
    // the first seed note is selected on mount.
    const selected = rows.find((r) => r.getAttribute("aria-pressed") === "true");
    expect(selected).toBeDefined();
    expect(selected!).toHaveStyle({
      background: "color-mix(in srgb, var(--samagra-accent) 12%, transparent)",
      border: "1px solid color-mix(in srgb, var(--samagra-accent) 25%, transparent)",
      borderRadius: "9px",
    });
    // an unselected row has a transparent bg + transparent border (no tint).
    const other = rows.find((r) => r.getAttribute("aria-pressed") === "false");
    expect(other).toBeDefined();
    expect(other!).toHaveStyle({ background: "transparent", border: "1px solid transparent" });
  });

  it("moves the accent tint to whichever note row is clicked", () => {
    render(<Notes />);
    const list = screen.getByTestId("notes-list");
    const rows = within(list).getAllByTestId("note-row");
    const second = rows.find((r) => r.getAttribute("aria-pressed") === "false")!;
    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(second).toHaveStyle({
      background: "color-mix(in srgb, var(--samagra-accent) 12%, transparent)",
    });
  });
});

describe("Notes (fidelity — editor chrome)", () => {
  it("renders the title <input> at 18px/700 in the theme text var (FD1)", () => {
    render(<Notes />);
    const title = screen.getByLabelText(/note title/i);
    expect(title.tagName.toLowerCase()).toBe("input");
    expect(title).toHaveStyle({
      fontSize: "18px",
      fontWeight: "700",
      color: "var(--samagra-text)",
    });
  });

  it("renders the meta line `N words · edited <date>` (11px muted var) (FD1)", () => {
    render(<Notes />);
    const meta = screen.getByTestId("note-meta");
    expect(meta).toHaveTextContent(/\d+ words · edited /);
    expect(meta).toHaveStyle({ fontSize: "11px", color: "var(--samagra-muted)" });
  });

  it("renders the body <textarea> at 14px / line-height 1.65 in the text var (FD1)", () => {
    render(<Notes />);
    const body = screen.getByLabelText(/note body/i);
    expect(body.tagName.toLowerCase()).toBe("textarea");
    expect(body).toHaveStyle({
      fontSize: "14px",
      lineHeight: "1.65",
      color: "var(--samagra-text)",
    });
  });

  it("renders the footer: a 6px accent2-var dot + Autosaved (11px muted) and a #ef4444 Delete (FD1)", () => {
    render(<Notes />);
    const footer = screen.getByTestId("notes-footer");
    expect(footer).toHaveStyle({ borderTop: "1px solid var(--samagra-line)" });
    // the Autosaved label sits in the muted var at 11px.
    const autosaved = within(footer).getByText(/autosaved/i);
    expect(autosaved).toHaveStyle({ fontSize: "11px", color: "var(--samagra-muted)" });
    // FD1: the "saved" status dot is a 6×6 round swatch in the theme accent2 var.
    const dot = within(footer).getByTestId("autosaved-dot");
    expect(dot).toHaveStyle({
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: "var(--samagra-accent2)",
    });
    // Delete is the prototype's fixed danger hue (#ef4444), NOT the theme accent.
    const del = within(footer).getByRole("button", { name: /delete/i });
    expect(del).toHaveStyle({ color: "#ef4444", fontWeight: "600", fontSize: "12px" });
  });
});

// -------------------------------------------------------------------------- //
// FIDELITY — To-dos tab: add input, filter chips, rows, checkbox (AP5).       //
// -------------------------------------------------------------------------- //
describe("Notes (fidelity — to-dos add + filters)", () => {
  it("renders the add <input> (1px line var border / sub-bg var / radius 10) + Add button (accent@15%) (FD1)", () => {
    gotoTodos();
    const input = screen.getByRole("textbox", { name: /add a task/i });
    expect(input).toHaveStyle({
      border: "1px solid var(--samagra-line)",
      background: "var(--samagra-sub-bg)",
      borderRadius: "10px",
    });
    const add = screen.getByRole("button", { name: /^add$/i });
    expect(add).toHaveStyle({
      background: "color-mix(in srgb, var(--samagra-accent) 15%, transparent)",
      color: "var(--samagra-accent)",
      borderRadius: "10px",
      fontWeight: "700",
    });
  });

  it("renders the All/Active/Done filter chips as radius-999 pills, selected accent@13% (FD1)", () => {
    gotoTodos();
    const group = screen.getByRole("group", { name: /filter todos/i });
    for (const label of ["All", "Active", "Done"]) {
      expect(within(group).getByRole("button", { name: new RegExp(`^${label}$`, "i") })).toBeInTheDocument();
    }
    // `All` is the default-selected chip → accent text + accent@13% bg, radius 999.
    const all = within(group).getByRole("button", { name: /^all$/i });
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveStyle({
      color: "var(--samagra-accent)",
      background: "color-mix(in srgb, var(--samagra-accent) 13%, transparent)",
      borderRadius: "999px",
      fontSize: "11.5px",
      fontWeight: "600",
    });
    // an unselected chip uses the sub-bg + muted vars.
    const active = within(group).getByRole("button", { name: /^active$/i });
    expect(active).toHaveAttribute("aria-pressed", "false");
    expect(active).toHaveStyle({
      background: "var(--samagra-sub-bg)",
      color: "var(--samagra-muted)",
    });
  });
});

describe("Notes (fidelity — to-do rows + checkbox)", () => {
  it("renders each task row on the card-bg var with a 1px line var border + radius 11 (FD1)", () => {
    gotoTodos();
    const list = screen.getByTestId("todos-list");
    const rows = within(list).getAllByTestId("todo-row");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveStyle({
      background: "var(--samagra-card-bg)",
      border: "1px solid var(--samagra-line)",
      borderRadius: "11px",
    });
  });

  it("renders a 20×20 radius-6 checkbox with a 2px border, theme-driven (FD1)", () => {
    gotoTodos();
    const list = screen.getByTestId("todos-list");
    const box = within(list).getAllByTestId("todo-checkbox")[0];
    expect(box).toHaveStyle({ width: "20px", height: "20px", borderRadius: "6px" });
    // 2px border; an unchecked box borders in the muted var with a transparent fill.
    expect(box).toHaveStyle({
      border: "2px solid var(--samagra-muted)",
      background: "transparent",
    });
  });

  it("fills a DONE checkbox with the accent var and a real white <svg> check glyph (FD2), never a letter", () => {
    gotoTodos();
    const list = screen.getByTestId("todos-list");
    // a seed todo is pre-completed (proto seeds include a done item) → find it.
    const rows = within(list).getAllByTestId("todo-row");
    const doneRow = rows.find((r) => r.getAttribute("data-done") === "true");
    expect(doneRow).toBeDefined();
    const box = within(doneRow!).getByTestId("todo-checkbox");
    // FD1: the filled box paints in the theme accent var with an accent border.
    expect(box).toHaveStyle({
      background: "var(--samagra-accent)",
      border: "2px solid var(--samagra-accent)",
    });
    // FD2: the tick is a real inline <svg> (24×24 vector, round caps, #fff stroke) —
    // NEVER a unicode/letter badge.
    const glyph = box.querySelector("svg");
    expect(glyph).not.toBeNull();
    expect(glyph).toHaveAttribute("viewBox", "0 0 24 24");
    expect(glyph).toHaveAttribute("stroke", "#fff");
    expect(glyph).toHaveAttribute("stroke-linecap", "round");
    expect(glyph!.querySelector("path")).not.toBeNull();
    // an UNchecked box renders no glyph at all (empty square).
    const openRow = rows.find((r) => r.getAttribute("data-done") === "false");
    expect(openRow).toBeDefined();
    expect(within(openRow!).getByTestId("todo-checkbox").querySelector("svg")).toBeNull();
  });

  it("strikes through + mutes a DONE task's text (FD1)", () => {
    gotoTodos();
    const list = screen.getByTestId("todos-list");
    const rows = within(list).getAllByTestId("todo-row");
    const doneRow = rows.find((r) => r.getAttribute("data-done") === "true")!;
    const text = within(doneRow).getByTestId("todo-text");
    expect(text).toHaveStyle({ textDecoration: "line-through", color: "var(--samagra-muted)" });
    // an active task is un-struck and uses the text var.
    const openRow = rows.find((r) => r.getAttribute("data-done") === "false")!;
    const openText = within(openRow).getByTestId("todo-text");
    expect(openText).toHaveStyle({ textDecoration: "none", color: "var(--samagra-text)" });
  });

  it("exposes a per-row × delete control with an accessible name", () => {
    gotoTodos();
    const list = screen.getByTestId("todos-list");
    const row = within(list).getAllByTestId("todo-row")[0];
    const del = within(row).getByRole("button", { name: /delete todo/i });
    expect(del).toBeInTheDocument();
    expect(del).toHaveTextContent("×");
  });

  it("renders the footer: `N tasks left` + a Clear completed control (muted var)", () => {
    gotoTodos();
    const footer = screen.getByTestId("todos-footer");
    expect(footer).toHaveStyle({ borderTop: "1px solid var(--samagra-line)" });
    expect(within(footer).getByText(/\d+ tasks? left/i)).toBeInTheDocument();
    const clear = within(footer).getByRole("button", { name: /clear completed/i });
    expect(clear).toHaveStyle({ color: "var(--samagra-muted)", fontWeight: "600" });
  });

  it("toggling a checkbox persists via save('samagra.todos')", () => {
    gotoTodos();
    const list = screen.getByTestId("todos-list");
    const box = within(list).getAllByTestId("todo-checkbox")[0];
    fireEvent.click(box);
    expect(save).toHaveBeenCalledWith(KEYS.todos, expect.any(Array));
  });
});
