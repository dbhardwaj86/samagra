import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { resolveOwner } from "../../lib/org/resolve";
import type { OrgChart, OrgPerson } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

function Node({ p }: { p: OrgPerson }) {
  return (
    <div data-testid="org-node"
         style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10,
                  padding: "8px 12px", minWidth: 150, textAlign: "center" }}>
      <div style={{ color: V.text, fontWeight: 600 }}>{p.name}</div>
      <div style={{ color: V.muted, fontSize: 12 }}>{p.role}</div>
    </div>
  );
}

export default function Org() {
  const { data, loading, error } = useApi<OrgChart>("/api/org");
  const board = Array.isArray(data?.board) ? data!.board : [];
  const workers = Array.isArray(data?.workers) ? data!.workers : [];
  const ownerTokens = data?.owners ? Object.keys(data.owners) : [];
  return (
    <div data-testid="org" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="org" size={26} label="Org Chart" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Org Chart</h1>
      </header>
      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <div data-testid="org-tree" aria-busy={loading}
           style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        {data?.chairman ? <Node p={data.chairman} /> : null}
        <div data-testid="org-board" style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {board.map((b) => <Node key={b.id} p={b} />)}
        </div>
        <div data-testid="org-workers" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          {workers.map((w) => <Node key={w.id} p={w} />)}
        </div>
        {ownerTokens.length ? (
          <div data-testid="org-owners" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {ownerTokens.map((token) => (
              <span key={token} data-testid="owner-chip"
                    style={{ color: V.muted, fontSize: 12, border: `1px solid ${V.line}`,
                             borderRadius: 999, padding: "2px 10px" }}>
                {resolveOwner(data, token).name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
