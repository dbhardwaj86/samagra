import type {
  CoverageResponse, CoverageCell, CoverageConcept, CoverageState,
} from "../../types/contracts";

export const STATE_COLOR: Record<CoverageState, string> = {
  produced: "#16a34a", // green — factory shipped
  base: "#eab308",     // amber — source-ready, unproduced
  gap: "#ef4444",      // red — net-new hole
};

export interface HeatRow {
  concept: CoverageConcept;
  cells: Record<string, CoverageCell>; // lane -> cell
}
export interface HeatCommunity {
  chapter_id: string;
  rows: HeatRow[];
}

export function buildHeatmap(data: CoverageResponse | null | undefined): HeatCommunity[] {
  if (!data || !Array.isArray(data.concepts)) return [];
  const index = new Map<string, CoverageCell>();
  for (const c of data.cells ?? []) index.set(`${c.concept_id}:${c.lane}`, c);

  const byCommunity = new Map<string, HeatRow[]>();
  for (const concept of data.concepts) {
    const cells: Record<string, CoverageCell> = {};
    for (const lane of data.lanes ?? []) {
      const cell = index.get(`${concept.concept_id}:${lane}`);
      if (cell) cells[lane] = cell;
    }
    const key = concept.chapter_id ?? "other";
    const rows = byCommunity.get(key) ?? [];
    rows.push({ concept, cells });
    byCommunity.set(key, rows);
  }
  return [...byCommunity.entries()]
    .map(([chapter_id, rows]) => ({ chapter_id, rows }))
    .sort((a, b) => a.chapter_id.localeCompare(b.chapter_id));
}
