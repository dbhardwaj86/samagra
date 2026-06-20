import { describe, it, expect } from "vitest";
import { INITIAL_Z, bump, topWindow } from "./zorder";

describe("zorder", () => {
  it("initial z counter is 20", () => { expect(INITIAL_Z).toBe(20); });
  it("bump increments", () => { expect(bump(20)).toBe(21); });
  it("topWindow = highest z among non-minimized", () => {
    const wins = [
      { id: "a", z: 21, min: false }, { id: "b", z: 25, min: false }, { id: "c", z: 99, min: true },
    ];
    expect(topWindow(wins)).toBe("b");
  });
  it("topWindow null when all minimized or empty", () => {
    expect(topWindow([{ id: "a", z: 5, min: true }])).toBeNull();
    expect(topWindow([])).toBeNull();
  });
});
