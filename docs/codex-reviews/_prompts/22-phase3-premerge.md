You are performing a FULL, INDEPENDENT, ADVERSARIAL pre-merge review of the SAMAGRA
**Phase 3 "active loop" (the bridge)** feature, currently on branch `phase3/active-loop`
(about to be merged to `main`). You run in a read-only sandbox: read whatever you need.
Do NOT trust the project's own docs — verify every claim against the actual code.

## What this branch adds (verify, don't assume)
A new `samagra/bridge/` package + a `samagra bridge {scan,approve,submit}` CLI that turns a
munshi item into a board-approved → owner-submitted mcd seed. The intended loop:
munshi item → classify content/ops → propose a flat seed payload + corpus pointers →
record an `in-review` governance assignment + a pasteable outbox file → `approve` (board gate)
→ `submit` (the ONE subsystem write — creates the mcd seed via the EXISTING `POST /api/mcd/seeds`
path, idempotent, terminal `captured`).

Files to scrutinize (cite file:line):
- `samagra/bridge/{__init__,text,classify,pointers,seed_payload,outbox,run}.py`
- `samagra/governance/store.py` (the added `captured` assignment status)
- `samagra/__main__.py` (the `bridge` subcommands)
- `tests/test_bridge.py`, `tests/test_bridge_outbox.py`

## The SAFETY INVARIANTS this branch must NOT break — judge each against code
1. **Exactly two subsystem write paths, unchanged.** The repo's invariant is
   "read-only EXCEPT owner-initiated capture" via `POST /api/munshi/capture` and
   `POST /api/mcd/seeds`. Confirm the bridge adds **NO new web endpoint** and that `submit`
   reuses the EXISTING `McdClient.create_seed` (the same `POST /api/mcd/seeds`) rather than a
   new write path. Is the "still exactly two write paths" claim honest?
2. **Approval gate is real & un-bypassable.** `submit` must refuse anything whose governance
   status is not `approved`. Trace every path into `create_seed` — can a non-approved, unknown,
   or already-`captured` assignment ever reach the write? Is the human approve step truly manual
   (no auto-approve, no scan→submit shortcut)?
3. **Idempotent / no double-write.** A second `submit` on a `captured` assignment must NOT create
   a second seed. Identify the guard(s). Is there a crash window (seed created in mcd but status
   not yet flipped) and is it documented + safe on retry? Could a race or re-scan double-submit?
4. **No automated publish.** Nothing here may automate the never-automated publish gate, and there
   must be no munshi→mcd auto-promotion (every seed needs explicit human approve+submit).
5. **No secret leak.** No secret value (munshi cookie/secret, mcd admin key/app password, .env)
   may be echoed, logged, written to the outbox file, or committed. Check error paths too.

## Also hunt for ordinary defects (cite file:line, rate severity)
- **Path traversal / injection** in `outbox.py` — the `board/<agent>/outbox/<...>.md` write. Is the
  slug guard sufficient? Can `agent`/`assignment_id` escape the board dir?
- **classify.py** correctness/edge cases (empty item, missing keys, unicode, non-physics).
- **pointers.py** — FTS5 query building: any injection or crash on adversarial text? The known
  limitation is AND-semantics returning `[]` for long stems (graceful by spec) — confirm it's
  graceful, not a 500.
- **run.py** governance interaction — correct DB (`store.connect()` not catalog), status
  transitions valid against `ASSIGNMENT_STATUS`, event log integrity, error handling when munshi
  is unavailable (must degrade, not crash).
- **seed_payload.py** — flat `{type,raw_text,source_ref}` shape; any field that could carry
  unintended data into mcd.
- Test quality: are the safety invariants (single write path, refuse-non-approved, idempotent
  double-submit, slug guard) actually covered by assertions, or only happy-path?

## Output format
Markdown report. Start with a one-line VERDICT: **GO**, **GO-WITH-CAVEATS**, or **NO-GO**.
Then: findings grouped by severity (Critical / High / Medium / Low / Nit), each with file:line and a
concrete fix. Be specific and adversarial — assume the author was optimistic. If the safety
invariants genuinely hold, say so explicitly and explain how you verified each.
