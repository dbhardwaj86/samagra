// src/apps/Dashboard/index.tsx
// THIN presentational wrapper (E1.19, VISUAL). Reads `/api/overview` via the
// typed `useApi` fetch hook and renders hero stats. The per-source `summary`
// shape is heterogeneous (api.md §3) and read defensively — only the flat
// `n_artifacts` headline (Σ across sources) is pinned by the loop's RTL smoke;
// layout / density / pixel parity is a separate human QA pass.
import { useApi } from "../../hooks/useApi";

// Defensive view of the `/api/overview` payload (api.md §2). Per-source `summary`
// is deliberately left `unknown` — consumers narrow it where needed.
interface OverviewSource {
  source?: string;
  label?: string;
  available?: number;
  n_artifacts?: number;
  refreshed_at?: string;
  summary?: unknown;
}
interface Overview {
  refreshed_at?: string;
  sources?: OverviewSource[];
}

/** Σ sources[].n_artifacts — the "Artifacts (total)" headline (api.md §3). Reads
 *  the array defensively: a missing/non-array `sources` yields 0, a non-numeric
 *  `n_artifacts` contributes 0. */
function totalArtifacts(ov: Overview | null): number {
  const sources = Array.isArray(ov?.sources) ? ov!.sources : [];
  return sources.reduce((sum, s) => {
    const n = typeof s?.n_artifacts === "number" ? s.n_artifacts : 0;
    return sum + n;
  }, 0);
}

export default function Dashboard() {
  const { data, loading, error } = useApi<Overview>("/api/overview");
  const artifacts = totalArtifacts(data);

  return (
    <div className="app-dashboard" data-testid="dashboard">
      {error ? <div role="alert">{error}</div> : null}
      <section className="hero-stats" aria-busy={loading}>
        <div className="stat" data-stat="artifacts">
          <div className="stat-value">{artifacts}</div>
          <div className="stat-label">Artifacts</div>
        </div>
      </section>
    </div>
  );
}
