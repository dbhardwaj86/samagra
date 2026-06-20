import { describe, it, expect } from "vitest";
import {
  handAngles,
  handEndpoint,
  faceTicks,
  faceNumerals,
  CX,
  CY,
  R,
} from "./analog";

describe("clock analog", () => {
  it("hand angles at 03:15:30", () => {
    const d = new Date(2026, 5, 20, 3, 15, 30);
    expect(handAngles(d)).toEqual({ secA: 180, minA: 93, hrA: 97.5 });
  });
  it("12 o'clock maps to 0deg hour angle", () => {
    expect(handAngles(new Date(2026, 5, 20, 12, 0, 0)).hrA).toBe(0);
  });
  it("endpoint of a 0deg hand points straight up from center", () => {
    const e = handEndpoint(150, 150, 0, 102, 30);
    expect(Math.round(e.x2)).toBe(150);
    expect(Math.round(e.y2)).toBe(48); // 150 - 102
  });
  it("tail of a 0deg hand extends below center", () => {
    const e = handEndpoint(150, 150, 0, 102, 30);
    expect(Math.round(e.x1)).toBe(150);
    expect(Math.round(e.y1)).toBe(180); // 150 + 30 tail
  });
});

describe("clock analog — face geometry", () => {
  it("emits 60 ticks with 12 majors (one per 5)", () => {
    const ticks = faceTicks();
    expect(ticks).toHaveLength(60);
    expect(ticks.filter((t) => t.big)).toHaveLength(12);
    // i=0 is a major tick straight up from center.
    const top = ticks[0];
    expect(top.big).toBe(true);
    expect(Math.round(top.x1)).toBe(CX);
    expect(Math.round(top.x2)).toBe(CX);
    // major inner radius = R-14, minor inner radius = R-7.
    expect(Math.round(top.y1)).toBe(CY - (R - 14)); // 150 - 106 = 44
    // i=1 is a minor tick.
    expect(ticks[1].big).toBe(false);
  });

  it("places numerals 12/3/6/9 on the R-30 ring", () => {
    const nums = faceNumerals();
    expect(nums.map((n) => n.label)).toEqual([12, 3, 6, 9]);
    const ring = R - 30; // 90
    const twelve = nums[0];
    expect(Math.round(twelve.x)).toBe(CX);
    expect(Math.round(twelve.y)).toBe(CY - ring + 6); // 150 - 90 + 6 = 66
    const three = nums[1];
    expect(Math.round(three.x)).toBe(CX + ring); // 240
    expect(Math.round(three.y)).toBe(CY + 6); // +6 optical centering
  });
});
