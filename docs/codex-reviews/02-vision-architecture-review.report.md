## Verdict

The SAMAGRA direction is broadly sound if it stays a local-first control plane that reflects external systems instead of owning them. The current spine matches that idea: read-only adapters, a coarse FTS5 catalog, JSON phase state, scheduler gates, and a portal. The most important change before Phase 3 is to make safety guarantees enforceable, not just documented: separate read and write capabilities, add idempotency, add migrations/backups, and harden the governance store before any subsystem write exists.

The plan is coherent in broad order, but it is too trusting of convention in the exact places that matter: `McdClient.create_seed`, fail-closed local pre-commit, JSON state writes, and duplicated sensitive `munshi` payloads.

## Architecture Assessment

**Strengths**

- The adapter pattern is the right foundation. It keeps SAMAGRA as an index/control plane instead of a rewrite of QX, physics-textbook, mycontentdev, or munshi.
- The existing `Artifact` contract and `ALL_ADAPTERS` registry are simple and extensible.
- FTS5 is appropriate for the current catalog scale: 7,044 coarse artifacts plus source metadata is well inside SQLite’s comfort zone.
- The scheduler model is conservative: ticks are bounded, gates are explicit, and the textbook lock is respected.
- The plan correctly preserves subsystem authority: mycontentdev owns seed lifecycle; munshi owns intake; SAMAGRA should reflect and route.

**Weaknesses**

- Read-only is not uniformly enforced. QX uses immutable read-only SQLite connections, but file adapters mostly rely on convention. The planned `McdClient` includes `create_seed` in Phase 1, before governance exists, which weakens the safety boundary.
- `samagra.db` is both generated catalog and planned durable governance store. That mixes rebuildable data with irreplaceable assignments/events/reviews.
- JSON state files are written directly with no atomic temp-file replace, version check, or shared lock outside scheduler tick. Portal gate actions and future agent sessions can race.
- `catalog.refresh()` deletes and rebuilds source rows. If an adapter is temporarily unavailable, SAMAGRA can erase last-known visibility instead of marking it stale.
- The planned munshi adapter stores full `payload`, `person`, and tags in `meta`. That is not merely “reflecting”; it duplicates potentially sensitive operational data into `samagra.db`.

**Scaling Concerns**

- Full catalog rebuild is fine now, but HTTP-backed sources need per-source refresh status, retry policy, cursor/incremental refresh, and last-known-good retention.
- FTS5 will handle tens or hundreds of thousands of coarse records, but not if SAMAGRA starts copying full question bodies, seed revisions, or munshi payloads.
- Scheduler and gate actions need a real event model before more agents run concurrently.
- Deployment to HF Space/Docker is not ready: current paths, local file opener, mutating API routes, and missing auth are local-only assumptions.

## Plan/Sequencing Critique

**Phase 0: Rename**

- Done and correctly sequenced. Renaming first avoided dragging old `teachingos` names through later work.
- Current source tree matches Phase 0 status: package is `samagra`; Phase 1+ modules are not present yet.

**Phase 1: Read-Only Adapters**

- Correct next phase, but remove or hide write capability here. Do not ship `McdClient.create_seed` as a general method during a “read-only” phase.
- Add safety tests that assert adapters cannot call write endpoints.
- Keep last-known rows when source credentials are absent or APIs fail.
- Do not store full munshi payloads in catalog. Store stable id, kind, status, timestamp, short safe title/excerpt, hash, and fetch details live when needed.

**Phase 2: Governance**

- The governance store should come before Assignments UI and before the pre-commit hook.
- Add schema migrations, `schema_version`, backups, and restore docs before using this DB for durable assignments.
- Consider splitting `samagra.db` into `catalog.db` and `governance.db`. If kept together, document table ownership and never delete the DB as a catalog reset.
- Worktrees can be deferred until there is true concurrent agent editing. The Assignments store and outbox are more important.

**Phase 3: Active Loop**

- Correctly placed after adapters and governance.
- Missing idempotency: repeated scans must not create duplicate assignments for the same munshi item.
- Submit must be transactional around “approved assignment -> create seed -> record event.” If the remote write succeeds and local event write fails, retry could create duplicate seeds.
- Use a deterministic idempotency key, ideally based on `munshi_item_id + payload_hash`, passed through to mycontentdev if possible.

## Over/Under-Engineering Call

- **Keep:** read-only adapters, unified catalog, hard human gates, Assignments tab, audit events.
- **Simplify:** org titles. Keep roles as permission labels; avoid letting CEO/COO/Chief Architect language drive schema or branching complexity.
- **Defer:** per-agent worktrees until parallel editing is real. For now, `board/<agent>/outbox` plus assignment status is enough.
- **Change:** blocking Codex pre-commit. Blocking on confirmed `CRITICAL` is reasonable. Fail-closed on Codex unavailability with “no escape hatch” is not. Local Git hooks are bypassable with `--no-verify` anyway, so real enforcement belongs in CI/protected-branch checks. Local hook should be fast, cached by staged diff hash, and have an audited break-glass path.

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| Read-only boundary becomes convention, not enforcement | High | Critical | Separate read clients from write clients; no write methods in Phase 1; require approved assignment + idempotency key for writes |
| Codex hook wedges all commits when CLI is offline or flaky | Medium | High | Block only confirmed critical locally; use CI/protected branch for hard enforcement; add audited break-glass |
| Duplicate seed creation from repeated scan/submit | High | High | Add unique proposal keys, assignment uniqueness, remote idempotency key, and submit replay protection |
| `samagra.db` mixes generated catalog with durable governance | Medium | High | Split DBs or add migrations, backups, restore, and table ownership rules |
| JSON state corruption/lost updates under concurrent agents | Medium | High | Atomic writes, file locks for all state mutations, version/revision checks, transition validation |
| Sensitive munshi/mycontentdev data copied into catalog | Medium | High | Store refs/excerpts/hashes only; classify data sensitivity; keep details live-read or encrypted |
| Source API downtime erases catalog visibility | Medium | Medium | Per-source refresh transactions; retain last-known-good rows marked stale |
| Deployment exposes local-only mutating APIs | Medium | High | Add auth before Docker/HF; disable local file opener remotely; document secrets and mounts |

## Recommendations

1. Add a “Safety Architecture” checkpoint before Phase 1 ends: read/write client separation, no accidental writes, secret redaction, data classification, and last-known-good refresh behavior.
2. Move durable governance hardening earlier: migrations, schema versioning, WAL/busy timeout, backup/restore, and either separate `governance.db` or strict table ownership.
3. Replace “no escape hatch” pre-commit policy with enforceable branch protection plus local advisory blocking. Local should block confirmed critical findings, but tool failure should produce an audited bypass path.
4. Add idempotency to Phase 3 before implementing `submit`: unique assignment per munshi item/hash, single remote seed per assignment, retry-safe event recording.
5. Make JSON state writes atomic and locked. The current scheduler lock is not enough once portal gates and agent sessions mutate state.
6. Keep the org metaphor as UI/operating language, not as architecture. The architecture should model actors, permissions, assignments, and approvals; titles are presentation.
7. Add observability now: structured event ledger entries for refreshes, adapter failures, gate changes, Codex reviews, bridge proposals, and seed writes.
8. Treat deployment as a separate slice. Before HF Space/Docker, add auth, remove or guard `/open`, externalize local paths, and define secret/runtime configuration.