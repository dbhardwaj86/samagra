import { useRef, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { useApiPost } from "../../hooks/useApiPost";
import Icon from "../../components/Icon";
import { buildQuery } from "../../lib/api/query";
import { catalogRows } from "../../lib/catalog/rows";
import { buildSeed, SEED_TYPES } from "../../lib/capture/seed";
import type { SearchResponse, SeedType, SeedForm } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

const inputStyle = {
  background: V.subBg, color: V.text, border: `1px solid ${V.line}`,
  borderRadius: 8, padding: "6px 8px", fontFamily: V.font, fontSize: 13,
} as const;

export default function Mycontentdev() {
  // reloadKey bumps the GET path so useApi refetches the list after a seed capture.
  const [reloadKey, setReloadKey] = useState(0);
  const path = "/api/search" + buildQuery({ source: "mycontentdev", limit: 200 })
    + (reloadKey ? `&_r=${reloadKey}` : "");
  const { data, loading, error } = useApi<SearchResponse>(path);
  const rows = catalogRows(data);

  const [type, setType] = useState<SeedType>("rough_idea");
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const { post, loading: posting, error: postError } = useApiPost<{ ok: boolean }>();
  // Synchronous in-flight guard: disabled={posting} only takes effect after a
  // re-render, so rapid double-clicks (or Enter+click) could re-enter onSubmit
  // and issue a duplicate production write. The ref flips synchronously.
  const inFlight = useRef(false);

  async function onSubmit() {
    if (inFlight.current) return;
    setFormError(null);
    const form = { type, title, raw_text: rawText } as SeedForm;
    const built = buildSeed(form);
    if (!built.ok) {
      setFormError(built.error);
      return;
    }
    inFlight.current = true;
    try {
      const out = await post("/api/mcd/seeds", built.body);
      if (out) {
        setTitle("");
        setRawText("");
        setReloadKey((k) => k + 1);
      }
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <div data-testid="mycontentdev" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="mycontentdev" size={26} label="mycontentdev" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>mycontentdev</h1>
      </header>

      <section data-testid="seed" style={{ marginTop: 14, background: V.cardBg,
               border: `1px solid ${V.line}`, borderRadius: 10, padding: 12,
               display: "grid", gap: 8 }}>
        <div style={{ color: V.muted, fontSize: 12, fontWeight: 600 }}>New seed</div>
        <select data-testid="seed-type" aria-label="type" value={type}
                onChange={(e) => { setType(e.target.value as SeedType); setFormError(null); }}
                style={inputStyle}>
          {SEED_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input aria-label="title" placeholder="title (optional)" value={title}
               onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        <textarea aria-label="raw_text" placeholder="raw_text" value={rawText} rows={3}
                  onChange={(e) => setRawText(e.target.value)}
                  style={{ ...inputStyle, resize: "vertical" }} />
        {(formError || postError) ? (
          <div data-testid="seed-error" role="alert" style={{ color: V.text, fontSize: 12 }}>
            {formError || postError}
          </div>
        ) : null}
        <button type="button" data-testid="seed-submit" disabled={posting} onClick={onSubmit}
                style={{ background: V.accent, color: "#fff", border: "none", borderRadius: 8,
                         padding: "7px 12px", fontFamily: V.font, fontSize: 13, cursor: "pointer",
                         justifySelf: "start" }}>
          {posting ? "Capturing…" : "Capture seed"}
        </button>
      </section>

      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div data-testid="catalog-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "mycontentdev not available — set MCD creds and run a refresh."}
          </div>
        ) : rows.map((r) => (
          <article key={r.uid} data-testid="catalog-row"
                   style={{ background: V.cardBg, border: `1px solid ${V.line}`, borderRadius: 10,
                            padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ color: V.text, fontWeight: 600 }}>{r.title}</div>
              <div style={{ color: V.muted, fontSize: 12 }}>{[r.kind, r.status].filter(Boolean).join(" · ")}</div>
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
