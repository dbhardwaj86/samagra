// Timer math — remaining time, ring (SVG dash-offset) geometry, presets,
// done detection, and the locked chime config. Pure and headless-testable;
// `now` is injected so there is no real timer here. The WebAudio OscillatorNode
// itself lives in the (visual) Clock wrapper (E1.22), which reads `CHIME`.
// Spec: docs/superpowers/_research/samagra-os/proto.md §3.4 (timer*, lines 568–594).

/**
 * Preset table (proto §3.4, line 581): 1 / 5 / 10 / 25 minutes, in seconds,
 * paired with their display labels.
 */
export const PRESETS: ReadonlyArray<[number, string]> = [
  [60, "1 min"],
  [300, "5 min"],
  [600, "10 min"],
  [1500, "25 min"],
];

/** Ring circumference C = 2πR with R = 110 (proto §3.4, line 580). */
export const RING_C = 2 * Math.PI * 110;

/**
 * Remaining time, floored at 0 (never negative). The deadline and the clock
 * reading share the same unit (ms) and clock — both injected, so this is pure.
 * Per the spec contract `remainingFrom(900, 1000) === 100` and
 * `remainingFrom(2000, 1000) === 0`, i.e. the second argument is the larger
 * reference (now / end) and remaining = `b - a` clamped at 0.
 */
export function remainingFrom(a: number, b: number): number {
  return Math.max(0, b - a);
}

/**
 * SVG progress-ring `strokeDashoffset` (proto §3.4, lines 580–586):
 *   frac   = total > 0 ? max(0, remaining / total) : 1
 *   offset = C * (1 - frac)
 * frac is clamped to ≥ 0; at `total = 0` the ring reads full (frac = 1 ⇒ offset 0).
 */
export function ringOffset(remaining: number, total: number): number {
  const frac = total > 0 ? Math.max(0, remaining / total) : 1;
  return RING_C * (1 - frac);
}

/**
 * Done detection (proto §3.4): the timer is "Time!" exactly when it is not
 * running, was actually started (`total > 0`), and has counted down (`remaining <= 0`).
 */
export function isDone(running: boolean, total: number, remaining: number): boolean {
  return !running && total > 0 && remaining <= 0;
}

/**
 * Chime config (proto §3.4, line 568) — the load-bearing pitch/envelope read by
 * the WebAudio `OscillatorNode` in the Clock wrapper:
 *   type='sine', frequency=880 Hz; gain envelope 0.0001 → 0.18 (ramp +0.02s)
 *   → 0.0001 (+0.7s); o.stop(currentTime + 0.72).
 */
export const CHIME = {
  freq: 880,
  type: "sine",
  gainPeak: 0.18,
  attack: 0.02,
  release: 0.7,
  stopAfter: 0.72,
} as const;
