import type { SimRow } from "../../types/contracts";
export function filterSims(rows: SimRow[], q: string): SimRow[] {
  const t = q.trim().toLowerCase();
  if (!t) return rows;
  return rows.filter((r) =>
    r.title.toLowerCase().includes(t) ||
    (r.subject ?? "").toLowerCase().includes(t) ||
    r.id.includes(t));
}
export function groupByGrade(rows: SimRow[]): { grade: string; rows: SimRow[] }[] {
  const map = new Map<string, SimRow[]>();
  for (const r of rows) {
    const g = r.grade ?? "Other";
    const list = map.get(g) ?? [];
    list.push(r);
    map.set(g, list);
  }
  return [...map.entries()].map(([grade, rs]) => ({ grade, rows: rs }));
}
