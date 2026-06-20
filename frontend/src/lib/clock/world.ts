// World clock — zone table + day/night rule + a thin `Intl` time helper.
// The zone table and the `isNight` rule are pure and headless-testable; the
// `zoneTime` helper wraps `Intl.DateTimeFormat`/`toLocaleString` for the (visual)
// Clock wrapper (E1.22) and is intentionally NOT asserted in the rule test.
// Spec: docs/superpowers/_research/samagra-os/proto.md §3.5 (clockWorld, lines 595–607).

/**
 * Six zones in exact order (proto §3.5, line 597): `[label, IANA tz]` pairs.
 * The order is load-bearing — the World tab renders them in this sequence.
 */
export const ZONES: ReadonlyArray<readonly [string, string]> = [
  ["New Delhi", "Asia/Kolkata"],
  ["London", "Europe/London"],
  ["New York", "America/New_York"],
  ["San Francisco", "America/Los_Angeles"],
  ["Tokyo", "Asia/Tokyo"],
  ["Dubai", "Asia/Dubai"],
];

/**
 * Day/night rule (proto §3.5, line 227): `night = hourNum < 6 || hourNum >= 19`,
 * i.e. **day = 06:00–18:59 local**, else night. `hourNum` (0–23 local hour) is the
 * input — no real `Intl` dependency in the rule, so this is pure.
 */
export function isNight(hourNum: number): boolean {
  return hourNum < 6 || hourNum >= 19;
}

/**
 * Per-zone display fields via `Intl` (proto §3.5, line 226), for the Clock wrapper:
 *   - `time`: `toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })`
 *   - `weekday`: short weekday in that zone
 *   - `hourNum`: 24h local hour parsed from
 *     `toLocaleString('en-US', { timeZone, hour: '2-digit', hour12: false })`
 *
 * Not asserted in the rule test (depends on the host `Intl` data); kept thin so all
 * real day/night logic lives in `isNight`.
 */
export function zoneTime(
  date: Date,
  tz: string,
): { time: string; weekday: string; hourNum: number } {
  const time = date.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
  const weekday = date.toLocaleString("en-US", { timeZone: tz, weekday: "short" });
  const hh = date.toLocaleString("en-US", { timeZone: tz, hour: "2-digit", hour12: false });
  const hourNum = parseInt(hh.replace(/\D/g, ""), 10) % 24;
  return { time, weekday, hourNum };
}
