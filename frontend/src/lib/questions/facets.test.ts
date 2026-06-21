import { describe, it, expect } from "vitest";
import {
  MODES, FACET_DIMS, buildQuestionsPath, questionRows, questionError,
  searchMode, isDegraded, totalCount, facetNames,
} from "./facets";
import type { QuestionsResponse } from "../../types/contracts";

const sample = {
  results: [{
    q_uid: "q1", slug: "s", q_type: "integer", subject: "physics",
    chapter: "Kinematics", difficulty: "easy", snippet: "a projectile [fig]",
    html: '<div class="stem">a projectile</div>',
  }],
  total: 1, page: 1, page_size: 25, mode: "exact", degraded: false,
  facets: { subject: [["physics", 1] as [string, number]],
            chapter: [["Kinematics", 1] as [string, number]],
            qtype: [["integer", 1] as [string, number], ["mcq_single", 3] as [string, number]] },
} as QuestionsResponse;

describe("MODES / FACET_DIMS", () => {
  it("exposes the two search modes and three facet dims", () => {
    expect(MODES).toEqual(["exact", "semantic"]);
    expect(FACET_DIMS).toEqual(["subject", "chapter", "qtype"]);
  });
});

describe("buildQuestionsPath", () => {
  it("builds the /api/questions path with set params only", () => {
    expect(buildQuestionsPath({ q: "projectile", mode: "semantic", subject: "physics", page: 2 }))
      .toBe("/api/questions?q=projectile&mode=semantic&subject=physics&page=2");
  });
  it("omits empty/undefined params", () => {
    expect(buildQuestionsPath({ q: "", mode: "exact" })).toBe("/api/questions?mode=exact");
    expect(buildQuestionsPath({})).toBe("/api/questions");
  });
});

describe("response accessors", () => {
  it("rows / mode / degraded / total", () => {
    expect(questionRows(sample)).toHaveLength(1);
    expect(questionRows(sample)[0].html).toContain("stem");
    expect(searchMode(sample)).toBe("exact");
    expect(isDegraded(sample)).toBe(false);
    expect(totalCount(sample)).toBe(1);
    expect(questionError(sample)).toBeNull();
  });
  it("defensive on empty / error / null", () => {
    expect(questionRows(null)).toEqual([]);
    expect(searchMode(null)).toBe("exact");
    expect(totalCount(undefined)).toBe(0);
    expect(questionError({ results: [], error: "questions backend unavailable" } as unknown as QuestionsResponse))
      .toBe("questions backend unavailable");
  });
  it("degraded reflects a semantic→exact fallback", () => {
    const d = { ...sample, mode: "exact", degraded: true } as QuestionsResponse;
    expect(isDegraded(d)).toBe(true);
  });
});

describe("facetNames", () => {
  it("extracts value names per dimension", () => {
    expect(facetNames(sample, "subject")).toEqual(["physics"]);
    expect(facetNames(sample, "qtype")).toEqual(["integer", "mcq_single"]);
  });
  it("empty when facets absent", () => {
    expect(facetNames({ results: [] } as unknown as QuestionsResponse, "chapter")).toEqual([]);
    expect(facetNames(null, "subject")).toEqual([]);
  });
});
