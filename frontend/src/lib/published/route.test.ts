import { describe, it, expect } from "vitest";
import { isLearnPath, learnPath, parseLearnPath } from "./route";

describe("isLearnPath", () => {
  it("matches /learn and /learn/...", () => {
    expect(isLearnPath("/learn")).toBe(true);
    expect(isLearnPath("/learn/circular-motion")).toBe(true);
    expect(isLearnPath("/learn/cm/revision")).toBe(true);
    expect(isLearnPath("/")).toBe(false);
    expect(isLearnPath("/learning")).toBe(false);   // not a prefix match by accident
    expect(isLearnPath("/dashboard")).toBe(false);
  });
});

describe("parseLearnPath", () => {
  it("extracts chapter + lane; empty for non-learn paths", () => {
    expect(parseLearnPath("/learn")).toEqual({});
    expect(parseLearnPath("/learn/circular-motion")).toEqual({ chapter: "circular-motion" });
    expect(parseLearnPath("/learn/cm/revision")).toEqual({ chapter: "cm", lane: "revision" });
    expect(parseLearnPath("/")).toEqual({});
  });
});

describe("learnPath", () => {
  it("builds the canonical /learn URL", () => {
    expect(learnPath()).toBe("/learn");
    expect(learnPath("cm")).toBe("/learn/cm");
    expect(learnPath("cm", "revision")).toBe("/learn/cm/revision");
  });
});
