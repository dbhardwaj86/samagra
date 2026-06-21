import { describe, it, expect } from "vitest";
import { buildQuery } from "./query";

describe("buildQuery", () => {
  it("empty / all-undefined → empty string", () => {
    expect(buildQuery({})).toBe("");
    expect(buildQuery({ source: undefined, limit: undefined })).toBe("");
  });
  it("drops undefined and empty-string params, keeps 0", () => {
    expect(buildQuery({ q: "", source: "textbook", limit: 200 })).toBe("?source=textbook&limit=200");
    expect(buildQuery({ limit: 0 })).toBe("?limit=0");
  });
  it("URL-encodes keys and values", () => {
    expect(buildQuery({ q: "a b&c" })).toBe("?q=a%20b%26c");
  });
  it("preserves the given key order", () => {
    expect(buildQuery({ source: "insp", kind: "exam", limit: 500 })).toBe("?source=insp&kind=exam&limit=500");
  });
});
