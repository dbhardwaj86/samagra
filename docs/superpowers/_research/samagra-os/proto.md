# SAMAGRA OS — Prototype Extraction (exact, testable values)

Source of truth: `C:\Users\abc\AppData\Local\Temp\webos_design\design_handoff_samagra_os\SAMAGRA OS.dc.html`
(`<script data-dc-script>` block) + `README.md`. `support.js` is the runtime — NOT ported.

All numbers below are **verbatim from the prototype source** (line refs are into the `.dc.html`).
Treat each as a test assertion target for the headless TypeScript modules in E1.

---

## 0. App registry — `APPS` map (id → name, accent, default w, h)

Exact (lines 115–133). 17 apps. Defaults are in CSS px.

| id | name | accent | w | h |
|---|---|---|---|---|
| `dashboard` | Dashboard | `#4f46e5` | 940 | 610 |
| `pipelines` | Pipelines | `#db2777` | 960 | 600 |
| `assignments` | Assignments | `#0891b2` | 1000 | 630 |
| `org` | Org Chart | `#4338ca` | 920 | 640 |
| `questions` | Questions | `#2563eb` | 900 | 610 |
| `lectures` | Lectures | `#0d9488` | 840 | 600 |
| `booklets` | Booklets | `#b45309` | 780 | 560 |
| `insp` | INSP / Olympiad | `#ca8a04` | 800 | 580 |
| `sims` | Simulations | `#7c3aed` | 880 | 600 |
| `mycontentdev` | mycontentdev | `#c026d3` | 840 | 610 |
| `munshi` | Munshi | `#059669` | 430 | 720 |
| `activity` | Activity | `#ea580c` | 480 | 600 |
| `settings` | Settings | `#475569` | 760 | 580 |
| `terminal` | Terminal | `#10b981` | 740 | 480 |
| `clock` | Clock | `#0ea5e9` | 560 | 640 |
| `notes` | Notes | `#f59e0b` | 840 | 600 |
| `snake` | Snake | `#22c55e` | 480 | 680 |

**`ORDER`** (dock / Start / mobile-grid order, line 134) — note this is NOT alpha, NOT the APPS-key order:
```
['dashboard','pipelines','assignments','org','questions','lectures','booklets','insp',
 'sims','mycontentdev','munshi','notes','clock','terminal','snake','activity','settings']
```
Mobile favorites dock (line 1086 / 1104): `['dashboard','notes','clock','munshi']` (icons 50×50).

---

## 1. WINDOW MANAGER

### 1.1 Theme chrome constants (drive work-area & clamps)
| theme | `kind` | `dockPos` | `controlSide` | `barH` | `rail` | `winRadius` |
|---|---|---|---|---|---|---|
| aqua | `mac` | bottom | left | 30 | — | 13 |
| console | `console` | taskbar | right | 0 | — | 10 |
| samagra | `samagra` | left | right | 32 | 66 | 15 |

Taskbar height (console) = **50px**. Dock (aqua) floats bottom-center, radius 20.

### 1.2 Work area formula — `workArea()` (lines 179–184)
`vw = window.innerWidth||1440`, `vh = window.innerHeight||900`.
- **aqua** (`kind==='mac'`): `{ x:8, y: barH+6, w: vw-16, h: vh-barH-92 }`  → with barH=30: `{8, 36, vw-16, vh-122}`
- **console** (`kind==='console'`): `{ x:8, y:8, w: vw-16, h: vh-66 }`
- **samagra**: `{ x: rail+8, y: barH+6, w: vw-rail-16, h: vh-barH-12 }` → rail=66,barH=32: `{74, 38, vw-82, vh-44}`

### 1.3 Min window size
**360 × 280** (enforced in resize, line 224: `Math.max(360,…)`, `Math.max(280,…)`). README line 53 confirms.

### 1.4 openApp — sizing, cascade, focus (lines 186–197)
1. **mobile**: `setState({mobileApp:id, startOpen:false})` and return (no window).
2. **already-open** (`windows.find(w.app===id)`): un-minimize it and bump z: `{...w, min:false, z:z+1}`, `z+=1`, `startOpen:false`. (Focus-or-open; does NOT spawn a duplicate.)
3. **new window**, with `n = windows.length` (count BEFORE insert), `wa = workArea()`:
   - `w  = Math.min(app.w, wa.w - 24)`
   - `h  = Math.min(app.h, wa.h - 20)`
   - `x  = Math.max(wa.x, Math.min(wa.x + 24 + (n%6)*34, wa.x + wa.w - w - 12))`
   - `y  = Math.max(wa.y, Math.min(wa.y + 12 + (n%6)*30, wa.y + wa.h - h - 12))`
   - **Cascade offset rule**: each new window steps `+34px x`, `+30px y`, wrapping every 6 (`n % 6`). Base inset 24x / 12y from work-area origin. Clamped so the window stays fully inside the work area (right/bottom margin 12px).
   - New window object: `{ id:'w'+Date.now()+n, app:id, x, y, w, h:hh, z:z+1, min:false, max:false, prev:null }`; `z+=1`.

### 1.5 Z-order / focus / "active" rule
- `z` is a monotonically increasing counter, initial **20** (line 38).
- `focusWin(id)`: sets that window `z = z+1`, then `z+=1` (lines 198).
- **Active (top) window** = highest `z` among non-minimized: `windows.filter(!min).sort((a,b)=>b.z-a.z)[0]` (used in renderTopBar line 976, isSnakeActive line 168, renderPC topId line 1122–1123 sorts ascending and takes last).
- Clicking a window (`onPointerDown` on the window root, line 959) calls `focusWin`. Title-bar `startDrag` also calls `focusWin` first.

### 1.6 Drag — startDrag / onPointerMove (lines 209–222)
- `startDrag(e,id)`: `focusWin(id)`; if window is maximized (`w.max`) → no drag. Store `_drag={id, dx:clientX-w.x, dy:clientY-w.y}`.
- move: `nx = Math.max(0, clientX-dx)`, `ny = Math.max(barH, clientY-dy)`.
  **Clamp on drag**: x floored at 0; y floored at the theme `barH` (window can't go above the top bar). No right/bottom clamp during drag.

### 1.7 Resize — startResize / onPointerMove (lines 214–225)
- store `_resize={id, sx,sy, w0:w.w, h0:w.h}`.
- move: `nw = Math.max(360, w0 + (clientX-sx))`, `nh = Math.max(280, h0 + (clientY-sy))`. Bottom-right grip, 18×18.

### 1.8 Maximize / restore — toggleMax (lines 201–208)
- If currently maximized: restore via spread of `w.prev`, set `max:false, prev:null`, bump z.
- Else: **store prev rect** `prev={x,y,w,h}` then set rect to full `workArea()`, `max:true`, bump z.
- Double-click title bar toggles maximize (line 945). Zoom traffic-light / right-side maximize button also call `toggleMax`.

### 1.9 Theme switch re-clamp — setTheme (lines 228–238)
After theme changes, recompute `wa=workArea()` then map every window:
- maximized: refit to `{x:wa.x, y:wa.y, w:wa.w, h:wa.h}`.
- normal: `nx = Math.max(wa.x, Math.min(w.x, wa.x+wa.w - Math.min(w.w,wa.w) - 8))`;
  `ny = Math.max(wa.y, Math.min(w.y, wa.y+wa.h - Math.min(w.h,wa.h) - 8))`. (8px right/bottom inset; keeps window on-screen, does not resize normal windows.)

### 1.10 Tile windows — tileWindows (lines 859–865)
- `ws = windows.filter(!min)`, `n = ws.length`; if 0 → no-op.
- `cols = ceil(sqrt(n))`, `rows = ceil(n/cols)`, `gap = 12`.
- `cw = (wa.w - gap*(cols-1)) / cols`, `ch = (wa.h - gap*(rows-1)) / rows`.
- For window i: `r=floor(i/cols)`, `c=i%cols`; rect (all rounded) `x=round(wa.x + c*(cw+gap))`, `y=round(wa.y + r*(ch+gap))`, `w=round(cw)`, `h=round(ch)`; also set `max:false, min:false`.

### 1.11 Other window ops
- `closeWin(id)`: if app==='snake' → `snakeStop()`; remove from windows (lines 199).
- `minWin(id)`: if snake running → `snakePause()`; set `min:true` (line 200).
- `setDevice(dev)`: `{device, mobileApp:null, startOpen:false}`; if pc and no windows → `setTimeout(openApp('dashboard'),0)` (line 239).
- On mount, pc + no windows → `openApp('dashboard')` (line 142).

---

## 2. SNAKE ENGINE

### 2.1 Grid & level params
- Grid **19 × 19** (`cols=19, rows=19`, line 613).
- Level table (`snakeLvls()`, line 610): exact —
  - `relaxed: { base:215, floor:135, dec:2 }`  (base tick 215ms, floor 135ms, −2ms/food)
  - `normal:  { base:135, floor:70,  dec:3 }`  (base tick 135ms, floor 70ms, −3ms/food)
- Default level if unset/invalid: **`normal`** (line 611).

### 2.2 Cell-size formula (responsive board) — app_snake (lines 637–639)
- Default (no `win`): `cell = 18`.
- With window rect: `availW = win.w - 40`, `availH = win.h - 38 - 250`;
  `cell = Math.max(11, Math.min(28, Math.floor(Math.min(availW,availH)/cols)))` (cols=19).
- Board px: `W = cols*cell`, `H = rows*cell`. (At cell=18 → 342×342.)

### 2.3 Init — snakeInit(level) (line 613)
- `body = [[9,9],[8,9],[7,9]]` (length 3, head at `[9,9]`, pointing right).
- `dir = [1,0]`, `next = [1,0]`, `food = snakeFood(body,19,19)`, `score=0`, `status='idle'`, `speed = L.base`, `level`.

### 2.4 Food placement — snakeFood (line 614)
Uniform random `[floor(rand*cols), floor(rand*rows)]`, **rejection-resampled** until not on any body cell. (For tests: inject RNG.)

### 2.5 Direction / no-reverse — snakeDir (line 620)
- If no snake yet → `snakeStart()` and return.
- Reverse guard: if `cd[0]===-dx && cd[1]===-dy` (proposed dir is exact opposite of CURRENT `dir`) → ignore. Else set `next=[dx,dy]`.
- If status !== 'running' → `snakeStart()` (a direction press also starts a paused/idle game).
- Note: guard is vs committed `dir`, not `next`, so two fast turns within one tick can't self-reverse.

### 2.6 Step / movement / eat / death — snakeStep (lines 621–633)
Per tick (guard: only runs if `snake.status==='running'`):
- `dir = sn.next`; `head = [body[0][0]+dir[0], body[0][1]+dir[1]]`.
- **Death** if any: `head[0]<0 || head[1]<0 || head[0]>=cols || head[1]>=rows`
  OR self-collision `body.some((b,i)=> i<body.length-1 && b[0]===head[0] && b[1]===head[1])`
  (tail cell — last index — is exempt, so following your own tail is legal).
  On death: clear interval, `best = max(snakeBest, score)`, persist best, set `status:'dead', dir`.
- Else `body = [head, ...body]`.
  - **Eat** (`head===food`): `score += 10`; new food; `speed = Math.max(L.floor, sn.speed - L.dec)`; if speed changed → `snakeRun(speed)` (re-arm interval at new pace). Snake GROWS (body not trimmed).
  - **No eat**: `body = body.slice(0,-1)` (drop tail → constant length).

### 2.7 Scoring / loop control
- **10 points per food** (line 630). No level/length multiplier.
- `snakeRun(speed)` (line 616): clear+`setInterval(snakeStep, speed)`.
- `snakeStart` (617): if no snake or dead → re-init; `status:'running'`; run at `sn.speed`.
- `snakePause` (618): clear interval, `status:'paused'`.
- `snakeStop` (619): clear interval only (no state change) — used on close.
- `setSnakeLevel(level)` (612): `snakeStop()`, persist level, `snake = snakeInit(level)` (resets to idle at new pace). README: "Switching level resets the game to idle."

### 2.8 localStorage keys
- `samagra.snake.best` — integer best score. Read `+localStorage.getItem(...)||0` (line 615); written on death as `max(best,score)`.
- `samagra.snake.level` — `'relaxed'|'normal'`. Loaded with validation; invalid → `normal` (line 611).

### 2.9 Keyboard / activity gating (lines 165–177)
- `isSnakeActive()`: false if `document.activeElement` is INPUT/TEXTAREA; mobile → `mobileApp==='snake'`; pc → top non-min window is snake.
- Key map: Arrows + WASD → `{ArrowUp/w:[0,-1], ArrowDown/s:[0,1], ArrowLeft/a:[-1,0], ArrowRight/d:[1,0]}`; Space/Spacebar → pause if running else start. `preventDefault` on handled keys.

### 2.10 Colors
- Head `#22c55e` (solid accent `A`); body fades `hex(A, 0.8 - min(0.45, i*0.02))` (line 646).
- Food fill `#fbbf24`, or `#d9601a` in samagra theme (line 635); halo = food@0.4 alpha, r = cell*0.5, stroke 1.5; food dot r = cell*0.32.
- Board bg: console `#070b12`, samagra `#efe0c8`, else `#0d1422` (line 642). Radius 14, inset shadow `inset 0 2px 26px rgba(0,0,0,0.45)`. Segment rects rx=5, inset 1.5px, size cell-3.
- D-pad keys 50×46 (README says 50px). Score/Best numerals 25px/800 tabular.

---

## 3. CLOCK (analog / digital / stopwatch / timer / world)

Tabs (line 516): `clock | stopwatch | timer | world`, default `clock`.

### 3.1 Analog face geometry — clockFace (lines 529–545)
- SVG **300×300**, viewBox `0 0 300 300`. `cx=cy=150`, face radius `R=120`.
- Backing circle: `r = R+14 = 134`, fill cardBg, stroke line.
- **Ticks**: 60 ticks, `i=0..59`, angle `(i*6 - 90)°`. `big = i%5===0`.
  - inner radius `r1 = big ? R-14(=106) : R-7(=113)`; outer `r2 = R-2 = 118`.
  - stroke: big → `t.muted`, width 2; small → `t.line`, width 1.
- **Numerals**: only 12/3/6/9. Positions at angle `(deg-90)°` for deg ∈ {0,90,180,270}, radius `R-30 = 90`, `y += 6`. fontSize 17, weight 700.
- **Hand angles** (degrees, 12-o'clock = 0, clockwise):
  - `secA = s*6`
  - `minA = m*6 + s*0.1`
  - `hrA  = (hr%12)*30 + m*0.5`
  - hand endpoint: `rad=(ang-90)π/180`, `x2=cx+len·cos(rad)`, `y2=cy+len·sin(rad)`; tail `x1=cx-tail·cos(rad)` (default tail 16).
  - hour hand: len 62, width 5, color text, tail 16.
  - minute hand: len 92, width 4, color text, tail 16.
  - second hand: len 102, width 2, color **accent**, tail **30** (long tail). `strokeLinecap:'round'`.
  - center pin: `circle r=7 fill accent`, inner `circle r=3 fill winBg`.
- **Second hand steps once per second**: driven by `state.tick` (a `Date`) updated by the 1s `_clock` interval (line 149–152), not rAF.

### 3.2 Digital readout (line 543–545)
- Time string: `pad2(hr%12===0?12:hr%12) + ':' + pad2(m) + ':' + pad2(s) + ' ' + (hr<12?'AM':'PM')` → `HH:MM:SS AM/PM`, 12-hour, zero-padded hour (12 for noon/midnight). 38px/700, `fontVariantNumeric:'tabular-nums'`.
- `pad2(n) = (n<10?'0':'')+n` (line 512).
- Date line: `d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})`, 14px muted.
- Timezone label: `tzName()` = `Intl.DateTimeFormat().resolvedOptions().timeZone` (fallback `'Local'`), with `_`→space (line 528, 545).

### 3.3 Stopwatch — sw* methods + clockStopwatch (lines 547–567)
- State: `sw = {running, elapsed(ms), laps[]}` (initial `{false,0,[]}`, line 47).
- **Tick interval = 33ms** (`swStart`, line 548; README "~30fps"). Uses wall-clock anchor: `start = Date.now() - elapsed`; each tick `elapsed = Date.now() - start` (drift-free).
- `swStop`: clear interval, `running:false` (keeps elapsed). `swReset`: clear, `{running:false,elapsed:0,laps:[]}`. `swLap`: only if running, push current `elapsed` to laps.
- Display (line 554–555): `cs=floor(ms/10)%100`, `sec=floor(ms/1000)%60`, `min=floor(ms/60000)%60`, `hrs=floor(ms/3600000)`. Main `disp = (hrs>0?pad2(hrs)+':':'') + pad2(min)+':'+pad2(sec)` at 62px/300; centiseconds `.+pad2(cs)` in accent, 28px.
- Lap split: `fmtMs(val) = pad2(min)+':'+pad2(sec)+'.'+pad2(cs)` (line 547). Lap row shows split = `laps[idx] - laps[idx-1]` (first lap minus 0), rendered newest-first (line 565).
- Buttons: running → Lap / Stop; stopped → Reset (or disabled-look if elapsed=0) / (Resume if elapsed else Start).

### 3.4 Timer — timer* methods + clockTimer (lines 568–594)
- State: `timer = {running, remaining(ms), total(ms), preset(sec)}`, initial `{false,0,0,300}` (line 48).
- **Presets** (line 581): `[[60,'1 min'],[300,'5 min'],[600,'10 min'],[1500,'25 min']]` → 1 / 5 / 10 / 25 min (values in seconds).
- `timerSet(p)`: clear, `{running:false, remaining:0, total:0, preset:p}`.
- `timerStart` (line 570): `fresh = !(total>0 && remaining>0)`; `remaining = fresh? preset*1000 : remaining`; `total = fresh? preset*1000 : total`; `end = Date.now()+remaining`; **interval 200ms**; each tick `rem = end - Date.now()`; if `rem<=0` → clear, `running:false, remaining:0`, **beep()**; else update remaining.
- `timerPause`: clear, `running:false`. `timerReset`: keep preset, zero remaining/total, not running.
- **Ring geometry** (line 580–586): SVG **264×264**, `r=110`, `cx=cy=132`, `strokeWidth=13`, rotated `-90deg`. `C = 2πR = 2*π*110`. Track stroke `subBg`. Progress `strokeDasharray=C`, `strokeDashoffset = C*(1 - frac)`, `frac = total>0 ? max(0,remaining/total) : 1`. Transition `stroke-dashoffset .9s linear`. Color accent; at done → `#ef4444`.
- Display: `sec = max(0, ceil(remaining/1000))`, `mm=floor(sec/60)`, `ss=sec%60`; `done` (not running, total>0, remaining<=0) shows **"Time!"** 38px/800 red, else `pad2(mm):pad2(ss)` 54px/300.
- **Chime — beep()** (line 568): WebAudio `OscillatorNode`, `type='sine'`, `frequency=880` Hz; gain envelope `0.0001 → 0.18 (ramp +0.02s) → 0.0001 (+0.7s)`; `o.stop(currentTime+0.72)`; context closed +900ms. Wrapped in try/catch (graceful no-op).

### 3.5 World clock — clockWorld (lines 595–607)
- Zones (exact order, line 597): `[['New Delhi','Asia/Kolkata'],['London','Europe/London'],['New York','America/New_York'],['San Francisco','America/Los_Angeles'],['Tokyo','Asia/Tokyo'],['Dubai','Asia/Dubai']]`.
- Per zone via `Intl`: time `toLocaleTimeString('en-US',{timeZone,hour:'numeric',minute:'2-digit'})`; weekday short; hour `hourNum` parsed from `toLocaleString('en-US',{timeZone,hour:'2-digit',hour12:false})` digits.
- **Day/night rule**: `night = hourNum<6 || hourNum>=19` → i.e. **day = 06:00–18:59 local**, else night. Night → ☾ `#818cf8` chip (indigo@0.15 bg); day → ☀ `#f59e0b` (amber@0.18 bg).

### 3.6 Live-clock optimization — isLive() / _clock (lines 149–164)
- 1s interval `_clock`: compute `nn=fmt(d)`; `setState({now,tick})` **only if** `isLive()` OR `nn !== state.now` (i.e. displayed minute changed).
- `isLive()`: true if stopwatch running OR timer running; mobile → `mobileApp==='clock'`; pc → any non-minimized window with `app==='clock'`.
- Net: idle OS re-renders ~once/minute; second-by-second re-render only when something time-live is on screen.

---

## 4. TERMINAL — command parser + dispatch

Prompt: **`devesh@samagra:~$`** (lines 839, 848). Font JetBrains Mono 12.5px. Welcome banner = 3 lines (line 743–749): accent title `SAMAGRA OS · समग्र · v1.0 — agentic content OS`, dim hint, blank.

### 4.1 Parser (runCmd, lines 767–836)
- `clear` is special-cased first → `{term:[], termInput:''}`, returns.
- Split on `/\s+/`; `c0 = parts[0].toLowerCase()`; `args = parts.slice(1)`; `arg = args.join(' ')`.
- Empty input → just echoes the (empty) prompt line, no command run.
- Always appends the input line `{t:line,c:'in'}` then the command output lines; clears input.

### 4.2 Commands (exact behaviors)
| command | behavior |
|---|---|
| `help` | accent "Available commands:" then padded list (width 18): help, status, catalog, agents, pipelines, ls, open <app>, theme <name>, device <pc\|mobile>, neofetch, whoami / date / echo, clear |
| `status` | ok line "SAMAGRA — Phase 0 complete · Phase 1 (adapters) next" + artifacts/tests/repo lines (7,044; 11/11; github.com/dbhardwaj86/samagra) |
| `catalog` | accent header `SOURCE / ARTIFACTS / HEADLINE` + 7 rows (QX, physics-textbook, booklet-proofer, INSP-extract, pratyaksh, mycontentdev, munshi) |
| `agents` / `org` / `board` | BOARD block (Devesh, Claude-Deepak, Claude-Khanak, Codex) + WORKERS block (Gemini+NotebookLM, Grok, Hermes). All three aliases identical |
| `pipelines` / `pipe` | status-flow dim line + 4 ASCII bars (Lectures 74, Questions 91, Print & Proofing 46, Editorial seeds 33); bar `n=round(pct/5)`, `█·` to width 20 |
| `ls` | `this.ORDER.map(id).join('   ')` — space-separated app ids in ORDER |
| `open <app>` | resolves arg against `{id→id, app.name.toLowerCase()→id}`; match → ok "opening <Name> …" + `openApp(id)`; else err "open: unknown app '<x>' (try: ls)" |
| `theme <name>` | if arg ∈ {aqua,console,samagra} → ok "theme → <name>" + `setTheme`; else err "theme: choose aqua \| console \| samagra" |
| `device <pc\|mobile>` | if arg ∈ {pc,mobile} → ok "device → <x>" + `setDevice`; else err "device: choose pc \| mobile" |
| `whoami` | "devesh — Founder & Chairman" |
| `date` | `new Date().toString()` |
| `echo` | prints `arg` (rest of line) |
| `about` | accent title + 2 description lines |
| `sudo` (easter egg) | err "nice try — only the board (Deepak · Khanak · Codex) may approve writes." |
| `neofetch` | 7-line system card (समग्र SAMAGRA OS, OS, Host, Catalog, Agents, Tests, Stack) |
| `clear` | empties terminal buffer (special-cased pre-switch) |
| *unknown* | err "command not found: <c0>   (try 'help')" |

- Line color classes: `in` (prompt+input), `fg`, `dim`, `accent`, `ok`, `err` (palette per theme, `termPalette()` lines 750–755). `pad(s,n)` right-pads to width n.
- Open-name resolution also accepts full display names lowercased (e.g. `open "org chart"` won't split-match; `open org` works; `open insp` works; `open "insp / olympiad"` resolves via name key but spaces break the single-arg `args[0]` — only first token used, so name-with-spaces only matches single-token ids). For tests: dispatch keys on `args[0].toLowerCase()` against `ORDER` ids + single-word names.

---

## 5. NOTES / TODOS

### 5.1 Data models
- Note: `{ id:string, title:string, body:string, ts:number(ms epoch) }`.
- Todo: `{ id:string, text:string, done:boolean }`.
- State extras: `noteSel`, `notesTab('notes'|'todos')`, `todoInput`, `todoFilter('all'|'active'|'done')`.

### 5.2 localStorage keys & persistence
- `samagra.notes` → JSON array of notes (saveNotes, line 690).
- `samagra.todos` → JSON array of todos (saveTodos, line 691).
- Load is defensive: parse, must be `Array.isArray` else fall back to seed (lines 676, 682).
- **Every** mutation (new/upd/del note; add/toggle/del/clearDone todo) writes through to localStorage immediately.

### 5.3 Seed-on-first-run (exact)
Notes seed (line 677–680):
1. `{id:'n1', title:'Capacitor energy explainer', body:'Energy stored  U = ½CV².\n\nLink to the RC charging sim. Use the bell-jar analogy for intuition before the formula.\n\nDraft only — board reviews before publish.', ts: now-3600e3}`
2. `{id:'n2', title:'Rotational motion — Aarav', body:'Needs the thin revision sheet:\n  • moment of inertia table\n  • 5 MCQs on rolling without slipping\n  • 1 numerical: disc vs ring race down an incline', ts: now-7200e3}`

Todos seed (line 683–688):
- `{id:'t1', text:'Frame 5 MCQs on capacitor energy', done:false}`
- `{id:'t2', text:'Fix Optics WB page 14 figure', done:false}`
- `{id:'t3', text:'Approve thin sheet · Kinematics', done:true}`
- `{id:'t4', text:'Call printer re: booklet batch', done:false}`

### 5.4 Note operations (lines 692–700)
- `newNote()`: prepend `{id:'n'+Date.now(), title:'', body:'', ts:now}`; select it.
- `updNote(id,field,val)`: set field + refresh `ts=Date.now()` (so any edit re-stamps "edited").
- `delNote(id)`: filter out; if it was selected, select `notes[0]` (new first) or keep.
- **Title display** = `title.trim() || firstLine(body).trim() || 'Untitled'` (line 710); list preview = body with newlines→spaces, sliced to 42 chars, fallback "No additional text".
- **Word count** = `(String(s).trim().match(/\S+/g)||[]).length` (line 700). Meta line: `N words · edited <Mon D, h:mm AM/PM>` (toLocaleString month:short, day, hour, minute).
- Editor: title input 18px/700; body textarea 14px / line-height 1.65; footer "● Autosaved" (dot=accent2) + Delete (red). Selected list item = accent@0.12 bg + accent@0.25 border. List width 200px.

### 5.5 Todo operations (lines 696–699, 724–739)
- `addTodo()`: trim `todoInput`; empty → no-op; append `{id:'t'+Date.now(), text, done:false}`; clear input. (Add button or Enter key, line 730.)
- `toggleTodo(id)`: flip `done`. `delTodo(id)`: filter out. `clearDone()`: drop all done.
- Filters: `all` → all; `active` → `!done`; `done` → `done` (line 726).
- Footer count: `remaining = todos.filter(!done).length`; text `"N task(s) left"` (singular when 1) + "Clear completed" (line 727, 738).
- Checkbox 20×20 radius 6; done → accent fill + white check (path `M5 12l4 4L19 6`, stroke 3.5). Done row: strikethrough + muted text. `×` delete revealed on row hover (opacity 0→1).
- Empty states: filter `done` → "Nothing completed yet."; else "All clear — nice." (line 737).

---

## 6. THEME TOKENS — `THEMES` map (EXACT, lines 58–95)

### 6.1 aqua (E1)
```
kind:'mac', dockPos:'bottom', controlSide:'left', barH:30, winRadius:13
bg: radial-gradient(1100px 760px at 14% 8%, #c7d2fe, transparent 58%),
    radial-gradient(1000px 720px at 88% 16%, #a5f3fc, transparent 55%),
    radial-gradient(900px 900px at 72% 96%, #fbcfe8, transparent 55%),
    linear-gradient(160deg,#eef2ff,#f6f8fc)
winBg:'rgba(255,255,255,0.78)'   winBlur:'saturate(180%) blur(26px)'
bar:'rgba(255,255,255,0.55)'     barText:'#1d1d1f'   barBlur:'saturate(180%) blur(20px)'
text:'#1d1d1f'   muted:'#6e6e76'   line:'rgba(0,0,0,0.09)'
cardBg:'rgba(255,255,255,0.62)'  subBg:'rgba(15,23,42,0.04)'
accent:'#4f46e5'  accent2:'#0d9488'
shadow:'0 26px 64px rgba(20,20,50,0.30), 0 2px 8px rgba(0,0,0,.10)'
dockBg:'rgba(255,255,255,0.42)'  dockBlur:'saturate(180%) blur(26px)'  dockBorder:'rgba(255,255,255,0.65)'
font:"'Inter',system-ui,sans-serif"   wordmark:"'Inter',sans-serif"
```

### 6.2 console (E3) — full set for forward-compat
```
kind:'console', dockPos:'taskbar', controlSide:'right', barH:0, winRadius:10
bg: radial-gradient(900px 620px at 50% -12%, rgba(56,189,248,0.14), transparent 60%),
    radial-gradient(700px 560px at 92% 110%, rgba(168,85,247,0.12), transparent 60%),
    repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 42px),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 42px),
    #080b12
winBg:'rgba(16,22,34,0.88)'  winBlur:'blur(20px)'
bar:'rgba(9,13,21,0.78)'     barText:'#cdd7e6'  barBlur:'blur(18px)'
text:'#e7eef8'  muted:'#8595ab'  line:'rgba(255,255,255,0.09)'
cardBg:'rgba(255,255,255,0.04)'  subBg:'rgba(255,255,255,0.035)'
accent:'#38bdf8'  accent2:'#34d399'
shadow:'0 28px 80px rgba(0,0,0,0.62)'
dockBg:'rgba(9,13,21,0.84)'  dockBlur:'blur(22px)'  dockBorder:'rgba(255,255,255,0.08)'
font:"'Inter',system-ui,sans-serif"   wordmark:"'JetBrains Mono',monospace"
```
Console taskbar height 50; per-window neon: titleBar borderTop `2px accent`, active ring `0 0 0 1px accent@0.5, 0 0 34px accent@0.13`. README §console.

### 6.3 samagra (E3) — full set
```
kind:'samagra', dockPos:'left', controlSide:'right', barH:32, rail:66, winRadius:15
bg: radial-gradient(1000px 720px at 18% 12%, rgba(221,107,32,0.12), transparent 58%),
    radial-gradient(900px 720px at 88% 90%, rgba(15,118,110,0.10), transparent 60%),
    linear-gradient(165deg,#fbf3e5,#f5ead7)
winBg:'#fffcf6'  winBlur:'none'
bar:'rgba(255,251,243,0.82)'  barText:'#2a2118'  barBlur:'blur(12px)'
text:'#2a2118'  muted:'#937f63'  line:'rgba(42,33,24,0.13)'
cardBg:'#fffaf0'  subBg:'rgba(221,107,32,0.07)'
accent:'#d9601a'  accent2:'#0f766e'
shadow:'0 22px 54px rgba(74,52,24,0.22)'
dockBg:'rgba(255,251,243,0.9)'  dockBlur:'blur(16px)'  dockBorder:'rgba(42,33,24,0.10)'
font:"'Hanken Grotesk',system-ui,sans-serif"   wordmark:"'Tiro Devanagari Hindi',serif"  (wordmark glyph: समग्र)
```

### 6.4 Terminal palette (termPalette, lines 750–755) — per theme, plus shared `err #f87171 / ok #4ade80`
- console: `bg #05080e, fg #a7bdd6, dim #5c6c81, prompt #34d399, accent #38bdf8`
- samagra: `bg #241a11, fg #efe2cf, dim #a8927a, prompt #f0a35e, accent #e8b07a`
- aqua (default): `bg #1b1d24, fg #e5e7eb, dim #9aa0ad, prompt #7dd3fc, accent #a5b4fc`

### 6.5 Semantic / status colors (README §211, used across apps)
success `#16a34a` · running/info `#2563eb` · warning `#d97706` · danger `#ef4444` / `#dc2626` · neutral `#64748b`.
Difficulty: Easy `#16a34a` · Medium `#d97706` · Hard `#dc2626`.

### 6.6 Inactive window shadow
`0 10px 28px rgba(20,20,40,0.20)` (line 958). Inner-highlight `inset 0 1px 0 rgba(255,255,255,.5)` (mac) / `…,.06` (console).

---

## 7. ANIMATIONS / MISC CONSTANTS
- `winIn` .18s ease (windows), `fadeUp` .2s (mobile app), `popIn` .12–.15s (menus/start), dock hover lift `translateY(-7px) scale(1.12)` .12s, timer ring `stroke-dashoffset .9s linear`.
- Context menu: width **216**, radius 12, blur 26px, item hover = accent@0.13. Position clamped 8px from viewport edges; estimated height per item: divider 11, header 24, item 33, base 12 (line 900).
- Mobile frame: 392×812 (max-height 94vh), bezel `#05070b`, screen radius 42, notch 120×26, home-indicator 130×5, status bar 44, app grid 4-col icons 58×58 r16, home dock icons 50×50.
- `hex(c,a)`: parse `#rrggbb` → `rgba(r,g,b,a)` (line 258) — used everywhere for tinting.
- `clamp` note: there is no single `clamp()` helper; clamping is inlined in openApp (insert), onPointerMove (drag y≥barH, x≥0), startResize (≥360×280), setTheme (8px inset), renderMenu (8px viewport).

---

### Interval registry (for cleanup-hygiene tests)
- `_clock` 1000ms (always; gated re-render). `_sw` 33ms (stopwatch). `_tm` 200ms (timer). `_snake` per-level base→floor (relaxed 215→135, normal 135→70).
- All cleared in `componentWillUnmount`; snake also stopped on close, paused on minimize; sw/timer cleared on stop/reset/complete.
