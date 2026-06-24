# SAMAGRA — Content Factory **Phase D** Design Spec (StyleSeed + first LLM lane)

**Date:** 2026-06-24 · **Author:** Claude-Deepak (Opus 4.8), CEO · **Status:** 🟡 DRAFT (design) — brainstormed + four forks ruled by the Chairman 2026-06-24; pending owner spec-review, then `writing-plans`
**Extends:** `specs/2026-06-23-samagra-content-factory-design.md` §3.4 (the StyleSeed) and §4 (Phase-D row). This pins that spec's parked Phase-D machinery (DEC-8) into an implementable design.
**Builds on:** **Phase C complete** (C1 `deck` · C2 `paper`/`drill` · C3 `seed`-fold), merged to `origin/main`, 360 pytest green. The factory is one guarded `build()` boundary fanning ONE approved seed to N child lanes, each routed by `Line.kind` (`local|qx|mcd`), board-approved + single-write + terminal `captured`.
**Grounded in:** direct re-reads of `samagra/factory/{lines.py,dispatch.py,deck.py,paper.py,seed_payload.py}`, `samagra/lectures/{thin.py,render.py,export.py}`, `samagra/adapters/textbook.py`, `samagra/governance/store.py`, `samagra/config.py`, and a real `content.json` (`circular-motion`). File/line citations are real.

---

## 0. Context — what Phase C already shipped, and what DEC-8 parked

The factory dispatch spine is live and complete for deterministic + prod-write lanes:

- `Line` (`factory/lines.py:11`) carries `kind ∈ {local, qx, mcd}` (`lines.py:17`). `classify(seed_ref)` (`lines.py:43`) fans a `textbook:<slug>` seed to **[revision, lecture, deck, paper, drill]** and a `munshi:<id>` seed to **[seed]**, in the stable `_ORDER` (`lines.py:40`).
- `dispatch.run_line(line, slug)` (`dispatch.py:36`) routes by kind: `deck`→`deck.build_deck`, `qx`→`paper.build_paper`, `local`→`lex.export_one(slug, variant, upload_gdocs=False)`; `mcd` is refused here and built via `run_seed(payload)` (`dispatch.py:58`).
- `build()` (`factory/run.py`) is the ONE guarded boundary; its **five crash-safety guards** — (1) status `approved`, (2) refuse double-build, (3) in-flight `product_building`-with-no-`product_created` guard, (4) `validate_product` at the write boundary, (5) single status write to terminal `captured` — are written once and shared across every kind; only the produce/validate step branches.
- `validate_product` (`dispatch.py:77`) re-asserts the artifact contract; `_assert_no_answer_leak` (`dispatch.py:115`) is the structural guard for `kind=="qx"` (no-op for `local`/`mcd`).
- Governance reuses the existing `assignments` columns (`pipeline`=lane, `seed_ref`=parent, `artifact_ref`=product) on the durable `governance.db` — **no migration**. The additive `_MIGRATIONS` hook (`store.py:36`, applied by `_apply_migrations` `store.py:98`) is **empty today** and reserved; the spec's §3.2 already named a `style_events` table in Phase D as its first user.

**DEC-8 (parked):** *StyleSeed as a durable governance artifact.* A versioned, owner-curated style profile (voice · sequencing · analogy · rigor-from-`flags[]` · selection priors) extracted from the 59 chapters; never reset. Style-fit scoring is **advisory**, hard-wired never to auto-advance the gate; the learning loop (mine `review_overlay` edit-diffs → profile-deltas) is **owner-ratified-only**. The single adversarial reviewer stays anchored only to external ground-truth.

The dormant LLM seam is `lectures/thin.py` (deterministic today; its docstring reserves an LLM swap). No prose-generation LLM client exists yet. The learning-loop substrate is `review_overlay` (`store.py:29`, written by `add_review` `store.py:171`).

## 1. The four forks ruled at brainstorm (2026-06-24)

| # | Fork | Ruling | Binding effect |
|---|---|---|---|
| **F-D1** | Slice scope | **B — moat + a first live LLM prose lane** | Phase D ships the StyleSeed moat **and** a generative lane behind the adversarial reviewer — not the moat alone. Adds an Anthropic client, API-key handling in this PUBLIC repo, mocked-LLM tests, and a dedicated Codex pre-merge review of the generation boundary. |
| **F-D2** | First prose lane | **Samadhan — misconception brief** | The first generated artifact is, per chapter, a set of `{concept, misconception, correction, why}` items in Deepak's voice. Every misconception→correction pair is a falsifiable physics claim → a sharp ground-truth anchor for the reviewer. |
| **F-D3** | StyleSeed storage | **C — git-committed versioned JSON file** | The profile is `styleseed/styleseed-v<N>.json`, **committed** (best curation/diff/PR-review + full git provenance). The owner accepts moat exposure in this public repo. Learning-loop candidate-deltas live in a `governance.db` `style_events` table. |
| **F-D4** | Samadhan fan-out | **Opt-in only** | `samadhan` is a registered lane but **excluded** from the default `classify("textbook:")` fan-out (which stays the 5 deterministic lanes). It is invoked deliberately (`factory plan textbook:<slug> --lane samadhan`). Every LLM generation is an explicit act. |

**Preserved, still binding:** the never-automated publish gate; the read-only firewall over the seven source subsystems (StyleSeed extraction is read-only over the textbook corpus; the Anthropic API is an outbound *generation* call, **not** a write to any source subsystem); the five crash-safety guards on `build` (shared, unchanged); per-seed-batch approval (`approve_seed`); the reviewer anchored only to external ground-truth (catch-rate→0 = red flag); DEC-1 bounded console scope. **No new prod write path** (local artifacts only). **No `assignments` migration** — only the additive `style_events` table is new.

## 2. Architecture — a fourth kind, and a style sidecar

### 2.1 `Line.kind` gains `"llm"`

`kind ∈ {"local", "qx", "mcd", "llm"}`. The branch points become `llm`-aware; the five guards are **identical**:

| Function | `llm` (samadhan) |
|---|---|
| `classify()` fan-out | **excluded** by a new `Line.auto_fan=False` flag (F-D4) — registered, but not proposed by default |
| `plan()` proposal body | resolve pointers from slug (as `local`) |
| `run_line()` | `samadhan.build_samadhan(slug)` — generate → adversarially review → score → write local artifacts |
| `validate_product()` | file exists + non-empty **+ `_assert_review_clean`** (no *uncorrected* reviewer-flagged error survives to capture) |
| `build()` artifact_ref | local html path |
| terminal status | `captured` when the reviewer is clean; **`changes`** (owner review) when any error item is unresolved — never silent capture |

`run_line` (`dispatch.py:36`) gains `if spec.kind == "llm": return samadhan.build_samadhan(slug)`. `Line` gains `auto_fan: bool = True` (default preserves all existing lanes); `classify` filters `LINES[k].auto_fan`. No other call site changes.

### 2.2 The style sidecar (read-only moat)

A self-contained `samagra/factory/style/` package, independent of the LLM lane (D1 ships with no API key). It produces and consumes a committed `styleseed/styleseed-v<N>.json` and a `governance.db` `style_events` table.

```
samagra/factory/style/
  profile.py   # StyleSeed dataclass (5 facets) + versioned JSON load/save + content-hash
  extract.py   # PURE deterministic 5-facet extraction over the 59 content.json chapters
  condition.py # to_system_prompt(profile) -> str   (the conditioning interface; the cached system block)
  score.py     # style_fit(text, profile) -> {overall, facets{…}}   (deterministic, advisory, never gates)
  learn.py     # mine review_overlay edit-diffs -> candidate deltas (style_events); owner-ratify promotes
samagra/factory/samadhan.py    # the llm lane engine
samagra/clients/llm_client.py  # the ONLY Anthropic SDK call site (generation + reviewer)
styleseed/styleseed-v0.json    # committed v0 profile (fork C)
```

## 3. The StyleSeed moat (D1 — deterministic, no API key)

### 3.1 The corpus and schema (verified)

Chapters live at `config.TEXTBOOK_CHAPTERS/<slug>/content.json` (`config.py:40`; outside the repo, gitignored). Verified schema (`circular-motion`):

- Top: `pdf, slug, title, subtitle, status, source_pages, sections`.
- `section`: `id, title, source_page_range, blocks, flags, enrichment`.
- `block.type ∈ {prose(html), equation(tex,number), figure(caption,svg), callout(variant,html), image-need(brief)}`.
- `section.flags = [{kind, note}]` — **populated** (e.g. `{"kind":"clarified", "note":"…finite rotations are not true vectors…"}`). This is the rigor-facet source named in DEC-8.

### 3.2 The five facets (`extract.py`)

Pure functions over `render.load_chapter(slug)` for all 59 slugs in `config.TEXTBOOK_QUEUE`. **Deterministic** — sorted aggregates, no randomness, no I/O beyond reading the corpus → byte-identical profile for a fixed corpus (golden-test-able).

| Facet | Source | Extracted signal (sorted counts/ratios + capped exemplar phrases) |
|---|---|---|
| **voice** | prose `html`, tags stripped | sentence-length histogram, 1st/2nd-person rate, hedging-marker rate, top signature connectives, imperative-sentence rate |
| **sequencing** | per-section block-type order | block-type bigram frequencies (e.g. `prose→equation`, `equation→callout`), section-count distribution, derivation-entry pattern |
| **analogy** | prose + callout html | analogy-marker rate (`imagine/like/think of/picture/everyday`), concrete-noun density, characteristic analogy openers |
| **rigor** | `section.flags[]` | `kind` distribution (clarified/caveat/…), flags-per-section density, exemplar caveat phrasings |
| **selection** | callout `variant` mix + block counts | callout-variant distribution (note/key/warn/tip), equation density, foregrounded-vs-dropped block ratios |

### 3.3 The profile (`profile.py`)

```python
@dataclass(frozen=True)
class StyleSeed:
    version: int
    facets: dict          # {"voice": {...}, "sequencing": {...}, "analogy": {...}, "rigor": {...}, "selection": {...}}
    source_corpus_hash: str   # sha256 over the sorted (slug, content-hash) pairs the profile was built from
    created_at: str
```

`save(profile)` writes `styleseed/styleseed-v<version>.json` (committed). `load_current()` reads the highest-version file. `content_hash(profile)` = sha256 over the canonical-JSON facets — recorded on a `style_seed_promoted` governance event so the durable ledger carries a tamper-evident pointer even though the file is the source of truth.

### 3.4 The conditioning interface (`condition.py`)

`to_system_prompt(profile) -> str`: renders the profile into a natural-language style guide ("Write in this teacher's voice: predominantly short declarative sentences; address the student in the second person; when you use a shortcut, flag it and add a generality caveat; foreground key results in callouts; reach for everyday analogies for abstract quantities…") **plus** the explicit facet statistics. This is the **large, stable system block** reused across every chapter — prompt-cached (§5). It is the interface the parent spec calls "conditioning on the LLM lanes."

### 3.5 The advisory style-fit scorer (`score.py`)

`style_fit(text, profile) -> {"overall": float, "facets": {"voice": float, …}}`: deterministic — recomputes the generated text's facet statistics and scores their distance to the profile's, per facet + overall (0–1). **Never auto-advances the gate** (DEC-8). Surfaced as advisory: stamped into the artifact's `meta` and recorded as a `product_scored` event. Pure → deterministic tests on fixtures.

## 4. The Samadhan LLM lane (D2 — generative, gated)

`samadhan.build_samadhan(slug) -> dict`:

1. **Ground truth:** `content = render.load_chapter(slug)` (raises `FileNotFoundError` if absent — propagated before any write).
2. **Condition:** `system = condition.to_system_prompt(style.load_current())`.
3. **Generate:** `llm_client.generate_samadhan(content, system=system)` → structured JSON `{"items": [{"concept", "misconception", "correction", "why"}]}`. Model `claude-opus-4-8`, adaptive thinking, structured output, the `system` block prompt-cached; the chapter ground-truth goes in the user turn.
4. **Adversarial review:** `llm_client.review_samadhan(items, content)` — a **separate** call whose system prompt anchors **only to the chapter physics (NOT the StyleSeed)**, prompted to *refute*: flag any "misconception" that is actually correct physics, any wrong "correction", any unsupported claim → `{"verdicts": [{"idx", "verdict": "ok"|"error", "rationale"}]}`. (DEC-8: anchored only to external ground-truth; catch-rate→0 = red flag.)
5. **Score:** `score.style_fit(prose, profile)` → advisory, into `meta` + a `product_scored` event. Never gates.
6. **Write local artifacts** under `config.EXPORT_DIR/<slug>/`: `<slug>-samadhan.json` (items + per-item verdicts + style score + `style_seed_version` + `model`) and `<slug>-samadhan.html` (printable MathJax via `render.DOC_TEMPLATE`/`DOC_CSS`, reusing the deck/paper render pattern; misconception/correction text HTML-escaped at the boundary, math passed as `$…$`).
7. **Return** `{"variant": "samadhan", "html", "json", "items": N, "errors": M, "style_score": …, "style_seed_version": …}` where `errors` = count of `verdict=="error"`.

**Gate (the new `llm` guard, `_assert_review_clean`):** if `result["errors"] > 0`, the build lands the artifact in **`changes`** (owner review), never silent `captured`. A clean brief → `captured`. The owner's subsequent edit/verdict on the artifact is what feeds the learning loop (§6). This is the `llm` analog of C2's `_assert_no_answer_leak` — the artifact always records the reviewer's verdicts transparently; the *gate* (capture) is what the unresolved error blocks.

## 5. The LLM client + API-key handling (`clients/llm_client.py`)

The **only** Anthropic SDK call site (mirrors `clients/{qx_client,mcd_client}.py` as the single boundary to an external subsystem).

- **Key from env:** `anthropic.Anthropic()` resolves `ANTHROPIC_API_KEY` from the **gitignored `.env`** (`.gitignore:2` `.env`, verified). The key is **never hardcoded and never logged**. A missing key raises a clean `RuntimeError` **before** `build()` records any `product_building` intent (anti-wedge, mirroring C3's pre-intent payload validation).
- **Call shape:** `client.messages.create(model="claude-opus-4-8", max_tokens=16000, thinking={"type":"adaptive"}, system=[{"type":"text","text":conditioned,"cache_control":{"type":"ephemeral"}}], output_config={"format":{"type":"json_schema","schema":SAMADHAN_SCHEMA}}, messages=[{"role":"user","content":chapter_payload}])`. Stream (`messages.stream` + `get_final_message`) if `max_tokens` is raised.
- **Prompt caching:** the conditioned StyleSeed system block is large and identical across every chapter in a run → cached (`cache_control: ephemeral`); the volatile per-chapter ground-truth sits in the user turn after the breakpoint (the prefix-stability rule). Opus 4.8 min cacheable prefix is 4096 tokens.
- **Refusal/error handling:** check `stop_reason` before reading content; typed exceptions (`AuthenticationError`, `RateLimitError`, `APIStatusError`). Opus 4.8 needs no Fable-5 refusal-fallback plumbing.
- **Model is configurable** via env (`SAMAGRA_LLM_MODEL`, default `claude-opus-4-8`) for both generation and review. The reviewer uses the **same** model; independence comes from the adversarial *refute* framing + the ground-truth-only anchor, not a different model.
- **Mockable:** the client is dependency-injected into `samadhan.build_samadhan` (a `_Client` protocol). The standing pytest gate runs with a **fake client** (canned generation + verdicts) — no live API call, no token cost. A separate **opt-in live smoke** (skipped unless `ANTHROPIC_API_KEY` is set) proves one real Samadhan end-to-end, mirroring the existing live QX/mcd smokes.

## 6. Governance — the learning-loop scaffold (D3, owner-ratified-only)

- **Migration:** `_MIGRATIONS[2]` (`store.py:36`) adds, additively:
  ```sql
  CREATE TABLE IF NOT EXISTS style_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, kind TEXT NOT NULL,
    subsystem_ref TEXT, from_version INTEGER, payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed');   -- proposed | ratified | rejected
  ```
  Applied by the existing `_apply_migrations` (`store.py:98`); `SCHEMA_VERSION` bumps to 2. **Never resets governance** (additive only).
- **Mine:** `learn.mine_deltas(conn)` reads `review_overlay` rows scoped to samadhan artifacts (owner edits/verdicts) → proposes candidate profile-deltas as `style_events(status='proposed')`. **Never auto-applied.**
- **Ratify:** `factory style-ratify <event_id>` promotes a delta into the **next** profile version — bumps `version`, rewrites/commits `styleseed/styleseed-v<N+1>.json`, marks the event `ratified`, records a `style_seed_promoted` event.
- Phase D ships the **substrate + proposal + ratify mechanism**; an automated mining cadence is Phase F.

## 7. CLI surface

New `samagra factory` subcommands (the existing `plan/approve/approve-seed/build` are unchanged):

- `factory style-extract` — (re)build a **candidate** StyleSeed from the 59 chapters; write a candidate file and diff it against the committed current version for owner review (the owner commits `v0` the first time).
- `factory style-show` — print the current profile version + facet summary.
- `factory style-ratify <event_id>` — promote a learning-loop delta (§6).
- `factory plan textbook:<slug> --lane samadhan` — explicitly target the opt-in lane (F-D4); without `--lane`, `plan` proposes only the 5 deterministic lanes.

Samadhan otherwise flows through the existing `plan → approve-seed → build` gate.

## 8. Build order (lowest-risk-first, mirroring Phase C's sub-slices)

| Sub-slice | Scope | Risk surface | Gate |
|---|---|---|---|
| **D1** | The moat: `style/{profile,extract,condition,score}.py` + committed `styleseed-v0.json` + `factory style-extract`/`style-show` | read-only over the corpus; **no API key, no LLM, no new write path** | TDD green (deterministic facet/scorer/condition tests); owner reviews v0 StyleSeed |
| **D2** | The lane: `clients/llm_client.py` + `samadhan.py` + `Line.kind="llm"`/`auto_fan` + `dispatch`/`validate_product` wiring + `--lane` plan | outbound LLM generation; API key in a public repo; the new `llm` capture-gate | TDD green (mocked-LLM tests: gate logic, artifact contents, `style_seed_version` stamp) + opt-in live smoke + **dedicated DEC-7 Codex pre-merge review of the generation boundary** |
| **D3** | The learning loop: `_MIGRATIONS[2]` `style_events` + `learn.py` + `factory style-ratify` | additive governance migration | TDD green (migration test; mine→propose→ratify→version-bump) |

Each ends green (pytest) before the next; D2 is the only sub-slice that touches the network or holds a secret.

## 9. Invariants & acceptance

- **No new prod write path.** Every Phase-D artifact is a **local** file under `config.EXPORT_DIR`; the seven source subsystems stay read-only. The Anthropic API is an outbound *generation* call, never a write to a source subsystem, and the publish gate is untouched.
- **The publish gate is untouched** — `build` produces a local artifact; publishing remains a separate, human, never-automated act (Phase G+).
- **Five crash-safety guards hold** on `build`, shared verbatim across `local|qx|mcd|llm` (proven by tests: double-build refused, in-flight refused, output validated, anti-wedge pre-intent validation for `llm`).
- **The reviewer is anchored only to external ground-truth** (the chapter physics), never to style; the style scorer is advisory and **never** auto-advances the gate. A non-zero reviewer catch-rate is expected; catch-rate→0 is a monitored red flag.
- **StyleSeed is durable + versioned + owner-curated, never reset.** Extraction is deterministic and read-only; the learning loop is owner-ratified-only.
- **No `assignments` migration** (existing columns suffice); only the additive `style_events` table is new.
- **No secrets in git or logs** — `.env` gitignored; the key is read from env and never printed.
- **Fan-out proven:** `factory plan textbook:<slug> --lane samadhan` → one samadhan assignment → `build` → a clean reviewed brief reaches `captured`; an error-flagged brief lands in `changes`; the durable `governance.db` is untouched by the test path.
- Gate: backend pytest green (360 today → +Phase-D tests), no regressions; the lone pre-existing env red (`test_gdocs`, Google API libs) is unrelated.

## 10. Non-goals (Phase D, YAGNI)

- No async LLM lanes (NotebookLM/image-gen) — **Phase F**.
- No second LLM lane beyond `samadhan`; no automated learning-loop mining cadence (D3 is the scaffold only).
- No coverage graph / Concept Atlas — **Phase E**.
- No PRATHAM / student surface / outward write / multi-tenant identity — **Phase G**.
- No samadhan in the default fan-out (F-D4 opt-in).
- No new web endpoint (the CLI is the Phase-D surface).

## 11. Open questions deferred to the plan / later phases

- Exact facet feature vectors + scorer distance metric — pinned in the D1 plan against the real corpus.
- `style_events` payload schema for a ratified delta — pinned in the D3 plan.
- Async-pending state machine for external engines — Phase F.
- Reviewer-catch-rate monitoring surface (board signal) — Phase F.
