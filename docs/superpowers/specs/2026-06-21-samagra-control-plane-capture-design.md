# SAMAGRA control plane — Capture + read-only surfaces (Design Spec)

> **Status:** Design artifact (no code). Authored 2026-06-21.
> **Decision basis:** Chairman directive 2026-06-21 — *"wire all the remaining apps (munshi and
> mycontentdev), pratyaksh sims (only the deployed ones) and QX browser separate. check everything
> (independent codex review for each implementation). At the end I should have the full samagra
> control plane working (real captures end to end) and browsing all the read-only surfaces."*
> **Inputs read & verified (live where noted):** `samagra/clients/{munshi_client,mcd_client}.py`,
> `samagra/adapters/{munshi,mcd,sims,qx}.py`, `samagra/api/app.py`, the 4 frontend apps
> (`Munshi`, `Mycontentdev`, `Sims`, `Questions`), `myProd/src/index.ts` (munshi Worker — auth +
> write routes), `mycontentdev/server/app.mjs` (seed routes + auth), and `pratyaksh-May-deploy/`
> (`deployed-sims.md`, `deployed-sims-by-grade.md`, `wrangler.toml`, `public/sims/`).
> **Live-verified this session:** munshi prod `GET /api/library` over the cookie secret returned
> 13 items / 12 people; item shape `{id,kind,payload,person,due,tags,status,ts}`; nothing fronts
> the Worker (cookie alone authorizes).

This spec is the **what + why + where**. The phased, paste-ready **how** lives in the companion
implementation plan (`docs/superpowers/plans/2026-06-21-samagra-control-plane-capture.md`).

---

## 0. The DEC-3 amendment (Chairman, 2026-06-21)

This track **deliberately reopens write paths that DEC-3 firewalled earlier the same day.** Recorded
as a Chairman amendment, not a silent reversal:

- **AMEND DEC-3.** *Owner-initiated capture* becomes **in-scope**: the OS may create a **munshi
  front-desk item** (`POST /api/item`) and a **mycontentdev seed** (`POST /api/seeds`). These are
  the only two new subsystem write paths.
- **Unchanged & still binding:** the **human publish gate stays never-automated** (the sole sacred
  mutation); **no automated munshi→mcd bridge** (promotion happens only on an explicit later
  Chairman request); **no app-platform scope** (DEC-1); the **attention-ROI north-star +
  kill-criterion** (DEC-2) and the **pre-E3 attention-ROI gate** (DEC-4) remain binding; Phase 3's
  full active loop (auto-proposal, scheduling) stays parked (DEC-5).
- **New invariant wording:** *"read-only **except owner-initiated capture**."* Every other backend
  touch in this track is read-only.

This amendment is recorded across `HANDOFF.md`, `STATUS.html`, `SUMMARY.html`, both OS specs,
`CLAUDE.md`, and project memory (Slice 5).

---

## 1. Overview & goal

Make the SAMAGRA OS the **working control plane**: real captures flow *out* to the live subsystems,
and every read-only surface browses *real* data.

Four functional outcomes:

1. **Munshi capture (write).** From the Munshi app, the owner captures a front-desk item
   (`todo` / `note` / `followup` — the deterministic kinds the worker accepts) written to the **live prod munshi Worker**
   and appears in `library()`.
2. **mycontentdev seed capture (write).** From the mycontentdev app, the owner creates a **seed**
   (type + title + raw_text) written to the **live mycontentdev** backend.
3. **Simulations = deployed-only.** The Sims app shows **only the 482 deployed sims** (from the
   pratyaksh deploy manifest) with live `pratyakshsims.com` links — not the local folder scan.
4. **QX browser, separate + correct.** The Questions app stays a standalone **read-only** QX
   browser, and its **subject facets bug is fixed** (question-scoped subjects, not catalog-wide
   `SIM0xxx` ids).

The **linchpin discipline holds**: all real logic lives in pure, headlessly-tested TS modules +
read-only-or-creds-gated Python; React components/endpoints are thin. Each implementation gets an
**independent Codex review** before it is accepted.

---

## 2. Scope — six slices

Slices run **sequentially on one branch** (`feature/control-plane-capture`). Rationale: the writes
hit production, `samagra/api/app.py` is a shared file every slice appends to, and "independent
codex review for each implementation" maps cleanly to one review per finished slice. Correctness
over wall-clock.

| # | Slice | Kind | Independent Codex review |
|---|---|---|---|
| 1 | Munshi capture (write) | write | ✅ |
| 2 | mycontentdev seed capture (write) | write | ✅ |
| 3 | Sims — deployed-only (read) | read | ✅ |
| 4 | QX facets fix (read) | read | ✅ |
| 5 | Decision record + pointer-file sync | docs | — (doc consistency check) |
| 6 | Live end-to-end verification | verify | final integrated review |

---

## 3. Non-goals

- **No automated munshi→mcd bridge.** Promotion of a munshi item into an mcd seed is a manual,
  later, explicit Chairman action — not built here.
- **No publish automation.** The human publish/approve gate is untouched and never automated.
- **No new write paths beyond the two capture endpoints.** No edit/delete/status-change of munshi
  items or mcd seeds from the OS in this track (the underlying APIs exist, but they stay out of
  scope until asked).
- **No active-loop scheduling.** No tick, no auto-proposal, no `scheduler` changes. Phase 3 stays
  parked.
- **No catalog schema change.** `samagra.db` / `governance.db` untouched. New reads either query
  the catalog or parse a manifest / call QX directly.
- **No pixel-fidelity gate in the loop.** Visual parity is a separate owner pass (consistent with
  the OS spec §7.4). The capture composers reuse existing component patterns.

---

## 4. Architecture

### 4.1 The write seam (new)

```
React app  ──POST /api/munshi/capture──►  FastAPI route  ──►  MunshiClient.create_item ──►  munshi Worker  POST /api/item   (cookie)
React app  ──POST /api/mcd/seeds──────►  FastAPI route  ──►  McdClient.create_seed   ──►  mycontentdev    POST /api/seeds  (x-mcd-key)
```

- **Single origin.** The frontend only ever calls SAMAGRA's own FastAPI (`/api/*`); FastAPI holds
  the secrets and talks to the subsystems server-side. No subsystem secret ever reaches the browser.
- **Creds-gated.** Each write route returns **503** with a clear message when its client
  `available()` is false (no crash, graceful UI).
- **Validated server-side.** Reject empty/invalid `kind` (munshi) / `type` (mcd) with **400**.
- **Secret-safe.** Clients never log/`repr` secret values (already true for reads; preserved for
  writes).

### 4.2 The linchpin — pure TS modules (new)

| Pure module | Owns | Headlessly testable because |
|---|---|---|
| `lib/capture/munshi.ts` | `buildMunshiCapture(form) → {ok, body} \| {ok:false, error}`: kind enum (`todo`/`note`/`followup` only), per-kind required fields (`todo`→assignee+task, `note`→student+issue, `followup`→date+note), per-kind optional passthrough (due/label/person), non-empty validation | pure `(formState) → result`; assert per-kind body shape + missing-field error |
| `lib/capture/seed.ts` | `buildSeed(form) → {ok, body} \| {ok:false, error}`: type enum (`concept/question/snippet/simulation_idea/experiment/notebooklm_link/rough_idea`), title-optional-derive-from-raw_text, raw_text required | pure; assert body + validation |
| `lib/sims/deployed.ts` | shape/sort/filter/search over the deployed-sims rows returned by `GET /api/sims` (group by grade/subject, text filter) | pure array transforms over plain rows |

QX facets need no new TS logic module — the existing `lib/questions/facets.ts` is reused; only the
endpoint the app reads changes.

### 4.3 The write hook (new, thin)

`hooks/useApiPost.ts` — a minimal POST companion to `useApi` (GET-only today): `post(path, body)`
→ `{loading, error, data, post}`; JSON in/out; surfaces non-2xx as an error string. No retry, no
caching. Components call `buildX(form)` (pure) → `post(...)` → on success refetch the read list.

### 4.4 Components stay thin

- **Munshi app** gains a **capture composer** (kind `<select>` of `todo`/`note`/`followup` +
  the selected kind's per-field inputs + Capture button) above the existing read-only library list.
  Submit → `buildMunshiCapture` → `POST /api/munshi/capture` → refetch `library()`. *(Mic/photo FAB
  from the prototype is **not** in scope — text capture only; noted as a future option.)*
- **mycontentdev app** gains a **New seed composer** (type `<select>` + title `<input>` +
  raw_text `<textarea>` + Create button) → `buildSeed` → `POST /api/mcd/seeds` → refetch.
- **Sims app** is rewired to `GET /api/sims` (deployed manifest), rendering grade/subject groups,
  a search box, and live links. The old `/api/search?source=sims` path + `SIM0xxx` subject chips
  are removed.
- **Questions app** reads `GET /api/questions/facets` for its subject chips instead of the
  catalog-wide `/api/facets`.

---

## 5. Verified contracts (per slice)

### Slice 1 — Munshi capture

- **Read (live-verified):** `GET /api/library` (cookie `munshi=<urlencoded secret>`) →
  `{items[], people[], total}`; item `{id,kind,payload,person,due,tags,status,ts}`.
- **Write (grounded `agent.ts:227-236` + `tools.ts`):** `POST {MUNSHI_API_URL}/api/item` (same
  cookie; `content-type: application/json`), **flat JSON** body `{kind, ...fields}`. The worker
  accepts **only** `kind ∈ {todo, note, followup}` (others → 400) with kind-specific fields:
  `todo`→`{assignee, task, due?}`, `note`→`{student, issue, label?}`, `followup`→`{date, note, person?}`.
- **Client:** add `MunshiClient.create_item(kind, fields)` → `POST /api/item` with
  `json={"kind": kind, **fields}`, reusing the existing `_cookie()` auth. Secret never logged.
- **FastAPI:** `POST /api/munshi/capture` — body `{kind, ...fields}`; validates `kind` ∈ the three
  + that each kind's required fields are non-empty (400 otherwise), 503 if unavailable, returns the
  created item.

### Slice 2 — mycontentdev seed capture

> **Live-verified this session (deployed `mycontentdev.pages.dev`):** the **existing `adminKey`**
> (header `x-mcd-admin`) authorizes `/api/seeds` — `GET /api/seeds?limit=1` returned 200 with real
> rows. `functions/_middleware.js` gates `/api/*` on `keyOk` (APP_PASSWORD) **OR** `adminOk`
> (ADMIN_KEY), and `functions/api/seeds/index.js` adds **no** per-route re-check — so the seed
> *write* is authorized by the same `adminKey` reads already use. **No `APP_PASSWORD` / `MCD_APP_KEY`
> is needed.** (`ADMIN_KEY` is the intended Claude-session write credential.)

- **Write (contract read from deployed `functions/api/seeds/index.js`):** `POST {apiUrl}/api/seeds`
  with header **`x-mcd-admin: <adminKey>`**, body as **`multipart/form-data` / form-encoded**
  (the worker calls `request.formData()` — **not** JSON): fields `type` (required), `raw_text`,
  `title?` (server-derives from `raw_text` when blank), `detail?` (a JSON *string*), `source_ref?`,
  `files?` (**out of scope — text-only capture**) → **201** with the seed.
- **Client:** add `McdClient.create_seed(fields: dict)` → `requests.post(.../api/seeds,
  headers={"x-mcd-admin": adminKey}, data=fields)` (form-encoded; let `requests` set the content
  type — **do not** send JSON). Reuses the already-resolved `adminKey`; never logs it. *(The
  evolution-plan draft that POSTed JSON with `x-mcd-key` is superseded by this verified contract.)*
- **FastAPI:** `POST /api/mcd/seeds` — body `{type, title?, raw_text, detail?, source_ref?}`; 503
  when `McdClient.available()` is false (admin creds absent), 400 on bad/empty `type` or `raw_text`,
  returns the created seed.

### Slice 3 — Sims (deployed-only)

- **Source:** `pratyaksh-May-deploy/deployed-sims-by-grade.md` (grade → subject → `- <id> — <title>`
  for all 482). Fallback/complement: `deployed-sims.md` (flat id+title).
- **URL:** `https://pratyakshsims.com/sims/SIM<NNNN>/SIM<NNNN>_sim.html` where `<NNNN>` is the
  zero-padded id (`0018` → `SIM0018`). **Confirm the canonical public link** (`/sims/SIM0018/`
  vs the explicit `_sim.html`) against `public/_redirects` / `public/_worker.js` in the build.
- **Parser:** `samagra/sims_manifest.py` — pure `parse_deployed_sims(text) → [{id,title,subject,
  grade}]`; testable against a fixture string.
- **FastAPI:** `GET /api/sims` → `{sims:[{id,title,subject,grade,url}], total}` (manifest read +
  cached; SITE_URL base `https://pratyakshsims.com`). Read-only; absent manifest → empty list, not
  a crash.

### Slice 4 — QX facets fix

- **Cause (already diagnosed):** `/api/facets.subjects` is catalog-wide (`catalog.py:191`), and
  `adapters/sims.py:37` writes `SIM0xxx` folder ids into `subject`, so the chips are dominated by
  sim ids and clicking one yields 0 QX rows.
- **Fix (read-only, durable):** `GET /api/questions/facets` →
  `qx.summary()`-derived **question-scoped** `{subjects, chapters, q_types}` (`adapters/qx.py:57`).
  Empty/absent QX → empty lists. The Questions app reads this instead of `/api/facets`.

---

## 6. Safety model

- **Owner-initiated only.** Both writes fire on an explicit button click in the owner's console.
  Per the approved default, capture submits **directly on click** (no extra confirm dialog); the
  button label is the confirmation. (Trivially upgradable to a confirm step if desired.)
- **Server holds secrets.** Browser never sees a subsystem secret; FastAPI is the only caller of
  the clients.
- **Creds-gated, never crash.** Missing creds → 503 + a clear empty/disabled composer state.
- **Validated + bounded.** Server validates kind/type and non-empty text; reasonable length caps.
- **Publish gate sacred.** No publish/approve automation anywhere in this track.
- **No secret logging.** Preserved from the read clients; asserted in tests.

---

## 7. Testing strategy

Per slice: **RED → GREEN → VERIFY → independent Codex review → fix**, one focused commit per step.

- **pytest** (`.venv\Scripts\python -m pytest -q`, PYTHONPATH=repo root): client write methods with
  a **mocked** `requests` (assert URL, method, headers incl. cookie/`x-mcd-key`, body, secret never
  logged); new routes via FastAPI `TestClient` with a **mocked client** (assert 201/200, 400 on bad
  input, 503 when unavailable). The sims manifest parser tested against a fixture string. **No live
  HTTP in the test suite.**
- **Vitest** (`npm run verify` = lint → tsc → vitest → build): pure `lib/capture/*` + `lib/sims/
  deployed.ts` assertions (body shapes, validation, grouping); thin component smoke tests (composer
  renders, submit calls `post`, list refetches; Sims renders deployed rows + links; Questions reads
  the new facets path).
- **Gate:** backend `pytest` green + frontend `npm run verify` green, no `.only`/`.skip`.
- **Live (Slice 6, outside the unit suite):** real munshi capture round-trip (write → it appears in
  `library()`), real mcd seed create (once `MCD_APP_KEY` is provided), deployed-sims links resolve,
  QX facets show real subjects — with preview/screenshot proof.

---

## 8. Execution & review model

- **Branch:** `feature/control-plane-capture` off `main`. Sequential slices; one focused commit per
  RED/GREEN/VERIFY/review-fix step; Conventional Commits ending with the `Co-Authored-By` trailer.
- **Independent Codex review per slice** (the established pattern: `codex exec`, gpt-5.5 / xhigh,
  adversarial prompt scoped to that slice's diff). Findings are triaged via
  `superpowers:receiving-code-review` and fixed TDD before the slice is accepted. Reports saved
  under `docs/codex-reviews/`.
- **Advisory pre-commit gate** stays active (`core.hooksPath=.githooks` → `samagra review-staged`);
  never `--no-verify`, never self-break-glass.
- **Orchestration:** a Workflow drives the slice pipeline (build → per-slice Codex review → triage),
  with the main session running the **live** verification (Slice 6) since it needs `.env` creds and
  a browser preview.
- **Merge:** after all slices + the final integrated review, present the
  `superpowers:finishing-a-development-branch` options (PR per the usual flow).

---

## 9. Creds & operational dependencies

| Cred | For | Status |
|---|---|---|
| `MUNSHI_API_URL` + `MUNSHI_SECRET` | munshi read **and** capture write | ✅ in `.env` (prod Worker; live-verified read) |
| `mcd-cloud.json` `adminKey` | mcd **reads** *and* **seed write** | ✅ present; live-verified to authorize `/api/seeds` |
| ~~`MCD_APP_KEY` / `APP_PASSWORD`~~ | ~~mcd write~~ | ❌ **not needed** — `adminKey` authorizes the write (verified); the legacy `test-my-ship` candidate was rejected by `/api/auth/status` |
| (none) | sims, QX | read existing local sources / live QX |

**All creds for both capture paths are in place** — the full live end-to-end verification (Munshi
*and* mcd) can run this session.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Writing to **production** munshi/mcd | Server-side validation, creds-gating, owner-initiated only, no delete/edit/publish; live verification done deliberately in Slice 6 with the owner |
| `/api/item` body shape guessed wrong | Ground it against `myProd/src/agent.ts` + `tools.ts insertItem` before writing live; unit-test the built body; first live write is a single benign item the owner can dismiss |
| mcd write auth (which key?) | **Resolved** — deployed middleware accepts `adminKey` for `/api/seeds` (live-verified GET 200); no per-route re-check. `create_seed` uses `x-mcd-admin: adminKey`. First live write is a single benign seed the owner can archive |
| mcd seed body format | **Resolved** — deployed worker uses `request.formData()`, so `create_seed` sends form-encoded, not JSON (the plan's JSON draft would have failed) |
| Sims URL form wrong → dead links | Confirm canonical link against `public/_redirects`/`_worker.js`; the link is the only externally-visible artifact, easy to eyeball in Slice 6 |
| Secret leakage | Browser never receives secrets; clients never log values; tests assert `repr`/log safety |
| Shared `app.py` churn across slices | Sequential slices on one branch — additive route appends, no parallel edits |
| Scope creep back toward the active loop | Explicit non-goals (§3); no scheduler/bridge/publish work |

---

## 11. Acceptance criteria

This track is **done** when:

1. **Munshi capture works live** — a capture submitted from the OS appears in the prod munshi
   `library()` (verified Slice 6).
2. **mcd seed capture works live** — a seed created from the OS appears via the mcd read path
   (`adminKey` authorizes the write; no extra cred needed).
3. **Sims shows only the 482 deployed sims** with working `pratyakshsims.com` links; the local
   `SIM0xxx` scan + bogus subject chips are gone.
4. **Questions facets fixed** — subject chips are real question subjects (no `SIM0xxx`), and
   selecting one returns QX rows; QX browser remains standalone read-only.
5. **Each implementation passed an independent Codex review**, findings triaged + fixed; reports in
   `docs/codex-reviews/`.
6. **Gates green** — backend `pytest` + frontend `npm run verify`, no `.only`/`.skip`; advisory
   pre-commit gate clean (no break-glass).
7. **DEC-3 amendment + pointer files synced** — `HANDOFF.md`, `STATUS.html`, `SUMMARY.html`, both
   OS specs, `CLAUDE.md`, and project memory record the amendment and the new
   "read-only except owner-initiated capture" invariant.
8. **Branch integrated** per `superpowers:finishing-a-development-branch` (PR per the usual flow).
