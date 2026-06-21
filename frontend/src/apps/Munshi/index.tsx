import { useState } from "react";
import { useApi } from "../../hooks/useApi";
import { useApiPost } from "../../hooks/useApiPost";
import Icon from "../../components/Icon";
import { buildQuery } from "../../lib/api/query";
import { catalogRows } from "../../lib/catalog/rows";
import { buildMunshiCapture } from "../../lib/capture/munshi";
import type { SearchResponse, MunshiKind, MunshiCaptureForm } from "../../types/contracts";

const V = {
  text: "var(--samagra-text)", muted: "var(--samagra-muted)", line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)", subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)", font: "var(--samagra-font)",
} as const;

// Required + optional fields per munshi kind (mirrors lib/capture/munshi.ts).
const FIELDS: Record<MunshiKind, readonly string[]> = {
  todo: ["assignee", "task", "due"],
  note: ["student", "issue", "label"],
  followup: ["date", "note", "person"],
};
const KINDS: readonly MunshiKind[] = ["todo", "note", "followup"];

const inputStyle = {
  background: V.subBg, color: V.text, border: `1px solid ${V.line}`,
  borderRadius: 8, padding: "6px 8px", fontFamily: V.font, fontSize: 13,
} as const;

export default function Munshi() {
  // reloadKey bumps the GET path so useApi refetches the library after a capture.
  const [reloadKey, setReloadKey] = useState(0);
  const path = "/api/search" + buildQuery({ source: "munshi", limit: 200 })
    + (reloadKey ? `&_r=${reloadKey}` : "");
  const { data, loading, error } = useApi<SearchResponse>(path);
  const rows = catalogRows(data);

  const [kind, setKind] = useState<MunshiKind>("todo");
  const [values, setValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const { post, loading: posting, error: postError } = useApiPost<{ ok: boolean }>();

  function setField(name: string, v: string) {
    setValues((prev) => ({ ...prev, [name]: v }));
  }

  async function onSubmit() {
    setFormError(null);
    const form = { kind, ...values } as MunshiCaptureForm;
    const built = buildMunshiCapture(form);
    if (!built.ok) {
      setFormError(built.error);
      return;
    }
    const out = await post("/api/munshi/capture", built.body);
    if (out) {
      setValues({});
      setReloadKey((k) => k + 1);
    }
  }

  return (
    <div data-testid="munshi" style={{ padding: 20, fontFamily: V.font }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="munshi" size={26} label="Munshi" />
        </span>
        <h1 style={{ color: V.text, fontSize: 18, margin: 0 }}>Munshi</h1>
      </header>

      <section data-testid="capture" style={{ marginTop: 14, background: V.cardBg,
               border: `1px solid ${V.line}`, borderRadius: 10, padding: 12,
               display: "grid", gap: 8 }}>
        <div style={{ color: V.muted, fontSize: 12, fontWeight: 600 }}>New capture</div>
        <select data-testid="capture-kind" aria-label="kind" value={kind}
                onChange={(e) => { setKind(e.target.value as MunshiKind); setValues({}); setFormError(null); }}
                style={inputStyle}>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        {FIELDS[kind].map((f) => (
          <input key={f} aria-label={f} placeholder={f} value={values[f] ?? ""}
                 onChange={(e) => setField(f, e.target.value)} style={inputStyle} />
        ))}
        {(formError || postError) ? (
          <div data-testid="capture-error" role="alert" style={{ color: V.text, fontSize: 12 }}>
            {formError || postError}
          </div>
        ) : null}
        <button type="button" data-testid="capture-submit" disabled={posting} onClick={onSubmit}
                style={{ background: V.accent, color: "#fff", border: "none", borderRadius: 8,
                         padding: "7px 12px", fontFamily: V.font, fontSize: 13, cursor: "pointer",
                         justifySelf: "start" }}>
          {posting ? "Capturing…" : "Capture"}
        </button>
      </section>

      {error ? <div role="alert" style={{ color: V.text, marginTop: 8 }}>{error}</div> : null}
      <section data-testid="catalog-list" aria-busy={loading} style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div data-testid="catalog-empty" style={{ color: V.muted }}>
            {loading ? "Loading…" : "Munshi not available — set MUNSHI creds and run a refresh."}
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
