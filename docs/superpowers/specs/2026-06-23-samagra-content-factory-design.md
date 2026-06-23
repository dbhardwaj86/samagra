# SAMAGRA — Content Factory Design Spec

**Date:** 2026-06-23 · **Author:** Claude-Deepak (Opus 4.8), CEO · **Status:** ✅ APPROVED (design) — Chairman ratified the pivot + 4 forks 2026-06-23; ready for `writing-plans`
**Supersedes sequencing in:** the dormant §8 active-loop framing of `specs/2026-06-19-samagra-evolution-design.md` (the bridge is now generalized, not single-output)
**Grounded in:** a 16-agent codebase exploration (11 subsystem maps · 4 reimaginings · adjudication, run `wf_5fb88c46-838`) + direct re-reads of `bridge/`, `governance/store.py`, `lectures/`, `catalog.py`, `clients/`, `api/app.py`. File/line citations are real.
**Companion artifact:** `CONTENT-FACTORY-VISION.html` (the Chairman-facing vision); **Phase-1 plan:** `plans/2026-06-23-samagra-content-factory-phase1-dispatch.md`.

---

## 0. Context — what already exists

SAMAGRA is a local-first Python + FastAPI control plane: read-only adapters normalise ~7,044 artifacts into an FTS5 catalog (`samagra.db`); a durable governance ledger (`governance.db`) tracks board assignments + an immutable events ledger; a proven, Codex-reviewed **bridge** runs ONE automated line (munshi item → classify → propose seed → board-approve → single write to mycontentdev → terminal `captured`); a lecture engine renders 59 chapters of Deepak's handwritten notes (`content.json`) to HTML/DOCX(OMML)/Google Docs; QX serves 67k physics questions with exact + semantic BGE search and an answer-safe paper builder; 482 sims, booklets and INSP papers are catalogued read-only. The never-automated **publish gate** is the single load-bearing invariant.

**This spec extends that spine — it does not rebuild it.**

## 1. The pivot (Chairman, carte blanche, 2026-06-23)

SAMAGRA converts from a **static read-only operator console** into an **active, style-conditioned, multi-output content factory** for JEE/NEET **physics**: one physics seed (a lecture/chapter, a question, a captured idea) fans out to a wide spread of catalogued, indexed, categorized content types, generated in Deepak's style, behind the human publish gate.

**The reframe — activation, not teardown.** The 2026-06-19 evolution spec already designed this machinery and parked it dormant:
- **A6** — "a learner-facing product is a SEPARATE entity that consumes SAMAGRA's published corpus… the published OUTPUT MAY be public-facing via that separate entity." → the student surface is *permitted*, not a violation.
- **The DRAFTER + one adversarial REVIEWER** — style replication + a quality moat (reviewer anchored only to external ground-truth, never trained on approvals; catch-rate→0 = red flag).
- **The offline demand compass** — steer generation by what the QX paper-builder under-draws.

So the pivot **activates** those three and **generalizes the single bridge write into a many-output dispatch**, while the read-only firewall over the seven source subsystems stays exactly as hardened.

## 2. Decisions (ratified 2026-06-23 by Deepak, Founder & Chairman)

| # | Decision | Binding effect |
|---|---|---|
| **DEC-7** | **Bridge → guarded dispatch boundary.** The bridge generalizes from "one mcd write" to "one guarded write-boundary that fans ONE approved seed into N child assignments, each routed by lane to an existing renderer, each board-approved + single-write + terminal." | An **extension** that *strengthens* the firewall (every engine is wrapped by the same guards). It is a wording change to a binding decision (DEC-3) → requires a **Codex pre-merge review** of the new write boundaries, exactly as bridge review 22. |
| **DEC-8** | **StyleSeed as a durable governance artifact.** A versioned, owner-curated style profile (voice · sequencing · analogy · rigor-from-`flags[]` · selection priors) extracted from the 59 chapters; never reset. Style-fit scoring is **advisory**, hard-wired never to auto-advance the gate; the learning loop (mine `review_overlay` edit-diffs → profile-deltas) is **owner-ratified-only**. | The single adversarial reviewer stays anchored only to external ground-truth. |
| **DEC-9** | **PRATHAM = the A6 separate student entity, DEFERRED.** DEC-1's "no audience/no users" clause is scoped to the **console only**; the student-facing surface is a downstream consumer of the published corpus, built only after the inward factory is proven, on an explicit Chairman re-scope. | No outward write path, no multi-tenant identity, until Phase G. |

**Four forks (ratified 2026-06-23):**
1. **Sequencing = dispatch spine first** (throughput-first; StyleSeed layers on after the deterministic lanes prove out).
2. **PRATHAM timing = deferred to Phase G** (inward factory proven first).
3. **Publish-gate granularity = per-seed batch** (approve-all-children-of-a-seed in one human action; mandatory adversarial review on every LLM lane; **never silent auto-approve**).
4. **Scope = teaching leverage** (no GTM; architecture stays **multi-seed-from-day-one** so a product pivot needs no rework).

**Preserved, still binding:** the never-automated publish gate; the read-only firewall over the seven source subsystems (munshi, mcd, QX, textbook, booklets, INSP, sims); the five crash-safety guards; DEC-1 bounded console scope; the no-mining rule except the owner-promoted style loop; the external-ground-truth-anchored adversarial reviewer.

## 3. Architecture — three layers

```
STEERING   coverage graph (rebuildable, read-only): concept × content-type matrix → ranked gap seeds   [Phase E]
ENGINE     dispatch spine: ONE guarded write-boundary, seed → N child artifacts via existing renderers  [Phase 1–C, F]
MOAT       StyleSeed: conditions the LLM lanes; deterministic lanes carry voice for free                [Phase D]
SEAM       the never-automated publish gate, on every lane                                              [always]
DOWNSTREAM PRATHAM student twin (A6), consumes the published corpus                                     [Phase G, deferred]
```

The **seed is the hub node**; `resolve_pointers` is the universal cross-linker; every produced artifact records its source UIDs + `style_seed_version` in `meta` so the corpus is bi-directionally navigable and catalogued/indexed/categorized by construction.

### 3.1 The dispatch spine (the heart)

Generalize `samagra/bridge/` (inward: munshi → 1 mcd seed) into a parallel `samagra/factory/` (outward: 1 seed → N content artifacts), reusing the bridge's proven shape verbatim:

```
factory.plan(seed_ref, dry)   classify the seed into applicable product LINES; per line, resolve pointers,
                              build the output spec, and (dry=False) record ONE in-review child assignment
                              + outbox + 'product_proposed' event. dry=True writes nothing.
factory.approve(assignment)   board gate: flip one in-review child → approved.
factory.approve_seed(seed_ref) PER-SEED BATCH (fork 3): flip ALL in-review children of a seed → approved
                              in one human action. Never silent; an explicit verb.
factory.build(assignment)     the GUARDED WRITE BOUNDARY (DEC-7): require approved, refuse double-build,
                              in-flight guard, validate output, run the lane's engine, record artifact_ref
                              + 'product_created', flip → 'captured'.
```

**Dedup is per `(seed_ref, line)`** (not per seed) — one seed legitimately fans to many lanes; an item is bridged once *per lane*. This closes the "cross-pipeline dedup" gap the bridge map flagged.

**Engine dispatch table** (`factory/lines.py`) — every lane is `(seed, pointers) → artifact`, all behind the one boundary:

| Line | Engine (already built) | Output | Lane class | Phase |
|---|---|---|---|---|
| `revision` (Saar) | `lectures.thin.build_thin` + `render` + `export` | local HTML/DOCX | deterministic, local write | **1** |
| `lecture` (Vaani-verbatim) | `lectures.render` + `export.run` | local HTML/DOCX/GDoc | deterministic, local write | **1** |
| `paper` / `drill` (Pariksha/Abhyaas) | `QxClient` + QX `paper_model` (student variant, zero answers) | local HTML | deterministic, needs QX server | C |
| `seed` (mcd) | `McdClient.create_seed` | prod mcd seed | prod write (today's bridge) | C |
| `deck` (Smriti) | deterministic projection of equation/callout blocks | local JSON/HTML | deterministic, local write | C |
| `audio` / `slides` (Shravan) | NotebookLM `studio_create` | external artifact | **async**, external | F |
| `figure` | image-gen | local PNG | **async**, external | F |

### 3.2 Reuse of the bridge safety guards (DEC-7 invariant)

`factory.build` inherits all five guards from `bridge.submit` (`bridge/run.py:193`), adapted to the local/async cases:
1. **status == approved** — refuse otherwise.
2. **refuse double-build** — refuse if a `product_created` event already exists for this assignment.
3. **in-flight guard** — record a `product_building` intent *before* the engine call; a crashed/in-flight retry refuses (safe-fail) rather than re-producing. Critical once async lanes (Phase F) can block for minutes.
4. **validate output at the write boundary** — `validate_product(line, artifact)`: the artifact file exists, is non-empty, and (for any answer-bearing lane) carries **zero answer columns**, asserted structurally exactly like `bridge.seed_payload.validate_seed_payload` (`bridge/seed_payload.py:20`).
5. **single write** — exactly one artifact write per approved assignment; on success flip to terminal `captured`.

### 3.3 Governance reuse — minimal schema change

The `assignments` table (`governance/store.py:27`) **already** carries `pipeline`, `seed_ref`, and `artifact_ref`, and `ASSIGNMENT_STATUS` already includes `queued|running|in-review|approved|changes|captured` (`store.py:41`). The factory reuses them:
- `pipeline` = the **lane** key (`revision`, `lecture`, …).
- `seed_ref` = the **parent seed** uid (e.g. `textbook:circular-motion`, `mcd:123`).
- `artifact_ref` = the **produced artifact** path/uid (set by `build`).
- `agent` = `khanak` (COO/CTO, production), `review_by` = `khanak`.

**No migration is required for Phase 1.** The additive `_MIGRATIONS` hook (`store.py:36`) remains available for later facets (e.g. a `style_events` table in Phase D, a `factory_lines` lookup if lanes ever need durable config). New event verbs only: `product_proposed`, `product_building`, `product_created` (events are free-text; no schema change).

### 3.4 The StyleSeed (Phase D, DEC-8)

A durable, versioned artifact (its own file under `state/style/` or a `governance.db` table via the migration hook — decided in the Phase-D plan), with five facets extracted from the 59 `content.json` chapters. Deterministic lanes (`revision`, `lecture`, `paper`) carry Deepak's voice **for free** (the source *is* his words), so Phase 1 ships voice-true content with **no StyleSeed dependency**; only the later LLM lanes (NotebookLM scripts, net-new prose) consume it. An advisory style-fit scorer surfaces on the board and **never** auto-advances the gate. The learning loop mines `review_overlay` edit-diffs into owner-promoted profile-deltas — wiring the dormant `thin.py` LLM hook and the spec's reserved decision-ledger inference.

### 3.5 The coverage graph (Phase E)

A rebuildable `concept_graph.db` (sibling to `catalog.db`, never a governance reset). Nodes = concepts (anchored on QX's `question_concept` as the canonical spine; textbook slugs + NCERT as **curated alias edges** — avoids the subject-as-folder-id duplicate-node bug) + artifacts by uid. Edges built cheap-first: Tier-1 FTS5 (structural) → Tier-2 QX BGE (semantic) → Tier-3 graphify (inferred, flagged, cached). The **coverage matrix** (concept × content-type) emits ranked, pointer-pre-loaded gap-cell seeds = the factory's computable demand queue. The human approves every proposed seed.

## 4. Phasing (re-sequenced spine-first, per fork 1)

| Phase | Title | Risk surface | Gate |
|---|---|---|---|
| **1** | **Dispatch spine + first deterministic lanes** (`revision`, `lecture`) — local writes only, no new prod path | new write *boundary* (local) | TDD green + **Codex pre-merge review** of the boundary (DEC-7) |
| **C** | More deterministic lanes: QX `paper`/`drill` (answer-safe), `deck`; the `seed` (mcd) lane folds the existing bridge into the dispatch | QX read; the one existing prod write | TDD green + answer-leak structural test |
| **D** | StyleSeed extraction (read-only) + conditioning on LLM lanes + advisory scorer; ratify DEC-8 wording into docs | pre-gate LLM compute | TDD green; owner review of v0 StyleSeed |
| **E** | Coverage graph (Tier-1) + Concept Atlas (read-only) + gap-cell seed proposals | rebuildable derived DB | TDD green |
| **F** | Async LLM lanes (NotebookLM/image-gen) with the async-pending crash-window guard; learning-loop maturity; Tier-2/3 edges | external async writes | TDD green + Codex review of async boundary |
| **G** | *(Deferred, Chairman-gated)* PRATHAM student twin: multi-tenant identity + the single outward `POST /api/factory/publish`, Saar sheets first, batch-by-chapter approval | new outward subsystem | explicit DEC-1 re-scope |

Each phase ends green (pytest, the project's standing TDD discipline) before the next begins.

## 5. Invariants & acceptance (Phase 1)

- **No new prod write path.** Phase 1 lanes write only local artifacts under `config.EXPORT_DIR`; the seven source subsystems stay read-only. This is *strictly safer* than the existing bridge (which writes to prod mcd).
- **The publish gate is untouched.** `build` produces an artifact; **publishing** it to any audience remains a separate, human, never-automated act (Phase G+).
- **Per-seed-batch gate works** (`approve_seed`) and never silent auto-approves.
- **Fan-out proven:** one chapter seed (`textbook:circular-motion`) produces ≥2 catalogued child artifacts (a revision sheet + a full lecture), each recording its `seed_ref` provenance, through the identical `plan → approve → build → captured` loop.
- **All five guards hold** on `build`, proven by tests (double-build refused; in-flight refused; output validated).
- Gate: backend pytest green (272 today → +Phase-1 tests), no regressions.

## 6. Non-goals (Phase 1, YAGNI)

- No StyleSeed, no LLM lanes, no coverage graph (Phases D/E/F).
- No PRATHAM, no student surface, no outward write, no multi-tenant identity (Phase G).
- No new web endpoint (the CLI `samagra factory …` is the Phase-1 surface; a GUI Assignments approve/build button is a later slice).
- No migration (existing columns suffice).
- No automation of `plan`/`build` on a schedule (manual CLI only — mirrors the bridge's single-operator threat model).

## 7. Open questions deferred to later plans

- StyleSeed storage (file vs `governance.db` table) — Phase D.
- Concept normalization merge-overlay format — Phase E.
- Async-pending state machine for external engines — Phase F.
- PRATHAM identity/hosting — Phase G (Chairman-gated).
