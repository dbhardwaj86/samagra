import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { buildQuery } from "../../lib/api/query";
import { catalogRows } from "../../lib/catalog/rows";
import type { SearchResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

const PATH = "/api/search" + buildQuery({ source: "munshi", limit: 200 });

export default function Munshi() {
  const { data, loading, error } = useApi<SearchResponse>(PATH);
  const rows = catalogRows(data);
  return (
    <div data-testid="munshi" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="munshi" size={26} label="Munshi" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Munshi</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div data-testid="catalog-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "Munshi not available — set MUNSHI creds and run a refresh."}
          </div>
        ) : rows.map((r) => (
          <article key={r.uid} data-testid="catalog-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ color: V.text, fontWeight: 600 }}>{r.title}</div>
            <div style={{ color: V.muted, fontSize: 12 }}>{[r.kind, r.status].filter(Boolean).join(" · ")}</div>
          </article>
        ))}
      </section>
    </div>
  );
}
