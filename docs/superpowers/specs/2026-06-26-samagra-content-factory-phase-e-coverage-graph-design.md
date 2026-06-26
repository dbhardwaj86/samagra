# SAMAGRA Content Factory — Phase E: Coverage Graph & Concept Atlas (design)

> **Status:** ratified design (2026-06-26). Extends the umbrella content-factory spec
> `2026-06-23-samagra-content-factory-design.md` §3.5 + Plan A–G row E. Follows Phase D
> (complete: D1 StyleSeed moat · D2 Samadhan LLM lane · D3 learning loop).
>
> **One-line:** make *"what to build next"* **computable** — a rebuildable, read-only
> coverage graph (concept × content-type) that surfaces ranked, demand-weighted gap-cell
> seed proposals behind the never-automated publish gate, visualised as a Concept Atlas in
> SAMAGRA OS.

---

## 1. Context & goal

Phase E is the **STEERING layer** of the content factory (STEERING / ENGINE / MOAT / SEAM /
DOWNSTREAM). The dispatch ENGINE (Phase 1/C) fans a seed to N lanes; the StyleSeed MOAT
(Phase D) conditions the LLM lanes. Phase E sits *above* both and answers a question the
factory cannot currently answer: **of all the physics concepts students are tested on, which
ones are under-served by which content types — and in what priority order should we fill the
holes?**

The spec (§3.5, line 110) scopes E as: *"A rebuildable `concept_graph.db` (sibling to
`catalog.db`, never a governance reset). Nodes = concepts (anchored on QX's `question_concept`
as the canonical spine; textbook slugs + NCERT as curated alias edges …) + artifacts by uid.
Edges built cheap-first: Tier-1 FTS5 (structural) → Tier-2 QX BGE (semantic) → Tier-3 graphify.
The coverage matrix (concept × content-type) emits ranked, pointer-pre-loaded gap-cell seeds =
the factory's computable demand queue. The human approves every proposed seed."* Plan A–G row E
(line 119) bounds the slice: **"Coverage graph (Tier-1) + Concept Atlas (read-only) + gap-cell
seed proposals."** Tier-2 (BGE semantic) and Tier-3 (graphify) edges are **explicitly Phase F**.

This realises the parked **"offline demand compass — steer generation by what the QX
paper-builder under-draws"** (§1, line 23).

## 2. Decisions locked (brainstorming forks, 2026-06-26)

| Fork | Decision | Rationale |
|---|---|---|
| Slice scope | **Full Tier-1 layer** — graph DB + matrix + ranked gap-seeds + Atlas | ship the complete steering layer; risk concentrated in normalization |
| Concept anchor | **QX's 86 physics concepts** (`chapter_id LIKE 'physics.%'`) | spec-mandated canonical spine; mature, scored over 62k tagged questions |
| Normalization | **Deterministic FTS base + git-committed `concept_aliases.json` merge-overlay** | the merge-overlay format §7 left open; mirrors the StyleSeed committed-overlay precedent; no LLM, no Codex review |
| Coverage rule | **Factory-produced only** — a cell is "covered" only by a captured factory artifact | a clean "what SAMAGRA has actually built" scoreboard; the existing corpus steers *ranking* (deficit), not the covered state |
| Cell states | **3-state: produced / base / gap** | `produced` = covered (factory shipped); `base` = unproduced but source-ready (easy to fill); `gap` = unproduced & net-new (e.g. `samadhan`). Encodes how hard each unbuilt cell is to fill |
| Ranking | **Deficit-weighted** — `demand ÷ (existing-corpus depth + 1)`, pluggable | surfaces high-demand concepts thin in existing material; the existing QX/textbook corpus steers priority even though it never marks a cell covered |
| Atlas surface | **New React app in SAMAGRA OS over a read-only `GET` endpoint** | a bounded operator-console view (DEC-1-compliant); the demand engine "made visible" |
| QX access | **Read `builder.sqlite` read-only** (config `QX_BUILDER_DB`, already present) | qsearch HTTP exposes no concept facets; keeps QX untouched, works offline |
| Gap emission | **Read-only Atlas; owner acts via existing `samagra factory plan … --lane …` CLI** | the entire Phase-E web surface stays read-only — cleanest firewall story, no new write endpoint |

## 3. Architecture

```
  READ-ONLY SOURCES (the firewall holds)            DERIVED (rebuildable)        SURFACES (read-only)
  ────────────────────────────────────────          ─────────────────────        ───────────────────
  QX builder.sqlite ──┐  concept taxonomy + size
   (read-only file)   │  + question_concept edges
  59 chapters json ───┤  content.json corpus            ┌──────────────────┐     GET /api/coverage ──┐
   (TEXTBOOK_CHAPTERS)├─▶  coverage builder  ──────────▶│ concept_graph.db │────▶ GET /api/coverage/  │
  samagra.db catalog ─┤  artifacts by uid               │  (gitignored,    │      concept/<id>       │
   (DATA_DB)          │                                  │   rebuildable)   │                         ▼
  governance.db ──────┘  captured factory assignments    └──────────────────┘                React Atlas app
   (read via store)                                              ▲                        (heatmap + dossiers
  concept_aliases.json ──── git-committed overlay ──────────────┘                         + ranked gap queue)
   (the ONLY durable human input)                                                                  │
                                                                                                   ▼
                                                              owner copies the gap's pre-loaded CLI:
                                                              `samagra factory plan textbook:<slug> --lane <lane>`
                                                              → existing approve_seed → build → publish gate
```

**Firewall posture.** `concept_graph.db` is a **rebuildable, gitignored** sibling to `samagra.db`
(the catalog precedent — `config.DATA_DB`). It carries **no durable authority**; `governance.db`
remains the only ledger. The **only git-committed** human artifact is `coverage/concept_aliases.json`.
**No governance migration. No new prod write path** (the web surface is read-only GET; the one write
— turning a gap into a seed — reuses the existing `factory plan` CLI). **No Codex pre-merge review**
(read-only derived DB; spec gate = TDD green). The QX read is a read-only open of `builder.sqlite`,
within the read-only firewall over the 7 source subsystems.

## 4. Data substrate (real inputs, verified)

| Input | Path (config const) | Schema (real) | Example |
|---|---|---|---|
| QX concept spine | `QX_BUILDER_DB` = `…/gpt-extract-ques/qx/builder.sqlite`, table `concept` | `(id, subject, chapter_id, label, size, built_at)` — **86 physics rows** (`chapter_id LIKE 'physics.%'`) | `label='gauss\'s law', size=746, chapter_id='physics.electrostatics'` |
| Question→concept edges | same DB, table `question_concept` | `(q_uid, concept_id, score)` — **129,285 edges** over 62,268 tagged questions | `q_uid='…-q31', concept_id=259, score=0.89` |
| Corpus (59 chapters) | `TEXTBOOK_CHAPTERS` = `…/physics-textbook/textbook/chapters/<slug>/content.json` | `{slug, title, sections:[{id, title, blocks:[{type:prose|equation|figure|callout|…}], flags:[{kind, note}]}]}` — **no concept tags** | `slug='gauss-law'`, 12 sections |
| Catalog (7,044 artifacts) | `DATA_DB` = `samagra.db`, table `catalog` | `(uid, source, kind, title, subject, unit, chapter, status, path, url, updated_at, meta_json)` + `catalog_fts` | `uid='qx:doc:…', source='qx', kind='paper'`; `uid='textbook:chapter:gauss-law'` |
| Captured factory output | `GOVERNANCE_DB`, via `store.list_assignments` | `(pipeline, seed_ref, artifact_ref, status, …)` | `pipeline='deck', seed_ref='textbook:circular-motion', status='captured'` |

**Key gap (the work):** no existing chapter↔concept mapping anywhere. QX papers already carry
concept edges (via their questions); the **only normalization task** is the tractable **59-chapter →
QX-concept map** — every factory artifact inherits its parent chapter's concepts via `seed_ref`.

## 5. `concept_graph.db` schema (rebuildable)

```sql
-- Provenance / rebuild stamp (idempotency: same sources → same graph)
CREATE TABLE graph_meta (
  key TEXT PRIMARY KEY, value TEXT          -- built_at, builder_version,
);                                          -- qx_builder_sha, catalog_sha, aliases_sha, concept_count

-- Concept nodes (the QX physics spine)
CREATE TABLE concept (
  concept_id   INTEGER PRIMARY KEY,         -- QX concept.id (canonical)
  label        TEXT NOT NULL,
  chapter_id   TEXT,                        -- QX 'physics.<unit>' → the Tier-1 "community"
  demand_size  INTEGER NOT NULL             -- QX concept.size (question count) = demand signal
);

-- Artifact nodes (existing corpus + factory output), by uid
CREATE TABLE artifact (
  uid           TEXT PRIMARY KEY,           -- catalog uid / 'textbook:chapter:<slug>' / factory artifact_ref
  source        TEXT,                       -- qx | textbook | sims | factory | …
  kind          TEXT,                       -- catalog kind (paper, chapter, …)
  content_type  TEXT,                       -- the lane/column this artifact satisfies (paper, lecture, …) or NULL
  seed_ref      TEXT,                        -- for factory artifacts: the parent seed (textbook:<slug>)
  chapter_slug  TEXT                        -- resolved chapter slug, when applicable
);

-- Concept ↔ artifact edges (Tier-1 only)
CREATE TABLE concept_artifact (
  concept_id   INTEGER NOT NULL,
  artifact_uid TEXT NOT NULL,
  relation     TEXT NOT NULL,              -- 'question' (qx) | 'chapter' (fts/overlay) | 'seed' (factory inherit)
  source       TEXT NOT NULL,              -- 'qx' | 'fts' | 'overlay-add'
  score        REAL,                        -- fts score / aggregated question score; NULL for structural
  PRIMARY KEY (concept_id, artifact_uid, relation)
);

-- Concept ↔ chapter normalization edges (the auditable normalization layer)
CREATE TABLE concept_chapter (
  concept_id   INTEGER NOT NULL,
  chapter_slug TEXT NOT NULL,
  source       TEXT NOT NULL,              -- 'fts' | 'overlay-add'   (overlay-remove drops the fts row)
  score        REAL,
  PRIMARY KEY (concept_id, chapter_slug)
);

-- The coverage matrix, materialised: one row per (concept, lane)
CREATE TABLE coverage_cell (
  concept_id  INTEGER NOT NULL,
  lane        TEXT NOT NULL,               -- revision | lecture | deck | paper | drill | samadhan
  state       TEXT NOT NULL,               -- 'produced' | 'base' | 'gap'
  produced_n  INTEGER NOT NULL DEFAULT 0,  -- # captured factory artifacts
  base_n      INTEGER NOT NULL DEFAULT 0,  -- # source artifacts providing the base
  PRIMARY KEY (concept_id, lane)
);

-- Ranked production demand queue (every UNPRODUCED cell: state in base|gap)
CREATE TABLE gap_seed (
  rank          INTEGER PRIMARY KEY,       -- 1 = highest priority
  concept_id    INTEGER NOT NULL,
  lane          TEXT NOT NULL,
  cell_state    TEXT NOT NULL,             -- 'base' (source-ready) | 'gap' (net-new)
  demand_size   INTEGER NOT NULL,          -- QX concept demand (numerator)
  existing_corpus_n INTEGER NOT NULL,      -- existing non-factory corpus depth (denominator input)
  deficit_score REAL NOT NULL,             -- demand_size / (existing_corpus_n + 1) → the ranking signal
  suggested_seed_ref TEXT NOT NULL,        -- 'textbook:<slug>' (pointer-pre-loaded)
  plan_command  TEXT NOT NULL              -- ready-to-run: samagra factory plan <seed_ref> --lane <lane>
);
```

## 6. Build pipeline (deterministic, idempotent)

`coverage/build.py :: build_concept_graph()` runs end-to-end and is fully rebuildable
(`samagra factory coverage-build` may delete + recreate `concept_graph.db` at will):

1. **concepts** (`concepts.py`) — open `QX_BUILDER_DB` read-only → load the 86 physics
   `concept` rows (+ `demand_size`) and the `question_concept` edges.
2. **chapter edges, FTS base** (`edges.py`) — for each concept `label`, FTS5/lexical-match
   against each chapter's title + section titles + prose (loaded via the existing
   `lectures.render.load_chapter` / catalog FTS). Emit `concept_chapter(source='fts')` rows
   with a score.
3. **overlay merge** (`aliases.py`) — apply `concept_aliases.json`: `add` forces an
   edge (`source='overlay-add'`), `remove` drops the matching FTS row. Validate every label
   resolves to a known physics concept (fail loud on a typo).
4. **artifact edges** — concept↔QX-paper from `question_concept` (aggregate question→doc);
   concept↔chapter→factory-artifact via `seed_ref` (read `store.list_assignments`).
5. **matrix** (`matrix.py`) — compute `coverage_cell.state` per the §7 lane rules.
6. **demand queue** (`gaps.py`) — rank the **unproduced** cells (`state ∈ {base, gap}`) by the
   deficit-weighted ranker (§8) → `gap_seed`.
7. **stamp** `graph_meta` with source hashes for idempotency / staleness detection.

## 7. Coverage semantics (the 3-state rule)

Columns = the 6 producible lanes. Per `(concept C, lane L)`:

| Lane | `base` (source exists, nothing produced) | `produced` |
|---|---|---|
| `paper` | ≥1 QX paper has a question tagged C (`question_concept`) | a captured factory `paper` artifact whose `seed_ref` chapter maps to C |
| `drill` | same source as `paper` (drill = sub-sample of a paper) | captured factory `drill` for C |
| `lecture` | ≥1 chapter edges to C (the chapter is the lane's source) | captured factory `lecture` for C |
| `revision` | ≥1 chapter edges to C | captured factory `revision` for C |
| `deck` | ≥1 chapter edges to C | captured factory `deck` for C |
| `samadhan` | **never** (no source equivalent — misconception cards are net-new) | captured factory `samadhan` for C |

`state = produced` if a captured factory artifact of that lane edges to C; else `base` if a
*source* artifact provides the base (per the table); else `gap` (net-new — e.g. `samadhan` for
nearly every concept). **Under the factory-produced-only rule only `produced` counts as
covered** — both `base` and `gap` cells are *unproduced* and together form the production
demand queue (§8), ranked by deficit. The heatmap's `base`-vs-`gap` colour tells you how hard
each unproduced cell is to fill (source-ready vs net-new); `produced` cells are out of the queue.

**Concept communities (Tier-1).** Grouping = QX `concept.chapter_id` (e.g. `physics.electrostatics`)
— a deterministic clustering available now. Semantic community detection (Tier-2/3) is Phase F.

## 8. Demand ranking (deficit-weighted, pluggable)

`gaps.py :: rank_gaps(cells) -> list[GapSeed]` is a single pure function over the **unproduced**
cells (`state ∈ {base, gap}`). Default = **deficit-weighted**:

```
deficit_score(C, L) = demand_size(C) / (existing_corpus_n(C, L) + 1)
```

where `existing_corpus_n` is the existing **non-factory** corpus depth for that cell — **# QX
papers** tagged C for `paper`/`drill`; **# chapters** edging C for `lecture`/`revision`/`deck`;
**0** for `samadhan` (no source equivalent). Sort by `deficit_score` **descending**, tiebreak by
a fixed lane priority (`samadhan, revision, deck, drill, paper, lecture`) then `concept_id`. This
surfaces **high-demand concepts thin in existing material** — a heavily-tested concept with no
misconception card (`samadhan`, denominator 0) or thin derivative coverage outranks a `paper`
cell for a concept QX already saturates (large denominator). Each `GapSeed` is
**pointer-pre-loaded**: `suggested_seed_ref = textbook:<slug>` (the strongest-edge chapter for C)
and a ready `plan_command`. The ranker is the one seam Phase F enriches (post-use flags, semantic
deficit) without reshaping the schema.

## 9. Normalization overlay format (`concept_aliases.json` at repo root, git-committed)

```jsonc
{
  "version": 1,
  "note": "Curated chapter<->concept normalization. Deltas applied ON TOP of the deterministic FTS base.",
  "by_chapter": {
    "lom-and-pseudo-force": { "add": ["newton's laws", "friction"], "remove": [] },
    "circular-motion":      { "add": ["circular motion"],            "remove": [] }
  }
}
```

- Keyed on **textbook chapter slug**. `add` = concept labels to **force** an edge; `remove` =
  labels to **drop** from the FTS base (false positives). Unlisted chapters use the pure FTS base.
- Labels resolve to QX concept ids at build time; an unresolvable label is a **hard build error**.
- This file is the auditable review surface (git diff = the normalization decision log), exactly
  like `styleseed/styleseed-v<N>.json`.

## 10. Surfaces

**Read endpoints** (read-only GET, served behind the existing Cloudflare Access deployment gate
like `/api/overview`; no mutation, no admin key), registered in `samagra/api/app.py`:
- `GET /api/coverage` → `{ concepts:[…], lanes:[…], cells:[{concept_id,lane,state,…}], gaps:[{rank,concept_id,lane,demand_size,plan_command}], meta:{built_at,…} }`
- `GET /api/coverage/concept/<id>` → a per-concept **dossier**: demand, per-lane state, linked artifacts (papers/chapter/factory), the chapter alias edges, and the ranked gaps for that concept.

**React Atlas app** (`frontend/src/apps/Atlas/index.tsx` + `index.test.tsx`, registered in
`frontend/src/registry.ts` like `Pipelines`/`Org`; pure logic in `frontend/src/lib/coverage/`
with unit tests; data via the `useApi` hook; types in `frontend/src/types/contracts.ts`):
- an **SVG coverage heatmap** — rows = concepts (grouped by community), columns = lanes,
  3-state colour (produced / base / gap);
- **per-concept dossiers** (click a row);
- the **ranked gap queue** — each row shows the pointer-pre-loaded, copy-ready
  `samagra factory plan textbook:<slug> --lane <lane>` command.

**CLI** (in `samagra/__main__.py cmd_factory`, beside `plan`/`approve`/`scan`/`style-*`):
- `samagra factory coverage-build` — (re)build `concept_graph.db`;
- `samagra factory coverage` — print the matrix as a terminal table;
- `samagra factory gaps [--top N] [--lane L]` — print the ranked gap queue (the copy-ready commands).

## 11. Module layout — `samagra/factory/coverage/` (sibling to `style/`)

| File | Responsibility |
|---|---|
| `concepts.py` | read `QX_BUILDER_DB` read-only → physics concepts (+ `demand_size`) + `question_concept` |
| `aliases.py` | load + merge `concept_aliases.json` (`add`/`remove` deltas over the FTS base; label→id validation) |
| `edges.py` | Tier-1 FTS concept↔chapter; concept↔QX-paper aggregation; factory artifact inheritance via `seed_ref` |
| `matrix.py` | the concept × lane coverage matrix + 3-state computation (§7) |
| `gaps.py` | pluggable deficit-weighted ranker over unproduced cells → ranked `GapSeed` queue (§8) |
| `store.py` | `concept_graph.db` schema (§5) + read/write helpers |
| `build.py` | orchestrate a full idempotent rebuild (§6) |

Config additions (`config.py`): `CONCEPT_GRAPH_DB = REPO_ROOT / "concept_graph.db"` (gitignored,
add to `.gitignore`); `CONCEPT_ALIASES = REPO_ROOT / "concept_aliases.json"`
(git-committed). `QX_BUILDER_DB` / `TEXTBOOK_CHAPTERS` / `DATA_DB` already exist.

## 12. Invariants & acceptance (gate = TDD green)

- **No new prod write path.** The web surface is read-only GET; `concept_graph.db` is derived
  and rebuildable; the only write that acts on a gap reuses the existing `factory plan` CLI →
  `approve_seed` → `build`. The 7 source subsystems stay read-only (QX read via read-only
  `builder.sqlite` open).
- **The publish gate is untouched.** Phase E *proposes* a ranked queue; **the human approves
  every proposed seed**; nothing auto-plans, auto-approves, or auto-builds.
- **No governance migration / no governance reset.** `governance.db` is read, never altered;
  `concept_graph.db` is a separate file.
- **DEC-1 bounded console.** The Atlas is a read-only operator-console view, not an audience surface.
- **Acceptance (golden thread):** a full `coverage-build` over the real 86 concepts + 59 chapters
  produces `concept_graph.db`; the matrix shows ≥1 real `produced` cell (e.g. `circular-motion`
  has a captured `deck` from C1 / `paper`+`drill` from C2), real `base` cells (source-ready but
  unproduced), and real `gap` cells (e.g. `samadhan` for a high-demand concept); the queue is
  ordered by `deficit_score`, so a high-demand concept thin in existing material (e.g. a
  `samadhan` cell, denominator 0) outranks a `paper` cell for a QX-saturated concept;
  `GET /api/coverage` returns it; the Atlas renders the heatmap; the durable `governance.db` is
  byte-unchanged.

## 13. Testing strategy (TDD throughout)

- **pytest:** the FTS matcher (real chapter text → expected concept edges); overlay merge
  (add/remove deltas, label-validation hard error); the 3-state coverage rule per lane;
  the demand ranker (ordering + tiebreak + pointer pre-load); builder idempotency &
  rebuildability (same sources → identical graph; delete + rebuild); the read-only endpoints
  (shape + read-only); a `governance.db`-untouched assertion.
- **vitest:** the Atlas pure logic in `lib/coverage/` (heatmap cell→colour mapping, gap-row
  formatting, dossier assembly) + the `Atlas/index.test.tsx` render/interaction.
- Gate: **pytest green** (≈+30 over the current 448) and **vitest green** (the existing OS track),
  no regressions; the lone pre-existing `test_gdocs` env red is unrelated.

## 14. Non-goals (Phase E, YAGNI)

- **No Tier-2 (QX BGE semantic) or Tier-3 (graphify inferred) edges** — Phase F.
- **No LLM** anywhere in the coverage layer (the overlay is hand-curated; no API key).
- **No write endpoint** for gap emission — the CLI is the write path (the owner's deliberate act).
- **No auto-emit / batch-propose** — no command pre-creates in-review assignments from gaps.
- **No semantic concept clustering** — communities = QX `chapter_id` grouping (Tier-1).
- **No new concept taxonomy** — anchor strictly on QX's 86 physics concepts.
- **No governance schema change.**

## 15. Open questions deferred (to the plan or Phase F)

- FTS scoring threshold for a chapter↔concept edge (tune against the real corpus in the plan;
  the overlay backstops misses either way).
- Tier-2 BGE semantic edges + Tier-3 graphify + semantic community detection — Phase F.
- Post-use demand signals ("too hard" / "students missed this" flags) feeding the ranker — Phase F.
- A GUI "queue seed" write action (the option-B fast-follow) — out of scope here by decision.
