import { describe, it, expect } from "vitest";
import { QTYPES, questionRows, questionError } from "./facets";
import type { QuestionsResponse } from "../../types/contracts";

describe("QTYPES", () => {
  it("is the 8 known question types", () => {
    expect(QTYPES).toEqual([
      "mcq_single", "integer", "numeric", "mcq_multi",
      "matrix_match", "assertion_reason", "comprehension", "true_false",
    ]);
  });
});

describe("questionRows / questionError", () => {
  it("returns rows defensively", () => {
    const data = { results: [{ q_uid: "q1", slug: "s", q_type: "integer", subject: "P",
      chapter: "1", difficulty: "easy", text: "snippet…" }] } as QuestionsResponse;
    expect(questionRows(data)).toHaveLength(1);
    expect(questionError(data)).toBeNull();
  });
  it("both empty shapes: error present vs absent (both → [])", () => {
    expect(questionRows({ results: [], error: "QX source not present" })).toEqual([]);
    expect(questionError({ results: [], error: "QX source not present" })).toBe("QX source not present");
    expect(questionRows({ results: [] })).toEqual([]);
    expect(questionError({ results: [] })).toBeNull();
    expect(questionRows(null)).toEqual([]);
  });
});
