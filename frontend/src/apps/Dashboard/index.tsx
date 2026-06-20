// src/apps/Dashboard/index.tsx
// AP1 FIDELITY — Dashboard (README §Apps#1 Dashboard, #4f46e5 940×610).
// THIN presentational wrapper. It reads `/api/overview` via the typed `useApi`
// fetch hook (the live Σ-artifacts headline) and renders the documented surface
// VERBATIM from the prototype's `app_dashboard` (.dc.html ~L266):
//   greeting header + "● 11/11 tests green" pill · stat grid (auto-fill
//   minmax(140px,1fr)) · Pipelines card (labeled progress bars) · Board card
//   (avatars + green status dots) · Recent-activity accent-left-border timeline.
//
// FIDELITY rules (FD1/FD2):
//   • All surface colors/sizes are driven by the theme tokens via the
//     `--samagra-*` CSS vars (FD1), so the surface renders correctly in aqua,
//     console AND samagra — no hardcoded per-theme value where the prototype
//     used `t.*`. The Artifacts stat number is the THEME accent (`var(--samagra
//     -accent)`); the other stat numbers are the prototype's fixed per-metric
//     hexes; the success-green pill/dots are the hardcoded status color #16a34a.
//   • Icons are real 24×24 line-icon <svg>s via the FD2 <Icon> — NEVER a letter
//     badge. The board avatars keep the prototype's initials disc (an avatar,
//     not an app glyph), per .dc.html `avatar()`.
//
// Logic stays in lib/**; this component is purely presentational beyond the
// defensive Σ-artifacts read. Per-pixel parity is a separate human QA pass.
import type { CSSProperties } from "react";
import { useApi } from "../../hooks/useApi";
import Icon from "../../components/Icon";
import { hexA } from "../../components/icons-data";

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

// Theme CSS vars (FD1) — referenced unconditionally so the surface is correct in
// every theme. `cssVar(name, fallback)` lets a node read the active theme value.
const V = {
  text: "var(--samagra-text)",
  muted: "var(--samagra-muted)",
  line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)",
  subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)",
  accent2: "var(--samagra-accent2)",
  font: "var(--samagra-font)",
} as const;

// Accent @ 50% alpha — the prototype's recent-activity left border is
// `hex(accent,0.5)`. Driven from the theme var via `color-mix` (the codebase's
// established accent-alpha pattern, see Card/Pill), so it recolors per theme
// (FD1) instead of baking a per-theme hex.
const ACCENT_HALF = "color-mix(in srgb, var(--samagra-accent) 50%, transparent)";

// Status color — hardcoded in the prototype (NOT the theme accent).
const SUCCESS = "#16a34a";

// Stat grid (proto.md L268). Numbers + labels are verbatim. The Artifacts number
// is the live Σ; `color` is a CSS value — the Artifacts tile uses the theme
// accent var (so it tracks the active theme), the rest are fixed per-metric hexes
// (the prototype's `accent2`/literal colors). `testid` scopes each tile in RTL.
interface StatDef {
  testid: string;
  label: string;
  color: string;
}
const STATS: StatDef[] = [
  { testid: "artifacts", label: "Artifacts catalogued", color: V.accent },
  { testid: "questions", label: "Questions (QX)", color: "#2563eb" },
  { testid: "chapters", label: "Chapters", color: V.accent2 },
  { testid: "simulations", label: "Simulations", color: "#7c3aed" },
  { testid: "booklets", label: "Booklets", color: "#b45309" },
  { testid: "insp", label: "INSP items", color: "#ca8a04" },
];

// Static (non-live) stat numbers, verbatim from the prototype's `stats` array.
// The Artifacts number is supplied live (Σ n_artifacts); the rest are fixed.
const STAT_NUMBERS: Record<string, string> = {
  questions: "67,276",
  chapters: "59",
  simulations: "1,554",
  booklets: "11",
  insp: "136",
};

// Pipelines (proto.md L269): [label, percent, fill-color]. accent2 → theme var.
const PIPES: { label: string; pct: number; color: string }[] = [
  { label: "Lectures · thin/thick", pct: 74, color: V.accent2 },
  { label: "Questions · QX", pct: 91, color: "#2563eb" },
  { label: "Print & Proofing", pct: 46, color: "#b45309" },
  { label: "Editorial seeds", pct: 33, color: "#c026d3" },
];

// Board (proto.md L270): [initials, name, avatar-color, role]. Rendered as
// `Claude-<name>`. Avatar colors are the prototype's fixed per-person hues.
const BOARD: { initials: string; name: string; color: string; role: string }[] = [
  { initials: "D", name: "Deepak", color: "#4f46e5", role: "CEO" },
  { initials: "K", name: "Khanak", color: "#0d9488", role: "COO" },
  { initials: "Cx", name: "Codex", color: "#db2777", role: "Architect" },
];

// Recent activity (proto.md L271): [text, when].
const LOGS: { text: string; when: string }[] = [
  { text: "Phase 0 complete — package renamed to samagra", when: "2h ago" },
  { text: "samagra.db rebuilt → 7,044 artifacts", when: "2h ago" },
  { text: "Reflect, don’t duplicate — mcd + munshi adapters", when: "5h ago" },
];

// Card surface (proto.md `card()` L246): theme card-bg + 1px theme line, r14,
// pad16 — all driven by CSS vars so the surface is theme-correct (FD1).
// NOTE: `borderColor` is declared BEFORE `borderWidth`/`borderStyle`. In jsdom's
// CSSOM the `border-color` shorthand only resolves to the CSS-var string when it
// is NOT followed by per-side longhand expansion — so the FD1 theme-var assertion
// (`toHaveStyle({ borderColor: 'var(--samagra-line)' })`) reads it correctly.
const cardStyle: CSSProperties = {
  background: V.cardBg,
  borderColor: V.line,
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: 14,
  padding: 16,
};

const sectionHeading: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: V.text,
};

/** Render `137`-style number with US (comma) thousands grouping (the prototype's
 *  literals are pre-grouped; the live Σ is grouped here so 7044 → "7,044").
 *  Deterministic by design: grouping is done with a manual regex rather than
 *  `toLocaleString("en-US")`, so the pinned UI value renders identically under a
 *  `small-icu` / ICU-less Node build (where `toLocaleString` may emit "7044").
 *  Negatives keep their sign; non-finite inputs degrade to a plain string. */
function groupNum(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const neg = n < 0;
  const digits = Math.trunc(Math.abs(n)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return neg ? `-${grouped}` : grouped;
}

export default function Dashboard() {
  const { data, loading, error } = useApi<Overview>("/api/overview");
  const artifacts = totalArtifacts(data);

  return (
    // NOTE: the root deliberately does NOT set `color` — an inherited `color`
    // ancestor makes jsdom resolve each border side to `currentColor`, which
    // collapses `getComputedStyle().borderColor` to "" and breaks the FD1
    // theme-var assertion on the cards. Text nodes set `color: V.text` locally
    // instead (the live shell paints the window body's base text color).
    <div className="app-dashboard" data-testid="dashboard" style={{ padding: 20, fontFamily: V.font }}>
      {error ? <div role="alert">{error}</div> : null}

      {/* Greeting header + tests-green pill (proto.md L273-277). */}
      <header
        data-testid="dashboard-header"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          {/* FD2: the dashboard glyph is the <Icon> 24×24 svg, NOT a letter badge. */}
          <span style={{ color: V.accent, display: "inline-flex" }}>
            <Icon name="dashboard" size={26} label="Dashboard" />
          </span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: V.text }}>
              Good morning, Deepak
            </div>
            <div style={{ fontSize: 13, color: V.muted, marginTop: 2 }}>
              SAMAGRA control plane · Phase 0 done · Phase 1 (adapters) next
            </div>
          </div>
        </div>
        <span
          data-testid="tests-pill"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 9px",
            borderRadius: 999,
            color: SUCCESS,
            background: hexA(SUCCESS, 0.12),
            whiteSpace: "nowrap",
          }}
        >
          ● 11/11 tests green
        </span>
      </header>

      {/* Stat grid — auto-fill minmax(140px,1fr) (proto.md L278). */}
      <section
        className="hero-stats"
        data-testid="stat-grid"
        aria-busy={loading}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))",
          gap: 11,
          marginBottom: 18,
        }}
      >
        {STATS.map((s) => {
          const number = s.testid === "artifacts" ? groupNum(artifacts) : STAT_NUMBERS[s.testid];
          return (
            <div
              key={s.testid}
              className="stat"
              data-stat={s.testid}
              data-testid={`stat-${s.testid}`}
              style={{
                background: V.cardBg,
                borderColor: V.line,
                borderWidth: 1,
                borderStyle: "solid",
                borderRadius: 14,
                padding: "14px 15px",
              }}
            >
              <div
                className="stat-value"
                style={{
                  fontSize: 25,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  fontVariantNumeric: "tabular-nums",
                  color: s.color,
                  fontFamily: V.font,
                }}
              >
                {number}
              </div>
              <div className="stat-label" style={{ fontSize: 12, color: V.muted, marginTop: 3, fontWeight: 500 }}>
                {s.label}
              </div>
            </div>
          );
        })}
      </section>

      {/* Two-column lower area: Pipelines | (Board + Recent activity) (L279). */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, alignItems: "start" }}>
        {/* Pipelines — labeled progress bars (L280-285). */}
        <section data-testid="pipelines" style={cardStyle}>
          <div style={{ ...sectionHeading, marginBottom: 12 }}>Pipelines</div>
          {PIPES.map((p) => (
            <div
              key={p.label}
              role="progressbar"
              aria-label={p.label}
              aria-valuenow={p.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ marginBottom: 12 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginBottom: 5,
                  color: V.muted,
                }}
              >
                <span style={{ color: V.text, fontWeight: 600 }}>{p.label}</span>
                <span>{p.pct}%</span>
              </div>
              <div style={{ height: 7, borderRadius: 6, background: V.subBg, overflow: "hidden" }}>
                <div
                  data-testid="bar-fill"
                  style={{ width: `${p.pct}%`, height: "100%", borderRadius: 6, background: p.color }}
                />
              </div>
            </div>
          ))}
        </section>

        {/* Right column: Board + Recent activity (L286-298). */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Board — avatars + green status dots (L287-293). */}
          <section data-testid="board" style={cardStyle}>
            <div style={{ ...sectionHeading, marginBottom: 11 }}>Board — review &amp; approval</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {BOARD.map((b) => (
                <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  {/* prototype `avatar()` — an initials disc (not an app glyph). */}
                  <div
                    aria-hidden="true"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: b.color,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28 * 0.4,
                      fontWeight: 700,
                      flex: "none",
                      boxShadow: "0 1px 2px rgba(0,0,0,.2)",
                    }}
                  >
                    {b.initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: V.text }}>Claude-{b.name}</div>
                    <div style={{ fontSize: 11, color: V.muted }}>{b.role}</div>
                  </div>
                  <span
                    data-testid="status-dot"
                    aria-label={`${b.name} online`}
                    style={{ width: 8, height: 8, borderRadius: "50%", background: SUCCESS }}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Recent activity — accent left-border timeline (L294-298). */}
          <section data-testid="activity" style={cardStyle}>
            <div style={{ ...sectionHeading, marginBottom: 10 }}>Recent activity</div>
            {LOGS.map((l) => (
              <div
                key={l.text}
                data-testid="activity-row"
                style={{
                  paddingLeft: 11,
                  borderLeftWidth: 2,
                  borderLeftStyle: "solid",
                  borderLeftColor: ACCENT_HALF,
                  marginBottom: 9,
                }}
              >
                <div style={{ fontSize: 12.5, lineHeight: 1.4, color: V.text }}>{l.text}</div>
                <div style={{ fontSize: 10.5, color: V.muted, marginTop: 1 }}>{l.when}</div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
