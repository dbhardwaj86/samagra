/** Build a query string for useApi(path). Drops undefined and empty-string values
 *  (but keeps 0). Encodes keys + values. Returns "" or "?k=v&k2=v2". */
export function buildQuery(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (typeof v === "string" && v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}
