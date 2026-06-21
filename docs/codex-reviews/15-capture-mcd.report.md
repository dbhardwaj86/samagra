# Slice 15 — Capture: MCD seed write-path — adversarial code review

- **Slice:** `feature/control-plane-capture` — NEW production-write path: capture a "seed" into the live deployed mycontentdev Cloudflare Pages worker.
- **Diff reviewed:** `git diff fca69dd88b3f106f59e1d49e744166c40e6cd1d9..5149b4cf10a190091f9de0dd2599b154e90957ca`
- **Reviewer:** independent adversarial review, **Codex CLI used = yes** (`codex exec`, model `gpt-5.5`, reasoning effort `xhigh`). All Codex findings were independently re-verified against the source and the live worker contract; severities adjusted where warranted (see notes).
- **Verdict: GO-WITH-FIXES** — no CRITICAL/HIGH issues. Core contract (form-encoding, field names, `x-mcd-admin` header, timeout, secret never logged/repr'd, 400/502/503 handling, worker `201` accepted) is correct. The fixes below are quality/hardening, not blockers.

## Files in the slice
```
frontend/src/apps/Mycontentdev/index.test.tsx | 14 +++++-
frontend/src/apps/Mycontentdev/index.tsx      | 70 +++++++++++++++++++++++++--
frontend/src/lib/capture/seed.test.ts         |  7 +++
frontend/src/lib/capture/seed.ts              | 17 +++++++
samagra/api/app.py                            | 27 +++++++++++
samagra/clients/mcd_client.py                 | 13 +++++
tests/test_api_capture.py                     | 26 ++++++++++
tests/test_clients.py                         | 18 ++++++-
```

## Verification performed
- Backend: `pytest tests/test_api_capture.py tests/test_clients.py` → **25 passed** (trailing WinError-5 is a pytest atexit temp-dir cleanup quirk, unrelated to the tests).
- Frontend: `vitest run src/apps/Mycontentdev/index.test.tsx src/lib/capture/seed.test.ts` → **7 passed**.
- Contract cross-checked against the actual deployed worker `mycontentdev/functions/api/seeds/index.js`, `_middleware.js`, and `_lib/auth.js`.

## Contract fidelity — CONFIRMED CORRECT
- Worker does `request.formData()` and reads `type`, `raw_text`, `title`, `detail`, `source_ref`, `files`. `McdClient.create_seed` sends **form-encoded** (`data=fields`, NOT `json=`) — correct. Field names (`type`, `raw_text`, `title`, `source_ref`) match exactly.
- Auth: worker `_middleware.js` accepts `adminOk` (header `x-mcd-admin`, constant-time vs `ADMIN_KEY`). Client sends `x-mcd-admin: <adminKey>`. `/api/seeds` is not under `/api/admin/*`, so the central gate is the only check — consistent with the deployed behavior.
- Worker returns `201 Created`. `requests.raise_for_status()` treats 2xx as success, and the frontend `useApiPost` uses `res.ok`, so `201` is accepted end-to-end. The only nit: samagra re-emits it as `200` (finding #2).
- Two-hop encoding is correct by design: frontend → samagra speaks JSON (`useApiPost` sets `content-type: application/json`); samagra → worker speaks form. Validated.

## Security / secret-leak — CONFIRMED SAFE
- adminKey never logged anywhere; `data=fields` carries no key. The 502 catch-all raises a fixed string `"mycontentdev seed create failed"` and never interpolates the exception — upstream details (key/url) cannot reach the HTTP body at runtime. `__repr__` redacts both `admin_key` and (transitively) `app_key`. No leak path found.

## Findings

### MEDIUM — 1. Double-submit can issue duplicate production writes
`frontend/src/apps/Mycontentdev/index.tsx` (~line 35, `onSubmit`). `disabled={posting}` only takes effect after a React re-render, so two fast clicks (or Enter+click) can re-enter `onSubmit()` before `posting` flips, producing duplicate seeds on a production write path. **Fix:** add a synchronous in-flight guard (`useRef<boolean>`) at the top of `onSubmit`; optionally pass an idempotency key through samagra→worker. Low blast radius (single-owner console) but it is a real duplicate-write on a production endpoint.

### MEDIUM — 2. No 502 secret-non-leak test for the MCD seed path
`tests/test_api_capture.py`. The Munshi path has `test_munshi_capture_upstream_failure_502`, which raises an exception containing a fake secret/url and asserts the 502 body omits them. The new MCD seed path uses the identical `except Exception: raise HTTPException(502, "...")` shape (so it is safe at runtime), but the slice adds **no analogous test** locking that invariant for the new secret-bearing write path. **Fix:** add a test with a fake `create_seed()` that raises `RuntimeError` embedding the admin key + api_url, post to `/api/mcd/seeds`, assert `502` and that neither value appears in `r.text`. (Upgraded from Codex LOW → MEDIUM: this is the exact invariant the review exists to guarantee on a brand-new production-write path, and the precedent already exists.)

### LOW — 3. samagra collapses worker `201 Created` into `200 OK`
`samagra/api/app.py` (`@app.post("/api/mcd/seeds")`, ~line 201). Functionally fine (`res.ok` / `raise_for_status` both accept it), but the proxy is less contract-faithful than it could be. **Fix (optional):** `@app.post("/api/mcd/seeds", status_code=201)`; update `tests/test_api_capture.py` happy-path assertion and the frontend mock to `201`.

### LOW — 4. Stale docstrings now factually false (two files)
`samagra/clients/mcd_client.py` (module docstring lines 7–10) still says the client is "READ-ONLY" and that `create_seed` is "DEFERRED to Phase 3 ... intentionally not built here" — but `create_seed` IS now built (lines 57–68). `tests/test_clients.py` header (lines 1, 7) repeats the same false claim ("read-only ... create_seed is DEFERRED ... no write-path test here") even though `test_mcd_create_seed_posts_form_with_admin` was added at line 93. **Fix:** update both docstrings to describe the owner-initiated write path. Doc-only, no behavior change.

### LOW — 5. `__repr__` prints `api_url`
`samagra/clients/mcd_client.py:79`. The repr redacts the admin key but prints the deployment URL. The URL is a public Cloudflare Pages endpoint (not a credential), so this is borderline-noise; flagged only because the focus brief named "key or upstream URL leaks." **Fix (optional):** redact `api_url` as `<set:True>` if you treat the endpoint as sensitive. Recommend leaving as-is.

## Adjustments vs Codex
- Codex flagged #2 (missing 502 non-leak test) as LOW; **upgraded to MEDIUM** — it's the headline security invariant for this slice and a precedent test already exists to mirror.
- All other Codex findings reproduced and independently confirmed against source + live worker.

---

## Raw Codex output (`codex exec -m gpt-5.5 -c model_reasoning_effort=xhigh -s read-only`)

```
Findings:

1. MEDIUM [frontend/src/apps/Mycontentdev/index.tsx:35]: duplicate production writes are
   still possible. `disabled={posting}` only applies after React rerenders, so rapid
   double-clicks can enter `onSubmit()` twice. Fix with a synchronous in-flight `useRef`
   guard, and preferably send an idempotency key through Samagra for seed creation.

2. LOW [samagra/api/app.py:201]: Samagra collapses worker `201 Created` into FastAPI's
   default `200 OK`. The client path accepts upstream `201`, and `useApiPost` uses `res.ok`,
   so this is not broken, but the proxy contract is less faithful. Fix with
   `@app.post("/api/mcd/seeds", status_code=201)` and update tests/test_api_capture.py:83
   plus the frontend mock to assert `201`.

3. LOW [tests/test_api_capture.py:76]: no MCD equivalent of the Munshi upstream-failure
   non-leak test. The code currently hides exceptions behind "mycontentdev seed create
   failed", but this security invariant should be locked. Add a fake create_seed() that
   raises with admin key/API URL in the exception and assert the 502 body omits both.

4. LOW [samagra/clients/mcd_client.py:1]: docstring is stale and now false: it says the
   client is read-only and create_seed is deferred/not built. tests/test_clients.py:1 has
   the same stale statement. Fix both to describe the new owner-initiated write path.

5. LOW [samagra/clients/mcd_client.py:79]: __repr__ redacts keys but still prints api_url.
   If upstream URL is considered sensitive under this review's "key or upstream URL leaks"
   rule, redact it as <set:True> too.

Fine: form encoding is correct (`data=fields`), field names match the deployed worker
(`type`, `raw_text`, `title`, `source_ref`), timeout is present, and `raise_for_status()`
accepts worker `201`.

Verdict: GO-WITH-FIXES
```
