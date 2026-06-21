import { describe, it, expect } from "vitest";
import { catalogRows, openHref, subjectsOf } from "./rows";
import type { SearchResponse } from "../../types/contracts";

const sample: SearchResponse = {
  results: [
    { uid: "u1", source: "textbook", kind: "chapter", title: "Vectors", subject: "Physics",
      unit: "Mechanics", chapter: "1", status: "approved", path: "C:/t/vectors.html",
      url: "/lecture/vectors", updated_at: "2026-06-01", meta: { order: 1 } },
    { uid: "u2", source: "textbook", kind: "chapter", title: "Kinematics", subject: "Maths",
      unit: "Mechanics", chapter: "2", status: null, path: null, url: null,
      updated_at: null, meta: {} },
  ],
};

describe("catalogRows", () => {
  it("maps results to display rows with a safe open href", () => {
    const rows = catalogRows(sample);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ uid: "u1", title: "Vectors", subject: "Physics", status: "approved" });
    expect(rows[0].openHref).toBe("/open?path=" + encodeURIComponent("C:/t/vectors.html"));
    expect(rows[1].openHref).toBeNull(); // no path → no open link
  });
  it("is defensive: null data and non-array results → []", () => {
    expect(catalogRows(null)).toEqual([]);
    expect(catalogRows({ results: undefined } as unknown as SearchResponse)).toEqual([]);
  });
});

describe("openHref", () => {
  it("encodes a path, returns null for null/empty", () => {
    expect(openHref("C:/a b.pdf")).toBe("/open?path=" + encodeURIComponent("C:/a b.pdf"));
    expect(openHref(null)).toBeNull();
    expect(openHref("")).toBeNull();
  });
});

describe("subjectsOf", () => {
  it("distinct, sorted, drops null/empty", () => {
    expect(subjectsOf(catalogRows(sample))).toEqual(["Maths", "Physics"]);
  });
});
