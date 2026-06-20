import { describe, it, expect } from "vitest";
import { dispatch, PROMPT } from "./dispatch";
import { APPS, ORDER } from "../../registry";

const ctx = { order: ORDER, apps: APPS };

describe("terminal dispatch", () => {
  it("open <app> resolves an id and returns an openApp effect", () => {
    const r = dispatch("open snake", ctx);
    expect(r.effects).toContainEqual({ kind: "openApp", value: "snake" });
    expect(r.lines.some((l) => l.c === "ok")).toBe(true);
  });
  it("open <name> resolves a single-word display name", () => {
    const r = dispatch("open clock", ctx);
    expect(r.effects).toContainEqual({ kind: "openApp", value: "clock" });
  });
  it("open unknown errors and emits no effect", () => {
    const r = dispatch("open zzz", ctx);
    expect(r.effects).toHaveLength(0);
    expect(r.lines.some((l) => l.c === "err")).toBe(true);
  });
  it("theme valid → setTheme effect; invalid → err", () => {
    expect(dispatch("theme console", ctx).effects).toContainEqual({ kind: "setTheme", value: "console" });
    expect(dispatch("theme nope", ctx).effects).toHaveLength(0);
  });
  it("device valid → setDevice effect; invalid → err", () => {
    expect(dispatch("device mobile", ctx).effects).toContainEqual({ kind: "setDevice", value: "mobile" });
    const bad = dispatch("device nope", ctx);
    expect(bad.effects).toHaveLength(0);
    expect(bad.lines.some((l) => l.c === "err" && l.t.includes("choose pc | mobile"))).toBe(true);
  });
  it("ls joins ORDER ids", () => {
    const out = dispatch("ls", ctx).lines.map((l) => l.t).join("\n");
    expect(out).toContain("dashboard");
    expect(out).toContain("settings");
  });
  it("whoami is exact", () => {
    expect(dispatch("whoami", ctx).lines.map((l) => l.t).join("")).toContain("Deepak Bhardwaj — Founder & Chairman");
  });
  it("sudo easter egg errors with the board line", () => {
    const r = dispatch("sudo rm", ctx);
    expect(r.lines.some((l) => l.c === "err" && l.t.includes("only the board"))).toBe(true);
  });
  it("unknown command", () => {
    const r = dispatch("frobnicate", ctx);
    expect(r.lines.some((l) => l.c === "err" && l.t.includes("command not found: frobnicate"))).toBe(true);
  });
  it("echo prints the arg", () => {
    expect(dispatch("echo hello world", ctx).lines.map((l) => l.t).join("")).toContain("hello world");
  });

  // ── Prototype-fidelity guards (proto.md §4.1–§4.2) ─────────────────────────
  const text = (cmd: string) => dispatch(cmd, ctx).lines.map((l) => l.t).join("\n");

  it("prompt constant is deepak@samagra:~$ (proto §4.1 — chairman login)", () => {
    expect(PROMPT).toBe("deepak@samagra:~$");
  });
  it("help lists every documented verb (proto §4.2)", () => {
    const out = text("help");
    for (const verb of [
      "help", "status", "catalog", "agents", "pipelines", "ls",
      "open", "theme", "device", "neofetch", "whoami", "date", "echo", "clear",
    ]) {
      expect(out).toContain(verb);
    }
  });
  it("status carries the artifacts/tests/repo facts (proto §4.2)", () => {
    const out = text("status");
    expect(out).toContain("7,044");
    expect(out).toContain("11/11");
    expect(out).toContain("github.com/dbhardwaj86/samagra");
  });
  it("agents === org === board (all three aliases identical, proto §4.2)", () => {
    expect(text("agents")).toBe(text("org"));
    expect(text("org")).toBe(text("board"));
  });
  it("pipelines emits 4 bars with pcts 74/91/46/33 (proto §4.2)", () => {
    const lines = dispatch("pipelines", ctx).lines;
    const bars = lines.filter((l) => /[█·]{20}/.test(l.t)); // each bar rendered to width 20
    expect(bars).toHaveLength(4);
    // bar fill length = round(pct/5); width 20
    const filled = (l: { t: string }) => (l.t.match(/█/g) || []).length;
    expect(bars.map(filled)).toEqual([74, 91, 46, 33].map((p) => Math.round(p / 5)));
  });
  it("catalog has the accent header + 7 source rows (proto §4.2)", () => {
    const lines = dispatch("catalog", ctx).lines;
    const rows = lines.filter((l) => l.c === "fg"); // header is accent, rows are fg
    expect(rows).toHaveLength(7);
  });
  it("neofetch is a 7-line system card (proto §4.2)", () => {
    expect(dispatch("neofetch", ctx).lines).toHaveLength(7);
  });
  it("about emits the accent title + 2 description lines (proto §4.2)", () => {
    const lines = dispatch("about", ctx).lines;
    expect(lines.some((l) => l.c === "accent")).toBe(true);
    expect(lines.filter((l) => l.c === "fg")).toHaveLength(2);
  });
  it("date returns a Date string (proto §4.2 — new Date().toString())", () => {
    expect(text("date")).toContain(String(new Date().getFullYear()));
  });
  it("clear empties the buffer (proto §4.2 — special-cased)", () => {
    const r = dispatch("clear", ctx);
    expect(r.lines).toEqual([]);
    expect(r.clear).toBe(true);
  });

  // ── No-arg / empty-input handling (proto §4.1–§4.2) ────────────────────────
  it("empty / whitespace-only input runs no command", () => {
    expect(dispatch("", ctx)).toEqual({ lines: [], effects: [] });
    expect(dispatch("   ", ctx)).toEqual({ lines: [], effects: [] });
  });
  it("open with no arg errors and emits no effect", () => {
    const r = dispatch("open", ctx);
    expect(r.effects).toHaveLength(0);
    expect(r.lines.some((l) => l.c === "err" && l.t.includes("unknown app"))).toBe(true);
  });
  it("theme with no arg errors and emits no effect", () => {
    const r = dispatch("theme", ctx);
    expect(r.effects).toHaveLength(0);
    expect(r.lines.some((l) => l.c === "err" && l.t.includes("choose aqua"))).toBe(true);
  });
  it("device with no arg errors and emits no effect", () => {
    const r = dispatch("device", ctx);
    expect(r.effects).toHaveLength(0);
    expect(r.lines.some((l) => l.c === "err" && l.t.includes("choose pc | mobile"))).toBe(true);
  });
});
