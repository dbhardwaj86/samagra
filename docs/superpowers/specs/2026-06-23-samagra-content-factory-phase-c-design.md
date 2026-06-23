# SAMAGRA — Content Factory **Phase C** Design Spec

**Date:** 2026-06-23 · **Author:** Claude-Deepak (Opus 4.8), CEO · **Status:** ✅ APPROVED (design) — Chairman ratified the three Phase-C forks 2026-06-23; ready for `writing-plans`
**Extends:** `specs/2026-06-23-samagra-content-factory-design.md` (§3.1 engine table, §4 phasing). This pins that spec's **Phase-C row** ("more deterministic lanes") into an implementable design.
**Builds on:** **Phase 1** (the dispatch spine), built TDD + Codex-reviewed + MERGED to `origin/main` — `samagra/factory/` (`lines` · `dispatch` · `run` · `outbox`) + CLI `samagra factory plan|approve|approve-seed|build`; 303 pytest green; golden thread proven live.
**Grounded in:** direct re-reads of `samagra/factory/{lines.py,dispatch.py,run.py,outbox.py}`, `samagra/bridge/{run.py,seed_payload.py}`, `samagra/clients/{qx_client.py,mcd_client.py}`, `samagra/__main__.py`, `samagra/governance/store.py`. File/line citations are real.

---

## 0. Context — what Phase 1 already shipped

The factory dispatch spine is live: one guarded `build()` boundary fans ONE approved seed into N child assignments, each routed by lane to an existing renderer, each board-approved + single-write + terminal `captured`. Today two lanes exist, both `kind`-implicitly-local:

- `revision` (Saar, thin) and `lecture` (Vaani-verbatim, thick) — both `source_prefixes=("textbook:",)`, both render local HTML/DOCX via `lectures.export.export_one(slug, variant, upload_gdocs=False)` (the gdocs opt-out is review-24 H1).
- `build()` (`factory/run.py:132`) inherits the bridge's five crash-safety guards: (1) status `approved`, (2) refuse double-build (no prior `product_created`), (3) in-flight guard (`product_building` with no matching `product_created` ⇒ refuse), (4) `validate_product` at the write boundary, (5) single status write to terminal `captured`.
- A **4-entry-point workflow firewall** is in force: `factory.approve`/`approve_seed`/`build` refuse any `pipeline not in LINES`; `bridge.approve`/`submit` refuse any `pipeline != "mycontentdev"`.
- Governance reuses the existing `assignments` columns (`pipeline`=lane, `seed_ref`=parent, `artifact_ref`=product) via `store.connect()` on the durable `governance.db` — **no migration**.

Separately, the **bridge** (`samagra/bridge/`, merged Phase 3) runs the *inward* loop munshi → 1 mcd seed: `scan` (classify munshi content items → propose `in-review` assignments, pipeline `mycontentdev`) → `approve` → `submit` (the ONE prod write: `validate_seed_payload` → intent `seed_submitting` → `McdClient.create_seed` → `seed_created` → `captured`). Its write boundary is hardened by Codex reviews 22/23.

Phase 1's headline invariant was **"NO new prod write path"** — its lanes write only local artifacts.

## 1. The pivot's Phase-C row, and the three ratified forks

Per the parent spec §4, **Phase C = "more deterministic lanes": QX `paper`/`drill` (answer-safe), `deck`; and the `seed` (mcd) lane folds the existing bridge into the dispatch.** The Chairman ruled three forks on 2026-06-23:

| # | Fork | Ruling | Binding effect |
|---|---|---|---|
| **F-C1** | Prod-write `seed` lane scope | **Include all 3 lanes now** | `deck` + `paper`/`drill` + `seed`/mcd all ship under Phase C — the `seed` lane re-introduces a prod write path, consciously, through the factory. |
| **F-C2** | Bridge relationship | **Fold: one path, the `seed` lane is canonical** | The munshi→mcd write **moves into** the factory `seed` lane (reusing the bridge's proven payload-build + validate + `create_seed` + guards). `samagra bridge` is **deprecated** and delegates to the factory. **Only the factory writes mcd** ⇒ cross-workflow double-write is *structurally impossible* (one path, not two paths with shared dedup). |
| **F-C3** | Packaging | **Three sub-slices, lowest-risk first** | **C1** `deck` → **C2** `paper`/`drill` → **C3** `seed` fold. Each is its own implementation plan, each ends green (pytest) and is reviewed before the next; **C3 gets a dedicated DEC-7 Codex pre-merge review**, mirroring bridge review 22. |

**Preserved, still binding:** the never-automated publish gate; the read-only firewall over the seven source subsystems (the `seed` lane writes only to mcd, via the *existing* `create_seed` capture contract — no NEW subsystem, no new web endpoint); the five crash-safety guards on `build`; per-seed-batch approval (`approve_seed`); DEC-1 bounded console scope; the no-mining rule. The `seed` lane is **not** a new prod write *mechanism* — it is the *existing* bridge write, relocated to be the canonical lane (F-C2). Total mcd-write paths after Phase C: still exactly one.

## 2. Architecture — lanes gain a *kind*

Today every `Line` renders local HTML via the lecture exporter, so `build()` can assume `result["html"]`. Phase C generalizes the one boundary to serve **three output kinds** without weakening any guard.

`Line` (`factory/lines.py:11`) gains a `kind` field:

```
kind ∈ {"local", "qx", "mcd"}      # default "local" → revision/lecture unchanged
```

The branch points, and only these, become `kind`-aware (the five guards are **identical** for all kinds):

| Function | `local` (revision/lecture/deck) | `qx` (paper/drill) | `mcd` (seed) |
|---|---|---|---|
| `plan()` proposal body | resolve pointers from slug (as today) | resolve pointers from slug | fetch munshi item → `build_seed_payload` → store payload in the `product_proposed` event note |
| `run_line()` | the lane's local renderer | assemble a question-only paper via `QxClient` | *n/a* — `build()` runs the mcd path directly (payload, not a slug render) |
| `validate_product()` | file exists + non-empty | file exists + non-empty **+ `_assert_no_answer_leak`** | seed object returned with an id (payload was validated pre-write) |
| `build()` artifact_ref | local html path | local html path | `mcd:<seed_id>` |

Rationale: a single dispatch with a small, explicit `kind` switch is far easier to audit (and to Codex-review) than three parallel build loops. The guard sequence — status → double-build → in-flight → *produce* → validate → single-write — is written once and reused for every kind.

## 3. The three lanes

### 3.1 C1 — `deck` (Smriti flashcards) · `kind=local`

- **Registry:** `Line("deck", "Flashcard deck (equation/callout projection)", variant="deck", source_prefixes=("textbook:",), kind="local")`.
- **Source:** the *same* chapter `content.json` the `lecture` lane already reads (no new source). Deterministic projection: each equation block and each callout block → one flashcard `{front, back, ref}`.
- **Engine:** a new pure module `factory/deck.py` (`build_deck(slug) -> {"json": path, "html": path}`) — no LLM, no network. Reuses the lectures content loader to read the chapter blocks; writes a `.json` (the deck data) and a small `.html` (printable) under `config.EXPORT_DIR`.
- **`validate_product`:** the html (and json) exist and are non-empty (the `local` path, unchanged).
- **Why first:** zero external dependency, deterministic, lowest blast radius — it exercises the new lane-`kind` generalization in isolation before any risk lands.

### 3.2 C2 — `paper` / `drill` (Pariksha / Abhyaas) · `kind=qx`

- **Registry:** `Line("paper", "Question paper (answer-safe)", variant="paper", source_prefixes=("textbook:",), kind="qx")` and `Line("drill", "Adaptive drill set (answer-safe)", variant="drill", source_prefixes=("textbook:",), kind="qx")`.
- **Source:** a `textbook:<slug>` seed; the slug (de-hyphenated) is the QX query. `drill` = a smaller, focused set (fewer items); `paper` = a full set. Both are **deterministic given QX's response** (no LLM).
- **Engine:** a new module `factory/paper.py` using `QxClient.search(q=<chapter>, mode=..., page=...)` (`clients/qx_client.py:29`). It assembles **question-only** HTML from the per-result rendered question HTML QX already returns (KaTeX + figures) — it never requests, renders, or stores answers/solutions.
- **QX dependency:** QX is a local read-only sidecar (`SAMAGRA_QX_SERVER_URL`, default `:8783`). If QX is unreachable, `build()` **refuses cleanly** (a clear ValueError, no partial artifact, assignment stays `approved`) — the same graceful-degradation posture the bridge uses for munshi-down (review-22 M2). Tests stub `QxClient` (no live server in CI).
- **`validate_product` (the real safety surface):** file exists + non-empty **+ `_assert_no_answer_leak(line, result)` is now enforced** for `kind=qx` (see §4).

### 3.3 C3 — `seed` (mcd) · `kind=mcd` — the bridge fold (highest risk)

- **Registry:** `Line("seed", "mycontentdev editorial seed", variant=None, source_prefixes=("munshi:",), kind="mcd")`.
- **`classify`:** `munshi:<id>` → `["seed"]` (and `textbook:<slug>` → the five content lanes; see §5). The `seed` lane never applies to a textbook seed, so a chapter is never written to mcd.
- **`plan("munshi:<id>")`:** fetch that munshi item (via `MunshiAdapter`, as `bridge.scan` does), confirm `classify_item == "content"`, build the flat seed payload with the **reused** `seed_payload.build_seed_payload(item, pointers)`, and store the payload in the `product_proposed` event note (mirroring the bridge's `seed_proposed` note). Dedup is per `(seed_ref, line)` exactly as today.
- **`build("<assignment_id>")` for `kind=mcd`** — guards 1–5, with the produce step being the prod write:
  1. status `approved`; 2. no prior `product_created`; 3. not in-flight (`product_building` without `product_created`);
  4. **load** the proposed payload from the `product_proposed` event and **`validate_seed_payload(payload)`** at the boundary (re-asserts the `{type ∈ SEED_TYPES, raw_text non-empty}` contract — review-22 M1);
  5. append `product_building` intent **before** the external write (crash-window safe), `McdClient().create_seed(payload)`, append `product_created` with `subsystem_ref = str(seed id)`, flip → `captured`. `artifact_ref = "mcd:<seed_id>"`.
- **Discovery — `samagra factory scan`** (new CLI verb): folds `bridge.scan` — iterate munshi content items and `plan` the `seed` lane for each (`seed_ref = munshi:<uid>`). Read-only; writes only `in-review` proposals (never a seed).
- **Bridge deprecation (F-C2):** `samagra bridge {scan,approve,submit}` print a one-line deprecation notice and **delegate** to the factory (`scan → factory.scan`, `approve → factory.run.approve`, `submit → factory.run.build`). `bridge.submit`'s prod write is **retired** — after C3 the only code path that calls `create_seed` is the factory `seed` lane. The reusable payload helpers (`seed_payload.py`: `SEED_TYPES`, `build_seed_payload`, `validate_seed_payload`) are **relocated** to `factory/seed_payload.py` (they belong with the canonical writer); `bridge/seed_payload.py` becomes a thin re-export shim so nothing breaks mid-migration.
- **Test migration:** the behaviors locked by `tests/test_bridge.py` (status-blind scan dedup, approve gate, the five submit guards, `validate_seed_payload`, in-flight refusal) are **preserved** and re-homed against the factory `seed` lane (pipeline `seed`, verbs `product_*`). The payload-shape tests follow `seed_payload.py` to its new home.

## 4. Answer-leak enforcement (the C2 / `kind=qx` guard)

`_assert_no_answer_leak(line, result)` (`factory/dispatch.py:56`, today a no-op) becomes **real** for `kind=qx`. Posture = **defense-in-depth**: we do **not** trust QX's student variant to be answer-free; we re-assert it structurally at *our* write boundary. The check reads the assembled artifact and **raises `ValueError`** if it contains any answer/solution markers (e.g. an answer-key block, a `data-answer` / `correct`-option attribute, a "Solution:" / "Answer:" heading — the exact marker set is pinned in the C2 plan against QX's real rendered HTML). Proven by a **poisoned-payload test**: a stubbed QX response carrying an answer marker must make `build()` refuse and leave the assignment un-`captured`. `kind ∈ {local, mcd}` keep the no-op (lecture/deck carry no answer columns by construction; the mcd payload is validated by `validate_seed_payload`, not the answer-leak guard).

## 5. `classify` after Phase C

```
textbook:<slug>  ->  [revision, lecture, deck, paper, drill]   # one chapter fans to 5 artifacts
munshi:<id>      ->  [seed]                                     # the folded bridge (mcd write)
<anything else>  ->  []
```

`_ORDER` extends to `[revision, lecture, deck, paper, drill, seed]`; each lane still filters by its own `source_prefixes`, so the textbook lanes never see a `munshi:` seed and vice-versa.

## 6. Invariants & acceptance (per sub-slice; each ends green before the next)

**C1 (`deck`):** one textbook seed now fans to **3** captured local artifacts (revision + lecture + deck); the deck json+html exist, are non-empty, and project the chapter's equation/callout blocks; the lane-`kind` field defaults keep `revision`/`lecture` byte-identical; all five guards still hold. No external dependency, no prod write. Gate: pytest green.

**C2 (`paper`/`drill`):** a textbook seed fans to paper + drill; both artifacts are **answer-free** (poisoned-payload test refuses); QX-down ⇒ clean refusal, no partial artifact; the five guards hold. Read-only QX, no prod write. Gate: pytest green + the answer-leak structural test.

**C3 (`seed` fold):** a `munshi:` content seed plans → approves → builds **exactly one** mcd seed via the factory; `validate_seed_payload` gates the write; double-build, in-flight, and status guards all refuse; **`samagra bridge submit` no longer writes** (delegates / retired) so there is exactly **one** mcd-write path; the migrated bridge behaviors stay green; golden thread proven on a real munshi item (in an isolated governance store, not the durable `governance.db`). Gate: pytest green + **dedicated DEC-7 Codex pre-merge review** of the prod-write boundary (double-build, in-flight, validate, single-path) before merge.

**Across all three:** no migration (existing `assignments` columns suffice; new event verbs `product_*` only); the publish gate is untouched (`build` produces an artifact/seed; *publishing* to any audience stays a separate, human, never-automated act — Phase G+); the seven read-only subsystems stay read-only (the `seed` lane uses only the existing `create_seed` capture contract).

## 7. Non-goals (Phase C, YAGNI)

- No StyleSeed, no LLM lanes, no advisory style scorer (Phase D).
- No coverage graph / Concept Atlas (Phase E).
- No async/external lanes — NotebookLM audio/video, image-gen `figure` (Phase F).
- No PRATHAM, no student surface, no outward write, no multi-tenant identity, **no new web endpoint** (Phase G; the CLI stays the Phase-C surface — a GUI Assignments approve/build button is a later slice).
- No SECOND mcd-write path (F-C2 folds to exactly one), and no new write *mechanism* — the `seed` lane reuses the existing `create_seed` capture contract.
- No automation of `plan`/`scan`/`build` on a schedule (manual CLI only — the bridge's single-operator threat model carries over).

## 8. Open questions deferred to the sub-slice plans

- **C1:** the exact flashcard projection (which block kinds → front/back; how callouts map) — pinned in the C1 plan against the real `content.json` block schema.
- **C2:** the exact QX query/paging strategy per `paper` vs `drill`, and the precise answer-marker set — pinned in the C2 plan against QX's live rendered HTML.
- **C3:** whether the deprecated `samagra bridge` is retained indefinitely as a delegating alias or removed after a grace period (default: retain as a thin alias); the precise re-export shim vs hard-move for `seed_payload.py` — pinned in the C3 plan.
