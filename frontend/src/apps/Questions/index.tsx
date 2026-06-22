import { useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import {
  MODES, buildQuestionsPath, questionRows, questionError,
  isDegraded, totalCount, facetNames,
} from "../../lib/questions/facets";
import { sanitizeQxHtml } from "../../lib/questions/sanitize";
import type { QuestionsResponse, QuestionMode } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

const ACTIVE_BG = "color-mix(in srgb, var(--samagra-accent) 18%, transparent)";

// Scoped styling for the QX-rendered question HTML: hide the equation-image
// fallback once KaTeX typesets, bound figure size, and lay out options.
const QX_CSS = `
.qx-html { color: ${V.text}; font-size: 13px; line-height: 1.5; }
.qx-html .mwrap { display: inline-block; vertical-align: middle; }
.qx-html .eq-hidden { display: none; }
.qx-html .fig { max-width: 100%; max-height: 320px; display: block; margin: 8px 0; }
.qx-html .opt { margin-top: 4px; }
.qx-html .opt-label { color: ${V.muted}; font-weight: 600; margin-right: 4px; }
.qx-html .passage { margin-bottom: 8px; }
.qx-html .ptag { color: ${V.muted}; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
.qx-html .matrix-table { border-collapse: collapse; margin-top: 6px; }
.qx-html .matrix-table td, .qx-html .matrix-table th { border: 1px solid ${V.line}; padding: 3px 8px; }
`;

const chipStyle = (active: boolean) => ({
  background: active ? ACTIVE_BG : V.subBg, color: active ? V.text : V.muted,
  border: `1px solid ${active ? V.accent : V.line}`, cursor: "pointer",
  fontSize: 11, borderRadius: 999, padding: "2px 8px", fontFamily: V.font,
});

export default function Questions() {
  const [q, setQ] = useState("");          // live input value
  const [query, setQuery] = useState("");  // submitted query (drives the fetch)
  const [mode, setMode] = useState<QuestionMode>("exact");
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [qtype, setQtype] = useState("");
  const [page, setPage] = useState(1);

  // A change to this path re-fires useApi → the single source of truth for the
  // proxied QX search (exact/semantic, rendered HTML, filter-scoped facets).
  const path = buildQuestionsPath({
    q: query, mode,
    subject: subject || undefined, chapter: chapter || undefined,
    qtype: qtype || undefined, page: page > 1 ? page : undefined,
  });
  const { data, loading, error } = useApi<QuestionsResponse>(path);

  const rows = questionRows(data);
  const notice = questionError(data);
  const degraded = isDegraded(data);
  const total = totalCount(data);
  const pageSize = data?.page_size || 25;
  const subjects = facetNames(data, "subject");
  const chapters = facetNames(data, "chapter");
  const qtypes = facetNames(data, "qtype");

  // Typeset every KaTeX span the QX engine emitted; on failure, reveal the
  // adjacent equation-image fallback instead of showing nothing.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>(".ktx[data-tex]").forEach((el) => {
      try {
        katex.render(el.getAttribute("data-tex") || "", el,
          { throwOnError: false, displayMode: false });
      } catch {
        const img = el.nextElementSibling;
        if (img) img.classList.remove("eq-hidden");
      }
    });
  }, [data]);

  function toggle(value: string, current: string, set: (v: string) => void) {
    set(current === value ? "" : value);
    setPage(1);
  }
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setQuery(q.trim());
    setPage(1);
  }
  function pickMode(m: QuestionMode) {
    setMode(m);
    setPage(1);
  }

  function chips(testid: string, items: string[], active: string, set: (v: string) => void) {
    if (!items.length) return null;
    return (
      <div data-testid={testid} style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {items.map((s) => {
          const on = active === s;
          return (
            <button key={s} type="button" data-testid={`${testid}-chip`} aria-pressed={on}
                    onClick={() => toggle(s, active, set)} style={chipStyle(on)}>{s}</button>
          );
        })}
      </div>
    );
  }

  return (
    <div data-testid="questions" style={{ padding: 20, fontFamily: V.font }}>
      <style>{QX_CSS}</style>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="questions" size={26} label="Questions" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Questions</h1>
      </header>

      <form data-testid="q-form" onSubmit={onSubmit}
            style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input data-testid="q-input" aria-label="search questions" value={q}
               onChange={(e) => setQ(e.target.value)} placeholder="Search questions…"
               style={{ flex: "1 1 220px", background: V.subBg, color: V.text,
                        border: `1px solid ${V.line}`, borderRadius: 8, padding: "6px 10px",
                        fontFamily: V.font, fontSize: 13 }} />
        <button type="submit"
                style={{ background: V.accent, color: "#fff", border: "none", borderRadius: 8,
                         padding: "7px 14px", fontFamily: V.font, fontSize: 13, cursor: "pointer" }}>
          Search
        </button>
        <div role="group" aria-label="search mode" style={{ display: "flex", gap: 4 }}>
          {MODES.map((m) => {
            const on = mode === m;
            return (
              <button key={m} type="button" aria-pressed={on} onClick={() => pickMode(m)}
                      title={m === "semantic" ? "rank by meaning (BGE embeddings)" : "literal text match"}
                      style={{ ...chipStyle(on), textTransform: "capitalize", padding: "5px 12px", fontSize: 12 }}>
                {m}
              </button>
            );
          })}
        </div>
      </form>

      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      {notice ? <div data-testid="questions-notice" style={{ color: V.muted, marginTop: 8 }}>{notice}</div> : null}
      {degraded ? (
        <div data-testid="questions-degraded" style={{ color: V.muted, marginTop: 8, fontSize: 12 }}>
          Semantic search unavailable — showing exact matches.
        </div>
      ) : null}

      {chips("subject-filters", subjects, subject, setSubject)}
      {chips("chapter-filters", chapters, chapter, setChapter)}
      {chips("qtype-filters", qtypes, qtype, setQtype)}

      <div style={{ color: V.muted, fontSize: 12, marginTop: 12 }}>
        {total} result{total === 1 ? "" : "s"}{mode === "semantic" ? " · semantic" : ""}
      </div>

      <section ref={listRef} data-testid="questions-list" aria-busy={loading}
               style={{ marginTop: 8, display: "grid", gap: 10 }}>
        {rows.length === 0 ? (
          <div data-testid="questions-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "No questions to show."}
          </div>
        ) : rows.map((row) => (
          <article key={row.q_uid} data-testid="question-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`,
                            borderRadius: 10, padding: "10px 12px" }}>
            {/* W1.2: sanitize QX HTML (strip script, event handlers, js URLs) first. */}
            <div className="qx-html" dangerouslySetInnerHTML={{ __html: sanitizeQxHtml(row.html) }} />
            <div style={{ color: V.muted, fontSize: 12, marginTop: 6 }}>
              {[row.q_type, row.subject, row.chapter, row.difficulty].filter(Boolean).join(" · ")}
            </div>
          </article>
        ))}
      </section>

      {total > pageSize ? (
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                  style={{ ...chipStyle(false), opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
          <span style={{ color: V.muted, fontSize: 12 }}>
            Page {page} / {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          <button type="button" disabled={page >= Math.ceil(total / pageSize)}
                  onClick={() => setPage((p) => p + 1)}
                  style={{ ...chipStyle(false), opacity: page >= Math.ceil(total / pageSize) ? 0.5 : 1 }}>Next</button>
        </div>
      ) : null}
    </div>
  );
}
