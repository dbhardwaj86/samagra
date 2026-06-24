# DEC-7 pre-merge review: Phase C3 seed/mcd bridge fold

Repo: `C:/SandBox/claude_box/TeachingOS`
Branch/head reviewed: `feature/content-factory-phase-c3-seed-fold` at `48c2d39`
Base: `main`
Scope: `git diff main -- samagra/factory samagra/bridge samagra/__main__.py tests/`

## Verdict

GO-WITH-CAVEATS.

I found no HIGH or MEDIUM production-write boundary issues. The mcd write is behind the factory `build()` status/double-build/in-flight guards, payload validation runs before `product_building`, `run_seed()` revalidates immediately before `McdClient.create_seed`, and the deprecated bridge workflow delegates instead of retaining its own writer.

Caveats:
- one LOW malformed-note handling issue below;
- the requested pytest command could not be completed in this sandbox because pytest could not create its temp directory before any tests ran.

## Findings

### LOW 1 - Non-dict `product_proposed.payload` fails unclearly instead of returning `None`

`_load_proposed_payload()` treats any JSON object with a `payload` key as valid enough to return, without checking that the value is a dict: `samagra/factory/run.py:109-114`. `build()` then passes that value to `validate_seed_payload()` at `samagra/factory/run.py:290-295`, and `validate_seed_payload()` immediately calls `body.get(...)` at `samagra/factory/seed_payload.py:24-37`.

Impact: a malformed assignment-scoped note such as `{"payload": []}` or `{"payload": "x"}` will raise `AttributeError` instead of the intended clean refusal path where malformed/missing note content returns `None`. This does not create an mcd seed and does not wedge the assignment, because it happens before `product_building` is recorded at `samagra/factory/run.py:297-303`, but it misses the requested malformed-note behavior.

Suggested fix: either make `_load_proposed_payload()` return `payload if isinstance(payload, dict) else None`, or make `validate_seed_payload()` reject non-dicts with `ValueError`. Add a regression test with a `product_proposed` note whose `payload` value is a list/string.

## Boundary Review Notes

- Double-write/idempotency: `build()` refuses non-approved assignments, prior `product_created`, and in-flight `product_building` without `product_created` before producing anything at `samagra/factory/run.py:272-281`; `_build_in_flight()` is assignment-scoped and unbounded at `samagra/factory/run.py:251-257`.
- Write without approval: `build()` hard-requires `status == "approved"` at `samagra/factory/run.py:272-274`.
- Validate-before-write / anti-wedge: mcd payload load and validation happen before `product_building` at `samagra/factory/run.py:285-299`; `run_seed()` revalidates before `create_seed()` at `samagra/factory/dispatch.py:58-68`.
- Crash window: intent is committed before the external write at `samagra/factory/run.py:297-303`; on retry, the in-flight guard refuses before a second write at `samagra/factory/run.py:278-281`.
- Response handling: id-less and non-dict create responses are refused before capture at `samagra/factory/dispatch.py:68-72`.
- One-path F-C2: bridge `submit()` delegates to factory `build()` at `samagra/bridge/run.py:31-34`; bridge no longer imports or calls `McdClient`. The only changed in-scope caller is `dispatch.run_seed()` at `samagra/factory/dispatch.py:58-68`; the pre-existing web endpoint remains at `samagra/api/app.py:266-295` and is out of scope per review instructions.
- Wrong-lane writes: the seed lane is `kind="mcd"` and `source_prefixes=("munshi:",)` at `samagra/factory/lines.py:33-40`; textbook classification still yields revision/lecture/deck/paper/drill only via prefix filtering at `samagra/factory/lines.py:43-49`; textbook planning also skips any mcd line defensively at `samagra/factory/run.py:160-169`; `run_line()` refuses mcd lanes at `samagra/factory/dispatch.py:51-54`.
- Payload load: event lookup is assignment-scoped and unbounded through `store.list_events_for_assignment()` at `samagra/governance/store.py:194-198`; `_load_proposed_payload()` uses that scoped feed at `samagra/factory/run.py:104-115`.
- Regression coverage: seed workflow tests cover scan/dedup, unapproved refusal, one create, double-build, in-flight crash refusal, missing payload, and invalid raw text at `tests/test_factory_seed.py:64-304`; dispatch tests cover `run_seed()` validation/id handling and `run_line()` mcd refusal at `tests/test_factory_dispatch.py:154-193`; bridge tests cover shim/delegation at `tests/test_bridge.py:150-188`.
- Already-fixed CLI stale-key issue was not re-reported; current bridge scan printing uses `seed_ref`/`payload` at `samagra/__main__.py:171-174`, with regression coverage at `tests/test_bridge.py:220-229`.

## Verification

Commands/read basis:
- `git log -1 --oneline --decorate` confirmed `48c2d39`.
- `git diff --name-status main -- samagra/factory samagra/bridge samagra/__main__.py tests/`.
- Source and test file reads with line numbers.
- Source search for `create_seed` callers confirmed only the pre-existing API endpoint plus the factory dispatch boundary in source.

Requested test command status:
- `python -m pytest tests/test_factory_seed.py tests/test_factory_dispatch.py -q -p no:cacheprovider` failed before test execution with `PermissionError: [WinError 5] Access is denied: 'C:\\Users\\abc\\AppData\\Local\\Temp\\pytest-of-abc'`.
- Re-run with `TMP`/`TEMP` set to `C:\tmp` still resolved to the locked user temp root and failed before test execution.
- Re-run with `--basetemp=C:\tmp\pytest-codex-c3-seed-fold` also failed before test execution with `PermissionError: [WinError 5] Access is denied: 'C:\\tmp\\pytest-codex-c3-seed-fold'`.

No source file was modified by this review.

---

## Caveat closure (F1 — RESOLVED) — effectively GO

The single LOW (F1) is closed in commit after `48c2d39`:
- **Code:** `samagra/factory/run.py::_load_proposed_payload` now parses the note, then returns
  the payload **only if** the note is a dict carrying a **dict** payload — otherwise `None`
  (a clean `"no proposed payload"` refusal in `build()`). This also closes the latent
  downstream `AttributeError` in `validate_seed_payload` when a note's `payload` value is a
  non-dict (e.g. `{"line":"seed","payload":"oops"}`), which the original subscript form did
  not guard.
- **Test:** `tests/test_factory_seed.py::test_build_seed_refuses_malformed_proposed_note_cleanly`
  — a 6-case parametrize (bare string / null / list / invalid-json / dict-with-non-dict-payload /
  missing-payload-key) asserting a clean `ValueError("no proposed payload")`, **no write**, and
  **no wedge** (status stays `approved`, retryable). It red-confirmed the non-dict-payload case
  before the fix and is green after.
- **Gate after closure:** the full suite is **360 tests, 359 passing**, 1 pre-existing env
  failure (`tests/test_gdocs`, Google API libs — unrelated to this diff).

With F1 resolved and HIGH=MEDIUM=0, this review is **effectively GO** for merge.
