# SAMAGRA Evolution Implementation Plan

> **▶ PROGRESS (updated 2026-06-20):** **Phase 0 ✅ · Track A ✅ · Phase 1 ✅ · Phase 2 (governance) ✅ SHIPPED**
> — all merged + pushed to `origin/main`; suite **98/98 green**; advisory Codex hook active; agent worktrees created.
> **▶ Phase 3 (active loop) is now PARKED** (deprioritised, not cancelled — see the banner at the Phase 3
> heading below). On **2026-06-20** the owner re-prioritised the roadmap: the immediate next build is the
> **SAMAGRA OS Experience track** (the windowing GUI), which has its own spec + plan + division + loop scripts
> under `docs/superpowers/` (see [`plans/2026-06-20-samagra-os.md`](2026-06-20-samagra-os.md)). Phase 3's plan
> below is **complete and unchanged** and resumes once the Experience track (E1→) lands. Carried into Phase 3:
> refresh per-adapter isolation + stale visibility (F1/F4). Per-task checkboxes below are not individually
> ticked; the per-phase banners are the tracker of record.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the verified TeachingOS slice-1 spine into **SAMAGRA** — a company-structured **control plane** (not an "OS" — see spec §1) — by renaming the package, adding read-only `mycontentdev` + `munshi` adapters, standing up the governance layer (per-agent worktrees, prompt outbox, Assignments tab, blocking pre-commit Codex review), and wiring the board-approved `munshi → mycontentdev` capture loop.

**Architecture:** One phased plan over the existing Python + FastAPI control plane. **Phase 0** renames `teachingos → samagra`. **Phase 1** adds two read-only HTTP-client-backed adapters that *reflect* subsystem state into the unified catalog. **Phase 2** adds a `samagra.db` governance store, an Assignments portal tab, a vendored Codex pre-commit hook (blocking on confirmed-`CRITICAL` only, advisory-local + audited break-glass + enforced-CI per runbook D5/D9 — **not** fail-closed), per-agent git worktrees, and an org-chart SVG. **Phase 3** adds the classify → propose → board-approve → capture bridge. Each phase ends with a green `pytest` run before the next begins.

**Tech Stack:** Python 3.11 (`.venv`), FastAPI + Jinja/JS-SPA portal, SQLite/FTS5 (`samagra.db`), `pytest` (TDD), git worktrees + `core.hooksPath`, Codex CLI (`codex exec`), Cloudflare-hosted `mycontentdev` (D1/R2) + `munshi` (Worker) read over HTTP.

**Spec:** [`docs/superpowers/specs/2026-06-19-samagra-evolution-design.md`](../specs/2026-06-19-samagra-evolution-design.md) — read it first; §12 lists implementation risks. Integration contracts were verified read-only against the live repos on 2026-06-19.

---

## Shared Contracts — single source of truth for names

Every task below uses these verbatim. Do not invent alternative names.

**Package & DB (post Phase 0):** package `samagra/` (was `teachingos/`); console entry `samagra.__main__:main`; catalog DB `samagra.db` (`config.DATA_DB`); state dir `state/`; Windows task `SAMAGRA-tick`. Run tests with `.venv\Scripts\python -m pytest` from the repo root (PYTHONPATH = repo root).

**Adapter contract (existing slice-1):** subclass `samagra.adapters.base.Adapter` — `name:str`, `label:str`, `available()->bool`, `summary()->dict`, `artifacts()->Iterator[Artifact]`. `Artifact` fields (exact order): `uid, source, kind, title, subject, unit, chapter, status, path, url, updated_at, meta` (`meta` is a dict, serialized inline by `Artifact.row()`). Register adapters in `samagra/adapters/__init__.py` → `ALL_ADAPTERS`.

**HTTP clients (`samagra/clients/`):**
- `McdClient(api_url=None, admin_key=None, app_key=None)` — **Phase-1 surface is READ-ONLY:** `query(sql)->list[dict]` (`POST /api/admin/query`, header `x-mcd-admin`, body `{"sql":...}`); `pending()->list[dict]` (`GET /api/admin/pending`, `x-mcd-admin`); `available()->bool`; secret-free `__repr__`. **`create_seed(payload)` is NOT built or tested in Phase 1 — DEFERRED to Phase 3 per runbook D2/D9** (a read-only phase must not ship a write method into prod-adjacent code before governance + idempotency D7 exist). This supersedes the earlier "built now, used only in Phase 3" note and the `test_mcd_create_seed_posts_with_app_key` test in Task 1.2 below, both of which predate D2. Loads `mcd-cloud.json` `{apiUrl,adminKey}` or env `MCD_API_URL`/`MCD_ADMIN_KEY`/`MCD_APP_KEY`. Never logs key values.
- `MunshiClient(api_url=None, secret=None)` — `library()->dict` (`GET /api/library`, header `Cookie: munshi=<urlencoded secret>`, returns `{"people":[...],"total":int,"items":[...]}`); `available()->bool`. Env `MUNSHI_API_URL`/`MUNSHI_SECRET`. Never logs the secret.

**Adapters:** `samagra/adapters/mcd.py` → `McdAdapter(Adapter)` (`name="mycontentdev"`); `samagra/adapters/munshi.py` → `MunshiAdapter(Adapter)` (`name="munshi"`). Seed `type` ∈ {concept, question, snippet, simulation_idea, experiment, notebooklm_link, rough_idea}; seed `status` ∈ {captured, needs_processing, processing, draft_ready, changes_requested, approved, brief_generated, content_linked, done, archived}. munshi `item.kind` ∈ {note, todo, issue, question, followup}; `item.status` ∈ {open, claimed_done, validated, dismissed}.

**State/reflect:** add a `"mycontentdev"` pipeline to the hardcoded `PIPELINES` dict in `samagra/state.py` (phases `["capture","enrich","review","publish"]`, owners `["human","claude2","claude1","human"]`); add `samagra/scheduler.py::_reflect_mycontentdev(dry, events)` mirroring `_reflect_textbook` (missing-creds → no-op).

**Governance store (`samagra/governance/store.py`, in `samagra.db`):** `init_tables(conn)` creates `assignments`, `events`, `review_overlay` (DDL in Phase 2). Functions: `add_assignment(conn, *, id, agent, outbox_path, pipeline=None, seed_ref=None, artifact_ref=None, expected_output=None, review_by=None)`; `set_assignment_status(conn, assignment_id, status)` (status ∈ queued|running|in-review|approved|changes; appends an event); `append_event(conn, *, actor, verb, assignment_id=None, subsystem=None, subsystem_ref=None, note=None)`; `add_review(conn, *, subsystem, subsystem_ref, reviewer, verdict, artifact_uid=None, rationale=None)` (verdict ∈ approved|changes); `list_assignments(conn)->list[dict]`; `list_events(conn, limit=200)->list[dict]`.

**Assignments tab:** `GET /api/assignments` in `samagra/api/app.py` → `{"assignments":[...],"events":[...]}`; nav link `data-tab="assignments"` in `portal/templates/portal.html`; `renderAssignments()` + `TABS.assignments` in `portal/static/app.js` (reuse `jget`/`esc`/`activate`).

**Codex hook:** vendor `samagra/review/codex_dispatch.py` → `dispatch_codex(prompt, *, schema=None, timeout_s=90, max_attempts=2) -> CodexResult(parsed, raw, elapsed_s, attempts)`; invocation `codex exec --ephemeral --skip-git-repo-check --sandbox read-only --output-last-message <tmp.json> --color never -` (prompt on stdin; exe via `shutil.which("codex")`/`CODEX_BIN`). `samagra/review/precommit.py` → `get_staged_diff()`, `review_staged_diff()->int` (block with exit 1 iff a *confirmed* `CRITICAL` finding survives the staged-diff-hash cache; empty/HIGH-MED-LOW → 0; **advisory-local per D5/D9** — Codex unavailable/timeout does NOT wedge commits, audited break-glass `SAMAGRA_REVIEW_BREAKGLASS`, real enforcement in CI/branch-protection; **not** fail-closed). `.githooks/pre-commit` → `exec python -m samagra.review.precommit`; install via `git config core.hooksPath .githooks` (shared by all worktrees). CLI verb `samagra review-staged`.

**Bridge (`samagra/bridge/`):** `classify.py::classify_item(item)->"content"|"ops"`; `pointers.py::resolve_pointers(text, *, limit=5)->list[{uid,source,kind,title}]` (catalog FTS5); `seed_payload.py::build_seed_payload(item, pointers)->dict` (the `POST /api/seeds` body with `detail.pointers`); `run.py::scan(dry=True)->list[dict]` (proposes + records `in-review` assignments, **never writes a seed**) and `run.py::submit(assignment_id)->dict` (refuses unless assignment `status=="approved"`, then `McdClient.create_seed` + `append_event`). CLI: `samagra bridge scan [--dry-run]`, `samagra bridge submit <assignmentId>`.

**Safety (all phases):** reads are read-only; the **only** subsystem write is `McdClient.create_seed` in Phase 3 (board-approved). Never echo/log/commit secret *values*. Tests **mock** the HTTP clients — no live-prod calls in CI.

**Schema-freeze rule (Phase 1).** An aspiration may be NAMED in prose but may NOT add a field, status value, or workflow step to the Phase-1 data model. Declaring an empty/optional column or a dormant prose goal is free; POPULATING it, constraining it NOT-NULL, or adding a status/step that reads it is a later-phase build. Every dormant aspiration carries an explicit "dormant until Phase N" tag; new tables remain additive. Audit before merging any Phase-1 task: does this diff add a field/status/step a named-but-dormant aspiration would have needed? If yes, it is out of Phase-1 scope. **Dormant register:** `concept_id` (Phase 2), concept vocabulary (Phase 2), autonomy ratchet (post-Phase-1), decision-ledger mining (later), coverage scoreboard + demand compass (Phase 2+), pre-approval valve (later). See runbook D11.

---

## Phase 0 — Rename `teachingos` → `samagra`

> **✅ COMPLETE (2026-06-19)** — repo + package renamed `samagra`, `samagra.db` rebuilt to 7,044 artifacts, merged to `main`.

This phase merges the slice-1 PR, renames the GitHub repo, renames the Python package `teachingos/` → `samagra/`, and updates every identifier (imports, console script, `DATA_DB`, `TASK_NAME`, `TEACHINGOS_*` env keys) and the docs. It is **OPS/VERIFICATION-driven**, not test-first — every code edit is a mechanical find/replace verified by `grep` + a green pytest run + a catalog rebuild, not red-green TDD. The engineer has zero context: run every command from the repo root `C:\SandBox\claude_box\TeachingOS` using the project venv `.venv\Scripts\python`, on Windows PowerShell unless a step says Git-Bash.

**Files:**
- **Modify** `pyproject.toml` — project name, `[project.scripts]` console entry, and `packages.find` include glob: `teachingos` → `samagra`.
- **Rename + Modify** `teachingos/` → `samagra/` (whole package dir via `git mv`); fix the few internal identifiers that literally say `teachingos`.
- **Modify** `samagra/__init__.py` — docstring identity.
- **Modify** `samagra/config.py` — `DATA_DB` filename `teachingos.db` → `samagra.db`; rename all `TEACHINGOS_*` env keys → `SAMAGRA_*`.
- **Modify** `samagra/scheduler.py` — `TASK_NAME = "TeachingOS-tick"` → `"SAMAGRA-tick"`.
- **Modify** `samagra/__main__.py` — `prog=`, the `python -m teachingos` help string, and the `uvicorn.run("teachingos.api.app:app", …)` import string.
- **Modify** `samagra/api/app.py` — `import teachingos` → `import samagra`, the two `teachingos.__version__` refs, and `title="TeachingOS"`.
- **Modify** `samagra/catalog.py` — docstring mentioning `teachingos.db`.
- **Modify** `tests/test_spine.py`, `tests/test_lectures.py`, `tests/test_scheduler.py` — `from teachingos…` imports → `from samagra…`.
- **Modify** `scripts/tos_tick.cmd` — `-m teachingos tick` → `-m samagra tick`; comment.
- **Modify** `.env.example`, `config.example`, `requirements.txt`, `README.md`, `.claude/launch.json` — identity + `TEACHINGOS_*`/`teachingos` strings.
- **Modify** `HANDOFF.md`, `STATUS.html` — SAMAGRA identity (light touch in this phase).

> **Scope note (do NOT change):** the literal strings `"teachingos"` used as a phase *owner role value* in `samagra/state.py` lines 22 and 34 (`"export": "teachingos"`, `"build": "teachingos"`) are an org-role identifier per spec §3, **not** a package reference. Leave them exactly as-is. Task 0.5 has a verification step proving they are the only surviving lowercase `teachingos` occurrences and that this is intentional.

---

### Task 0.1: Merge PR #1 and switch to main

**Files:** none (git/gh ops only).

These are GitHub operations, verified by command output — not tests.

- [ ] **Step 1: Confirm you are in the repo and see PR #1 is mergeable.**
```bash
cd /c/SandBox/claude_box/TeachingOS
gh pr view 1 --json number,state,mergeable,headRefName,baseRefName
```
Expected output contains `"state": "OPEN"`, `"mergeable": "MERGEABLE"`, `"headRefName": "slice-1"`, `"baseRefName": "main"`.

- [ ] **Step 2: Stash or commit the working-tree docs churn so the merge is clean.** The repo opened with `M HANDOFF.md` and untracked `SAMAGRA-HANDOFF.md`. Commit them on the `slice-1` branch first so nothing is lost.
```bash
cd /c/SandBox/claude_box/TeachingOS
git add HANDOFF.md SAMAGRA-HANDOFF.md
git commit -m "docs: SAMAGRA handoff + planning notes (pre-rename)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin slice-1
```
Expected: a commit is created and pushed; `git status` then prints `nothing to commit, working tree clean`.

- [ ] **Step 3: Squash-merge PR #1 into main.**
```bash
cd /c/SandBox/claude_box/TeachingOS
gh pr merge 1 --squash --delete-branch=false
```
Expected output: `✓ Squashed and merged pull request #1`.

- [ ] **Step 4: Switch to `main` and pull the merged state.**
```bash
cd /c/SandBox/claude_box/TeachingOS
git checkout main
git pull origin main
git log --oneline -1
```
Expected: now on `main`; the latest commit is the squashed slice-1 merge.

---

### Task 0.2: Rename the GitHub repo to `samagra`

**Files:** none (gh + git remote ops only).

GitHub rename + remote re-point, verified by `git remote -v` — not tests.

- [ ] **Step 1: Record the current remote URL** so you can confirm it changes.
```bash
cd /c/SandBox/claude_box/TeachingOS
git remote -v
```
Expected: two lines (`fetch`/`push`) ending in `…/TeachingOS.git` (or `/teachingos.git`). Note the owner (e.g. `dbhardwaj86`).

- [ ] **Step 2: Rename the repo on GitHub.**
```bash
cd /c/SandBox/claude_box/TeachingOS
gh repo rename samagra --yes
```
Expected output: `✓ Renamed repository <owner>/samagra`. (GitHub auto-redirects the old URL; `gh` updates the local `origin` automatically.)

- [ ] **Step 3: Verify the local `origin` now points at `samagra`.**
```bash
cd /c/SandBox/claude_box/TeachingOS
git remote -v
```
Expected: both lines now end in `…/samagra.git`. If they still say `TeachingOS`, re-point manually:
```bash
git remote set-url origin "https://github.com/<owner>/samagra.git"
git remote -v
```

- [ ] **Step 4: Confirm push/fetch still works against the renamed remote.**
```bash
cd /c/SandBox/claude_box/TeachingOS
git fetch origin
git status -sb
```
Expected: fetch succeeds with no auth error; status shows `## main...origin/main` up to date.

---

### Task 0.3: Rename the package directory and `pyproject.toml`

**Files:** `pyproject.toml` (Modify); `teachingos/` → `samagra/` (Rename).

Mechanical rename + edits, verified by `git status` and `python -c import` — not tests.

- [ ] **Step 1: Suggest a pre-work snapshot (owner-triggered, optional).** This is the high-churn step; before it, suggest the owner run `/snap-pre "samagra rename"`. Do not auto-run it. Then proceed.

- [ ] **Step 2: `git mv` the whole package directory** so Git tracks the rename and history follows.
```bash
cd /c/SandBox/claude_box/TeachingOS
git mv teachingos samagra
git status -s
```
Expected: a block of `R  teachingos/<file> -> samagra/<file>` rename lines covering every file under the package (no `D`/`A` pairs — those would mean the move wasn't tracked as a rename).

- [ ] **Step 3: Edit `pyproject.toml`** — change the project name, console script, and package-find glob. Replace these exact lines.

Replace:
```toml
name = "teachingos"
```
with:
```toml
name = "samagra"
```

Replace:
```toml
[project.scripts]
teachingos = "teachingos.__main__:main"
```
with:
```toml
[project.scripts]
samagra = "samagra.__main__:main"
```

Replace:
```toml
[tool.setuptools.packages.find]
include = ["teachingos*"]
```
with:
```toml
[tool.setuptools.packages.find]
include = ["samagra*"]
```

- [ ] **Step 4: Verify `pyproject.toml` has no stray `teachingos`.**
```bash
cd /c/SandBox/claude_box/TeachingOS
grep -n "teachingos" pyproject.toml || echo "CLEAN: no teachingos in pyproject.toml"
```
Expected: `CLEAN: no teachingos in pyproject.toml`.

- [ ] **Step 5: Verify the renamed package imports** (it has zero hardcoded self-references yet to break; this catches a botched `git mv`).
```bash
cd /c/SandBox/claude_box/TeachingOS
.venv\Scripts\python -c "import samagra; print(samagra.__file__)"
```
Expected: prints a path ending in `...\TeachingOS\samagra\__init__.py` with no traceback. (Run this from PowerShell. If you are in Git-Bash, use `.venv/Scripts/python.exe`.)

- [ ] **Step 6: Commit the directory rename + pyproject** (imports are fixed in 0.4, so don't run pytest yet).
```bash
cd /c/SandBox/claude_box/TeachingOS
git add -A
git commit -m "refactor: rename package dir teachingos -> samagra + pyproject

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: commit succeeds.

> If a pre-commit hook is already installed (it is not until Phase 2), it could block here. In Phase 0 there is no `core.hooksPath` configured, so commits run normally.

---

### Task 0.4: Update every Python import and the runtime identifiers

**Files:** `samagra/__init__.py`, `samagra/config.py`, `samagra/scheduler.py`, `samagra/__main__.py`, `samagra/api/app.py`, `samagra/catalog.py`, `tests/test_spine.py`, `tests/test_lectures.py`, `tests/test_scheduler.py` (all Modify).

Source edits verified by `grep` + pytest green. This is the heart of the rename.

- [ ] **Step 1: Update `samagra/__init__.py` identity.**

Replace:
```python
"""TeachingOS — agentic content-pipeline control plane."""
```
with:
```python
"""SAMAGRA — agentic content-pipeline control plane."""
```

- [ ] **Step 2: Update `samagra/__main__.py`** — three identifiers. Replace each exact line.

Replace:
```python
"""TeachingOS CLI: refresh | status | search | serve | tick | gate | export."""
```
with:
```python
"""SAMAGRA CLI: refresh | status | search | serve | tick | gate | export."""
```

Replace:
```python
        print("  (empty — run `python -m teachingos refresh` first)")
```
with:
```python
        print("  (empty — run `python -m samagra refresh` first)")
```

Replace:
```python
    uvicorn.run("teachingos.api.app:app", host=args.host, port=args.port,
                reload=args.reload)
```
with:
```python
    uvicorn.run("samagra.api.app:app", host=args.host, port=args.port,
                reload=args.reload)
```

Replace:
```python
    p = argparse.ArgumentParser(prog="teachingos",
                                description="TeachingOS control plane")
```
with:
```python
    p = argparse.ArgumentParser(prog="samagra",
                                description="SAMAGRA control plane")
```

- [ ] **Step 3: Update `samagra/api/app.py`** — the import, the FastAPI title, and the two `__version__` refs. Replace each exact line.

Replace:
```python
import teachingos
```
with:
```python
import samagra
```

Replace:
```python
app = FastAPI(title="TeachingOS", version=teachingos.__version__)
```
with:
```python
app = FastAPI(title="SAMAGRA", version=samagra.__version__)
```

Replace:
```python
        request, "portal.html", {"version": teachingos.__version__}
```
with:
```python
        request, "portal.html", {"version": samagra.__version__}
```

- [ ] **Step 4: Update `samagra/catalog.py` docstring** (DB filename reference; the filename itself is set in config in 0.5).

Replace:
```python
"""Unified catalog over all source adapters, persisted in teachingos.db."""
```
with:
```python
"""Unified catalog over all source adapters, persisted in samagra.db."""
```

- [ ] **Step 5: Update `samagra/scheduler.py` Windows Task name** (spec §5 / SHARED CONTRACTS).

Replace:
```python
TASK_NAME = "TeachingOS-tick"
```
with:
```python
TASK_NAME = "SAMAGRA-tick"
```

- [ ] **Step 6: Update the three test files' imports.**

In `tests/test_spine.py`, replace:
```python
from teachingos import catalog, state
from teachingos.adapters import ALL_ADAPTERS, get_adapter
```
with:
```python
from samagra import catalog, state
from samagra.adapters import ALL_ADAPTERS, get_adapter
```

In `tests/test_lectures.py`, replace:
```python
from teachingos.adapters import get_adapter
from teachingos.lectures import render
from teachingos.lectures.thin import build_thin
```
with:
```python
from samagra.adapters import get_adapter
from samagra.lectures import render
from samagra.lectures.thin import build_thin
```

In `tests/test_scheduler.py`, replace:
```python
from teachingos import scheduler, state
```
with:
```python
from samagra import scheduler, state
```

- [ ] **Step 7: Catch any remaining `teachingos` import or `python -m teachingos` reference across Python** (config.py env keys + DATA_DB are handled in 0.5; this step proves the import/runtime surface is clean).
```bash
cd /c/SandBox/claude_box/TeachingOS
grep -rn "from teachingos\|import teachingos\|m teachingos\|teachingos\.api\|teachingos\.__main__" samagra tests || echo "CLEAN: no teachingos import/runtime refs"
```
Expected: `CLEAN: no teachingos import/runtime refs`.

- [ ] **Step 8: Commit the import + identifier edits** (config/env keys still pending in 0.5, so the catalog rebuild + full pytest come after 0.5; do a syntax check now).
```bash
cd /c/SandBox/claude_box/TeachingOS
.venv\Scripts\python -c "import samagra.scheduler, samagra.__main__, samagra.api.app, samagra.catalog; print('imports OK')"
git add -A
git commit -m "refactor: update imports, console identifiers, TASK_NAME to samagra

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: `imports OK` then a successful commit. (`samagra.api.app` import requires FastAPI installed in the venv — it is, per slice-1.)

---

### Task 0.5: Rename config constants and `TEACHINGOS_*` env keys

**Files:** `samagra/config.py` (Modify).

The DB filename and env-var namespace move from `teachingos`/`TEACHINGOS_*` to `samagra`/`SAMAGRA_*` (spec §5: "`DATA_DB`… `STATE_DIR`; source-path constants; `.env` keys"). Verified by grep + an import that prints the resolved paths.

- [ ] **Step 1: Rename the DB filename.**

Replace:
```python
DATA_DB = REPO_ROOT / "teachingos.db"
```
with:
```python
DATA_DB = REPO_ROOT / "samagra.db"
```

- [ ] **Step 2: Rename every `TEACHINGOS_*` env key** in `config.py`. Replace each exact line.

Replace:
```python
GPT_BOX = _env_path("TEACHINGOS_GPT_BOX", Path(r"C:\SandBox\gpt_box"))
CLAUDE_BOX = _env_path("TEACHINGOS_CLAUDE_BOX", Path(r"C:\SandBox\claude_box"))
```
with:
```python
GPT_BOX = _env_path("SAMAGRA_GPT_BOX", Path(r"C:\SandBox\gpt_box"))
CLAUDE_BOX = _env_path("SAMAGRA_CLAUDE_BOX", Path(r"C:\SandBox\claude_box"))
```

Replace:
```python
QX_ROOT = _env_path("TEACHINGOS_QX_ROOT", GPT_BOX / "gpt-extract-ques")
```
with:
```python
QX_ROOT = _env_path("SAMAGRA_QX_ROOT", GPT_BOX / "gpt-extract-ques")
```

Replace:
```python
TEXTBOOK_ROOT = _env_path("TEACHINGOS_TEXTBOOK_ROOT", GPT_BOX / "physics-textbook")
```
with:
```python
TEXTBOOK_ROOT = _env_path("SAMAGRA_TEXTBOOK_ROOT", GPT_BOX / "physics-textbook")
```

Replace:
```python
BOOKLETS_ROOT = _env_path("TEACHINGOS_BOOKLETS_ROOT", CLAUDE_BOX / "claude-booklet-proofer")
INSP_ROOT = _env_path("TEACHINGOS_INSP_ROOT", CLAUDE_BOX / "claude-INSP-extract")
SIMS_ROOT = _env_path("TEACHINGOS_SIMS_ROOT", CLAUDE_BOX / "pratyaksh-May-deploy")
```
with:
```python
BOOKLETS_ROOT = _env_path("SAMAGRA_BOOKLETS_ROOT", CLAUDE_BOX / "claude-booklet-proofer")
INSP_ROOT = _env_path("SAMAGRA_INSP_ROOT", CLAUDE_BOX / "claude-INSP-extract")
SIMS_ROOT = _env_path("SAMAGRA_SIMS_ROOT", CLAUDE_BOX / "pratyaksh-May-deploy")
```

Replace:
```python
QUESTIONDB_URL = os.environ.get(
    "TEACHINGOS_QUESTIONDB_URL", "https://dbhardwaj86-questiondb.hf.space"
)
```
with:
```python
QUESTIONDB_URL = os.environ.get(
    "SAMAGRA_QUESTIONDB_URL", "https://dbhardwaj86-questiondb.hf.space"
)
```

Replace:
```python
HOST = os.environ.get("TEACHINGOS_HOST", "127.0.0.1")
PORT = int(os.environ.get("TEACHINGOS_PORT", "8799"))
```
with:
```python
HOST = os.environ.get("SAMAGRA_HOST", "127.0.0.1")
PORT = int(os.environ.get("SAMAGRA_PORT", "8799"))
```

- [ ] **Step 3: Verify `config.py` has no surviving `teachingos`/`TEACHINGOS`** and that the resolved DB path is `samagra.db`.
```bash
cd /c/SandBox/claude_box/TeachingOS
grep -ni "teachingos" samagra/config.py || echo "CLEAN: config.py"
.venv\Scripts\python -c "from samagra import config; print(config.DATA_DB.name); assert config.DATA_DB.name=='samagra.db'"
```
Expected: `CLEAN: config.py` then `samagra.db`.

- [ ] **Step 4: Prove the ONLY remaining lowercase `teachingos` in the package is the intentional owner-role value in `state.py`.** This is the deliberate scope exclusion.
```bash
cd /c/SandBox/claude_box/TeachingOS
grep -rn "teachingos" samagra
```
Expected: exactly two lines, both in `samagra/state.py` — `"approve": "human", "export": "teachingos"}` and `"build": "teachingos", "finalize": "human"}`. These are org-role identifiers per spec §3 and are intentionally left unchanged. If any OTHER line appears, fix it before continuing.

- [ ] **Step 5: Commit the config rename.**
```bash
cd /c/SandBox/claude_box/TeachingOS
git add -A
git commit -m "refactor: rename DATA_DB to samagra.db and TEACHINGOS_* env keys to SAMAGRA_*

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: commit succeeds.

---

### Task 0.6: Rebuild the catalog and verify 7,044 artifacts

**Files:** none (regenerates the gitignored `samagra.db`).

The catalog rebuild is the integration smoke test for the rename — verified by `refresh` + `status` output, not pytest.

- [ ] **Step 1: Remove any stale old-named DB** so the new `samagra.db` is built fresh (the old `teachingos.db` is gitignored and now orphaned).
```bash
cd /c/SandBox/claude_box/TeachingOS
rm -f teachingos.db
ls *.db 2>/dev/null || echo "no .db files yet"
```
Expected: no `teachingos.db` remains (a leftover `samagra.db` from a prior run, if any, is fine — `refresh` rebuilds it).

- [ ] **Step 2: Rebuild the unified catalog under the new package name.**
```bash
cd /c/SandBox/claude_box/TeachingOS
.venv\Scripts\python -m samagra refresh
```
Expected final line: `Done. 7044 artifacts across 6 sources.` (count is the slice-1 verified total of 7,044; the exact per-source split prints above it). If the total differs because a source workspace is offline on this machine, record the actual number and confirm it matches the local source state — the rename itself must not change counts.

- [ ] **Step 3: Confirm the new DB file exists and the status command reads it.**
```bash
cd /c/SandBox/claude_box/TeachingOS
ls -l samagra.db
.venv\Scripts\python -m samagra status
```
Expected: `samagra.db` exists; `status` prints a `Catalog refreshed_at:` timestamp, the six source rows with artifact counts, and the `Pipelines:` block (textbook/questions/papers/media) with their phase statuses. No traceback, no `(empty …)` line.

---

### Task 0.7: Run the full test suite (verify 11/11 pass under `samagra`)

**Files:** none (runs `tests/` against the renamed package).

Full green pytest is the rename's acceptance gate.

- [ ] **Step 1: Run the whole suite with the project venv.**
```bash
cd /c/SandBox/claude_box/TeachingOS
.venv\Scripts\python -m pytest -q
```
Expected: `11 passed` (slice-1's verified count) with `0 failed`, no import errors. Run from the repo root so `PYTHONPATH`/cwd resolves `samagra`.

- [ ] **Step 2: If any test fails with `ModuleNotFoundError: No module named 'teachingos'`,** a stray import was missed. Find and fix it, then re-run:
```bash
cd /c/SandBox/claude_box/TeachingOS
grep -rn "teachingos" tests
```
Expected after fixes: no output, and Step 1 re-run prints `11 passed`. (Do not edit test assertions to make them pass — only fix import paths.)

- [ ] **Step 3: Commit only if any test-file fix was needed.** If Step 1 passed first try, skip this commit.
```bash
cd /c/SandBox/claude_box/TeachingOS
git add tests
git commit -m "test: fix residual teachingos imports after rename

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: commit succeeds (or "nothing to commit" if no fix was needed).

---

### Task 0.8: Update ops scripts and launch config

**Files:** `scripts/tos_tick.cmd` (Modify), `.claude/launch.json` (Modify).

Mechanical edits, verified by grep + a dry-run tick.

- [ ] **Step 1: Update `scripts/tos_tick.cmd`** — the comment and the `-m teachingos` invocation.

Replace:
```bat
REM TeachingOS scheduler tick — run by Windows Task Scheduler.
```
with:
```bat
REM SAMAGRA scheduler tick — run by Windows Task Scheduler.
```

Replace:
```bat
".venv\Scripts\python.exe" -m teachingos tick >> "state\tick.log" 2>&1
```
with:
```bat
".venv\Scripts\python.exe" -m samagra tick >> "state\tick.log" 2>&1
```

- [ ] **Step 2: Update `.claude/launch.json`** — the launch name and the uvicorn module arg.

Replace:
```json
      "name": "teachingos",
```
with:
```json
      "name": "samagra",
```

Replace:
```json
      "runtimeArgs": ["-m", "uvicorn", "teachingos.api.app:app", "--host", "127.0.0.1", "--port", "8799"],
```
with:
```json
      "runtimeArgs": ["-m", "uvicorn", "samagra.api.app:app", "--host", "127.0.0.1", "--port", "8799"],
```

- [ ] **Step 3: Verify a dry-run tick works end-to-end under the new name.**
```bash
cd /c/SandBox/claude_box/TeachingOS
.venv\Scripts\python -m samagra tick --dry-run
```
Expected: `tick (dry-run):` followed by `catalog:`, `textbook:`, and `exports this tick:` log lines — no traceback.

- [ ] **Step 4: Commit the ops-script edits.**
```bash
cd /c/SandBox/claude_box/TeachingOS
git add scripts/tos_tick.cmd .claude/launch.json
git commit -m "chore: point tick script + launch config at samagra package

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: commit succeeds.

> **Note (not in this phase):** the live Windows Scheduled Task is still registered as `TeachingOS-tick` pointing at the old command. Re-registering it under `SAMAGRA-tick` is an owner action (`.venv\Scripts\python -m samagra schedule-install`) done outside this plan; the code identifier is already correct.

---

### Task 0.9: Update docs to the SAMAGRA identity

**Files:** `README.md`, `requirements.txt`, `.env.example`, `config.example`, `HANDOFF.md`, `STATUS.html` (all Modify).

Doc/identity edits, verified by grep. STATUS.html gets the full org/status treatment in Phase 2; here, only the identity strings change.

- [ ] **Step 1: Update `README.md` title + all command/path references.**

Replace the title:
```markdown
# TeachingOS
```
with:
```markdown
# SAMAGRA
```

Replace the architecture bullets:
```markdown
1. **Source adapters** (`teachingos/adapters/`) — read-only, each normalizes its source into a common `Artifact`.
2. **Catalog + state** (`teachingos/catalog.py`, `state.py`) — `teachingos.db` unified catalog + a phase state machine.
3. **Portal + API** (`teachingos/api/`, `portal/`) — FastAPI + a UI forked from QX's browser.
```
with:
```markdown
1. **Source adapters** (`samagra/adapters/`) — read-only, each normalizes its source into a common `Artifact`.
2. **Catalog + state** (`samagra/catalog.py`, `state.py`) — `samagra.db` unified catalog + a phase state machine.
3. **Portal + API** (`samagra/api/`, `portal/`) — FastAPI + a UI forked from QX's browser.
```

Replace the command block:
```markdown
python -m teachingos refresh     # build the unified catalog from local sources
python -m teachingos status      # source summaries + pipeline states
python -m teachingos search "gauss" --source qx
```
with:
```markdown
python -m samagra refresh     # build the unified catalog from local sources
python -m samagra status      # source summaries + pipeline states
python -m samagra search "gauss" --source qx
```

Replace:
```markdown
python -m teachingos serve       # http://127.0.0.1:8799
```
with:
```markdown
python -m samagra serve       # http://127.0.0.1:8799
```

Replace:
```markdown
no secrets and no content/copyrighted material are ever committed — TeachingOS only references
```
with:
```markdown
no secrets and no content/copyrighted material are ever committed — SAMAGRA only references
```

- [ ] **Step 2: Update `requirements.txt` comment.**

Replace:
```text
# for `python -m teachingos refresh|status|search`.
```
with:
```text
# for `python -m samagra refresh|status|search`.
```

- [ ] **Step 3: Update `.env.example`** — header + every `TEACHINGOS_*` key (must match the renamed `config.py`).

Replace:
```text
# TeachingOS configuration template.
```
with:
```text
# SAMAGRA configuration template.
```

Replace:
```text
TEACHINGOS_GPT_BOX=C:\SandBox\gpt_box
TEACHINGOS_CLAUDE_BOX=C:\SandBox\claude_box
```
with:
```text
SAMAGRA_GPT_BOX=C:\SandBox\gpt_box
SAMAGRA_CLAUDE_BOX=C:\SandBox\claude_box
```

Replace:
```text
# TEACHINGOS_QX_ROOT=C:\SandBox\gpt_box\gpt-extract-ques
# TEACHINGOS_TEXTBOOK_ROOT=C:\SandBox\gpt_box\physics-textbook
# TEACHINGOS_BOOKLETS_ROOT=C:\SandBox\claude_box\claude-booklet-proofer
# TEACHINGOS_INSP_ROOT=C:\SandBox\claude_box\claude-INSP-extract
# TEACHINGOS_SIMS_ROOT=C:\SandBox\claude_box\pratyaksh-May-deploy
```
with:
```text
# SAMAGRA_QX_ROOT=C:\SandBox\gpt_box\gpt-extract-ques
# SAMAGRA_TEXTBOOK_ROOT=C:\SandBox\gpt_box\physics-textbook
# SAMAGRA_BOOKLETS_ROOT=C:\SandBox\claude_box\claude-booklet-proofer
# SAMAGRA_INSP_ROOT=C:\SandBox\claude_box\claude-INSP-extract
# SAMAGRA_SIMS_ROOT=C:\SandBox\claude_box\pratyaksh-May-deploy
```

Replace:
```text
TEACHINGOS_QUESTIONDB_URL=https://dbhardwaj86-questiondb.hf.space
```
with:
```text
SAMAGRA_QUESTIONDB_URL=https://dbhardwaj86-questiondb.hf.space
```

Replace:
```text
TEACHINGOS_HOST=127.0.0.1
TEACHINGOS_PORT=8799
```
with:
```text
SAMAGRA_HOST=127.0.0.1
SAMAGRA_PORT=8799
```

- [ ] **Step 4: Update `config.example`** — header + the `config.py` path reference.

Replace:
```text
TeachingOS configuration
```
with:
```text
SAMAGRA configuration
```

Replace:
```text
repo root (gitignored); anything it defines overrides `teachingos/config.py`.
```
with:
```text
repo root (gitignored); anything it defines overrides `samagra/config.py`.
```

- [ ] **Step 5: Light identity pass on `HANDOFF.md` and `STATUS.html`** — swap the product name in headings/intro from `TeachingOS` to `SAMAGRA` (and `teachingos.db` → `samagra.db` if mentioned). Do a targeted replace; leave historical slice-1 phrasing intact. Find the occurrences to edit:
```bash
cd /c/SandBox/claude_box/TeachingOS
grep -ni "teachingos" HANDOFF.md STATUS.html
```
Then replace the product-name occurrences (titles, the `<title>`/`<h1>` in STATUS.html, prose intros, and any `teachingos.db`/`python -m teachingos` command) with the SAMAGRA equivalents. The full STATUS.html org chart + status grid is Phase 2 — keep this minimal.

- [ ] **Step 6: Final repo-wide sweep — prove no stray `teachingos`/`TEACHINGOS` survives except the intentional `state.py` owner role.**
```bash
cd /c/SandBox/claude_box/TeachingOS
grep -rni "teachingos" . \
  --exclude-dir=.git --exclude-dir=.venv --exclude-dir=build \
  --exclude=samagra.db --exclude=teachingos.db \
  | grep -vi "docs/superpowers/specs" \
  | grep -v 'state.py.*"teachingos"'
```
Expected: **no output** (every remaining `teachingos` is either in the historical spec under `docs/superpowers/specs/`, or the two intentional owner-role values in `state.py`). If anything else prints, fix it and re-run.

- [ ] **Step 7: Re-run the full suite once more to confirm docs edits broke nothing.**
```bash
cd /c/SandBox/claude_box/TeachingOS
.venv\Scripts\python -m pytest -q
```
Expected: `11 passed`.

- [ ] **Step 8: Commit the docs/identity update.**
```bash
cd /c/SandBox/claude_box/TeachingOS
git add README.md requirements.txt .env.example config.example HANDOFF.md STATUS.html
git commit -m "docs: rebrand TeachingOS -> SAMAGRA across README, examples, handoff

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: commit succeeds.

- [ ] **Step 9: Push `main` to the renamed remote.**
```bash
cd /c/SandBox/claude_box/TeachingOS
git push origin main
git log --oneline -7
```
Expected: push succeeds against `…/samagra.git`; the log shows the Phase 0 commit chain (dir rename → imports → config → ops scripts → docs). Phase 0 is complete: repo renamed `samagra`, package `samagra`, `samagra.db` rebuilt to 7,044 artifacts, 11/11 tests green.

---

## Phase 1 — Subsystem adapters (mycontentdev + munshi)

> **✅ COMPLETE (2026-06-19)** — built TDD in 8 tasks (1.1–1.8), adversarial 42-agent pre-merge review
> (MUN-01 munshi-title schema bug found + fixed), **63/63 green**, fast-forward-merged to `main`.
> `create_seed` NOT shipped (deferred to Phase 3 per D2/D9). Note: the Task 1.2 `create_seed` code/test
> block below is superseded — it was intentionally NOT built. F1/F4 refresh hardening carried to Phase 2.

This phase adds two read-only HTTP clients (`McdClient`, `MunshiClient`), two new source adapters (`McdAdapter`, `MunshiAdapter`) that normalize those subsystems into `Artifact` records, a new `"mycontentdev"` pipeline in the state machine, and a `_reflect_mycontentdev` scheduler reflector. Everything is read-only (no writes into any subsystem yet — `create_seed` is **deferred to Phase 3 per D2/D9**, not shipped in Phase 1). All tests MOCK the HTTP layer by injecting fake clients or monkeypatching `requests`; there are NO live-prod calls. All imports use the `samagra.*` package (post Phase-0 rename).

**Phase-1 acceptance (and how it relates to the golden thread).** The golden thread munshi → seed → enriched → published is the definition-of-done for the WHOLE 4-phase arc, not Phase 1. Phase 1 accepts EXACTLY: (a) the TWO new read-only adapters (McdAdapter, MunshiAdapter) reflecting real state into the catalog + the mycontentdev pipeline reflected read-only into state; (b) the existing slice-1 sources still green after registration (a failing/offline new adapter must not erase the catalog — D4/S-05); (c) the EXISTING slice-1 publish gate reused unchanged — no new status or workflow step; (d) no new write path (create_seed not shipped in Phase 1 per D2/D9). Phase 1 ships nothing beyond (a)-(c). "Published" closes only after the Phase-3 board-approved write (D2/D7).

**Files:**

- **Create** `samagra/clients/__init__.py` — marks the new HTTP-clients subpackage; re-exports `McdClient`, `MunshiClient`.
- **Create** `samagra/clients/mcd_client.py` — `McdClient`: read-only admin-API client for mycontentdev (loads `mcd-cloud.json`/env, never logs key values); plus `create_seed` (built now, used only in Phase 3).
- **Create** `samagra/clients/munshi_client.py` — `MunshiClient`: read-only library client for munshi (cookie auth, never logs the secret).
- **Create** `samagra/adapters/mcd.py` — `McdAdapter(Adapter)`: turns mycontentdev seed rows into `Artifact`s.
- **Create** `samagra/adapters/munshi.py` — `MunshiAdapter(Adapter)`: turns munshi library items into `Artifact`s.
- **Modify** `samagra/adapters/__init__.py` — append `McdAdapter()`, `MunshiAdapter()` to `ALL_ADAPTERS`.
- **Modify** `samagra/state.py` — add the `"mycontentdev"` pipeline to `PIPELINES`.
- **Modify** `samagra/scheduler.py` — add `_reflect_mycontentdev(dry, events)`.
- **Test** `tests/test_clients.py` — unit tests for `McdClient` + `MunshiClient` against a fake transport (monkeypatched `requests`); asserts URL/header/body shape and the never-log-secret guarantees.
- **Test** `tests/test_subsystem_adapters.py` — unit tests for `McdAdapter` + `MunshiAdapter` over fake-client JSON; asserts exact `Artifact` field values, plus registration in `ALL_ADAPTERS`.
- **Test** `tests/test_reflect_mycontentdev.py` — tests for the `"mycontentdev"` `PIPELINES` entry, the status mapping in `_reflect_mycontentdev`, and the missing-creds no-op.

---

### Task 1.1: Create the `samagra.clients` subpackage skeleton

**Files:**
- Create `samagra/clients/__init__.py`

This is a tiny mechanical scaffolding task (a new package `__init__`), so it is verification-driven, not red-green. The real TDD starts in Task 1.2.

- [ ] **Step 1: Create the clients package init.** Write `samagra/clients/__init__.py` with exactly:

```python
"""HTTP clients for external subsystems (read-only in Phase 1).

mycontentdev (editorial) and munshi (front desk). The ONLY write path is
McdClient.create_seed, which is built here but exercised only in Phase 3
(board-approved). No client ever logs a secret value.
"""
from __future__ import annotations

from .mcd_client import McdClient
from .munshi_client import MunshiClient

__all__ = ["McdClient", "MunshiClient"]
```

- [ ] **Step 2: Verify the directory exists (the import will fail until 1.2/1.3 land — that's expected).** Run:

```bash
.venv\Scripts\python -c "import os; print(os.path.exists('samagra/clients/__init__.py'))"
```

Expected output: `True`. (Do NOT import the package yet — `mcd_client`/`munshi_client` don't exist, so an import would `ModuleNotFoundError`. That's fixed in the next two tasks.)

- [ ] **Step 3: Commit the scaffolding.** Run:

```bash
git add samagra/clients/__init__.py
git commit -m "feat(clients): scaffold samagra.clients subpackage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 1.2: `McdClient` (TDD)

**Files:**
- Test `tests/test_clients.py`
- Create `samagra/clients/mcd_client.py`

`McdClient` wraps the mycontentdev admin API. `query(sql)` POSTs to `{apiUrl}/api/admin/query` with header `x-mcd-admin: <adminKey>` and body `{"sql": sql}`, returning the raw array. `pending()` GETs `{apiUrl}/api/admin/pending` with the same header. `create_seed(payload)` POSTs to `{apiUrl}/api/seeds` with header `x-mcd-key: <appKey>` (used only in Phase 3). `available()` is True iff `api_url` and the needed key are set. Config loads from `mcd-cloud.json {apiUrl,adminKey}` or env `MCD_API_URL`/`MCD_ADMIN_KEY`/`MCD_APP_KEY`. The client trims trailing slashes off the URL (mirroring `_cloud.mjs`) and never logs key values.

> **SUPERSEDED (runbook D2/D9, 2026-06-19):** `create_seed` is **deferred to Phase 3** and must NOT be built or tested in Phase 1. Skip the `test_mcd_create_seed_posts_with_app_key` test and the `create_seed` method in the code blocks below; ship only `query`/`pending`/`available`/secret-free `__repr__`. The original create_seed code/test is retained below for the Phase-3 build only.

- [ ] **Step 1: Write the failing tests.** Create `tests/test_clients.py` with the `McdClient` tests (the `MunshiClient` tests are appended in Task 1.3). A `FakeRequests` records the last call and returns a canned JSON `Response`-like object, injected by monkeypatching `samagra.clients.mcd_client.requests`:

```python
"""Unit tests for the read-only subsystem HTTP clients.

The HTTP layer is fully MOCKED — no live-prod calls. We monkeypatch the module
`requests` attribute with a fake transport that records the last request and
returns canned JSON. We also assert that secret values are never echoed.
"""
from __future__ import annotations

import json

import pytest

from samagra.clients import mcd_client, munshi_client


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeRequests:
    """Records the last GET/POST and returns a canned payload."""

    def __init__(self, payload):
        self.payload = payload
        self.last = None

    def get(self, url, headers=None, timeout=None):
        self.last = {"method": "GET", "url": url, "headers": headers or {},
                     "json": None, "timeout": timeout}
        return FakeResponse(self.payload)

    def post(self, url, headers=None, json=None, timeout=None):
        self.last = {"method": "POST", "url": url, "headers": headers or {},
                     "json": json, "timeout": timeout}
        return FakeResponse(self.payload)


# ---------------- McdClient ----------------

def test_mcd_available_false_without_creds(monkeypatch):
    monkeypatch.delenv("MCD_API_URL", raising=False)
    monkeypatch.delenv("MCD_ADMIN_KEY", raising=False)
    monkeypatch.delenv("MCD_APP_KEY", raising=False)
    monkeypatch.setattr(mcd_client, "_load_cloud_json", lambda: {})
    c = mcd_client.McdClient()
    assert c.available() is False


def test_mcd_available_true_with_env(monkeypatch):
    monkeypatch.setenv("MCD_API_URL", "https://mcd.example.dev/")
    monkeypatch.setenv("MCD_ADMIN_KEY", "ADMIN-SECRET")
    monkeypatch.setattr(mcd_client, "_load_cloud_json", lambda: {})
    c = mcd_client.McdClient()
    assert c.available() is True
    # trailing slash trimmed, mirroring _cloud.mjs
    assert c.api_url == "https://mcd.example.dev"


def test_mcd_query_posts_with_admin_header(monkeypatch):
    fake = FakeRequests([{"id": "s1", "title": "Gauss law"}])
    monkeypatch.setattr(mcd_client, "requests", fake)
    c = mcd_client.McdClient(api_url="https://mcd.example.dev",
                             admin_key="ADMIN-SECRET")
    rows = c.query("SELECT 1")
    assert rows == [{"id": "s1", "title": "Gauss law"}]
    assert fake.last["method"] == "POST"
    assert fake.last["url"] == "https://mcd.example.dev/api/admin/query"
    assert fake.last["headers"]["x-mcd-admin"] == "ADMIN-SECRET"
    assert fake.last["json"] == {"sql": "SELECT 1"}


def test_mcd_pending_gets_with_admin_header(monkeypatch):
    fake = FakeRequests([{"id": "s2", "status": "needs_processing"}])
    monkeypatch.setattr(mcd_client, "requests", fake)
    c = mcd_client.McdClient(api_url="https://mcd.example.dev",
                             admin_key="ADMIN-SECRET")
    rows = c.pending()
    assert rows == [{"id": "s2", "status": "needs_processing"}]
    assert fake.last["method"] == "GET"
    assert fake.last["url"] == "https://mcd.example.dev/api/admin/pending"
    assert fake.last["headers"]["x-mcd-admin"] == "ADMIN-SECRET"


def test_mcd_create_seed_posts_with_app_key(monkeypatch):
    fake = FakeRequests({"id": "s3", "status": "captured"})
    monkeypatch.setattr(mcd_client, "requests", fake)
    c = mcd_client.McdClient(api_url="https://mcd.example.dev",
                             admin_key="ADMIN-SECRET", app_key="APP-SECRET")
    out = c.create_seed({"type": "rough_idea", "raw_text": "x"})
    assert out == {"id": "s3", "status": "captured"}
    assert fake.last["method"] == "POST"
    assert fake.last["url"] == "https://mcd.example.dev/api/seeds"
    assert fake.last["headers"]["x-mcd-key"] == "APP-SECRET"
    assert fake.last["json"] == {"type": "rough_idea", "raw_text": "x"}


def test_mcd_repr_never_leaks_secret():
    c = mcd_client.McdClient(api_url="https://mcd.example.dev",
                             admin_key="ADMIN-SECRET", app_key="APP-SECRET")
    blob = repr(c) + str(vars(c).get("api_url", ""))
    assert "ADMIN-SECRET" not in repr(c)
    assert "APP-SECRET" not in repr(c)
```

- [ ] **Step 2: Run the tests — expect FAIL (no implementation yet).** Run:

```bash
.venv\Scripts\python -m pytest tests/test_clients.py -q
```

Expected: collection error / failures like `ImportError: cannot import name 'McdClient'` or `ModuleNotFoundError: No module named 'samagra.clients.mcd_client'` (the module body doesn't exist yet).

- [ ] **Step 3: Implement `McdClient` (full code).** Create `samagra/clients/mcd_client.py`:

```python
"""Read-only admin-API client for mycontentdev (editorial subsystem).

Mirrors mycontentdev/scripts/_cloud.mjs: config from mcd-cloud.json
{apiUrl,adminKey} at the mycontentdev repo root, or env MCD_API_URL /
MCD_ADMIN_KEY / MCD_APP_KEY. Trailing slashes on the URL are trimmed.

SAFETY: this client NEVER logs or reprs a key value. The only write method is
create_seed (POST /api/seeds), which is exercised only in Phase 3.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import requests

from .. import config

_TIMEOUT = 30
# mycontentdev repo root, sibling of the samagra repo under claude_box.
_MCD_ROOT = config.CLAUDE_BOX / "mycontentdev"


def _load_cloud_json() -> dict:
    p = _MCD_ROOT / "mcd-cloud.json"
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            return {}
    return {}


class McdClient:
    def __init__(self, api_url=None, admin_key=None, app_key=None):
        file = _load_cloud_json()
        url = api_url or os.environ.get("MCD_API_URL") or file.get("apiUrl") or ""
        self.api_url = url.rstrip("/")
        self._admin_key = admin_key or os.environ.get("MCD_ADMIN_KEY") or file.get("adminKey") or ""
        self._app_key = app_key or os.environ.get("MCD_APP_KEY") or file.get("appKey") or ""

    def available(self) -> bool:
        return bool(self.api_url and self._admin_key)

    def query(self, sql: str) -> list[dict]:
        r = requests.post(
            f"{self.api_url}/api/admin/query",
            headers={"x-mcd-admin": self._admin_key, "content-type": "application/json"},
            json={"sql": sql},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()

    def pending(self) -> list[dict]:
        r = requests.get(
            f"{self.api_url}/api/admin/pending",
            headers={"x-mcd-admin": self._admin_key},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()

    def create_seed(self, payload: dict) -> dict:
        # USED ONLY IN PHASE 3 (board-approved write path).
        r = requests.post(
            f"{self.api_url}/api/seeds",
            headers={"x-mcd-key": self._app_key, "content-type": "application/json"},
            json=payload,
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()

    def __repr__(self) -> str:  # never leak key values
        return f"McdClient(api_url={self.api_url!r}, admin_key=<set:{bool(self._admin_key)}>)"
```

- [ ] **Step 4: Run the tests — expect PASS.** Run:

```bash
.venv\Scripts\python -m pytest tests/test_clients.py -q
```

Expected: the 6 `McdClient` tests pass (e.g. `6 passed`).

- [ ] **Step 5: Commit.** Run:

```bash
git add samagra/clients/mcd_client.py tests/test_clients.py
git commit -m "feat(clients): McdClient read-only admin API + Phase-3 create_seed

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 1.3: `MunshiClient` (TDD)

**Files:**
- Modify `tests/test_clients.py`
- Create `samagra/clients/munshi_client.py`

`MunshiClient.library()` GETs `{api_url}/api/library` with header `Cookie: munshi=<urlencoded(secret)>` (mirroring `driver.mjs` `cookie()`), returning `{"people":[...], "total":int, "items":[...]}`. Config from env `MUNSHI_API_URL` / `MUNSHI_SECRET`. `available()` is True iff both are set. The secret is never logged.

- [ ] **Step 1: Append the failing `MunshiClient` tests.** Add to the end of `tests/test_clients.py`:

```python
# ---------------- MunshiClient ----------------

def test_munshi_available_false_without_creds(monkeypatch):
    monkeypatch.delenv("MUNSHI_API_URL", raising=False)
    monkeypatch.delenv("MUNSHI_SECRET", raising=False)
    c = munshi_client.MunshiClient()
    assert c.available() is False


def test_munshi_available_true_with_env(monkeypatch):
    monkeypatch.setenv("MUNSHI_API_URL", "https://munshi.example.dev/")
    monkeypatch.setenv("MUNSHI_SECRET", "COOKIE-SECRET")
    c = munshi_client.MunshiClient()
    assert c.available() is True
    assert c.api_url == "https://munshi.example.dev"


def test_munshi_library_sends_cookie_header(monkeypatch):
    fake = FakeRequests({"people": [], "total": 2,
                         "items": [{"id": 1}, {"id": 2}]})
    monkeypatch.setattr(munshi_client, "requests", fake)
    c = munshi_client.MunshiClient(api_url="https://munshi.example.dev",
                                   secret="COOKIE SECRET/with=chars")
    lib = c.library()
    assert lib["total"] == 2 and len(lib["items"]) == 2
    assert fake.last["method"] == "GET"
    assert fake.last["url"] == "https://munshi.example.dev/api/library"
    # secret is URL-encoded into the cookie, exactly like driver.mjs cookie()
    assert fake.last["headers"]["Cookie"] == "munshi=COOKIE%20SECRET%2Fwith%3Dchars"


def test_munshi_repr_never_leaks_secret():
    c = munshi_client.MunshiClient(api_url="https://munshi.example.dev",
                                   secret="COOKIE-SECRET")
    assert "COOKIE-SECRET" not in repr(c)
```

- [ ] **Step 2: Run the new tests — expect FAIL.** Run:

```bash
.venv\Scripts\python -m pytest tests/test_clients.py -k munshi -q
```

Expected: `ModuleNotFoundError: No module named 'samagra.clients.munshi_client'` (or `ImportError` on `MunshiClient`).

- [ ] **Step 3: Implement `MunshiClient` (full code).** Create `samagra/clients/munshi_client.py`:

```python
"""Read-only library client for munshi (front-desk subsystem).

Mirrors myProd/stress/driver.mjs MunshiClient: cookie auth via
Cookie: munshi=<urlencoded(secret)>. Config from env MUNSHI_API_URL /
MUNSHI_SECRET. SAFETY: the secret value is never logged or repr'd.
"""
from __future__ import annotations

import os
from urllib.parse import quote

import requests

_TIMEOUT = 30


class MunshiClient:
    def __init__(self, api_url=None, secret=None):
        url = api_url or os.environ.get("MUNSHI_API_URL") or ""
        self.api_url = url.rstrip("/")
        self._secret = secret or os.environ.get("MUNSHI_SECRET") or ""

    def available(self) -> bool:
        return bool(self.api_url and self._secret)

    def _cookie(self) -> str:
        # quote(..., safe="") matches JS encodeURIComponent for our charset.
        return "munshi=" + quote(self._secret, safe="")

    def library(self) -> dict:
        r = requests.get(
            f"{self.api_url}/api/library",
            headers={"Cookie": self._cookie()},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()

    def __repr__(self) -> str:  # never leak the secret
        return f"MunshiClient(api_url={self.api_url!r}, secret=<set:{bool(self._secret)}>)"
```

- [ ] **Step 4: Run the full clients suite — expect PASS.** Run:

```bash
.venv\Scripts\python -m pytest tests/test_clients.py -q
```

Expected: all client tests pass (e.g. `10 passed`).

- [ ] **Step 5: Commit.** Run:

```bash
git add samagra/clients/munshi_client.py samagra/clients/__init__.py tests/test_clients.py
git commit -m "feat(clients): MunshiClient read-only library (cookie auth)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 1.4: `McdAdapter` (TDD)

**Files:**
- Test `tests/test_subsystem_adapters.py`
- Create `samagra/adapters/mcd.py`

`McdAdapter(Adapter)` has `name="mycontentdev"`, `label="Editorial (mycontentdev)"`, wraps an `McdClient`. `available()` delegates to `client.available()`. `artifacts()` runs `client.query("SELECT id,type,title,status,created_at,updated_at FROM seeds WHERE status != 'archived'")` and yields one `Artifact` per row with the exact field mapping from the SHARED CONTRACTS. Tests inject a fake client so no HTTP happens.

- [ ] **Step 1: Write the failing `McdAdapter` tests.** Create `tests/test_subsystem_adapters.py`:

```python
"""Adapter tests for mycontentdev + munshi.

The HTTP clients are replaced with hand-rolled fakes that return canned JSON,
so artifacts() is exercised over known data with NO network access. We assert
exact Artifact field values against the SHARED CONTRACTS.
"""
from __future__ import annotations

from samagra.adapters import ALL_ADAPTERS, get_adapter
from samagra.adapters.mcd import McdAdapter
from samagra.adapters.munshi import MunshiAdapter


class FakeMcdClient:
    def __init__(self, api_url="https://mcd.example.dev", rows=None, avail=True):
        self.api_url = api_url
        self._rows = rows or []
        self._avail = avail
        self.last_sql = None

    def available(self):
        return self._avail

    def query(self, sql):
        self.last_sql = sql
        return self._rows


class FakeMunshiClient:
    def __init__(self, library=None, avail=True):
        self._library = library or {"people": [], "total": 0, "items": []}
        self._avail = avail

    def available(self):
        return self._avail

    def library(self):
        return self._library


# ---------------- McdAdapter ----------------

def test_mcd_adapter_identity():
    ad = McdAdapter()
    assert ad.name == "mycontentdev"
    assert ad.label == "Editorial (mycontentdev)"


def test_mcd_adapter_available_delegates_to_client():
    assert McdAdapter(client=FakeMcdClient(avail=True)).available() is True
    assert McdAdapter(client=FakeMcdClient(avail=False)).available() is False


def test_mcd_adapter_query_excludes_archived():
    fake = FakeMcdClient(rows=[])
    list(McdAdapter(client=fake).artifacts())
    assert fake.last_sql == (
        "SELECT id,type,title,status,created_at,updated_at "
        "FROM seeds WHERE status != 'archived'"
    )


def test_mcd_adapter_maps_row_to_artifact():
    rows = [{
        "id": "abc123",
        "type": "concept",
        "title": "Gauss's law flux",
        "status": "draft_ready",
        "created_at": "2026-06-10T00:00:00Z",
        "updated_at": "2026-06-15T09:00:00Z",
    }]
    ad = McdAdapter(client=FakeMcdClient(api_url="https://mcd.example.dev", rows=rows))
    arts = list(ad.artifacts())
    assert len(arts) == 1
    a = arts[0]
    assert a.uid == "mcd:abc123"
    assert a.source == "mycontentdev"
    assert a.kind == "concept"
    assert a.title == "Gauss's law flux"
    assert a.subject == "physics"
    assert a.unit is None
    assert a.chapter is None
    assert a.status == "draft_ready"
    assert a.path is None
    assert a.url == "https://mcd.example.dev/seed/abc123"
    assert a.updated_at == "2026-06-15T09:00:00Z"
    assert a.meta == {"seedId": "abc123"}
```

- [ ] **Step 2: Run — expect FAIL.** Run:

```bash
.venv\Scripts\python -m pytest tests/test_subsystem_adapters.py -k mcd -q
```

Expected: `ModuleNotFoundError: No module named 'samagra.adapters.mcd'`.

- [ ] **Step 3: Implement `McdAdapter` (full code).** Create `samagra/adapters/mcd.py`:

```python
"""mycontentdev (editorial) source adapter — read-only.

Normalizes non-archived seed rows into Artifact records. seed.type in
[concept,question,snippet,simulation_idea,experiment,notebooklm_link,rough_idea];
seed.status in [captured,needs_processing,processing,draft_ready,
changes_requested,approved,brief_generated,content_linked,done,archived].
"""
from __future__ import annotations

from typing import Iterator

from ..clients import McdClient
from .base import Adapter, Artifact

_SEED_SQL = (
    "SELECT id,type,title,status,created_at,updated_at "
    "FROM seeds WHERE status != 'archived'"
)


class McdAdapter(Adapter):
    name = "mycontentdev"
    label = "Editorial (mycontentdev)"

    def __init__(self, client: McdClient | None = None):
        self.client = client or McdClient()

    def available(self) -> bool:
        return self.client.available()

    def artifacts(self) -> Iterator[Artifact]:
        api_url = self.client.api_url
        for row in self.client.query(_SEED_SQL):
            yield Artifact(
                uid=f"mcd:{row['id']}",
                source="mycontentdev",
                kind=row["type"],
                title=row["title"],
                subject="physics",
                unit=None,
                chapter=None,
                status=row["status"],
                path=None,
                url=f"{api_url}/seed/{row['id']}",
                updated_at=row["updated_at"],
                meta={"seedId": row["id"]},
            )
```

- [ ] **Step 4: Run — expect PASS.** Run:

```bash
.venv\Scripts\python -m pytest tests/test_subsystem_adapters.py -k mcd -q
```

Expected: the 4 `McdAdapter` tests pass (e.g. `4 passed, ... deselected`).

- [ ] **Step 5: Commit.** Run:

```bash
git add samagra/adapters/mcd.py tests/test_subsystem_adapters.py
git commit -m "feat(adapters): McdAdapter normalizes mycontentdev seeds

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 1.5: `MunshiAdapter` (TDD)

**Files:**
- Modify `tests/test_subsystem_adapters.py`
- Create `samagra/adapters/munshi.py`

`MunshiAdapter(Adapter)` has `name="munshi"`, `label="Front Desk (munshi)"`, wraps a `MunshiClient`. `artifacts()` iterates `client.library()["items"]`, skips items whose `status == 'dismissed'`, and yields an `Artifact` per remaining item with the exact mapping from SHARED CONTRACTS. A module-private `_title_from(item)` derives a title (first line of payload text, else kind).

- [ ] **Step 1: Append the failing `MunshiAdapter` tests.** Add to `tests/test_subsystem_adapters.py`:

```python
# ---------------- MunshiAdapter ----------------

def test_munshi_adapter_identity():
    ad = MunshiAdapter()
    assert ad.name == "munshi"
    assert ad.label == "Front Desk (munshi)"


def test_munshi_adapter_available_delegates_to_client():
    assert MunshiAdapter(client=FakeMunshiClient(avail=True)).available() is True
    assert MunshiAdapter(client=FakeMunshiClient(avail=False)).available() is False


def test_munshi_adapter_skips_dismissed():
    lib = {"people": [], "total": 2, "items": [
        {"id": 1, "kind": "note", "status": "dismissed",
         "ts": "2026-06-01T00:00:00Z", "payload": {"text": "ignore me"}},
        {"id": 2, "kind": "note", "status": "open",
         "ts": "2026-06-02T00:00:00Z", "payload": {"text": "keep me"}},
    ]}
    arts = list(MunshiAdapter(client=FakeMunshiClient(library=lib)).artifacts())
    assert [a.uid for a in arts] == ["munshi:2"]


def test_munshi_adapter_maps_item_to_artifact():
    lib = {"people": [], "total": 1, "items": [{
        "id": 7,
        "kind": "todo",
        "status": "open",
        "ts": "2026-06-12T11:00:00Z",
        "payload": {"text": "Draft a Gauss's law worksheet"},
        "tags": ["physics", "worksheet"],
        "person": "Khanak",
        "due": "2026-06-20",
    }]}
    arts = list(MunshiAdapter(client=FakeMunshiClient(library=lib)).artifacts())
    assert len(arts) == 1
    a = arts[0]
    assert a.uid == "munshi:7"
    assert a.source == "munshi"
    assert a.kind == "todo"
    assert a.title == "Draft a Gauss's law worksheet"
    assert a.subject == "physics"
    assert a.unit is None
    assert a.chapter is None
    assert a.status == "open"
    assert a.path is None
    assert a.url is None
    assert a.updated_at == "2026-06-12T11:00:00Z"
    assert a.meta == {
        "payload": {"text": "Draft a Gauss's law worksheet"},
        "tags": ["physics", "worksheet"],
        "person": "Khanak",
        "due": "2026-06-20",
    }


def test_munshi_adapter_title_falls_back_to_kind():
    lib = {"people": [], "total": 1, "items": [{
        "id": 8, "kind": "issue", "status": "open",
        "ts": "2026-06-12T11:00:00Z", "payload": {},
    }]}
    a = list(MunshiAdapter(client=FakeMunshiClient(library=lib)).artifacts())[0]
    assert a.title == "issue"
    assert a.meta["tags"] is None and a.meta["person"] is None and a.meta["due"] is None
```

- [ ] **Step 2: Run — expect FAIL.** Run:

```bash
.venv\Scripts\python -m pytest tests/test_subsystem_adapters.py -k munshi -q
```

Expected: `ModuleNotFoundError: No module named 'samagra.adapters.munshi'`.

- [ ] **Step 3: Implement `MunshiAdapter` (full code).** Create `samagra/adapters/munshi.py`:

```python
"""munshi (front-desk) source adapter — read-only, intake-only.

Normalizes non-dismissed library items into Artifact records. item.kind in
[note,todo,issue,question,followup]; item.status in
[open,claimed_done,validated,dismissed]; item.payload is a dict.
"""
from __future__ import annotations

from typing import Iterator

from ..clients import MunshiClient
from .base import Adapter, Artifact


def _title_from(item: dict) -> str:
    """First non-empty line of the payload text, else the item kind."""
    payload = item.get("payload") or {}
    text = ""
    if isinstance(payload, dict):
        text = str(payload.get("text") or payload.get("body") or "").strip()
    elif isinstance(payload, str):
        text = payload.strip()
    if text:
        return text.splitlines()[0][:120]
    return item.get("kind") or "item"


class MunshiAdapter(Adapter):
    name = "munshi"
    label = "Front Desk (munshi)"

    def __init__(self, client: MunshiClient | None = None):
        self.client = client or MunshiClient()

    def available(self) -> bool:
        return self.client.available()

    def artifacts(self) -> Iterator[Artifact]:
        for item in self.client.library().get("items", []):
            if item.get("status") == "dismissed":
                continue
            yield Artifact(
                uid=f"munshi:{item['id']}",
                source="munshi",
                kind=item["kind"],
                title=_title_from(item),
                subject="physics",
                unit=None,
                chapter=None,
                status=item["status"],
                path=None,
                url=None,
                updated_at=item["ts"],
                meta={
                    "payload": item["payload"],
                    "tags": item.get("tags"),
                    "person": item.get("person"),
                    "due": item.get("due"),
                },
            )
```

- [ ] **Step 4: Run — expect PASS.** Run:

```bash
.venv\Scripts\python -m pytest tests/test_subsystem_adapters.py -k munshi -q
```

Expected: the 5 `MunshiAdapter` tests pass.

- [ ] **Step 5: Commit.** Run:

```bash
git add samagra/adapters/munshi.py tests/test_subsystem_adapters.py
git commit -m "feat(adapters): MunshiAdapter normalizes munshi library items

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 1.6: Register both adapters in `ALL_ADAPTERS` (TDD)

**Files:**
- Modify `tests/test_subsystem_adapters.py`
- Modify `samagra/adapters/__init__.py`

Append `McdAdapter()` and `MunshiAdapter()` to `ALL_ADAPTERS` so the catalog refresh picks them up. They are read-only and skip cleanly when creds are absent (`available()` returns False), so they don't break CI.

- [ ] **Step 1: Add the failing registration test.** Append to `tests/test_subsystem_adapters.py`:

```python
# ---------------- registration ----------------

def test_subsystem_adapters_registered():
    names = {a.name for a in ALL_ADAPTERS}
    assert {"mycontentdev", "munshi"} <= names
    assert isinstance(get_adapter("mycontentdev"), McdAdapter)
    assert isinstance(get_adapter("munshi"), MunshiAdapter)
```

- [ ] **Step 2: Run — expect FAIL.** Run:

```bash
.venv\Scripts\python -m pytest tests/test_subsystem_adapters.py -k registered -q
```

Expected: `AssertionError` — `{"mycontentdev", "munshi"}` not a subset of `names` (adapters not yet in the list).

- [ ] **Step 3: Add the imports to `samagra/adapters/__init__.py`.** Insert the two new imports alphabetically among the existing adapter imports:

```python
from .booklets import BookletAdapter
from .insp import INSPAdapter
from .mcd import McdAdapter
from .munshi import MunshiAdapter
from .qx import QXAdapter
```

- [ ] **Step 4: Append both to `ALL_ADAPTERS`.** Change the list literal to:

```python
ALL_ADAPTERS: list[Adapter] = [
    QXAdapter(),
    TextbookAdapter(),
    BookletAdapter(),
    INSPAdapter(),
    SimsAdapter(),
    QuestionDBAdapter(),
    McdAdapter(),
    MunshiAdapter(),
]
```

- [ ] **Step 5: Run — expect PASS, and confirm no regressions in the spine suite.** Run:

```bash
.venv\Scripts\python -m pytest tests/test_subsystem_adapters.py tests/test_spine.py -q
```

Expected: all pass (the spine `test_adapters_registered` still passes since it asserts a subset; subsystem adapters skip cleanly because `available()` is False without creds).

- [ ] **Step 6: Commit.** Run:

```bash
git add samagra/adapters/__init__.py tests/test_subsystem_adapters.py
git commit -m "feat(adapters): register McdAdapter + MunshiAdapter in ALL_ADAPTERS

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 1.7: Add the `"mycontentdev"` pipeline to `PIPELINES` (TDD)

**Files:**
- Test `tests/test_reflect_mycontentdev.py`
- Modify `samagra/state.py`

Add a `"mycontentdev"` pipeline whose phases mirror the seed lifecycle: `phases = ["capture","enrich","review","publish"]` with owners `["human","claude2","claude1","human"]`, and `review`/`publish` as gates. munshi is intake-only (reflected via its adapter), so it gets NO separate pipeline.

- [ ] **Step 1: Write the failing pipeline test.** Create `tests/test_reflect_mycontentdev.py` (the `_reflect_mycontentdev` tests are appended in Task 1.8):

```python
"""Tests for the mycontentdev pipeline entry and its scheduler reflector.

The McdClient is replaced by a fake returning canned seed-status rows, so the
status mapping is exercised with NO network access. State is redirected to a
tmp_path so tests don't touch the real state/ dir.
"""
from __future__ import annotations

import pytest

from samagra import scheduler, state


def test_mycontentdev_pipeline_registered():
    assert "mycontentdev" in state.PIPELINES
    spec = state.PIPELINES["mycontentdev"]
    assert spec["phases"] == ["capture", "enrich", "review", "publish"]
    assert spec["owners"] == {
        "capture": "human", "enrich": "claude2",
        "review": "claude1", "publish": "human",
    }
    assert "munshi" not in state.PIPELINES  # intake-only, no pipeline


def test_mycontentdev_pipeline_inits():
    spec = state.PIPELINES["mycontentdev"]
    # init builds a phase dict for every declared phase
    assert set(spec["phases"]) == {"capture", "enrich", "review", "publish"}
```

- [ ] **Step 2: Run — expect FAIL.** Run:

```bash
.venv\Scripts\python -m pytest tests/test_reflect_mycontentdev.py -k pipeline -q
```

Expected: `KeyError: 'mycontentdev'` / `AssertionError` — the pipeline isn't in `PIPELINES` yet.

- [ ] **Step 3: Add the pipeline to `PIPELINES`.** In `samagra/state.py`, insert this entry into the `PIPELINES` dict (after the `"textbook"` entry):

```python
    "mycontentdev": {
        "label": "Editorial (mycontentdev)",
        "phases": ["capture", "enrich", "review", "publish"],
        "gates": ["review", "publish"],
        "owners": {"capture": "human", "enrich": "claude2",
                   "review": "claude1", "publish": "human"},
    },
```

- [ ] **Step 4: Run — expect PASS.** Run:

```bash
.venv\Scripts\python -m pytest tests/test_reflect_mycontentdev.py -k pipeline -q
```

Expected: the 2 pipeline tests pass.

- [ ] **Step 5: Commit.** Run:

```bash
git add samagra/state.py tests/test_reflect_mycontentdev.py
git commit -m "feat(state): add mycontentdev pipeline mirroring seed lifecycle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 1.8: `_reflect_mycontentdev` scheduler reflector (TDD)

**Files:**
- Modify `tests/test_reflect_mycontentdev.py`
- Modify `samagra/scheduler.py`

Add `_reflect_mycontentdev(dry, events)` mirroring `_reflect_textbook`: read seed statuses via `McdClient`, map counts to phase status — any `draft_ready` (or `changes_requested`) ⇒ `review` phase `awaiting_gate` (a gate ready, append a `gate-ready` event); all seeds `done` ⇒ `publish` phase `done`. Use `state.load`/`set_phase`. Honor a missing-creds no-op: if the client isn't available, return `{"skipped": "no mcd creds"}` and touch nothing. The function builds its own `McdClient` by default but accepts an injected `client` for testing.

- [ ] **Step 1: Append the failing reflector tests.** Add to `tests/test_reflect_mycontentdev.py`:

```python
# ---------------- _reflect_mycontentdev ----------------

class FakeMcdClient:
    def __init__(self, statuses, avail=True):
        # statuses: list of seed status strings
        self._rows = [{"id": f"s{i}", "type": "concept", "title": f"t{i}",
                       "status": s, "created_at": "2026-06-01T00:00:00Z",
                       "updated_at": "2026-06-02T00:00:00Z"}
                      for i, s in enumerate(statuses)]
        self._avail = avail
        self.api_url = "https://mcd.example.dev"

    def available(self):
        return self._avail

    def query(self, sql):
        return self._rows


@pytest.fixture(autouse=True)
def _isolate_state(tmp_path, monkeypatch):
    monkeypatch.setattr(state.config, "STATE_DIR", tmp_path)
    yield


def test_reflect_skips_without_creds(monkeypatch):
    fake = FakeMcdClient([], avail=False)
    events = []
    out = scheduler._reflect_mycontentdev(dry=False, events=events,
                                          client=fake)
    assert out == {"skipped": "no mcd creds"}
    assert events == []


def test_reflect_review_gate_ready_when_draft_ready(monkeypatch):
    fake = FakeMcdClient(["captured", "draft_ready", "processing"])
    events = []
    scheduler._reflect_mycontentdev(dry=False, events=events, client=fake)
    st = state.load("mycontentdev")
    assert st["phases"]["review"]["status"] == "awaiting_gate"
    assert any(ev == "gate-ready" for ev, _ in events)


def test_reflect_publish_done_when_all_done(monkeypatch):
    fake = FakeMcdClient(["done", "done"])
    events = []
    scheduler._reflect_mycontentdev(dry=False, events=events, client=fake)
    st = state.load("mycontentdev")
    assert st["phases"]["publish"]["status"] == "done"


def test_reflect_dry_run_does_not_mutate_state(monkeypatch):
    fake = FakeMcdClient(["draft_ready"])
    events = []
    scheduler._reflect_mycontentdev(dry=True, events=events, client=fake)
    st = state.load("mycontentdev")
    # dry run still surfaces the event but never writes a non-pending phase
    assert st["phases"]["review"]["status"] == "pending"
    assert any(ev == "gate-ready" for ev, _ in events)
```

- [ ] **Step 2: Run — expect FAIL.** Run:

```bash
.venv\Scripts\python -m pytest tests/test_reflect_mycontentdev.py -k reflect -q
```

Expected: `AttributeError: module 'samagra.scheduler' has no attribute '_reflect_mycontentdev'`.

- [ ] **Step 3: Implement `_reflect_mycontentdev` (full code).** In `samagra/scheduler.py`, add the import at the top (extend the existing `from . import ...` line to include `clients`) and add the function below `_reflect_textbook`. First update the import line:

```python
from . import catalog, clients, config, notify, state
```

Then add the function (place it directly after `_reflect_textbook`):

```python
def _mcd_status_counts(client) -> dict:
    rows = client.query(
        "SELECT id,type,title,status,created_at,updated_at "
        "FROM seeds WHERE status != 'archived'"
    )
    total = len(rows)
    statuses = [r.get("status") for r in rows]
    return {
        "total": total,
        "draft_ready": sum(1 for s in statuses
                           if s in ("draft_ready", "changes_requested")),
        "done": sum(1 for s in statuses if s == "done"),
    }


def _reflect_mycontentdev(dry: bool, events: list, client=None) -> dict:
    client = client or clients.McdClient()
    if not client.available():
        return {"skipped": "no mcd creds"}
    c = _mcd_status_counts(client)
    st = state.load("mycontentdev")
    # All seeds done -> publish phase done.
    if c["total"] and c["done"] >= c["total"] and st["phases"]["publish"]["status"] != "done":
        if not dry:
            state.set_phase("mycontentdev", "publish", "done",
                            artifacts=[f'{c["done"]}/{c["total"]} done'])
    # Any draft_ready/changes_requested -> review gate ready.
    st = state.load("mycontentdev")
    if c["draft_ready"] and st["phases"]["review"]["status"] in ("pending",):
        if not dry:
            state.set_phase("mycontentdev", "review", "awaiting_gate")
        events.append(("gate-ready",
                       f'mycontentdev: "review" gate ready — {c["draft_ready"]} '
                       "seed(s) draft_ready, awaiting review."))
    return c
```

- [ ] **Step 4: Run — expect PASS.** Run:

```bash
.venv\Scripts\python -m pytest tests/test_reflect_mycontentdev.py -q
```

Expected: all `mycontentdev` tests pass (pipeline + reflector).

- [ ] **Step 5: Run the FULL suite to confirm no regressions.** Run:

```bash
.venv\Scripts\python -m pytest -q
```

Expected: all tests pass (existing `test_spine.py`, `test_lectures.py`, `test_scheduler.py` plus the three new files). Subsystem adapters skip cleanly when creds are absent, so the suite is green in CI.

- [ ] **Step 6: Commit.** Run:

```bash
git add samagra/scheduler.py tests/test_reflect_mycontentdev.py
git commit -m "feat(scheduler): _reflect_mycontentdev maps seed statuses to phases

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2 — Governance: store, Assignments tab, blocking Codex pre-commit hook, worktrees, org SVG

> **▶ BUILT + REVIEWED (2026-06-19) — reconciled to runbook D5/D6, suite 63 → 98 green, on `main`. Pre-merge Codex review (gpt-5.5/xhigh, 6 rounds) + a CEO adversarial Workflow audit → APPROVE; all findings fixed TDD (see `docs/codex-reviews/07–13` + `12-workflow-invariant-audit.md`). SHIPPED 2026-06-19: pushed to `origin/main`, advisory hook active (`core.hooksPath=.githooks`), 3 agent worktrees created. Next: Phase 3.**
> The task code below was stale against the authoritative runbook and was reconciled before building. **As-built deviations:**
> - **D6 (Task 2.1, 2.5):** the governance store lives in its own durable **`config.GOVERNANCE_DB` (`governance.db`)**, NOT the
>   catalog `samagra.db`. Added `SCHEMA_VERSION` (PRAGMA user_version) + a migration hook + a consistent `backup()`. The S-01
>   autouse fixture now also redirects `GOVERNANCE_DB`. `tests/test_governance.py` = 13 tests (incl. separation/schema/backup + the API route).
> - **D5 (Task 2.3, 2.4, 2.7 wording):** the pre-commit hook is **advisory-local**, not fail-closed. It blocks only a *confirmed*
>   CRITICAL (a second Codex pass agrees), memoizes by staged-diff hash (`state/review/diff_cache.json`), honors an audited
>   break-glass (`SAMAGRA_REVIEW_BREAKGLASS`, → `state/review/breakglass.log`), and a Codex that cannot run **warns and allows**
>   (never wedges). `tests/test_precommit.py` rewritten to match (9 tests). The "no escape hatch / fail-closed" wording in
>   Tasks 2.3–2.5 + the board `AGENTS.md` is retired.
> - **Task 2.5 test:** exercises the route function directly (repo convention, see `test_api_gate.py`) instead of `TestClient`, so no `httpx` dependency is added.
> - **Owner-gated, NOT run:** `git config core.hooksPath .githooks` (Task 2.4 step 3) and `git worktree add …` (Task 2.7 step 6) — committed the files, deferred activation to the Chairman.
>
> Still **carried in** (not yet built here): refresh per-adapter isolation + stale visibility (F1/F4) alongside the store's `stale`/`last_error` columns.

**Files:**
- **Create** `samagra/governance/__init__.py` — package marker for the governance store.
- **Create** `samagra/governance/store.py` — `samagra.db` tables (`assignments`, `events`, `review_overlay`) + CRUD/transition helpers, reusing the catalog connection pattern.
- **Create** `samagra/review/__init__.py` — package marker for the review tooling.
- **Create** `samagra/review/codex_dispatch.py` — minimal vendored Codex subprocess wrapper (`dispatch_codex` + `CodexResult` + `CodexError`).
- **Create** `samagra/review/precommit.py` — staged-diff Codex review; block iff a *confirmed* `CRITICAL` survives the diff-hash cache; **advisory-local per D5/D9** (not fail-closed — see banner at Task 2.3).
- **Create** `.githooks/pre-commit` — sh shim that runs `python -m samagra.review.precommit` for the repo and all worktrees.
- **Create** `board/deepak/AGENTS.md`, `board/khanak/AGENTS.md`, `board/codex/AGENTS.md` — per-agent role/authority/outbox docs committed in main.
- **Create** `board/deepak/outbox/.gitkeep`, `board/khanak/outbox/.gitkeep`, `board/codex/outbox/.gitkeep` — keep empty outbox dirs in git.
- **Create** `tests/test_governance.py` — TDD for the governance store.
- **Create** `tests/test_precommit.py` — TDD for the pre-commit verdict logic (mocking `dispatch_codex`).
- **Modify** `samagra/api/app.py` — add `GET /api/assignments` returning `{assignments, events}`.
- **Modify** `samagra/portal/templates/portal.html` — add the Assignments nav link.
- **Modify** `samagra/portal/static/app.js` — add `renderAssignments()` and register `TABS.assignments`.
- **Modify** `samagra/__main__.py` — add the `samagra review-staged` CLI verb.
- **Modify** `STATUS.html` — insert the inline-SVG org chart under a new `#org` section.

> Pre-req: Phase 0 has already renamed the package to `samagra/`, the DB to `samagra.db`, and `TASK_NAME='SAMAGRA-tick'`. All imports below use `samagra.*`. Run tests with the project venv from the repo root `C:\SandBox\claude_box\TeachingOS`:
> `.venv\Scripts\python -m pytest <path> -q`

---

### Task 2.1: Governance store — failing test first

**Files:**
- Create `tests/test_governance.py`
- Create `samagra/governance/__init__.py`
- Create `samagra/governance/store.py`

- [ ] **Step 1: Write the failing test for the governance store.** Create `tests/test_governance.py` with the full content below. It points `config.DATA_DB` at a temp DB so no real `samagra.db` is touched, then exercises every public function.

```python
"""Phase 2 governance-store tests (temp samagra.db; no real DB touched)."""
from __future__ import annotations

import sqlite3

import pytest

from samagra import config
from samagra.governance import store


@pytest.fixture()
def conn(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
    c = store.connect()
    store.init_tables(c)
    yield c
    c.close()


def test_init_tables_creates_three_tables(conn):
    names = {r[0] for r in conn.execute(
        "select name from sqlite_master where type='table'")}
    assert {"assignments", "events", "review_overlay"} <= names


def test_add_assignment_and_list(conn):
    store.add_assignment(
        conn, id="a1", agent="khanak",
        outbox_path="board/khanak/outbox/2026-06-19-01-x.md",
        pipeline="mycontentdev", seed_ref="mcd:7",
        expected_output="a draft", review_by="codex")
    rows = store.list_assignments(conn)
    assert len(rows) == 1
    r = rows[0]
    assert r["id"] == "a1"
    assert r["agent"] == "khanak"
    assert r["status"] == "queued"
    assert r["created_at"] and r["created_at"].endswith("Z")
    assert r["created_at"] == r["updated_at"]


def test_set_assignment_status_appends_event(conn):
    store.add_assignment(conn, id="a1", agent="khanak",
                         outbox_path="board/khanak/outbox/x.md")
    store.set_assignment_status(conn, "a1", "running")
    rows = store.list_assignments(conn)
    assert rows[0]["status"] == "running"
    assert rows[0]["updated_at"] >= rows[0]["created_at"]
    evs = store.list_events(conn)
    assert any(e["assignment_id"] == "a1" and e["verb"] == "status:running"
               for e in evs)


def test_set_assignment_status_rejects_unknown(conn):
    store.add_assignment(conn, id="a1", agent="khanak",
                         outbox_path="x.md")
    with pytest.raises(ValueError):
        store.set_assignment_status(conn, "a1", "bogus")


def test_append_event_standalone(conn):
    store.append_event(conn, actor="system", verb="bridge_scan",
                       subsystem="munshi", subsystem_ref="munshi:3",
                       note="auto")
    evs = store.list_events(conn)
    assert len(evs) == 1
    e = evs[0]
    assert e["actor"] == "system"
    assert e["verb"] == "bridge_scan"
    assert e["subsystem"] == "munshi"
    assert e["ts"].endswith("Z")


def test_add_review_records_verdict(conn):
    store.add_review(conn, subsystem="mycontentdev", subsystem_ref="mcd:7",
                     reviewer="khanak", verdict="approved",
                     artifact_uid="mcd:7", rationale="looks good")
    rows = [dict(r) for r in conn.execute("select * from review_overlay")]
    assert len(rows) == 1
    assert rows[0]["verdict"] == "approved"
    assert rows[0]["reviewer"] == "khanak"


def test_add_review_rejects_bad_verdict(conn):
    with pytest.raises(ValueError):
        store.add_review(conn, subsystem="mycontentdev", subsystem_ref="mcd:7",
                         reviewer="khanak", verdict="maybe")


def test_list_events_limit(conn):
    for i in range(5):
        store.append_event(conn, actor="system", verb=f"v{i}")
    assert len(store.list_events(conn, limit=3)) == 3
```

- [ ] **Step 2: Run the test and watch it FAIL.** The `samagra.governance` package does not exist yet.

```bash
.venv\Scripts\python -m pytest tests/test_governance.py -q
```

Expected: collection error / `ModuleNotFoundError: No module named 'samagra.governance'` (red).

- [ ] **Step 3: Create the package marker.** Create `samagra/governance/__init__.py`:

```python
"""Governance store: assignments, events ledger, board-review overlay."""
```

- [ ] **Step 4: Implement the store.** Create `samagra/governance/store.py` with the exact DDL and signatures from the SHARED CONTRACTS:

```python
"""Governance store — assignments, events ledger, and board-review overlay.

All tables live in the same `samagra.db` as the catalog. Connections are opened
with the catalog connection helper so we share one DB file. Timestamps are
UTC ISO 'YYYY-MM-DDTHH:MM:SSZ', matching state._now() / catalog._now().
"""
from __future__ import annotations

import sqlite3
import time

from .. import config

DDL = """
CREATE TABLE IF NOT EXISTS assignments (id TEXT PRIMARY KEY, agent TEXT NOT NULL, outbox_path TEXT NOT NULL, pipeline TEXT, seed_ref TEXT, artifact_ref TEXT, expected_output TEXT, review_by TEXT, status TEXT NOT NULL DEFAULT 'queued', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, actor TEXT NOT NULL, verb TEXT NOT NULL, assignment_id TEXT, subsystem TEXT, subsystem_ref TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS review_overlay (id INTEGER PRIMARY KEY AUTOINCREMENT, subsystem TEXT NOT NULL, subsystem_ref TEXT NOT NULL, artifact_uid TEXT, reviewer TEXT NOT NULL, verdict TEXT NOT NULL, rationale TEXT, ts TEXT NOT NULL);
"""

ASSIGNMENT_STATUS = {"queued", "running", "in-review", "approved", "changes"}
REVIEW_VERDICT = {"approved", "changes"}


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def connect() -> sqlite3.Connection:
    """Open `samagra.db` the same way the catalog does (shared DB file)."""
    config.DATA_DB.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(config.DATA_DB)
    con.row_factory = sqlite3.Row
    return con


def init_tables(conn: sqlite3.Connection) -> None:
    conn.executescript(DDL)
    conn.commit()


def add_assignment(conn, *, id, agent, outbox_path, pipeline=None,
                   seed_ref=None, artifact_ref=None, expected_output=None,
                   review_by=None) -> None:
    now = _now()
    conn.execute(
        "INSERT INTO assignments (id, agent, outbox_path, pipeline, seed_ref, "
        "artifact_ref, expected_output, review_by, status, created_at, updated_at) "
        "VALUES (?,?,?,?,?,?,?,?, 'queued', ?, ?)",
        (id, agent, outbox_path, pipeline, seed_ref, artifact_ref,
         expected_output, review_by, now, now),
    )
    conn.commit()


def set_assignment_status(conn, assignment_id, status) -> None:
    if status not in ASSIGNMENT_STATUS:
        raise ValueError(f"invalid assignment status {status!r}")
    now = _now()
    conn.execute(
        "UPDATE assignments SET status=?, updated_at=? WHERE id=?",
        (status, now, assignment_id),
    )
    append_event(conn, actor="system", verb=f"status:{status}",
                 assignment_id=assignment_id)
    conn.commit()


def append_event(conn, *, actor, verb, assignment_id=None, subsystem=None,
                 subsystem_ref=None, note=None) -> None:
    conn.execute(
        "INSERT INTO events (ts, actor, verb, assignment_id, subsystem, "
        "subsystem_ref, note) VALUES (?,?,?,?,?,?,?)",
        (_now(), actor, verb, assignment_id, subsystem, subsystem_ref, note),
    )
    conn.commit()


def add_review(conn, *, subsystem, subsystem_ref, reviewer, verdict,
               artifact_uid=None, rationale=None) -> None:
    if verdict not in REVIEW_VERDICT:
        raise ValueError(f"invalid verdict {verdict!r}")
    conn.execute(
        "INSERT INTO review_overlay (subsystem, subsystem_ref, artifact_uid, "
        "reviewer, verdict, rationale, ts) VALUES (?,?,?,?,?,?,?)",
        (subsystem, subsystem_ref, artifact_uid, reviewer, verdict,
         rationale, _now()),
    )
    conn.commit()


def list_assignments(conn) -> list[dict]:
    return [dict(r) for r in conn.execute(
        "SELECT * FROM assignments ORDER BY created_at, id")]


def list_events(conn, limit: int = 200) -> list[dict]:
    return [dict(r) for r in conn.execute(
        "SELECT * FROM events ORDER BY id DESC LIMIT ?", (limit,))]
```

- [ ] **Step 5: Run the test and watch it PASS.**

```bash
.venv\Scripts\python -m pytest tests/test_governance.py -q
```

Expected: `8 passed`.

- [ ] **Step 6: Commit.**

```bash
git add samagra/governance/__init__.py samagra/governance/store.py tests/test_governance.py
git commit -m "$(cat <<'EOF'
feat(governance): samagra.db store — assignments, events ledger, review overlay

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.2: Vendor a minimal Codex dispatch wrapper (verification-driven)

**Files:**
- Create `samagra/review/__init__.py`
- Create `samagra/review/codex_dispatch.py`

This is a mechanical port of `claude-booklet-proofer/scripts/codex_dispatch.py`, trimmed to the Phase-2 contract signature (`dispatch_codex(prompt, *, schema=None, timeout_s=90, max_attempts=2)`). Not test-first — it is a thin subprocess shim verified by import + a help/smoke check; the consumer (`precommit.py`) is the TDD'd unit in Task 2.3 and mocks this module.

- [ ] **Step 1: Create the package marker.** Create `samagra/review/__init__.py`:

```python
"""Pre-commit Codex review tooling (vendored dispatch + verdict logic)."""
```

- [ ] **Step 2: Vendor the dispatch wrapper.** Create `samagra/review/codex_dispatch.py`. The exe is resolved lazily (inside `dispatch_codex`) — NOT at import time — so `precommit.py` can be imported and unit-tested even when `codex` is absent on PATH.

```python
"""Minimal vendored Codex subprocess wrapper for the pre-commit review.

Adapted from claude-booklet-proofer/scripts/codex_dispatch.py. Only the bits the
pre-commit hook needs: a single `dispatch_codex(prompt, *, schema=...)` call that
shells `codex exec`, reads the structured final message from a temp JSON file,
and retries on malformed JSON. The exe is resolved lazily so this module imports
cleanly even when `codex` is not on PATH (the hook fails closed at call time).
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class CodexError(RuntimeError):
    pass


@dataclass
class CodexResult:
    parsed: dict[str, Any]
    raw: str
    elapsed_s: float
    attempts: int


def _resolve_codex_exe() -> str:
    exe = os.environ.get("CODEX_BIN") or shutil.which("codex")
    if not exe:
        raise CodexError(
            "Could not locate `codex` on PATH. Install Codex CLI "
            "(`npm i -g @openai/codex`) or set the CODEX_BIN environment variable."
        )
    return exe


def _strip_fences(raw: str) -> str:
    s = raw.strip()
    if s.startswith("```"):
        lines = s.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    return s


def dispatch_codex(
    prompt: str,
    *,
    schema: dict | None = None,
    timeout_s: int = 90,
    max_attempts: int = 2,
) -> CodexResult:
    """Invoke `codex exec` (read-only sandbox) and return the parsed JSON.

    The prompt is passed on stdin to avoid Windows shell-quoting issues. When a
    `schema` dict is given it is written to a temp file and passed via
    --output-schema. Raises CodexError on non-zero exit, empty output, or JSON
    parse failure after `max_attempts`.
    """
    exe = _resolve_codex_exe()
    schema_path: Path | None = None
    if schema is not None:
        sfd, sname = tempfile.mkstemp(suffix=".schema.json", prefix="codex_sch_")
        os.close(sfd)
        schema_path = Path(sname)
        schema_path.write_text(json.dumps(schema), encoding="utf-8")

    last_error: Exception | None = None
    raw_text = ""
    t0 = time.monotonic()
    attempt = 0
    try:
        while attempt < max_attempts:
            attempt += 1
            ofd, oname = tempfile.mkstemp(suffix=".json", prefix="codex_out_")
            os.close(ofd)
            out_path = Path(oname)
            try:
                args = [
                    exe, "exec", "--ephemeral", "--skip-git-repo-check",
                    "--sandbox", "read-only",
                    "--output-last-message", str(out_path),
                    "--color", "never",
                ]
                if schema_path is not None:
                    args += ["--output-schema", str(schema_path)]
                args.append("-")  # prompt on stdin
                proc = subprocess.run(
                    args, input=prompt, capture_output=True, text=True,
                    timeout=timeout_s, encoding="utf-8",
                )
                if proc.returncode != 0:
                    raise CodexError(
                        f"codex exited {proc.returncode}\nstderr tail:\n"
                        f"{(proc.stderr or '')[-2000:]}"
                    )
                raw_text = (out_path.read_text(encoding="utf-8").strip()
                            if out_path.exists() else "")
                if not raw_text:
                    raise CodexError("codex produced empty output-last-message")
                parsed = json.loads(_strip_fences(raw_text))
                return CodexResult(parsed=parsed, raw=raw_text,
                                   elapsed_s=time.monotonic() - t0,
                                   attempts=attempt)
            except (json.JSONDecodeError, CodexError) as e:
                last_error = e
                print(f"[codex-precommit] attempt={attempt} failed: {e}",
                      file=sys.stderr)
                if attempt < max_attempts:
                    time.sleep(2)
            finally:
                try:
                    out_path.unlink()
                except FileNotFoundError:
                    pass
    finally:
        if schema_path is not None:
            try:
                schema_path.unlink()
            except FileNotFoundError:
                pass

    raise CodexError(
        f"codex dispatch failed after {attempt} attempts "
        f"({time.monotonic() - t0:.1f}s). Last error: {last_error}"
    )
```

- [ ] **Step 3: Verify the module imports cleanly (no codex on PATH needed).**

```bash
.venv\Scripts\python -c "from samagra.review.codex_dispatch import dispatch_codex, CodexResult, CodexError; print('import OK')"
```

Expected output: `import OK` (proves the exe is NOT resolved at import time).

- [ ] **Step 4: Commit.**

```bash
git add samagra/review/__init__.py samagra/review/codex_dispatch.py
git commit -m "$(cat <<'EOF'
feat(review): vendor minimal Codex dispatch wrapper for pre-commit

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.3: Pre-commit verdict logic — failing test first (block on confirmed-CRITICAL; advisory-local)

> **SUPERSEDED by runbook D5/D9 (2026-06-19):** the steps below still implement the *retired* fail-closed / no-escape-hatch design. When Phase 2 is actually planned, rewrite this task to D5/D9: the local hook is **advisory** — it blocks only a *confirmed*-CRITICAL surviving the staged-diff-hash cache, carries an audited break-glass (`SAMAGRA_REVIEW_BREAKGLASS="<reason>"`, logged), and a Codex that cannot run does **NOT** wedge commits; real enforcement lives in CI / branch protection. The human publish gate (Gate 1) is the only sacred, never-automated block. Treat the fail-closed wording in Tasks 2.3–2.5 + the README block as historical until that rewrite lands.

**Files:**
- Create `tests/test_precommit.py`
- Create `samagra/review/precommit.py`

- [ ] **Step 1: Write the failing test.** Create `tests/test_precommit.py`. It monkeypatches `get_staged_diff` (so no real git is touched) and `dispatch_codex` (so no real Codex is invoked), then asserts the four required outcomes.

```python
"""Phase 2 pre-commit verdict tests. dispatch_codex + git diff are mocked —
no real Codex call and no real git invocation happen in CI."""
from __future__ import annotations

from samagra.review import precommit
from samagra.review.codex_dispatch import CodexError, CodexResult


def _result(findings):
    return CodexResult(parsed={"findings": findings}, raw="{}",
                       elapsed_s=0.1, attempts=1)


def test_critical_finding_blocks(monkeypatch):
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    monkeypatch.setattr(precommit, "dispatch_codex", lambda *a, **k: _result(
        [{"severity": "CRITICAL", "file": "x.py", "line": 3, "issue": "rm -rf"}]))
    assert precommit.review_staged_diff() == 1


def test_empty_findings_pass(monkeypatch):
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    monkeypatch.setattr(precommit, "dispatch_codex",
                        lambda *a, **k: _result([]))
    assert precommit.review_staged_diff() == 0


def test_high_only_does_not_block(monkeypatch):
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")
    monkeypatch.setattr(precommit, "dispatch_codex", lambda *a, **k: _result(
        [{"severity": "HIGH", "file": "x.py", "line": 9, "issue": "broad except"}]))
    assert precommit.review_staged_diff() == 0


def test_dispatch_error_fails_closed(monkeypatch):
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "diff --git a b")

    def boom(*a, **k):
        raise CodexError("codex not on PATH")

    monkeypatch.setattr(precommit, "dispatch_codex", boom)
    assert precommit.review_staged_diff() == 1


def test_empty_diff_passes_without_calling_codex(monkeypatch):
    monkeypatch.setattr(precommit, "get_staged_diff", lambda: "")

    def must_not_call(*a, **k):
        raise AssertionError("codex should not run on an empty diff")

    monkeypatch.setattr(precommit, "dispatch_codex", must_not_call)
    assert precommit.review_staged_diff() == 0
```

- [ ] **Step 2: Run the test and watch it FAIL.**

```bash
.venv\Scripts\python -m pytest tests/test_precommit.py -q
```

Expected: `ModuleNotFoundError: No module named 'samagra.review.precommit'` (red).

- [ ] **Step 3: Implement the verdict logic.** Create `samagra/review/precommit.py`. Note `dispatch_codex` is imported by name into this module so the test can monkeypatch `precommit.dispatch_codex`.

```python
"""Blocking pre-commit Codex review.

Logic: get the staged diff, ask Codex to review it against a findings schema,
and BLOCK the commit (exit 1) iff any finding has severity == CRITICAL. Empty
diff -> pass without calling Codex. HIGH/MED/LOW print but do not block.

Fail-closed: ANY exception (codex missing, timeout, JSON failure) blocks the
commit with loud diagnostics. There is no escape hatch by design.
"""
from __future__ import annotations

import subprocess
import sys

from .codex_dispatch import CodexError, dispatch_codex

FINDINGS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["findings"],
    "properties": {
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["severity", "file", "line", "issue"],
                "properties": {
                    "severity": {"enum": ["CRITICAL", "HIGH", "MED", "LOW"]},
                    "file": {"type": "string"},
                    "line": {"type": "integer"},
                    "issue": {"type": "string"},
                },
            },
        }
    },
}

_PROMPT = """You are SAMAGRA's blocking pre-commit code reviewer (Chief Architect / Codex).
Review the following STAGED git diff. Report only real defects in the changed
lines. Use severity CRITICAL only for: secret/credential leaks, destructive
shell/SQL (rm -rf, DROP/DELETE without WHERE), command/SQL injection, or code
that would corrupt data or break the build. Everything else is HIGH/MED/LOW.
Return JSON matching the schema: {{"findings": [{{"severity","file","line","issue"}}]}}.
Empty findings means the diff is safe to commit.

=== STAGED DIFF ===
{diff}
=== END DIFF ===
"""


def get_staged_diff() -> str:
    proc = subprocess.run(
        ["git", "diff", "--cached", "--unified=3"],
        capture_output=True, text=True, encoding="utf-8",
    )
    return proc.stdout or ""


def _print_findings(findings: list[dict], blocking: bool) -> None:
    label = "BLOCKING (CRITICAL)" if blocking else "non-blocking"
    for f in findings:
        print(f"  [{f.get('severity')}] {f.get('file')}:{f.get('line')} "
              f"{f.get('issue')}", file=sys.stderr)
    if not findings:
        print("  (no findings)", file=sys.stderr)
    print(f"codex review: {label}", file=sys.stderr)


def review_staged_diff() -> int:
    """Return 0 to allow the commit, 1 to block it. Fail-closed on any error."""
    try:
        diff = get_staged_diff()
        if not diff.strip():
            return 0  # nothing staged -> nothing to review
        result = dispatch_codex(
            _PROMPT.format(diff=diff),
            schema=FINDINGS_SCHEMA,
            timeout_s=90,
            max_attempts=2,
        )
        findings = result.parsed.get("findings") or []
        critical = [f for f in findings if f.get("severity") == "CRITICAL"]
        if critical:
            print("\n=== SAMAGRA pre-commit: COMMIT BLOCKED ===", file=sys.stderr)
            _print_findings(findings, blocking=True)
            return 1
        if findings:
            print("\n=== SAMAGRA pre-commit: advisory findings ===",
                  file=sys.stderr)
            _print_findings(findings, blocking=False)
        return 0
    except CodexError as e:
        return _fail_closed(str(e))
    except Exception as e:  # noqa: BLE001
        return _fail_closed(repr(e))


def _fail_closed(reason: str) -> int:
    print("\n=== SAMAGRA pre-commit: COMMIT BLOCKED (fail-closed) ===",
          file=sys.stderr)
    print(f"The Codex review could not complete: {reason}", file=sys.stderr)
    print("There is NO escape hatch — fix the cause, then re-commit:",
          file=sys.stderr)
    print("  * Ensure `codex` is on PATH (npm i -g @openai/codex) or set "
          "CODEX_BIN.", file=sys.stderr)
    print("  * Inspect what would be reviewed: git diff --cached --unified=3",
          file=sys.stderr)
    return 1


def main() -> None:
    sys.exit(review_staged_diff())


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the test and watch it PASS.**

```bash
.venv\Scripts\python -m pytest tests/test_precommit.py -q
```

Expected: `5 passed`.

- [ ] **Step 5: Add the `samagra review-staged` CLI verb.** In `samagra/__main__.py`, add the command handler. First add this function just below `cmd_export` (around line 88):

```python
def cmd_review_staged(args) -> None:
    from .review.precommit import review_staged_diff

    sys.exit(review_staged_diff())
```

- [ ] **Step 6: Register the subparser.** In `samagra/__main__.py`, just below the `export` subparser registration (the block ending with `e.set_defaults(func=cmd_export)`), add:

```python
    sub.add_parser(
        "review-staged",
        help="run the blocking Codex review over the staged diff (0=pass,1=block)",
    ).set_defaults(func=cmd_review_staged)
```

- [ ] **Step 7: Verify the CLI verb is wired (and is fail-closed when codex is absent).** With nothing staged it returns 0; if something CRITICAL were staged and codex were missing it would return 1. Smoke the parser registration:

```bash
.venv\Scripts\python -m samagra review-staged; echo "exit=$?"
```

Expected: `exit=0` on a clean staging area (empty diff short-circuits before Codex). If codex is absent AND a diff is staged, expect the fail-closed diagnostics block and `exit=1`.

- [ ] **Step 8: Commit.**

```bash
git add samagra/review/precommit.py samagra/__main__.py tests/test_precommit.py
git commit -m "$(cat <<'EOF'
feat(review): blocking pre-commit verdict — CRITICAL blocks, fail-closed, no escape hatch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.4: Install the committed `.githooks/pre-commit` hook (verification-driven)

**Files:**
- Create `.githooks/pre-commit`

This is ops, not new code: a one-line sh shim + a `git config` so the repo and every worktree inherit it. Verified by triggering a fake CRITICAL and confirming the commit is blocked.

- [ ] **Step 1: Create the hook script.** Create `.githooks/pre-commit` with exactly (LF line endings; works on Windows Git-Bash and POSIX):

```sh
#!/bin/sh
exec python -m samagra.review.precommit
```

- [ ] **Step 2: Mark the hook executable and normalise line endings.** Git tracks the exec bit; CRLF would break the shebang.

```bash
git update-index --chmod=+x .githooks/pre-commit
printf '#!/bin/sh\nexec python -m samagra.review.precommit\n' > .githooks/pre-commit
```

- [ ] **Step 3: Point git at the committed hooks dir (applies to the repo AND all worktrees).**

```bash
git config core.hooksPath .githooks
```

- [ ] **Step 4: Verify the config took.**

```bash
git config --get core.hooksPath
```

Expected output: `.githooks`

- [ ] **Step 5: Verify fail-closed/CRITICAL behavior end-to-end is reachable.** Confirm the hook runs the module (without needing a live codex, this confirms wiring; the verdict path itself is unit-tested in 2.3):

```bash
sh .githooks/pre-commit; echo "hook exit=$?"
```

Expected: with nothing staged, the module short-circuits and prints nothing -> `hook exit=0`. If `codex` is absent AND a diff is staged, the fail-closed diagnostics print and `hook exit=1`. (Do NOT add a bypass; there is no escape hatch.)

- [ ] **Step 6: Commit the hook.**

```bash
git add .githooks/pre-commit
git commit -m "$(cat <<'EOF'
chore(hooks): committed core.hooksPath pre-commit shim -> samagra.review.precommit

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 7: Document the one-time install in the README.** Append the following block to `README.md` (so worktrees and fresh clones know to run it):

```bash
cat >> README.md <<'EOF'

## Pre-commit Codex review (advisory-local + enforced-CI)

SAMAGRA ships a committed pre-commit hook that asks Codex to review the staged
diff and BLOCKS the commit if a *confirmed* finding has `severity == CRITICAL`
(cached by staged-diff hash). Enable it once per clone (it then applies to the
repo and every worktree):

```
git config core.hooksPath .githooks
```

Requirements: `codex` on PATH (`npm i -g @openai/codex`) or `CODEX_BIN` set.
The local hook is **advisory** (D5/D9): a confirmed-CRITICAL blocks, but if Codex
cannot run the commit is **not** wedged, and an audited break-glass
(`SAMAGRA_REVIEW_BREAKGLASS="<reason>"`, logged) exists for emergencies. Real
enforcement lives in CI / branch protection. Manual run:
`python -m samagra review-staged`.
EOF
```

- [ ] **Step 8: Verify and commit the README.**

```bash
grep -n "core.hooksPath" README.md
git add README.md
git commit -m "$(cat <<'EOF'
docs(readme): document the blocking pre-commit Codex hook install

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

Expected grep: a line containing `git config core.hooksPath .githooks`.

---

### Task 2.5: Assignments portal tab — API endpoint

**Files:**
- Modify `samagra/api/app.py`

The portal SPA pattern is verified: a `GET /api/...` returns JSON, `app.js` fetches it via `jget`. Endpoint correctness is checked by a unit test using FastAPI's `TestClient` against a temp DB.

- [ ] **Step 1: Write a failing API test.** Append this to `tests/test_governance.py`:

```python
def test_api_assignments_endpoint(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATA_DB", tmp_path / "samagra.db")
    c = store.connect()
    store.init_tables(c)
    store.add_assignment(c, id="a1", agent="khanak",
                         outbox_path="board/khanak/outbox/x.md")
    c.close()
    from fastapi.testclient import TestClient
    from samagra.api.app import app

    client = TestClient(app)
    r = client.get("/api/assignments")
    assert r.status_code == 200
    body = r.json()
    assert "assignments" in body and "events" in body
    assert any(a["id"] == "a1" for a in body["assignments"])
```

- [ ] **Step 2: Run it and watch it FAIL.**

```bash
.venv\Scripts\python -m pytest tests/test_governance.py::test_api_assignments_endpoint -q
```

Expected: `404` assertion failure (the route does not exist yet).

- [ ] **Step 3: Add the endpoint.** In `samagra/api/app.py`, add `governance.store` to the imports. Change the existing import line:

```python
from .. import catalog, config, scheduler, state
```

to:

```python
from .. import catalog, config, scheduler, state
from ..governance import store as gstore
```

- [ ] **Step 4: Add the route.** Insert this just below the existing `api_pipelines` route (after its `return` line, around line 93):

```python
@app.get("/api/assignments")
def api_assignments():
    conn = gstore.connect()
    gstore.init_tables(conn)
    try:
        return {"assignments": gstore.list_assignments(conn),
                "events": gstore.list_events(conn)}
    finally:
        conn.close()
```

- [ ] **Step 5: Run the API test and watch it PASS.**

```bash
.venv\Scripts\python -m pytest tests/test_governance.py::test_api_assignments_endpoint -q
```

Expected: `1 passed`.

- [ ] **Step 6: Commit.**

```bash
git add samagra/api/app.py tests/test_governance.py
git commit -m "$(cat <<'EOF'
feat(api): GET /api/assignments serving the governance store

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.6: Assignments portal tab — nav link + renderAssignments (verification-driven)

**Files:**
- Modify `samagra/portal/templates/portal.html`
- Modify `samagra/portal/static/app.js`

Static UI wiring — no Python test. Verified by grep (markup/JS present) and a live curl against the running portal.

- [ ] **Step 1: Add the nav link.** In `samagra/portal/templates/portal.html`, under the `Operate` group, after the existing Pipelines tab line:

```html
    <a class="tab" data-tab="pipelines">Pipelines</a>
```

add:

```html
    <a class="tab" data-tab="assignments">Assignments <span class="ct" id="ct-assignments"></span></a>
```

- [ ] **Step 2: Add `renderAssignments()` to `app.js`.** In `samagra/portal/static/app.js`, insert this function just before the `// ---- global search ----` comment (after `runTick`, around line 188). It uses the existing `jget`, `esc`, `table`, and `statusPill` helpers and sets the `#ct-assignments` badge.

```javascript
// ---- assignments (governance) ----
async function renderAssignments() {
  main.innerHTML = `<h1 class="page">Assignments</h1><p class="lede">Loading…</p>`;
  const d = await jget("/api/assignments");
  const aRows = (d.assignments || []).map(a => `<tr>
    <td>${esc(a.id)}</td><td>${esc(a.agent)}</td>
    <td>${esc(a.pipeline || "-")}</td>
    <td>${esc(a.seed_ref || a.artifact_ref || "-")}</td>
    <td>${statusPill(a.status)}</td>
    <td>${esc(a.review_by || "-")}</td>
    <td class="src">${esc(a.outbox_path)}</td></tr>`);
  const eRows = (d.events || []).map(e => `<tr>
    <td class="src">${esc(e.ts)}</td><td>${esc(e.actor)}</td>
    <td>${esc(e.verb)}</td><td>${esc(e.assignment_id || "-")}</td>
    <td>${esc(e.subsystem || "-")}</td><td>${esc(e.note || "")}</td></tr>`);
  main.innerHTML = `<h1 class="page">Assignments <span class="src">governance · outbox index</span></h1>
    <p class="lede">${(d.assignments || []).length} assignment(s) · board-routed via the outbox.</p>`
    + table(["ID", "Agent", "Pipeline", "Ref", "Status", "Review by", "Outbox"], aRows)
    + `<h3 style="margin:18px 0 8px">Events ledger</h3>`
    + table(["When", "Actor", "Verb", "Assignment", "Subsystem", "Note"], eRows);
  const ct = $("#ct-assignments");
  if (ct) ct.textContent = (d.assignments || []).length || "";
}
```

- [ ] **Step 3: Register the tab.** In the `TABS` object (around line 32-37), add `assignments: renderAssignments` to the map. Change:

```javascript
  sims: renderSims, pipelines: renderPipelines,
};
```

to:

```javascript
  sims: renderSims, pipelines: renderPipelines,
  assignments: renderAssignments,
};
```

- [ ] **Step 4: Verify the markup + JS are present.**

```bash
grep -n 'data-tab="assignments"' samagra/portal/templates/portal.html
grep -n 'renderAssignments' samagra/portal/static/app.js
```

Expected: the nav-link line in `portal.html`; both the function definition and the `TABS.assignments` registration in `app.js` (2 hits).

- [ ] **Step 5: Live-verify the endpoint over the running portal.** Start the portal in the background, then curl the API. (Port 8799 per `config.PORT`.)

```bash
.venv\Scripts\python -m samagra serve --port 8799 &
sleep 4
curl -s http://127.0.0.1:8799/api/assignments
kill %1
```

Expected: a JSON object like `{"assignments": [...], "events": [...]}` (HTTP 200). The keys are present even when empty.

- [ ] **Step 6: Commit.**

```bash
git add samagra/portal/templates/portal.html samagra/portal/static/app.js
git commit -m "$(cat <<'EOF'
feat(portal): Assignments tab — nav link + renderAssignments over /api/assignments

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.7: Per-agent worktrees + AGENTS.md (verification-driven)

**Files:**
- Create `board/deepak/AGENTS.md`, `board/khanak/AGENTS.md`, `board/codex/AGENTS.md`
- Create `board/deepak/outbox/.gitkeep`, `board/khanak/outbox/.gitkeep`, `board/codex/outbox/.gitkeep`

Ops work: commit the per-agent board files to main first, then create three worktrees off the renamed `samagra` repo. The hooksPath is inherited automatically (set in Task 2.4).

- [ ] **Step 1: Create Deepak's AGENTS.md.** Create `board/deepak/AGENTS.md`:

```markdown
# AGENTS.md — Deepak worktree (CEO outbox)

**Agent:** Claude-Deepak · **Title:** CEO · **Worktree branch:** `agent/deepak`

## Role
Orchestrator. Routes work, writes the outbox, owns gates and the semi-autonomous loop.

## Review authority
May review other agents' outputs and approve writes. Every approval is recorded in
`review_overlay` + `events` by this agent (workers never self-approve).

## Outbox
`board/deepak/outbox/` — dated markdown files `YYYY-MM-DD-NN-<slug>.md` indexed in the
`assignments` table. Paste an outbox file into the target agent's session to dispatch.

## Hooks
This worktree inherits the repo-wide blocking pre-commit Codex review via
`core.hooksPath = .githooks`. There is no escape hatch.
```

- [ ] **Step 2: Create Khanak's AGENTS.md.** Create `board/khanak/AGENTS.md`:

```markdown
# AGENTS.md — Khanak worktree (COO / CCO outbox)

**Agent:** Claude-Khanak · **Title:** COO / Chief Content Officer · **Worktree branch:** `agent/khanak`

## Role
Production. Parallel content generation, QA, linking, enrichment fan-out. Approves
worker content.

## Review authority
May review worker outputs and approve content writes. Approvals recorded in
`review_overlay` + `events`. Workers never self-approve.

## Outbox
`board/khanak/outbox/` — dated markdown files indexed in the `assignments` table.

## Hooks
Inherits the repo-wide blocking pre-commit Codex review (`core.hooksPath = .githooks`).
```

- [ ] **Step 3: Create Codex's AGENTS.md.** Create `board/codex/AGENTS.md`:

```markdown
# AGENTS.md — Codex worktree (Chief Architect outbox)

**Agent:** Codex · **Title:** Chief Architect & Code-Review Lead · **Worktree branch:** `agent/codex`

## Role
Architecture and the blocking pre-commit review. Approves code writes.

## Review authority
Owns the pre-commit Codex review (`samagra/review/precommit.py`). May review and approve
code writes. Approvals recorded in `review_overlay` + `events`.

## Outbox
`board/codex/outbox/` — dated markdown files indexed in the `assignments` table.

## Hooks
This agent's review IS the gate. The hook blocks on `severity == CRITICAL` and is
fail-closed — no escape hatch.
```

- [ ] **Step 4: Create the empty outbox keepers.** Create three `.gitkeep` files so the empty outbox dirs are tracked. Each file content is a single empty line:

```bash
mkdir -p board/deepak/outbox board/khanak/outbox board/codex/outbox
: > board/deepak/outbox/.gitkeep
: > board/khanak/outbox/.gitkeep
: > board/codex/outbox/.gitkeep
```

- [ ] **Step 5: Verify the board tree, then commit.**

```bash
ls board/deepak board/khanak board/codex board/deepak/outbox
git add board/
git commit -m "$(cat <<'EOF'
chore(board): per-agent AGENTS.md + empty outbox dirs (deepak/khanak/codex)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

Expected `ls`: `AGENTS.md` + `outbox/` in each agent dir; `.gitkeep` in `board/deepak/outbox`.

- [ ] **Step 6: Create the three worktrees off the renamed repo.** Run from the repo root; worktrees land as siblings (one level up).

```bash
git worktree add ../samagra-deepak -b agent/deepak
git worktree add ../samagra-khanak -b agent/khanak
git worktree add ../samagra-codex  -b agent/codex
```

- [ ] **Step 7: Verify the worktrees exist and inherit the hook.**

```bash
git worktree list
git -C ../samagra-deepak config --get core.hooksPath
```

Expected: `git worktree list` shows the main checkout plus the three `../samagra-*` worktrees on `agent/deepak`, `agent/khanak`, `agent/codex`; the second command prints `.githooks` (hook inherited — no per-worktree install needed). No commit needed here (worktree metadata is not committed; the branches are created locally).

---

### Task 2.8: Org-chart SVG in STATUS.html (verification-driven)

**Files:**
- Modify `STATUS.html`

Mechanical SVG insert. Verified by grep for the well-formed `<svg id="org-chart">` and a matching sidebar/nav anchor. (Open-in-browser is the user's job — do not attempt it.)

- [ ] **Step 1: Add the sidebar TOC anchor.** In `STATUS.html`, in the `<aside>` Contents list, after the Worker-routing entry (`<a href="#workers">Worker routing</a>`), add:

```html
  <a href="#org">Org chart</a>
```

- [ ] **Step 2: Add the header nav anchor.** In `STATUS.html` `<header class="top"><nav>`, after `<a href="#arch">Architecture</a><a href="#coverage">Coverage</a>`, add:

```html
    <a href="#org">Org</a>
```

- [ ] **Step 3: Insert the org-chart section + SVG.** In `STATUS.html`, insert the following block immediately before `<h2 id="tests">Tests</h2>` (i.e. right after the Worker-routing section closes). The SVG uses Inter, near-white background, accent indigo (#4f46e5), and is hand-crafted (Board → Workers → Departments).

```html
  <h2 id="org">Org chart</h2>
  <p>SAMAGRA as a company: a three-agent board with review/approval authority, a
  worker fleet that drafts (never self-approves), and the data/capture departments.</p>
  <svg id="org-chart" viewBox="0 0 920 540" width="100%"
       xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif"
       role="img" aria-label="SAMAGRA org chart">
    <style>
      #org-chart .box{rx:10;ry:10;stroke:#e3e3e8;stroke-width:1.5;fill:#fafafb}
      #org-chart .boss{fill:#4f46e5;stroke:#4338ca}
      #org-chart .board{fill:#eef0ff;stroke:#c7ccff}
      #org-chart .worker{fill:#f4f6fb;stroke:#d7dce8}
      #org-chart .dept{fill:#f7f7f5;stroke:#e6e6e0}
      #org-chart .t{font-size:13px;font-weight:600;fill:#1c1c22}
      #org-chart .tw{font-size:13px;font-weight:600;fill:#ffffff}
      #org-chart .s{font-size:11px;fill:#6b6b76}
      #org-chart .sw{font-size:11px;fill:#dfe1ff}
      #org-chart .lbl{font-size:11px;font-weight:600;fill:#4f46e5;letter-spacing:.06em}
      #org-chart line{stroke:#c7ccd6;stroke-width:1.5}
    </style>

    <!-- connectors: BOSS -> board -->
    <line x1="460" y1="78" x2="460" y2="104"/>
    <line x1="180" y1="118" x2="740" y2="118"/>
    <line x1="180" y1="118" x2="180" y2="138"/>
    <line x1="460" y1="118" x2="460" y2="138"/>
    <line x1="740" y1="118" x2="740" y2="138"/>
    <!-- board -> workers -->
    <line x1="460" y1="210" x2="460" y2="240"/>
    <line x1="160" y1="254" x2="760" y2="254"/>
    <line x1="160" y1="254" x2="160" y2="274"/>
    <line x1="460" y1="254" x2="460" y2="274"/>
    <line x1="760" y1="254" x2="760" y2="274"/>
    <!-- workers -> departments -->
    <line x1="460" y1="346" x2="460" y2="378"/>

    <!-- BOSS -->
    <text class="lbl" x="460" y="28" text-anchor="middle">BOARD</text>
    <rect class="box boss" x="360" y="40" width="200" height="40"/>
    <text class="tw" x="460" y="58" text-anchor="middle">Deepak — the BOSS</text>
    <text class="sw" x="460" y="73" text-anchor="middle">Founder &amp; Chairman · final publish gate</text>

    <!-- board agents -->
    <rect class="box board" x="80" y="138" width="200" height="58"/>
    <text class="t" x="180" y="162" text-anchor="middle">Claude-Deepak</text>
    <text class="s" x="180" y="178" text-anchor="middle">CEO · orchestrator,</text>
    <text class="s" x="180" y="191" text-anchor="middle">outbox, gates, the loop</text>

    <rect class="box board" x="360" y="138" width="200" height="58"/>
    <text class="t" x="460" y="162" text-anchor="middle">Claude-Khanak</text>
    <text class="s" x="460" y="178" text-anchor="middle">COO / CCO · production,</text>
    <text class="s" x="460" y="191" text-anchor="middle">QA, enrichment fan-out</text>

    <rect class="box board" x="640" y="138" width="200" height="58"/>
    <text class="t" x="740" y="162" text-anchor="middle">Codex</text>
    <text class="s" x="740" y="178" text-anchor="middle">Chief Architect ·</text>
    <text class="s" x="740" y="191" text-anchor="middle">blocking pre-commit review</text>

    <!-- workers -->
    <text class="lbl" x="460" y="232" text-anchor="middle">WORKERS — drafts only, never self-approve</text>
    <rect class="box worker" x="60" y="274" width="200" height="58"/>
    <text class="t" x="160" y="298" text-anchor="middle">Gemini + NotebookLM</text>
    <text class="s" x="160" y="316" text-anchor="middle">Director, Research &amp; Media</text>

    <rect class="box worker" x="360" y="274" width="200" height="58"/>
    <text class="t" x="460" y="298" text-anchor="middle">Grok</text>
    <text class="s" x="460" y="316" text-anchor="middle">Director, Realtime Intel &amp; Imagery</text>

    <rect class="box worker" x="660" y="274" width="200" height="58"/>
    <text class="t" x="760" y="298" text-anchor="middle">Hermes</text>
    <text class="s" x="760" y="316" text-anchor="middle">Chief of Staff (Ops &amp; Comms)</text>

    <!-- departments -->
    <text class="lbl" x="460" y="370" text-anchor="middle">DEPARTMENTS — data / capture surfaces</text>
    <rect class="box dept" x="40" y="392" width="120" height="40"/>
    <text class="t" x="100" y="412" text-anchor="middle">munshi</text>
    <text class="s" x="100" y="426" text-anchor="middle">Front Desk</text>
    <rect class="box dept" x="170" y="392" width="120" height="40"/>
    <text class="t" x="230" y="412" text-anchor="middle">mycontentdev</text>
    <text class="s" x="230" y="426" text-anchor="middle">Editorial</text>
    <rect class="box dept" x="300" y="392" width="120" height="40"/>
    <text class="t" x="360" y="412" text-anchor="middle">QX</text>
    <text class="s" x="360" y="426" text-anchor="middle">Question Bank</text>
    <rect class="box dept" x="430" y="392" width="120" height="40"/>
    <text class="t" x="490" y="412" text-anchor="middle">physics-textbook</text>
    <text class="s" x="490" y="426" text-anchor="middle">Lectures</text>
    <rect class="box dept" x="560" y="392" width="120" height="40"/>
    <text class="t" x="620" y="412" text-anchor="middle">booklets</text>
    <text class="s" x="620" y="426" text-anchor="middle">Print / Proofing</text>
    <rect class="box dept" x="690" y="392" width="100" height="40"/>
    <text class="t" x="740" y="412" text-anchor="middle">INSP</text>
    <text class="s" x="740" y="426" text-anchor="middle">Olympiad</text>
    <rect class="box dept" x="40" y="442" width="120" height="40"/>
    <text class="t" x="100" y="462" text-anchor="middle">pratyaksh</text>
    <text class="s" x="100" y="476" text-anchor="middle">Sims · read-only</text>
    <rect class="box dept" x="170" y="442" width="120" height="40"/>
    <text class="t" x="230" y="462" text-anchor="middle">GN-OCR</text>
    <text class="s" x="230" y="476" text-anchor="middle">Handwriting</text>
  </svg>
```

- [ ] **Step 4: Verify the SVG and anchors are present and well-formed.**

```bash
grep -n 'id="org-chart"' STATUS.html
grep -n 'href="#org"' STATUS.html
.venv\Scripts\python -c "import xml.dom.minidom,re,sys; h=open('STATUS.html',encoding='utf-8').read(); m=re.search(r'<svg id=\"org-chart\".*?</svg>', h, re.S); xml.dom.minidom.parseString(m.group(0)); print('SVG well-formed')"
```

Expected: a hit for `id="org-chart"`; two hits for `href="#org"` (sidebar + header nav); and `SVG well-formed` (the SVG parses as valid XML). Do NOT open it in a browser — the user does that.

- [ ] **Step 5: Commit.**

```bash
git add STATUS.html
git commit -m "$(cat <<'EOF'
docs(status): hand-crafted inline-SVG org chart (board / workers / departments)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.9: Phase 2 green gate — full suite

**Files:** (none — verification only)

- [ ] **Step 1: Run the entire test suite from the repo root.** Phase 2 must end green before Phase 3 begins (slice-1 style: source-dependent tests skip cleanly).

```bash
.venv\Scripts\python -m pytest -q
```

Expected: all Phase-2 tests pass (`tests/test_governance.py` 9 passed, `tests/test_precommit.py` 5 passed) alongside the existing slice-1 suite; no failures (only `skipped` for absent sources). Confirm the printed summary shows `0 failed`.

- [ ] **Step 2: Final Phase-2 verification commit (only if any uncommitted churn remains).** If `git status` is clean, skip. Otherwise:

```bash
git status --short
git add -A
git commit -m "$(cat <<'EOF'
test(governance): Phase 2 green — store, precommit, assignments API verified

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

Expected: a clean tree, full suite green — Phase 2 governance layer complete (store, Assignments tab, blocking fail-closed Codex hook, per-agent worktrees, org SVG).

---

## Phase 3 — Active loop (munshi item → classify → proposed seed payload with exact pointers → board-review assignment → on approval, create seed via capture API)

> **✅ BUILT + MERGED to `main` 2026-06-23 (un-parked).** Phase 3 (the active loop / bridge) was implemented TDD on
> branch **`phase3/active-loop`** and **fast-forward-merged to `main` (`88d31e0`; not yet pushed to `origin/main`)**
> per the **reconciled** spec/plan
> [`specs/2026-06-22-phase3-active-loop-design.md`](../specs/2026-06-22-phase3-active-loop-design.md) +
> [`plans/2026-06-22-phase3-active-loop.md`](2026-06-22-phase3-active-loop.md), which **supersede the task
> breakdown below** (the 2026-06-19 tasks predate the ralph/capture merges; 4 reconciliations applied — R1 flat
> payload, R2 real munshi keys, R3 idempotent `captured`, post-D6 `store.connect()`). A **Codex pre-merge review**
> (reports `docs/codex-reviews/22,23`) returned **NO-GO** on prod double-write robustness → all findings remediated
> TDD (H3 status-blind scan dedup · H1 fail-safe in-flight guard · M1 write-boundary validation · M2 graceful
> munshi-down · Low word-boundary classify) → re-review **GO-WITH-CAVEATS, all resolved**. Gate **272 pytest**;
> golden thread proven live (seed `seed_01KVRFPPT98HJVQ5NRBJ63MKR3`). The design intent below (single board-approved
> write path) is unchanged and was honoured. *(Historical context kept below.)* ⏸ Originally PARKED 2026-06-20
> behind the SAMAGRA OS Experience track.

This phase wires the only write path in SAMAGRA. It reads munshi items (via the Phase-1 `MunshiAdapter`), classifies each as `content` vs `ops`, builds an exact `POST /api/seeds` payload (with corpus pointers resolved from the FTS5 catalog) for content items, queues each as a board-review assignment (`status='in-review'`, never writing to mycontentdev), and — only after a board agent flips the assignment to `approved` — creates the seed via `McdClient.create_seed`. `scan` is strictly read-only; `submit` refuses any non-approved assignment. All HTTP clients are mocked in tests; no live-prod calls in CI.

**Files:**

- **Create** `samagra/bridge/__init__.py` — marks the bridge package; empty.
- **Create** `samagra/bridge/classify.py` — `classify_item(item) -> "content"|"ops"`, a pure function over a munshi item dict.
- **Create** `samagra/bridge/pointers.py` — `resolve_pointers(text, *, limit=5) -> list[dict]`, FTS5 candidate lookup over `samagra.catalog`.
- **Create** `samagra/bridge/seed_payload.py` — `build_seed_payload(item, pointers) -> dict`, the exact `POST /api/seeds` body (incl. `detail.pointers`).
- **Create** `samagra/bridge/run.py` — `scan(dry=True) -> list[dict]` (classify + propose, no write) and `submit(assignment_id) -> dict` (approval-gated seed creation).
- **Modify** `samagra/__main__.py` — add CLI verbs `bridge scan [--dry-run]` and `bridge submit <assignmentId>`.
- **Create** `tests/test_bridge.py` — TDD coverage: `classify_item` table, `resolve_pointers` over a temp catalog, exact `build_seed_payload` body, `scan` (no write / no `create_seed`), `submit` (refuses non-approved; one `create_seed` + event on approved).

---

### Task 3.1: Create the bridge package + `classify_item`

**Files:**
- Create `samagra/bridge/__init__.py`
- Create `samagra/bridge/classify.py`
- Create `tests/test_bridge.py` (first test only)

- [ ] **Step 1: Create the empty bridge package marker.**
  Create `samagra/bridge/__init__.py` with exactly:
  ```python
  """SAMAGRA active loop: munshi item -> classify -> proposed seed -> board review -> capture."""
  ```

- [ ] **Step 2: Write the failing test for `classify_item`.**
  Create `tests/test_bridge.py`:
  ```python
  """Phase 3 — active-loop bridge tests. All HTTP clients are mocked; no live calls."""
  from __future__ import annotations

  import pytest

  from samagra.bridge.classify import classify_item


  def _item(kind, payload, **kw):
      base = {"id": "i1", "kind": kind, "payload": payload, "status": "open"}
      base.update(kw)
      return base


  @pytest.mark.parametrize(
      "item,expected",
      [
          # physics-ish notes/questions -> content
          (_item("question", {"text": "Find the work done by friction on a block?"}), "content"),
          (_item("note", {"text": "Nice intuition for Gauss's law and electric flux"}), "content"),
          # ops: issues / followups / person-directed
          (_item("issue", {"text": "Projector in room 4 is broken"}), "ops"),
          (_item("followup", {"text": "Call the parent about fees"}, person="Riya"), "ops"),
          # a plain note with no physics signal -> ops
          (_item("note", {"text": "Buy more whiteboard markers"}), "ops"),
          # todo defaults to ops unless it reads like a content idea
          (_item("todo", {"text": "Order new chairs"}), "ops"),
          (_item("todo", {"text": "Make a question on rotational kinetic energy"}), "content"),
      ],
  )
  def test_classify_item(item, expected):
      assert classify_item(item) == expected
  ```

- [ ] **Step 3: Run the test, expect FAIL (ModuleNotFoundError).**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge.py -q
  ```
  Expected: `ModuleNotFoundError: No module named 'samagra.bridge.classify'` (collection error).

- [ ] **Step 4: Implement `classify_item` (minimal, pure).**
  Create `samagra/bridge/classify.py`:
  ```python
  """Heuristic: is a munshi item a content-seed candidate or an ops todo?

  Pure function over the item dict. No I/O. Conservative: when in doubt, 'ops'
  (ops items just stay in munshi; mis-routing a note to ops is cheaper than
  proposing a junk seed).
  """
  from __future__ import annotations

  # Physics-ish vocabulary — coarse on purpose; the board reviews every proposal.
  _PHYSICS_TERMS = (
      "force", "energy", "work", "friction", "momentum", "velocity",
      "acceleration", "gravity", "gravitation", "field", "electric",
      "magnetic", "flux", "gauss", "charge", "current", "voltage", "ohm",
      "circuit", "wave", "optics", "lens", "mirror", "refraction", "diffraction",
      "thermodynamics", "entropy", "heat", "temperature", "pressure",
      "rotational", "torque", "kinetic", "potential", "oscillation", "pendulum",
      "capacitor", "inductor", "resistor", "photon", "quantum", "nucleus",
      "physics", "newton", "joule", "kepler", "doppler",
  )

  # Item kinds that are content candidates when the text looks physics-ish.
  _CONTENT_KINDS = {"note", "question"}


  def _text_of(item: dict) -> str:
      payload = item.get("payload") or {}
      if isinstance(payload, dict):
          parts = [str(v) for v in payload.values() if isinstance(v, (str, int, float))]
          text = " ".join(parts)
      else:
          text = str(payload)
      return f"{text} {item.get('kind', '')}".lower()


  def _looks_physics(text: str) -> bool:
      return any(term in text for term in _PHYSICS_TERMS)


  def _looks_like_question(text: str) -> bool:
      return "?" in text


  def classify_item(item: dict) -> str:
      """Return 'content' or 'ops' for a single munshi item dict."""
      kind = (item.get("kind") or "").lower()
      text = _text_of(item)

      # Person-directed work, issues, and followups are operational.
      if kind in {"issue", "followup"}:
          return "ops"
      if item.get("person"):
          return "ops"

      if kind == "question":
          return "content"
      if kind == "note":
          return "content" if (_looks_physics(text) or _looks_like_question(text)) else "ops"
      if kind == "todo":
          # A todo is ops unless it reads like a content idea.
          return "content" if _looks_physics(text) else "ops"
      return "ops"
  ```

- [ ] **Step 5: Run the test, expect PASS.**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge.py -q
  ```
  Expected: `7 passed`.

- [ ] **Step 6: Commit.**
  ```bash
  git add samagra/bridge/__init__.py samagra/bridge/classify.py tests/test_bridge.py
  git commit -m "feat(bridge): classify munshi items as content vs ops

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 3.2: `resolve_pointers` — FTS5 candidate lookup

**Files:**
- Create `samagra/bridge/pointers.py`
- Modify `tests/test_bridge.py` (add the pointers test + a temp-catalog fixture)

- [ ] **Step 1: Write the failing test for `resolve_pointers`.**
  Append to `tests/test_bridge.py` (after the imports add `import sqlite3`, `from samagra import catalog, config`, `from samagra.bridge.pointers import resolve_pointers`):
  ```python
  @pytest.fixture
  def temp_catalog(tmp_path, monkeypatch):
      """Point config.DATA_DB at a temp DB and seed three catalog rows."""
      db = tmp_path / "samagra.db"
      monkeypatch.setattr(config, "DATA_DB", db)
      con = catalog.connect()  # creates SCHEMA incl. catalog_fts
      rows = [
          ("qx:doc:gauss-1", "qx", "question", "Gauss law flux through a cube",
           "physics", None, "Electrostatics", None, None, None, None, "{}"),
          ("tb:ch:work-energy", "physics-textbook", "chapter",
           "Work, Energy and Power", "physics", None, "Mechanics",
           None, None, None, None, "{}"),
          ("insp:p:optics-9", "insp", "problem", "Lens refraction olympiad set",
           "physics", None, "Optics", None, None, None, None, "{}"),
      ]
      cur = con.cursor()
      for r in rows:
          cur.execute("insert into catalog values(?,?,?,?,?,?,?,?,?,?,?,?)", r)
          cur.execute(
              "insert into catalog_fts(uid,title,subject,chapter,kind,source) "
              "values(?,?,?,?,?,?)",
              (r[0], r[3], r[4], r[6], r[2], r[1]),
          )
      con.commit()
      con.close()
      return db


  def test_resolve_pointers_finds_candidates(temp_catalog):
      ptrs = resolve_pointers("Gauss law electric flux", limit=5)
      assert any(p["uid"] == "qx:doc:gauss-1" for p in ptrs)
      # shape: exactly uid/source/kind/title keys
      for p in ptrs:
          assert set(p.keys()) == {"uid", "source", "kind", "title"}


  def test_resolve_pointers_respects_limit(temp_catalog):
      ptrs = resolve_pointers("work energy lens gauss", limit=2)
      assert len(ptrs) <= 2


  def test_resolve_pointers_empty_text_returns_empty(temp_catalog):
      assert resolve_pointers("", limit=5) == []
  ```

- [ ] **Step 2: Run the new tests, expect FAIL.**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge.py -q -k resolve_pointers
  ```
  Expected: `ModuleNotFoundError: No module named 'samagra.bridge.pointers'`.

- [ ] **Step 3: Implement `resolve_pointers` over the catalog FTS5 search.**
  Create `samagra/bridge/pointers.py`:
  ```python
  """Resolve corpus pointers for a munshi item by FTS5-searching the catalog.

  Read-only over samagra.db via samagra.catalog.search(). Returns a compact
  list of candidate artifacts to attach to a proposed seed's detail/meta so
  downstream enrichment knows where the idea connects in the existing corpus.
  """
  from __future__ import annotations

  from .. import catalog


  def resolve_pointers(text: str, *, limit: int = 5) -> list[dict]:
      """Return up to `limit` candidate corpus artifacts as
      [{uid, source, kind, title}], best-match first. Empty text -> []."""
      query = (text or "").strip()
      if not query:
          return []
      rows = catalog.search(query, limit=limit)
      return [
          {
              "uid": r["uid"],
              "source": r["source"],
              "kind": r["kind"],
              "title": r["title"],
          }
          for r in rows
      ]
  ```

- [ ] **Step 4: Run the tests, expect PASS.**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge.py -q -k resolve_pointers
  ```
  Expected: `3 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add samagra/bridge/pointers.py tests/test_bridge.py
  git commit -m "feat(bridge): resolve corpus pointers via catalog FTS5 search

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 3.3: `build_seed_payload` — exact `POST /api/seeds` body

The real capture endpoint (`mycontentdev/functions/api/seeds/index.js`) accepts a `type`, `raw_text`, and a per-type `detail` JSON. For `rough_idea`, `shared/schema/seedDetail.mjs` defines `detail` keys `{braindump, possible_directions, proposed_type, rationale}`. We add a `pointers` key inside `detail` (the validator drops unknown keys server-side, so this is non-breaking for the canonical shape while carrying provenance for our own enrichment). `question` items map to `type:'question'`; everything else defaults to `rough_idea`.

**Files:**
- Create `samagra/bridge/seed_payload.py`
- Modify `tests/test_bridge.py` (add the payload test)

- [ ] **Step 1: Write the failing test asserting the EXACT payload body.**
  Append to `tests/test_bridge.py` (add `from samagra.bridge.seed_payload import build_seed_payload` to imports):
  ```python
  def test_build_seed_payload_rough_idea_exact_body():
      item = {
          "id": "m42",
          "kind": "note",
          "payload": {"text": "Idea: show work done by friction with a slider"},
          "status": "open",
      }
      pointers = [
          {"uid": "tb:ch:work-energy", "source": "physics-textbook",
           "kind": "chapter", "title": "Work, Energy and Power"},
          {"uid": "qx:doc:gauss-1", "source": "qx",
           "kind": "question", "title": "Gauss law flux through a cube"},
      ]
      body = build_seed_payload(item, pointers)
      assert body == {
          "type": "rough_idea",
          "raw_text": "Idea: show work done by friction with a slider",
          "detail": {
              "braindump": "Idea: show work done by friction with a slider",
              "possible_directions": [
                  "Work, Energy and Power",
                  "Gauss law flux through a cube",
              ],
              "proposed_type": "rough_idea",
              "rationale": "auto-bridged from munshi",
              "pointers": pointers,
          },
      }


  def test_build_seed_payload_question_maps_type():
      item = {"id": "q7", "kind": "question",
              "payload": {"text": "A 2 kg block slides down a 30 deg incline; find a."},
              "status": "open"}
      body = build_seed_payload(item, [])
      assert body["type"] == "question"
      assert body["detail"]["proposed_type"] == "question"
      assert body["raw_text"] == "A 2 kg block slides down a 30 deg incline; find a."
      assert body["detail"]["possible_directions"] == []
      assert body["detail"]["pointers"] == []
  ```

- [ ] **Step 2: Run the new tests, expect FAIL.**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge.py -q -k build_seed_payload
  ```
  Expected: `ModuleNotFoundError: No module named 'samagra.bridge.seed_payload'`.

- [ ] **Step 3: Implement `build_seed_payload`.**
  Create `samagra/bridge/seed_payload.py`:
  ```python
  """Build the exact POST /api/seeds capture body for a munshi item.

  Mirrors mycontentdev/functions/api/seeds/index.js (type, raw_text, detail) and
  the rough_idea/question shapes in shared/schema/seedDetail.mjs. We carry the
  resolved corpus pointers inside `detail.pointers` for downstream enrichment;
  the server's validator ignores unknown detail keys, so this stays compatible.
  """
  from __future__ import annotations


  def _text_of(item: dict) -> str:
      """Verbatim text of the munshi item's payload."""
      payload = item.get("payload") or {}
      if isinstance(payload, dict):
          if isinstance(payload.get("text"), str):
              return payload["text"]
          parts = [str(v) for v in payload.values()
                   if isinstance(v, (str, int, float))]
          return " ".join(parts)
      return str(payload)


  def _map_kind(kind: str) -> str:
      """Map a munshi item kind to a mycontentdev seed type (default rough_idea)."""
      return "question" if (kind or "").lower() == "question" else "rough_idea"


  def build_seed_payload(item: dict, pointers: list[dict]) -> dict:
      """Return the POST /api/seeds body (type, raw_text, detail incl. pointers)."""
      kind = item.get("kind") or ""
      seed_type = _map_kind(kind)
      text = _text_of(item)
      return {
          "type": seed_type,
          "raw_text": text,
          "detail": {
              "braindump": text,
              "possible_directions": [p["title"] for p in pointers],
              "proposed_type": seed_type,
              "rationale": "auto-bridged from munshi",
              "pointers": pointers,
          },
      }
  ```

- [ ] **Step 4: Run the tests, expect PASS.**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge.py -q -k build_seed_payload
  ```
  Expected: `2 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add samagra/bridge/seed_payload.py tests/test_bridge.py
  git commit -m "feat(bridge): build exact POST /api/seeds payload with pointers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 3.4: `run.scan(dry=True)` — propose, never write

`scan` reads munshi items through the Phase-1 `MunshiAdapter`, keeps the `content`-classified ones, and for each builds pointers + a proposed payload. On `dry=True` (default) it returns proposals and writes nothing. On `dry=False` it records a board-review assignment (`governance.store.add_assignment`, then `set_assignment_status(..., 'in-review')` to append the transition event) with `agent='khanak'` — it still must NOT call `create_seed`.

**Files:**
- Create `samagra/bridge/run.py` (scan only; submit added in Task 3.5)
- Modify `tests/test_bridge.py` (add scan tests)

- [ ] **Step 1: Write the failing tests for `scan`.**
  Append to `tests/test_bridge.py` (add `from samagra.bridge import run` to imports):
  ```python
  class _FakeMunshiAdapter:
      """Stand-in for samagra.adapters.munshi.MunshiAdapter — yields Artifacts."""

      def __init__(self, items):
          self._items = items

      def available(self) -> bool:
          return True

      def artifacts(self):
          from samagra.adapters.base import Artifact
          for it in self._items:
              yield Artifact(
                  uid=f"munshi:{it['id']}", source="munshi", kind=it["kind"],
                  title=it["payload"].get("text", "")[:60], subject="physics",
                  status=it["status"], updated_at=it.get("ts"),
                  meta={"payload": it["payload"], "tags": it.get("tags"),
                        "person": it.get("person"), "due": it.get("due")},
              )


  def _munshi_items():
      return [
          {"id": "1", "kind": "question", "status": "open", "ts": "2026-06-19T00:00:00Z",
           "payload": {"text": "Find acceleration of a block on a frictionless incline?"}},
          {"id": "2", "kind": "issue", "status": "open", "ts": "2026-06-19T00:01:00Z",
           "payload": {"text": "Projector broken in room 4"}},
      ]


  def test_scan_dry_proposes_content_only_and_writes_nothing(temp_catalog, monkeypatch):
      monkeypatch.setattr(run, "MunshiAdapter",
                          lambda: _FakeMunshiAdapter(_munshi_items()))
      # Guard: scan must never create a seed.
      called = {"create": 0}

      class _Boom:
          def create_seed(self, payload):  # pragma: no cover - must not run
              called["create"] += 1
              raise AssertionError("scan must not create seeds")
      monkeypatch.setattr(run, "McdClient", _Boom)
      # Guard: dry scan must not touch governance.
      monkeypatch.setattr(run.store, "add_assignment",
                          lambda *a, **k: (_ for _ in ()).throw(
                              AssertionError("dry scan must not write")))

      proposals = run.scan(dry=True)
      assert called["create"] == 0
      assert len(proposals) == 1                       # only the question item
      p = proposals[0]
      assert p["item"]["uid"] == "munshi:1"
      assert p["classification"] == "content"
      assert p["payload"]["type"] == "question"
      assert isinstance(p["pointers"], list)
      assert "assignment_id" not in p                  # dry: no assignment recorded


  def test_scan_live_records_in_review_assignment_no_seed(temp_catalog, monkeypatch):
      monkeypatch.setattr(run, "MunshiAdapter",
                          lambda: _FakeMunshiAdapter(_munshi_items()))

      class _Boom:
          def create_seed(self, payload):  # pragma: no cover
              raise AssertionError("scan must not create seeds")
      monkeypatch.setattr(run, "McdClient", _Boom)

      recorded = []
      monkeypatch.setattr(run.store, "add_assignment",
                          lambda conn, **k: recorded.append(k))
      statuses = []
      monkeypatch.setattr(run.store, "set_assignment_status",
                          lambda conn, aid, status: statuses.append((aid, status)))

      proposals = run.scan(dry=False)
      assert len(proposals) == 1
      assert recorded[0]["agent"] == "khanak"
      assert recorded[0]["pipeline"] == "mycontentdev"
      assert recorded[0]["seed_ref"] == "munshi:1"
      assert statuses[0][1] == "in-review"
      assert proposals[0]["assignment_id"] == recorded[0]["id"]
  ```

- [ ] **Step 2: Run the new tests, expect FAIL.**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge.py -q -k scan
  ```
  Expected: `ModuleNotFoundError: No module named 'samagra.bridge.run'` (or `AttributeError` on `run.scan`).

- [ ] **Step 3: Implement `run.py` with `scan` (and the shared imports + helpers `submit` will reuse).**
  Create `samagra/bridge/run.py`:
  ```python
  """The active loop: scan munshi -> propose seeds (no write); submit on approval.

  scan(dry=True)  -> classify munshi items, build proposed seed payloads + pointers.
                     dry=True writes NOTHING. dry=False records an 'in-review'
                     board assignment per content item (agent 'khanak'); it still
                     NEVER creates a seed.
  submit(id)      -> requires the assignment status be 'approved', then creates the
                     seed via McdClient.create_seed and appends a 'seed_created'
                     event. NEVER writes for a non-approved assignment.
  """
  from __future__ import annotations

  import json
  import uuid

  from .. import catalog
  from ..adapters.munshi import MunshiAdapter
  from ..clients.mcd_client import McdClient
  from ..governance import store
  from .classify import classify_item
  from .pointers import resolve_pointers
  from .seed_payload import build_seed_payload


  def _item_from_artifact(art) -> dict:
      """Reconstruct the munshi item dict from an Artifact's meta envelope."""
      meta = art.meta or {}
      payload = meta.get("payload") or {}
      kind = art.kind
      item = {
          "id": art.uid.split(":", 1)[-1],
          "uid": art.uid,
          "kind": kind,
          "status": art.status,
          "payload": payload,
          "tags": meta.get("tags"),
          "person": meta.get("person"),
          "due": meta.get("due"),
          "ts": art.updated_at,
      }
      return item


  def _text_of(item: dict) -> str:
      payload = item.get("payload") or {}
      if isinstance(payload, dict):
          if isinstance(payload.get("text"), str):
              return payload["text"]
          return " ".join(str(v) for v in payload.values()
                          if isinstance(v, (str, int, float)))
      return str(payload)


  def scan(dry: bool = True) -> list[dict]:
      """Propose seeds for content-classified munshi items. dry=True writes nothing."""
      adapter = MunshiAdapter()
      if not adapter.available():
          return []

      proposals: list[dict] = []
      conn = None if dry else catalog.connect()
      try:
          for art in adapter.artifacts():
              item = _item_from_artifact(art)
              classification = classify_item(item)
              if classification != "content":
                  continue
              pointers = resolve_pointers(_text_of(item), limit=5)
              payload = build_seed_payload(item, pointers)
              proposal = {
                  "item": {"uid": art.uid, "kind": item["kind"],
                           "status": item["status"]},
                  "classification": classification,
                  "pointers": pointers,
                  "payload": payload,
              }
              if not dry:
                  assignment_id = uuid.uuid4().hex
                  store.add_assignment(
                      conn,
                      id=assignment_id,
                      agent="khanak",
                      outbox_path=f"board/khanak/outbox/{assignment_id}.md",
                      pipeline="mycontentdev",
                      seed_ref=art.uid,
                      expected_output="Create mycontentdev seed from munshi item",
                      review_by="khanak",
                  )
                  store.set_assignment_status(conn, assignment_id, "in-review")
                  store.append_event(
                      conn, actor="system", verb="seed_proposed",
                      assignment_id=assignment_id, subsystem="munshi",
                      subsystem_ref=art.uid,
                      note=json.dumps(payload, ensure_ascii=False),
                  )
                  proposal["assignment_id"] = assignment_id
              proposals.append(proposal)
          if conn is not None:
              conn.commit()
      finally:
          if conn is not None:
              conn.close()
      return proposals
  ```

- [ ] **Step 4: Run the scan tests, expect PASS.**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge.py -q -k scan
  ```
  Expected: `2 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add samagra/bridge/run.py tests/test_bridge.py
  git commit -m "feat(bridge): scan munshi into proposals; dry never writes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 3.5: `run.submit(assignment_id)` — approval-gated seed creation

`submit` is the one write into a subsystem. It loads the assignment, REFUSES (raises) unless its status is exactly `approved`, rebuilds the payload from the recorded `seed_proposed` event note, then calls `McdClient.create_seed(payload)` exactly once, appends a `seed_created` event, and flips the assignment to a terminal recorded state. A non-approved assignment must never reach `create_seed`.

**Files:**
- Modify `samagra/bridge/run.py` (add `submit` + a small assignment/event lookup helper)
- Modify `tests/test_bridge.py` (add submit tests)

- [ ] **Step 1: Write the failing tests for `submit`.**
  Append to `tests/test_bridge.py`:
  ```python
  def _fake_assignment(status):
      return {"id": "a1", "agent": "khanak", "pipeline": "mycontentdev",
              "seed_ref": "munshi:1", "status": status}


  def _fake_payload_event(payload):
      return {"verb": "seed_proposed", "assignment_id": "a1",
              "note": json.dumps(payload)}


  def test_submit_refuses_non_approved(monkeypatch):
      monkeypatch.setattr(run, "_load_assignment",
                          lambda conn, aid: _fake_assignment("in-review"))

      class _Boom:
          def create_seed(self, payload):  # pragma: no cover
              raise AssertionError("must not create seed for non-approved")
      monkeypatch.setattr(run, "McdClient", _Boom)
      monkeypatch.setattr(run.catalog, "connect", lambda: None)

      with pytest.raises(ValueError, match="approved"):
          run.submit("a1")


  def test_submit_creates_seed_once_on_approved(monkeypatch):
      payload = {"type": "question", "raw_text": "x", "detail": {}}
      monkeypatch.setattr(run, "_load_assignment",
                          lambda conn, aid: _fake_assignment("approved"))
      monkeypatch.setattr(run, "_load_proposed_payload",
                          lambda conn, aid: payload)
      monkeypatch.setattr(run.catalog, "connect", lambda: None)

      calls = {"create": [], "events": []}

      class _Client:
          def create_seed(self, p):
              calls["create"].append(p)
              return {"id": "seed-99", "status": "captured"}
      monkeypatch.setattr(run, "McdClient", lambda: _Client())
      monkeypatch.setattr(run.store, "append_event",
                          lambda conn, **k: calls["events"].append(k))
      monkeypatch.setattr(run.store, "set_assignment_status",
                          lambda conn, aid, status: None)

      res = run.submit("a1")
      assert calls["create"] == [payload]            # exactly one create, exact body
      assert res["seed"]["id"] == "seed-99"
      verbs = [e["verb"] for e in calls["events"]]
      assert "seed_created" in verbs
  ```

- [ ] **Step 2: Run the submit tests, expect FAIL.**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge.py -q -k submit
  ```
  Expected: `AttributeError: module 'samagra.bridge.run' has no attribute 'submit'` (or `_load_assignment`).

- [ ] **Step 3: Add `submit` + lookup helpers to `samagra/bridge/run.py`.**
  Append to `samagra/bridge/run.py`:
  ```python
  def _load_assignment(conn, assignment_id: str) -> dict | None:
      """Return the assignment dict for assignment_id, or None."""
      for a in store.list_assignments(conn):
          if a["id"] == assignment_id:
              return a
      return None


  def _load_proposed_payload(conn, assignment_id: str) -> dict | None:
      """Recover the proposed POST /api/seeds body from the 'seed_proposed' event."""
      for ev in store.list_events(conn, limit=1000):
          if ev.get("assignment_id") == assignment_id and ev.get("verb") == "seed_proposed":
              try:
                  return json.loads(ev["note"])
              except (TypeError, ValueError):
                  return None
      return None


  def submit(assignment_id: str) -> dict:
      """Create the seed for an APPROVED assignment. Refuses anything else.

      The only write path into a subsystem. Never creates a seed unless the
      assignment status is exactly 'approved'.
      """
      conn = catalog.connect()
      try:
          assignment = _load_assignment(conn, assignment_id)
          if assignment is None:
              raise ValueError(f"unknown assignment: {assignment_id}")
          if assignment["status"] != "approved":
              raise ValueError(
                  f"assignment {assignment_id} is '{assignment['status']}', "
                  f"not 'approved' — refusing to create a seed."
              )
          payload = _load_proposed_payload(conn, assignment_id)
          if payload is None:
              raise ValueError(
                  f"no proposed payload recorded for assignment {assignment_id}")

          client = McdClient()
          seed = client.create_seed(payload)

          store.append_event(
              conn, actor="khanak", verb="seed_created",
              assignment_id=assignment_id, subsystem="mycontentdev",
              subsystem_ref=str(seed.get("id")) if isinstance(seed, dict) else None,
              note="seed created from approved munshi bridge",
          )
          store.set_assignment_status(conn, assignment_id, "approved")
          if conn is not None:
              conn.commit()
          return {"assignment_id": assignment_id, "seed": seed}
      finally:
          if conn is not None:
              conn.close()
  ```

- [ ] **Step 4: Run the submit tests, expect PASS.**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge.py -q -k submit
  ```
  Expected: `2 passed`.

- [ ] **Step 5: Run the full bridge suite, expect all green.**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge.py -q
  ```
  Expected: `16 passed`.

- [ ] **Step 6: Commit.**
  ```bash
  git add samagra/bridge/run.py tests/test_bridge.py
  git commit -m "feat(bridge): submit creates seed only for approved assignments

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 3.6: CLI verbs `bridge scan` and `bridge submit`

Add a `bridge` subcommand to `samagra/__main__.py` following the existing `add_parser` / `set_defaults(func=...)` pattern, with a nested action (`scan` / `submit`). `bridge scan` defaults to a live run; `--dry-run` forces propose-only. `bridge submit <assignmentId>` calls the approval-gated `run.submit`.

**Files:**
- Modify `samagra/__main__.py` (add `cmd_bridge` + parser wiring)
- Modify `tests/test_bridge.py` (add a CLI dispatch test)

- [ ] **Step 1: Write a failing test that the `bridge` parser dispatches correctly.**
  Append to `tests/test_bridge.py` (add `import samagra.__main__ as cli` to imports):
  ```python
  def test_cli_bridge_scan_dispatch(monkeypatch, capsys):
      seen = {}
      monkeypatch.setattr("samagra.bridge.run.scan",
                          lambda dry=True: seen.setdefault("dry", dry) or [])
      monkeypatch.setattr(sys, "argv",
                          ["samagra", "bridge", "scan", "--dry-run"])
      cli.main()
      assert seen["dry"] is True


  def test_cli_bridge_submit_dispatch(monkeypatch):
      seen = {}
      monkeypatch.setattr("samagra.bridge.run.submit",
                          lambda aid: seen.setdefault("aid", aid) or {"seed": {"id": "s1"}})
      monkeypatch.setattr(sys, "argv",
                          ["samagra", "bridge", "submit", "a1"])
      cli.main()
      assert seen["aid"] == "a1"
  ```
  (Add `import sys` to the test file imports if not already present.)

- [ ] **Step 2: Run the CLI tests, expect FAIL.**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge.py -q -k cli_bridge
  ```
  Expected: `SystemExit: 2` / `invalid choice: 'bridge'`.

- [ ] **Step 3: Add the `cmd_bridge` handler to `samagra/__main__.py`.**
  Insert this function after `cmd_export` (before `def main()`):
  ```python
  def cmd_bridge(args) -> None:
      from .bridge import run

      if args.action == "scan":
          proposals = run.scan(dry=args.dry_run)
          mode = "dry-run" if args.dry_run else "live"
          print(f"bridge scan ({mode}): {len(proposals)} content proposal(s)")
          for p in proposals:
              aid = p.get("assignment_id", "-")
              print(f"  [{aid}] {p['item']['uid']} -> {p['payload']['type']}  "
                    f"({len(p['pointers'])} pointer(s))")
      elif args.action == "submit":
          res = run.submit(args.assignment_id)
          seed = res.get("seed") or {}
          print(f"submitted {args.assignment_id} -> seed {seed.get('id')} "
                f"({seed.get('status')})")
  ```

- [ ] **Step 4: Wire the `bridge` subparser in `main()`.**
  In `samagra/__main__.py`, insert this block immediately before the `args = p.parse_args()` line:
  ```python
      br = sub.add_parser("bridge", help="active loop: scan munshi / submit approved seed")
      br_sub = br.add_subparsers(dest="action", required=True)
      br_scan = br_sub.add_parser("scan", help="propose seeds from munshi items")
      br_scan.add_argument("--dry-run", action="store_true",
                           help="propose only; record no assignments")
      br_submit = br_sub.add_parser("submit",
                                    help="create a seed for an APPROVED assignment")
      br_submit.add_argument("assignment_id")
      br.set_defaults(func=cmd_bridge)
  ```

- [ ] **Step 5: Run the CLI tests, expect PASS.**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge.py -q -k cli_bridge
  ```
  Expected: `2 passed`.

- [ ] **Step 6: Commit.**
  ```bash
  git add samagra/__main__.py tests/test_bridge.py
  git commit -m "feat(bridge): CLI verbs 'bridge scan' and 'bridge submit'

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 3.7: Full-suite green gate + Phase 3 close-out

**Files:**
- Test: `tests/` (entire suite — no new files; verification only)

- [ ] **Step 1: Run the entire test suite, expect all green.**
  ```bash
  .venv\Scripts\python -m pytest tests/ -q
  ```
  Expected: all tests pass (slice-1 + Phase 1/2 + the 18 new bridge tests), `0 failed`.

- [ ] **Step 2: Smoke-test the dry CLI path end-to-end (no creds required, no write).**
  ```bash
  .venv\Scripts\python -m samagra bridge scan --dry-run
  ```
  Expected output (with no munshi creds, `MunshiAdapter.available()` is False): `bridge scan (dry-run): 0 content proposal(s)` and a clean exit code 0. (Verification step, not a test — confirms the wiring runs without secrets.)

- [ ] **Step 3: Confirm no secret values appear in the new code.**
  ```bash
  git diff --stat HEAD~6 -- samagra/bridge tests/test_bridge.py samagra/__main__.py
  ```
  Expected: only `samagra/bridge/*.py`, `samagra/__main__.py`, `tests/test_bridge.py` changed; manually confirm no admin key / app password / `MUNSHI_SECRET` literal is present (clients own creds; the bridge only calls `McdClient()` / `MunshiAdapter()` which load from gitignored config).

- [ ] **Step 4: Final commit for the phase close-out (if Step 1-3 surfaced any fixups; otherwise skip).**
  ```bash
  git add -A
  git commit -m "test(bridge): Phase 3 active loop green; scan read-only, submit approval-gated

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```

---

### Task 3.8: Materialise the outbox prompt file (spec §7b)

`scan()` currently records an assignment with an `outbox_path` but never writes a file there — yet the outbox file *is* the pasteable artifact the owner opens (spec §5.2/§7b). This task adds `samagra/bridge/outbox.py::write_outbox_file(...)`, which writes a dated front-matter markdown prompt, and wires `scan()` to call it so the recorded `outbox_path` is real.

**Files:**
- Create `samagra/bridge/outbox.py` — writes the front-matter outbox prompt file; returns its repo-relative path.
- Test `tests/test_bridge_outbox.py` — asserts the file is written with front-matter + the submit command.
- Modify `samagra/bridge/run.py` — `scan()` non-dry branch calls `write_outbox_file(...)` and passes its returned path to `add_assignment`; add the import.

- [ ] **Step 1: Write the failing test.**
  Create `tests/test_bridge_outbox.py`:
  ```python
  from pathlib import Path

  from samagra.bridge import outbox


  def test_write_outbox_file_creates_frontmatter_prompt(tmp_path, monkeypatch):
      monkeypatch.chdir(tmp_path)
      payload = {"type": "rough_idea", "raw_text": "idea about projectile motion"}
      pointers = [{"source": "textbook", "uid": "tb:1",
                   "kind": "chapter", "title": "Kinematics"}]
      rel = outbox.write_outbox_file(
          agent="khanak", assignment_id="abcd1234ef", pipeline="mycontentdev",
          seed_ref="munshi:9", expected_output="Create mycontentdev seed",
          review_by="khanak", payload=payload, pointers=pointers,
      )
      f = Path(rel)
      assert f.exists()
      text = f.read_text(encoding="utf-8")
      assert "assignee: khanak" in text
      assert "pipeline: mycontentdev" in text
      assert "samagra bridge submit abcd1234ef" in text
      assert "Kinematics" in text
      assert f.parent.as_posix().endswith("board/khanak/outbox")
  ```

- [ ] **Step 2: Run it, expect FAIL.**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge_outbox.py -q
  ```
  Expected: FAIL — `ModuleNotFoundError: No module named 'samagra.bridge.outbox'`.

- [ ] **Step 3: Implement `samagra/bridge/outbox.py`.**
  ```python
  """Write ready-to-paste outbox prompt files (spec §7b)."""
  from __future__ import annotations

  import datetime
  from pathlib import Path


  def write_outbox_file(*, agent: str, assignment_id: str, pipeline: str,
                        seed_ref: str, expected_output: str, review_by: str,
                        payload: dict, pointers: list[dict]) -> str:
      """Write a dated front-matter prompt file under board/<agent>/outbox/.

      Returns the repo-relative POSIX path (stored as the assignment's outbox_path).
      """
      today = datetime.date.today().isoformat()
      rel = Path("board") / agent / "outbox" / f"{today}-{assignment_id[:8]}.md"
      rel.parent.mkdir(parents=True, exist_ok=True)
      ptr_lines = "\n".join(
          f"  - {p.get('source')}:{p.get('uid')} — {p.get('title')}" for p in pointers
      ) or "  (none)"
      body = (
          "---\n"
          f"assignee: {agent}\n"
          f"pipeline: {pipeline}\n"
          f"seed_ref: {seed_ref}\n"
          f"expected_output: {expected_output}\n"
          f"review_by: {review_by}\n"
          "status: in-review\n"
          "---\n\n"
          f"# Proposed mycontentdev seed (auto-bridged from munshi {seed_ref})\n\n"
          f"**Type:** {payload.get('type')}\n\n"
          "**Raw text (verbatim from munshi):**\n\n"
          f"{payload.get('raw_text', '')}\n\n"
          "**Exact pointers (candidate corpus sources):**\n"
          f"{ptr_lines}\n\n"
          "**Board action:** review this proposal. On approval, run "
          f"`samagra bridge submit {assignment_id}` to create the seed via the "
          "capture API. Do NOT submit until a board agent approves it.\n"
      )
      rel.write_text(body, encoding="utf-8")
      return rel.as_posix()
  ```

- [ ] **Step 4: Run the test, expect PASS.**
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge_outbox.py -q
  ```
  Expected: `1 passed`.

- [ ] **Step 5: Wire `scan()` to write the file.**
  In `samagra/bridge/run.py`, add to the imports near the other `from samagra.bridge import ...` lines:
  ```python
  from samagra.bridge import outbox
  ```
  Then, in `scan()`, replace the non-dry branch:
  ```python
              if not dry:
                  assignment_id = uuid.uuid4().hex
                  store.add_assignment(
                      conn,
                      id=assignment_id,
                      agent="khanak",
                      outbox_path=f"board/khanak/outbox/{assignment_id}.md",
                      pipeline="mycontentdev",
                      seed_ref=art.uid,
                      expected_output="Create mycontentdev seed from munshi item",
                      review_by="khanak",
                  )
  ```
  with:
  ```python
              if not dry:
                  assignment_id = uuid.uuid4().hex
                  outbox_path = outbox.write_outbox_file(
                      agent="khanak", assignment_id=assignment_id,
                      pipeline="mycontentdev", seed_ref=art.uid,
                      expected_output="Create mycontentdev seed from munshi item",
                      review_by="khanak", payload=payload, pointers=pointers,
                  )
                  store.add_assignment(
                      conn,
                      id=assignment_id,
                      agent="khanak",
                      outbox_path=outbox_path,
                      pipeline="mycontentdev",
                      seed_ref=art.uid,
                      expected_output="Create mycontentdev seed from munshi item",
                      review_by="khanak",
                  )
  ```

- [ ] **Step 6: Run the full bridge suite, expect PASS** (the scan tests assert `dry=True` writes nothing, so they still pass; the non-dry path now also writes the outbox file).
  ```bash
  .venv\Scripts\python -m pytest tests/test_bridge.py tests/test_bridge_outbox.py -q
  ```
  Expected: all bridge tests pass.

- [ ] **Step 7: Commit.**
  ```bash
  git add samagra/bridge/outbox.py samagra/bridge/run.py tests/test_bridge_outbox.py
  git commit -m "feat(bridge): materialise pasteable outbox prompt file on scan (spec §7b)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  ```
