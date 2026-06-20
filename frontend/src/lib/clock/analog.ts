// Analog clock face geometry — pure trig, headless-testable.
// Spec: docs/superpowers/_research/samagra-os/proto.md §3.1 (clockFace, lines 529–545).
// All angles are in degrees, 12-o'clock = 0, clockwise positive.

/** Face constants (SVG 300×300, viewBox "0 0 300 300"). */
export const CX = 150;
export const CY = 150;
/** Face radius. */
export const R = 120;
/** Backing circle radius (R + 14). */
export const BACKING_R = R + 14; // 134
/** Numeral ring radius (R - 30). */
export const NUMERAL_R = R - 30; // 90

/** Per-hand geometry: length (px) and tail (px) behind the center pin. */
export const HAND = {
  hour: { len: 62, tail: 16, width: 5 },
  minute: { len: 92, tail: 16, width: 4 },
  second: { len: 102, tail: 30, width: 2 },
} as const;

export interface HandAngles {
  /** Second-hand angle in degrees. */
  secA: number;
  /** Minute-hand angle in degrees. */
  minA: number;
  /** Hour-hand angle in degrees. */
  hrA: number;
}

/**
 * Hand angles for a given instant.
 *   secA = s*6
 *   minA = m*6 + s*0.1
 *   hrA  = (hr%12)*30 + m*0.5
 */
export function handAngles(d: Date): HandAngles {
  const s = d.getSeconds();
  const m = d.getMinutes();
  const hr = d.getHours();
  return {
    secA: s * 6,
    minA: m * 6 + s * 0.1,
    hrA: (hr % 12) * 30 + m * 0.5,
  };
}

export interface HandEndpoint {
  /** Tail end (behind the center pin). */
  x1: number;
  y1: number;
  /** Tip end. */
  x2: number;
  y2: number;
}

/**
 * Endpoints of a hand of length `len` at angle `ang` (deg), with a `tail`
 * extending behind the center. `rad = (ang - 90)·π/180` so that ang=0 points
 * straight up (−y in SVG coords).
 */
export function handEndpoint(
  cx: number,
  cy: number,
  ang: number,
  len: number,
  tail: number,
): HandEndpoint {
  const rad = ((ang - 90) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x1: cx - tail * cos,
    y1: cy - tail * sin,
    x2: cx + len * cos,
    y2: cy + len * sin,
  };
}

export interface TickGeom {
  i: number;
  /** Major tick every 5th position. */
  big: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * The 60 face ticks (i = 0..59) at angle (i*6 − 90)°.
 * Major ticks (i % 5 === 0): inner radius R−14; minor: R−7. Outer: R−2.
 */
export function faceTicks(cx: number = CX, cy: number = CY, r: number = R): TickGeom[] {
  const ticks: TickGeom[] = [];
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    const r1 = big ? r - 14 : r - 7;
    const r2 = r - 2;
    const rad = ((i * 6 - 90) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    ticks.push({
      i,
      big,
      x1: cx + r1 * cos,
      y1: cy + r1 * sin,
      x2: cx + r2 * cos,
      y2: cy + r2 * sin,
    });
  }
  return ticks;
}

export interface NumeralGeom {
  label: number;
  x: number;
  y: number;
}

/**
 * Numerals 12/3/6/9 at angle (deg − 90)° for deg ∈ {0, 90, 180, 270},
 * radius R−30, with `y += 6` for vertical optical centering.
 */
export function faceNumerals(cx: number = CX, cy: number = CY, r: number = R): NumeralGeom[] {
  const ring = r - 30;
  const map: Array<{ label: number; deg: number }> = [
    { label: 12, deg: 0 },
    { label: 3, deg: 90 },
    { label: 6, deg: 180 },
    { label: 9, deg: 270 },
  ];
  return map.map(({ label, deg }) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return {
      label,
      x: cx + ring * Math.cos(rad),
      y: cy + ring * Math.sin(rad) + 6,
    };
  });
}
