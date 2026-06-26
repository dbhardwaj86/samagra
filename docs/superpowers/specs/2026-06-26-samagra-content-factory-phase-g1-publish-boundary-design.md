# SAMAGRA Content Factory — Phase G1: The Publish Boundary (design)

> **Status:** ratified design (2026-06-26). Opens **Phase G** (PRATHAM / the A6
> downstream student entity) on an explicit Chairman re-scope of DEC-9 ("go for
> phase G before phase F"). Extends the umbrella content-factory spec
> `2026-06-23-samagra-content-factory-design.md` Plan A–G row G. Follows Phase E
> (complete: coverage graph / Concept Atlas).
>
> **One-line:** make **`published`** a real, durable, owner-gated state — a manual
> `publish` action that copies a chapter's *captured* artifacts into an immutable,
> append-only `published/` snapshot (the export contract any future outward consumer
> reads), so "PRATHAM consumes the **published** corpus" stops being undefined —
> **without** opening any public surface, write endpoint, or identity.

---

## 1. Context & goal

Phase G is the **DOWNSTREAM** layer of the content factory (STEERING / ENGINE /
MOAT / SEAM / DOWNSTREAM). Everything shipped to date is **inward and
single-operator**: the dispatch ENGINE (Phase 1/C) fans a seed to N lanes; the
StyleSeed MOAT (Phase D) conditions the LLM lane; the STEERING layer (Phase E)
ranks what to build next. All of it terminates at the factory's `captured` state,
behind the never-automated publish gate, inside the read-only firewall over the
seven source subsystems.

The umbrella spec parks PRATHAM as **A6** — *"a learner-facing product is a
SEPARATE entity that consumes SAMAGRA's published corpus"* — and **DEC-9** defers
it: *"the student-facing surface is a downstream consumer of the published corpus,
built only after the inward factory is proven, on an explicit Chairman re-scope …
No outward write path, no multi-tenant identity, until Phase G."* Plan A–G row G
bounds the full phase: *"PRATHAM student twin: multi-tenant identity + the single
outward `POST /api/factory/publish`, **Saar sheets first**, batch-by-chapter
approval."*

**The gap this slice closes.** "PRATHAM consumes the **published** corpus" is
currently *undefined*: in code the factory's terminal success state is `captured`,
and there is **no `published` state, no publish action, no publish event verb** —
the publish gate is enforced only as a human action at the board (`approve_seed`),
not as a durable boundary between `captured` (produced, owner-reviewed, inward) and
*released* (outward-consumable). Until `published` is a real, durable, queryable
state, nothing downstream is well-defined.

**Phase G decomposes into independent subsystems** — (G1) the publish boundary,
(G2) an outward read-only surface, (G3) multi-tenant identity, (G4) the student
"twin" — mirroring the project's lowest-risk-first sub-slice discipline (C1→C2→C3,
D1→D2→D3). **This spec is G1 only: the publish boundary**, the load-bearing,
currently-missing foundation. It is the *safest* crossing — it opens no public
surface and introduces no identity; it only makes "published" a durable local state
with every existing invariant preserved.

## 2. Decisions locked (brainstorming forks, 2026-06-26)

| Fork | Decision | Rationale |
|---|---|---|
| Slice scope | **Publish boundary only** (G1) — make `published` a durable owner-gated state | the architecturally load-bearing, currently-missing foundation; opens no outward surface and no identity (those are G2/G3) |
| Published representation | **Static export dir (copy)** — `publish` COPIES captured artifacts into an immutable, append-only `published/` tree + a derived `manifest.json`, plus an append-only `published` governance event | physical separation is the strongest firewall; a self-contained, snapshot-able, ship-able corpus a later `EXPORT_DIR` rebuild cannot silently mutate |
| Publish unit | **Chapter + optional lane filter** (default = all currently-captured) | honours `batch-by-chapter` (the batch unit) AND `Saar sheets first` (stage revision sheets before papers/decks); the manifest records exactly which artifacts went out |
| Retract | **Yes — append-only `unpublished`** that drops the artifact from the current `manifest.json`; the ledger record + frozen bytes are never deleted | a recall path if bad content slips past review; fits the append-only governance discipline |
| `published/` durability | **Gitignored but DURABLE (never reset)** — frozen copies live there permanently; the append-only audit ledger is `governance.db` events | the `governance.db` precedent (durable ≠ git-committed); avoids repo bloat from copied HTML/docx while keeping true immutability |
| Surface | **CLI-first only — NO web endpoint** in G1 | exactly the Phase-1 pattern (`samagra factory …` is the surface; a GUI/`GET /api/published` is the *start* of G2, not G1) |
| Publishable lanes | **textbook content lanes only** (revision/lecture/deck/paper/drill/samadhan); the `seed`/mcd lane is **excluded** | the mcd lane writes inward to mycontentdev and produces no local artifact to copy |

## 3. Architecture

```
  INWARD (the firewall holds)                    THE BOUNDARY (G1)            DOWNSTREAM (G2+, NOT in G1)
  ───────────────────────────                    ──────────────────          ───────────────────────────
  governance.db ───┐  captured assignments
   (store, read)   │  (status='captured',
                   │   pipeline∈publishable,            publish(chapter, lanes?)
                   │   seed_ref='textbook:<slug>')   ┌──────────────────────┐
  product_created ─┤  full artifact file set    ───▶│  publish/ orchestrator│
   event note      │  (html/json/docx paths)        │  (manual CLI, owner)  │
  EXPORT_DIR ──────┘  the artifact bytes            └───────────┬──────────┘
   build/lectures/<slug>/*                                      │ copy (immutable) + sha256
                                                                ▼
                                              published/   (gitignored, DURABLE — never reset)
                                                <chapter>/<slug>-thin.html …   ← frozen copies
                                                _publications/pub_<id>.json    ← immutable record
                                                manifest.json                  ← derived CURRENT view
                                                                │                 (the export contract)
                                                append-only governance event  ─────────────────────────▶  PRATHAM (G2+)
                                                  `published` / `unpublished`         reads ONLY published/manifest.json
                                                  (the audit ledger)                  + published/<chapter>/* — never
                                                                                      governance.db, EXPORT_DIR, or the
                                                                                      7 source subsystems
```

**Firewall posture.** `publish` **reads** only captured *local* factory artifacts
(governance.db + the artifact bytes already on disk) and **writes** only under
`published/` plus append-only `governance.db` events. It never writes to any of the
seven source subsystems (munshi, mcd, QX, textbook, booklets, INSP, sims) — **no new
prod write path to them**. It opens **no network surface and no identity**:
`published/` is a *local* materialization of the gate; the outward
`POST /api/factory/publish`, the public hostname + Cloudflare-Access app, and
multi-tenant identity are **later G slices**. **No governance migration, no new
table, no assignment-state-machine change** — `published`/`unpublished` are new
*verb strings* on the existing `events` table (lower-risk than D3, which added a
table). The factory `build()` boundary and its five crash-safety guards are
**untouched**; `publish` is a *separate*, downstream, additive boundary.

## 4. Data substrate (real inputs, verified)

| Input | Source (real API / path) | Shape used |
|---|---|---|
| Captured assignments | `governance.store.list_assignments(conn)` | filter `status=='captured'` ∧ `seed_ref==f"textbook:{slug}"` ∧ `pipeline ∈ PUBLISHABLE` |
| Full artifact file set | the `product_created` **event note** for the assignment, via `store.list_events_for_assignment(conn, aid)` → `json.loads(note)["artifact"]` (the engine `result` dict: `html`, and per-lane `json`/`docx`) | `artifact_ref` alone holds only `html`; the note holds **every** produced file path |
| Artifact bytes | the files at those paths under `EXPORT_DIR` (`build/lectures/<slug>/<slug>-<variant>.{html,json,docx}`) | copied verbatim + sha256'd |
| Style provenance | the artifact's `meta.style_seed_version` when present (samadhan, future LLM lanes) | recorded in the manifest entry |
| Lane registry | `factory.lines.LINES` (`Line.kind ∈ {local,qx,mcd,llm}`) | `PUBLISHABLE = {k for k,l in LINES.items() if l.kind != "mcd"}` |

**No source mapping work** (unlike Phase E): a chapter's captured artifacts are
already grouped by `seed_ref=='textbook:<slug>'`; the produced files are already
recorded in each assignment's `product_created` note. `publish` is pure recovery +
copy + ledger.

## 5. `published/` layout & the manifest (the export contract)

```
published/                              # gitignored, DURABLE (never reset; like governance.db)
  manifest.json                         # derived CURRENT view — the ONLY file a consumer must read
  _publications/
    pub_<hex>.json                      # immutable per-publication record (append-only; never edited)
  <chapter-slug>/
    <slug>-thin.html                    # frozen artifact copies (content-stable, sha-verified)
    <slug>-deck.json
    …
```

**`manifest.json`** — derived, rebuildable from the immutable `_publications/`
records (it is the one mutable *pointer*; everything it points at is immutable):

```jsonc
{
  "schema": "samagra.published.v1",
  "generated_at": "2026-06-26T12:00:00Z",
  "publication_count": 1,
  "chapters": {
    "circular-motion": {
      "chapter": "circular-motion",
      "title": "Circular Motion",
      "seed_ref": "textbook:circular-motion",
      "artifacts": [
        {
          "uid": "published:circular-motion:revision",
          "lane": "revision",
          "assignment_id": "…",
          "files": [
            { "rel": "circular-motion/circular-motion-thin.html",
              "sha256": "…", "bytes": 12345 }
          ],
          "source_seed_ref": "textbook:circular-motion",
          "style_seed_version": null,        // set for LLM-lane artifacts that carry it
          "captured_at": "…",                 // the assignment's updated_at at capture
          "published_at": "…",
          "publication_id": "pub_<hex>"
        }
      ]
    }
  }
}
```

**`_publications/pub_<hex>.json`** — the immutable record of one `publish` (or one
`unpublish`) action; written once, never modified:

```jsonc
{
  "publication_id": "pub_<hex>",
  "action": "publish",                       // "publish" | "unpublish"
  "actor": "owner",
  "chapter": "circular-motion",
  "seed_ref": "textbook:circular-motion",
  "lanes": ["revision"],
  "at": "2026-06-26T12:00:00Z",
  "artifacts": [ /* the per-artifact entries frozen at this action */ ]
}
```

**Governance audit (append-only).** For each artifact published/withdrawn, one
event on the existing `events` table — `verb='published'` (or `'unpublished'`),
`actor='owner'` (marks the human release gate), `assignment_id=<the lane's
assignment>`, `subsystem='published'`, `subsystem_ref=<chapter>`, `note=` JSON
`{publication_id, lane, uid, sha256s}`. Each artifact's own history therefore shows
its release/withdrawal (`list_events_for_assignment`), and `publication_id` groups
the batch. `governance.db` is otherwise byte-unchanged.

## 6. Operations (`factory/publish/run.py`, manual CLI only)

### `publish(chapter, *, lanes=None, actor="owner") -> dict`
1. Resolve the chapter's **captured** assignments: `list_assignments` filtered by
   `seed_ref==f"textbook:{chapter}"` ∧ `status=='captured'` ∧
   `pipeline ∈ PUBLISHABLE`, intersected with `lanes` when given.
2. For each, recover the full file set from the `product_created` note. A
   missing/malformed note, or a missing file on disk, is a **clean refusal**
   (never publish a phantom) — mirrors `_load_proposed_payload` returning `None`.
3. sha256 each file; **idempotency check** — if every targeted lane already has a
   current manifest entry with identical shas, it is a **no-op** (no copy, no
   record, no event) and logs "already published, unchanged".
4. Otherwise, for the new/changed lanes: COPY the bytes into
   `published/<chapter>/…` (atomic write), append an immutable
   `_publications/pub_<hex>.json`, append one `published` event per artifact, and
   re-derive `manifest.json` (**per-lane last-write-wins across all
   `_publications/` records** — the new publication supersedes any prior entry for
   the *same* lane, while the chapter's other lanes, published in earlier actions,
   persist). A re-published (rebuilt) chapter creates a **new** `pub_<hex>`; the
   prior record is retained.

### `unpublish(chapter, *, lanes=None, actor="owner") -> dict`
Append an immutable `_publications/pub_<hex>.json` with `action='unpublish'`, append
one `unpublished` event per withdrawn artifact, and re-derive `manifest.json` to
**drop** the withdrawn (chapter, lane) entries. The frozen bytes and prior records
are **never deleted** (append-only); the consumer simply stops seeing them.

### `list_published() -> dict`
Return the current `manifest.json` (or re-derive it from `_publications/` if absent
— the manifest is a rebuildable pointer over the immutable records).

**Gate properties.** Every operation is a **manual CLI action** — no schedule, no
auto-publish, no automation. `publish` accepts only `captured` artifacts (an
in-review/approved/changes assignment is refused). Unknown chapter, the mcd `seed`
lane, and a non-`textbook:` seed are clean refusals.

## 7. CLI surface (in `samagra/__main__.py cmd_factory`, beside `plan`/`approve`/`coverage-*`)

- `samagra factory publish <chapter> [--lanes revision,deck,…]` — publish a
  chapter's captured artifacts (default = all captured; `--lanes` stages a subset,
  e.g. Saar sheets first);
- `samagra factory unpublish <chapter> [--lanes …]` — withdraw a chapter or
  specific lanes from the current published manifest;
- `samagra factory published` — print the current published corpus (chapters ×
  lanes × file count).

## 8. Module layout — `samagra/factory/publish/` (sibling to `coverage/`, `style/`)

| File | Responsibility |
|---|---|
| `manifest.py` (PURE) | publication-record + manifest schema; sha256 of file bytes; current-view merge (apply a publish/unpublish action to the prior manifest); lane filter; idempotency (identical-sha no-op); retract-drops-from-current-view. No I/O beyond reading bytes passed in. |
| `store.py` (I/O) | the `published/` layout; atomic copy of artifact files; write immutable `_publications/pub_*.json`; read/(re)derive `manifest.json`. |
| `run.py` (orchestrator) | `publish` / `unpublish` / `list_published`; reads captured assignments + `product_created` notes via `governance.store`; enforces the gates; appends `published`/`unpublished` events. |

Config addition (`config.py`): `PUBLISHED_DIR = REPO_ROOT / "published"` (add to
`.gitignore`; durable — documented "never reset", like `GOVERNANCE_DB`).
`EXPORT_DIR` / `GOVERNANCE_DB` already exist. No new governance schema.

## 9. Invariants & acceptance

**Proposed DEC-10 (to ratify in this spec + trackers): the publish boundary.** The
`captured → published` promotion is a **separate, owner-driven, never-automated,
append-only, local-only** boundary that releases an immutable copy of a captured
artifact for downstream consumption; it adds **no outward network surface, no
identity, and no write path to the seven source subsystems**; the inward factory
`build()` boundary and its five guards are untouched.

- **Never-automated publish gate.** `publish`/`unpublish` are manual CLI actions
  only — no schedule, no auto-publish, no batch-propose.
- **Read-only firewall over the 7 subsystems intact.** `publish` reads captured
  local artifacts + governance and writes only `published/` + appends events —
  **no new write path** to munshi/mcd/QX/textbook/booklets/INSP/sims.
- **No public surface and no identity in G1.** `published/` is a *local*
  materialization; the outward endpoint, public hostname, Access app, and
  multi-tenant identity are **later G slices** (explicit non-goals below).
- **Append-only governance, no migration, no reset.** New verb strings on the
  existing `events` table; nothing deleted; `governance.db` otherwise
  byte-unchanged; the assignment state machine `{queued,running,in-review,
  approved,changes,captured}` is **unchanged** (publish is tracked in `published/`
  + events, not as an assignment status).
- **Immutable published history.** `_publications/*.json` records + copied bytes
  are never mutated; only the derived `manifest.json` pointer moves; retract is
  append-only; a recorded sha mismatch on a later artifact rebuild is *surfaced*,
  never silent.
- **Granularity = per-chapter batch + optional lane filter** (Saar sheets first).
- **mcd/`seed` lane excluded** — no local artifact to publish.

**Acceptance (golden thread):** with a real `captured` `textbook:<slug>` chapter
(produced through the existing `plan → approve_seed → build` flow),
`samagra factory publish <slug> --lanes revision` copies the thin Saar sheet into
`published/<slug>/`, writes an immutable `pub_<hex>` record + a `published` event,
and `manifest.json` lists exactly that one artifact with a matching sha256;
re-running is a no-op; `unpublish <slug>` drops it from the manifest while the bytes
+ records + ledger persist; the durable `governance.db` is **byte-unchanged** except
the two appended event rows. (If no real `captured textbook:` chapter exists in the
committed `governance.db` — the C1/C2 prod-test seeds were owner-cleaned-up — the
full path is exercised synthetically by injecting a captured `textbook:` assignment
+ a `product_created` note, exactly as Phase E exercised its `produced` path.)

## 10. Review gate

- **TDD throughout** (the project's standing discipline) — §11.
- **A dedicated DEC-7-style Codex pre-merge review of the new publish boundary** —
  it is a new write target and the conceptual outward firewall, matching the
  boundary reviews that gated Phase 1 (dispatch), C3 (seed-fold), and D2 (LLM lane).
  The review confirms: publish reads only captured artifacts; never touches the 7
  subsystems; is truly manual/never-automated; honours immutability + append-only;
  retract cannot leak; no phantom publish on a missing note/file.
- **An adversarial multi-lens final review** (Workflow, 4 lenses × independent
  verify), as every prior phase.

## 11. Testing strategy (TDD throughout)

- **`manifest.py` (pure):** sha256 of bytes; build a publication record from a fake
  captured set; apply publish to an empty / existing manifest; lane filter;
  idempotency (identical shas → no-op); a rebuilt artifact (changed sha) → new
  publication supersedes; unpublish drops from the current view while history is
  retained.
- **`store.py` (I/O, tmp dir):** atomic copy into `published/<chapter>/`; immutable
  `_publications/*.json` write; `manifest.json` (re)derivation from records.
- **`run.py` (orchestrator):** publish picks ONLY `captured` (refuses
  in-review/approved/changes); refuses unknown chapter / mcd lane / non-`textbook:`
  seed; clean refusal on a missing/malformed `product_created` note or a missing
  file on disk (no phantom publish); appends `published` events; `unpublish`
  appends `unpublished` + drops from manifest; **`governance.db`-byte-unchanged**
  assertion (only the appended event rows differ).
- **Golden thread (§9):** the real-or-synthetic captured chapter end-to-end.
- Gate: **pytest green** (≈+25–30 over the current 479), no regressions; the lone
  pre-existing `test_gdocs` env red and the opt-in live-LLM-smoke skip are unrelated.

## 12. Non-goals (Phase G1, YAGNI)

- **No `POST /api/factory/publish`, no public hostname, no Cloudflare-Access app**
  → G2.
- **No multi-tenant identity, no student login / per-student state** → G3.
- **No student-facing app** → G2+.
- **No GUI publish button and no new web endpoint at all** in G1 (CLI-first, like
  Phase 1; a read-only `GET /api/published` is the natural *start* of G2). The
  operator can still inspect the published corpus via `samagra factory published`.
- **No catalog (`samagra.db`) change** — the consumer reads `published/manifest.json`
  directly; indexing published artifacts into the catalog is out of scope.
- **No assignment-state-machine change, no governance schema change.**
- **No automation / scheduling** of publish.

## 13. Open questions deferred (to the plan or a later G slice)

- **`published/` git-committed vs gitignored-durable** — defaulted to
  gitignored-durable (repo-bloat vs in-repo review/versioning); the owner may
  overrule toward git-committed at spec review.
- **Publish actor identity in the ledger** — defaulted to `actor="owner"`; revisit
  if/when G3 introduces real identities.
- **The outward read surface** (`GET /api/published` + the student app, Saar sheets
  first) — G2.
- **Multi-tenant identity + the outward `POST /api/factory/publish`** — G3.
- **Catalog/Atlas surfacing of `published` state** (a "published" badge in SAMAGRA
  OS) — a later, read-only operator-console nicety, not G1.
