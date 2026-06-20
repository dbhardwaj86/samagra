// src/apps/Clock/index.tsx
// AP4 FIDELITY — Clock (README §Apps#13 Clock, #0ea5e9 560×640).
// THIN presentational wrapper (E1.22, VISUAL) over the already-green
// `lib/clock/*` engines (analog/stopwatch/timer/world, green in deepak's
// E1.10–E1.13). The wrapper renders the four tabs `clock | stopwatch | timer |
// world` (proto §3 line 180, default `clock`) and wires a cleanup-safe
// `useInterval` (1s clock / 33ms stopwatch / 200ms timer). ALL clock math lives
// in the pure lib modules — there is ZERO new geometry/format logic here beyond
// the trivial digital readout (proto §3 line 543).
//
// FIDELITY (AP4): the markup/tokens are a VERBATIM port of the prototype's
// `app_clock` / `clockFace` / `clockStopwatch` / `clockTimer` / `clockWorld`
// (.dc.html L513–607). FD1: every surface colour is driven off the theme tokens
// via the `--samagra-*` CSS vars (accent/text/muted/line/card-bg/sub-bg/win-bg)
// so the surface renders correctly in aqua, console AND samagra — no baked hexes
// except the prototype's fixed semantic hues (#ef4444 / #d97706 / the day/night
// chip indigo+amber). FD2: the day/night chip holds a real inline <svg> sun/moon
// glyph — NEVER a unicode/letter badge.
//
// Hand sweep, ring depletion, the WebAudio chime, and per-pixel parity are a
// SEPARATE human QA pass (RUBRIC §6) and are NOT tested here.
import type { CSSProperties } from "react";
import { useState } from "react";
import { useInterval } from "../../hooks/useInterval";
import {
  CX,
  CY,
  BACKING_R,
  HAND,
  faceTicks,
  faceNumerals,
  handAngles,
  handEndpoint,
} from "../../lib/clock/analog";
import { fmtSwMain, fmtMs, elapsedFrom, lapSplit } from "../../lib/clock/stopwatch";
import {
  PRESETS,
  RING_C,
  CHIME,
  remainingFrom,
  ringOffset,
  isDone,
} from "../../lib/clock/timer";
import { ZONES, isNight, zoneTime } from "../../lib/clock/world";

type Tab = "clock" | "stopwatch" | "timer" | "world";

// proto §3 line 516: Tabs in this exact order, default `clock`.
const TABS: Tab[] = ["clock", "stopwatch", "timer", "world"];
const TAB_LABEL: Record<Tab, string> = {
  clock: "Clock",
  stopwatch: "Stopwatch",
  timer: "Timer",
  world: "World",
};

// ── FD1 theme tokens — referenced unconditionally so the surface is correct in
// every theme (the prototype's `t.accent / t.text / t.muted / t.cardBg / t.line
// / t.subBg / t.winBg`).
const V = {
  text: "var(--samagra-text)",
  muted: "var(--samagra-muted)",
  line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)",
  subBg: "var(--samagra-sub-bg)",
  accent: "var(--samagra-accent)",
  winBg: "var(--samagra-win-bg)",
} as const;

// Accent alpha tints — the prototype's `hex(accent, a)`. Driven from the theme
// var via `color-mix` (the codebase's established accent-alpha pattern, see
// Settings/Pill/Card) so they recolour per theme (FD1) instead of baking a hex.
const ACCENT_12 = "color-mix(in srgb, var(--samagra-accent) 12%, transparent)";
const ACCENT_16 = "color-mix(in srgb, var(--samagra-accent) 16%, transparent)";

// Fixed semantic hues (NOT the theme accent) — the prototype's literals.
const RED = "#ef4444"; // stopwatch Stop / timer "Time!"
const AMBER = "#d97706"; // timer Pause
const NIGHT = "#6366f1"; // day/night chip — night (indigo)
const NIGHT_GLYPH = "#818cf8";
const DAY = "#f59e0b"; // day/night chip — day (amber)

/** `#rrggbb` @ alpha → `rgba(...)` — the prototype's `hex()` (semantic-hue tints). */
function hexA(c: string, a: number): string {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/** proto §3 line 202: `pad2(n) = (n<10?'0':'')+n`. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** WebAudio chime reading `CHIME` (proto §3.4). try/catch no-op — never throws. */
function beep(): void {
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = CHIME.type;
    o.frequency.value = CHIME.freq;
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(CHIME.gainPeak, t + CHIME.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + CHIME.attack + CHIME.release);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + CHIME.stopAfter);
  } catch {
    // no-op — audio is best-effort
  }
}

// ── FD2 day/night chip glyphs — real inline <svg> (Feather-style, 24×24 / round
// caps), NEVER a unicode/letter badge. Decorative (aria-hidden); colour inherits.
function SunGlyph() {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx={12} cy={12} r={4} />
      {"M12 2v2|M12 20v2|M4.9 4.9l1.4 1.4|M17.7 17.7l1.4 1.4|M2 12h2|M20 12h2|M6.3 17.7l-1.4 1.4|M19.1 4.9l-1.4 1.4"
        .split("|")
        .map((d, i) => (
          <path key={i} d={d} />
        ))}
    </svg>
  );
}

function MoonGlyph() {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

/** Analog face (proto §3.1) from the pure `lib/clock/analog` geometry. */
function AnalogFace({ now }: { now: Date }) {
  const { secA, minA, hrA } = handAngles(now);
  const hour = handEndpoint(CX, CY, hrA, HAND.hour.len, HAND.hour.tail);
  const minute = handEndpoint(CX, CY, minA, HAND.minute.len, HAND.minute.tail);
  const second = handEndpoint(CX, CY, secA, HAND.second.len, HAND.second.tail);
  return (
    <svg
      width={300}
      height={300}
      viewBox="0 0 300 300"
      role="img"
      aria-label="Analog clock"
    >
      {/* Backing circle — r134 (R+14), card-bg fill + theme-line ring (FD1). */}
      <circle cx={CX} cy={CY} r={BACKING_R} fill={V.cardBg} stroke={V.line} strokeWidth={1} />
      {/* 60 ticks; every 5th is the `big` major tick (muted, 2px) else line (1px). */}
      {faceTicks().map((t) => (
        <line
          key={t.i}
          className={`clock-tick${t.big ? " clock-tick--big" : ""}`}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={t.big ? V.muted : V.line}
          strokeWidth={t.big ? 2 : 1}
        />
      ))}
      {/* 12/3/6/9 numerals — 17px/700, theme text (FD1). */}
      {faceNumerals().map((n) => (
        <text
          key={n.label}
          x={n.x}
          y={n.y}
          textAnchor="middle"
          fontSize={17}
          fontWeight={700}
          fill={V.text}
          fontFamily="var(--samagra-font)"
        >
          {n.label}
        </text>
      ))}
      {/* hour 5 / minute 4 — theme text; second 2px — accent var (FD1). */}
      <line
        className="clock-hand clock-hand--hour"
        x1={hour.x1}
        y1={hour.y1}
        x2={hour.x2}
        y2={hour.y2}
        stroke={V.text}
        strokeWidth={HAND.hour.width}
        strokeLinecap="round"
      />
      <line
        className="clock-hand clock-hand--minute"
        x1={minute.x1}
        y1={minute.y1}
        x2={minute.x2}
        y2={minute.y2}
        stroke={V.text}
        strokeWidth={HAND.minute.width}
        strokeLinecap="round"
      />
      <line
        className="clock-hand clock-hand--second"
        x1={second.x1}
        y1={second.y1}
        x2={second.x2}
        y2={second.y2}
        stroke={V.accent}
        strokeWidth={HAND.second.width}
        strokeLinecap="round"
      />
      {/* Centre pin — r7 accent var + r3 inner win-bg dot (FD1). */}
      <circle className="clock-pin" cx={CX} cy={CY} r={7} fill={V.accent} />
      <circle cx={CX} cy={CY} r={3} fill={V.winBg} />
    </svg>
  );
}

/** Clock tab: analog face + digital readout + date + tz, ticking every 1s. */
function ClockTab() {
  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), 1000);

  const hr = now.getHours();
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  const ampm = hr < 12 ? "AM" : "PM";
  const digital = `${pad2(h12)}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())} ${ampm}`;
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const tz = tzName();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "14px 0 24px",
      }}
    >
      <AnalogFace now={now} />
      {/* Digital HH:MM:SS AM/PM — 38px/700, tabular-nums (proto §3 line 543). */}
      <div
        data-testid="clock-digital"
        style={{
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
          marginTop: 8,
          color: V.text,
        }}
      >
        {digital}
      </div>
      <div data-testid="clock-date" style={{ fontSize: 14, color: V.muted, marginTop: 4 }}>
        {dateStr}
      </div>
      <div data-testid="clock-tz" style={{ fontSize: 11.5, color: V.muted, marginTop: 3 }}>
        {tz}
      </div>
    </div>
  );
}

/** proto §3 line 528: the resolved IANA timezone name, `_`→space, fallback Local. */
function tzName(): string {
  try {
    return (Intl.DateTimeFormat().resolvedOptions().timeZone || "Local").replace(/_/g, " ");
  } catch {
    return "Local";
  }
}

/** A flex-1 control button (proto §3.3 / §3.4 `btn`) — pad 13px 0, r13, 14px/700. */
function ControlBtn({
  label,
  onClick,
  style,
  testid,
}: {
  label: string;
  onClick: () => void;
  style: CSSProperties;
  testid?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      style={{
        flex: 1,
        padding: "13px 0",
        borderRadius: 13,
        textAlign: "center",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        border: "none",
        ...style,
      }}
    >
      {label}
    </button>
  );
}

/** Stopwatch tab: drift-free elapsed + laps from `lib/clock/stopwatch`, 33ms tick. */
function StopwatchTab() {
  const [running, setRunning] = useState(false);
  const [anchor, setAnchor] = useState<number | null>(null); // start = now - elapsed
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);

  useInterval(
    () => {
      if (anchor !== null) setElapsed(elapsedFrom(Date.now(), anchor));
    },
    running ? 33 : null,
  );

  function start() {
    setAnchor(Date.now() - elapsed);
    setRunning(true);
  }
  function stop() {
    setRunning(false);
  }
  function reset() {
    setRunning(false);
    setElapsed(0);
    setLaps([]);
    setAnchor(null);
  }
  function lap() {
    if (running) setLaps((l) => [...l, elapsed]);
  }

  // proto §3.3: MM:SS main + centiseconds accent span.
  const main = fmtSwMain(elapsed);
  const cs = pad2(Math.floor(elapsed / 10) % 100);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "30px 24px",
      }}
    >
      <div
        data-testid="sw-main"
        style={{
          fontSize: 62,
          fontWeight: 300,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          display: "flex",
          alignItems: "baseline",
          color: V.text,
        }}
      >
        {main}
        <span
          data-testid="sw-cs"
          style={{
            fontSize: 28,
            color: V.accent,
            marginLeft: 5,
            fontWeight: 500,
            width: 46,
            textAlign: "left",
          }}
        >
          .{cs}
        </span>
      </div>

      {/* proto §3.3: at rest = Reset + Start; running = Lap + Stop. */}
      <div style={{ display: "flex", gap: 11, width: "100%", maxWidth: 330, marginTop: 28 }}>
        {running ? (
          <ControlBtn label="Lap" onClick={lap} style={{ background: V.subBg, color: V.text }} />
        ) : (
          <ControlBtn
            label="Reset"
            onClick={reset}
            style={{ background: V.subBg, color: elapsed ? V.text : V.muted }}
          />
        )}
        {running ? (
          <ControlBtn
            label="Stop"
            onClick={stop}
            style={{ background: hexA(RED, 0.15), color: RED }}
          />
        ) : (
          <ControlBtn
            label={elapsed ? "Resume" : "Start"}
            onClick={start}
            style={{ background: ACCENT_16, color: V.accent }}
          />
        )}
      </div>

      {laps.length > 0 && (
        <div
          data-testid="sw-laps"
          style={{
            width: "100%",
            maxWidth: 330,
            marginTop: 24,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {laps
            .map((_, i) => i)
            .reverse()
            .map((i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 4px",
                  borderBottom: `1px solid ${V.line}`,
                  fontSize: 13.5,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span style={{ color: V.muted }}>Lap {i + 1}</span>
                <span style={{ fontWeight: 600 }}>{fmtMs(lapSplit(laps, i))}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/** Timer tab: ring + countdown from `lib/clock/timer`, 200ms tick, chime on done. */
function TimerTab() {
  const [running, setRunning] = useState(false);
  const [preset, setPreset] = useState(PRESETS[1][0]); // default 5 min (proto)
  const [deadline, setDeadline] = useState<number | null>(null);
  const [total, setTotal] = useState(0); // ms
  const [remaining, setRemaining] = useState(0); // ms

  useInterval(
    () => {
      if (deadline === null) return;
      const rem = remainingFrom(Date.now(), deadline);
      setRemaining(rem);
      if (rem <= 0) {
        setRunning(false);
        beep();
      }
    },
    running ? 200 : null,
  );

  function selectPreset(seconds: number) {
    setRunning(false);
    setPreset(seconds);
    setDeadline(null);
    setTotal(0);
    setRemaining(0);
  }
  function startTimer() {
    const ms = total > 0 && remaining > 0 ? remaining : preset * 1000;
    const tot = total > 0 && remaining > 0 ? total : preset * 1000;
    setTotal(tot);
    setRemaining(ms);
    setDeadline(Date.now() + ms);
    setRunning(true);
  }
  function pauseTimer() {
    setRunning(false);
  }
  function resetTimer() {
    setRunning(false);
    setDeadline(null);
    setTotal(0);
    setRemaining(0);
  }

  // proto §3.4: when not yet started, display the chosen preset.
  const dispTotal = total > 0 ? total : preset * 1000;
  const dispRemaining = total > 0 ? remaining : preset * 1000;
  const done = isDone(running, total, remaining);
  const sec = Math.max(0, Math.ceil(dispRemaining / 1000));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  const offset = ringOffset(dispRemaining, dispTotal);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "22px 24px",
      }}
    >
      {/* Ring + centred readout — the prototype rotates the svg -90° so the arc
          starts at 12 o'clock; the readout div sits on top, un-rotated. */}
      <div
        style={{
          position: "relative",
          width: 264,
          height: 264,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={264}
          height={264}
          viewBox="0 0 264 264"
          role="img"
          aria-label="Timer ring"
          style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}
        >
          {/* Track — r110 / stroke13, sub-bg (FD1). */}
          <circle
            className="timer-ring timer-ring--track"
            cx={132}
            cy={132}
            r={110}
            fill="none"
            stroke={V.subBg}
            strokeWidth={13}
          />
          {/* Progress arc — r110 / stroke13, accent var (red when done) (FD1). */}
          <circle
            className="timer-ring timer-ring--arc"
            cx={132}
            cy={132}
            r={110}
            fill="none"
            stroke={done ? RED : V.accent}
            strokeWidth={13}
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={offset}
          />
        </svg>
        <div
          data-testid="timer-readout"
          style={{
            fontSize: done ? 38 : 54,
            fontWeight: done ? 800 : 300,
            fontVariantNumeric: "tabular-nums",
            color: done ? RED : V.text,
          }}
        >
          {done ? "Time!" : `${pad2(mm)}:${pad2(ss)}`}
        </div>
      </div>

      {/* Preset pills 1/5/10/25 (proto §3.4). Selected = accent-tint (FD1). */}
      <div
        data-testid="timer-presets"
        style={{
          display: "flex",
          gap: 8,
          marginTop: 18,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {PRESETS.map(([s, label]) => {
          const sel = !running && total === 0 && preset === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => selectPreset(s)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: sel ? ACCENT_16 : V.subBg,
                color: sel ? V.accent : V.muted,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Reset + Start/Pause/Restart controls (proto §3.4). */}
      <div style={{ display: "flex", gap: 11, width: "100%", maxWidth: 330, marginTop: 20 }}>
        <ControlBtn
          label="Reset"
          onClick={resetTimer}
          style={{ background: V.subBg, color: V.text }}
        />
        {running ? (
          <ControlBtn
            label="Pause"
            onClick={pauseTimer}
            style={{ background: hexA(AMBER, 0.16), color: AMBER }}
          />
        ) : (
          <ControlBtn
            label={done ? "Restart" : "Start"}
            onClick={startTimer}
            style={{ background: ACCENT_16, color: V.accent }}
          />
        )}
      </div>
    </div>
  );
}

/** World tab: zone rows + day/night chip from `lib/clock/world`, 1s tick. */
function WorldTab() {
  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), 1000);
  return (
    <div
      data-testid="clock-world"
      style={{
        padding: "14px 16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 9,
      }}
    >
      {ZONES.map(([label, tz], i) => {
        const { time, weekday, hourNum } = zoneTime(now, tz);
        const night = isNight(hourNum);
        return (
          <div
            key={tz}
            data-testid={`zone-row-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 13,
              background: V.cardBg,
              border: `1px solid ${V.line}`,
              borderRadius: 12,
              padding: "13px 15px",
            }}
          >
            {/* FD2 — 36px round chip holding a real inline <svg> sun/moon glyph,
                with the prototype's fixed day/night indigo+amber hues. */}
            <div
              data-testid="zone-chip"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                flex: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: night ? hexA(NIGHT, 0.15) : hexA(DAY, 0.18),
                color: night ? NIGHT_GLYPH : DAY,
              }}
            >
              {night ? <MoonGlyph /> : <SunGlyph />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: V.text }}>{label}</div>
              <div style={{ fontSize: 11.5, color: V.muted }}>{weekday}</div>
            </div>
            <div
              data-testid={`zone-time-${i}`}
              style={{
                fontSize: 21,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: V.text,
              }}
            >
              {time}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Clock() {
  const [tab, setTab] = useState<Tab>("clock");
  return (
    <div
      className="app-clock"
      data-testid="clock"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "var(--samagra-font)",
      }}
    >
      {/* Tab strip — flex-1 pills, 12.5px/600, pad 8px 0, r9 (proto §3 line 517). */}
      <div
        role="tablist"
        aria-label="Clock modes"
        style={{ display: "flex", gap: 4, padding: "14px 16px 4px", flex: "none" }}
      >
        {TABS.map((t) => {
          const sel = tab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 12.5,
                fontWeight: 600,
                padding: "8px 0",
                borderRadius: 9,
                cursor: "pointer",
                border: "none",
                // Selected → accent text + accent@12% bg; else muted / transparent (FD1).
                color: sel ? V.accent : V.muted,
                background: sel ? ACCENT_12 : "transparent",
              }}
            >
              {TAB_LABEL[t]}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" style={{ flex: 1, overflow: "auto" }}>
        {tab === "clock" && <ClockTab />}
        {tab === "stopwatch" && <StopwatchTab />}
        {tab === "timer" && <TimerTab />}
        {tab === "world" && <WorldTab />}
      </div>
    </div>
  );
}
