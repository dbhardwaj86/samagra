import { describe, it, expect, vi, afterEach } from "vitest";
import { load, save, KEYS } from "./persistence";

function fakeStorage(seed: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(seed));
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

describe("persistence", () => {
  it("exposes the 4 localStorage keys verbatim", () => {
    expect(KEYS).toEqual({
      notes: "samagra.notes", todos: "samagra.todos",
      snakeBest: "samagra.snake.best", snakeLevel: "samagra.snake.level",
    });
  });
  it("round-trips a value", () => {
    const s = fakeStorage();
    save(KEYS.notes, [{ id: "n1" }], s);
    expect(load(KEYS.notes, [], s)).toEqual([{ id: "n1" }]);
  });
  it("falls back on corrupt JSON", () => {
    const s = fakeStorage({ "samagra.notes": "{not json" });
    expect(load(KEYS.notes, ["seed"], s)).toEqual(["seed"]);
  });
  it("falls back when an array key holds a non-array", () => {
    const s = fakeStorage({ "samagra.todos": '{"x":1}' });
    expect(load(KEYS.todos, [], s)).toEqual([]);
  });
  it("missing key returns the fallback", () => {
    expect(load(KEYS.snakeBest, 0, fakeStorage())).toBe(0);
  });
  it("load returns the fallback when storage is absent (SSR/no localStorage)", () => {
    // A falsy storage exercises the `!storage` guard. Passing `undefined`
    // would re-trigger the default `_ls`, so we pass an explicit falsy value.
    const noStorage = null as unknown as Storage;
    expect(load(KEYS.notes, ["seed"], noStorage)).toEqual(["seed"]);
  });
  it("save is a no-op when storage is absent (no throw)", () => {
    const noStorage = null as unknown as Storage;
    expect(() => save(KEYS.notes, [{ id: "n1" }], noStorage)).not.toThrow();
  });
  it("save swallows a setItem quota error (no throw, no leak)", () => {
    const throwing: Storage = {
      ...fakeStorage(),
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
    };
    expect(() => save(KEYS.notes, [{ id: "n1" }], throwing)).not.toThrow();
  });
});

// Covers the module-level `_ls` default-storage resolution (proto §2.8/§5.2):
// the `typeof localStorage !== "undefined" ? localStorage : undefined` arms.
// Each case re-imports the module so `_ls` is recomputed under the stubbed global.
describe("default storage binding (_ls)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("uses the real localStorage when one exists (no explicit storage arg)", async () => {
    const backing = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() { return backing.size; },
      clear: () => backing.clear(),
      getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
      key: (i: number) => Array.from(backing.keys())[i] ?? null,
      removeItem: (k: string) => void backing.delete(k),
      setItem: (k: string, v: string) => void backing.set(k, v),
    } as Storage);
    vi.resetModules();
    const mod = await import("./persistence");
    mod.save(mod.KEYS.snakeBest, 7);
    expect(backing.get("samagra.snake.best")).toBe("7");
    expect(mod.load(mod.KEYS.snakeBest, 0)).toBe(7);
  });

  it("falls back to undefined storage when localStorage is absent (SSR)", async () => {
    vi.stubGlobal("localStorage", undefined);
    vi.resetModules();
    const mod = await import("./persistence");
    // With no backing store, load returns the fallback and save is a silent no-op.
    expect(mod.load(mod.KEYS.snakeBest, 42)).toBe(42);
    expect(() => mod.save(mod.KEYS.snakeBest, 99)).not.toThrow();
    expect(mod.load(mod.KEYS.snakeBest, 0)).toBe(0);
  });
});
