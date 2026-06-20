import { describe, it, expect } from "vitest";
import { PRESETS, remainingFrom, ringOffset, isDone, RING_C, CHIME } from "./timer";

describe("timer", () => {
  it("preset table = 1/5/10/25 min in seconds", () => {
    expect(PRESETS).toEqual([[60, "1 min"], [300, "5 min"], [600, "10 min"], [1500, "25 min"]]);
  });
  it("ring circumference C = 2*pi*110", () => {
    expect(RING_C).toBeCloseTo(2 * Math.PI * 110, 6);
  });
  it("remaining = end - now, floored at 0", () => {
    expect(remainingFrom(900, 1000)).toBe(100);
    expect(remainingFrom(2000, 1000)).toBe(0);
  });
  it("ringOffset = C*(1-frac); full at total=0", () => {
    expect(ringOffset(0, 0)).toBeCloseTo(0, 6);            // frac=1 ⇒ offset 0
    expect(ringOffset(50, 100)).toBeCloseTo(RING_C * 0.5, 6);
  });
  it("isDone when not running, total>0, remaining<=0", () => {
    expect(isDone(false, 1000, 0)).toBe(true);
    expect(isDone(true, 1000, 0)).toBe(false);
    expect(isDone(false, 0, 0)).toBe(false);
  });
  it("chime config = 880Hz sine + envelope (proto §3.4 — headless guard for beep())", () => {
    expect(CHIME).toEqual({
      freq: 880, type: "sine", gainPeak: 0.18, attack: 0.02, release: 0.7, stopAfter: 0.72,
    });
    // the load-bearing pitch — the WebAudio call in the component reads this constant
    expect(CHIME.freq).toBe(880);
    expect(CHIME.type).toBe("sine");
  });
});
