import type { Assignment, AssignmentStatus } from "../../types/contracts";

export interface KanbanColumn { key: AssignmentStatus; label: string; }

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { key: "queued", label: "Queued" },
  { key: "running", label: "Running" },
  { key: "in-review", label: "In review" },
  { key: "approved", label: "Approved" },
  { key: "changes", label: "Changes" },
];

export function groupByStatus(assignments: Assignment[]): Record<AssignmentStatus, Assignment[]> {
  const groups = {
    queued: [], running: [], "in-review": [], approved: [], changes: [],
  } as Record<AssignmentStatus, Assignment[]>;
  if (!Array.isArray(assignments)) return groups;
  for (const a of assignments) {
    const bucket = groups[a.status as AssignmentStatus];
    if (bucket) bucket.push(a);   // unknown status → ignored, never crashes
  }
  return groups;
}
