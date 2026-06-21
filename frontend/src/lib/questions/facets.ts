import type { Question, QuestionsResponse } from "../../types/contracts";

export const QTYPES: string[] = [
  "mcq_single", "integer", "numeric", "mcq_multi",
  "matrix_match", "assertion_reason", "comprehension", "true_false",
];

export function questionRows(data: QuestionsResponse | null | undefined): Question[] {
  const results = data?.results;
  return Array.isArray(results) ? results : [];
}

/** The in-body error string (HTTP 200) when QX is absent, else null.
 *  Empty state is gated on rows.length, NOT on this — `error` is optional. */
export function questionError(data: QuestionsResponse | null | undefined): string | null {
  return data?.error ?? null;
}
