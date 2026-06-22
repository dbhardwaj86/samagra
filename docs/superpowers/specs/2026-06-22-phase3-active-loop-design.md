# SAMAGRA Phase 3 — Active Loop (the bridge): reconciled design

**Date:** 2026-06-22 · **Author:** Claude-Deepak (Opus 4.8), CEO · **Status:** ✅ APPROVED (design) — ready for `writing-plans`
**Builds on:** [`2026-06-19-samagra-evolution-design.md`](2026-06-19-samagra-evolution-design.md) §8 (the active loop) and the locked
plan [`../plans/2026-06-19-samagra-evolution.md`](../plans/2026-06-19-samagra-evolution.md) Tasks 3.1–3.8.
**Governance:** ungated by **DEC-6** (DEC-4 retired); DEC-5 makes Phase 3 the primary value engine; DEC-1/DEC-3 + the
never-automated publish gate stay binding. The active loop's single subsystem write reuses the **already-merged**
`McdClient.create_seed` — it adds **no new subsystem write path** (consistent with the DEC-3 amendment's "exactly two
write paths").

---

## 1. Why this spec exists

The active loop was fully designed on 2026-06-19 (spec §8; plan Tasks 3.1–3.8) and then **parked** while the SAMAGRA OS
Experience track + the capture control plane shipped. Those later tracks **merged to `main`** and, in doing so,
changed three things the 2026-06-19 plan assumed. This spec is the **reconciliation**: it keeps the locked plan's
architecture (it is still authoritative for the module/TDD shape) and overrides exactly the three points where shipped
reality diverged, plus closes one gap (board approval) and one latent bug (double-write).

This is intentionally a thin delta document. Where it is silent, the 2026-06-19 spec §8 + plan Tasks 3.1–3.8 govern.

## 2. What already exists on `main` (verified 2026-06-22)

- **`McdClient.create_seed(fields)`** — `samagra/clients/mcd_client.py:58`. POSTs **form-encoded** (`data=fields`) to
  `{api_url}/api/seeds` with header `x-mcd-admin`. The deployed worker parses `request.formData()`. Live-proven by the
  capture control plane (a real seed `seed_01KVNN90…` was created).
- **Governance store** — `samagra/governance/store.py`: durable `governance.db` with `assignments`, `events`,
  `review_overlay`; `add_assignment`, `set_assignment_status` (validates against `ASSIGNMENT_STATUS`), `append_event`,
  `add_review`, `list_assignments`, `list_events`. `ASSIGNMENT_STATUS = {queued, running, in-review, approved, changes}`.
- **`MunshiAdapter`** — `samagra/adapters/munshi.py`. Live reads; `available()==True` (creds in `.env`). Emits one
  `Artifact` per non-dismissed item with `meta = {payload, tags, person, due}` and a kind-specific extracted `title`.
- **`GET /api/assignments`** — `samagra/api/app.py` serves the governance store read-only. Bridge-created proposals
  therefore appear in the SAMAGRA OS **Assignments** app with no extra work (read-only; no approve/submit UI this round).
- **`POST /api/mcd/seeds`** (owner-initiated capture) — forwards a FLAT whitelist `{type, raw_text, title?, source_ref?}`
  to `create_seed`. This is the proven field contract the bridge's write must match.

## 3. Scope (ratified with the owner)

- **In scope:** the complete backend bridge + CLI, TDD, end-to-end runnable from the terminal, verified with a **live**
  `Testbot` round-trip that creates one real (clearly test-marked) seed in prod mycontentdev.
- **Out of scope (YAGNI):** GUI Approve/Submit buttons (proposals are already visible read-only in the Assignments app;
  buttons are a clean follow-up slice); autonomous/scheduled scanning; any munshi→mcd auto-promotion. The human publish
  gate stays never-automated (DEC-3).

## 4. Modules — `samagra/bridge/`

Each unit has one purpose, a typed interface, and is independently testable. File-disjoint from existing code.

| Unit | Interface | Purpose | Depends on |
|---|---|---|---|
| `classify.py` | `classify_item(item: dict) -> "content" \| "ops"` | Pure heuristic: physics-ish note/question/todo → content; issue/followup/person-directed/non-physics → ops. Conservative (when in doubt, `ops`). | — |
| `pointers.py` | `resolve_pointers(text: str, *, limit=5) -> list[{uid,source,kind,title}]` | Read-only FTS5 lookup over `samagra.db` (`catalog.search`). Empty text → `[]`. | `catalog` |
| `seed_payload.py` | `build_seed_payload(item, pointers) -> dict` | The **flat** `create_seed` fields (see R1). | — |
| `outbox.py` | `write_outbox_file(...) -> str` | Dated front-matter board prompt under `board/<agent>/outbox/`; carries pointers + the `submit` command. Returns repo-relative POSIX path. | — |
| `run.py` | `scan(dry=True)`, `approve(id)`, `submit(id)` | Orchestration (see §6). | classify, pointers, seed_payload, outbox, `store`, `MunshiAdapter`, `McdClient`, `catalog` |
| `__main__.py` (modify) | `bridge scan [--dry-run]` · `bridge approve <id>` · `bridge submit <id>` | CLI surface. | `run` |

## 5. The three reconciliations (deliberate overrides of the locked plan)

### R1 — Seed payload is FLAT, not nested `detail{}`
The plan emitted `{type, raw_text, detail:{braindump, possible_directions, proposed_type, rationale, pointers}}` as JSON.
Shipped reality: `create_seed` is **form-encoded** and the worker reads `formData()`; the live `/api/mcd/seeds` forwards
only `{type, raw_text, title?, source_ref?}`. A nested `detail` dict would be dropped.

→ `build_seed_payload(item, pointers)` returns the proven flat contract:

```python
{
  "type": "question" if munshi_kind == "question" else "rough_idea",
  "raw_text": <verbatim munshi text>,          # required, non-empty
  "source_ref": "munshi:<id>",                 # provenance the worker accepts
}
```

The **corpus pointers + full proposal detail are recorded in SAMAGRA's own audit trail** — the `seed_proposed` event
`note` (JSON) and the outbox markdown — not shipped to mcd. Nothing is lost; provenance lives where SAMAGRA owns it.

### R2 — Real munshi text keys, not `payload["text"]`
Real munshi payloads use kind-specific keys (`note→issue/topic`, `todo→task`, `issue→summary`, `question→stem`,
`followup→note`); there is no generic `"text"`. → text extraction mirrors the adapter's `_TITLE_KEYS_BY_KIND` (kind-specific
key first, then any string value as a fallback — so the plan's synthetic `{"text": …}` unit tests still pass). Tests add
**real munshi-shaped payloads** (note→`issue`, todo→`task`, question→`stem`).

### R3 — Idempotent, terminal `submit`
The plan left `submit` flipping the assignment back to `approved`, so re-running it would create a **second real seed**
(prod double-write — the D7 idempotency hole). → `submit`:
1. refuses unless the assignment status is exactly `approved`;
2. **refuses if a `seed_created` event already exists** for that assignment (primary idempotency defense — no schema change);
3. on success, flips the assignment to a new terminal status **`captured`** — one additive member to `ASSIGNMENT_STATUS`
   (covered by a governance test). A `captured` assignment is no longer `approved`, so (1) also blocks re-submission.

## 6. Control flow (`run.py`)

- **`scan(dry=True)`** — `MunshiAdapter().available()` false → `[]`. For each non-dismissed item: reconstruct the item dict
  from the Artifact (`meta.payload`, kind, status, person…), `classify_item`; keep only `content`. For each kept item:
  `resolve_pointers` + `build_seed_payload`. `dry=True` (default) writes **nothing** and returns the proposals. `dry=False`
  per item: write the outbox file, `add_assignment(agent="khanak", pipeline="mycontentdev", seed_ref=art.uid,
  outbox_path=…)`, `set_assignment_status(…, "in-review")`, and `append_event(verb="seed_proposed", note=<note>)` where
  `<note> = json.dumps({"payload": <flat create_seed fields>, "pointers": [...]})` — the flat payload and the pointers are
  kept as **distinct keys** so `submit` can recover the exact write body without re-deriving it. Never calls `create_seed`.
- **`approve(id)`** — board action. Loads the assignment; requires status `in-review`; `set_assignment_status(…, "approved")`
  (which appends the transition event). Closes the gap the retired portal used to fill. (`changes`/reject is symmetric and
  may be added if cheap; not required for the golden thread.)
- **`submit(id)`** — the one subsystem write. Loads the assignment; applies R3 guards; recovers the flat payload via
  `json.loads(note)["payload"]` from the `seed_proposed` event; `McdClient().create_seed(payload)` exactly once; `append_event(verb="seed_created",
  subsystem="mycontentdev", subsystem_ref=<seed id>)`; `set_assignment_status(…, "captured")`. Returns `{assignment_id, seed}`.

**Safety:** `scan(dry=True)` and `approve` perform no subsystem write. The only subsystem write in all of SAMAGRA remains
`create_seed`, reachable only through `submit` on an `approved`, not-yet-`captured` assignment. No secret value is ever
logged or committed (clients own creds from gitignored config; the bridge only constructs `McdClient()` / `MunshiAdapter()`).

## 7. Testing

**Unit (mocked clients — no live calls in CI):** `tests/test_bridge.py` + `tests/test_bridge_outbox.py`
- `classify_item` table — incl. real-key payloads (note→issue, todo→task, question→stem) and ops cases (issue, followup,
  person-directed, non-physics note/todo).
- `resolve_pointers` over a temp catalog — finds candidates, respects `limit`, empty text → `[]`.
- `build_seed_payload` — exact **flat** body for `rough_idea` and `question`; `source_ref == "munshi:<id>"`; no `detail` key.
- `scan(dry=True)` — content-only, writes nothing (guards on `add_assignment` + `create_seed`).
- `scan(dry=False)` — records one `in-review` assignment per content item; outbox file written; the `seed_proposed` event
  note round-trips to `{"payload": …, "pointers": …}` and `json.loads(note)["payload"]` equals the original flat body;
  never `create_seed`.
- `approve` — `in-review` → `approved`; refuses other states.
- `submit` — refuses non-approved; creates exactly one seed on approved; **refuses double-submit** (existing `seed_created`);
  flips to `captured`; emits `seed_created`.
- CLI dispatch — `bridge scan --dry-run`, `bridge approve <id>`, `bridge submit <id>`.
- Governance — `set_assignment_status(…, "captured")` accepted (the additive status).

**Live end-to-end (owner-approved, writes one labeled test seed):**
1. Capture one **`Testbot`**-labeled munshi note (e.g. `issue: "Testbot Phase-3 smoke — Gauss law flux demo idea"`).
2. `samagra bridge scan` (live) — confirm it classifies `content`, attaches real corpus pointers, records the `in-review`
   assignment + writes the outbox file.
3. `samagra bridge approve <id>` → `samagra bridge submit <id>` — creates **one real `Testbot` seed** in prod mcd.
4. Verify the seed via `McdClient` read; report the munshi item id + seed id for the owner to dismiss/archive.

**Gate:** full suite green (≥229 pytest baseline + the new bridge tests) and `samagra bridge scan --dry-run` exits 0.

## 8. Branch & integration

New branch **`phase3/active-loop`** off `main` (clean — all prerequisites present); the branch is the isolation/rollback
mechanism (no `/snap-pre` needed). TDD commit per task. On completion, present `finishing-a-development-branch`; because the
loop exercises the prod write path, a **Codex pre-merge review** precedes merge.

## 9. Acceptance

Phase 3 closes when: the bridge modules + CLI exist and are green; `scan` is read-only and `submit` is approval-gated +
idempotent; the live `Testbot` round-trip created and verified one real seed end-to-end; trackers (HANDOFF / STATUS /
SUMMARY / CLAUDE.md / memory) record Phase 3 as built and the golden thread (munshi → seed) proven live.
