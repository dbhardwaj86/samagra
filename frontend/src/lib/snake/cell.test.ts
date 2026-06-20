import { describe, it, expect } from "vitest";
import { cellSize, boardPx } from "./cell";

describe("snake cell", () => {
  it("default cell = 18 with no window", () => {
    expect(cellSize()).toBe(18);
    expect(boardPx(18)).toEqual({ w: 342, h: 342 }); // 19*18
  });
  it("scales from window rect, clamped 11..28", () => {
    // availW=w-40, availH=h-288; cell=floor(min/19)
    expect(cellSize({ w: 480, h: 680 })).toBe(Math.min(28, Math.max(11, Math.floor(Math.min(440, 392) / 19))));
    expect(cellSize({ w: 200, h: 200 })).toBe(11); // tiny → floor at 11
    expect(cellSize({ w: 2000, h: 2000 })).toBe(28); // huge → cap at 28
  });
});
