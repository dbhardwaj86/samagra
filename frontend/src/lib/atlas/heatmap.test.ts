import { describe, it, expect } from "vitest";
import { buildHeatmap, STATE_COLOR } from "./heatmap";
import type { CoverageResponse } from "../../types/contracts";

const data: CoverageResponse = {
  lanes: ["paper", "samadhan"],
  concepts: [
    { concept_id: 1, label: "gauss law", chapter_id: "physics.electrostatics", demand_size: 700, paper_count: 50 },
    { concept_id: 2, label: "ac circuits", chapter_id: "physics.alternating_currents", demand_size: 170, paper_count: 60 },
  ],
  cells: [
    { concept_id: 1, lane: "paper", state: "base", produced_n: 0, base_n: 50 },
    { concept_id: 1, lane: "samadhan", state: "gap", produced_n: 0, base_n: 0 },
    { concept_id: 2, lane: "paper", state: "produced", produced_n: 1, base_n: 60 },
  ],
  gaps: [],
  meta: {},
};

describe("buildHeatmap", () => {
  it("groups rows by community (chapter_id), sorted, with cells indexed by lane", () => {
    const communities = buildHeatmap(data);
    expect(communities.map((c) => c.chapter_id)).toEqual([
      "physics.alternating_currents", "physics.electrostatics",
    ]);
    const electro = communities.find((c) => c.chapter_id === "physics.electrostatics")!;
    expect(electro.rows[0].concept.label).toBe("gauss law");
    expect(electro.rows[0].cells.samadhan.state).toBe("gap");
  });
  it("defensive: null / missing fields -> []", () => {
    expect(buildHeatmap(null)).toEqual([]);
    expect(buildHeatmap({ ...data, concepts: undefined as never })).toEqual([]);
  });
  it("exposes a colour for each state", () => {
    expect(STATE_COLOR.produced).toBeTruthy();
    expect(STATE_COLOR.base).toBeTruthy();
    expect(STATE_COLOR.gap).toBeTruthy();
  });
});
