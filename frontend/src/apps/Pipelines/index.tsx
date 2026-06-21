import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { stagesOf } from "../../lib/pipelines/stages";
import { ownerName } from "../../lib/org/resolve";
import type { PipelinesResponse, OrgChart } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

export default function Pipelines() {
  const { data, loading, error } = useApi<PipelinesResponse>("/api/pipelines");
  const org = useApi<OrgChart>("/api/org");   // resolves owner tokens -> display names
  const pipelines = Array.isArray(data?.pipelines) ? data!.pipelines : [];
  return (
    <div data-testid="pipelines" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="pipelines" size={26} label="Pipelines" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Pipelines</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section data-testid="pipeline-grid" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {pipelines.map((p) => (
          <article key={p.pipeline} data-testid="pipeline-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 12, padding: 14 }}>
            <div style={{ color: V.text, fontWeight: 600, marginBottom: 8 }}>{p.label}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {stagesOf(p).map((s) => (
                <div key={s.name} data-testid="phase"
                     style={{ background: V.subBg, borderRadius: 8, padding: "4px 10px",
                              color: s.isCurrent ? V.text : V.muted, fontSize: 12,
                              border: s.isCurrent ? `1px solid ${V.accent}` : `1px solid ${V.line}` }}>
                  {s.gate ? "[gate] " : ""}{s.name}: {s.status}{s.owner ? ` · ${ownerName(org.data, s.owner)}` : ""}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
