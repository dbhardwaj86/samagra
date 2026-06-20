// Snake reducer — pure (state, input) → state with an injected RNG for food.
// Headless-testable: no canvas, no interval, no DOM. The React wrapper (E1.24)
// owns the interval/canvas and calls these pure functions.
// Spec: docs/superpowers/_research/samagra-os/proto.md §2.1–§2.7.

/** Grid dimensions (19 × 19) — proto.md §2.1. */
export const COLS = 19;
export const ROWS = 19;

/** A cell coordinate `[x, y]`. */
export type Cell = [number, number];

/** A direction vector `[dx, dy]` (one of the four unit vectors). */
export type Dir = [number, number];

/**
 * Read-tolerant coordinate: any number array whose first two entries are `[x, y]`.
 * Inputs (state passed into the reducer, body cells handed to `food`) accept
 * this looser shape so callers can build states from plain array literals
 * without tuple ceremony; constructed outputs are always strict {@link Cell}s.
 * Only indices 0 and 1 are ever read.
 */
export type CellLike = readonly number[];

/** Difficulty level name. */
export type Level = "relaxed" | "normal";

/** Per-tick / per-food tuning for a level. */
export interface LevelParams {
  /** Base tick interval in ms (starting speed). */
  base: number;
  /** Fastest tick interval in ms (speed floor). */
  floor: number;
  /** ms shaved off the tick per food eaten. */
  dec: number;
}

/** Level table — proto.md §2.1 (`snakeLvls()`), exact. */
export const LEVELS: Record<Level, LevelParams> = {
  relaxed: { base: 215, floor: 135, dec: 2 },
  normal: { base: 135, floor: 70, dec: 3 },
};

/** Game lifecycle status. */
export type Status = "idle" | "running" | "paused" | "dead";

/** Full snake game state — proto.md §2.3. Returned by the reducer (strict tuples). */
export interface SnakeState {
  /** Body cells, head first, tail last. */
  body: Cell[];
  /** Committed direction (the dir the last step moved in). */
  dir: Dir;
  /** Queued direction for the next step (set by `setDir`). */
  next: Dir;
  /** Current food cell. */
  food: Cell;
  /** Score (10 per food). */
  score: number;
  /** Current tick interval in ms. */
  speed: number;
  /** Difficulty level. */
  level: Level;
  /** Lifecycle status. */
  status: Status;
}

/**
 * Read-tolerant state accepted by the reducer functions. Mirrors {@link SnakeState}
 * but with {@link CellLike} coordinates, so a caller can build a state from plain
 * `number[][]` literals. The reducer never mutates the input and always returns a
 * strict {@link SnakeState}.
 */
export interface SnakeStateInput {
  body: readonly CellLike[];
  dir: CellLike;
  next: CellLike;
  food: CellLike;
  score: number;
  speed: number;
  level: Level;
  status: Status;
}

/** A 0..1 random source; injected so food placement is deterministic in tests. */
export type Rng = () => number;

/**
 * Uniform random free cell — proto.md §2.4. Rejection-resamples until the
 * sampled cell is not on any body segment.
 */
export function food(body: readonly CellLike[], rng: Rng): Cell {
  // Bounded retry guard: the board (19×19=361) far exceeds any body length, so
  // a free cell always exists; the cap only prevents a pathological RNG from
  // spinning forever.
  for (let i = 0; i < 10000; i++) {
    const x = Math.floor(rng() * COLS);
    const y = Math.floor(rng() * ROWS);
    if (!body.some((b) => b[0] === x && b[1] === y)) return [x, y];
  }
  // Deterministic fallback: first cell not on the body (scan order).
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!body.some((b) => b[0] === x && b[1] === y)) return [x, y];
    }
  }
  return [0, 0];
}

/**
 * Fresh game state at the given level — proto.md §2.3.
 * Body `[[9,9],[8,9],[7,9]]`, pointing right, idle, score 0, speed = base.
 */
export function init(level: Level, rng: Rng): SnakeState {
  const L = LEVELS[level];
  const body: Cell[] = [
    [9, 9],
    [8, 9],
    [7, 9],
  ];
  return {
    body,
    dir: [1, 0],
    next: [1, 0],
    food: food(body, rng),
    score: 0,
    speed: L.base,
    level,
    status: "idle",
  };
}

/**
 * Queue a direction change — proto.md §2.5. Returns a new state with `next`
 * updated, unless the proposed direction is the exact reverse of the COMMITTED
 * `dir` (guard vs `dir`, not `next`, so two fast turns can't self-reverse).
 */
export function setDir(state: SnakeStateInput, d: CellLike): SnakeState {
  const dx = d[0];
  const dy = d[1];
  const norm = normalize(state);
  if (norm.dir[0] === -dx && norm.dir[1] === -dy) {
    return norm; // reverse into self — ignored
  }
  return { ...norm, next: [dx, dy] };
}

/**
 * Advance one tick — proto.md §2.6. Only `running` states move; others are
 * returned unchanged. Computes the new head from `next`, applies wall + self
 * collision (tail cell exempt), then either eats (grow + score + speed ramp) or
 * trims the tail (constant length).
 */
export function step(input: SnakeStateInput, rng: Rng): SnakeState {
  const state = normalize(input);
  if (state.status !== "running") return state;

  const L = LEVELS[state.level];
  const dir = state.next;
  const head: Cell = [state.body[0][0] + dir[0], state.body[0][1] + dir[1]];

  const hitWall =
    head[0] < 0 || head[1] < 0 || head[0] >= COLS || head[1] >= ROWS;
  // Self-collision: any body cell EXCEPT the last (tail) — the tail vacates this
  // tick, so following your own tail is legal.
  const hitSelf = state.body.some(
    (b, i) =>
      i < state.body.length - 1 && b[0] === head[0] && b[1] === head[1],
  );

  if (hitWall || hitSelf) {
    return { ...state, dir, status: "dead" };
  }

  const grew: Cell[] = [head, ...state.body];
  const ate = head[0] === state.food[0] && head[1] === state.food[1];

  if (ate) {
    return {
      ...state,
      dir,
      body: grew, // grows: tail not trimmed
      food: food(grew, rng),
      score: state.score + 10,
      speed: Math.max(L.floor, state.speed - L.dec),
    };
  }

  return { ...state, dir, body: grew.slice(0, -1) }; // drop tail
}

/** Coerce a read-tolerant input into a strict {@link SnakeState} (no mutation). */
function normalize(s: SnakeStateInput): SnakeState {
  return {
    body: s.body.map((c): Cell => [c[0], c[1]]),
    dir: [s.dir[0], s.dir[1]],
    next: [s.next[0], s.next[1]],
    food: [s.food[0], s.food[1]],
    score: s.score,
    speed: s.speed,
    level: s.level,
    status: s.status,
  };
}
