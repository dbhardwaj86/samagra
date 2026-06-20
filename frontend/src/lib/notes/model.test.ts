import { describe, it, expect } from "vitest";
import {
  seedNotes, seedTodos, newNote, updNote, delNote, noteTitle, wordCount,
  addTodo, toggleTodo, delTodo, clearDone, filterTodos,
} from "./model";

describe("notes model", () => {
  it("seeds two notes with exact ids/titles", () => {
    const s = seedNotes(1_000_000_000_000);
    expect(s.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(s[0].title).toBe("Capacitor energy explainer");
    expect(s[1].title).toBe("Rotational motion — Aarav");
  });
  it("seeds four todos with exact done flags", () => {
    const t = seedTodos();
    expect(t.map((x) => x.id)).toEqual(["t1", "t2", "t3", "t4"]);
    expect(t.map((x) => x.done)).toEqual([false, false, true, false]);
  });
  it("newNote prepends an empty note", () => {
    const out = newNote([], 5);
    expect(out[0]).toMatchObject({ title: "", body: "", ts: 5 });
  });
  it("updNote re-stamps ts", () => {
    const [n] = newNote([], 5);
    const out = updNote([n], n.id, "title", "X", 9);
    expect(out[0]).toMatchObject({ title: "X", ts: 9 });
  });
  it("noteTitle falls back to first body line then Untitled", () => {
    expect(noteTitle({ id: "x", title: "  ", body: "Hello\nworld", ts: 0 })).toBe("Hello");
    expect(noteTitle({ id: "x", title: "", body: "", ts: 0 })).toBe("Untitled");
  });
  it("wordCount counts non-space runs", () => {
    expect(wordCount("  a  bb   ccc ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
  it("todo CRUD + filters", () => {
    let t = addTodo([], "buy", 7);
    expect(t[0]).toMatchObject({ text: "buy", done: false });
    t = addTodo(t, "   ", 8); // blank → no-op
    expect(t).toHaveLength(1);
    t = toggleTodo(t, t[0].id);
    expect(filterTodos(t, "done")).toHaveLength(1);
    expect(filterTodos(t, "active")).toHaveLength(0);
    t = clearDone(t);
    expect(t).toHaveLength(0);
  });
  it("delNote drops only the matching note and leaves others untouched", () => {
    const a = newNote([], 1)[0];
    const b = newNote([], 2)[0];
    const notes = [a, b];
    expect(delNote(notes, a.id)).toEqual([b]); // removed match
    expect(delNote(notes, "missing")).toEqual(notes); // no match → unchanged
    expect(notes).toHaveLength(2); // input not mutated
  });
  it("delTodo drops only the matching todo and leaves others untouched", () => {
    let t = addTodo([], "x", 1);
    t = addTodo(t, "y", 2);
    const [x, y] = t;
    expect(delTodo(t, x.id)).toEqual([y]); // removed match
    expect(delTodo(t, "missing")).toEqual(t); // no match → unchanged
    expect(t).toHaveLength(2); // input not mutated
  });
  it("filterTodos all returns every todo", () => {
    let t = addTodo([], "a", 1);
    t = addTodo(t, "b", 2);
    t = toggleTodo(t, t[0].id);
    expect(filterTodos(t, "all")).toHaveLength(2); // 'all' branch
  });
  it("noteTitle prefers a non-empty trimmed title over the body", () => {
    expect(noteTitle({ id: "x", title: "  Real Title  ", body: "ignored", ts: 0 })).toBe(
      "Real Title",
    ); // title-wins branch
  });
});
