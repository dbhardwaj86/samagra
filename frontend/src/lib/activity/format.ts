import type { AssignmentsResponse, EventItem } from "../../types/contracts";

export interface ActivityLine { id: number; when: string; who: string; what: string; note: string; }

export function formatEvent(e: EventItem): ActivityLine {
  return {
    id: e.id,
    when: e.ts ?? "",
    who: e.actor ?? "",
    what: e.verb ?? "",
    note: e.note ?? "",
  };
}

export function activityLines(data: AssignmentsResponse | null | undefined): ActivityLine[] {
  const events = data?.events;
  return Array.isArray(events) ? events.map(formatEvent) : [];
}
