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
This worktree inherits the repo-wide pre-commit Codex review via
`core.hooksPath = .githooks`. Per runbook D5 the local gate is **advisory**: it blocks
only a *confirmed* CRITICAL (a second Codex pass agrees), a Codex that cannot run does
not wedge commits, and an audited break-glass (`SAMAGRA_REVIEW_BREAKGLASS="<reason>"`)
exists for emergencies. Real enforcement lives in CI / branch protection; the human
publish gate (Gate 1) is the only sacred, never-automated block.
