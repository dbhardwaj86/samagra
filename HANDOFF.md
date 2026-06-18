# TeachingOS — Handoff

> **▶ NEXT DIRECTION:** TeachingOS is evolving into **SAMAGRA** (rename to `samagra`, company-structured
> agent org, fold in `mycontentdev` + `munshi`, pre-commit Codex review, CEO prompt-outbox). To plan
> that fresh, **read [`SAMAGRA-HANDOFF.md`](SAMAGRA-HANDOFF.md) first.** This file below is the
> slice-1 (built-and-verified) record.

**Repo:** github.com/dbhardwaj86/teachingos · branch `slice-1` (PR #1) · local-first Python+FastAPI.
**State:** Slice 1 (spine + portal + thin/thick exporter + semi-autonomous loop) is code-complete and verified. 11/11 tests pass.

## Run it

```bash
cd C:\SandBox\claude_box\TeachingOS
set PYTHONPATH=%CD%                 # or: export PYTHONPATH=$(pwd) in bash
.venv\Scripts\python -m teachingos refresh        # rebuild catalog (7,044 artifacts)
.venv\Scripts\python -m teachingos status
.venv\Scripts\python -m teachingos export --chapter vectors --variant both
.venv\Scripts\python -m teachingos tick [--dry-run]
.venv\Scripts\python -m teachingos gate textbook approve
# portal: preview harness (.claude/launch.json -> "teachingos") OR:
.venv\Scripts\python -m uvicorn teachingos.api.app:app --port 8799   # http://127.0.0.1:8799
```

## Layout (source of truth)

- `teachingos/adapters/` — read-only source adapters → common `Artifact`.
- `teachingos/catalog.py` — `teachingos.db` unified catalog (FTS5) + search/overview/facets.
- `teachingos/state.py` — phase state machine; `state/<pipeline>.orchestrator_state.json` + `tracker.txt`.
- `teachingos/scheduler.py` — `tick()`, `gate()`, Task Scheduler installer.
- `teachingos/notify.py` — Telegram + email (creds-gated, always logs `state/notifications.log`).
- `teachingos/lectures/` — `render.py` (content.json→HTML), `thin.py`, `export.py` (HTML/DOCX/GDocs), `gdocs.py`.
- `teachingos/api/app.py` + `teachingos/portal/` — FastAPI + forked-QX UI.

## Sources (read-only, paths in teachingos/config.py / .env)

QX `C:\SandBox\gpt_box\gpt-extract-ques` · textbook `C:\SandBox\gpt_box\physics-textbook`
· booklets `claude-booklet-proofer` · INSP `claude-INSP-extract` · sims `pratyaksh-May-deploy` (never write).

## Gotchas

- Python 3.11 venv (`.venv`) for the portal; system Python is 3.14 (stdlib-only CLI works there too).
- Do **not** use `uvicorn --reload` here — an orphaned reload worker held the port once. Use the preview harness or plain uvicorn.
- QX `subject` column is unpopulated (physics-only); facet on chapter/q_type instead.
- DOCX math: Pandoc `html+tex_math_dollars` converts `$...$` → OMML (verified: 130 eqns in vectors-thick).
- Don't write to `physics-textbook/queue.json` — TeachingOS tracks approvals in its own `state/`.

## Open / needs user consent

1. **Scheduled task** — `teachingos schedule-install` registers an hourly OS-level tick; needs explicit approval (blocked by safety classifier otherwise).
2. **Notification creds** — fill `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` + gmail `SMTP_PASS` in `.env`.
3. **Google Docs** — set `GOOGLE_OAUTH_CLIENT` (Desktop OAuth JSON); run an export to complete consent flow.

## Slice 2 (planned)

Real worker dispatch for `questions`/`papers`/`media` pipelines (Codex/Gemini/NotebookLM/Grok);
deploy QX + portal online (HF Space `QuestionDB` / Docker).
