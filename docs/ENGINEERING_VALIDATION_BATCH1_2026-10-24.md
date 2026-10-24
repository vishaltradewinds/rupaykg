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
