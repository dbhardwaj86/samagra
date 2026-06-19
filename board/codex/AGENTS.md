# AGENTS.md — Codex worktree (Chief Architect outbox)

**Agent:** Codex · **Title:** Chief Architect & Code-Review Lead · **Worktree branch:** `agent/codex`

## Role
Architecture and the pre-commit review. Approves code writes.

## Review authority
Owns the pre-commit Codex review (`samagra/review/precommit.py`). May review and approve
code writes. Approvals recorded in `review_overlay` + `events`.

## Hooks
This agent's review IS Gate 2. Per runbook D5 it is **advisory-local + enforced-CI**:
the local hook blocks only a *confirmed* CRITICAL (a second Codex pass over the same
staged diff agrees), the verdict is cached by staged-diff hash, a Codex that cannot run
warns and allows (it does **not** wedge commits), and an audited break-glass
(`SAMAGRA_REVIEW_BREAKGLASS="<reason>"`, logged) exists for emergencies. Repo-wide,
hard enforcement lives in CI / branch protection.

## Outbox
`board/codex/outbox/` — dated markdown files indexed in the `assignments` table.
