// Stopwatch math — drift-free elapsed, lap splits, and display formatting.
// Pure, headless-testable; `now` is injected so there is no real timer here.
// Spec: docs/superpowers/_research/samagra-os/proto.md §3.3 (sw* methods, lines 547–567).

/** Zero-pad an integer to two digits. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Drift-free elapsed: with a wall-clock anchor `start = now - elapsed`,
 * the elapsed time is simply `now - start`. No accumulation, no drift.
 */
export function elapsedFrom(now: number, start: number): number {
  return now - start;
}

/**
 * Lap split for `laps[idx]`: `laps[idx] - laps[idx-1]`, with the first lap
 * measured from 0. `laps` are cumulative elapsed values at each lap press.
 */
export function lapSplit(laps: number[], idx: number): number {
  const prev = idx > 0 ? laps[idx - 1] : 0;
  return laps[idx] - prev;
}

/**
 * Lap-row format `MM:SS.cc` (proto §3.3):
 *   cs  = floor(ms/10) % 100
 *   sec = floor(ms/1000) % 60
 *   min = floor(ms/60000) % 60
 */
export function fmtMs(ms: number): string {
  const cs = Math.floor(ms / 10) % 100;
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / 60000) % 60;
  return `${pad2(min)}:${pad2(sec)}.${pad2(cs)}`;
}

/**
 * Main display (proto §3.3): the hours segment appears only when `hrs > 0`.
 *   hrs = floor(ms/3600000)
 *   min = floor(ms/60000) % 60
 *   sec = floor(ms/1000) % 60
 *   disp = (hrs>0 ? pad2(hrs)+':' : '') + pad2(min)+':'+pad2(sec)
 */
export function fmtSwMain(ms: number): string {
  const hrs = Math.floor(ms / 3_600_000);
  const min = Math.floor(ms / 60_000) % 60;
  const sec = Math.floor(ms / 1000) % 60;
  return (hrs > 0 ? `${pad2(hrs)}:` : "") + `${pad2(min)}:${pad2(sec)}`;
}
