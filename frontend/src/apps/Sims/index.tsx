import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { buildQuery } from "../../lib/api/query";
import { catalogRows, subjectsOf } from "../../lib/catalog/rows";
import type { SearchResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

const PATH = "/api/search" + buildQuery({ source: "sims", limit: 2000 });

export default function Sims() {
  const { data, loading, error } = useApi<SearchResponse>(PATH);
  const rows = catalogRows(data);
  const subjects = subjectsOf(rows);
  return (
    <div data-testid="sims" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="sims" size={26} label="Simulations" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Simulations</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {subjects.map((s) => (
          <span key={s} data-testid="subject-chip"
                style={{ background: V.subBg, color: V.muted, fontSize: 11, borderRadius: 999, padding: "2px 8px" }}>{s}</span>
        ))}
      </div>
      <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 14, display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div data-testid="catalog-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "No simulations yet — run a catalog refresh."}
          </div>
        ) : rows.map((r) => (
          <article key={r.uid} data-testid="catalog-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10,
                            padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ color: V.text, fontWeight: 600 }}>{r.title}</div>
              <div style={{ color: V.muted, fontSize: 12 }}>{r.subject ?? ""}</div>
            </div>
            {r.href ? (
              <a href={r.href} target="_blank" rel="noreferrer"
                 style={{ color: V.accent, fontSize: 13, alignSelf: "center" }}>open</a>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
