import { describe, it, expect } from "vitest";
import { KANBAN_COLUMNS, groupByStatus } from "./columns";
import type { Assignment } from "../../types/contracts";

const a = (id: string, status: Assignment["status"]): Assignment => ({
  id, agent: "codex", outbox_path: "x", pipeline: null, seed_ref: null, artifact_ref: null,
  expected_output: null, review_by: null, status, created_at: "t", updated_at: "t",
});

describe("KANBAN_COLUMNS", () => {
  it("is the 5 statuses in order, in-review hyphenated", () => {
    expect(KANBAN_COLUMNS.map((c) => c.key)).toEqual(
      ["queued", "running", "in-review", "approved", "changes"]);
  });
});

describe("groupByStatus", () => {
  it("buckets each assignment under its literal status, all 5 keys present", () => {
    const g = groupByStatus([a("1", "queued"), a("2", "in-review"), a("3", "in-review"), a("4", "changes")]);
    expect(Object.keys(g)).toEqual(["queued", "running", "in-review", "approved", "changes"]);
    expect(g["in-review"].map((x) => x.id)).toEqual(["2", "3"]);
    expect(g["running"]).toEqual([]);
  });
  it("defensive: null/non-array → all-empty buckets; unknown status ignored", () => {
    const g = groupByStatus(null as never);
    expect(g["queued"]).toEqual([]);
    const u = groupByStatus([{ ...a("9", "queued"), status: "weird" as never }]);
    expect(Object.values(u).every((arr) => arr.length === 0)).toBe(true);
  });
});
