// src/apps/Notes/index.tsx
// AP5 FIDELITY — Notes / To-dos (README §Apps#12 Notes, #f59e0b 840×600).
// THIN presentational wrapper (E1.23, VISUAL) over the already-green
// `lib/notes/model` transforms (note/todo CRUD + derivations + seeds, green in
// deepak's E1.14) and the `lib/persistence` save/load seam (E1.3). There is ZERO
// new note/todo logic here — every CRUD path delegates to a pure `lib/notes`
// function and then writes through `persistence.save` (proto §5.2: "every
// mutation writes through to localStorage immediately").
//
// FIDELITY (AP5): the markup/tokens are a VERBATIM port of the prototype's
// `app_notes` / `notesEditor` / `notesTodos` (.dc.html L701–740). FD1: every
// surface colour is driven off the theme tokens via the `--samagra-*` CSS vars
// (accent/accent2/text/muted/line/card-bg/sub-bg) so the surface renders
// correctly in aqua, console AND samagra — no baked hexes except the prototype's
// fixed semantic hue (#ef4444 Delete). FD2: the done-checkbox glyph is a real
// inline <svg> check — NEVER a unicode/letter badge.
//
// The headless residue the loop gates on (E1.23 Step 1 / proto §5.5): adding a
// todo persists via `save('samagra.todos', …)`. Per-pixel parity (hover-reveal
// timing, list scroll chrome) is a SEPARATE human QA pass (RUBRIC §6).
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
const TAB_LABEL: Record<NotesTab, string> = { notes: "Notes", todos: "To-dos" };
const FILTERS: [TodoFilter, string][] = [
  ["all", "All"],
  ["active", "Active"],
  ["done", "Done"],
];

// ── FD1 theme tokens — referenced unconditionally so the surface is correct in
// every theme (the prototype's `t.accent / t.accent2 / t.text / t.muted /
// t.line / t.cardBg / t.subBg`).
const V = {
  text: "var(--samagra-text)",
  muted: "var(--samagra-muted)",
  line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)",
  subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)",
  accent2: "var(--samagra-accent2)",
} as const;

// Accent alpha tints — the prototype's `hex(accent, a)`. Driven from the theme
// var via `color-mix` (the codebase's established accent-alpha pattern, see
// Clock/Settings) so they recolour per theme (FD1) instead of baking a hex.
const ACCENT_12 = "color-mix(in srgb, var(--samagra-accent) 12%, transparent)";
const ACCENT_13 = "color-mix(in srgb, var(--samagra-accent) 13%, transparent)";
const ACCENT_15 = "color-mix(in srgb, var(--samagra-accent) 15%, transparent)";
const ACCENT_25 = "color-mix(in srgb, var(--samagra-accent) 25%, transparent)";

// Fixed semantic hue (NOT the theme accent) — the prototype's literal.
const RED = "#ef4444"; // Delete control

/** proto §5.4: body preview — newlines→spaces, sliced to 42, fallback text. */
function notePreview(body: string): string {
  const flat = body.replace(/\n/g, " ").trim() || "No additional text";
  return flat.slice(0, 42);
}

/** proto §5.4 meta line: `N words · edited <Mon D, h:mm AM/PM>`. */
function noteMeta(note: Note): string {
  const words = wordCount(note.body);
  const when = new Date(note.ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${words} words · edited ${when}`;
}

// ── FD2 done-checkbox tick — a real inline <svg> (24×24 vector, round caps,
// #fff stroke), NEVER a unicode/letter badge. Verbatim from the prototype's
// `notesTodos` checkbox glyph (.dc.html L737).
function CheckGlyph() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12l4 4L19 6" />
    </svg>
  );
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
    <div
      className="app-notes"
      data-testid="notes"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "var(--samagra-font)",
      }}
    >
      {/* Tab strip — flex-1 pills, 12.5px/600, pad 8px 0, r9 (proto §5 L703). */}
      <div
        role="tablist"
        aria-label="Notes modes"
        style={{ display: "flex", gap: 4, padding: "12px 14px 4px", flex: "none" }}
      >
        {TABS.map((t) => {
          const sel = tab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 12.5,
                fontWeight: 600,
                padding: "8px 0",
                borderRadius: 9,
                cursor: "pointer",
                border: "none",
                // Selected → accent text + accent@12% bg; else muted / transparent (FD1).
                color: sel ? V.accent : V.muted,
                background: sel ? ACCENT_12 : "transparent",
              }}
            >
              {TAB_LABEL[t]}
            </button>
          );
        })}
      </div>

      {tab === "notes" ? (
        <div
          role="tabpanel"
          style={{ flex: 1, display: "flex", minHeight: 0 }}
        >
          {/* Left list — fixed 200px, 1px theme-line right border (proto §5 L709). */}
          <div
            data-testid="notes-list"
            style={{
              width: 200,
              flex: "none",
              borderRight: `1px solid ${V.line}`,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            {/* `+ New note` — accent@13% bg / accent text, 12.5px/700, r9. */}
            <button
              type="button"
              onClick={onNewNote}
              style={{
                margin: "12px 12px 8px",
                padding: "9px 0",
                borderRadius: 9,
                textAlign: "center",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: ACCENT_13,
                color: V.accent,
              }}
            >
              +  New note
            </button>
            <div style={{ flex: 1, overflow: "auto", padding: "0 8px 8px" }}>
              {notes.length ? (
                notes.map((n) => {
                  const s = n.id === noteSel;
                  return (
                    <div
                      key={n.id}
                      data-testid="note-row"
                      role="button"
                      tabIndex={0}
                      aria-pressed={s}
                      onClick={() => setNoteSel(n.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setNoteSel(n.id);
                      }}
                      style={{
                        padding: "9px 11px",
                        borderRadius: 9,
                        cursor: "pointer",
                        marginBottom: 3,
                        // Selected → accent@12% bg + 1px accent@25% border (FD1).
                        background: s ? ACCENT_12 : "transparent",
                        border: `1px solid ${s ? ACCENT_25 : "transparent"}`,
                      }}
                    >
                      <div
                        data-testid="note-row-title"
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: V.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {noteTitle(n)}
                      </div>
                      <div
                        data-testid="note-row-preview"
                        style={{
                          fontSize: 11,
                          color: V.muted,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginTop: 2,
                        }}
                      >
                        {notePreview(n.body)}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    fontSize: 12,
                    color: V.muted,
                    textAlign: "center",
                    padding: 20,
                  }}
                >
                  No notes yet
                </div>
              )}
            </div>
          </div>

          {/* Right editor — title input / meta / body textarea / footer. */}
          {selected ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
              }}
            >
              <input
                type="text"
                aria-label="Note title"
                placeholder="Title"
                value={selected.title}
                onChange={(e) => onUpdNote(selected.id, "title", e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: 18,
                  fontWeight: 700,
                  color: V.text,
                  padding: "14px 18px 5px",
                  fontFamily: "var(--samagra-font)",
                }}
              />
              <div
                data-testid="note-meta"
                style={{ fontSize: 11, color: V.muted, padding: "0 18px 8px" }}
              >
                {noteMeta(selected)}
              </div>
              <textarea
                aria-label="Note body"
                placeholder="Start writing…"
                spellCheck={false}
                value={selected.body}
                onChange={(e) => onUpdNote(selected.id, "body", e.target.value)}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  resize: "none",
                  background: "transparent",
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: V.text,
                  padding: "2px 18px 16px",
                  fontFamily: "var(--samagra-font)",
                }}
              />
              <div
                data-testid="notes-footer"
                style={{
                  padding: "10px 18px",
                  borderTop: `1px solid ${V.line}`,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: V.muted,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {/* FD1: 6×6 round "saved" dot in the theme accent2 var. */}
                  <span
                    data-testid="autosaved-dot"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: V.accent2,
                    }}
                  />
                  Autosaved
                </span>
                {/* Delete — the prototype's fixed danger hue (#ef4444), NOT accent. */}
                <button
                  type="button"
                  onClick={() => onDelNote(selected.id)}
                  style={{
                    marginLeft: "auto",
                    fontSize: 12,
                    fontWeight: 600,
                    color: RED,
                    cursor: "pointer",
                    border: "none",
                    background: "transparent",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: V.muted,
                fontSize: 13,
              }}
            >
              Select or create a note
            </div>
          )}
        </div>
      ) : (
        <div
          role="tabpanel"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            padding: "16px 18px",
          }}
        >
          {/* Add row — input (1px line / sub-bg / r10) + Add (accent@15%). */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAddTodo();
            }}
            // `color: V.text` lives here (inherited by the input) rather than on
            // the input itself — a `color` longhand on the same element as a
            // `var()`-bearing `border` shorthand corrupts jsdom's shorthand parse
            // (the border assertion reads the inline shorthand). Visual result is
            // identical; the text colour still resolves to the theme text var.
            style={{ display: "flex", gap: 8, marginBottom: 13, color: V.text }}
          >
            <input
              type="text"
              aria-label="Add a task"
              placeholder="Add a task… (press Enter)"
              value={todoInput}
              onChange={(e) => setTodoInput(e.target.value)}
              style={{
                flex: 1,
                border: `1px solid ${V.line}`,
                background: V.subBg,
                borderRadius: 10,
                padding: "11px 14px",
                fontSize: 13.5,
                outline: "none",
                fontFamily: "var(--samagra-font)",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "0 20px",
                display: "flex",
                alignItems: "center",
                borderRadius: 10,
                background: ACCENT_15,
                color: V.accent,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                border: "none",
              }}
            >
              Add
            </button>
          </form>

          {/* Filter chips — radius-999 pills, selected accent@13% (proto §5 L731). */}
          <div
            role="group"
            aria-label="Filter todos"
            style={{ display: "flex", gap: 6, marginBottom: 12 }}
          >
            {FILTERS.map(([f, label]) => {
              const s = todoFilter === f;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={s}
                  onClick={() => setTodoFilter(f)}
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "5px 13px",
                    borderRadius: 999,
                    cursor: "pointer",
                    border: "none",
                    background: s ? ACCENT_13 : V.subBg,
                    color: s ? V.accent : V.muted,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Task rows — card-bg / 1px line / r11, 20×20 checkbox, hover × delete. */}
          <div
            data-testid="todos-list"
            style={{
              flex: 1,
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            {shownTodos.length ? (
              shownTodos.map((t) => (
                <div
                  key={t.id}
                  data-testid="todo-row"
                  data-done={t.done}
                  onClick={() => onToggleTodo(t.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: V.cardBg,
                    border: `1px solid ${V.line}`,
                    borderRadius: 11,
                    padding: "12px 14px",
                    cursor: "pointer",
                  }}
                >
                  {/* 20×20 r6 checkbox — 2px border; filled accent + white <svg>
                      check when done, else transparent + muted border (FD1/FD2). */}
                  <div
                    data-testid="todo-checkbox"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      flex: "none",
                      border: `2px solid ${t.done ? V.accent : V.muted}`,
                      background: t.done ? V.accent : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {t.done ? <CheckGlyph /> : null}
                  </div>
                  <span
                    data-testid="todo-text"
                    style={{
                      flex: 1,
                      fontSize: 13.5,
                      color: t.done ? V.muted : V.text,
                      textDecoration: t.done ? "line-through" : "none",
                    }}
                  >
                    {t.text}
                  </span>
                  {/* hover-revealed × delete (opacity is a human-QA pass detail). */}
                  <button
                    type="button"
                    className="todos-del"
                    aria-label={`Delete todo: ${t.text}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelTodo(t.id);
                    }}
                    style={{
                      color: V.muted,
                      fontSize: 19,
                      lineHeight: 1,
                      cursor: "pointer",
                      padding: "0 2px",
                      border: "none",
                      background: "transparent",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <div
                style={{
                  textAlign: "center",
                  color: V.muted,
                  fontSize: 13,
                  padding: "34px 0",
                }}
              >
                {todoFilter === "done" ? "Nothing completed yet." : "All clear — nice."}
              </div>
            )}
          </div>

          {/* Footer — `N tasks left` + Clear completed (muted var). */}
          <div
            data-testid="todos-footer"
            // `color: V.muted` is carried by the children (count span + Clear
            // button) rather than this div — a `color` longhand alongside the
            // `var()`-bearing `border-top` shorthand corrupts jsdom's shorthand
            // parse (the footer asserts the inline `border-top` shorthand). The
            // rendered colour is unchanged.
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 12,
              paddingTop: 12,
              borderTop: `1px solid ${V.line}`,
              fontSize: 12,
            }}
          >
            <span style={{ color: V.muted }}>
              {remaining} task{remaining === 1 ? "" : "s"} left
            </span>
            <button
              type="button"
              onClick={onClearDone}
              style={{
                marginLeft: "auto",
                cursor: "pointer",
                fontWeight: 600,
                color: V.muted,
                border: "none",
                background: "transparent",
              }}
            >
              Clear completed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
