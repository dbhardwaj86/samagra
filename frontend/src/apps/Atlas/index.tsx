import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { buildHeatmap, STATE_COLOR } from "../../lib/atlas/heatmap";
import type { CoverageResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

export default function Atlas() {
  const { data, loading, error } = useApi<CoverageResponse>("/api/coverage");
  const lanes = Array.isArray(data?.lanes) ? data!.lanes : [];
  const communities = buildHeatmap(data);
  const gaps = Array.isArray(data?.gaps) ? data!.gaps : [];
  const notice = error || data?.error || null;

  return (
    <div data-testid="atlas" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="atlas" size={26} label="Atlas" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Concept Atlas</h1>
      </header>
      {notice ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{notice}</div> : null}

      <section data-testid="atlas-grid" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 16 }}>
        {communities.map((com) => (
          <div key={com.chapter_id}>
            <div style={{ color: V.muted, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              {com.chapter_id}
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              {com.rows.map((row) => (
                <div key={row.concept.concept_id}
                     style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 8, alignItems: "center" }}>
                  <div style={{ color: V.text, fontSize: 13 }} title={`demand ${row.concept.demand_size}`}>
                    {row.concept.label}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {lanes.map((lane) => {
                      const cell = row.cells[lane];
                      return (
                        <div key={lane} data-testid="atlas-cell"
                             title={`${lane}: ${cell ? cell.state : "—"}`}
                             style={{ width: 26, height: 18, borderRadius: 4,
                                      background: cell ? STATE_COLOR[cell.state] : V.subBg }} />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section data-testid="atlas-gaps" style={{ marginTop: 20 }}>
        <h2 style={{ color: V.text, fontSize: 14 }}>Demand queue (deficit-ranked)</h2>
        <div style={{ display: "grid", gap: 8 }}>
          {gaps.map((g) => (
            <article key={g.rank} data-testid="atlas-gap"
                     style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10, padding: "8px 12px" }}>
              <div style={{ color: V.text, fontSize: 13 }}>
                #{g.rank} · {g.lane} · deficit {g.deficit_score} · demand {g.demand_size}
              </div>
              <code style={{ color: V.muted, fontSize: 12, userSelect: "all" }}>{g.plan_command}</code>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
