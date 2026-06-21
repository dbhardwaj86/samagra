import { useState } from "react";
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { buildQuery } from "../../lib/api/query";
import { QTYPES, questionRows, questionError } from "../../lib/questions/facets";
import type { QuestionsResponse, QuestionFacets } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

const ACTIVE_BG = "color-mix(in srgb, var(--samagra-accent) 18%, transparent)";

export default function Questions() {
  // Selected subject is baked into the /api/questions path; empty = no filter.
  // useApi re-fires when the path string changes, so this drives the refetch.
  const [subject, setSubject] = useState("");
  const qPath = "/api/questions" + buildQuery({ subject, limit: 50 });
  const { data, loading, error } = useApi<QuestionsResponse>(qPath);
  const { data: facetData } = useApi<QuestionFacets>("/api/questions/facets");
  const subjects = Array.isArray(facetData?.subjects) ? facetData!.subjects : [];
  const rows = questionRows(data);
  const notice = questionError(data);   // in-body QX-absent notice (optional)
  return (
    <div data-testid="questions" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="questions" size={26} label="Questions" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Questions</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      {notice ? <div data-testid="questions-notice" style={{ color: V.muted, marginTop: 8 }}>{notice}</div> : null}
      {subjects.length ? (
        <div data-testid="subject-filters" style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {subjects.map((s) => {
            const active = subject === s;
            return (
              <button key={s} type="button" data-testid="subject-chip"
                      aria-pressed={active}
                      onClick={() => setSubject(active ? "" : s)}
                      style={{ background: active ? ACTIVE_BG : V.subBg, color: active ? V.text : V.muted,
                               border: `1px solid ${active ? V.accent : V.line}`, cursor: "pointer",
                               fontSize: 11, borderRadius: 999, padding: "2px 8px", fontFamily: V.font }}>{s}</button>
            );
          })}
        </div>
      ) : null}
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {QTYPES.map((t) => (
          <span key={t} data-testid="qtype-chip"
                style={{ background: V.subBg, color: V.muted, fontSize: 11, borderRadius: 999, padding: "2px 8px" }}>{t}</span>
        ))}
      </div>
      <section data-testid="questions-list" aria-busy={loading} style={{ marginTop: 14, display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div data-testid="questions-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "No questions to show."}
          </div>
        ) : rows.map((q) => (
          <article key={q.q_uid} data-testid="question-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ color: V.text, fontSize: 13 }}>{q.text /* preview snippet */}</div>
            <div style={{ color: V.muted, fontSize: 12, marginTop: 4 }}>
              {[q.q_type, q.subject, q.chapter, q.difficulty].filter(Boolean).join(" · ")}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
