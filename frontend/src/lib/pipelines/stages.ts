import type { Pipeline, PipelineStatus } from "../../types/contracts";

export interface Stage {
  name: string;
  status: PipelineStatus;
  owner: string | null;
  gate: boolean;
  isCurrent: boolean;
}

export function stagesOf(p: Pipeline): Stage[] {
  const phases = p?.phases;
  if (!phases || typeof phases !== "object") return [];
  return Object.entries(phases).map(([name, ph]) => ({
    name,
    status: ph.status,
    owner: ph.owner ?? null,
    gate: Boolean(ph.gate),
    isCurrent: name === p.current,
  }));
}

export function pipelineProgress(p: Pipeline): { done: number; total: number } {
  const stages = stagesOf(p);
  return { done: stages.filter((s) => s.status === "done").length, total: stages.length };
}
