import { describe, it, expect } from "vitest";
import { stagesOf, pipelineProgress } from "./stages";
import type { Pipeline } from "../../types/contracts";

const p: Pipeline = {
  pipeline: "textbook", label: "Lectures (textbook)", created: "x", updated: "y", current: "approve",
  phases: {
    draft: { status: "done", owner: "codex", gate: false, started: null, finished: null, artifacts: [], error: null },
    enrich: { status: "done", owner: "codex", gate: false, started: null, finished: null, artifacts: [], error: null },
    approve: { status: "awaiting_gate", owner: "human", gate: true, started: null, finished: null, artifacts: [], error: null },
    export: { status: "pending", owner: "teachingos", gate: false, started: null, finished: null, artifacts: [], error: null },
  },
};

describe("stagesOf", () => {
  it("ordered stages, current flagged, gate carried", () => {
    const s = stagesOf(p);
    expect(s.map((x) => x.name)).toEqual(["draft", "enrich", "approve", "export"]);
    expect(s.find((x) => x.name === "approve")).toMatchObject({ isCurrent: true, gate: true, owner: "human" });
    expect(s.filter((x) => x.isCurrent)).toHaveLength(1);
  });
  it("defensive: missing phases → []", () => {
    expect(stagesOf({ ...p, phases: undefined as never })).toEqual([]);
  });
});

describe("pipelineProgress", () => {
  it("counts done / total", () => {
    expect(pipelineProgress(p)).toEqual({ done: 2, total: 4 });
    expect(pipelineProgress({ ...p, phases: {} })).toEqual({ done: 0, total: 0 });
  });
});
