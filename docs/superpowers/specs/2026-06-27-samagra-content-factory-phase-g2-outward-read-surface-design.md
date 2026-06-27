# SAMAGRA Content Factory — Phase G2: The Outward Read Surface + PRATHAM reader (design)

> **Status:** ratified design (2026-06-27). Continues **Phase G** (PRATHAM / the A6
> downstream student entity), following **G1** (the publish boundary, complete:
> `samagra/factory/publish/` + `samagra factory publish|unpublish|published`).
> Extends the umbrella content-factory spec `2026-06-23-samagra-content-factory-design.md`
> Plan A–G row G, and consumes the G1 export contract verbatim
> (`2026-06-26-samagra-content-factory-phase-g1-publish-boundary-design.md` §5).
>
> **One-line:** open the **first outward, read-only surface** over the corpus G1
> already gated — a public `GET /api/published` that serves the published manifest +
> sha-verified artifact bytes, and a **separate full-page `/learn` reader** (PRATHAM,
> Saar sheets first) that consumes ONLY that surface — **without** any write path,
> identity, session, or change to the inward factory.

---

## 1. Context & goal

Phase G is the **DOWNSTREAM** layer of the content factory (STEERING / ENGINE /
MOAT / SEAM / DOWNSTREAM). G1 closed the load-bearing gap: it made `published` a
real, durable, owner-gated state by COPYING a chapter's *captured* artifacts into an
immutable, append-only `published/` snapshot (manifest + frozen copies + per-publication
records). G1 deliberately shipped **CLI-first, no web endpoint** — its own non-goals
name the next step: *"a read-only `GET /api/published` is the natural start of G2,"*
and *"the outward read surface (`GET /api/published` + the student app, Saar sheets
first) — G2."*

**The gap this slice closes.** Today the published corpus is reachable only by the
single operator at a terminal (`samagra factory published`). The umbrella spec's A6
clause — *"a learner-facing product is a SEPARATE entity that consumes SAMAGRA's
published corpus"* — has a defined corpus (G1) but **no consumer**. G2 is that first
consumer: a network read surface plus a student-facing reader that turns the static
`published/manifest.json` into something a learner can actually open.

**G2 is the *read* half of the outward surface, and only that.** Plan A–G row G
bounds the full phase — *"multi-tenant identity + the single outward
`POST /api/factory/publish`, Saar sheets first, batch-by-chapter approval."* G2
takes **Saar sheets first** and the **read** path; it leaves **identity** to G3 and
the **outward publish** (write) path to G3, and the **adaptive twin** to G4. It is
the *safest outward crossing*: it exposes only bytes the owner already released
through the never-automated publish gate, adds no write path, and introduces no
identity or session.

**Phase G sub-slice discipline** (mirroring 1→C→D→E→G1): (G1) the publish boundary
✅, **(G2) the outward read-only surface + Saar-first reader** ← this spec, (G3)
multi-tenant identity + outward publish, (G4) the adaptive student twin.

## 2. Decisions locked (brainstorming forks, 2026-06-27)

| Fork | Decision | Rationale |
|---|---|---|
| Student-surface home | **Separate full-page `/learn` reader in the shared Vite build** — not the operator OS-shell, not a second build | honours A6's *"separate entity"* (distinct experience, no operator chrome) while staying one deploy; splittable to its own hostname in G3. Cheaper than a second build pipeline, cleaner than burying a "student" app inside the operator console |
| Content scope | **All published lanes, Saar-led ordering** — the reader is lane-agnostic but orders/leads with the `revision` (Saar) sheet | reads *"Saar sheets first"* as ordering, not restriction; surfaces every already-publishable lane (a published deck/paper is not invisible) and is future-proof as more lanes get published |
| Public exposure | **Code only, deploy-ready** — ship the public-by-design endpoint (NOT in `_PROTECTED_GETS`) + the `/learn` reader, fully working locally + behind the existing Access tunnel; actual public hostname / Access-bypass is a separate owner-driven deploy step | keeps the slice pure code + tests with no live-exposure blast radius; the infra step (Cloudflare config, the live tunnel) is owner-driven, tracked as a G2 follow-up |
| Artifact serving | **Dedicated guarded endpoint** that resolves the file *from the manifest* server-side (client never supplies a path) + re-verifies sha256, NOT a blanket static mount of `published/` | a static mount would expose `_publications/` internal records + `manifest.json` internals and invite path traversal; the manifest-resolved endpoint serves only published artifact bytes |
| Artifact rendering | **Sandboxed `<iframe>`** (`sandbox="allow-scripts"`, `src` → the artifact endpoint) | each lane's artifact is self-contained printable HTML (KaTeX/MathJax); an origin-isolated iframe typesets it without granting it access to the parent; no `dangerouslySetInnerHTML` of foreign HTML into the app DOM |

## 3. Architecture

```
  G1 OUTPUT (owner-gated, immutable)      THE READ SURFACE (G2)              THE CONSUMER (G2)
  ──────────────────────────────────      ─────────────────────              ─────────────────
  published/manifest.json ──┐
   (the export contract)     │   read-only   ┌───────────────────────────┐
  published/<chapter>/*  ────┤  ───────────▶ │ factory/publish/read.py   │   GET /api/published
   (frozen artifact bytes,   │  (no writes)  │  (PURE resolver over the  │ ──────────────────────▶  /learn  (PRATHAM reader)
    sha256 in the manifest)  │               │   manifest; never a       │   GET /api/published/      separate full-page SPA,
  _publications/ ───────────×│  NEVER read   │   client-supplied path)   │      {chapter}/{lane}      NO operator OS-shell
   (internal records)        │  by G2        └───────────┬───────────────┘ ──────────────────────▶    │
  governance.db ────────────×│  NEVER                    │ sha-verify + media_type                     │ sandboxed <iframe>
  EXPORT_DIR scratch ───────×┘  exposed                  ▼                                             ▼ renders the lane HTML
                                              public endpoints (NOT in _PROTECTED_GETS)     useApi('/api/published') → chapter
                                              graceful-empty if published/ absent           list → Saar-led lane tabs → iframe
```

**Firewall posture.** G2 is **read-only and additive**. It introduces **no write
path** anywhere — not to `published/`, not to `governance.db`, not to the seven
source subsystems, not to `EXPORT_DIR`. The new endpoints serve **only** (a) the
published manifest and (b) artifact bytes *resolved through that manifest* and
re-verified by sha256. They never read `_publications/` internals, `governance.db`,
`EXPORT_DIR` scratch, or any of the seven subsystems. The inward `build()` boundary
+ its five crash-safety guards + the never-automated publish gate are **untouched**.
**No governance migration, no new table, no catalog (`samagra.db`) change, no
assignment-state-machine change.** No identity, no session, no cookie — the surface
is intentionally public (read-only release content), the *gate* having already been
crossed by the owner at publish time.

**Why public-by-design is safe here.** Everything reachable through G2 is, by
construction, content the owner explicitly published through G1's manual,
never-automated gate. Making the read endpoints public (out of `_PROTECTED_GETS`)
exactly matches the Phase-E `GET /api/coverage` precedent and the A6 intent
(*"the published OUTPUT MAY be public-facing"*). Actually exposing a public hostname
is a deliberately separate owner step (the locked "code only, deploy-ready" fork).

## 4. Data substrate (real inputs, verified — all from G1)

| Input | Source (real API / path) | Shape used |
|---|---|---|
| Published manifest | `samagra.factory.publish.run.list_published()` (derives from the immutable `_publications/` records — the crash-authoritative source) | the `samagra.published.v1` object: `{schema, generated_at, publication_count, chapters{<slug>:{chapter,title,seed_ref,artifacts[]}}}` |
| Per-artifact files | each artifact entry's `files[]` in the manifest | `{rel: "<chapter>/<file>", sha256, bytes}` — `rel` is always a `<chapter>/<basename>` pair under `PUBLISHED_DIR` |
| Artifact bytes | the file at `PUBLISHED_DIR / rel` (frozen copy written by G1, content-stable) | read verbatim, sha256 re-verified against the manifest entry, returned with a derived `media_type` |
| Lane set | the lanes present in a chapter's `artifacts[]` (a subset of G1's `PUBLISHABLE = {revision, lecture, deck, paper, drill, samadhan}`) | rendered in Saar-led order; unknown/absent lanes simply do not appear |

**No new substrate.** G2 reads exactly the G1 export contract — no mapping, no
derivation, no new store. `list_published()` already exists and is already
crash-safe (derives from records, not the manifest cache). G2 adds a thin **resolver**
over it and two HTTP handlers.

## 5. Backend — module & endpoint layout

### 5.1 `samagra/factory/publish/read.py` (new, PURE over `run.list_published()` + bytes)

| Function | Responsibility |
|---|---|
| `published_manifest() -> dict` | thin delegate to `run.list_published()` (the public read of the current corpus). Kept as the single read entry point so the API never imports `run` internals directly. |
| `resolve_artifact(chapter, lane, kind="html") -> dict \| None` | look the `(chapter, lane)` entry up **in the manifest**; pick the file whose extension matches `kind` (`html`/`json`/`docx`); reject any segment failing G1's `_SAFE_SEGMENT` guard (defense-in-depth — though the path comes from our own manifest, never the client); resolve `PUBLISHED_DIR / rel`, confirm it stays under `PUBLISHED_DIR`, read bytes, **re-verify sha256 against the manifest entry** (a mismatch raises — surfaced, never silent), return `{rel, abs_path, bytes, sha256, media_type}`. Unknown chapter / lane / **kind** / missing file → `None`. |
| kind→media mapping (two module-level dicts `_KIND_EXT` / `_KIND_MEDIA`, **not** a free `_media_type(ext)` helper) | `html → (.html,.htm) → text/html; charset=utf-8`, `json → (.json,) → application/json`, `docx → (.docx,) → application/vnd.openxmlformats-officedocument.wordprocessingml.document`. An unknown `kind` is **not in `_KIND_EXT`**, so `resolve_artifact` returns `None` → the route 404s — *stricter* than an `application/octet-stream` catch-all (no unknown-type bytes are ever served), so there is no octet-stream fallback. |

`read.py` performs **no writes** and reads only `PUBLISHED_DIR` (via `run`/`store`)
— it never touches `governance.db`, `EXPORT_DIR`, `_publications/`, or the
subsystems.

### 5.2 `GET /api/published` (public — in `samagra/api/app.py`, beside `/api/coverage`)

```python
@app.get("/api/published")
def api_published():
    """The current published corpus (manifest). Read-only, PUBLIC (intentionally
    NOT in _PROTECTED_GETS) — serves only owner-released content. Graceful-empty
    if nothing is published yet (mirrors /api/coverage), never a 500."""
    from ..factory.publish import read
    try:
        return read.published_manifest()
    except FileNotFoundError:
        return {"schema": "samagra.published.v1", "generated_at": None,
                "publication_count": 0, "chapters": {}}
```

### 5.3 `GET /api/published/{chapter}/{lane}` (public — artifact bytes)

```python
@app.get("/api/published/{chapter}/{lane}")
def api_published_artifact(chapter: str, lane: str, kind: str = "html"):
    """One published artifact's bytes, resolved from the manifest + sha-verified.
    `kind` ∈ {html, json, docx}, default html. Public. 404 on unknown."""
    from ..factory.publish import read
    try:
        art = read.resolve_artifact(chapter, lane, kind=kind)
    except ValueError:
        raise HTTPException(status_code=500, detail="artifact integrity check failed")
    if art is None:
        raise HTTPException(status_code=404, detail="not published")
    headers = {"X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer"}
    if kind == "html":
        headers["Content-Security-Policy"] = "sandbox allow-scripts"
    return Response(content=art["bytes"], media_type=art["media_type"], headers=headers)
```

Both endpoints are **public** (left out of `_PROTECTED_GETS` in `origin_auth.py`,
exactly like `/api/coverage`). `kind` is validated against the small allowed set;
`chapter`/`lane` are never used to build a filesystem path directly — the path comes
from the manifest entry, so traversal is structurally impossible (and the segment
guard is a second layer). The artifact handler is the **only** way G2 yields file
bytes; there is no static mount of `published/`.

**Defense-in-depth response headers** (adversarial-review hardening — this is a
*public* byte surface served same-origin as the console). Every artifact response
carries `X-Content-Type-Options: nosniff` (no MIME-sniffing on the json/docx kinds)
and `Referrer-Policy: no-referrer` (the `/api/published/<ch>/<lane>` path never
leaks in the `Referer` when the artifact loads CDN resources). For `kind=html`, a
`Content-Security-Policy: sandbox allow-scripts` forces the document into an
**opaque origin even on direct navigation** (a shared deep-link or the reader's docx
href) — closing the gap the in-reader iframe sandbox leaves open — while still
letting the artifact's own inline + CDN KaTeX/MathJax run (the `sandbox` directive
isolates the *origin*, not resource sources, so there is deliberately **no**
restrictive `script-src`/`default-src` that would break math typesetting).

## 6. Frontend — the `/learn` reader (PRATHAM)

### 6.1 Split at the SPA root (no router dependency)

`frontend/src/main.tsx` branches on the path **before** mounting:

```tsx
import { isLearnPath } from "./lib/published/route";
// isLearnPath = `pathname === "/learn" || pathname.startsWith("/learn/")` — the
// exact-or-slash-prefix form, so "/learning" is NOT a match (a bare startsWith
// "/learn" would misclassify it).
const Root = isLearnPath(window.location.pathname) ? Pratham : App;
createRoot(root).render(<React.StrictMode><Root/></React.StrictMode>);
```

`<App/>` is the existing operator console (untouched); `<Pratham/>` is the new
student reader. The operator OS-shell, its window manager, themes, and 18 apps are
**not imported** by the reader — the two experiences share only the build, the
`useApi` hook, and `types/contracts.ts`. The SPA catch-all in `app.py` already
serves `index.html` for any non-`api/` path, so `/learn` and `/learn/<chapter>/<lane>`
all load the same bundle, which then self-routes.

### 6.2 `frontend/src/lib/published/` (PURE, headless-tested)

| Export | Responsibility |
|---|---|
| `PublishedManifest`, `PublishedChapter`, `PublishedArtifact` types | mirror the `samagra.published.v1` contract (add to / reuse `types/contracts.ts`) |
| `chaptersList(manifest) -> PublishedChapter[]` | defensive extraction + stable sort (title, then slug) |
| `LANE_ORDER` / `laneSort(lanes)` | Saar-led order: `revision, lecture, deck, paper, drill, samadhan`; unknown lanes appended alphabetically |
| `laneLabel(lane) -> {name, gloss}` | friendly names — **Saar** (revision), **Vaani** (lecture), **Smriti** (flashcards/deck), **Pariksha** (paper), **Abhyaas** (drill), **Samadhan** (solutions) — each glossed in English; unknown → titlecased slug |
| `artifactUrl(chapter, lane, kind?) -> string` | builds `/api/published/<chapter>/<lane>` (+ `?kind=` when not html) |
| `parseLearnPath(pathname) -> {chapter?, lane?}` | parse `/learn/<chapter>/<lane>` for deep links |

### 6.3 `frontend/src/apps/Pratham/index.tsx` (the reader component)

- A calm, student-facing layout (global doc preference: Inter, near-white bg, one
  accent) — **not** the operator chrome. Self-contained inline styles + a minimal
  `:root` palette (the reader is outside the theme-token system on purpose; it is
  the "separate entity" surface).
- `useApi<PublishedManifest>('/api/published')` → **chapter list** (left), **lane
  tabs** (Saar-led) for the selected chapter, and a **sandboxed `<iframe>`**
  (`src = artifactUrl(...)`, `sandbox="allow-scripts"`) rendering the selected
  lane's HTML. A secondary **"Download original (.docx)"** link when the manifest
  entry carries a `.docx` file.
- Deep-link aware via `parseLearnPath` (initial selection) + `history.pushState` on
  navigation. Empty manifest → a friendly "Nothing published yet" state (not an
  error). Unknown deep-link chapter/lane → fall back to the first available.

## 7. Data flow & error handling

Reader mount → `GET /api/published` → render chapters → select chapter → Saar-led
lane tabs → iframe `src = /api/published/<ch>/<lane>` → browser loads the frozen HTML
(KaTeX/MathJax typeset inside the isolated frame). **Failure modes:** missing
`published/` dir → backend returns the empty manifest shape (200, never 500) →
reader shows the empty state; unknown chapter/lane → artifact endpoint 404 → the
iframe shows a small "unavailable" notice; sha mismatch on a tampered/rebuilt frozen
file → `resolve_artifact` raises → 500 with a generic detail (the integrity breach is
surfaced, not silently served).

## 8. Invariants & acceptance

**Proposed DEC-11 (to ratify in this spec + trackers): the outward read surface.**
The published corpus is exposed outward as a **read-only, public-by-design** HTTP
surface (`GET /api/published` + manifest-resolved, sha-verified artifact bytes) and a
**separate full-page student reader** that consumes only that surface; G2 adds **no
write path, no identity, no session, and no change to the inward factory** — it
serves only bytes the owner already released through the G1 never-automated publish
gate.

- **Read-only & additive.** No write path introduced anywhere (`published/`,
  `governance.db`, the 7 subsystems, `EXPORT_DIR` all untouched by G2). No
  migration, no new table, no catalog change, no assignment-state-machine change.
- **Serves only published bytes, resolved through the manifest.** No static mount of
  `published/`; the artifact endpoint resolves the file from the manifest entry
  (never a client path) and re-verifies sha256; `_publications/`, `governance.db`,
  `EXPORT_DIR`, and the subsystems are never exposed.
- **Public-by-design, gate already crossed.** The read endpoints are intentionally
  out of `_PROTECTED_GETS` (the `/api/coverage` precedent); they reveal only
  owner-released content. Actual public-hostname exposure is a separate owner deploy
  step (the locked "code only" fork).
- **Separate entity, shared build.** `/learn` mounts `<Pratham/>` with **no**
  operator-shell imports; the console at `/` is byte-unchanged in behaviour.
- **Inward factory untouched.** `build()` + its five guards + the never-automated
  publish gate are unchanged; G2 is strictly downstream of G1.
- **Saar-led, all lanes.** The reader leads with the revision (Saar) sheet and
  surfaces every other published lane; nothing publishable is hidden.

**Acceptance (golden thread):** with a published `textbook:<slug>` chapter (produced
via `plan → approve_seed → build → publish`, or injected synthetically as G1's
acceptance does), `GET /api/published` returns the manifest with that chapter;
`GET /api/published/<slug>/revision` returns the frozen Saar HTML with the
manifest's sha256; the `/learn` reader lists the chapter, leads with the Saar lane,
and points the iframe at that artifact; an unknown chapter/lane is a 404; the empty
case (no `published/`) yields the empty manifest + the reader's empty state.
`governance.db` and `published/` are **byte-unchanged** by any G2 read (read-only
proven).

## 9. Review gate

- **TDD throughout** (the project's standing discipline) — §10.
- **Adversarial multi-lens final review** (Workflow, 4 lenses × independent verify),
  as every prior phase — focused on: the firewall (read-only proven; nothing beyond
  published bytes reachable), security (no path traversal; the public endpoints leak
  nothing un-published; the iframe sandbox isolates foreign HTML), spec-fidelity, and
  the separate-entity boundary (no operator-shell leakage into `/learn`).
- **No dedicated Codex pre-merge boundary review required** — unlike G1/D2/C3, G2
  introduces **no new write path or generation boundary**; it is a read-only surface
  over an already-reviewed contract. (The adversarial final review still covers the
  new network exposure.)

## 10. Testing strategy (TDD throughout)

- **`read.py` (pure, tmp `PUBLISHED_DIR`):** `resolve_artifact` happy path (bytes +
  sha match + media_type per kind); unknown chapter / lane / kind → `None`; missing
  file on disk → `None`; sha mismatch (tampered frozen file) → raises; segment-guard
  rejection; `published_manifest` delegates to `list_published`.
- **API (pytest, FastAPI TestClient):** `GET /api/published` populated + graceful-empty
  (no `published/`); `GET /api/published/{ch}/{lane}` happy path (correct
  bytes/content-type), `?kind=docx`/`json`, unknown → 404, traversal-attempt segments
  → 404/refused; **both endpoints reachable WITHOUT origin auth** (public — assert
  not gated, mirroring the coverage-endpoint test).
- **`lib/published/` (vitest, pure):** `chaptersList` defensive extraction + sort;
  `laneSort` Saar-led order + unknown-lane handling; `laneLabel` map + fallback;
  `artifactUrl` (with/without kind); `parseLearnPath` variants.
- **`<Pratham/>` (vitest, mock `useApi`):** chapter list renders; selecting a chapter
  shows Saar-led lane tabs; switching lane swaps the iframe `src`; empty manifest →
  empty state; deep-link initial selection.
- **`main.tsx` split:** `/learn` mounts the reader (not the console) — a small unit
  asserting the branch (pure predicate extracted to `lib/published` if needed).
- Gate: **pytest green** (≈+15–20 over the current 534) and **vitest green**
  (≈+15–25), no regressions; the lone pre-existing `test_gdocs` env red and the
  opt-in live-LLM-smoke skip are unrelated.

## 11. Non-goals (Phase G2, YAGNI)

- **No identity, login, session, cookie, or per-student state** → G3.
- **No outward `POST /api/factory/publish` (write path)** → G3; publishing stays the
  inward manual CLI from G1.
- **No adaptive/personalized content selection, no progress tracking, no
  annotations** → G4 (the full "twin").
- **No actual public-hostname / Cloudflare-Access-bypass config** — code is
  deploy-ready; the live exposure is a separate owner-driven step (locked fork).
- **No `samagra.db` indexing of published artifacts** — the reader reads the manifest
  directly.
- **No write path of any kind**, no governance migration, no new table, no
  assignment-state-machine change, no change to the inward `build()` boundary.
- **No operator-console changes** beyond the one-line `main.tsx` split (the console
  at `/` is behaviourally unchanged).

## 12. Open questions deferred (to the plan or a later G slice)

- **Lane friendly-naming** (Sanskrit *Saar/Vaani/Smriti/Pariksha/Abhyaas/Samadhan*
  with English gloss) — defaulted as above; the owner may adjust the labels at spec
  or plan review without changing the architecture.
- **Reader visual polish** (typography scale, mobile layout, print) — the layout is
  specced from the conventional docs/reader pattern; a dedicated visual pass (or the
  browser companion) can refine it post-merge.
- **Multi-tenant identity + outward publish** — G3.
- **The adaptive student twin** (per-student selection over the coverage graph) — G4.
- **A "published" badge in the operator console / Atlas** — a later read-only
  operator-console nicety, not G2.
