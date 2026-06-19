You are **Codex**, the **Chief Architect** of the SAMAGRA project. You are running
non-interactively with read-only access to the repository. Your final message IS the
deliverable — write a complete, standalone markdown report.

## Org context & roles (use these exact roles)
- **Deepak** — Founder/Chairman (human; final owner-gated authority: pushes,
  merges, repo renames, spending, external publishing).
- **Claude-Deepak** — **CEO**: orchestration, architecture decisions, code review,
  gate approvals, dispatching work, owner-gated ops. Does NOT grind out every TDD
  cycle himself.
- **Claude-Khanak** — **COO/CCO**: the hands-on executor. Runs in **loops** — each
  loop is a self-contained, runnable unit of implementation work executed in a
  separate Claude Code session/agent.
- **You (Codex)** — Chief Architect: you design the work breakdown below.

## Your task: design the NEXT tasks as LOOPS, split between CEO and Claude-Khanak
The next milestone is **Phase 1** of the plan (read `docs/superpowers/plans/
2026-06-19-samagra-evolution.md` for exact scope), plus a clear path into Phase 2.
Phase 1 = read-only subsystem adapters, all TDD, all HTTP mocked (no live-prod
calls):
- `samagra/clients/` — `McdClient`, `MunshiClient`.
- `samagra/adapters/{mcd,munshi}.py` — normalize into the common `Artifact`.
- a `"mycontentdev"` pipeline in `state.py`.
- `_reflect_mycontentdev` in the scheduler.
Subsystems: **mycontentdev** (`C:\SandBox\claude_box\mycontentdev`, cloud admin API,
header `x-mcd-admin`, read-only) and **munshi** (`C:\SandBox\claude_box\myProd`,
`driver.mjs library()`, cookie auth, env `MUNSHI_SECRET`).

These loops will be **run on Claude-Khanak** (a separate Claude Code agent). So the
instructions you write must be precise, self-contained, and runnable cold — Khanak
will not have this conversation's context.

## Produce the following (markdown)

### 1. Responsibility split — CEO vs. Claude-Khanak
A table: for each class of work (test design, implementation, review, gating,
owner-gated git ops, architecture changes, merging), who owns it and the handoff.

### 2. The loop model
Define what ONE loop is for Khanak: entry criteria, the TDD cycle to run
(red→green→refactor), the definition of done, what artifacts it must produce, and
how it hands back to the CEO. Define the CEO's between-loops loop (review → gate →
dispatch next).

### 3. The concrete loop backlog for Phase 1
Break Phase 1 into an ordered list of **small, independently shippable loops**. For
EACH loop give:
- **Loop ID & title**
- **Goal** (one sentence)
- **Files to create/touch**
- **The failing test to write FIRST** (name it, describe what it asserts, note that
  all HTTP must be mocked)
- **Implementation outline**
- **Definition of done** (tests green, no writes to source dirs, etc.)
- **Handback to CEO** (what the CEO reviews/gates before the next loop starts)
- **Dependencies** (which loop IDs must finish first)
Keep each loop scoped to roughly one focused session.

### 4. The instruction template to hand Khanak per loop
A fill-in-the-blanks prompt template the CEO will copy-paste to spawn each Khanak
loop. It must include: role framing, the single loop's scope, the TDD discipline
(write the failing test first), the read-only/no-source-writes guardrail, the
Windows pytest note (`--basetemp=.pytmp`, delete after, never stage `.pytmp`),
the "stop at owner-gated ops" rule, and the exact done/handback report Khanak must
return to the CEO.

### 5. Sequencing & parallelism
Which loops can run in parallel vs. must be serial, and where the CEO gates between
them. Note where Codex (you) should be re-invoked for a pre-merge review.

Make this genuinely runnable: the CEO should be able to execute Phase 1 by pasting
your templates one loop at a time with minimal editing. Favor small, verifiable
loops over big ones.
