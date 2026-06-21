import type { MunshiKind, MunshiCaptureForm } from "../../types/contracts";
const REQUIRED: Record<MunshiKind, readonly string[]> = {
  todo: ["assignee", "task"],
  note: ["student", "issue"],
  followup: ["date", "note"],
};
const OPTIONAL: Record<MunshiKind, readonly string[]> = {
  todo: ["due"], note: ["label"], followup: ["person"],
};
export type BuildResult =
  | { ok: true; body: Record<string, string> }
  | { ok: false; error: string };
export function buildMunshiCapture(form: MunshiCaptureForm): BuildResult {
  const req = REQUIRED[form.kind];
  if (!req) return { ok: false, error: "kind must be todo, note, or followup" };
  const missing = req.filter((k) => !(form[k] ?? "").trim());
  if (missing.length) return { ok: false, error: `Missing: ${missing.join(", ")}` };
  const body: Record<string, string> = { kind: form.kind };
  for (const k of req) body[k] = form[k].trim();
  for (const k of OPTIONAL[form.kind]) if ((form[k] ?? "").trim()) body[k] = form[k].trim();
  return { ok: true, body };
}
