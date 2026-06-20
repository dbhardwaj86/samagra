// src/apps/Snake/index.tsx
// AP6 FIDELITY — Snake (README §Apps#14 Snake, #22c55e 480×680).
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
// focused Terminal / Notes text field.
//
// FIDELITY (AP6): the markup/tokens are a VERBATIM port of the prototype's
// `app_snake` (.dc.html L634–673 / README §Apps#14). FD1: the CHROME surface
// colours — board surface, grid stroke, food hue, plus the header/toggle/control
// containers — are driven off the theme via the `--samagra-*` vars (text / muted
// / line / card-bg / sub-bg) PLUS local `--snake-*` vars (board / food / grid)
// that recolour per [data-theme] via a scoped <style>, so the surface renders
// correctly in aqua, console AND samagra.
//
// CRITICAL THEME NOTE: the snake's signature GREEN is the prototype's FIXED
// literal `A='#22c55e'` — it is NOT the theme accent. In the .dc.html `app_snake`
// `A` is a constant, and all three authoritative screenshots (aqua-18, console-04,
// samagra-04) render the score value, the snake segments, the SELECTED level pill
// and the Start/CTA in the SAME green even though the theme accents differ
// (aqua #4f46e5 · console #38bdf8 · samagra #d9601a). Driving these off
// `--samagra-accent` would wrongly paint them indigo / blue / ember. So the green
// is pinned to SNAKE_ACCENT (#22c55e) verbatim; only the board/grid/food hues are
// theme-kind-driven (food → #fbbf24 default, #d9601a in samagra — proto `FOOD`).
// Other fixed semantic literals are the prototype's #04210f CTA text + #d97706
// pause amber. FD2: the board IS a real inline <svg> (rounded-rect snake + circle
// food + grid <line>s) — NEVER a letter/emoji grid.
//
// Per-pixel / interaction parity (head/body fade feel, food halo, speed ramp,
// death animation) is a SEPARATE human QA pass (RUBRIC §6, E1.24 row) and is
// NOT tested here.
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppId, Device } from "../../types/contracts";
import { KEYS, load, save } from "../../lib/persistence";
import { COLS, ROWS, DEFAULT_CELL } from "../../lib/snake/cell";
import {
  LEVELS,
  init,
  setDir,
  step,
  type Dir,
  type Level,
  type SnakeState,
} from "../../lib/snake/engine";

// ── FD1 theme tokens — the CHROME containers track the active theme (the
// prototype's `t.text / t.muted / t.cardBg / t.line / t.subBg`). Local `--snake-*`
// vars (board / food / grid) are theme-kind-driven via the scoped <style> below.
const V = {
  text: "var(--samagra-text)",
  muted: "var(--samagra-muted)",
  line: "var(--samagra-line)",
  cardBg: "var(--samagra-card-bg)",
  subBg: "var(--samagra-sub-bg)",
  boardBg: "var(--snake-board-bg)",
  food: "var(--snake-food)",
  foodHalo: "var(--snake-food-halo)",
  grid: "var(--snake-grid)",
} as const;

// The prototype's FIXED snake green `A='#22c55e'` — a brand literal, NOT the theme
// accent (see header note). Pinned verbatim so the score value / segments /
// selected level pill / CTA read green in every theme, matching all 3 screenshots.
const SNAKE_ACCENT = "#22c55e";

// Snake-green tint @16% — the prototype's `hex(A, 0.16)` Start/Resume pill. Built
// off the fixed snake green (not the theme accent) via color-mix.
const ACCENT_16 = `color-mix(in srgb, ${SNAKE_ACCENT} 16%, transparent)`;

// Fixed semantic literals (NOT the theme accent) — verbatim prototype hexes.
const CTA_TEXT = "#04210f"; // accent-pill text (proto)
const AMBER = "#d97706"; // Pause control
const AMBER_15 = "rgba(217,119,6,0.15)"; // hex('#d97706', 0.15)

// proto §2.9 key map: Arrows + WASD → unit dir vectors.
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
const LEVEL_LABEL: Record<Level, string> = { relaxed: "Relaxed", normal: "Normal" };

// Default render cell — the prototype's fixed 18px tile (windowed responsive
// sizing is a wrapper/WM concern; the presented surface uses DEFAULT_CELL).
const CELL = DEFAULT_CELL;
const W = COLS * CELL;
const Hh = ROWS * CELL;

// proto §2.9: scoped per-[data-theme] board / food / grid hues. Defaults = the
// aqua/mac dark-navy board + amber food; console near-black + lower-alpha grid;
// samagra cream board + ember food + warm grid. Self-contained (no store
// coupling) — the override keys off the active [data-theme] ANCESTOR (FD1).
const SNAKE_STYLE = `
.app-snake{
  --snake-board-bg:#0d1422;
  --snake-food:#fbbf24;
  --snake-food-halo:rgba(251,191,36,0.4);
  --snake-grid:rgba(255,255,255,0.045);
}
[data-theme="console"] .app-snake{
  --snake-board-bg:#070b12;
}
[data-theme="samagra"] .app-snake{
  --snake-board-bg:#efe0c8;
  --snake-food:#d9601a;
  --snake-food-halo:rgba(217,96,26,0.4);
  --snake-grid:rgba(147,127,99,0.16);
}
.app-snake .snake-overlay{
  backdrop-filter:blur(2px);
  -webkit-backdrop-filter:blur(2px);
}`;

/** Validate a persisted level string — invalid → `normal` (proto §2.8). */
function loadLevel(): Level {
  const raw = load<string>(KEYS.snakeLevel, "normal");
  return raw === "relaxed" || raw === "normal" ? raw : "normal";
}

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
 * - Otherwise snake drives the game only when it is the active app.
 */
export function isSnakeActive(ctx: SnakeActiveCtx): boolean {
  const tag =
    typeof document !== "undefined"
      ? document.activeElement?.tagName
      : undefined;
  if (tag === "INPUT" || tag === "TEXTAREA") return false;
  return ctx.activeApp === "snake";
}

/**
 * proto: body fade — `hex(A, 0.8 - min(0.45, i*0.02))`. The head (i=0) is the
 * SOLID fixed snake green; each body seg fades that SAME green (NOT the theme
 * accent) via color-mix, so the gradient is identical across all three themes.
 */
function segFill(i: number): string {
  if (i === 0) return SNAKE_ACCENT;
  const alpha = 0.8 - Math.min(0.45, i * 0.02);
  return `color-mix(in srgb, ${SNAKE_ACCENT} ${Math.round(alpha * 100)}%, transparent)`;
}

export default function Snake() {
  // Deterministic RNG injection point — Math.random in the live app.
  const rng = useRef<() => number>(() => Math.random());

  const [level, setLevel] = useState<Level>(() => loadLevel());
  const [best, setBest] = useState<number>(() => load<number>(KEYS.snakeBest, 0));
  const [game, setGame] = useState<SnakeState>(() => init(level, rng.current));

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

  const newGame = useCallback(() => {
    setGame((prev) => init(prev.level, rng.current));
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

  // proto: overlay shows on idle / dead / paused; the title + subtitle + CTA
  // copy switch on status.
  const overlayShown =
    game.status === "idle" || game.status === "dead" || game.status === "paused";
  const overlayTitle =
    game.status === "dead" ? "Game Over" : game.status === "paused" ? "Paused" : "Snake";
  const overlaySub =
    game.status === "dead"
      ? `Score ${game.score}  ·  Best ${best}`
      : "Arrows / WASD · eat the seeds · Space to pause";
  const overlayCta =
    game.status === "dead" ? "Play again" : game.status === "paused" ? "Resume" : "Start";

  // proto: the side primary control flips between Pause (running) and
  // Start/Resume/Restart (otherwise).
  const sideLabel =
    game.status === "dead" ? "Restart" : game.status === "paused" ? "Resume" : "Start";

  // proto §2.9: the food halo radius is cell*0.5; the filled disc is cell*0.32.
  const fx = game.food[0] * CELL + CELL / 2;
  const fy = game.food[1] * CELL + CELL / 2;

  // Interior grid lines: i = 1..COLS-1 vertical + 1..ROWS-1 horizontal.
  const vLines = Array.from({ length: COLS - 1 }, (_, k) => k + 1);
  const hLines = Array.from({ length: ROWS - 1 }, (_, k) => k + 1);

  return (
    <div
      className="app-snake"
      data-testid="snake"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px 16px 20px",
        fontFamily: "var(--samagra-font)",
      }}
    >
      <style>{SNAKE_STYLE}</style>

      {/* ── Header: SCORE (accent) · BEST (text) ─────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: W,
          maxWidth: "100%",
          marginBottom: 12,
        }}
      >
        <div>
          <div
            data-testid="snake-score-label"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: V.muted,
            }}
          >
            Score
          </div>
          <div
            data-testid="snake-score-value"
            style={{
              fontSize: 25,
              fontWeight: 800,
              color: SNAKE_ACCENT,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.1,
            }}
          >
            {game.score}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            data-testid="snake-best-label"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: V.muted,
            }}
          >
            Best
          </div>
          <div
            data-testid="snake-best-value"
            style={{
              fontSize: 25,
              fontWeight: 800,
              color: V.text,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.1,
            }}
          >
            {best}
          </div>
        </div>
      </div>

      {/* ── Level segmented toggle ───────────────────────────────────────── */}
      <div
        role="group"
        aria-label="Difficulty"
        style={{
          display: "flex",
          gap: 4,
          width: W,
          maxWidth: "100%",
          marginBottom: 11,
          background: V.cardBg,
          border: `1px solid ${V.line}`,
          borderRadius: 10,
          padding: 4,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: V.muted,
          }}
        >
          Level
        </span>
        {LEVEL_NAMES.map((lv) => {
          const sel = level === lv;
          return (
            <button
              key={lv}
              type="button"
              aria-pressed={sel}
              onClick={() => changeLevel(lv)}
              style={{
                flex: 1,
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                padding: "7px 0",
                borderRadius: 8,
                cursor: "pointer",
                border: "none",
                color: sel ? CTA_TEXT : V.muted,
                background: sel ? SNAKE_ACCENT : "transparent",
                transition: "background .15s,color .15s",
              }}
            >
              {LEVEL_LABEL[lv]}
            </button>
          );
        })}
      </div>

      {/* ── Board: relative wrapper (r14 + inset shadow) over an inline <svg> ─ */}
      <div
        data-testid="snake-board-wrap"
        style={{
          position: "relative",
          width: W,
          height: Hh,
          borderRadius: 14,
          background: V.boardBg,
          boxShadow:
            "inset 0 0 0 1px var(--samagra-line), inset 0 2px 26px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <svg
          width={W}
          height={Hh}
          viewBox={`0 0 ${W} ${Hh}`}
          role="img"
          aria-label="Snake board"
          style={{ display: "block" }}
        >
          {/* grid lines (proto: i from 1..cols-1 / 1..rows-1). */}
          {vLines.map((i) => (
            <line
              key={`v${i}`}
              className="snake-grid"
              x1={i * CELL}
              y1={0}
              x2={i * CELL}
              y2={Hh}
              stroke={V.grid}
              strokeWidth={1}
            />
          ))}
          {hLines.map((i) => (
            <line
              key={`h${i}`}
              className="snake-grid"
              x1={0}
              y1={i * CELL}
              x2={W}
              y2={i * CELL}
              stroke={V.grid}
              strokeWidth={1}
            />
          ))}

          {/* food — filled disc (cell*0.32) + halo ring (cell*0.5). */}
          <circle
            className="snake-food"
            cx={fx}
            cy={fy}
            r={CELL * 0.32}
            fill={V.food}
          />
          <circle
            className="snake-food-halo"
            cx={fx}
            cy={fy}
            r={CELL * 0.5}
            fill="none"
            stroke={V.foodHalo}
            strokeWidth={1.5}
          />

          {/* snake — rounded rects (rx5); head solid accent, body accent-fade. */}
          {game.body.map((b, i) => (
            <rect
              key={`s${b[0]},${b[1]},${i}`}
              className={`snake-seg${i === 0 ? " is-head" : ""}`}
              x={b[0] * CELL + 1.5}
              y={b[1] * CELL + 1.5}
              width={CELL - 3}
              height={CELL - 3}
              rx={5}
              fill={segFill(i)}
            />
          ))}
        </svg>

        {/* ── Overlay: blurred scrim + title + subtitle + accent CTA ──────── */}
        {overlayShown && (
          <div
            className="snake-overlay"
            data-testid="snake-overlay"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 13,
              background: "rgba(5,8,14,0.58)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em" }}>
              {overlayTitle}
            </div>
            <div style={{ fontSize: 13, opacity: 0.82, marginTop: -4, textAlign: "center" }}>
              {overlaySub}
            </div>
            <button
              type="button"
              onClick={start}
              style={{
                padding: "11px 30px",
                borderRadius: 999,
                background: SNAKE_ACCENT,
                color: CTA_TEXT,
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
                border: "none",
              }}
            >
              {overlayCta}
            </button>
          </div>
        )}
      </div>

      {/* ── Controls: D-pad + Pause/New game ─────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 16 }}>
        <div
          role="group"
          aria-label="D-pad"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,50px)",
            gridTemplateRows: "repeat(2,46px)",
            gap: 6,
            gridTemplateAreas: '". up ." "lf dn rt"',
          }}
        >
          {(
            [
              ["Up", [0, -1], "up", "↑"],
              ["Left", [-1, 0], "lf", "←"],
              ["Down", [0, 1], "dn", "↓"],
              ["Right", [1, 0], "rt", "→"],
            ] as const
          ).map(([name, [dx, dy], area, glyph]) => (
            <button
              key={area}
              type="button"
              aria-label={name}
              onClick={() => turn([dx, dy])}
              style={{
                gridArea: area,
                width: 50,
                height: 46,
                borderRadius: 12,
                background: V.subBg,
                color: V.text,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: 19,
                userSelect: "none",
                border: `1px solid ${V.line}`,
              }}
            >
              {glyph}
            </button>
          ))}
        </div>

        <div
          data-testid="snake-side-controls"
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          {game.status === "running" ? (
            <button
              type="button"
              onClick={pause}
              style={{
                padding: "11px 20px",
                borderRadius: 11,
                background: AMBER_15,
                color: AMBER,
                fontWeight: 700,
                fontSize: 13.5,
                cursor: "pointer",
                textAlign: "center",
                border: "none",
              }}
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              style={{
                padding: "11px 20px",
                borderRadius: 11,
                background: ACCENT_16,
                color: SNAKE_ACCENT,
                fontWeight: 700,
                fontSize: 13.5,
                cursor: "pointer",
                textAlign: "center",
                border: "none",
              }}
            >
              {sideLabel}
            </button>
          )}
          <button
            type="button"
            onClick={newGame}
            style={{
              padding: "11px 20px",
              borderRadius: 11,
              background: V.subBg,
              color: V.muted,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: "pointer",
              textAlign: "center",
              border: "none",
            }}
          >
            New game
          </button>
        </div>
      </div>

      <div data-speed={game.speed} data-base={LEVELS[level].base} hidden />
    </div>
  );
}
