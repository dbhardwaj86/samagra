# SAMAGRA — Handoff

> **▶ STATUS:** The project is **SAMAGRA** (package `samagra`) — a company-structured agent org
> folding in `mycontentdev` + `munshi`, with an advisory pre-commit Codex review and a CEO prompt-outbox.
> **Phase 0 (rename), Track A (stabilize) and Phase 1 (read-only subsystem adapters) are merged to `main`
> and pushed to `origin/main`.** **Phase 2 (governance) is now BUILT TDD on `main` (suite 63 → 85 green)**,
> reconciled to the runbook: **D6** (governance state lives in its own durable `governance.db`, separate from
> the rebuildable catalog `samagra.db`) and **D5** (the Codex pre-commit hook is **advisory-local** —
> confirmed-CRITICAL only, diff-hash cached, audited break-glass, never wedges; real enforcement = CI). The
> plan's Phase-2 code was stale (it self-flagged `SUPERSEDED by D5/D9`) and was reconciled before building.
> The live plan is under `docs/superpowers/` (original brief: [`SAMAGRA-HANDOFF.md`](SAMAGRA-HANDOFF.md)).
> **Owner-gated & pending:** pre-merge Codex review of the Phase-2 diff → then hook activation
> (`git config core.hooksPath .githooks`), the three agent worktrees, and push to origin. **Then: Phase 3 (active loop).**

**Repo:** github.com/dbhardwaj86/samagra · branch `main` · local-first Python+FastAPI.
**State:** Spine + portal + thin/thick exporter + semi-autonomous loop + two read-only subsystem adapters
(mycontentdev seeds, munshi `library()`) reflecting into the catalog, **+ Phase-2 governance**: durable
`governance.db` store (assignments / events ledger / review overlay), `GET /api/assignments` + the
Assignments portal tab, an advisory Codex pre-commit gate (`samagra/review/`), the committed
`.githooks/pre-commit` shim, and per-agent board files (`board/{deepak,khanak,codex}/`). **85/85 tests pass.**

## Run it

```bash
cd C:\SandBox\claude_box\TeachingOS
set PYTHONPATH=%CD%                 # or: export PYTHONPATH=$(pwd) in bash
.venv\Scripts\python -m samagra refresh        # rebuild catalog (7,044 artifacts)
.venv\Scripts\python -m samagra status
.venv\Scripts\python -m samagra export --chapter vectors --variant both
.venv\Scripts\python -m samagra tick [--dry-run]
.venv\Scripts\python -m samagra gate textbook approve
# portal: preview harness (.claude/launch.json -> "samagra") OR:
.venv\Scripts\python -m uvicorn samagra.api.app:app --port 8799   # http://127.0.0.1:8799
```

## Layout (source of truth)

- `samagra/adapters/` — read-only source adapters → common `Artifact` (incl. Phase 1 `mcd.py`, `munshi.py`).
- `samagra/clients/` — read-only subsystem HTTP clients: `McdClient` (mycontentdev admin API), `MunshiClient` (`library()`); secret-safe, never logged.
- `samagra/governance/store.py` — Phase 2 durable `governance.db` store (D6): `assignments`, `events`, `review_overlay` + `schema_version`/migration hook + `backup()`. **Never delete `governance.db` as a "catalog reset".**
- `samagra/review/` — Phase 2 advisory pre-commit Codex review (D5): `codex_dispatch.py` (vendored subprocess shim, lazy exe) + `precommit.py` (confirmed-CRITICAL + `state/review/` diff-hash cache + `SAMAGRA_REVIEW_BREAKGLASS` audit). CLI: `samagra review-staged`.
- `.githooks/pre-commit` — committed shim → `python -m samagra.review.precommit`. Activate (owner) with `git config core.hooksPath .githooks`.
- `board/{deepak,khanak,codex}/` — per-agent `AGENTS.md` + `outbox/` (indexed by `assignments`).
- `samagra/catalog.py` — `samagra.db` unified catalog (FTS5) + search/overview/facets.
- `samagra/state.py` — phase state machine; `state/<pipeline>.orchestrator_state.json` + `tracker.txt`.
- `samagra/scheduler.py` — `tick()`, `gate()`, Task Scheduler installer.
- `samagra/notify.py` — Telegram + email (creds-gated, always logs `state/notifications.log`).
- `samagra/lectures/` — `render.py` (content.json→HTML), `thin.py`, `export.py` (HTML/DOCX/GDocs), `gdocs.py`.
- `samagra/api/app.py` + `samagra/portal/` — FastAPI + forked-QX UI.

## Sources (read-only, paths in samagra/config.py / .env)

QX `C:\SandBox\gpt_box\gpt-extract-ques` · textbook `C:\SandBox\gpt_box\physics-textbook`
· booklets `claude-booklet-proofer` · INSP `claude-INSP-extract` · sims `pratyaksh-May-deploy` (never write).

## Gotchas

- Python 3.11 venv (`.venv`) for the portal; system Python is 3.14 (stdlib-only CLI works there too).
- Do **not** use `uvicorn --reload` here — an orphaned reload worker held the port once. Use the preview harness or plain uvicorn.
- QX `subject` column is unpopulated (physics-only); facet on chapter/q_type instead.
- DOCX math: Pandoc `html+tex_math_dollars` converts `$...$` → OMML (verified: 130 eqns in vectors-thick).
- Don't write to `physics-textbook/queue.json` — SAMAGRA tracks approvals in its own `state/`.

## Open / needs user consent

**Phase-2 owner-gated (do in order — runbook §1):**
1. **Pre-merge Codex review** — re-invoke Codex (Chief Architect) on the Phase-2 diff (9 commits, `80f464a..HEAD`) before activation/merge.
2. **Activate the hook** — `git config core.hooksPath .githooks` (applies to repo + every worktree). Needs `codex` on PATH or `CODEX_BIN`.
3. **Create worktrees** — `git worktree add ../samagra-deepak -b agent/deepak` (and `-khanak`, `-codex`). Board files already committed.
4. **Push** — push `main` to `origin` after the review passes.

**Creds (slice-1, unchanged):**
5. **Notification creds** — fill `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` + gmail `SMTP_PASS` in `.env`.
6. **Google Docs** — set `GOOGLE_OAUTH_CLIENT` (Desktop OAuth JSON); run an export to complete consent flow.
7. **Phase 3 munshi** — drop `MUNSHI_API_URL` + `MUNSHI_SECRET` into `.env` (live worker secret value) to switch on the active loop's munshi reads. mcd already reads live via `mcd-cloud.json`.

## Slice 2 (planned)

Real worker dispatch for `questions`/`papers`/`media` pipelines (Codex/Gemini/NotebookLM/Grok);
deploy QX + portal online (HF Space `QuestionDB` / Docker).
