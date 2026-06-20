import { describe, it, expect } from "vitest";
import { ZONES, isNight } from "./world";

describe("world clock", () => {
  it("6 zones in exact order", () => {
    expect(ZONES).toEqual([
      ["New Delhi", "Asia/Kolkata"], ["London", "Europe/London"], ["New York", "America/New_York"],
      ["San Francisco", "America/Los_Angeles"], ["Tokyo", "Asia/Tokyo"], ["Dubai", "Asia/Dubai"],
    ]);
  });
  it("day = 06:00–18:59 local; else night", () => {
    expect(isNight(5)).toBe(true);
    expect(isNight(6)).toBe(false);
    expect(isNight(18)).toBe(false);
    expect(isNight(19)).toBe(true);
    expect(isNight(0)).toBe(true);
  });
});
