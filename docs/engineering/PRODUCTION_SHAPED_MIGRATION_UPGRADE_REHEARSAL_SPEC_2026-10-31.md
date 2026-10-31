# Production-shaped migration upgrade rehearsal specification — 2026-10-31

Status: engineering test specification only. This document does not authorize a live migration, merge, or deployment.

## Purpose

Prove that the PR #157 date-prefixed migration chain can upgrade a PostgreSQL schema that faithfully represents the currently observed production migration history, without rewriting migration identities or weakening verification authorization.

## Non-negotiable invariants

1. Production's already-applied migration version `096` remains identified as `096_verification_authorization_provenance.sql`. Never reuse `096` for EPR immutability or any other SQL.
2. Do not insert, delete, rename, or rewrite rows in the production migration ledger during reconciliation.
3. Preserve migration `023_lifecycle_state_guards.sql`; it is present in the production ledger and is part of the 92-row production baseline. Never omit it from the reconstruction.
4. The production verifier's authorization semantics must remain intact: activity/evidence binding, organization lookup, self-verification prevention, verified membership and identity, active identity, permission aliases, and immutable authorization snapshot fields.
5. The rehearsal database must be isolated and disposable. No Neon production/staging/rehearsal branch is a test target.

## Baseline construction

Build a schema-only PostgreSQL 16 baseline from the exact ordered set of migrations recorded as applied in the production ledger as of the audit snapshot (92 rows): versions `001`–`087`, dated migrations `20261018`–`20261021`, then production-only version `096`. The live ledger confirms migration `023` is present. A machine-readable manifest records each version, filename and applied timestamp. The migration runner must preserve this chronology: numbered legacy migrations first, `20261018`–`20261021` next, historical `096` next, and the proposed `20261022+` chain after it.

The production `096_verification_authorization_provenance.sql` source has been restored byte-for-byte from immutable Git blob `258b1f4534efbf915688f78aa84d4ec24a47cbc0`; the resulting repository blob SHA must remain identical. It is now part of the candidate branch solely to reconstruct the observed production chronology and must never be repurposed.

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


## Implementation update — 2026-10-31

- The exact production ledger order was queried read-only from Neon. It contains 92 rows: `001`–`087`, `20261018`–`20261021`, `096`.
- Migration `023_lifecycle_state_guards.sql` is present in production; the prior claim that it was absent was incorrect and has been corrected here.
- The exact recovered `096` source is restored to `migrations/096_verification_authorization_provenance.sql`. Its Git blob SHA is `258b1f4534efbf915688f78aa84d4ec24a47cbc0`.
- The migration runner now uses an explicit chronology comparator so production-only `096` runs after `20261021` and before the proposed `20261022+` chain.
- Unit tests cover that ordering. A PostgreSQL acceptance test checks ledger order, migration 023 presence, migration 096 identity, all four authorization provenance columns, and verifier function guard markers.
- CI now has separate `production-baseline` and `production-upgrade` phases: it reconstructs the exact 92-row schema baseline first, then applies only the proposed `20261022+` chain, then reruns the upgrade phase to prove idempotency. The PostgreSQL acceptance test compares the first 92 migration identities against the captured live manifest.
- This is a disposable CI reconstruction, not a clone of production data or an authorized live migration. CI must pass on the exact head before the rehearsal can be called successful.
