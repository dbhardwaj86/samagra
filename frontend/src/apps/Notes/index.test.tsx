// E1.23 RED — Notes/To-dos smoke (proto.md §5 + §5.2/§5.5).
// The Notes app is a THIN presentational wrapper over the already-green
// `lib/notes/model` transforms (note/todo CRUD + seeds, all green in deepak's
// E1.14) and the `lib/persistence` save/load seam (E1.3). khanak's wrapper
// renders the two tabs (`notes | todos`), seeds on first run, and autosaves
// through `persistence.save` on every mutation.
//
// The ONE behavioural assertion the loop gates on (the headless residue,
// per the plan E1.23 Step 1 + proto.md §5.2 / §5.5):
//   adding a todo persists via the mocked storage — i.e. it calls
//   `save('samagra.todos', …)` (KEYS.todos).
//
// Per-pixel parity (note list/editor chrome, "● Autosaved" footer styling,
// checkbox glyph, filter pills) is a SEPARATE human QA pass (RUBRIC §6,
// E1.23 row) and is NOT tested here.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- persistence boundary (../../lib/persistence) ---------------------------
// Mock the save/load seam so the wrapper writes through a spy instead of real
// localStorage. `load` returns the seed arrays (defensive fallback path) so the
// Todos tab renders deterministically; `save` is the spy we assert on. `KEYS` is
// re-exported verbatim (proto.md §5.2: `samagra.todos`).
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

describe("Notes (E1.23 smoke)", () => {
  it("adding a todo persists via save('samagra.todos')", () => {
    render(<Notes />);

    // Switch to the Todos tab.
    fireEvent.click(screen.getByRole("tab", { name: /todos/i }));

    // Type a new todo and submit it (Add button or Enter).
    const input = screen.getByRole("textbox", { name: /add (a )?todo/i });
    fireEvent.change(input, { target: { value: "Mark E1.23 done" } });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    // The headless residue: the mutation writes through to the todos key.
    expect(save).toHaveBeenCalledWith(
      KEYS.todos,
      expect.arrayContaining([
        expect.objectContaining({ text: "Mark E1.23 done", done: false }),
      ]),
    );
  });
});
