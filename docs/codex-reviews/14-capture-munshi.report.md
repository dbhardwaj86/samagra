# Slice 14 — Munshi capture (production write path) — independent adversarial review

- **Slice:** Munshi capture (write) — first owner-initiated production-write path.
- **Diff reviewed:** `git diff b2f2599c942e82a6b1ee32c2c7516e4cf5ea21a7..1cca282d533ca1ce933976acc64b84f496b6fde5`
- **Branch:** `feature/control-plane-capture`
- **Reviewer:** Codex CLI (`codex-cli 0.140.0`, `codex exec`, `model_reasoning_effort=high`, sandbox `read-only`), findings independently re-verified by Claude.
- **usedCodex:** true
- **Raw Codex run log:** `docs/codex-reviews/14-capture-munshi.run.log`

## Verdict: GO-WITH-FIXES

The contract fidelity, cookie auth, secret-safety, creds-gating (503), and the 400 paths for the
*normal* UI flow are correct. One HIGH (server-side field whitelist gap) and two MEDIUM issues
(unhashable-`kind` 500; thin backend negative-test coverage) should be fixed before this write path
goes live, because the FastAPI route — not the TS `buildMunshiCapture` — is the real trust boundary
for a production write to the live Munshi worker.

## Files in scope (`--stat`)

```
frontend/src/apps/Munshi/index.test.tsx | 23 +
frontend/src/apps/Munshi/index.tsx      | 79 +
frontend/src/lib/capture/munshi.test.ts | 17 +
frontend/src/lib/capture/munshi.ts      | 22 +
samagra/api/app.py                      | 28 +
samagra/clients/munshi_client.py        | 13 +
tests/test_api_capture.py               | 29 +
tests/test_clients.py                   | 19 +
```

## Findings

### HIGH — `samagra/api/app.py` (`api_munshi_capture`, ~line 163): server does not whitelist forwarded fields to the per-kind contract
The route forwards every non-`kind` key to the production worker:
```python
fields = {k: v for k, v in payload.items() if k != "kind"}
...
created = client.create_item(kind, fields)
```
`client.create_item` then sends `json={"kind": kind, **fields}` to `POST {MUNSHI_API_URL}/api/item`.
The contract's allowed passthrough is only `todo.due`, `note.label`, `followup.person`. Any extra
key (`status`, `id`, `ts`, `person` on a `todo`, etc.) and any non-string value is relayed verbatim
into a live production write. The TS `buildMunshiCapture` whitelists correctly, but the server route
is the authoritative trust boundary for a prod-write and currently trusts arbitrary client input.
**Verified:** confirmed in diff; the dict-comprehension applies no key/type filter.
**Suggested fix:** define `ALLOWED[kind] = REQUIRED[kind] + OPTIONAL[kind]`; reject unknown keys
with 400 (or silently drop), require included values to be `str`, `.strip()` them, and pass only the
sanitized allowed subset to `create_item`.

### MEDIUM — `samagra/api/app.py` (~line 160): non-string `kind` yields 500 instead of the contracted 400
```python
kind = (payload or {}).get("kind")
required = _MUNSHI_REQUIRED.get(kind)
```
If a client sends `{"kind": ["todo"]}` or `{"kind": {...}}`, `dict.get(unhashable)` raises
`TypeError` → HTTP 500, violating the "400 on bad kind" contract.
**Verified:** reproduced — `{"todo":1}.get(['x'])` raises `TypeError: unhashable type: 'list'`.
**Suggested fix:** guard with `isinstance(kind, str)` before the `.get`, then membership-check the
exact set `{"todo","note","followup"}`.

### MEDIUM — `tests/test_api_capture.py`: backend negative-test coverage is thin for a prod-write path
Current tests cover happy-path, bad-kind (string), missing-field, and unconfigured (503). Missing,
given this is a production write: extra/unknown fields are rejected or stripped (the HIGH above),
non-string `kind` returns 400 (the MEDIUM above), non-string required values are rejected, and an
upstream failure maps to 502 without leaking response/request detail.
**Suggested fix:** add those negative tests plus an assertion that `create_item` receives only the
sanitized contract fields.

### LOW — `frontend/src/apps/Munshi/index.test.tsx` (~line 49): capture test asserts only method, not body/contract/error paths
The composer test asserts `fetch` was called with `method: "POST"` only. It does not assert the JSON
body shape, `content-type`, per-kind required/optional fields, client-side validation blocking, or
the `useApiPost` error-display path (`postError` / `formError` → `[data-testid="capture-error"]`).
**Suggested fix:** assert full request options for each kind and add validation/error-path tests
(note `buildMunshiCapture` itself is unit-tested in `munshi.test.ts`; the gap is the integrated app).

## Confirmed CORRECT (focus items, independently checked)

- **Contract fidelity (`munshi_client.py:create_item`):** `POST {api_url}/api/item`, flat JSON
  `{kind, **fields}`, `content-type: application/json` — matches the grounded myProd worker contract
  (`agent.ts:227-236` + `tools.ts`, per the design spec).
- **Cookie auth:** reuses `_cookie()` → `Cookie: munshi=<urlencoded(secret)>`, identical to the
  read path; asserted in `tests/test_clients.py::test_munshi_create_item_posts_json_with_cookie`.
- **Secret never logged:** `__repr__` masks the secret; asserted in two tests. The route's
  `except Exception` raises a generic `HTTPException(502, "munshi capture failed")` and does **not**
  forward upstream/exception detail (no secret, no URL, no `requests.HTTPError` body leaked).
- **Creds-gating (503):** when `MunshiClient().available()` is false the route raises 503 with a
  config hint (no secret); validation `HTTPException`s are raised *before* the `try`, so they are not
  swallowed by the broad `except`.
- **400 paths (normal flow):** invalid string `kind` and missing required fields both → 400.
- **`useApiPost` error handling:** on `!res.ok` it parses `detail` (falls back to `HTTP <status>`),
  sets `error`, returns `null`; the catch sets `error = String(e)`. The composer surfaces
  `formError || postError` in a `role="alert"` region and re-fetches the library only on success
  (`reloadKey` bump).

## Raw Codex output

```
Findings:

- HIGH samagra/api/app.py:163: Server-side validation does not restrict forwarded fields to the
  per-kind contract. fields = {k: v for k, v in payload.items() if k != "kind"} forwards arbitrary
  extra keys and non-string values to myProd, even though allowed passthrough is only todo.due,
  note.label, and followup.person. This weakens the production-write boundary.
  Suggested fix: define ALLOWED = REQUIRED + OPTIONAL per kind, reject unknown keys with 400,
  require all included values to be strings, trim them, and pass only the sanitized allowed fields
  to create_item.

- MEDIUM samagra/api/app.py:160: Bad kind values that are JSON arrays/objects can raise TypeError at
  _MUNSHI_REQUIRED.get(kind) because lists/dicts are unhashable, producing a 500 instead of the
  required 400 for bad kind.
  Suggested fix: first check isinstance(kind, str), then check membership in the exact allowed set
  {todo, note, followup}.

- MEDIUM tests/test_api_capture.py:6: Backend tests do not cover the adversarial contract cases that
  matter for this write path: extra fields rejected or stripped, non-string kind returns 400,
  non-string required fields return 400, and upstream exceptions do not leak response/request
  details.
  Suggested fix: add negative tests for those cases, plus a test that create_item receives only
  sanitized contract fields.

- LOW frontend/src/apps/Munshi/index.test.tsx:49: Frontend capture test only checks that fetch was
  called with POST; it does not assert JSON body shape, content-type, validation blocking, per-kind
  required fields, optional fields, or hook error display.
  Suggested fix: assert the full request options for todo/note/followup and add validation/error-path
  tests for buildMunshiCapture and useApiPost behavior.

Checked correct for focus items:

- samagra/clients/munshi_client.py:45 correctly posts to /api/item with flat JSON {kind, ...fields}
  and content-type: application/json.
- samagra/clients/munshi_client.py:46 correctly sends cookie auth as Cookie: munshi=<urlencoded
  secret>.
- samagra/clients/munshi_client.py:55 keeps repr() from exposing the secret.
- samagra/api/app.py:167 correctly gates missing Munshi credentials with 503 for otherwise valid
  requests.
- samagra/api/app.py:172 correctly avoids surfacing upstream exception details to the client.
- frontend/src/lib/capture/munshi.ts:13 correctly validates the UI-side kind/required fields and
  builds a flat contract body for normal UI submissions.

VERDICT: GO-WITH-FIXES
```
