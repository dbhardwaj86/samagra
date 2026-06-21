import type { SeedType, SeedForm } from "../../types/contracts";
export const SEED_TYPES: readonly SeedType[] = [
  "concept", "question", "snippet", "simulation_idea",
  "experiment", "notebooklm_link", "rough_idea",
];
export type SeedResult =
  | { ok: true; body: Record<string, string> }
  | { ok: false; error: string };
export function buildSeed(form: SeedForm): SeedResult {
  if (!SEED_TYPES.includes(form.type)) return { ok: false, error: "pick a seed type" };
  const raw = (form.raw_text ?? "").trim();
  if (!raw) return { ok: false, error: "raw_text is required" };
  const body: Record<string, string> = { type: form.type, raw_text: raw };
  if ((form.title ?? "").trim()) body.title = form.title!.trim();
  if ((form.source_ref ?? "").trim()) body.source_ref = form.source_ref!.trim();
  return { ok: true, body };
}
