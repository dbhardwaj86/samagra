import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { buildQuery } from "../../lib/api/query";
import { catalogRows } from "../../lib/catalog/rows";
import type { SearchResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

const PATH = "/api/search" + buildQuery({ source: "textbook", limit: 200 });

export default function Lectures() {
  const { data, loading, error } = useApi<SearchResponse>(PATH);
  const rows = catalogRows(data);
  return (
    <div data-testid="lectures" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="lectures" size={26} label="Lectures" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Lectures</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div data-testid="catalog-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "No chapters yet — run a catalog refresh."}
          </div>
        ) : rows.map((r) => (
          <article key={r.uid} data-testid="catalog-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10,
                            padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ color: V.text, fontWeight: 600 }}>{r.title}</div>
              <div style={{ color: V.muted, fontSize: 12 }}>
                {[r.unit, r.chapter && `ch ${r.chapter}`, r.status].filter(Boolean).join(" · ")}
              </div>
            </div>
            {r.openHref ? (
              <a href={r.openHref} target="_blank" rel="noreferrer"
                 style={{ color: V.accent, fontSize: 13, alignSelf: "center" }}>open</a>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
