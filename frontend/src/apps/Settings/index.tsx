// src/apps/Settings/index.tsx
// THIN presentational wrapper (E1.20, VISUAL). Appearance + Device are
// client-only mutations against the singleton theme store (`setTheme`/
// `setDevice`); Integration rows derive from `/api/overview`
// `sources[].available` (0/1 → active/needs-creds pills, api.md §2 Settings).
// The headless residue the loop gates on is the click path: selecting the
// console theme radio calls `setTheme('console')`. Per-pixel Aqua/console/
// samagra parity is a separate human QA pass and is NOT tested here.
import { useStore } from "zustand";
import { themeStore } from "../../App";
import { useApi } from "../../hooks/useApi";
import type { Device, Theme } from "../../types/contracts";

// The selectable appearance themes (proto.md §6) + device targets (§1.11).
const THEMES: { value: Theme; label: string }[] = [
  { value: "aqua", label: "Aqua" },
  { value: "console", label: "Console" },
  { value: "samagra", label: "Samagra" },
];
const DEVICES: { value: Device; label: string }[] = [
  { value: "pc", label: "PC" },
  { value: "mobile", label: "Mobile" },
];

// Defensive view of `/api/overview` (api.md §2). Only `available` (0/1) and the
// human labels are read here; everything else is left to the Dashboard.
interface OverviewSource {
  source?: string;
  label?: string;
  available?: number;
}
interface Overview {
  refreshed_at?: string;
  sources?: OverviewSource[];
}

export default function Settings() {
  const theme = useStore(themeStore, (s) => s.theme);
  const device = useStore(themeStore, (s) => s.device);
  const setTheme = useStore(themeStore, (s) => s.setTheme);
  const setDevice = useStore(themeStore, (s) => s.setDevice);

  const { data } = useApi<Overview>("/api/overview");
  const sources = Array.isArray(data?.sources) ? data!.sources : [];

  return (
    <div className="app-settings" data-testid="settings">
      <section className="settings-appearance" aria-label="Appearance">
        <h2>Appearance</h2>
        <fieldset>
          <legend>Theme</legend>
          {THEMES.map((t) => (
            <label key={t.value}>
              <input
                type="radio"
                name="theme"
                value={t.value}
                checked={theme === t.value}
                onChange={() => setTheme(t.value)}
              />
              {t.label}
            </label>
          ))}
        </fieldset>
      </section>

      <section className="settings-device" aria-label="Device">
        <h2>Device</h2>
        <fieldset>
          <legend>Device</legend>
          {DEVICES.map((d) => (
            <label key={d.value}>
              <input
                type="radio"
                name="device"
                value={d.value}
                checked={device === d.value}
                onChange={() => setDevice(d.value)}
              />
              {d.label}
            </label>
          ))}
        </fieldset>
      </section>

      <section className="settings-integrations" aria-label="Integrations">
        <h2>Integrations</h2>
        <ul>
          {sources.map((s, i) => {
            const active = s?.available === 1;
            return (
              <li key={s?.source ?? i} data-source={s?.source}>
                <span className="integration-label">{s?.label ?? s?.source}</span>
                <span
                  className={`pill ${active ? "pill-active" : "pill-needs-creds"}`}
                  data-status={active ? "active" : "needs-creds"}
                >
                  {active ? "Active" : "Needs creds"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
