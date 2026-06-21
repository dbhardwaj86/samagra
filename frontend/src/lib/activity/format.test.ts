import { describe, it, expect } from "vitest";
import { activityLines, formatEvent } from "./format";
import type { AssignmentsResponse, EventItem } from "../../types/contracts";

const ev = (over: Partial<EventItem>): EventItem => ({
  id: 1, ts: "2026-06-20T10:00:00", actor: "codex", verb: "status:in-review",
  assignment_id: "A1", subsystem: null, subsystem_ref: null, note: null, ...over,
});

describe("formatEvent", () => {
  it("derives who/what/when/note", () => {
    const l = formatEvent(ev({ note: "looks good" }));
    expect(l).toMatchObject({ id: 1, who: "codex", what: "status:in-review", note: "looks good" });
    expect(l.when).toContain("2026-06-20");
  });
  it("tolerates null note/actor", () => {
    const l = formatEvent(ev({ actor: null as never, note: null }));
    expect(l.who).toBe("");
    expect(l.note).toBe("");
  });
});

describe("activityLines", () => {
  it("maps events defensively; null data → []", () => {
    const data: AssignmentsResponse = { assignments: [], events: [ev({ id: 2 }), ev({ id: 3 })] };
    expect(activityLines(data).map((l) => l.id)).toEqual([2, 3]);
    expect(activityLines(null)).toEqual([]);
    expect(activityLines({ events: undefined } as never)).toEqual([]);
  });
});
