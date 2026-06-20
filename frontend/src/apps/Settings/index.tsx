// src/apps/Settings/index.tsx
// AP2 FIDELITY — Settings (README §Apps#17 Settings, #475569 760×580).
// Settings is the production home for theme + device switching. The surface is a
// VERBATIM port of the prototype's `app_settings` (.dc.html ~L490):
//   • Appearance — 3 theme swatch cards (repeat(3,1fr) grid, gap 10, marginBottom 8).
//     Each card is padding 4 / radius 12 with a 2px border (theme accent when
//     selected, else transparent); the inner swatch chip is height 64 / radius 9
//     painted with that theme's literal gradient + an inset 1px theme-line ring.
//     The centred label is 12px/600 (accent when selected, else theme text).
//     Clicking a card calls `setTheme(id)` — this IS the real switcher.
//   • Device — a 2-cell segmented toggle (Desktop=pc / Mobile=mobile), flex gap 8.
//     The selected cell is accent-tinted (bg accent@13% / accent text / accent@30%
//     border); the unselected cell is sub-bg / muted text. Clicking → setDevice(v).
//   • Integrations — the prototype's five fixed status rows (cardBg / 1px theme line
//     / radius 10 / padding 11px 13px), each a flex-1 label + a status Pill: the
//     three "needs OK"/"creds" rows in the warning color #d97706, the two "active"
//     rows in the success color #16a34a (pill bg = that color @13%).
//
// FIDELITY rules (FD1/FD2):
//   • All surface colors are driven by the theme tokens via the `--samagra-*` CSS
//     vars (FD1) — the selected swatch border + label, the device cell tint, the
//     row card-bg/line all reference `var(--samagra-accent|text|muted|card-bg|line
//     |sub-bg)` so the surface renders correctly in aqua, console AND samagra. The
//     swatch chip GRADIENTS are the prototype's literal per-theme previews (they
//     depict each theme, so they stay fixed); the pill status hues are the fixed
//     semantic #d97706 / #16a34a.
//   • The header glyph is a real 24×24 line-icon <svg> via the FD2 <Icon> — NEVER a
//     letter badge.
//
// Two contracts are pinned (kept green by the tests):
//   1. BEHAVIOUR (E1.20): clicking the Console swatch calls setTheme('console');
//      clicking Mobile calls setDevice('mobile').
//   2. FIDELITY (AP2): the exact documented tokens/markup above.
//
// Logic stays in lib/**; this component is purely presentational. Per-pixel parity
// is a separate human QA pass.
import type { CSSProperties } from "react";
import { useStore } from "zustand";
import { themeStore } from "../../App";
import Icon from "../../components/Icon";
import type { Device, Theme } from "../../types/contracts";

// Theme CSS vars (FD1) — referenced unconditionally so the surface is correct in
// every theme (the prototype's `t.accent / t.text / t.muted / t.cardBg / t.line /
// t.subBg`).
const V = {
  text: "var(--samagra-text)",
  muted: "var(--samagra-muted)",
  line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)",
  subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)",
} as const;

// Accent alpha tints — the prototype's `hex(accent, a)`. Driven from the theme var
// via `color-mix` (the codebase's established accent-alpha pattern, see Pill/Card)
// so the device cell tint recolours per theme (FD1) instead of baking a hex.
const ACCENT_13 = "color-mix(in srgb, var(--samagra-accent) 13%, transparent)";
const ACCENT_30 = "color-mix(in srgb, var(--samagra-accent) 30%, transparent)";

// Semantic status hues (proto.md §6.5) — fixed, NOT the theme accent.
const WARN = "#d97706";
const SUCCESS = "#16a34a";

/** `#rrggbb` @ alpha → `rgba(...)` — the prototype's `hex()` (used for pill bg). */
function hexA(c: string, a: number): string {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// The three selectable appearance themes + their literal preview gradients
// (proto.md §6 / .dc.html L499-501). The gradient PREVIEWS each theme, so it is a
// fixed literal (not a theme var).
const THEMES: { id: Theme; label: string; grad: string }[] = [
  { id: "aqua", label: "Aqua", grad: "linear-gradient(135deg,#c7d2fe,#a5f3fc,#fbcfe8)" },
  { id: "console", label: "Console", grad: "linear-gradient(135deg,#0b1220,#1e293b)" },
  { id: "samagra", label: "Samagra", grad: "linear-gradient(135deg,#fbf3e5,#e9b07a)" },
];

// Device targets — the prototype's `['pc','mobile']` with the displayed labels.
const DEVICES: { value: Device; label: string }[] = [
  { value: "pc", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
];

// The five fixed integration rows (.dc.html L495): [label, status, color].
const INTEGRATIONS: { label: string; status: string; color: string }[] = [
  { label: "Hourly scheduled task", status: "needs OK", color: WARN },
  { label: "Telegram + email notify", status: "creds", color: WARN },
  { label: "Google Docs export", status: "creds", color: WARN },
  { label: "HTML + DOCX export", status: "active", color: SUCCESS },
  { label: "Codex pre-commit review", status: "active", color: SUCCESS },
];

// Section heading — the prototype's `h2()` (uppercase, 12px/700, 0.07em tracking,
// muted). `top` is the leading margin (0 for the first, 20 thereafter).
function H2({ children, top = 0 }: { children: string; top?: number }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: V.muted,
        margin: `${top}px 0 10px`,
      }}
    >
      {children}
    </div>
  );
}

// Status pill — the prototype's `pill()` (inline-flex, 11px/600, pad 3px 9px,
// r999). Colored by the row's semantic hue; bg = that hue @13%.
function Pill({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 999,
        color,
        background: hexA(color, 0.13),
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export default function Settings() {
  const theme = useStore(themeStore, (s) => s.theme);
  const device = useStore(themeStore, (s) => s.device);
  const setTheme = useStore(themeStore, (s) => s.setTheme);
  const setDevice = useStore(themeStore, (s) => s.setDevice);

  return (
    // The prototype's `app_settings` outer pad is 20. The root deliberately omits a
    // global `color` so jsdom keeps the cards' border colours resolvable for the
    // FD1 theme-var assertions (same rationale as Dashboard).
    <div
      className="app-settings"
      data-testid="settings"
      style={{ padding: 20, fontFamily: "var(--samagra-font)" }}
    >
      {/* Header — Settings glyph (FD2 <Icon>, NOT a letter badge) + title. */}
      <header
        data-testid="settings-header"
        style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}
      >
        <span style={{ color: V.accent, display: "inline-flex" }}>
          <Icon name="settings" size={24} label="Settings" />
        </span>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: V.text }}>
          Settings
        </div>
      </header>

      {/* ---- Appearance — the 3-up swatch grid (the real theme switcher) ---- */}
      <section aria-label="Appearance">
        <H2>Appearance</H2>
        <div
          data-testid="appearance-grid"
          role="radiogroup"
          aria-label="Theme"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 10,
            marginBottom: 8,
          }}
        >
          {THEMES.map((t) => {
            const selected = theme === t.id;
            const cardStyle: CSSProperties = {
              cursor: "pointer",
              borderRadius: 12,
              padding: 4,
              // 2px border: theme accent when selected, transparent otherwise (no
              // layout shift on select). Accent is the theme var (FD1).
              border: `2px solid ${selected ? V.accent : "transparent"}`,
            };
            return (
              <div
                key={t.id}
                data-testid={`swatch-${t.id}`}
                role="radio"
                aria-checked={selected}
                aria-label={t.label}
                tabIndex={0}
                onClick={() => setTheme(t.id)}
                style={cardStyle}
              >
                {/* gradient chip — height 64 / radius 9 / inset 1px theme-line ring. */}
                <div
                  data-testid={`swatch-chip-${t.id}`}
                  style={{
                    height: 64,
                    borderRadius: 9,
                    background: t.grad,
                    marginBottom: 7,
                    boxShadow: `inset 0 0 0 1px ${V.line}`,
                  }}
                />
                <div
                  data-testid={`swatch-label-${t.id}`}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: "center",
                    color: selected ? V.accent : V.text,
                  }}
                >
                  {t.label}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Device — the 2-cell segmented toggle ---- */}
      <section aria-label="Device">
        <H2 top={20}>Device</H2>
        <div
          data-testid="device-toggle"
          role="radiogroup"
          aria-label="Device"
          style={{ display: "flex", gap: 8, marginBottom: 8 }}
        >
          {DEVICES.map((d) => {
            const selected = device === d.value;
            return (
              <div
                key={d.value}
                data-testid={`device-${d.value}`}
                role="radio"
                aria-checked={selected}
                aria-label={d.label}
                tabIndex={0}
                onClick={() => setDevice(d.value)}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "10px 0",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  // selected → accent tint (FD1 vars); unselected → sub-bg / muted.
                  background: selected ? ACCENT_13 : V.subBg,
                  color: selected ? V.accent : V.muted,
                  border: `1px solid ${selected ? ACCENT_30 : "transparent"}`,
                }}
              >
                {d.label}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Integrations — the five status rows ---- */}
      <section aria-label="Integrations">
        <H2 top={20}>Integrations</H2>
        <ul
          data-testid="integrations-list"
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {INTEGRATIONS.map((it, i) => (
            <li
              key={it.label}
              data-testid={`integration-row-${i}`}
              style={{
                display: "flex",
                alignItems: "center",
                background: V.cardBg,
                border: `1px solid ${V.line}`,
                borderRadius: 10,
                padding: "11px 13px",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: V.text }}>
                {it.label}
              </span>
              <Pill text={it.status} color={it.color} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
