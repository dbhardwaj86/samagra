// Notes / To-dos model — pure array transforms + derivations + exact seeds.
// All operations are immutable: they return a new array and never mutate inputs.
// Per proto.md §5. React wrappers stay thin; all real logic lives here.

export interface Note {
  id: string;
  title: string;
  body: string;
  /** ms epoch */
  ts: number;
}

export interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export type TodoFilter = "all" | "active" | "done";

// ── Seeds (proto.md §5.3, verbatim) ────────────────────────────────────────

/** Two seed notes; bodies are verbatim, timestamps relative to `now`. */
export function seedNotes(now: number): Note[] {
  return [
    {
      id: "n1",
      title: "Capacitor energy explainer",
      body:
        "Energy stored  U = ½CV².\n\nLink to the RC charging sim. Use the bell-jar analogy for intuition before the formula.\n\nDraft only — board reviews before publish.",
      ts: now - 3600e3,
    },
    {
      id: "n2",
      title: "Rotational motion — Aarav",
      body:
        "Needs the thin revision sheet:\n  • moment of inertia table\n  • 5 MCQs on rolling without slipping\n  • 1 numerical: disc vs ring race down an incline",
      ts: now - 7200e3,
    },
  ];
}

/** Four seed todos with exact done flags. */
export function seedTodos(): Todo[] {
  return [
    { id: "t1", text: "Frame 5 MCQs on capacitor energy", done: false },
    { id: "t2", text: "Fix Optics WB page 14 figure", done: false },
    { id: "t3", text: "Approve thin sheet · Kinematics", done: true },
    { id: "t4", text: "Call printer re: booklet batch", done: false },
  ];
}

// ── Note CRUD ───────────────────────────────────────────────────────────────

/** Prepend a fresh empty note stamped at `now`. */
export function newNote(notes: Note[], now: number): Note[] {
  return [{ id: "n" + now, title: "", body: "", ts: now }, ...notes];
}

/** Set one field on the matching note and re-stamp `ts` (so any edit reads as "edited"). */
export function updNote(
  notes: Note[],
  id: string,
  field: "title" | "body",
  val: string,
  now: number,
): Note[] {
  return notes.map((n) => (n.id === id ? { ...n, [field]: val, ts: now } : n));
}

/** Drop the matching note. */
export function delNote(notes: Note[], id: string): Note[] {
  return notes.filter((n) => n.id !== id);
}

// ── Note derivations ─────────────────────────────────────────────────────────

/** First non-empty source for the displayed title: trimmed title, else first body line, else "Untitled". */
export function noteTitle(note: Note): string {
  const t = note.title.trim();
  if (t) return t;
  const firstLine = note.body.split("\n")[0].trim();
  return firstLine || "Untitled";
}

/** Count runs of non-whitespace characters. */
export function wordCount(s: string): number {
  return (String(s).trim().match(/\S+/g) || []).length;
}

// ── Todo CRUD + filters ───────────────────────────────────────────────────────

/** Append a todo; trims text and no-ops when blank. */
export function addTodo(todos: Todo[], text: string, now: number): Todo[] {
  const trimmed = text.trim();
  if (!trimmed) return todos;
  return [...todos, { id: "t" + now, text: trimmed, done: false }];
}

/** Flip the done flag on the matching todo. */
export function toggleTodo(todos: Todo[], id: string): Todo[] {
  return todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

/** Drop the matching todo. */
export function delTodo(todos: Todo[], id: string): Todo[] {
  return todos.filter((t) => t.id !== id);
}

/** Drop all completed todos. */
export function clearDone(todos: Todo[]): Todo[] {
  return todos.filter((t) => !t.done);
}

/** Filter by view: all / active (!done) / done. */
export function filterTodos(todos: Todo[], filter: TodoFilter): Todo[] {
  if (filter === "active") return todos.filter((t) => !t.done);
  if (filter === "done") return todos.filter((t) => t.done);
  return todos;
}
