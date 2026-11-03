# Immutable CTO Checkpoint — Run 12 — 2026-11-03 18:00 UTC

## PR #243 source revision progress
Current head: 88b4b8f2db042c277b8de8b47077b1ab8722625f.
- Migration 089 adds activity.mrv_source_revision and snapshot.source_revision.
- Triggers increment revision for activity, verification, evidence, MRV observations and measurements.
- Migration 20261022 increments revision for evidence artifact versions and artifact reviews.
- Snapshot capture includes sourceRevision in the payload and stores source_revision.
- Credential issuance now requires the snapshot revision to equal the current activity revision.
- CI #5255: migration validation, disposable PostgreSQL migration, typecheck, build and browser smoke passed; automated tests are in progress.

## Remaining issue #245
- Database still does not recompute/verify source_digest against source_payload.
- Snapshot table TRUNCATE denial and runtime writer/owner privilege boundaries remain unproven.
- Evidence artifact ordering still lacks a deterministic artifact-version tie-breaker.
- Source revision implementation needs tests for each source family, artifact changes, concurrent updates and issuance invalidation.

## Production read-only evidence
- 67 public base tables; 0 RLS; 0 FORCE RLS.
- 92 migration rows; latest 20261021.
- mrv_source_snapshots absent; migration 088 not recorded.
- rupaykg role BYPASSRLS-capable.
- pgcrypto extension exists at 1.4; no production extension or schema changes.
Production remains READ-ONLY / HOLD.

## PR #244
Current head 9939f60... CI #5256 in progress; dependency audit, migration validation, disposable PostgreSQL migration, typecheck and build passed; browser smoke running. Earlier head 32028c4 passed CI #5246 including production-container build.
