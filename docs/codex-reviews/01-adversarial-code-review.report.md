# SAMAGRA Baseline Code Review

## Executive Summary

SAMAGRA has a clean small-codebase spine, and several important basics are solid: SQL parameters are bound rather than string-concatenated, subprocess calls avoid `shell=True`, and source adapters are mostly read-only. The largest risks are not in algorithmic complexity; they are in trust boundaries: unauthenticated mutating HTTP routes, same-origin rendering of untrusted local HTML, broad local file serving, and path construction from slugs. The scheduler/state layer is also fragile under concurrency: locks and JSON writes are non-atomic, and the claimed coexistence with `physics-textbook`’s `.routine.lock` is not actually enforced before work begins. The current tests are too shallow to catch these issues and, in at least one place, mutate the real catalog.

## Findings Table

| ID | Severity | File:line | Title |
|---|---|---:|---|
| F-01 | HIGH | `samagra/api/app.py:96` | Mutating API routes have no authentication or CSRF protection |
| F-02 | HIGH | `samagra/scheduler.py:135` | Gates can be approved while still pending, bypassing prerequisite phases |
| F-03 | HIGH | `samagra/lectures/render.py:66` | Lecture rendering injects raw source HTML as same-origin executable content |
| F-04 | HIGH | `samagra/api/app.py:29` | `/open` exposes broad source roots and serves untrusted HTML same-origin |
| F-05 | HIGH | `samagra/lectures/export.py:20` | Chapter slugs are used in filesystem paths without traversal validation |
| F-06 | HIGH | `samagra/lock.py:19` | Scheduler file lock is TOCTOU and not atomic |
| F-07 | HIGH | `samagra/state.py:87` | JSON state files are written non-atomically and without a state lock |
| F-08 | HIGH | `samagra/scheduler.py:109` | Scheduler checks `physics-textbook` routine lock only after doing work |
| F-09 | MEDIUM | `samagra/catalog.py:46` | Catalog refresh deletes first, swallows adapter failures, and commits partial catalogs |
| F-10 | MEDIUM | `samagra/api/app.py:74` | API limits are unbounded; negative limits can dump whole datasets |
| F-11 | MEDIUM | `samagra/adapters/qx.py:18` | QX adapter opens live SQLite databases with `immutable=1` |
| F-12 | MEDIUM | `samagra/scheduler.py:82` | Export completion checks only `*-thick.html`, so missing thin exports are ignored |
| F-13 | LOW | `samagra/adapters/qx.py:84` | QX catalog paths are relative, so portal “open” links 403 |
| F-14 | LOW | `tests/test_spine.py:16` | Tests refresh the real catalog and assert mostly shape, not behavior |

## Detailed Findings

### F-01 — Mutating API routes have no authentication or CSRF protection

`/api/refresh`, `/api/tick`, and `/api/gate/{pipeline}/{decision}` are exposed as plain POST routes at `samagra/api/app.py:96-109`. They mutate `samagra.db`, JSON state, notifications, and eventually exports. If the server is ever run with `--host 0.0.0.0`, anyone on the network can operate the control plane. Even on localhost, any same-origin XSS from F-03/F-04 can POST gate approvals or run ticks.

Concrete fix: require an admin token on all mutating routes and fail closed.

```python
from fastapi import Depends, Header
import hmac, os

def require_admin(x_samagra_admin: str = Header(default="")):
    expected = os.environ.get("SAMAGRA_ADMIN_TOKEN")
    if not expected or not hmac.compare_digest(x_samagra_admin, expected):
        raise HTTPException(403, "admin token required")
```

Apply `Depends(require_admin)` to refresh, tick, gate, schedule installation if exposed later, and any future write route.

### F-02 — Gates can be approved while still pending, bypassing prerequisite phases

`scheduler.gate()` picks the first gate whose status is either `awaiting_gate` or `pending` at `samagra/scheduler.py:137-140`, then marks it done at `samagra/scheduler.py:143-145`. That means a user or HTTP caller can approve `textbook/approve` before `draft` and `enrich` are done. After that, `_run_pending_exports()` only checks that approve is done, so exports can begin from an invalid state.

Concrete fix: only allow decisions on `awaiting_gate`, and require all prior phases to be `done`.

```python
order = state.PIPELINES[pipeline]["phases"]
idx = order.index(target)
if st["phases"][target]["status"] != "awaiting_gate":
    return {"error": f"{pipeline}.{target} is not awaiting_gate"}
if any(st["phases"][p]["status"] != "done" for p in order[:idx]):
    return {"error": f"{pipeline}.{target} prerequisites are incomplete"}
```

The API should translate this to HTTP 409, not a silent JSON “error” with status 200.

### F-03 — Lecture rendering injects raw source HTML as same-origin executable content

`_block_html()` returns `block["html"]` directly for prose, equation, figure, callout, and subheading blocks at `samagra/lectures/render.py:66-76`; `sections_to_body()` injects those strings into the document at `samagra/lectures/render.py:79-86`; `/lecture/{slug}` serves the result as same-origin HTML at `samagra/api/app.py:54-60`. Any compromised or agent-generated `content.json` block can include `<script>`, event handlers, iframes, or fetch calls to `/api/gate`.

There is also a smaller portal XSS: textbook status values from `queue.json` are assembled into `meta` at `samagra/portal/static/app.js:59` and inserted unescaped at `samagra/portal/static/app.js:64`.

Concrete fix: sanitize allowed lecture HTML before rendering and escape all portal strings. For the portal bug, change `<div class="meta">${meta}</div>` to `<div class="meta">${esc(meta)}</div>`. For lectures, use an allowlist sanitizer such as `bleach`, strip event attributes, and add a restrictive CSP.

### F-04 — `/open` exposes broad source roots and serves untrusted HTML same-origin

`ALLOWED_ROOTS` contains entire source repositories at `samagra/api/app.py:29-32`, and `/open` serves any file under them at `samagra/api/app.py:113-123`. This can expose `.env`, SQLite databases, source files, queue files, logs, or private content if a path is known. It also serves `.html` inline, so any simulation or local HTML file runs under the SAMAGRA origin and can call the portal APIs.

Concrete fix: do not authorize by broad repo root alone. Authorize only catalog artifact paths, reject dotfiles and sensitive suffixes, whitelist extensions, and serve HTML from untrusted sources as an attachment or from a sandboxed separate origin. This route should also require the admin token from F-01 for anything not meant to be public.

### F-05 — Chapter slugs are used in filesystem paths without traversal validation

Slugs flow into paths directly: `render.load_chapter()` uses `TEXTBOOK_CHAPTERS / slug / "content.json"` at `samagra/lectures/render.py:59-63`, `_out_dir()` uses `EXPORT_DIR / slug` at `samagra/lectures/export.py:20-23`, and the scheduler reads slugs from external `queue.json` at `samagra/scheduler.py:80-84`. On Windows, backslashes in a slug are path separators, and an absolute path can override the intended base. A malicious or malformed slug can read outside `TEXTBOOK_CHAPTERS` or write exports outside `build/lectures`.

Concrete fix: centralize slug validation and resolved-path containment.

```python
SLUG_RE = re.compile(r"[a-z0-9][a-z0-9_-]{0,100}")

def safe_child(base: Path, slug: str, *parts: str) -> Path:
    if not SLUG_RE.fullmatch(slug or ""):
        raise ValueError(f"invalid chapter slug: {slug!r}")
    root = base.resolve()
    path = (root / slug / Path(*parts)).resolve()
    path.relative_to(root)
    return path
```

Use this in `load_chapter()`, `_out_dir()`, and scheduler export detection.

### F-06 — Scheduler file lock is TOCTOU and not atomic

`file_lock()` checks `is_busy()` at `samagra/lock.py:28`, then writes the lock at `samagra/lock.py:30`. Two scheduler processes can both observe “not busy” and both create/write the lock. The pre-check in `scheduler.tick()` at `samagra/scheduler.py:110-116` does not fix this because it repeats the same non-atomic pattern.

Concrete fix: acquire with an atomic primitive: `os.open(..., O_CREAT | O_EXCL)`, atomic directory creation, or a Windows-compatible lock library. Stale-lock removal must also be guarded so one process does not remove another process’s fresh lock after a stale check.

### F-07 — JSON state files are written non-atomically and without a state lock

`state.save()` writes directly to the final JSON path at `samagra/state.py:87-92`, then appends to `tracker.txt` at `samagra/state.py:93-94`. Gates, ticks, and even `GET /api/pipelines` can enter state code; `state.all_states()` calls `load()`, and missing states are initialized and written at `samagra/state.py:80-84` and `samagra/state.py:117-118`. Concurrent gate/tick/API calls can interleave, produce truncated JSON, or lose updates.

Concrete fix: add a single state lock and atomic replace.

```python
with file_lock(config.STATE_DIR / ".state.lock"):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(payload, encoding="utf-8")
    os.replace(tmp, path)
```

Also avoid write side effects from GET routes; return default state objects without saving, or initialize explicitly during setup.

### F-08 — Scheduler checks `physics-textbook` routine lock only after doing work

The module docstring says SAMAGRA honors `physics-textbook`’s `.routine.lock`, but `tick()` refreshes the catalog, reads `queue.json`, updates phase state, and runs exports before checking `config.TEXTBOOK_LOCK` at `samagra/scheduler.py:124-125`. If physics-textbook is writing `queue.json`, SAMAGRA can read a partial file, throw `JSONDecodeError`, or export during the other system’s critical section.

Concrete fix: check `TEXTBOOK_LOCK` before any catalog refresh that reads textbook data, before `_textbook_counts()`, and before export. The safest initial policy is to skip the tick when the foreign lock is busy.

### F-09 — Catalog refresh deletes first, swallows adapter failures, and commits partial catalogs

`catalog.refresh()` deletes `catalog`, `catalog_fts`, and `source_summary` at `samagra/catalog.py:46-48`, then catches broad adapter errors at `samagra/catalog.py:56-74` and still commits at `samagra/catalog.py:84`. A malformed source can leave the catalog empty or partially rebuilt while still reporting a completed refresh timestamp. Searches during refresh can also observe transient partial state.

Concrete fix: stage into temporary tables or a temporary database, then swap on success. At minimum, use a transaction/savepoint per adapter, rollback failed adapter rows, and preserve the previous catalog if the refresh is not globally successful.

### F-10 — API limits are unbounded; negative limits can dump whole datasets

`api_search()` and `api_questions()` accept arbitrary `limit` values at `samagra/api/app.py:74-88`; those values are passed directly into SQLite `LIMIT ?` at `samagra/catalog.py:123-125` and `samagra/adapters/qx.py:113-116`. SQLite treats `LIMIT -1` as effectively unlimited. Combined with `%` in QX `LIKE` search at `samagra/adapters/qx.py:101-103`, a caller can force very large responses.

Concrete fix: use FastAPI validation: `limit: int = Query(50, ge=1, le=500)`, cap query length, escape LIKE wildcards or use FTS, and validate `source`, `kind`, `pipeline`, and `decision` against known values.

### F-11 — QX adapter opens live SQLite databases with `immutable=1`

`_ro()` opens QX databases with `mode=ro&immutable=1` at `samagra/adapters/qx.py:18-19`. `immutable=1` tells SQLite the file will not change and disables normal locking/change detection assumptions. These QX databases are external live artifacts, not immutable snapshots. During a QX write, SAMAGRA can read stale or inconsistent data.

Concrete fix: remove `immutable=1`, keep `mode=ro`, set a timeout, and optionally `PRAGMA query_only=ON`. If snapshot consistency is required, copy the DB to a SAMAGRA-owned temp location under an explicit source lock and read the copy.

### F-12 — Export completion checks only `*-thick.html`, so missing thin exports are ignored

`_run_pending_exports()` decides whether a chapter is exported by checking only `config.EXPORT_DIR / slug / f"{slug}-thick.html"` at `samagra/scheduler.py:82`. If `thin.html` is missing or stale but `thick.html` exists, the scheduler can mark export done at `samagra/scheduler.py:85-88`.

Concrete fix: define expected artifacts per variant and check all required HTML outputs before marking the export phase done. If DOCX is required when Pandoc is installed, include those outputs in the completion predicate too.

### F-13 — QX catalog paths are relative, so portal “open” links 403

QX artifacts store `path=rel` from the source DB at `samagra/adapters/qx.py:77-85`. The portal global search builds an `/open?path=...` link for any result with a path at `samagra/portal/static/app.js:194-198`, but `/open` resolves relative paths against the SAMAGRA repo and rejects them if they are outside allowed roots at `samagra/api/app.py:115-117`.

Concrete fix: normalize QX paths to absolute paths under `config.QX_ROOT`, or do not emit an open link until the adapter can prove the file exists under an allowed root.

### F-14 — Tests refresh the real catalog and assert mostly shape, not behavior

`test_catalog_refresh_runs()` and `test_catalog_overview_shape()` call `catalog.refresh()` directly at `tests/test_spine.py:16-24` without monkeypatching `config.DATA_DB`. Running tests can overwrite the real `samagra.db`. The assertions mostly check that return shapes exist, so the tests would pass through many of the bugs above.

Concrete fix: monkeypatch `config.DATA_DB` to `tmp_path / "samagra.db"` and use fake adapters/source fixtures. Add behavioral assertions for atomic refresh, failed adapters, malformed queue data, path rejection, and API error status codes.

## Test-Coverage Gaps

- No FastAPI route tests for `/api/refresh`, `/api/tick`, `/api/gate`, `/open`, or `/lecture/{slug}`.
- No malicious input tests for slugs containing `..`, backslashes, absolute Windows paths, encoded separators, empty strings, or missing slugs.
- No concurrency tests for scheduler lock acquisition, simultaneous gate/tick calls, state JSON corruption, or catalog refresh races.
- No tests for `.routine.lock` behavior; current tests do not prove SAMAGRA actually waits for physics-textbook.
- No XSS tests for lecture block HTML, queue statuses, artifact titles, simulation HTML, or same-origin `/open` responses.
- No negative/huge `limit` tests for catalog search or QX live search.
- No tests for adapter failure mid-refresh and whether the previous catalog is preserved.
- No tests for QX read-only SQLite behavior while the external DB is being written.
- No Windows-specific path tests for backslash traversal, drive-letter paths, Task Scheduler failure modes, or non-UTF console output.
- I did not run the suite in this read-only review because the current tests mutate the real catalog.

## Top 5 Priorities

1. **Lock down the HTTP trust boundary** — add admin-token auth to mutating routes, cap inputs, and make gate errors return proper HTTP status codes.  
   Effort: 0.5-1 day.

2. **Fix path and HTML trust boundaries** — validate slugs, sandbox or sanitize lecture/source HTML, and restrict `/open` to safe catalog artifacts.  
   Effort: 1-2 days.

3. **Make locking/state writes atomic** — replace the scheduler lock, add a state lock, write JSON via temp file plus `os.replace`, and remove GET-side writes.  
   Effort: 1 day.

4. **Honor `physics-textbook`’s `.routine.lock` before reads/exports** — skip or partially disable ticks while the foreign routine lock is busy; handle malformed queue JSON gracefully.  
   Effort: 0.5 day.

5. **Rebuild tests around fixtures and adversarial cases** — move catalog DB to `tmp_path`, fake adapters, add API/path/XSS/concurrency/Windows tests.  
   Effort: 2-3 days.