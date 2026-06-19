# SAMAGRA — Handoff

> **▶ STATUS:** The project is **SAMAGRA** (package `samagra`) — a company-structured agent org
> folding in `mycontentdev` + `munshi`, with a blocking pre-commit Codex review and a CEO prompt-outbox.
> **Phase 0 (rename), Track A (stabilize) and Phase 1 (read-only subsystem adapters) are done, merged to
> `main`, and pushed to `origin/main`** (63/63 green; Phase 1 cleared an adversarial 42-agent pre-merge
> review — one HIGH, MUN-01, fixed). Repo and origin in sync. The live plan is under
> `docs/superpowers/` (original brief: [`SAMAGRA-HANDOFF.md`](SAMAGRA-HANDOFF.md)). **Next: Phase 2 (governance).**

**Repo:** github.com/dbhardwaj86/samagra · branch `main` · local-first Python+FastAPI.
**State:** Spine + portal + thin/thick exporter + semi-autonomous loop + two read-only subsystem adapters
(mycontentdev seeds, munshi `library()`) reflecting into the catalog. **63/63 tests pass.**

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

1. **Notification creds** — fill `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` + gmail `SMTP_PASS` in `.env`.
2. **Google Docs** — set `GOOGLE_OAUTH_CLIENT` (Desktop OAuth JSON); run an export to complete consent flow.

## Slice 2 (planned)

Real worker dispatch for `questions`/`papers`/`media` pipelines (Codex/Gemini/NotebookLM/Grok);
deploy QX + portal online (HF Space `QuestionDB` / Docker).
