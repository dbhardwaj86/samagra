import type { SearchResponse, SearchResult } from "../../types/contracts";

export interface CatalogRow {
  uid: string;
  title: string;
  subject: string | null;
  unit: string | null;
  chapter: string | null;
  status: string | null;
  kind: string;
  url: string | null;
  openHref: string | null;        // safe /open?path= link (file rows), or null
  href: string | null;            // unified link target: file-open, else a safe web url
  meta: Record<string, unknown>;
}

/** Build the safe file-open href for a catalog path (null when no path). The
 *  backend /open enforces ALLOWED_ROOTS; we only link rows that carry a path. */
export function openHref(path: string | null | undefined): string | null {
  if (!path) return null;
  return "/open?path=" + encodeURIComponent(path);
}

/** A safe link target for a row's `url` field: http(s) or root-relative only.
 *  Guards against javascript:/data: and other unsafe schemes. */
export function safeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  return u.startsWith("/") || /^https?:\/\//i.test(u) ? u : null;
}

function toRow(r: SearchResult): CatalogRow {
  const fileHref = openHref(r.path);
  return {
    uid: r.uid,
    title: r.title,
    subject: r.subject ?? null,
    unit: r.unit ?? null,
    chapter: r.chapter ?? null,
    status: r.status ?? null,
    kind: r.kind,
    url: r.url ?? null,
    openHref: fileHref,
    href: fileHref ?? safeUrl(r.url),   // prefer file open; fall back to a safe web url
    meta: r.meta && typeof r.meta === "object" ? r.meta : {},
  };
}

export function catalogRows(data: SearchResponse | null | undefined): CatalogRow[] {
  const results = data?.results;
  return Array.isArray(results) ? results.map(toRow) : [];
}

export function subjectsOf(rows: CatalogRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.subject) set.add(r.subject);
  return Array.from(set).sort();
}
