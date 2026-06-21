import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { KANBAN_COLUMNS, groupByStatus } from "../../lib/kanban/columns";
import type { AssignmentsResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

export default function Assignments() {
  const { data, loading, error } = useApi<AssignmentsResponse>("/api/assignments");
  const groups = groupByStatus(Array.isArray(data?.assignments) ? data!.assignments : []);
  return (
    <div data-testid="assignments" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="assignments" size={26} label="Assignments" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Assignments</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section aria-busy={loading} style={{ marginTop: 16, display: "grid",
               gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 10 }}>
        {KANBAN_COLUMNS.map((c) => (
          <div key={c.key} data-testid="kanban-column"
               style={{ background: V.subBg, border: `1px solid ${V.line}`, borderRadius: 10, padding: 10 }}>
            <div style={{ color: V.muted, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              {c.label} · {groups[c.key].length}
            </div>
            <div data-testid={`col-${c.key}`} style={{ display: "grid", gap: 8 }}>
              {groups[c.key].map((a) => (
                <article key={a.id} data-testid="kanban-card"
                         style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 8, padding: 8 }}>
                  <div style={{ color: V.text, fontWeight: 600, fontSize: 13 }}>{a.id}</div>
                  <div style={{ color: V.muted, fontSize: 12 }}>
                    {[a.agent, a.pipeline].filter(Boolean).join(" · ")}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
