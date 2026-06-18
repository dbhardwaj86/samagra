# SAMAGRA — Evolution Design Spec

**Date:** 2026-06-19 · **Author:** Claude-Deepak (Opus 4.8), CEO · **Status:** ✅ APPROVED (design) — ready for `writing-plans`
**Supersedes planning in:** `SAMAGRA-HANDOFF.md` (§9 open questions, all now decided)
**Integration contracts in this doc were verified** against the live repos on 2026-06-19 (read-only fan-out, 5 agents). File/line citations are real.

---

## 0. Context — what already exists

TeachingOS **slice-1** is built, verified (11/11 tests), and open as **PR #1** (`slice-1 → main`, MERGEABLE). It is a local-first Python + FastAPI **control plane**: read-only adapters normalise 7,044 artifacts (QX / textbook / booklets / INSP / sims) into a unified FTS5 catalog (`teachingos.db`); a JSON-file phase state machine drives four pipelines; a forked-QX portal (JS-SPA) exposes search + a gate board; a thin/thick lecture exporter emits HTML + DOCX (OMML) + Google Docs; a semi-autonomous tick loop notifies via Telegram/email. **This spec extends that spine — it does not rebuild it.**

SAMAGRA (समग्र — *integrated / whole*) grows the spine into a **company-structured agentic content OS**: a board of three frontier agents governing a worker fleet, folding in `mycontentdev` (editorial seed pipeline) and `munshi` (phone capture clerk), with a blocking pre-commit Codex review and a CEO prompt-outbox.

## 1. Goals / non-goals

**Goals**
- Rename `teachingos → samagra` (repo + package) cleanly, losing nothing.
- Make SAMAGRA *see* mycontentdev and munshi as first-class read-only sources, reflecting their state (not duplicating it).
- Stand up the governance layer: per-agent worktrees, a prompt outbox, an Assignments portal tab, and a blocking pre-commit Codex review.
- Wire the active capture→seed loop (munshi → mycontentdev) behind board approval.
- Render the org as an inline-SVG chart in `STATUS.html`.

**Non-goals (YAGNI)**
- No rebuild of slice-1 adapters/exporter/scheduler.
- No new write paths into the subsystems beyond the single board-approved seed-creation in Phase 3.
- No autonomous worker dispatch in this round (that's a later slice — see §13).
- No migration of slice-1 catalog data; all new DB tables are additive.

## 2. The ten decisions (LOCKED 2026-06-19)

| # | Question | Decision |
|---|---|---|
| §9.1 | Build order | **Adapters → governance → loop**, all in one phased plan (Phase 0 rename precedes). |
| §9.10 | Rename timing | **Rename first** (Phase 0): merge PR #1 → `gh repo rename` → package rename. |
| §9.2 | mycontentdev read | **Cloud admin API, read-only** (`POST /api/admin/query`, `GET /api/admin/pending`; `x-mcd-admin`). |
| §9.3 | munshi read | **Reuse `driver.mjs` `library()`** over `GET /api/library`, read-only. |
| §9.5 | State boundary | **Reflect subsystem state + thin board-review overlay** (single source of truth stays in each subsystem). |
| §9.6 | Agent isolation | **Git worktrees** of the renamed `samagra` repo (deepak / khanak / codex). |
| §9.7 | Outbox model | **Markdown outbox files + a `samagra.db` index** + `events` audit ledger. |
| §9.8 | Codex gate | **Block on `severity==CRITICAL`, no escape hatch**; repo-wide via committed `core.hooksPath`; fail-closed if Codex can't run. |
| §9.4 | munshi→mcd bridge | **Propose → board-approve → create via capture API** (`POST /api/seeds`, app key). |
| §9.9 | Org titles | **Adopt the proposed chart**; human Founder & Chairman = **Deepak (the BOSS)**. |

## 3. The org (the company)

**Board — review & approval authority** (only these three may review other agents' outputs and approve writes; each works from its own worktree):

| Title | Agent | Mandate |
|---|---|---|
| Founder & Chairman ("the BOSS") | **Deepak** (human) | Vision; final publish gate; resolves board disputes. |
| CEO | **Claude-Deepak** | Orchestrator: routes work, writes the outbox, owns gates + the loop. |
| COO / Chief Content Officer | **Claude-Khanak** | Production: parallel content gen, QA, linking, enrichment fan-out; approves worker content. |
| Chief Architect & Code-Review Lead | **Codex** | Architecture + the blocking pre-commit review; approves code writes. |

**Workers — drafts only, never self-approve:** Gemini+NotebookLM = *Director, Research & Media*; Grok = *Director, Realtime Intel & Imagery*; Hermes = *Chief of Staff (Ops & Comms)*.

**Departments — data/capture surfaces:** munshi (Front Desk), mycontentdev (Editorial), QX (Question Bank), physics-textbook (Lectures), booklets (Print/Proofing), INSP (Olympiad), pratyaksh (Sims, read-only), GN-OCR (Handwriting).

> The slice-1 state machine **already** encodes these as phase `owner` values (`claude1`, `claude2`, `codex`, `gemini`, `notebooklm`, `human`, `teachingos`) — the org metaphor is half-wired (`state.py`).

Rendered as an inline-SVG org chart in `STATUS.html` (Inter, near-white, accent indigo).

## 4. Architecture — the four phases

```
Phase 0  Rename teachingos → samagra   (merge PR #1 → rename repo → rename package → docs)
Phase 1  Subsystem adapters            (mycontentdev + munshi → catalog; reflect state; review overlay)
Phase 2  Governance                    (worktrees · outbox · Assignments tab · pre-commit Codex hook · org SVG)
Phase 3  Active loop                   (munshi item → proposed seed w/ pointers → board approve → capture API)
```

Each phase ends green (pytest, slice-1 style) before the next begins — one plan, internally gated.

---

## 5. Phase 0 — Rename `teachingos → samagra`

**Verified rename surface** (all identifiers confirmed present):
- Package dir `teachingos/` → `samagra/`; every import `from teachingos import …` / `from teachingos.adapters import …`.
- `pyproject.toml` `[project.scripts]` console entry `teachingos.__main__:main` → `samagra.__main__:main`; project name.
- `config.py`: `DATA_DB = REPO_ROOT / 'teachingos.db'` → `samagra.db`; `STATE_DIR`; source-path constants; `.env` keys.
- `scheduler.py:22` `TASK_NAME = 'TeachingOS-tick'` → `'SAMAGRA-tick'`.
- Docs: `README.md`, `STATUS.html`, `HANDOFF.md`.

**Steps (run with the owner present):**
1. `gh pr merge 1 --squash` (or merge) — `slice-1 → main`.
2. `gh repo rename samagra` (auto-redirects old URL; updates `origin` — verify `git remote -v`).
3. Rename package + update all identifiers above; rebuild catalog to confirm (`python -m samagra refresh` → 7,044 artifacts).
4. Update docs to the SAMAGRA identity.
5. Suggest `/snap-pre "samagra rename"` before the churn (already snapped this session).

**Safety:** no secrets/content/machine-paths committed; `.env`, `mcd-cloud.json`, `.dev.vars`, `*.db`, `state/` stay gitignored.

## 6. Phase 1 — subsystem adapters (reflect, don't duplicate)

Both follow the **verified** slice-1 adapter contract: subclass `adapters.base.Adapter` (`name`, `label`, `available() -> bool`, `summary() -> dict`, `artifacts() -> Iterator[Artifact]`), register in `samagra.adapters.ALL_ADAPTERS` (`adapters/__init__.py`). `Artifact` fields: `uid, source, kind, title, subject, unit, chapter, status, path, url, updated_at, meta` (dict; serialised inline by `Artifact.row()`). `available()` gates `artifacts()` — guard on creds/reachability so a missing key degrades gracefully.

### 6a. mycontentdev adapter (`McdAdapter`)
- Reads the **cloud admin API** (production D1): `POST /api/admin/query` with body `{ sql: "SELECT … " }` (validated `^(select|with|pragma)` — read-only by construction), and `GET /api/admin/pending`. Auth header **`x-mcd-admin`**; admin key from gitignored `mcd-cloud.json` (`{apiUrl, adminKey}`) or env `MCD_ADMIN_KEY`.
- Emits one `Artifact` per seed: `source="mycontentdev"`, `kind=seed.type` (one of `concept|question|snippet|simulation_idea|experiment|notebooklm_link|rough_idea`), `status=seed.status` (`captured|needs_processing|processing|draft_ready|changes_requested|approved|brief_generated|content_linked|done|archived`), `meta={seedId, draft/canonical revision ids, …}`.
- **Never** writes drafts/approvals — the existing Claude-enrichment + GUI path owns that.

### 6b. munshi adapter (`MunshiAdapter`)
- Reads `{people, total, items}` via `GET /api/library`. Reuse `stress/driver.mjs` `MunshiClient.library()` (shell out to Node, or port the single GET). Auth = **`Cookie: munshi=<secret>`** (URL-encoded; constant-time SHA-256 vs **`MUNSHI_SECRET`** — *one* env var name for dev and prod). Secret from gitignored `.env`, **never echoed/logged/committed**.
- Item shape: `id, kind (note|todo|issue|question|followup), payload (JSON), tags, status (open|claimed_done|validated|dismissed), due, ts, person`. Emits one `Artifact` per non-dismissed item: `source="munshi"`, `kind=item.kind`, `status=item.status`, `meta={payload, person, tags, due}`.
- Pure read — touches no store item.

### 6c. Reflected pipelines + board-review overlay
- Add `mycontentdev` (and optionally `munshi-intake`) pipelines to the **`PIPELINES` dict in `state.py`** (hardcoded by design). Mirror the verified `scheduler._reflect_textbook(dry, events)` pattern: `state.load(pipeline)` → `state.set_phase(pipeline, phase, status, **fields)` → `state.save(st)`; reflect mycontentdev seed-status into phase status read-only. **Honor `config.TEXTBOOK_LOCK`-style coexistence** — if a subsystem runs its own automation, don't fight it; mirror only.
- **Board-review overlay** = new `samagra.db` tables (§9) recording board-agent approval of *worker outputs* across subsystems. References subsystem records by id; never copies their content. This is the one piece of state SAMAGRA *owns* (subsystems don't model "which board agent approved this artifact").

## 7. Phase 2 — governance mechanics

### 7a. Per-agent worktrees
`samagra-deepak/`, `samagra-khanak/`, `samagra-codex/` as **git worktrees** of the renamed repo (shared history, isolated working trees). Each carries its own `CLAUDE.md`/`AGENTS.md` stating role + review authority + outbox path. Per-folder backups via cbm snapshots. The owner opens an interactive session in whichever folder to drive that agent.

### 7b. Outbox + Assignments tab
- **Outbox:** per-agent `outbox/` of dated markdown files `YYYY-MM-DD-NN-<slug>.md` with front-matter: `assignee, pipeline, seed/artifact refs, expected output, review-by`. Human-readable; the owner pastes them into the target agent's session.
- **`samagra.db` index:** an `assignments` table indexes the outbox files with status (`queued → running → in-review → approved | changes`); every transition appends to an `events` ledger (mirrors mycontentdev's `events` semantics).
- **Assignments tab** follows the **verified** portal SPA pattern: add `<a class="tab" data-tab="assignments">` to `portal/templates/portal.html` nav; add `GET /api/assignments` (JSON) to `api/app.py`; add `renderAssignments()` to `portal/static/app.js` and register it in the `TABS` object; optional `#ct-assignments` count badge. All dynamic HTML via the existing `esc()` (XSS).

### 7c. Pre-commit Codex review (blocking, no escape hatch)
- **Install:** committed `core.hooksPath` (e.g. `.githooks/`) so the main repo **and every worktree** inherit one hook automatically. Set via `git config core.hooksPath .githooks` during Phase 0/2 setup (documented in the repo).
- **Invocation (verified pattern from `codex_dispatch.py`):** `codex exec --ephemeral --skip-git-repo-check --sandbox read-only --output-last-message <tmp.json> --color never -`, prompt on **stdin**, structured findings read back from the temp JSON. Resolve the CLI via `shutil.which("codex")` / `CODEX_BIN`. **Reduce `timeout_s` from the default 900 to ~90s** for pre-commit ergonomics; keep `max_attempts=2`.
- **Verdict logic:** parse `result.parsed["findings"]`; **block (exit non-zero) iff any finding has `severity == "CRITICAL"`**. Empty findings = pass. `HIGH/MED/LOW` print but do not block.
- **No escape hatch:** there is no bypass env flag; a CRITICAL verdict always blocks. **Fail-closed on unavailability** (confirmed by owner): if Codex errors/times out/JSON-fails twice, the hook **blocks** with loud diagnostics (how to restore `codex` on PATH, how to inspect the staged diff). The hook can shell to a small `samagra/review/precommit.py` that imports the dispatch helper, so logic is testable.

### 7d. Org SVG
Hand-crafted inline-SVG org chart (Board → Workers → Departments) added to `STATUS.html` per the owner's doc style.

## 8. Phase 3 — the active loop (munshi → mycontentdev → board → publish)

1. **Scan + classify:** SAMAGRA reads munshi items (Phase-1 adapter) and classifies each as *content-seed candidate* vs *ops-todo* (heuristics on `kind`/`payload`/tags; e.g. `question`/`note` about physics → candidate; `followup`/`issue` about a student → ops).
2. **Draft a proposed seed + exact pointers:** build a `POST /api/seeds` payload — `type` (mapped from munshi `kind`, default `rough_idea`), `raw_text` (the item's payload text, verbatim), `detail` (per-type JSON; for `rough_idea`: `{braindump, possible_directions, proposed_type, rationale}`). **Exact pointers** = candidate corpus artifacts SAMAGRA resolves from its own FTS5 catalog (QX/textbook/booklet/INSP `uid`s + titles), attached in `detail`/`meta` so downstream enrichment knows the source.
3. **Queue as a board-review assignment** (Assignments tab; status `in-review`).
4. **On board approval:** create the seed via `POST /api/seeds` with the **app password** (`x-mcd-key` header / `?k=`), from gitignored `.env`. Capture creates revision #1 `origin='user_original'` (immutable).
5. **Hand off:** the **existing** mycontentdev enrichment (Claude session writes `claude_draft`) + **GUI approval** (draft→canonical) flow takes over. SAMAGRA only *reflects* status from here. Publish gates (HTML/DOCX/GDocs, question corpus, media) stay the slice-1 exporter, now driven by approved content.

> **Two keys, two zones:** reads use the **admin key**; the single board-approved write uses the **app password**. Both gitignored. SAMAGRA never writes a draft, never approves, never edits an original — those remain mycontentdev's existing actors.

## 9. Data model additions (`samagra.db`)

Additive only; slice-1 catalog tables untouched.

- **`assignments`** — outbox index: `id, agent, outbox_path, pipeline, seed_ref, artifact_ref, expected_output, review_by, status, created_at, updated_at`.
- **`events`** — append-only audit ledger: `id, ts, actor (board agent / system), verb, assignment_id?, subsystem, subsystem_ref, note`. Mirrors mycontentdev `events` semantics so the two ledgers read alike.
- **`review_overlay`** — board approval of worker outputs: `id, subsystem, subsystem_ref, artifact_uid?, reviewer (board agent), verdict (approved|changes), rationale, ts`. References subsystem records; never copies content.

(New pipelines also require entries in the hardcoded `PIPELINES` dict in `state.py`, per §6c.)

## 10. Safety invariants (every phase)

- All subsystem reads are **read-only**; the **only** write is the board-approved `POST /api/seeds` in Phase 3.
- **Never** echo/log/commit secret *values*: `MUNSHI_SECRET`, the mcd **admin key** + **app password**, any `.env` / `mcd-cloud.json` content. Names only in docs.
- `pratyaksh` sims stay read-only; prefix any test entities `Testbot`; never mutate/dismiss/delete pre-existing munshi items when testing against prod.
- Workers never self-approve; every approval is recorded in `review_overlay` + `events` by a board agent.
- Honor subsystem locks (e.g. `TEXTBOOK_LOCK` pattern) — mirror, don't fight, another system's automation.
- Public-repo hygiene preserved through the rename.

## 11. Testing (pytest, slice-1 style — target green per phase)

- **Adapter tests** against fixture/mocked API responses (no live-prod dependency in CI): mcd query/pending JSON → `Artifact`s; munshi `library()` JSON → `Artifact`s; `available()` false when creds absent.
- **State/reflect tests:** mycontentdev seed-status → reflected phase status; idempotent re-reflect.
- **Assignments state-machine tests:** legal/illegal transitions; `events` append on each.
- **Codex hook unit test:** findings with a `CRITICAL` → non-zero exit; empty findings → zero; Codex-unavailable → non-zero (fail-closed). Mock the dispatch helper.
- **Bridge dry-run test:** munshi item → proposed seed payload (+ resolved pointers) **without** writing; classification heuristics.

## 12. Open items / risks to confirm during implementation

1. **Capture auth = app password.** SAMAGRA must hold the mcd **app password** (not just the admin key) to create seeds. Confirm the owner is comfortable storing it in SAMAGRA's gitignored `.env`. *(Mitigation: the write is board-gated and rare.)*
2. **munshi auth is a cookie, not a header.** The adapter must send `Cookie: munshi=<MUNSHI_SECRET>`; simplest is to drive the existing `MunshiClient` (which already does this) rather than re-implement.
3. **Codex pre-commit latency.** 900s default is far too long for a hook; spec sets ~90s. If real reviews exceed that, revisit (smaller diff scope, or stage-only critical files).
4. **Fail-closed wedge risk.** With no escape hatch, a broken `codex` on PATH blocks all commits. Diagnostics must be loud; document the restore path in the repo README. *(Owner accepted this trade-off.)*
5. **`PIPELINES` is hardcoded** in `state.py` — new pipelines are code edits, not config; keep them minimal.
6. **`tracker.txt` / `events` growth** — append-only, no rotation today; fine for now, note for later.

## 13. Out of scope (future slices)

- Autonomous worker dispatch (Codex/Gemini/NotebookLM/Grok actually executing assignments) — this slice only *routes* via the outbox.
- A read-only export route added to munshi (rejected in favor of `library()` reuse).
- Deploying SAMAGRA online (slice-1's "Slice 2" note).

## 14. Verified pointers (file:line)

| Contract | Where |
|---|---|
| mcd capture | `mycontentdev/functions/api/seeds/index.js`; revision #1 immutable `functions/api/_lib/repo.js:207` |
| mcd admin read | `functions/api/admin/{query,pending}.js`; auth `functions/api/_lib/auth.js:21`; `x-mcd-admin` |
| munshi read | `myProd/stress/driver.mjs:146` `library()`; auth `myProd/src/index.ts:18`; `MUNSHI_SECRET` |
| adapter contract | `TeachingOS/teachingos/adapters/{__init__.py,base.py}`; `ALL_ADAPTERS` |
| reflect pattern | `teachingos/scheduler.py` `_reflect_textbook`; `teachingos/state.py` `PIPELINES`, `set_phase` |
| rename surface | `config.py` (`DATA_DB`, `STATE_DIR`), `scheduler.py:22` (`TASK_NAME`), `pyproject.toml` scripts |
| Codex dispatch | `claude-booklet-proofer/scripts/codex_dispatch.py`; severity enum in `schemas/proofread.json:50` |
| portal tab | `teachingos/api/app.py`; `portal/templates/portal.html`; `portal/static/app.js` `TABS` |

---

*Design approved 2026-06-19. Next: `writing-plans` → one phased SAMAGRA implementation plan → `/record-plan`.*
