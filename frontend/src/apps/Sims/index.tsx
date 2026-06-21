import { useState } from "react";
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { filterSims, groupByGrade } from "../../lib/sims/deployed";
import type { SimsResponse } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

export default function Sims() {
  const { data, loading, error } = useApi<SimsResponse>("/api/sims");
  const [query, setQuery] = useState("");
  const rows = Array.isArray(data?.sims) ? data!.sims : [];
  const groups = groupByGrade(filterSims(rows, query));
  return (
    <div data-testid="sims" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="sims" size={26} label="Simulations" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Simulations</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <div style={{ marginTop: 10 }}>
        <input
          data-testid="sims-search"
          aria-label="search"
          placeholder="Search title, subject, or id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", background: V.subBg, color: V.text, border: `1px solid ${V.line}`,
                   borderRadius: 8, padding: "6px 10px", fontFamily: V.font, fontSize: 13 }}
        />
      </div>
      <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {groups.length === 0 ? (
          <div data-testid="catalog-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "No simulations to show."}
          </div>
        ) : groups.map((g) => (
          <div key={g.grade}>
            <div style={{ color: V.muted, fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{g.grade}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {g.rows.map((r) => (
                <article key={r.id} data-testid="catalog-row"
                         style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10,
                                  padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ color: V.text, fontWeight: 600 }}>{r.title}</div>
                    <div style={{ color: V.muted, fontSize: 12 }}>{r.subject ?? ""}</div>
                  </div>
                  <a href={r.url} target="_blank" rel="noreferrer"
                     style={{ color: V.accent, fontSize: 13, alignSelf: "center" }}>open</a>
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
