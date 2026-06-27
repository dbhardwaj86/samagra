// The PRATHAM reader — the Phase G2 student surface. A separate full-page
// experience (mounted at /learn, NO operator OS-shell chrome) that reads ONLY the
// public /api/published surface. The Saar (revision) sheet leads; each lane's
// self-contained HTML renders in a sandboxed iframe (origin-isolated from the app).
import { useState } from "react";
import { useApi } from "../../hooks/useApi";
import {
  artifactUrl, chaptersList, fileExts, laneLabel, laneSort, pickChapter, pickLane,
  type PublishedManifest,
} from "../../lib/published/manifest";
import { learnPath, parseLearnPath } from "../../lib/published/route";

const C = {
  bg: "#fbfbfd", text: "#1c1c28", muted: "#6b7280", line: "#e6e6ef",
  accent: "#2563eb", card: "#ffffff",
  font: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

export default function Pratham() {
  const { data, loading } = useApi<PublishedManifest>("/api/published");
  const chapters = chaptersList(data);
  const [sel, setSel] = useState(() => parseLearnPath(window.location.pathname));

  const chapter = pickChapter(chapters, sel.chapter);
  const lanes = chapter ? laneSort(chapter.artifacts.map((a) => a.lane)) : [];
  const lane = pickLane(lanes, sel.lane);
  const artifact = chapter?.artifacts.find((a) => a.lane === lane);
  const hasDocx = fileExts(artifact).includes("docx");

  // MVP nav: pushState keeps the URL shareable/deep-linkable, but we deliberately
  // do NOT add a popstate listener (back/forward won't re-sync selection) — a known
  // G2 scope choice. The palette is a standalone PRATHAM palette (NOT operator theme
  // tokens) on purpose: /learn is a separate student surface, not the OS console.
  function go(nextChapter?: string, nextLane?: string) {
    setSel({ chapter: nextChapter, lane: nextLane });
    window.history.pushState(null, "", learnPath(nextChapter, nextLane));
  }

  return (
    <div data-testid="pratham" style={{
      position: "fixed", inset: 0, display: "flex", flexDirection: "column",
      background: C.bg, color: C.text, font: `15px ${C.font}`,
    }}>
      <header style={{
        padding: "14px 22px", borderBottom: `1px solid ${C.line}`,
        display: "flex", alignItems: "baseline", gap: 10,
      }}>
        <strong style={{ fontSize: 18, letterSpacing: 0.2 }}>PRATHAM</strong>
        <span style={{ color: C.muted, fontSize: 13 }}>Published revision corpus</span>
      </header>

      {chapters.length === 0 ? (
        <div data-testid="pratham-empty" aria-busy={loading} style={{
          margin: "auto", color: C.muted, textAlign: "center", padding: 40,
        }}>
          {loading ? "Loading…" : "Nothing published yet."}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <nav style={{
            width: 240, borderRight: `1px solid ${C.line}`, overflowY: "auto", padding: 10,
          }}>
            {chapters.map((c) => (
              <button key={c.chapter} data-testid={`pratham-chapter-${c.chapter}`}
                onClick={() => go(c.chapter, undefined)}
                style={{
                  display: "block", width: "100%", textAlign: "left", border: 0,
                  background: c.chapter === chapter?.chapter
                    ? `color-mix(in srgb, ${C.accent} 12%, transparent)` : "transparent",
                  color: C.text, font: "inherit", padding: "8px 10px",
                  borderRadius: 8, cursor: "pointer",
                }}>
                {c.title ?? c.chapter}
              </button>
            ))}
          </nav>

          <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{
              display: "flex", gap: 6, padding: "10px 14px", flexWrap: "wrap",
              borderBottom: `1px solid ${C.line}`, alignItems: "center",
            }}>
              {lanes.map((l) => {
                const lab = laneLabel(l);
                return (
                  <button key={l} data-testid={`pratham-lane-${l}`}
                    onClick={() => go(chapter?.chapter, l)} title={lab.gloss}
                    style={{
                      border: `1px solid ${l === lane ? C.accent : C.line}`,
                      background: l === lane ? C.accent : C.card,
                      color: l === lane ? "#fff" : C.text, font: "inherit",
                      padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                    }}>
                    {lab.name}
                  </button>
                );
              })}
              {hasDocx && chapter && lane ? (
                <a data-testid="pratham-docx"
                  href={artifactUrl(chapter.chapter, lane, "docx")}
                  style={{ marginLeft: "auto", color: C.accent, fontSize: 13 }}>
                  Download .docx
                </a>
              ) : null}
            </div>
            {chapter && lane ? (
              <iframe data-testid="pratham-frame"
                title={`${chapter.title ?? chapter.chapter} — ${laneLabel(lane).name}`}
                src={artifactUrl(chapter.chapter, lane)}
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
                style={{ flex: 1, border: 0, width: "100%", background: "#fff" }} />
            ) : null}
          </main>
        </div>
      )}
    </div>
  );
}
