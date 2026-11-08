# RupayKg Backup/Restore Acceptance Contract

## Purpose

Convert the production backup procedure into an executable evidence gate. A backup is not considered verified merely because `pg_dump` completed.

## Required evidence

1. A production logical backup is created from the authoritative PostgreSQL database.
2. The backup artifact is stored outside the repository in an access-controlled location.
3. Restore is performed into an isolated, empty PostgreSQL database.
4. Restore completes without using production credentials as the restore target.
5. Database migration/status checks complete against the restored database.
6. Critical application acceptance tests complete against the restored database.
7. Backup artifact checksum, source database identifier, restore target identifier, UTC timestamps, migration state and acceptance result are recorded.
8. The evidence must not contain database credentials, bearer tokens or sensitive application payloads.

## Fail-closed boundary

A backup file existing on disk is not sufficient evidence.

A successful `pg_dump` is not sufficient evidence.

A successful `pg_restore` is not sufficient evidence.

The gate closes only when restore integrity and application acceptance are demonstrated against the isolated restored database.

## Production safety

- Never restore over production.
- Never commit database dumps.
- Never print database URLs or credentials.
- Never treat application rollback as database rollback.
- Schema/data compatibility must be assessed before application rollback.

## Current status

**OPEN** — repository procedure exists; independently reproducible production backup/restore evidence is not currently present in the repository.

## Next execution

Run the operator-controlled backup/restore acceptance from a trusted environment with production and isolated restore database credentials supplied through secure secrets. Preserve machine-readable evidence as an external operational artifact and reference its immutable checksum from the release evidence record.
