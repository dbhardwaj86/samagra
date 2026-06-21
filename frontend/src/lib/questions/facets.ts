import { buildQuery } from "../api/query";
import type {
  Question, QuestionsResponse, QuestionMode,
} from "../../types/contracts";

export const MODES: QuestionMode[] = ["exact", "semantic"];
export const FACET_DIMS = ["subject", "chapter", "qtype"] as const;
export type FacetDim = (typeof FACET_DIMS)[number];

export interface QuestionParams {
  q?: string;
  mode?: QuestionMode;
  subject?: string;
  chapter?: string;
  qtype?: string;
  page?: number;
}

/** Path for useApi: a change to it drives the refetch. Empty params are dropped. */
export function buildQuestionsPath(p: QuestionParams): string {
  return "/api/questions" + buildQuery({
    q: p.q, mode: p.mode, subject: p.subject,
    chapter: p.chapter, qtype: p.qtype, page: p.page,
  });
}

type R = QuestionsResponse | null | undefined;

export function questionRows(data: R): Question[] {
  return Array.isArray(data?.results) ? data!.results : [];
}

/** In-body error (HTTP 200) when the QX backend is unreachable, else null. */
export function questionError(data: R): string | null {
  return data?.error ?? null;
}

export function searchMode(data: R): QuestionMode {
  return data?.mode === "semantic" ? "semantic" : "exact";
}

/** True when a semantic search fell back to exact (QX SemanticUnavailable). */
export function isDegraded(data: R): boolean {
  return data?.degraded === true;
}

export function totalCount(data: R): number {
  return typeof data?.total === "number" ? data!.total : 0;
}

/** The value names for a facet dimension (subject / chapter / qtype), [] if absent. */
export function facetNames(data: R, dim: FacetDim): string[] {
  const pairs = data?.facets?.[dim];
  return Array.isArray(pairs) ? pairs.map((p) => String(p[0])).filter(Boolean) : [];
}
