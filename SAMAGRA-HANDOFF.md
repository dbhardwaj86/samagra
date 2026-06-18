# SAMAGRA — Session Handoff & Planning Brief

**Date:** 2026-06-18 · **Author:** Claude-Deepak (Opus 4.8), CEO · **For:** the *next* session
**Status:** 🟡 PLANNING HANDOFF — nothing below is built yet. This exists so a fresh session
can brainstorm + plan SAMAGRA properly with full context.

> **How to use this doc.** The owner explicitly chose: *"just write session handoffs with full
> pointers to plan this fresh in a new session."* So **do not start building from this file.**
> Next session: read this end-to-end → run `brainstorming` on the Open Questions (§9) → then
> `writing-plans`. Decisions already made are tagged ✅ **LOCKED**; everything in §9 is still open.

---

## 1. The vision in one paragraph

**TeachingOS** (slice-1 — built, verified, 11/11 tests, PR #1 open; see §6) grows up into
**SAMAGRA** (समग्र — Sanskrit/Hindi for *integrated / whole / complete*): a **company-structured
agentic content OS** for the JEE/NEET physics operation. A **board of three frontier agents** —
CEO **Claude-Deepak**, COO **Claude-Khanak**, Chief Architect **Codex** — governs a fleet of worker
agents (Gemini+NotebookLM, Grok, Hermes) and a set of subsystems, unifying **capture → enrichment →
review/approval → publish** across every existing tool. New this round: fold in **`mycontentdev`**
(the editorial / content-seed pipeline) and **`munshi`** (the phone capture clerk), add an
**automatic pre-commit Codex code-review**, and run the whole org through a **CEO "prompt outbox"
with per-agent folders** so the owner can hold interactive sessions with each agent while they work.

---

## 2. Decisions LOCKED this session ✅

From the four scope questions answered on 2026-06-18, plus the owner's directives:

| # | Decision | Choice |
|---|---|---|
| D1 | **Rename** | Rename GitHub repo `dbhardwaj86/teachingos` → **`samagra`**; update remote; rename Python package `teachingos` → `samagra`. Merge PR #1 first. (See §7. **Not executed yet.**) |
| D2 | **Scope of THIS session** | **Write session handoffs with full pointers** so SAMAGRA is planned fresh next session. No building now. (This document.) |
| D3 | **Orchestration model** | **Outbox + per-agent folders.** Each frontier agent gets its own folder/worktree (own context + backups); the CEO writes ready-to-paste prompts into each agent's outbox; a portal **Assignments** tab tracks status. (See §5.) |
| D4 | **Auto code-review** | **Pre-commit, blocking.** A git `pre-commit` hook runs the Codex CLI on staged changes; a failed/critical review blocks the commit. (See §5.4. Codex CLI confirmed installed: `C:\Users\abc\AppData\Roaming\npm\codex.ps1`.) |
| — | **Org chart** | Owner asked to "create an organization chart, code-name it SAMAGRA, each agent given an appropriate title as in real companies." Proposed in §3 — **finalize titles next session.** |
| — | **Munshi + mycontentdev** | Fold both in as first-class subsystems (§4). Owner's sample flow: *munshi captures rough seeds/todos → mycontentdev captures & schedules them for enhancement with exact pointers → enhance/modify → into the corpus.* |

**Governance principle the owner stated (carry into every design):** *the three frontier agents
(Deepak, Khanak, Codex) are the **only** agents allowed to review the outputs of other agents and to
approve writes/changes.* Worker output is a **draft**; a board agent reviews and approves the write.
(This mirrors `mycontentdev`'s existing draft→canonical invariant — see §4a — so the metaphor is
already half-built in code.)

---

## 3. The SAMAGRA org chart (proposed — finalize next session)

### 3.1 Board / Executive — the review & approval authority
> Only these three may review other agents' outputs and approve writes/changes. Each works from its
> **own folder/worktree** (§5.1).

| Title | Agent | Mandate |
|---|---|---|
| **Founder & Chairman** | **Devesh** (human) | Vision; the final publish gate; resolves board disputes. |
| **CEO** | **Claude-Deepak** (Claude #1, *this role*) | Orchestrator-in-chief. Routes work, writes the prompt **outbox**, owns the state machine + hard gates, runs the semi-autonomous loop, reports to the Founder. |
| **COO / Chief Content Officer** | **Claude-Khanak** (Claude #2) | Runs production: heavy parallel content generation, QA, theory↔question linking, thin-sheet summarization, enrichment fan-out. Reviews/approves worker content. |
| **Chief Architect & Code-Review Lead** | **Codex** | Project architect + planning/context-adherence manager + **adversarial code reviewer**. Owns the pre-commit blocking review (§5.4); approves code writes. |

### 3.2 Workers / Individual contributors
> Produce outputs; **never self-approve** — a board agent signs off.

| Title | Agent | Mandate |
|---|---|---|
| **Director, Research & Media** | **Gemini + NotebookLM** | Question generation; audio / decks / infographics; vision OCR. |
| **Director, Realtime Intel & Imagery** | **Grok (xAI)** | Realtime web/X research; image generation for figures/enrichment. (Video disabled.) |
| **Chief of Staff (Ops & Comms)** | **Hermes** | Cron orchestration, Telegram/phone notifications, kanban. |

### 3.3 Systems / Departments — data & capture surfaces
| Department | System | Path / home |
|---|---|---|
| **Front Desk / Intake** | **munshi** (PWA) | `myProd` → `munshi.dbhardwaj86.workers.dev` (§4b) |
| **Editorial & Records** | **mycontentdev** | `mycontentdev` → `mycontentdev.pages.dev` (§4a) |
| **Question Bank / Examinations** | **QX** | `C:\SandBox\gpt_box\gpt-extract-ques` |
| **Lectures / Curriculum** | **physics-textbook** | `C:\SandBox\gpt_box\physics-textbook` |
| **Print & Proofing** | **claude-booklet-proofer** | `C:\SandBox\claude_box\claude-booklet-proofer` |
| **Olympiad** | **claude-INSP-extract** | `C:\SandBox\claude_box\claude-INSP-extract` |
| **Simulations Lab** (read-only) | **pratyaksh** | `C:\SandBox\claude_box\pratyaksh-May-deploy` |
| **Handwriting Intake** | **claude-GN-OCR** | `C:\SandBox\claude_box\claude-GN-OCR` |

> Next session: decide whether to render this as a polished inline-SVG org chart in `STATUS.html`
> (owner's doc style: Inter, near-white, accent indigo). Keep it engaging — the company metaphor is
> deliberate.

---

## 4. New subsystems to fold in

### 4a. `mycontentdev` — the Editorial / content-seed pipeline

**What it is.** A single-user **physics content development tracking & seeding pipeline**, deployed
**serverless on Cloudflare (Pages + D1 + R2)**, live at **https://mycontentdev.pages.dev**
(password-gated). The owner captures *seed ideas* from anywhere; a Claude Code session enriches them
into clean, classified records via a cloud **admin API**; the owner reviews/approves in the web GUI;
the pipeline tracks each idea and scaffolds interactive content as a **brief** that feeds the owner's
separate `build-activity` / `build-curriculum` / `build-explorable` skills. **It tracks & scaffolds —
it does not build runnable sims.**

**Why it matters for SAMAGRA.** It already implements, in code, the exact governance the owner wants:
- **Two actors through one store, never on the same record at once:** the **GUI** (capture +
  review/approve, promotes draft→canonical) and a **Claude session** (enrich, drafts only).
- **Safety invariant:** the user's original input is **immutable** (`revisions` row #1,
  `origin='user_original'`); the session writes **only** `claude_draft` revisions + proposals; **only
  the GUI promotes a draft to canonical.** This *is* the "frontier agent approves the write" rule.

**Data model (essentials):**
- `seeds` — one row per idea; `type` ∈ {`concept`, `question`, `snippet`, `simulation_idea`,
  `experiment`, `notebooklm_link`, `rough_idea`}; `detail` JSON per type.
- `revisions` — append-only versions; rev #1 immutable; `draft_revision_id` / `canonical_revision_id`
  head pointers on `seeds`.
- `taxonomy_nodes` — NCERT class→chapter→topic→subtopic tree (206 nodes seeded).
- `tags` (axes: thematic / exam / skill / format) · `classifications` (≤1 primary syllabus node) ·
  `questions`/`question_options`/`question_hints` · `briefs` (sim/experiment scaffolds) · `events`
  (shared audit ledger).
- **Status machine:** `captured → needs_processing → processing → draft_ready → approved →
  (sim/experiment: brief_generated → content_linked → done | other: done)`; `any → archived`.
  *The session may set only `processing` / `draft_ready` — never `approved`.*

**How SAMAGRA should read it (OPEN — see §9):** local `data/content.db` (SQLite, legacy parity ref)
**or** the cloud admin API (`mcd-cloud.json` = `{apiUrl, adminKey}`, gitignored). Production is the
cloud; the local Express stack is dev-only.

**Pointers:**
- Root: `C:\SandBox\claude_box\mycontentdev\` · git branch `feat/serverless-d1-r2` · own `CLAUDE.md`.
- Cloud: Pages project `mycontentdev`; D1 db `mycontentdev-db` (binding `DB`); R2 bucket
  `mycontentdev-assets` (binding `FILES`).
- Schema: `server/schema.sql` (canonical) · `migrations/0001_init.sql` (11 tables) ·
  `migrations/0002_seed_taxonomy.sql` (206 nodes + 10 tags).
- Cloud core: `functions/api/_lib/repo.js` (all D1/R2 logic; `processDraft`) ·
  `functions/api/admin/{pending,query,write-draft/[id]}.js` (admin API, draft-zone only).
- Enrichment scripts (HTTP → cloud): `scripts/process-inbox.js`, `scripts/db-cli.mjs`,
  `scripts/_cloud.mjs` · shared validators `shared/schema/seedDetail.mjs`.
- Local dev: `npm run dev` → Express + better-sqlite3 on `data/content.db` (:4317 / web :5317).
- Deploy runbook: `DEPLOY.html`. Secrets file (gitignored): `mcd-cloud.json`.

### 4b. `munshi` (in `myProd`) — the Front-Desk capture clerk

**What it is.** The owner's deployed **phone PWA**, a Cloudflare **Worker** live at
**https://munshi.dbhardwaj86.workers.dev**. A teacher's daily assistant — tabs **Talk / Today /
Studio / Library** — that captures **notes, todos, issues, people, follow-ups**, produces a **daily
brief**, frames **questions with SVG diagrams**, and supports **photo + vision** and **voice
dictation**. Orchestrator model is OpenAI `gpt-5.4-mini`; chat hits DeepSeek; Gemini for vision.
Recently simplified (slice S27) to core capture/recall + question-framing (sims/decks/WhatsApp/push
were cut).

**Why it matters for SAMAGRA.** This is the **"generate rough seeds and todos for OS tasks"** front
door — fast, on-the-go, voice/photo capture. Its `items` store (todos/issues/follow-ups/people/
questions) is the raw intake that should flow into `mycontentdev` seeds and into SAMAGRA's own
task/pipeline state.

**⚠️ Safety:** `munshi` is the owner's **real single-user data store**. Secrets live in
`myProd/.dev.vars` (`MUNSHI_PROD_SECRET` = prod, `MUNSHI_SECRET` = local dev) — **never echo, log, or
commit their values.** Never modify/dismiss/delete pre-existing store items when testing against prod;
prefix any test entities `Testbot`.

**Pointers:**
- Root: `C:\SandBox\claude_box\myProd\` (git initialized).
- Worker source: `src/index.ts` (routes + auth: `isAuthed`, constant-time `secretMatches`,
  `/login`, `/logout`) · `src/agent.ts` (tool loop) · `src/store.ts` (items store) · `src/tools.ts`
  · `src/toolloop.ts` · `src/prompts.ts` · `src/brief.ts` · `src/vision.ts` · `src/gemini.ts` ·
  `src/deepseek.ts`.
- Frontend: `public/app.js`, `public/index.html`, `public/sw.js` (cache `munshi-shell-v12`),
  `public/i18n.js` (hi/en), `public/styles.css`, `public/manifest.webmanifest`.
- API client / tests: `stress/driver.mjs` (`library()` → `{items, people}`, `turn()` sends a chat) ·
  `stress/cleanup-prod.mjs` · `TESTPLAN.html` (100-item plan) · `TESTRUN-2026-06-13.{md,json}`.
- Specs: `docs/superpowers/specs/2026-06-16-munshi-simplification-design.md` · `docs/munshi-spec.html`.

### 4c. The owner's sample flow (the integration target)

```
munshi (phone)            mycontentdev                SAMAGRA spine            publish
quick capture:            formalize + schedule:       enrich / link:           gates:
rough seed / todo   ──▶   seed (1 of 7 types)   ──▶   board review +     ──▶   approve →
voice / photo / note      + taxonomy + tags +         enhancement w/           HTML/DOCX/GDocs,
                          brief + "exact pointers"     exact pointers           question corpus,
                          (status machine, audit)      (Khanak/Codex)           media, sims
```

**Integration gaps to design (→ §9):** (1) how a munshi capture becomes a mycontentdev seed
(bridge: munshi item → `POST seed`?); (2) what "schedule for enhancement with exact pointers" means
concretely (a seed carries pointers into QX/textbook/booklets so enrichment knows the source); (3)
where SAMAGRA's pipeline state machine ends and mycontentdev's status machine begins (don't duplicate
— SAMAGRA likely *reflects* mycontentdev status, like it reflects physics-textbook's queue today).

---

## 5. Orchestration model ✅ (outbox + per-agent folders)

### 5.1 Per-agent folders / worktrees
Each board agent runs in its **own folder with its own context + independent backups**, so they don't
clobber each other and each can be snapshotted/restored alone. Proposed (decide exact mechanism §9):
- `…/samagra-deepak/` (CEO) · `…/samagra-khanak/` (COO) · `…/samagra-codex/` (Chief Architect).
- Likely **git worktrees** of the renamed `samagra` repo (shared history, isolated working trees),
  each with its own `CLAUDE.md` / `AGENTS.md` stating that agent's role, review authority, and outbox
  path. (Alternative: full clones for harder isolation + separate backups — §9.)

### 5.2 The CEO "prompt outbox"
The CEO (this role) **writes ready-to-paste prompts** for most tasks; the owner opens an interactive
session in the target agent's folder and pastes — so the owner can *watch/steer* while agents execute.
Proposed shape: per-agent `outbox/` of dated prompt files (`YYYY-MM-DD-NN-<slug>.md`) with a small
front-matter header (assignee, pipeline, seed/artifact refs, expected output, review-by).

### 5.3 Portal **Assignments** tab
New tab in the (forked-QX) portal: lists outstanding prompts per agent, their status
(`queued → running → in-review → approved/changes`), and links to the produced artifact + the board
review. This is the human-in-the-loop dashboard for the org.

### 5.4 Auto code-review — pre-commit, blocking (D4)
- A git **`pre-commit`** hook (in the `samagra` repo + each worktree) runs the **Codex CLI**
  (`codex.ps1`) as the **adversarial reviewer** on staged changes; a **critical/failed** verdict
  **blocks the commit**. Confirmed available: `codex`, `gh`, `node`, `git`, `python` all on PATH.
- Reuse references: `claude-booklet-proofer\scripts\codex_dispatch.py` (existing Codex dispatch
  pattern) and the `munshi-testrun-codex.log` precedent. Decide invocation + verdict parsing in §9.
- Note: this is the **one** part that runs **without** a CEO prompt — it's automatic "from now on for
  each commit," per the owner.

---

## 6. The existing spine — TeachingOS slice-1 (already built; becomes SAMAGRA's core)

Built, verified, committed, pushed. **Do not rebuild — extend.**
- **Repo:** github.com/dbhardwaj86/teachingos · branch `slice-1` · **PR #1 open** · local checkout
  `C:\SandBox\claude_box\TeachingOS` (Python 3.11 `.venv`; FastAPI control plane; UI forked from QX).
- **What works:** read-only adapters → unified `teachingos.db` (FTS5) cataloging **7,044 artifacts**
  (QX 67,276 Qs / textbook 59 / booklets 11 / INSP 136 / sims 1,554); 4-pipeline state machine;
  FastAPI portal (7 tabs, search, gate board); thin/thick lecture exporter → HTML + DOCX (native
  OMML math) + creds-gated Google Docs; semi-autonomous tick + mtime lock + Telegram/email notify +
  Task Scheduler installer. **11/11 tests pass.**
- **Detailed layout, run commands, gotchas:** see `HANDOFF.md` (same dir). **STATUS.html** = the
  human-facing status.
- **Still open from slice-1 (owner consent/creds):** (1) register the hourly scheduled task
  (`samagra schedule-install`) — was blocked by the auto-mode safety classifier, needs explicit OK;
  (2) Telegram + gmail SMTP creds in `.env`; (3) `GOOGLE_OAUTH_CLIENT` for Google Docs export.

---

## 7. Rename plan: `teachingos` → `samagra` ✅ (NOT executed yet)

Ordered steps for the next session (run deliberately, with the owner present):
1. **Merge PR #1** (`slice-1` → `main`) so nothing is lost: `gh pr merge 1 --squash` (or merge).
2. **Rename the GitHub repo:** `gh repo rename samagra` (GitHub auto-redirects the old URL;
   `gh repo rename` updates the local `origin` remote too — verify with `git remote -v`).
3. **Rename the Python package** `teachingos/` → `samagra/`; update imports, `__main__`, console entry,
   `pyproject.toml`/`requirements`, CI workflow, launch config, `config.py` constants
   (`TASK_NAME="TeachingOS-tick"` → `SAMAGRA-tick`, DB/file names if desired), and docs.
4. **Update the slice-1 docs** (`README.md`, `STATUS.html`, `HANDOFF.md`) to the SAMAGRA identity.
5. **Snapshot first:** suggest `/snap-pre "samagra rename"` before the rename (multi-file churn).
> Keep the public-repo safety rules: no secrets, no content, no hardcoded machine paths in committed
> code. `.dev.vars`, `mcd-cloud.json`, `.env`, `*.db`, `state/` stay gitignored.

---

## 8. Master pointer index

| Thing | Pointer |
|---|---|
| SAMAGRA spine (this repo) | `C:\SandBox\claude_box\TeachingOS` → github.com/dbhardwaj86/teachingos (→ `samagra`) |
| Slice-1 handoff / status | `HANDOFF.md` · `STATUS.html` (this dir) |
| Approved slice-1 plan | `C:\Users\abc\.claude\plans\lets-brainstorm-basically-an-giggly-elephant.md` |
| mycontentdev | `C:\SandBox\claude_box\mycontentdev` → mycontentdev.pages.dev · `CLAUDE.md`, `DEPLOY.html`, `server/schema.sql`, `scripts/`, `migrations/` |
| mycontentdev secrets (gitignored) | `mycontentdev\mcd-cloud.json` = `{apiUrl, adminKey}` |
| munshi / myProd | `C:\SandBox\claude_box\myProd` → munshi.dbhardwaj86.workers.dev · `src/`, `public/`, `stress/driver.mjs`, `TESTPLAN.html` |
| munshi secrets (gitignored) | `myProd\.dev.vars` (`MUNSHI_PROD_SECRET`, `MUNSHI_SECRET`) — never echo/commit |
| QX (Question Bank) | `C:\SandBox\gpt_box\gpt-extract-ques` (`qx\qx_content.sqlite`, `builder.sqlite`) — read-only |
| physics-textbook (Lectures) | `C:\SandBox\gpt_box\physics-textbook` (`textbook\queue.json`, `chapters\<slug>\content.json`) |
| booklets / INSP / sims / GN-OCR | `claude-booklet-proofer` · `claude-INSP-extract` · `pratyaksh-May-deploy` (read-only) · `claude-GN-OCR` |
| Codex CLI | `C:\Users\abc\AppData\Roaming\npm\codex.ps1` · dispatch ref `claude-booklet-proofer\scripts\codex_dispatch.py` |
| Hermes (Chief of Staff) | `scribe.cmd` / `hermes -z`; Telegram `telegramchat` profile |
| Workspace conventions | `C:\SandBox\claude_box\CLAUDE.md` (cbm + agentmemory); user global `C:\Users\abc\.claude\CLAUDE.md` (doc style) |

---

## 9. Open questions for the fresh planning session

1. **Scope sequencing.** Build order for the SAMAGRA evolution — governance layer (org chart, agent
   folders, pre-commit review, outbox/Assignments) first, then subsystem adapters, then the active
   seed→enrich→approve loop? (Owner leaned toward planning the whole thing fresh; size the slices.)
2. **mycontentdev read path.** Local `data/content.db` (read-only SQLite adapter, like QX/textbook)
   vs cloud admin API (`mcd-cloud.json`). Cloud is production; SQLite is simpler/offline.
3. **munshi read path.** Reuse `stress/driver.mjs` `library()` over the Worker API, vs a direct
   export. How does SAMAGRA authenticate without holding the prod secret in committed code?
4. **munshi → mycontentdev bridge.** Mechanism + trigger for turning a munshi capture (todo/note)
   into a mycontentdev seed with "exact pointers" into the source corpus.
5. **State-machine boundary.** Does SAMAGRA *reflect* mycontentdev's status machine (recommended,
   like it reflects textbook's queue) or own a parallel one? Avoid double sources of truth.
6. **Per-agent isolation.** Worktrees vs full clones for deepak/khanak/codex; backup strategy per
   folder (cbm snapshots? separate git remotes?); how the owner launches each session.
7. **Outbox format + Assignments tab.** Concrete prompt-file schema; status lifecycle; how
   "approved by a board agent" is recorded (mirror mycontentdev `events`?).
8. **Pre-commit Codex review.** Exact `codex` invocation on staged diff; how a "critical" verdict is
   detected to block; escape hatch for emergencies; per-worktree install.
9. **Org-chart titles.** Confirm/adjust COO vs CCO for Khanak and the worker titles; render as SVG in
   `STATUS.html`.
10. **Rename timing.** Do the `teachingos → samagra` rename (§7) before or after wiring subsystems?
    (Earlier = less churn later.)

---

## 10. Recommended first actions next session

1. Read this doc + `HANDOFF.md` (slice-1) + `mycontentdev/CLAUDE.md`.
2. `/snap-pre "samagra evolution scaffold"` before any multi-file work.
3. Run **`brainstorming`** on §9 (one question at a time), then **`writing-plans`**.
4. Decide §9.1 sequencing; if rename-first, execute §7 (merge PR #1 → `gh repo rename samagra`).
5. `/record-plan` the approved SAMAGRA plan into the cbm sidecar.

*— Claude-Deepak, CEO, SAMAGRA. End of handoff.*
