import { describe, it, expect } from "vitest";
import { parse } from "./parser";

describe("terminal parse", () => {
  it("splits c0/args/arg and lowercases c0", () => {
    expect(parse("Open Snake")).toMatchObject({ c0: "open", args: ["Snake"], arg: "Snake", clear: false, empty: false });
  });
  it("collapses whitespace", () => {
    expect(parse("echo   a   b")).toMatchObject({ c0: "echo", arg: "a b" });
  });
  it("flags clear as special", () => {
    expect(parse("clear").clear).toBe(true);
  });
  it("flags empty input", () => {
    expect(parse("   ").empty).toBe(true);
  });
  it("treats null/undefined input as empty", () => {
    expect(parse(undefined as unknown as string)).toMatchObject({ c0: "", arg: "", clear: false, empty: true });
    expect(parse(null as unknown as string).empty).toBe(true);
  });
});
