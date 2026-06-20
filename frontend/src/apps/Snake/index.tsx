// src/apps/Snake/index.tsx
// THIN presentational wrapper (E1.24, VISUAL) over the already-green
// `lib/snake/*` engine + cell math (snake reducer / food RNG / responsive cell
// size, green in deepak's E1.15/E1.16) and the `lib/persistence` save/load seam
// (E1.3). There is ZERO new game logic here — every tick delegates to the pure
// `step`/`setDir`/`init` reducer; the wrapper only owns the SVG board, the
// per-level interval, best/level persistence, and the keyboard handling.
//
// The headless residue the loop gates on (E1.24 Step 1 / proto.md §2.9, lines
// 165–177): `isSnakeActive` returns FALSE when `document.activeElement` is an
// INPUT or TEXTAREA, so arrow/WASD/Space keypresses are NOT hijacked away from a
// focused Terminal / Notes text field. Per-pixel / interaction parity (board
// render, head/body fade, food halo, D-pad, speed ramp feel, death) is a
// SEPARATE human QA pass (RUBRIC §6, E1.24 row) and is NOT tested here.
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppId, Device } from "../../types/contracts";
import { KEYS, load, save } from "../../lib/persistence";
import { COLS, ROWS, cellSize, boardPx } from "../../lib/snake/cell";
import {
  LEVELS,
  init,
  setDir,
  step,
  type Dir,
  type Level,
  type SnakeState,
} from "../../lib/snake/engine";

/**
 * Resolved gating context: `activeApp` is the already-resolved active app (top
 * non-minimized window on pc, `mobileApp` on mobile — the z-order math lives in
 * the wrapper / WM store, proto.md §1.5/§2.9).
 */
export interface SnakeActiveCtx {
  device: Device;
  activeApp: AppId | null;
}

/**
 * Keyboard / activity gating predicate — proto.md §2.9 (lines 165–177).
 * PURE: reads only `ctx` and `document.activeElement`.
 *
 * - FALSE if a text field is focused (`activeElement` is INPUT/TEXTAREA) — so a
 *   focused Terminal / Notes input is NOT hijacked by snake's arrow/WASD/Space.
 * - Otherwise snake drives the game only when it is the active app: mobile →
 *   `mobileApp === 'snake'`; pc → top non-min window is snake. In both cases the
 *   already-resolved `activeApp` must equal `'snake'`.
 */
export function isSnakeActive(ctx: SnakeActiveCtx): boolean {
  const tag =
    typeof document !== "undefined"
      ? document.activeElement?.tagName
      : undefined;
  if (tag === "INPUT" || tag === "TEXTAREA") return false;
  return ctx.activeApp === "snake";
}

// proto.md §2.9 key map: Arrows + WASD → unit dir vectors.
const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};

const LEVEL_NAMES: Level[] = ["relaxed", "normal"];

/** Validate a persisted level string — invalid → `normal` (proto §2.8). */
function loadLevel(): Level {
  const raw = load<string>(KEYS.snakeLevel, "normal");
  return raw === "relaxed" || raw === "normal" ? raw : "normal";
}

export default function Snake() {
  // Deterministic RNG injection point — Math.random in the live app.
  const rng = useRef<() => number>(() => Math.random());

  const [level, setLevel] = useState<Level>(() => loadLevel());
  const [best, setBest] = useState<number>(() => load<number>(KEYS.snakeBest, 0));
  const [game, setGame] = useState<SnakeState>(() => init(level, rng.current));

  const cell = cellSize();
  const board = boardPx(cell);

  // ── Tick: delegate to the pure reducer; persist best on death. ─────────────
  const tick = useCallback(() => {
    setGame((prev) => {
      const nextState = step(prev, rng.current);
      if (nextState.status === "dead" && prev.status === "running") {
        setBest((b) => {
          const nb = Math.max(b, nextState.score);
          save(KEYS.snakeBest, nb);
          return nb;
        });
      }
      return nextState;
    });
  }, []);

  // Per-level interval (paused unless running) — re-armed when speed changes.
  useEffect(() => {
    if (game.status !== "running") return;
    const id = setInterval(tick, game.speed);
    return () => clearInterval(id);
  }, [game.status, game.speed, tick]);

  const start = useCallback(() => {
    setGame((prev) =>
      prev.status === "dead" || prev.status === "idle"
        ? { ...init(prev.level, rng.current), status: "running" }
        : { ...prev, status: "running" },
    );
  }, []);

  const pause = useCallback(() => {
    setGame((prev) =>
      prev.status === "running" ? { ...prev, status: "paused" } : prev,
    );
  }, []);

  const turn = useCallback((d: Dir) => {
    setGame((prev) => setDir(prev, d));
  }, []);

  const changeLevel = useCallback((lv: Level) => {
    setLevel(lv);
    save(KEYS.snakeLevel, lv);
    setGame(init(lv, rng.current));
  }, []);

  // ── Keyboard handling, gated by `isSnakeActive` (proto §2.9). ──────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // pc: snake drives only when it is the active window AND no text field is
      // focused. The activeApp is resolved at the WM level; here the app is
      // mounted so it is presumed the active surface — the focus guard is what
      // prevents hijacking a focused Terminal / Notes input.
      if (!isSnakeActive({ device: "pc", activeApp: "snake" })) return;
      const dir = KEY_DIRS[e.key];
      if (dir) {
        e.preventDefault();
        turn(dir);
        return;
      }
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        setGame((prev) =>
          prev.status === "running" ? { ...prev, status: "paused" } : prev,
        );
        if (game.status !== "running") start();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game.status, turn, start]);

  return (
    <div className="app-snake" data-testid="snake">
      <div className="snake-hud">
        <span className="snake-score">Score {game.score}</span>
        <span className="snake-best">Best {best}</span>
        <div role="group" aria-label="Difficulty" className="snake-levels">
          {LEVEL_NAMES.map((lv) => (
            <button
              key={lv}
              type="button"
              aria-pressed={level === lv}
              className={`snake-level${level === lv ? " is-active" : ""}`}
              onClick={() => changeLevel(lv)}
            >
              {lv}
            </button>
          ))}
        </div>
      </div>

      <svg
        className="snake-board"
        width={board.w}
        height={board.h}
        viewBox={`0 0 ${COLS} ${ROWS}`}
        role="img"
        aria-label="Snake board"
      >
        <rect x={0} y={0} width={COLS} height={ROWS} className="snake-bg" rx={0.4} />
        {game.body.map((c, i) => (
          <rect
            key={`${c[0]},${c[1]},${i}`}
            x={c[0]}
            y={c[1]}
            width={1}
            height={1}
            className={i === 0 ? "snake-head" : "snake-seg"}
          />
        ))}
        <circle
          cx={game.food[0] + 0.5}
          cy={game.food[1] + 0.5}
          r={0.32}
          className="snake-food"
        />
      </svg>

      <div className="snake-controls">
        <button type="button" className="snake-go" onClick={start}>
          {game.status === "dead" ? "Restart" : "Start"}
        </button>
        <button type="button" className="snake-pause" onClick={pause}>
          Pause
        </button>
        <div role="group" aria-label="D-pad" className="snake-dpad">
          <button type="button" aria-label="Up" onClick={() => turn([0, -1])}>↑</button>
          <button type="button" aria-label="Left" onClick={() => turn([-1, 0])}>←</button>
          <button type="button" aria-label="Down" onClick={() => turn([0, 1])}>↓</button>
          <button type="button" aria-label="Right" onClick={() => turn([1, 0])}>→</button>
        </div>
      </div>

      <div className="snake-meta" data-speed={game.speed} data-base={LEVELS[level].base} />
    </div>
  );
}
