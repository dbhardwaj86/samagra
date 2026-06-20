import { describe, it, expect } from "vitest";
import { fmtMs, fmtSwMain, elapsedFrom, lapSplit } from "./stopwatch";

describe("stopwatch", () => {
  it("fmtMs formats MM:SS.cc", () => {
    expect(fmtMs(0)).toBe("00:00.00");
    expect(fmtMs(65430)).toBe("01:05.43"); // 1m 5s 43cs
  });
  it("fmtSwMain shows the hours segment only when hrs>0 (proto §3.3)", () => {
    expect(fmtSwMain(3_725_000)).toBe("01:02:05"); // 1h 2m 5s ⇒ HH:MM:SS
    expect(fmtSwMain(125_000)).toBe("02:05");       // 2m 5s, no hours ⇒ MM:SS
  });
  it("drift-free elapsed from an injected now", () => {
    const start = 1000; // anchored start
    expect(elapsedFrom(4210, start)).toBe(3210);
  });
  it("lap split is laps[i] - laps[i-1] (first minus 0)", () => {
    expect(lapSplit([1200, 3500], 0)).toBe(1200);
    expect(lapSplit([1200, 3500], 1)).toBe(2300);
  });
});
