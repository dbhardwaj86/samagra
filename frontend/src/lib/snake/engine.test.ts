import { describe, it, expect } from "vitest";
import { LEVELS, COLS, ROWS, init, setDir, step, food } from "./engine";

const rng0 = () => 0; // deterministic: food at [0,0] (resampled off-body)

describe("snake engine", () => {
  it("level table is exact", () => {
    expect(LEVELS.relaxed).toEqual({ base: 215, floor: 135, dec: 2 });
    expect(LEVELS.normal).toEqual({ base: 135, floor: 70, dec: 3 });
    expect([COLS, ROWS]).toEqual([19, 19]);
  });
  it("init: body [[9,9],[8,9],[7,9]], dir right, speed base, idle", () => {
    const s = init("normal", rng0);
    expect(s.body).toEqual([[9, 9], [8, 9], [7, 9]]);
    expect(s.dir).toEqual([1, 0]);
    expect(s.speed).toBe(135);
    expect(s.status).toBe("idle");
    expect(s.score).toBe(0);
  });
  it("no-reverse: cannot set dir opposite to committed dir", () => {
    const s = { ...init("normal", rng0), status: "running" as const };
    expect(setDir(s, [-1, 0]).next).toEqual(s.dir); // ignored
    expect(setDir(s, [0, -1]).next).toEqual([0, -1]); // allowed
  });
  it("step moves head, trims tail when no eat (constant length)", () => {
    const s = { ...init("normal", rng0), status: "running" as const, food: [15, 15] as [number, number] };
    const out = step(s, rng0);
    expect(out.body[0]).toEqual([10, 9]); // head moved right
    expect(out.body).toHaveLength(3);     // grew head, dropped tail
  });
  it("death on wall hit clears to dead", () => {
    let s = { ...init("normal", rng0), status: "running" as const };
    s = { ...s, body: [[18, 9], [17, 9], [16, 9]], dir: [1, 0], next: [1, 0] };
    const out = step(s, rng0);
    expect(out.status).toBe("dead");
  });
  it("eat grows + scores +10 + ramps speed by dec floored", () => {
    const s = { ...init("normal", rng0), status: "running" as const, food: [10, 9] as [number, number] };
    const out = step(s, rng0);
    expect(out.score).toBe(10);
    expect(out.body).toHaveLength(4);      // grew (no trim)
    expect(out.speed).toBe(135 - 3);       // base - dec
  });
  it("following your own tail is legal (tail cell exempt)", () => {
    // a body where the head would land on the current tail cell after it vacates
    const s = {
      ...init("normal", rng0), status: "running" as const,
      body: [[10, 9], [10, 10], [9, 10], [9, 9]], dir: [-1, 0], next: [-1, 0], food: [0, 0] as [number, number],
    };
    // head -> [9,9] which is the LAST cell (tail) → not a death
    expect(step(s, rng0).status).toBe("running");
  });
  it("food rejection-resamples off the body", () => {
    // rng forces [9,9] (on body) first, then a free cell
    let calls = 0;
    const rng = () => (calls++ < 2 ? 9 / 19 : 0); // first sample on body, then [0,0]
    const f = food([[9, 9], [8, 9], [7, 9]], rng);
    expect(f).not.toEqual([9, 9]);
  });
});
