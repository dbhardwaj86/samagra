# SAMAGRA

Agentic content-pipeline OS for a JEE/NEET physics teaching operation, orchestrated by Claude Code with Codex, Gemini/NotebookLM, Grok and Hermes as role-specialized workers.

It is a **control plane**: it does not re-implement the content tools you already run — it
reads them through read-only adapters, unifies them in one portal, schedules them, fills the
lecture-generation gap, and runs semi-autonomously (scheduled ticks, hard gates at publish,
phone + email notifications).

## What it orchestrates

| Source (local) | Role |
|---|---|
| `gpt-extract-ques` (QX) | Question engine — 67k questions, paper builder, search/export |
| `physics-textbook` | Lecture/notes engine — 59 chapters from handwritten notes; `queue.json` is the lecture tracker |
| `claude-booklet-proofer` | Booklets + theory↔question linking |
| `claude-INSP-extract` | INSP / olympiad papers |
| `pratyaksh-May-deploy` | 200+ simulations (read-only) |
| HF Space `QuestionDB` | Online deployment target (later) |
| `mycontentdev` (Phase 1) | Editorial seed pipeline — cloud admin API (read-only); reflects seed status |
| `munshi` (Phase 1) | Phone/front-desk capture — `library()` over the Worker (read-only) |

> Phase 1 added the last two as **network-backed** read-only sources (the rest are local). Both reflect
> live state when credentials are present and skip cleanly otherwise — a failing/offline subsystem never
> erases the catalog.

## Architecture (3 layers)

1. **Source adapters** (`samagra/adapters/`) — read-only, each normalizes its source into a common `Artifact`; network-backed sources are fronted by read-only HTTP clients in `samagra/clients/` (secret-safe).
2. **Catalog + state** (`samagra/catalog.py`, `state.py`) — `samagra.db` unified catalog + a phase state machine.
3. **Portal + API** (`samagra/api/`, `portal/`) — FastAPI + a UI forked from QX's browser.

## Quickstart

```bash
# Phase A (spine) needs no dependencies:
python -m samagra refresh     # build the unified catalog from local sources
python -m samagra status      # source summaries + pipeline states
python -m samagra search "gauss" --source qx

# Portal (Phase B) and beyond:
python -m venv .venv && . .venv/Scripts/activate
pip install -r requirements.txt
python -m samagra serve       # http://127.0.0.1:8799
```

## Configuration

Via environment variables or a `.env` file (see `.env.example`). **This repo is public:**
no secrets and no content/copyrighted material are ever committed — SAMAGRA only references
local source paths, kept out of git via `.gitignore`.

## Pre-commit Codex review (advisory-local + enforced-CI)

SAMAGRA ships a committed pre-commit hook (`.githooks/pre-commit`) that asks Codex
to review the staged diff. It BLOCKS the commit only when a finding is a
**confirmed** `CRITICAL` — a second Codex pass over the same diff independently
agrees — and the verdict is cached by staged-diff hash so repeated attempts of
the identical diff don't re-prompt. Enable it once per clone (it then applies to
the repo and every worktree):

```
git config core.hooksPath .githooks
```

Requirements: `codex` on PATH (`npm i -g @openai/codex`) or `CODEX_BIN` set.
The local hook is **advisory** (runbook D5): a confirmed-CRITICAL blocks, but if
Codex cannot run the commit is **not** wedged (it warns and allows), and an
audited break-glass exists for emergencies — `SAMAGRA_REVIEW_BREAKGLASS="<reason>"`
allows the commit and logs to `state/review/breakglass.log`. Real enforcement
lives in CI / branch protection; the human publish gate is the only sacred,
never-automated block. Manual run: `python -m samagra review-staged`.

## License

Private project; code only. Source content remains local and is not part of this repository.
