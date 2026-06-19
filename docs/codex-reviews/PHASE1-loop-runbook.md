# SAMAGRA — Phase 1 Loop Runbook (CEO ↔ Claude-Khanak)

> **Author:** Claude-Deepak (CEO), reconciling three Codex (Chief Architect) reviews
> dated 2026-06-19. Raw reports live beside this file:
> [`01-adversarial-code-review.report.md`](01-adversarial-code-review.report.md) ·
> [`02-vision-architecture-review.report.md`](02-vision-architecture-review.report.md) ·
> [`03-loop-plan-ceo-khanak.report.md`](03-loop-plan-ceo-khanak.report.md).
>
> **This runbook is the source of truth for execution.** Where it disagrees with
> agent 3's draft loop plan, this document wins (the deltas are decisions D1–D8 below).

---

## 0. Reconciled decisions (CEO calls)

| # | Decision | Why | Source |
|---|----------|-----|--------|
| **D1** | **Stabilize before build.** Insert a fix-first track (S-loops) and finish the *foundational* ones (S-01, S-02, S-03) before the Phase-1 build loops that depend on them. | Phase-1 loops add tests + a state-writing reflect helper on top of a test suite that overwrites the real DB and a non-atomic state/lock layer. Build-on-rot otherwise. | A1 F-06/F-07/F-14; A2 |
| **D2** | **`McdClient` ships READ-ONLY in Phase 1. `create_seed` is DEFERRED to Phase 3.** | A "read-only phase" must not ship a write method into prod-adjacent code before governance + idempotency exist. Enforces the read-only boundary architecturally, not by convention. | A2 (overrides A3 P1-01) |
| **D3** | **MunshiAdapter stores refs/excerpts/hashes only — NOT full `payload`/`person`.** | Copying sensitive operational data into `samagra.db` is duplication, not reflection. Store stable id, kind, status, ts, short safe title, hash; fetch detail live when needed. | A2 (amends A3 P1-04) |
| **D4** | **Refresh must preserve last-known-good** when an adapter is offline/failing (don't delete-first-then-commit-partial). Land S-05 before registering the HTTP adapters (P1-05). | mcd/munshi are HTTP-backed and can be down; a failed refresh must not erase catalog visibility. | A1 F-09; A2 |
| **D5** | **Phase-2 Codex pre-commit hook = advisory-local + enforced-CI.** Block only *confirmed CRITICAL*, cache by staged-diff hash, **audited break-glass** (`SAMAGRA_REVIEW_BREAKGLASS="<reason>"`, logged). Real enforcement = CI / branch protection (Chairman-gated). No silent fail-closed, no "no escape hatch." | Local hooks are `--no-verify`-bypassable anyway; fail-closed-on-Codex-offline wedges all commits. | A1 #1; A2 §Over/Under |
| **D6** | **Split the DB in Phase 2:** `catalog.db` (rebuildable) vs `governance.db` (durable assignments/events/reviews), with `schema_version` + migrations + backup/restore. Never delete the DB as a "catalog reset." | `samagra.db` currently mixes rebuildable index with irreplaceable governance state. | A2 |
| **D7** | **Phase-3 submit is idempotent + transactional.** Deterministic key `munshi_item_id + payload_hash`; single remote seed per approved assignment; retry-safe event recording. | Repeated scan/submit otherwise creates duplicate seeds. | A2 |
| **D8** | **Org metaphor = permission labels + operating language only.** It must not drive schema, table names, or branch structure. | Keeps complexity out of the data model for a single-operator local tool. | A2 |

---

## 1. Responsibility split — CEO vs Claude-Khanak

| Work class | Owner | Handoff |
|---|---|---|
| Reconcile reviews, decide loop contracts & sequencing | **CEO (Claude-Deepak)** | Produces the rendered loop prompt below |
| Render the paste-ready loop prompt | **CEO** | Hands one loop at a time to Khanak |
| Implement the loop (TDD red→green→refactor) | **Khanak (COO/CCO)** | Returns the done-report (§4) |
| Review diff, rerun tests, gate accept/reject | **CEO** | Dispatches next loop only after gate passes |
| Pre-merge architecture/security review | **Codex (Chief Architect)** | CEO re-invokes Codex before any merge |
| Owner-gated git ops — push, merge, repo rename, **hook install**, spend, publish | **Deepak (Chairman)** — final authority | Khanak STOPS and escalates; never performs these |
| Update `STATUS.html` / `HANDOFF.md` after a gate | **CEO** | Khanak only reports facts |

**Khanak never:** pushes, merges, renames repos, installs hooks, publishes, spends,
writes to `C:\SandBox\claude_box\mycontentdev` or `…\myProd`, prints/commits secrets,
or commits at all unless the CEO put `COMMIT_ALLOWED=true` in the prompt.

---

## 2. The loop model

**One Khanak loop = one focused session implementing one loop ID.**

Entry → read `CLAUDE.md` + the Phase-1 shared contracts in the plan; confirm the
previous loop is CEO-approved; touch only the loop's allow-listed files.

TDD cycle → (1) write the named failing test FIRST; (2) run it, confirm the expected
red; (3) minimum code to green; (4) green; (5) refactor in-scope only; (6) run the
regression target; (7) delete `.pytmp`, never stage `.pytmp`/`.pytest_cache`.

Definition of done → tests green · all HTTP mocked · no live-prod calls · no source-dir
writes · no secrets in output/diff · only allow-listed files changed · done-report returned.

**CEO between-loops loop →** `git diff --stat` + read changed files → rerun the loop
test + regression → verify `.pytmp`/`.pytest_cache`/secrets/unrelated files not staged
→ accept or request-changes → dispatch next only after the gate passes.

Windows pytest form (every command):
```powershell
.venv\Scripts\python -m pytest <target> -q --basetemp=.pytmp
Remove-Item -Recurse -Force .pytmp -ErrorAction SilentlyContinue
```

---

## 3. Unified loop backlog

Three tracks. **Track A (Stabilize)** is fix-first; **Track B (Build)** is Phase-1
proper; **Track C (Harden)** is the HTTP trust boundary and can run in parallel on a
second Khanak instance (mostly disjoint files — one coordination point noted).

### Track A — Stabilize (do A's foundational loops first)

| ID | Title | Fixes | Files | Failing test first | Dep |
|----|-------|-------|-------|--------------------|-----|
| **S-01** | Test-harness isolation | F-14 | `tests/conftest.py` (new) | `test_refresh_does_not_touch_real_db` — autouse fixture monkeypatches `config.DATA_DB`→`tmp_path/"samagra.db"`; assert real `DATA_DB` mtime unchanged after `refresh()` | — |
| **S-02** | Atomic state writes + state lock | F-07 | `samagra/state.py`, `tests/test_state_atomic.py` | `test_save_is_atomic_and_locked` — `save()` writes via temp + `os.replace` under `.state.lock`; `all_states()`/`load()` GET-path performs no write | S-01 |
| **S-03** | Atomic scheduler lock | F-06 | `samagra/lock.py`, `tests/test_lock.py` | `test_exclusive_acquire_rejects_second_holder` — `O_CREAT\|O_EXCL` acquire; second holder fails; stale removal guarded | S-01 |
| **S-04** | Gate prerequisite enforcement | F-02 | `samagra/scheduler.py`, `samagra/api/app.py`, `tests/test_scheduler.py` | `test_gate_rejects_when_prereqs_incomplete` — `gate()` acts only on `awaiting_gate` AND all prior phases `done`; API returns **409** | S-01, S-02 |
| **S-05** | Refresh safety / last-known-good | F-09 | `samagra/catalog.py`, `tests/test_catalog_refresh_safety.py` | `test_failed_adapter_preserves_previous_catalog` — stage per-adapter, rollback failed rows, never commit an empty/partial catalog over a good one | S-01 |

### Track B — Phase-1 build (agent 3's loops, amended by D2/D3/D4)

| ID | Title | Files | Failing test first | Dep |
|----|-------|-------|--------------------|-----|
| **P1-01** | `McdClient` (**read-only**, no `create_seed`) | `samagra/clients/__init__.py`, `…/mcd_client.py`, `tests/test_clients.py` | `test_mcd_query_posts_with_admin_header` — fake transport; asserts `POST /api/admin/query`, header `x-mcd-admin`, body `{"sql":…}`; + `available`, `pending`, URL-slash trim, **secret-free `__repr__`**. **No `create_seed` (D2).** | S-01 |
| **P1-02** | `MunshiClient` (read-only) | `…/munshi_client.py`, `clients/__init__.py`, `tests/test_clients.py` | `test_munshi_library_sends_cookie_header` — `GET /api/library`, `Cookie: munshi=<urlencoded secret>`; redacted repr | P1-01, S-01 |
| **P1-03** | `McdAdapter` | `samagra/adapters/mcd.py`, `tests/test_subsystem_adapters.py` | `test_mcd_adapter_maps_row_to_artifact` — `uid="mcd:<id>"`, `source="mycontentdev"`, kind/status/url/updated_at, `meta={"seedId":id}`; excludes archived | P1-01 |
| **P1-04** | `MunshiAdapter` (**refs/excerpt/hash only**, D3) | `samagra/adapters/munshi.py`, `tests/test_subsystem_adapters.py` | `test_munshi_adapter_maps_item_to_artifact` — `uid="munshi:<id>"`, `source="munshi"`, kind, title-from-payload, status, updated_at; `meta` holds **id/kind/status/ts/safe-title/hash**, NOT full payload/person; skips `dismissed` | P1-02 |
| **P1-05** | Register both adapters (degrade on missing creds) | `samagra/adapters/__init__.py`, `tests/test_subsystem_adapters.py` | `test_subsystem_adapters_registered` — both in `ALL_ADAPTERS`; `get_adapter()` returns them; missing creds degrade via `available()` and don't break spine or erase catalog | P1-03, P1-04, **S-05** |
| **P1-06** | `mycontentdev` pipeline | `samagra/state.py`, `tests/test_reflect_mycontentdev.py` | `test_mycontentdev_pipeline_registered` — phases `[capture,enrich,review,publish]`, owners `human/claude2/claude1/human`, gates `review/publish`; **no `munshi` pipeline** (intake-only) | S-02 |
| **P1-07** | `_reflect_mycontentdev` | `samagra/scheduler.py`, `tests/test_reflect_mycontentdev.py` | `test_reflect_review_gate_ready_when_draft_ready` (+ missing-creds no-op, all-done publish, dry-run no-mutation) | P1-01, P1-06, **S-03** |

### Track C — Harden the HTTP trust boundary (parallel; gate before any non-localhost deploy)

| ID | Title | Fixes | Files | Note |
|----|-------|-------|-------|------|
| **H-01** | Admin-token auth on mutating routes + input caps | F-01, F-10 | `samagra/api/app.py` | `Depends(require_admin)` on refresh/tick/gate; `limit:int=Query(50,ge=1,le=500)` |
| **H-02** | Slug validation + path containment | F-05 | `samagra/lectures/render.py`, `…/export.py`, `samagra/scheduler.py` | **Coordinate with P1-07** (both touch `scheduler.py`) — serialize or worktree |
| **H-03** | Lecture + portal HTML sanitization + CSP | F-03 | `samagra/lectures/render.py`, `samagra/portal/static/app.js` | allow-list sanitize lecture HTML; `esc()` portal `meta`; restrictive CSP |
| **H-04** | `/open` lockdown | F-04 | `samagra/api/app.py` | authorize catalog artifacts only; reject dotfiles/sensitive suffixes; HTML as attachment |

**Lower (opportunistic cleanup loop):** F-11 (drop `immutable=1`, keep `mode=ro`), F-12
(export-done must check thin+thick), F-13 (QX absolute paths so `/open` works).

### Sequencing

```
S-01 ──┬─ S-02 ─ S-04        (gate each)
       ├─ S-03
       └─ S-05
           │
   Phase-1 build (serial, gate each):
   P1-01 ─ P1-02 ─ P1-03 ─ P1-04 ─ P1-05 ─ P1-07
                    (P1-06 may run any time after S-02)

   Track C (second Khanak, parallel; H-02 serialized vs P1-07):
   H-01 · H-03 · H-04 · (H-02 after/around P1-07)

After Track A done + Phase-1 green → CEO re-invokes Codex for pre-merge review →
Chairman gates merge/push. Phase-2 (governance store, then Assignments, then the
redesigned pre-commit hook per D5/D6) starts only after that.
```

---

## 4. Khanak loop prompt — template

```markdown
You are Claude-Khanak, COO/CCO of SAMAGRA. Execute exactly ONE implementation loop
in this fresh session, then stop and report.

Repo: C:\SandBox\claude_box\TeachingOS
Loop ID: <ID>   Title: <TITLE>

Roles: Claude-Deepak is CEO + gate owner. Deepak (Chairman) owns push/merge/repo-
rename/hook-install/spend/publish. You implement only; STOP before any owner-gated op.

Read first: CLAUDE.md ; docs/superpowers/plans/2026-06-19-samagra-evolution.md (Phase-1
shared contracts) ; docs/codex-reviews/PHASE1-loop-runbook.md (this loop's row).

Scope:
- Goal: <GOAL>
- Touch ONLY: <FILES>
- Never touch: everything else, especially C:\SandBox\claude_box\mycontentdev and …\myProd.

TDD:
1. Write this failing test FIRST: <TEST NAME + ASSERTION>
2. Run it; confirm the expected RED.
3. Minimum code to green. 4. Green. 5. Refactor in-scope only. 6. Run regression: <TARGET>.

Guardrails:
- All HTTP mocked/faked; no live-prod calls.
- Do NOT read/print/commit secrets (.env, mcd-cloud.json, .dev.vars, MUNSHI_SECRET).
- No writes to subsystem source dirs. No push/merge/hook-install/publish/spend.
- Do NOT commit unless this prompt contains COMMIT_ALLOWED=true.

Windows pytest (every run): .venv\Scripts\python -m pytest <target> -q --basetemp=.pytmp
Then: Remove-Item -Recurse -Force .pytmp -ErrorAction SilentlyContinue   (never stage .pytmp)

Done-report back to CEO:
- Loop ID · Files changed · First failing test written · RED result · GREEN+regression result
- Confirm: no live HTTP / no source writes / no secrets printed-or-committed / .pytmp removed
- `git diff --stat` summary · Deviations or blockers
```

---

## 5. Rendered prompts — the first three loops (paste-ready)

### ▶ S-01 — Test-harness isolation  *(run this first)*

```markdown
You are Claude-Khanak, COO/CCO of SAMAGRA. Execute exactly ONE implementation loop, then stop and report.

Repo: C:\SandBox\claude_box\TeachingOS
Loop ID: S-01   Title: Test-harness isolation

Roles: Claude-Deepak is CEO + gate owner. Deepak (Chairman) owns push/merge/hook-install/spend/publish. Implement only; STOP before any owner-gated op.

Read first: CLAUDE.md ; docs/codex-reviews/PHASE1-loop-runbook.md (row S-01) ; docs/codex-reviews/01-adversarial-code-review.report.md (finding F-14).

Scope:
- Goal: Tests must never read or overwrite the real samagra.db. Provide an autouse fixture that redirects config.DATA_DB to a per-test temp DB, and prove the real DB is untouched.
- Touch ONLY: tests/conftest.py (new), and if strictly necessary tests/test_spine.py to use the fixture.
- Never touch: samagra/** production code, mycontentdev, myProd.

TDD:
1. Write this failing test FIRST (in tests/test_spine.py or a new tests/test_harness_isolation.py):
   test_refresh_does_not_touch_real_db — record the real config.DATA_DB path + its mtime (if it exists); within the test rely on the autouse conftest fixture that monkeypatches config.DATA_DB to tmp_path/"samagra.db"; call catalog.refresh(verbose=False); assert the temp DB now exists AND the real DATA_DB's mtime is unchanged (or still absent).
2. Run it; confirm RED (fixture not present yet → it writes the real DB / assertion fails).
3. Add tests/conftest.py: an autouse fixture (function scope) that uses monkeypatch to set samagra.config.DATA_DB = tmp_path/"samagra.db" for every test. Keep it minimal; do not alter production code.
4. Green. 5. No refactor needed beyond the fixture. 6. Regression: run the FULL suite.

Guardrails: all HTTP mocked; no secrets; no source-dir writes; no push/merge/commit. Do NOT commit (COMMIT_ALLOWED is not set).

Windows pytest (every run):
  .venv\Scripts\python -m pytest tests/test_spine.py -q --basetemp=.pytmp
  .venv\Scripts\python -m pytest -q --basetemp=.pytmp        # regression: all tests
  Remove-Item -Recurse -Force .pytmp -ErrorAction SilentlyContinue   (never stage .pytmp)

Done-report: Loop ID · files changed · first failing test + RED · GREEN+full-suite result · confirm real samagra.db untouched / .pytmp removed / nothing committed · git diff --stat · deviations.
```

### ▶ S-02 — Atomic state writes + state lock  *(after S-01 gate)*

```markdown
You are Claude-Khanak, COO/CCO of SAMAGRA. Execute exactly ONE implementation loop, then stop and report.

Repo: C:\SandBox\claude_box\TeachingOS
Loop ID: S-02   Title: Atomic state writes + state lock

Roles/guardrails: as S-01 (implement only; STOP before owner-gated ops; no secrets; no source writes; do NOT commit).

Read first: CLAUDE.md ; docs/codex-reviews/PHASE1-loop-runbook.md (row S-02) ; 01-adversarial-code-review.report.md (finding F-07) ; samagra/state.py ; samagra/lock.py.

Scope:
- Goal: state.save() must write atomically (temp file + os.replace) under a dedicated .state.lock, and read paths (load()/all_states()) must not write to disk as a side effect.
- Touch ONLY: samagra/state.py and tests/test_state_atomic.py (new). Reuse samagra/lock.py's file_lock; do NOT change lock.py in this loop (that's S-03).
- Never touch: anything else.

TDD:
1. Write this failing test FIRST: test_save_is_atomic_and_locked —
   (a) assert that after save(), no leftover *.tmp file remains and the JSON parses;
   (b) assert load()/all_states() on a missing pipeline returns a default WITHOUT creating/writing its JSON file (no GET-side write);
   (c) (best-effort) assert save() routes through os.replace (e.g. monkeypatch os.replace and assert it was called with a temp path → final path).
2. Run it; confirm RED.
3. Implement: write payload to path.with_suffix(path.suffix+'.tmp'), os.replace into place, all wrapped in file_lock(config.STATE_DIR/'.state.lock'); make read paths return defaults without saving.
4. Green. 5. Refactor in-scope. 6. Regression: tests/test_scheduler.py + tests/test_spine.py + the full suite.

Windows pytest (every run):
  .venv\Scripts\python -m pytest tests/test_state_atomic.py -q --basetemp=.pytmp
  .venv\Scripts\python -m pytest -q --basetemp=.pytmp
  Remove-Item -Recurse -Force .pytmp -ErrorAction SilentlyContinue

Done-report: as template §4.
```

### ▶ P1-01 — `McdClient` read-only  *(first BUILD loop; after Track-A foundational gates)*

```markdown
You are Claude-Khanak, COO/CCO of SAMAGRA. Execute exactly ONE implementation loop, then stop and report.

Repo: C:\SandBox\claude_box\TeachingOS
Loop ID: P1-01   Title: McdClient (READ-ONLY)

Roles/guardrails: as S-01 (implement only; STOP before owner-gated ops; no secrets printed/committed; no source writes; do NOT commit).

Read first: CLAUDE.md ; docs/superpowers/plans/2026-06-19-samagra-evolution.md (Phase-1 shared contracts: McdClient) ; docs/codex-reviews/PHASE1-loop-runbook.md (row P1-01 + decision D2) ; samagra/config.py ; samagra/adapters/base.py.

Scope:
- Goal: a read-only mycontentdev admin-API client with mocked tests only.
- DECISION D2: this client is READ-ONLY. Do NOT implement create_seed in this loop — it is deferred to Phase 3. Implement only: query(sql), pending(), available(), and a secret-free __repr__.
- Touch ONLY: samagra/clients/__init__.py (new), samagra/clients/mcd_client.py (new), tests/test_clients.py (new).
- Never touch: mycontentdev, myProd, any source dir; no live HTTP.

TDD:
1. Write this failing test FIRST: test_mcd_query_posts_with_admin_header —
   monkeypatch the client's HTTP transport with a fake; assert query("SELECT …") issues POST <base>/api/admin/query with header x-mcd-admin=<secret-from-monkeypatched-config> and JSON body {"sql": "SELECT …"}. Add: test_repr_is_secret_free (repr never contains the admin secret), test_base_url_slash_trimmed, test_available_false_when_no_creds.
2. Run; confirm RED.
3. Implement mcd_client.py: load base URL + admin secret via a tiny helper that tests monkeypatch (env first, then config.CLAUDE_BOX/'mycontentdev'/'mcd-cloud.json'); query/pending/available/__repr__ only. NO create_seed.
4. Green. 5. Refactor in-scope. 6. Regression: full suite.

Windows pytest:
  .venv\Scripts\python -m pytest tests/test_clients.py -q --basetemp=.pytmp
  .venv\Scripts\python -m pytest -q --basetemp=.pytmp
  Remove-Item -Recurse -Force .pytmp -ErrorAction SilentlyContinue

Done-report: as template §4, explicitly confirming create_seed was NOT added.
```

> Remaining loops (S-03, S-04, S-05, P1-02 … P1-07, H-01 … H-04) render from §4 +
> their §3 row. The CEO renders each just-in-time at dispatch so the latest gated
> state is baked in. Ask the CEO before starting any loop not yet rendered here.
