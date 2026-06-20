// src/themes/index.ts — THEME TOKENS; aqua surfaced for E1, console/samagra forward-compat.
// Constants are verbatim from docs/superpowers/_research/samagra-os/proto.md §6.
// Chrome constants (kind/dockPos/controlSide/barH/rail/winRadius) are consumed by
// lib/wm/geometry so chrome + math never drift.
import type { Theme } from "../types/contracts";

export type ThemeKind = "mac" | "console" | "samagra";
export type DockPos = "bottom" | "taskbar" | "left";
export type ControlSide = "left" | "right";

export interface ThemeTokens {
  kind: ThemeKind;
  dockPos: DockPos;
  controlSide: ControlSide;
  barH: number;
  rail?: number;
  winRadius: number;
  bg: string;
  winBg: string;
  winBlur: string;
  bar: string;
  barText: string;
  barBlur: string;
  text: string;
  muted: string;
  line: string;
  cardBg: string;
  subBg: string;
  accent: string;
  accent2: string;
  shadow: string;
  dockBg: string;
  dockBlur: string;
  dockBorder: string;
  font: string;
  wordmark: string;
}

// §6.1 aqua (E1)
const aqua: ThemeTokens = {
  kind: "mac",
  dockPos: "bottom",
  controlSide: "left",
  barH: 30,
  winRadius: 13,
  bg:
    "radial-gradient(1100px 760px at 14% 8%, #c7d2fe, transparent 58%)," +
    "radial-gradient(1000px 720px at 88% 16%, #a5f3fc, transparent 55%)," +
    "radial-gradient(900px 900px at 72% 96%, #fbcfe8, transparent 55%)," +
    "linear-gradient(160deg,#eef2ff,#f6f8fc)",
  winBg: "rgba(255,255,255,0.78)",
  winBlur: "saturate(180%) blur(26px)",
  bar: "rgba(255,255,255,0.55)",
  barText: "#1d1d1f",
  barBlur: "saturate(180%) blur(20px)",
  text: "#1d1d1f",
  muted: "#6e6e76",
  line: "rgba(0,0,0,0.09)",
  cardBg: "rgba(255,255,255,0.62)",
  subBg: "rgba(15,23,42,0.04)",
  accent: "#4f46e5",
  accent2: "#0d9488",
  shadow: "0 26px 64px rgba(20,20,50,0.30), 0 2px 8px rgba(0,0,0,.10)",
  dockBg: "rgba(255,255,255,0.42)",
  dockBlur: "saturate(180%) blur(26px)",
  dockBorder: "rgba(255,255,255,0.65)",
  font: "'Inter',system-ui,sans-serif",
  wordmark: "'Inter',sans-serif",
};

// §6.2 console (E3) — full set for forward-compat
const consoleTheme: ThemeTokens = {
  kind: "console",
  dockPos: "taskbar",
  controlSide: "right",
  barH: 0,
  winRadius: 10,
  bg:
    "radial-gradient(900px 620px at 50% -12%, rgba(56,189,248,0.14), transparent 60%)," +
    "radial-gradient(700px 560px at 92% 110%, rgba(168,85,247,0.12), transparent 60%)," +
    "repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 42px)," +
    "repeating-linear-gradient(90deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 42px)," +
    "#080b12",
  winBg: "rgba(16,22,34,0.88)",
  winBlur: "blur(20px)",
  bar: "rgba(9,13,21,0.78)",
  barText: "#cdd7e6",
  barBlur: "blur(18px)",
  text: "#e7eef8",
  muted: "#8595ab",
  line: "rgba(255,255,255,0.09)",
  cardBg: "rgba(255,255,255,0.04)",
  subBg: "rgba(255,255,255,0.035)",
  accent: "#38bdf8",
  accent2: "#34d399",
  shadow: "0 28px 80px rgba(0,0,0,0.62)",
  dockBg: "rgba(9,13,21,0.84)",
  dockBlur: "blur(22px)",
  dockBorder: "rgba(255,255,255,0.08)",
  font: "'Inter',system-ui,sans-serif",
  wordmark: "'JetBrains Mono',monospace",
};

// §6.3 samagra (E3) — full set
const samagra: ThemeTokens = {
  kind: "samagra",
  dockPos: "left",
  controlSide: "right",
  barH: 32,
  rail: 66,
  winRadius: 15,
  bg:
    "radial-gradient(1000px 720px at 18% 12%, rgba(221,107,32,0.12), transparent 58%)," +
    "radial-gradient(900px 720px at 88% 90%, rgba(15,118,110,0.10), transparent 60%)," +
    "linear-gradient(165deg,#fbf3e5,#f5ead7)",
  winBg: "#fffcf6",
  winBlur: "none",
  bar: "rgba(255,251,243,0.82)",
  barText: "#2a2118",
  barBlur: "blur(12px)",
  text: "#2a2118",
  muted: "#937f63",
  line: "rgba(42,33,24,0.13)",
  cardBg: "#fffaf0",
  subBg: "rgba(221,107,32,0.07)",
  accent: "#d9601a",
  accent2: "#0f766e",
  shadow: "0 22px 54px rgba(74,52,24,0.22)",
  dockBg: "rgba(255,251,243,0.9)",
  dockBlur: "blur(16px)",
  dockBorder: "rgba(42,33,24,0.10)",
  font: "'Hanken Grotesk',system-ui,sans-serif",
  wordmark: "'Tiro Devanagari Hindi',serif", // wordmark glyph: समग्र
};

export const THEMES: Record<Theme, ThemeTokens> = {
  aqua,
  console: consoleTheme,
  samagra,
};

// FD1 — CSS-var provider mapping. `cssVars(tokens)` flattens a theme's token set
// into the `--samagra-*` custom properties the chrome + apps read, so every
// color/size/font is driven by the ACTIVE theme (no hardcoded per-theme values).
// Numeric measurements (winRadius/barH/rail) are emitted as `px` strings; a theme
// without a rail (aqua/console) emits `0px` so consumers can always reference the
// var unconditionally. ThemeRoot spreads this map onto the root element's style.
export type CssVarName =
  | "--samagra-bg"
  | "--samagra-win-bg"
  | "--samagra-win-blur"
  | "--samagra-bar"
  | "--samagra-bar-text"
  | "--samagra-bar-blur"
  | "--samagra-text"
  | "--samagra-muted"
  | "--samagra-line"
  | "--samagra-card-bg"
  | "--samagra-sub-bg"
  | "--samagra-accent"
  | "--samagra-accent2"
  | "--samagra-shadow"
  | "--samagra-dock-bg"
  | "--samagra-dock-blur"
  | "--samagra-dock-border"
  | "--samagra-font"
  | "--samagra-wordmark"
  | "--samagra-win-radius"
  | "--samagra-bar-h"
  | "--samagra-rail";

export function cssVars(t: ThemeTokens): Record<CssVarName, string> {
  return {
    "--samagra-bg": t.bg,
    "--samagra-win-bg": t.winBg,
    "--samagra-win-blur": t.winBlur,
    "--samagra-bar": t.bar,
    "--samagra-bar-text": t.barText,
    "--samagra-bar-blur": t.barBlur,
    "--samagra-text": t.text,
    "--samagra-muted": t.muted,
    "--samagra-line": t.line,
    "--samagra-card-bg": t.cardBg,
    "--samagra-sub-bg": t.subBg,
    "--samagra-accent": t.accent,
    "--samagra-accent2": t.accent2,
    "--samagra-shadow": t.shadow,
    "--samagra-dock-bg": t.dockBg,
    "--samagra-dock-blur": t.dockBlur,
    "--samagra-dock-border": t.dockBorder,
    "--samagra-font": t.font,
    "--samagra-wordmark": t.wordmark,
    "--samagra-win-radius": `${t.winRadius}px`,
    "--samagra-bar-h": `${t.barH}px`,
    "--samagra-rail": `${t.rail ?? 0}px`,
  };
}

// §6.4 Terminal palette — per theme, plus shared err/ok
export interface TermPalette {
  bg: string;
  fg: string;
  dim: string;
  prompt: string;
  accent: string;
}

export const TERM_ERR = "#f87171";
export const TERM_OK = "#4ade80";

export const termPalette: Record<Theme, TermPalette> = {
  aqua: { bg: "#1b1d24", fg: "#e5e7eb", dim: "#9aa0ad", prompt: "#7dd3fc", accent: "#a5b4fc" },
  console: { bg: "#05080e", fg: "#a7bdd6", dim: "#5c6c81", prompt: "#34d399", accent: "#38bdf8" },
  samagra: { bg: "#241a11", fg: "#efe2cf", dim: "#a8927a", prompt: "#f0a35e", accent: "#e8b07a" },
};

// §6.5 Semantic / status colors (shared across apps)
export const STATUS = {
  success: "#16a34a",
  info: "#2563eb", // running / info
  warning: "#d97706",
  danger: "#ef4444",
  danger2: "#dc2626",
  neutral: "#64748b",
} as const;

export const DIFFICULTY = {
  easy: "#16a34a",
  medium: "#d97706",
  hard: "#dc2626",
} as const;

// §6.6 Inactive window shadow
export const INACTIVE_SHADOW = "0 10px 28px rgba(20,20,40,0.20)";
