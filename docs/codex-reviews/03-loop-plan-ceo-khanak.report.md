# SAMAGRA Phase 1 Loop Plan

Basis: read-only inspection of `C:\SandBox\claude_box\TeachingOS`, `STATUS.html`, `CLAUDE.md`, and `docs/superpowers/plans/2026-06-19-samagra-evolution.md`. Phase 0 is already complete. Phase 1 is next: read-only `mycontentdev` and `munshi` clients/adapters, `mycontentdev` pipeline state, and `_reflect_mycontentdev`. No live-prod HTTP is required or allowed for tests.

## 1. Responsibility Split

| Work class | Owner | Handoff |
|---|---|---|
| Test design | Codex defines the loop contract; Claude-Deepak gates it | Claude-Khanak writes the first failing test exactly inside the loop scope |
| Implementation | Claude-Khanak | Returns changed files, test evidence, and any deviations/blockers |
| Review | Claude-Deepak first; Codex for pre-merge architecture/code review | CEO reviews diff and reruns tests before dispatching next loop |
| Gates | Claude-Deepak | CEO decides loop accepted, changes requested, or blocked |
| Owner-gated git ops | Deepak final authority | Khanak does not push, merge, rename repos, spend, publish, or install external hooks |
| Architecture changes | Codex + Claude-Deepak | Khanak stops and asks if implementation needs contract changes |
| Merging | Deepak gates final merge/push; CEO prepares | Codex should be re-invoked before merge |

## 2. Loop Model

One Claude-Khanak loop is a single focused implementation session.

**Entry criteria**

- Work from the SAMAGRA repo root: `C:\SandBox\claude_box\TeachingOS`.
- Read `CLAUDE.md` and `docs/superpowers/plans/2026-06-19-samagra-evolution.md`.
- Previous loop is CEO-approved.
- Touch only files listed for the assigned loop.
- Do not write to `C:\SandBox\claude_box\mycontentdev` or `C:\SandBox\claude_box\myProd`.
- Do not read, print, or commit secret values from `.env`, `mcd-cloud.json`, `.dev.vars`, or similar files.

**TDD cycle**

1. Write the named failing test first.
2. Run the targeted pytest command and confirm the expected red failure.
3. Implement the minimum code to pass.
4. Run the targeted test green.
5. Refactor only inside loop scope.
6. Run the loop’s broader regression command.
7. Delete `.pytmp`; never stage `.pytmp` or `.pytest_cache`.

Use Windows pytest form:

```powershell
.venv\Scripts\python -m pytest <test-target> -q --basetemp=.pytmp
Remove-Item -Recurse -Force .pytmp -ErrorAction SilentlyContinue
```

**Definition of done**

- Tests are green.
- All HTTP is mocked in tests.
- No live-prod calls.
- No subsystem source-dir writes.
- No secret values in output or diff.
- Only loop-scoped files changed.
- Khanak returns a concise handback report.

**CEO between-loops loop**

1. Inspect `git diff --stat` and changed files.
2. Rerun the loop test command and any listed regression command.
3. Check that `.pytmp`, `.pytest_cache`, secrets, and unrelated files are not staged.
4. Accept or request changes.
5. Dispatch the next loop only after the gate passes.

## 3. Phase 1 Loop Backlog

### P1-01 - `McdClient` and `samagra.clients` Skeleton

**Goal:** Add the mycontentdev HTTP client with mocked tests only.

**Files:** create `samagra/clients/__init__.py`, `samagra/clients/mcd_client.py`; create `tests/test_clients.py`.

**Failing test first:** `test_mcd_query_posts_with_admin_header`. It monkeypatches `samagra.clients.mcd_client.requests` with a fake transport and asserts `POST /api/admin/query`, header `x-mcd-admin`, and body `{"sql": ...}`. Also include tests for `available`, `pending`, `create_seed` fake-call shape, URL slash trimming, and secret-free `repr`.

**Implementation outline:** Load config from env or `config.CLAUDE_BOX / "mycontentdev" / "mcd-cloud.json"` through a helper that tests can monkeypatch. Implement `query`, `pending`, `create_seed`, `available`, and redacted `__repr__`. `create_seed` is built for Phase 3 only and must only be tested with fake HTTP.

**Done:** `pytest tests/test_clients.py -k mcd -q --basetemp=.pytmp` passes; no live HTTP; no secret file output.

**Handback:** CEO reviews the client API, key redaction, and fake transport assertions.

**Dependencies:** none.

### P1-02 - `MunshiClient`

**Goal:** Add the munshi read-only library client.

**Files:** create `samagra/clients/munshi_client.py`; modify `samagra/clients/__init__.py`; extend `tests/test_clients.py`.

**Failing test first:** `test_munshi_library_sends_cookie_header`. It fake-mocks `requests.get` and asserts `GET /api/library` with `Cookie: munshi=<urlencoded secret>`.

**Implementation outline:** Load `MUNSHI_API_URL` and `MUNSHI_SECRET` from env. Use `urllib.parse.quote(secret, safe="")`. Implement `available`, `library`, and redacted `__repr__`.

**Done:** `pytest tests/test_clients.py -q --basetemp=.pytmp` passes; no live HTTP.

**Handback:** CEO checks cookie encoding, env names, and secret redaction.

**Dependencies:** P1-01.

### P1-03 - `McdAdapter`

**Goal:** Normalize mycontentdev seed rows into common `Artifact` records.

**Files:** create `samagra/adapters/mcd.py`; create `tests/test_subsystem_adapters.py`.

**Failing test first:** `test_mcd_adapter_maps_row_to_artifact`. It injects `FakeMcdClient`, asserts `uid="mcd:<id>"`, `source="mycontentdev"`, seed `type` as `kind`, `status`, URL, `updated_at`, and `meta={"seedId": id}`.

**Implementation outline:** Implement `McdAdapter(Adapter)` with `name="mycontentdev"`, `label="Editorial (mycontentdev)"`, delegated `available`, and `_SEED_SQL = SELECT id,type,title,status,created_at,updated_at FROM seeds WHERE status != 'archived'`.

**Done:** `pytest tests/test_subsystem_adapters.py -k mcd -q --basetemp=.pytmp` passes; fake client only.

**Handback:** CEO reviews exact SQL, artifact field mapping, and no archived rows.

**Dependencies:** P1-01.

### P1-04 - `MunshiAdapter`

**Goal:** Normalize munshi library items into common `Artifact` records.

**Files:** create `samagra/adapters/munshi.py`; extend `tests/test_subsystem_adapters.py`.

**Failing test first:** `test_munshi_adapter_maps_item_to_artifact`. It injects `FakeMunshiClient`, asserts `uid="munshi:<id>"`, `source="munshi"`, item `kind`, title from payload text, `status`, `updated_at=ts`, and `meta={payload,tags,person,due}`.

**Implementation outline:** Implement `MunshiAdapter(Adapter)` with `name="munshi"`, `label="Front Desk (munshi)"`, delegated `available`, skip `status=="dismissed"`, and `_title_from(item)` using first payload text line or kind fallback.

**Done:** `pytest tests/test_subsystem_adapters.py -k munshi -q --basetemp=.pytmp` passes; fake client only.

**Handback:** CEO reviews dismissed filtering and title fallback behavior.

**Dependencies:** P1-02.

### P1-05 - Register Both Adapters

**Goal:** Make catalog discovery see `mycontentdev` and `munshi`.

**Files:** modify `samagra/adapters/__init__.py`; extend `tests/test_subsystem_adapters.py`.

**Failing test first:** `test_subsystem_adapters_registered`. It asserts both names are in `ALL_ADAPTERS` and `get_adapter("mycontentdev")` / `get_adapter("munshi")` return the new adapter classes.

**Implementation outline:** Import `McdAdapter` and `MunshiAdapter`, append instances to `ALL_ADAPTERS`, and keep existing adapter order stable except the new tail entries.

**Done:** `pytest tests/test_subsystem_adapters.py tests/test_spine.py -q --basetemp=.pytmp` passes; registration test does not call live HTTP.

**Handback:** CEO checks missing credentials degrade through `available()` and do not break existing spine tests.

**Dependencies:** P1-03, P1-04.

### P1-06 - `mycontentdev` Pipeline

**Goal:** Add the reflected editorial pipeline to `state.PIPELINES`.

**Files:** create `tests/test_reflect_mycontentdev.py`; modify `samagra/state.py`.

**Failing test first:** `test_mycontentdev_pipeline_registered`. It asserts phases `["capture","enrich","review","publish"]`, owners `human/claude2/claude1/human`, gates `review/publish`, and no `munshi` pipeline.

**Implementation outline:** Add one `"mycontentdev"` entry to the hardcoded `PIPELINES` dict. Do not add a `munshi` pipeline; munshi is intake-only.

**Done:** `pytest tests/test_reflect_mycontentdev.py -k pipeline -q --basetemp=.pytmp` passes.

**Handback:** CEO checks owner names and gate placement before scheduler work.

**Dependencies:** none.

### P1-07 - `_reflect_mycontentdev`

**Goal:** Reflect mycontentdev seed statuses into the new pipeline state.

**Files:** modify `samagra/scheduler.py`; extend `tests/test_reflect_mycontentdev.py`.

**Failing test first:** `test_reflect_review_gate_ready_when_draft_ready`. It injects `FakeMcdClient`, calls `_reflect_mycontentdev(dry=False, events=..., client=fake)`, and asserts review phase becomes `awaiting_gate` plus a `gate-ready` event. Also write tests for missing-creds no-op, all-done publish, and dry-run no mutation.

**Implementation outline:** Import `clients`, add `_mcd_status_counts(client)`, add `_reflect_mycontentdev(dry, events, client=None)`. Missing creds returns `{"skipped": "no mcd creds"}`. Any `draft_ready` or `changes_requested` sets review gate ready. All seeds `done` sets publish done. Dry run appends events but does not write state.

**Done:** `pytest tests/test_reflect_mycontentdev.py -q --basetemp=.pytmp` and then full `pytest -q --basetemp=.pytmp` pass.

**Handback:** CEO reviews dry-run behavior, missing-creds behavior, and status mapping. CEO decides separately whether to wire this helper into `tick()` now or keep the plan’s function-only scope.

**Dependencies:** P1-01, P1-06.

## 4. Khanak Loop Prompt Template

```markdown
You are Claude-Khanak, COO/CCO of SAMAGRA. Execute exactly one implementation loop in a fresh Claude Code session.

Repo: C:\SandBox\claude_box\TeachingOS
Loop ID: <P1-XX>
Loop title: <TITLE>

Role split:
- Claude-Deepak is CEO and gate owner.
- You are the hands-on executor for this loop only.
- Deepak is the owner-gated authority for pushes, merges, repo renames, spending, and external publishing.
- Stop before any owner-gated operation.

Read first:
- CLAUDE.md
- docs/superpowers/plans/2026-06-19-samagra-evolution.md, Phase 1 shared contracts

Scope:
- Goal: <GOAL>
- Files allowed to touch: <FILES>
- Files/directories not allowed: everything else, especially C:\SandBox\claude_box\mycontentdev and C:\SandBox\claude_box\myProd.

TDD discipline:
1. Write this failing test FIRST: <TEST NAME AND ASSERTION>
2. Run it and confirm the expected red failure.
3. Implement the minimum code.
4. Run the targeted green test.
5. Run the listed regression test.

Guardrails:
- All HTTP must be mocked/faked in tests. No live-prod calls.
- Do not read, print, or commit secret values from .env, mcd-cloud.json, .dev.vars, or similar files.
- Do not write to subsystem source directories.
- Do not push, merge, rename repos, install hooks, publish externally, or spend money.
- Do not create local commits unless the CEO explicitly added COMMIT_ALLOWED=true to this prompt.

Windows pytest:
- Use --basetemp=.pytmp on every pytest command.
- Delete .pytmp before handback:
  Remove-Item -Recurse -Force .pytmp -ErrorAction SilentlyContinue
- Never stage .pytmp or .pytest_cache.

Commands:
- Red: .venv\Scripts\python -m pytest <RED_TARGET> -q --basetemp=.pytmp
- Green: .venv\Scripts\python -m pytest <GREEN_TARGET> -q --basetemp=.pytmp
- Regression: .venv\Scripts\python -m pytest <REGRESSION_TARGET> -q --basetemp=.pytmp

Done report to CEO:
- Loop ID:
- Files changed:
- First failing test written:
- Red result:
- Green/regression result:
- Confirmation: no live HTTP, no subsystem writes, no secret values printed/committed, .pytmp removed:
- Diff summary:
- Deviations or blockers:
```

## 5. Sequencing, Parallelism, and Phase 2 Path

Recommended default is serial execution: P1-01 -> P1-02 -> P1-03 -> P1-04 -> P1-05 -> P1-06 -> P1-07. This minimizes conflicts in shared test files and adapter registry.

Safe parallelism is limited:

- P1-06 can run in parallel with P1-01 through P1-05 because it touches only `state.py` and `tests/test_reflect_mycontentdev.py`.
- P1-03 and P1-04 are conceptually parallel after their client loops, but they both touch `tests/test_subsystem_adapters.py`; run serial unless CEO uses separate worktrees and accepts merge conflict resolution.
- P1-05 must wait for P1-03 and P1-04.
- P1-07 must wait for P1-01 and P1-06.

CEO gates are required after every loop. After P1-07, CEO should run the full suite with `.venv\Scripts\python -m pytest -q --basetemp=.pytmp`, inspect the diff, update `STATUS.html` for Phase 1 status, and re-invoke Codex for pre-merge review before any merge/push.

Phase 2 starts only after Phase 1 is green and reviewed. The first Phase 2 dispatch should be the governance store loop (`samagra/governance/store.py` plus `assignments`, `events`, `review_overlay` tests), followed by Assignments API/tab, Codex pre-commit hook, worktree setup, and org SVG/status update. Codex should be re-invoked again before installing/enforcing the blocking pre-commit hook.