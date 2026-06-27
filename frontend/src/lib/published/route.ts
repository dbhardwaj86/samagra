// Pure path helpers for the standalone /learn reader (no router dependency).

export interface LearnSelection {
  chapter?: string;
  lane?: string;
}

export function isLearnPath(pathname: string): boolean {
  return pathname === "/learn" || pathname.startsWith("/learn/");
}

export function parseLearnPath(pathname: string): LearnSelection {
  if (!isLearnPath(pathname)) return {};
  const rest = pathname.slice("/learn".length).replace(/^\/+/, "");
  if (!rest) return {};
  const [chapter, lane] = rest.split("/");
  const out: LearnSelection = {};
  if (chapter) out.chapter = decodeURIComponent(chapter);
  if (lane) out.lane = decodeURIComponent(lane);
  return out;
}

export function learnPath(chapter?: string, lane?: string): string {
  if (!chapter) return "/learn";
  const c = encodeURIComponent(chapter);
  return lane ? `/learn/${c}/${encodeURIComponent(lane)}` : `/learn/${c}`;
}
