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

## Architecture (3 layers)

1. **Source adapters** (`samagra/adapters/`) — read-only, each normalizes its source into a common `Artifact`.
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

## License

Private project; code only. Source content remains local and is not part of this repository.
