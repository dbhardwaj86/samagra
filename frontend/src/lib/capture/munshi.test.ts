import { describe, it, expect } from "vitest";
import { buildMunshiCapture } from "./munshi";

describe("buildMunshiCapture", () => {
  it("builds a todo body", () => {
    expect(buildMunshiCapture({ kind: "todo", assignee: "Ravi", task: "Call" }))
      .toEqual({ ok: true, body: { kind: "todo", assignee: "Ravi", task: "Call" } });
  });
  it("rejects missing required field", () => {
    const r = buildMunshiCapture({ kind: "note", student: "Amit", issue: "" });
    expect(r.ok).toBe(false);
  });
  it("passes optional fields through when present", () => {
    const r = buildMunshiCapture({ kind: "todo", assignee: "A", task: "T", due: "2026-07-01" });
    expect(r.ok && r.body.due).toBe("2026-07-01");
  });
});
