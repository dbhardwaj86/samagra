VERDICT: **NO-GO**

**Critical**
None found.

**High**
- `samagra/bridge/run.py:194`: idempotency is not crash-safe. The code documents that if `McdClient().create_seed(payload)` succeeds at `samagra/bridge/run.py:202` and the process dies before `seed_created`/`captured` are written at `samagra/bridge/run.py:204` and `samagra/bridge/run.py:209`, retry can create a second MCD seed. This violates the “idempotent / no double-write” invariant. Fix by making MCD creation idempotent on `source_ref` or another deterministic key before/inside `create_seed`, and add tests for post-create/pre-ledger crash replay.

- `samagra/bridge/run.py:170`: concurrent `submit` can double-write. Two processes can both read `approved` at `samagra/bridge/run.py:181`, both see no `seed_created` at `samagra/bridge/run.py:185`, then both call `create_seed` at `samagra/bridge/run.py:202`. There is no DB lock or upstream idempotency across the external call. Fix with an atomic claim/submitting state plus upstream idempotency; local locking alone is insufficient if the process dies after the remote write.

- `samagra/bridge/run.py:29`: re-scan after `captured` can create a fresh assignment for the same munshi item because `_OPEN_STATUSES` excludes `captured`, and `_already_captured` is explicitly per-assignment at `samagra/bridge/run.py:160`. That means the same `seed_ref` can be re-approved and submitted again. Fix by deduping terminal captured assignments by `seed_ref` or by checking existing MCD seed `source_ref` before allowing a new proposal.

**Medium**
- `samagra/bridge/run.py:189`: `submit` bypasses the existing `/api/mcd/seeds` validation and sends the event payload directly to `McdClient.create_seed`. The API route validates type and non-empty string `raw_text` at `samagra/api/app.py:266`, `samagra/api/app.py:274`, and `samagra/api/app.py:283`; the client blindly posts `data=fields` at `samagra/clients/mcd_client.py:62`. Also, any `question` is classified as content at `samagra/bridge/classify.py:40`, even if its stem is missing and `build_seed_payload` emits `raw_text: ""` at `samagra/bridge/seed_payload.py:27`. Fix by extracting shared seed-payload validation and enforcing it in `submit` before the client call.

- `samagra/bridge/run.py:65`: munshi read failures crash `scan` when credentials exist but the service is down, because `adapter.artifacts()` calls `MunshiClient.library()` without a catch in `samagra/adapters/munshi.py:68`. The test at `tests/test_bridge.py:426` only covers `available() == False`, not network/HTTP failure. Fix by catching adapter/pointer exceptions in `scan` and returning `[]` or proposals with empty pointers, depending on the failure.

**Low**
- `samagra/bridge/outbox.py:24`: the path traversal guard is sufficient for path escape because only `agent` and `assignment_id[:8]` enter the path at `samagra/bridge/outbox.py:29`, but it validates only the first 8 chars while writing the full `assignment_id` into shell commands at `samagra/bridge/outbox.py:49`. A malicious caller cannot escape `board/`, but can inject confusing markdown/command text. Fix by validating the full assignment id and add an unsafe-assignment-id test.

- `samagra/bridge/outbox.py:29`: outbox paths are relative to current working directory, not repo root. Running the CLI outside the repo root can write `board/...` elsewhere while storing a misleading repo-relative path. Fix by writing to `config.REPO_ROOT / rel` and returning `rel.as_posix()`.

- `samagra/bridge/classify.py:24`: `_looks_physics` uses substring matching, so words like `network` or `paperwork` can match the physics term `work` from `samagra/bridge/classify.py:13`. This creates junk proposals despite the “conservative” claim. Fix with token-boundary matching and require non-empty extracted text before `question` becomes content.

**Test Gaps**
- Immediate double-submit is covered at `tests/test_bridge.py:349`, but crash replay, concurrent submit, re-scan after captured, unsafe `assignment_id`, invalid event payload, and munshi read exceptions are not covered.
- Outbox traversal coverage only checks unsafe `agent` at `tests/test_bridge_outbox.py:29`; it does not check unsafe `assignment_id`.

**Safety Invariants**
- Exactly two subsystem write paths: mostly honest. The branch adds no web endpoint; the route table remains the existing POSTs in `samagra/api/app.py:171`, `samagra/api/app.py:177`, `samagra/api/app.py:182`, `samagra/api/app.py:230`, and `samagra/api/app.py:266`. Bridge `submit` calls the existing `McdClient.create_seed` at `samagra/bridge/run.py:202`, which posts to MCD `/api/seeds` at `samagra/clients/mcd_client.py:62`. Caveat: it does not literally go through SAMAGRA’s `/api/mcd/seeds` route, so it bypasses that route’s validation.

- Approval gate: real for normal code paths. `approve` only accepts `in-review` at `samagra/bridge/run.py:132`, `scan` records `in-review` at `samagra/bridge/run.py:102`, and `submit` refuses anything not exactly `approved` at `samagra/bridge/run.py:181`. Unknown and already-`captured` assignments do not reach `create_seed`.

- Idempotency: not sufficient. Captured same-assignment retry is refused, but crash, race, and re-scan can double-write.

- No automated publish: this branch does not add publish calls or munshi→MCD auto-promotion. Existing scheduler state reflection can mark the SAMAGRA `publish` phase done at `samagra/scheduler.py:93`, but I found no MCD publish API call in the bridge.

- No secret leak: no bridge code writes env secrets, cookies, admin keys, `.env`, or client reprs to outbox/logs. The diff search only found variable-name references, not secret values. Error paths are not sanitized in the CLI, but the current clients do not put secrets in URLs or reprs.


