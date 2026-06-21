import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { activityLines } from "../../lib/activity/format";
import type { AssignmentsResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

export default function Activity() {
  const { data, loading, error } = useApi<AssignmentsResponse>("/api/assignments");
  const lines = activityLines(data);
  return (
    <div data-testid="activity" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="activity" size={26} label="Activity" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Activity</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section data-testid="activity-list" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 6 }}>
        {lines.length === 0 ? (
          <div data-testid="activity-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "No activity recorded yet."}
          </div>
        ) : lines.map((l) => (
          <article key={l.id} data-testid="activity-row"
                   style={{ borderLeft: `2px solid ${V.line}`, paddingLeft: 10 }}>
            <div style={{ color: V.text, fontSize: 13 }}>
              <strong>{l.who}</strong> {l.what}
            </div>
            <div style={{ color: V.muted, fontSize: 12 }}>
              {[l.when, l.note].filter(Boolean).join(" · ")}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
