// src/apps/Clock/index.tsx
// THIN presentational wrapper (E1.22, VISUAL) over the already-green
// `lib/clock/*` engines (analog/stopwatch/timer/world, green in deepak's
// E1.10–E1.13). The wrapper renders the four tabs `clock | stopwatch | timer |
// world` (proto.md §3, default `clock`) and wires a cleanup-safe `useInterval`
// (1s clock / 33ms stopwatch / 200ms timer). ALL clock math lives in the pure
// lib modules — there is ZERO new geometry/format logic here beyond the trivial
// digital readout (proto §3 line 201–202).
//
// The headless residue the loop gates on is the tab structure: the wrapper
// renders the FOUR tabs. Hand sweep, ring depletion, the WebAudio chime, and
// per-pixel parity are a SEPARATE human QA pass (RUBRIC §6) and are NOT tested.
import { useState } from "react";
import { useInterval } from "../../hooks/useInterval";
import {
  CX,
  CY,
  R,
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

// proto.md §3 line 180: Tabs in this exact order, default `clock`.
const TABS: Tab[] = ["clock", "stopwatch", "timer", "world"];

/** proto §3 line 202: `pad2(n) = (n<10?'0':'')+n`. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * proto §3 line 201: 12-hour digital readout `HH:MM:SS AM/PM`, zero-padded hour
 * (12 for noon/midnight). Trivial format; the analog/stopwatch/timer/world math
 * all lives in lib/clock.
 */
function fmt12(d: Date): string {
  const hr = d.getHours();
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  const ampm = hr < 12 ? "AM" : "PM";
  return `${pad2(h12)}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())} ${ampm}`;
}

/** WebAudio chime reading `CHIME` (proto §3.4). try/catch no-op — never throws. */
function beep(): void {
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

/** Analog face (proto §3.1) from the pure `lib/clock/analog` geometry. */
function AnalogFace({ now }: { now: Date }) {
  const { secA, minA, hrA } = handAngles(now);
  const hour = handEndpoint(CX, CY, hrA, HAND.hour.len, HAND.hour.tail);
  const minute = handEndpoint(CX, CY, minA, HAND.minute.len, HAND.minute.tail);
  const second = handEndpoint(CX, CY, secA, HAND.second.len, HAND.second.tail);
  return (
    <svg viewBox="0 0 300 300" width={260} height={260} role="img" aria-label="Analog clock">
      <circle cx={CX} cy={CY} r={BACKING_R} fill="none" stroke="currentColor" opacity={0.12} />
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="currentColor" opacity={0.25} />
      {faceTicks().map((t) => (
        <line
          key={t.i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke="currentColor"
          strokeWidth={t.big ? 2 : 1}
        />
      ))}
      {faceNumerals().map((n) => (
        <text key={n.label} x={n.x} y={n.y} textAnchor="middle" fontSize={16} fill="currentColor">
          {n.label}
        </text>
      ))}
      <line {...{ x1: hour.x1, y1: hour.y1, x2: hour.x2, y2: hour.y2 }} stroke="currentColor" strokeWidth={HAND.hour.width} strokeLinecap="round" />
      <line {...{ x1: minute.x1, y1: minute.y1, x2: minute.x2, y2: minute.y2 }} stroke="currentColor" strokeWidth={HAND.minute.width} strokeLinecap="round" />
      <line {...{ x1: second.x1, y1: second.y1, x2: second.x2, y2: second.y2 }} stroke="#ef4444" strokeWidth={HAND.second.width} strokeLinecap="round" />
      <circle cx={CX} cy={CY} r={4} fill="currentColor" />
    </svg>
  );
}

/** Clock tab: analog face + 12-hour digital readout, ticking every 1s. */
function ClockTab() {
  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), 1000);
  return (
    <div className="clock-tab">
      <AnalogFace now={now} />
      <div className="clock-digital" style={{ fontVariantNumeric: "tabular-nums" }}>
        {fmt12(now)}
      </div>
    </div>
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

  function toggle() {
    if (running) {
      setRunning(false);
    } else {
      setAnchor(Date.now() - elapsed);
      setRunning(true);
    }
  }
  function reset() {
    setRunning(false);
    setElapsed(0);
    setLaps([]);
    setAnchor(null);
  }

  return (
    <div className="clock-stopwatch">
      <div className="sw-main" style={{ fontVariantNumeric: "tabular-nums" }}>
        {fmtSwMain(elapsed)}
      </div>
      <div className="sw-controls">
        <button type="button" onClick={toggle}>
          {running ? "Stop" : "Start"}
        </button>
        <button type="button" onClick={() => running && setLaps((l) => [...l, elapsed])}>
          Lap
        </button>
        <button type="button" onClick={reset}>
          Reset
        </button>
      </div>
      <ol className="sw-laps">
        {laps
          .map((_, i) => i)
          .reverse()
          .map((i) => (
            <li key={i}>
              Lap {i + 1}: {fmtMs(lapSplit(laps, i))}
            </li>
          ))}
      </ol>
    </div>
  );
}

/** Timer tab: ring + countdown from `lib/clock/timer`, 200ms tick, chime on done. */
function TimerTab() {
  const [running, setRunning] = useState(false);
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

  function startPreset(seconds: number) {
    const ms = seconds * 1000;
    setTotal(ms);
    setRemaining(ms);
    setDeadline(Date.now() + ms);
    setRunning(true);
  }

  const sec = Math.max(0, Math.ceil(remaining / 1000));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  const done = isDone(running, total, remaining);
  const offset = ringOffset(remaining, total);

  return (
    <div className="clock-timer">
      <svg viewBox="0 0 240 240" width={220} height={220} role="img" aria-label="Timer ring">
        <circle cx={120} cy={120} r={110} fill="none" stroke="currentColor" opacity={0.15} strokeWidth={8} />
        <circle
          cx={120}
          cy={120}
          r={110}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={offset}
          transform="rotate(-90 120 120)"
        />
        <text x={120} y={128} textAnchor="middle" fontSize={done ? 30 : 40} fill={done ? "#ef4444" : "currentColor"}>
          {done ? "Time!" : `${pad2(mm)}:${pad2(ss)}`}
        </text>
      </svg>
      <div className="timer-presets">
        {PRESETS.map(([s, label]) => (
          <button key={s} type="button" onClick={() => startPreset(s)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** World tab: zone table + day/night from `lib/clock/world`, 1s tick. */
function WorldTab() {
  const [now, setNow] = useState(() => new Date());
  useInterval(() => setNow(new Date()), 1000);
  return (
    <ul className="clock-world">
      {ZONES.map(([label, tz]) => {
        const { time, weekday, hourNum } = zoneTime(now, tz);
        return (
          <li key={tz} className={isNight(hourNum) ? "zone-night" : "zone-day"}>
            <span className="zone-label">{label}</span>
            <span className="zone-time" style={{ fontVariantNumeric: "tabular-nums" }}>
              {weekday} {time}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const TAB_LABEL: Record<Tab, string> = {
  clock: "Clock",
  stopwatch: "Stopwatch",
  timer: "Timer",
  world: "World",
};

export default function Clock() {
  const [tab, setTab] = useState<Tab>("clock");
  return (
    <div className="app-clock" data-testid="clock">
      <div role="tablist" aria-label="Clock modes" className="clock-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`clock-tab-btn${tab === t ? " is-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="clock-panel">
        {tab === "clock" && <ClockTab />}
        {tab === "stopwatch" && <StopwatchTab />}
        {tab === "timer" && <TimerTab />}
        {tab === "world" && <WorldTab />}
      </div>
    </div>
  );
}
