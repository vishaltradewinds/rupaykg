# Migration History Reconciliation — 2026-10-25

## Status

**HOLD: do not apply migrations to staging or production until the ledger conflict is resolved.**

The migration runner derives identity from the numeric filename prefix and fails when a ledger version is already associated with a different filename. The currently inspected staging ledger records:

- `20261022_async_mirror_inbox.sql`
- `20261023_async_mirror_worker_leases.sql`
- `20261024_ai_intake_rate_limits.sql`
- `20261025_ai_evidence_intake_jobs.sql`

The current engineering branch instead contains different migrations using those same version prefixes. The historical filenames were not found at the inspected refs in this repository. Do not assume their SQL is empty or redundant.

## Required forward-only recovery

1. Capture read-only exports of the migration ledger and database catalog from each candidate database. Record provider project, branch, database, role, server version, TLS status, and the sanitized endpoint; never record credentials.
2. Identify the actual runtime and migration database by inspecting deployment configuration metadata. Do not infer identity from the database name alone.
3. Recover the four historical SQL files from Git object history, CI artifacts, container image/source archives, release bundles, or the system that originally applied them. Verify provenance and checksums.
4. If original files cannot be recovered, reconstruct each migration from authoritative schema definitions and application history. Mark reconstructed files as reconstructions; do not claim they are original. Have an independent reviewer compare them against the live catalog and historical behavior.
5. Restore the historical migration filenames and immutable contents as the canonical identity where evidence supports them. Assign the new CPCB/BM migrations fresh, unused migration identifiers that do not collide with any applied or historically reserved version.
6. Keep the ledger filename identity check strict. Do not delete ledger rows, rename applied migrations, or add a bypass.
7. In a disposable PostgreSQL database, test both (a) fresh installation from the complete canonical migration set and (b) upgrade from a representative snapshot of the historical ledger/schema.
8. Verify table/function/trigger/constraint inventory, audit-chain anchor and triggers, append-only behavior, transaction rollback behavior, and runtime-role least privilege.
9. Add regression tests for duplicate versions, missing files, unexpected ledger entries, filename mismatches, and the invariant that a failed preflight causes zero schema changes.
10. Only after all checks pass, request review and explicit approval for a separately planned staging run. Production remains a separate gate.

## Preflight acceptance criteria

The migration runner must enumerate and validate the complete local migration set and compare it to the complete existing ledger before applying any migration. Any mismatch, unexpected ledger version, or missing authoritative history must stop the run before DDL. A fresh database may create the ledger only after local inventory validation has passed. Each migration and its ledger record must commit atomically.

## Known evidence limitations

The inspected database candidates are not yet proven to be the live service database. Missing audit-chain objects on a candidate do not prove the production service lacks them. Likewise, a healthy HTTP endpoint does not prove database readiness or end-to-end business workflow correctness.

## Gate

Engineering investigation only. No database writes, migration execution, environment changes, or deployment authorized by this document.
