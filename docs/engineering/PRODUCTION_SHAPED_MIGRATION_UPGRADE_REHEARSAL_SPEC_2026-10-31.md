# Production-shaped migration upgrade rehearsal specification — 2026-10-31

Status: engineering test specification only. This document does not authorize a live migration, merge, or deployment.

## Purpose

Prove that the PR #157 date-prefixed migration chain can upgrade a PostgreSQL schema that faithfully represents the currently observed production migration history, without rewriting migration identities or weakening verification authorization.

## Non-negotiable invariants

1. Production's already-applied migration version `096` remains identified as `096_verification_authorization_provenance.sql`. Never reuse `096` for EPR immutability or any other SQL.
2. Do not insert, delete, rename, or rewrite rows in the production migration ledger during reconciliation.
3. Do not recreate intentionally absent migration `023_lifecycle_state_guards.sql` merely to make environments look alike.
4. The production verifier's authorization semantics must remain intact: activity/evidence binding, organization lookup, self-verification prevention, verified membership and identity, active identity, permission aliases, and immutable authorization snapshot fields.
5. The rehearsal database must be isolated and disposable. No Neon production/staging/rehearsal branch is a test target.

## Baseline construction

Build a schema-only PostgreSQL 16 baseline from the exact ordered set of migrations recorded as applied in the production ledger as of the audit snapshot (92 rows). The fixture must carry an explicit manifest containing, for every row, the exact version, filename identity, checksum if available, and applied order/time if available.

The legacy production `096_verification_authorization_provenance.sql` source must be sourced from the recovered immutable Git blob recorded in the audit (blob SHA `258b1f4534efbf915688f78aa84d4ec24a47cbc0`), not from a same-number migration in a candidate branch. If source/checksum identity cannot be verified, stop the rehearsal and report the missing artifact; do not guess or substitute.

Seed only the minimum synthetic rows required to exercise authorization and worker upgrade behavior. Never copy production personal, organizational, or evidence data.

## Upgrade test

Against the isolated baseline:

1. Capture the migration ledger rows and their ordered identity tuple before upgrade.
2. Capture verifier function definition and normalized semantic assertions before upgrade.
3. Apply the complete proposed PR #157 date-prefixed chain in repository order using the same migration runner as CI.
4. Assert all original ledger identities remain present and unchanged; assert no duplicate version and no reused numeric version.
5. Assert all new migrations are recorded once, in order, with expected checksums.
6. Assert verifier authorization columns, foreign keys, function guards and authorization snapshot writes still exist and behave as before.
7. Assert government inbox, source snapshot, LGD geography-scope and crosswalk constraints are present and reject invalid fixtures.
8. Run the full worker database acceptance suite after upgrade.
9. Run a second migration-runner invocation and verify it is a no-op with no schema/ledger changes, where the runner contract supports repeat invocation.
10. Export a machine-readable report with baseline manifest hash, candidate commit SHA, PostgreSQL version, migration ledger before/after, schema diff, function-definition diff, test names/results and exit status.

## Required negative tests

- Attempt to apply a candidate migration under version `096`: must fail before any SQL runs.
- Attempt to drop or weaken production verifier authorization checks: tests must fail.
- Attempt to change the existing production `096` ledger filename/checksum: tests must fail.
- Attempt to apply the date-prefixed chain to a schema with missing prerequisites: fail closed.
- Attempt to run against a non-disposable database URL: harness must refuse.

## CI integration

Use the existing GitHub Actions PostgreSQL 16 service. Add a separate job or test target that explicitly builds the production-shaped baseline fixture before applying PR #157's new migrations. The current clean-empty-database migration test remains useful but must not be relabelled as a production upgrade rehearsal.

## Exit criteria

PASS only when all invariants and tests above pass on the exact candidate head, with an attached machine-readable report. Until then PR #157 remains engineering-only; do not merge/apply its migrations to any Neon environment.
