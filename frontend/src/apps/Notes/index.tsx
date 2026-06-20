// src/apps/Notes/index.tsx
// THIN presentational wrapper (E1.23, VISUAL) over the already-green
// `lib/notes/model` transforms (note/todo CRUD + derivations + seeds, green in
// deepak's E1.14) and the `lib/persistence` save/load seam (E1.3). There is ZERO
// new note/todo logic here — every CRUD path delegates to a pure `lib/notes`
// function and then writes through `persistence.save` (proto §5.2: "every
// mutation writes through to localStorage immediately").
//
// The headless residue the loop gates on (E1.23 Step 1 / proto §5.5): adding a
// todo persists via `save('samagra.todos', …)`. Per-pixel parity (note list /
// editor chrome, "● Autosaved" footer, checkbox glyph, filter pills) is a
// SEPARATE human QA pass (RUBRIC §6) and is NOT tested here.
import { useMemo, useState } from "react";
import { KEYS, load, save } from "../../lib/persistence";
import {
  addTodo,
  clearDone,
  delNote,
  delTodo,
  filterTodos,
  newNote,
  noteTitle,
  seedNotes,
  seedTodos,
  toggleTodo,
  updNote,
  wordCount,
  type Note,
  type Todo,
  type TodoFilter,
} from "../../lib/notes/model";

type NotesTab = "notes" | "todos";

// proto §5.1: tabs `notes | todos`, default `notes`.
const TABS: NotesTab[] = ["notes", "todos"];
const TAB_LABEL: Record<NotesTab, string> = { notes: "Notes", todos: "Todos" };
const FILTERS: TodoFilter[] = ["all", "active", "done"];

/** proto §5.4: body preview — newlines→spaces, sliced to 42, fallback text. */
function notePreview(body: string): string {
  const flat = body.replace(/\n+/g, " ").trim().slice(0, 42);
  return flat || "No additional text";
}

/** proto §5.4 meta line: `N words · edited <Mon D, h:mm AM/PM>`. */
function noteMeta(note: Note): string {
  const words = wordCount(note.body);
  const when = new Date(note.ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${words} words · edited ${when}`;
}

export default function Notes() {
  const [tab, setTab] = useState<NotesTab>("notes");

  // Seed-on-first-run (proto §5.2/§5.3): `load` returns the seed fallback when
  // the key is absent. `seedNotes` needs `now`; capture it once on mount.
  const [notes, setNotes] = useState<Note[]>(() =>
    load(KEYS.notes, seedNotes(Date.now())),
  );
  const [todos, setTodos] = useState<Todo[]>(() => load(KEYS.todos, seedTodos()));

  const [noteSel, setNoteSel] = useState<string | null>(() => notes[0]?.id ?? null);
  const [todoInput, setTodoInput] = useState("");
  const [todoFilter, setTodoFilter] = useState<TodoFilter>("all");

  // ── Note mutations — delegate to lib/notes, then persist. ──────────────────
  function commitNotes(next: Note[]): void {
    setNotes(next);
    save(KEYS.notes, next);
  }
  function onNewNote(): void {
    const next = newNote(notes, Date.now());
    commitNotes(next);
    setNoteSel(next[0].id);
  }
  function onUpdNote(id: string, field: "title" | "body", val: string): void {
    commitNotes(updNote(notes, id, field, val, Date.now()));
  }
  function onDelNote(id: string): void {
    const next = delNote(notes, id);
    commitNotes(next);
    if (noteSel === id) setNoteSel(next[0]?.id ?? null);
  }

  // ── Todo mutations — delegate to lib/notes, then persist. ──────────────────
  function commitTodos(next: Todo[]): void {
    setTodos(next);
    save(KEYS.todos, next);
  }
  function onAddTodo(): void {
    const next = addTodo(todos, todoInput, Date.now());
    if (next === todos) return; // blank → no-op (lib short-circuits)
    commitTodos(next);
    setTodoInput("");
  }
  function onToggleTodo(id: string): void {
    commitTodos(toggleTodo(todos, id));
  }
  function onDelTodo(id: string): void {
    commitTodos(delTodo(todos, id));
  }
  function onClearDone(): void {
    commitTodos(clearDone(todos));
  }

  const selected = useMemo(
    () => notes.find((n) => n.id === noteSel) ?? null,
    [notes, noteSel],
  );
  const shownTodos = useMemo(
    () => filterTodos(todos, todoFilter),
    [todos, todoFilter],
  );
  const remaining = useMemo(() => todos.filter((t) => !t.done).length, [todos]);

  return (
    <div className="app-notes" data-testid="notes">
      <div role="tablist" aria-label="Notes modes" className="notes-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`notes-tab-btn${tab === t ? " is-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "notes" ? (
        <div role="tabpanel" className="notes-panel">
          <ul className="notes-list" style={{ width: 200 }}>
            {notes.map((n) => (
              <li
                key={n.id}
                className={`notes-list-item${n.id === noteSel ? " is-selected" : ""}`}
              >
                <button
                  type="button"
                  className="notes-list-btn"
                  aria-pressed={n.id === noteSel}
                  onClick={() => setNoteSel(n.id)}
                >
                  <span className="notes-list-title">{noteTitle(n)}</span>
                  <span className="notes-list-preview">{notePreview(n.body)}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="notes-editor">
            <button type="button" className="notes-new" onClick={onNewNote}>
              New note
            </button>
            {selected ? (
              <>
                <input
                  type="text"
                  className="notes-title-input"
                  aria-label="Note title"
                  placeholder="Title"
                  value={selected.title}
                  onChange={(e) => onUpdNote(selected.id, "title", e.target.value)}
                />
                <textarea
                  className="notes-body-input"
                  aria-label="Note body"
                  value={selected.body}
                  onChange={(e) => onUpdNote(selected.id, "body", e.target.value)}
                />
                <div className="notes-meta">{noteMeta(selected)}</div>
                <div className="notes-footer">
                  <span className="notes-autosaved">● Autosaved</span>
                  <button
                    type="button"
                    className="notes-delete"
                    onClick={() => onDelNote(selected.id)}
                  >
                    Delete
                  </button>
                </div>
              </>
            ) : (
              <div className="notes-empty">No note selected.</div>
            )}
          </div>
        </div>
      ) : (
        <div role="tabpanel" className="todos-panel">
          <form
            className="todos-add"
            onSubmit={(e) => {
              e.preventDefault();
              onAddTodo();
            }}
          >
            <input
              type="text"
              className="todos-input"
              aria-label="Add a todo"
              placeholder="Add a todo…"
              value={todoInput}
              onChange={(e) => setTodoInput(e.target.value)}
            />
            <button type="submit" className="todos-add-btn">
              Add
            </button>
          </form>

          <div role="group" aria-label="Filter todos" className="todos-filters">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`todos-filter${todoFilter === f ? " is-active" : ""}`}
                aria-pressed={todoFilter === f}
                onClick={() => setTodoFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          <ul className="todos-list">
            {shownTodos.length === 0 ? (
              <li className="todos-empty">
                {todoFilter === "done" ? "Nothing completed yet." : "All clear — nice."}
              </li>
            ) : (
              shownTodos.map((t) => (
                <li
                  key={t.id}
                  className={`todos-item${t.done ? " is-done" : ""}`}
                >
                  <label className="todos-check">
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() => onToggleTodo(t.id)}
                    />
                    <span className="todos-text">{t.text}</span>
                  </label>
                  <button
                    type="button"
                    className="todos-del"
                    aria-label={`Delete todo: ${t.text}`}
                    onClick={() => onDelTodo(t.id)}
                  >
                    ×
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="todos-footer">
            <span className="todos-count">
              {remaining} task{remaining === 1 ? "" : "s"} left
            </span>
            <button type="button" className="todos-clear" onClick={onClearDone}>
              Clear completed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
