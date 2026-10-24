# RupayKg Engineering Validation — Batch 1 (2026-10-24)

## AIM

Harden the platform's production database trust boundary and keep live release activity fail-closed while continuing the complete audit-writer and transaction-boundary review.

## Scope of this batch

This batch addresses two concrete production-path issues found while reviewing PR #44's current head:

1. The API's PostgreSQL pool silently configured `rejectUnauthorized: false` whenever `DATABASE_SSL` was not explicitly set to `false` or `require`. This made an untrusted server certificate acceptable by default.
2. The migration runner used the same insecure TLS setting and could begin DDL before the production configuration contract was validated.
3. The container entrypoint ran the optional acceptance fixture seed on every startup. Although the seed is gated by an environment variable and is normally a no-op, production startup should not invoke a data-writing fixture at all.

## Changes made on this branch

- `apps/src/server.ts`: PostgreSQL TLS now verifies certificates by default. An explicit `DATABASE_SSL=false` remains available for local/disposable databases and the provider-approved private-network case that the production configuration explicitly permits. `DATABASE_SSL=require` enables certificate verification and passes the configured CA when present.
- `apps/src/migrate.ts`: when `NODE_ENV=production`, the complete `readProductionConfig()` contract is validated before the database connection is opened or migration DDL runs. Production TLS settings and CA material are derived from that validated configuration. Outside production, certificate verification is enabled unless the operator explicitly sets `DATABASE_SSL=false`.
- `Dockerfile`: the production entrypoint no longer runs `acceptance-seed.js`. Acceptance fixtures must be run only as an explicit, separately authorised operation in a controlled environment.

## Safety posture

- No production database was contacted or mutated by these code changes.
- No migration was executed against production.
- No deployment, PR merge, live Guardian submission, Hedera write, or Mirror Node acceptance was performed.
- This patch does not claim to complete the audit-writer inventory or prove chain continuity.

## Audit-writer inventory — initial finding

A source scan on the reviewed head found four production write paths into `audit_events`:

- `apps/src/platform-admin-routes.ts`: locks and advances the singleton `platform_audit_chain_head` in the same transaction. This is the only writer found in this scan that participates in that global chain-head protocol.
- `apps/src/cpcb-swm-routes.ts`: selects the latest event per organization using `ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`, then inserts a SHA-256 event. This is not the singleton global chain; concurrent first/last writes can race, and timestamps/UUID order are not a safe chain sequence.
- `apps/src/sync-routes.ts`: field-device enrollment and verification insert hashed audit rows without `previous_hash`, `request_id`, or updating the singleton chain head.
- `migrations/050_field_sync_conflict_audit.sql`: the field-sync conflict trigger writes an MD5-derived event hash without linking it to the global chain head.

Migration `084_platform_audit_chain_head.sql` explicitly documents that legacy writers do not all participate in its chain. Therefore the current implementation must **not** be described as one complete, globally chained audit ledger. The event table contains audit records, but integrity guarantees vary by writer.

**Next high-priority engineering batch:** define one canonical transactional append contract (including strong deterministic hashing and chain-head locking), migrate all application and trigger writers to it, and add disposable-PostgreSQL tests for concurrent appends, rollback atomicity, duplicate/retry behavior, and post-restore chain verification. Preserve historical rows; do not rewrite or falsely certify the historical chain.

## Required validation

The CI run on this exact branch/head must pass:
- dependency audit;
- migration validation and application to disposable PostgreSQL;
- typecheck and production build;
- API/domain and database integration tests;
- browser smoke test;
- production container build.

After CI, inspect the actual run and head SHA before accepting the batch.

## Remaining gates

1. Inventory every writer to `audit_events` and any parallel audit/event streams across API routes, scheduled jobs, triggers, and scripts.
2. Add/execute tests for transaction rollback, concurrent append ordering, duplicate/idempotent retries, and chain continuity after restore.
3. Complete cross-tenant, geography-scope, evidence-version/hash, and independent-review negative tests.
4. Verify the actual production database target, supported recovery path, backup/restore, and migration ledger read-only. Do not perform production mutation as part of these tests.
5. Prove authorised Guardian verification, Hedera consensus, persisted provenance, and Mirror Node confirmation before any external-trust-chain acceptance claim.

## Release decision

**HOLD — engineering review only.** A successful build or CI run does not constitute production certification or regulatory approval. Deployment remains the final gate after the above evidence is reviewed.


## Batch 2 — global audit-chain enforcement (engineering implementation; DB integration pending)

- Added migration `088_global_audit_chain_enforcement.sql`. PostgreSQL now owns the canonical append path for all `audit_events` inserts: a `BEFORE INSERT` trigger locks the singleton head, sets `previous_hash`, computes SHA-256 over canonical JSONB fields, and an `AFTER INSERT` trigger advances the head in the same transaction.
- The trigger deliberately overwrites caller-supplied hashes so older application writers and the field-sync conflict trigger cannot fork the global chain. UPDATE/DELETE attempts against audit rows fail closed.
- Updated platform-admin application code to rely on the database-owned chain mechanism rather than calculating a competing hash and advancing the head a second time.
- Added a PostgreSQL integration test for concurrent appends, caller-hash override, rollback atomicity, chain continuity, and append-only behavior. This test is opt-in and was skipped locally because no disposable PostgreSQL integration database was configured. It must run in CI against an isolated migrated test database before this batch can be accepted.
- Scope boundary: migration 088 creates a globally serialized chain for new appends from the migration-time head. It does not retroactively certify legacy rows, prove historical tamper resistance, or establish production certification. Production remains HOLD; no production database was contacted or mutated.


## Batch 3 — remove remaining alternate audit/startup paths

- CPCB SWM route audit writes no longer query the latest organization event or compute a competing per-organization hash. They insert the event payload and let migration 088 own predecessor selection and hashing.
- The API workspace `start` script now launches only the production server; it no longer invokes the optional acceptance-seed script.
- The acceptance-seed script now refuses to run when `NODE_ENV=production` and verifies PostgreSQL TLS certificates by default, with optional `DATABASE_CA_CERT` support.
- Added source-contract tests for production start behavior and acceptance-seed safety. This batch is engineering-only until typecheck, full tests, migration validation and exact-head CI complete. No seed script was run against any database.


## Batch 4 — persist the audit cutover root

- Strengthened migration 088 to persist a dedicated `AUDIT_CHAIN_CUTOVER_ANCHOR` event plus immutable `platform_audit_chain_anchor` metadata, including the legacy predecessor ID/hash. This gives operators and restore verification a stable root for the post-cutover chain without pretending that pre-cutover history is certified.
- Migration locks the chain-head and audit tables in a consistent order, refreshes the legacy predecessor at cutover, installs the common triggers, then appends the cutover event and stores its root record in the same migration transaction.
- Extended the disposable-PostgreSQL integration test to verify the persistent anchor, traverse from the anchor through the chain head, validate canonical hashes, and reject mutations to both audit events and the anchor record.
- This batch still requires exact-head CI confirmation before acceptance. Production remains untouched and certification remains HOLD.


## Batch 5 — read-only audit-chain verifier

- Added `npm run verify:audit-chain -w @rupaykg/api`, a standalone read-only verifier. It requires an explicitly configured `DATABASE_URL`, verifies TLS certificates by default (unless `DATABASE_SSL=false` is explicitly selected for an approved disposable/private-network target), and opens a PostgreSQL `REPEATABLE READ READ ONLY` transaction.
- It checks the immutable anchor record, cutover event, legacy predecessor pointer, canonical SHA-256 for each reachable event, cycles/forks, head reference consistency, reachability from anchor to head, and a conservative scan for events timestamped at/after the anchor that are not reachable.
- It never runs migrations or writes data. It exits non-zero for failed checks and emits a JSON report suitable for controlled operations evidence. The timestamp-based orphan check is intentionally conservative and must be interpreted with the report's caveat; pre-cutover rows are not retroactively certified.
- Added static tests to guard the verifier's read-only transaction and prohibit mutation/migration SQL in the verifier source. Next gate: typecheck/full tests, then CI on the exact commit. Do not point this tool at production until an operator has verified the target URL/host and supplied read-only credentials; this batch does not contact production.


### Batch 5 CI wiring

The CI workflow now runs the verifier after disposable PostgreSQL integration tests against `rupaykg_baseline_test`, using a read-only transaction and an explicitly local test-database URL. This turns the verifier from a compile/static-test-only artifact into an exercised SQL path in CI. The workflow change requires its own exact-head CI run before the batch is accepted.
