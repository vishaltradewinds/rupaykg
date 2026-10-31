# RupayKg canonical migration reconciliation — 2026-10-31

## Status

**Engineering proposal only. Production remains HOLD. Scheduler remains OFF. Certification remains OFF.**

This document records a live, read-only comparison of Neon database branches and defines a safe reconciliation sequence. No database was altered.

## Evidence captured

Neon project: `rupaykg-production-fresh`  
Project ID: `steep-mud-79906940`  
Database: `rupaykg`

| Evidence | Production/main | Government inbox staging | Migration rehearsal |
|---|---|---|---|
| Neon branch ID | `br-restless-base-b44cip2h` | `br-spring-hill-b4544vz5` | `br-broad-glade-b46npw8o` |
| `schema_migrations` rows | 92 | 95 | 4 relevant rows confirmed |
| Migration `096` | Present | Absent | Absent |
| `20261022`–`20261025` | Absent | All four present | All four present |
| Verification authorization snapshot columns | Present | Absent | Absent |
| `prevent_invalid_verification()` | Strong organization-scoped authorization and snapshot implementation | Weaker legacy implementation | Same weaker legacy implementation |
| `async_mirror_inbox` status constraint | Table not present | Does not allow `UNRESOLVED` | Allows `UNRESOLVED` |

### Production verification controls observed

The production `verifications` table contains `authorization_membership_id`, `authorization_role_id`, `authorization_permissions_snapshot` and `authorization_checked_at`, with foreign keys to `organization_memberships` and `roles`.

The production trigger function binds evidence to its activity and rejects mismatches; requires an organization for APPROVED verification; rejects self-verification; requires a VERIFIED membership and VERIFIED, non-suspended identity in the activity's organization; checks verifier permission against that organization's role; and stores the membership, role, permissions snapshot and authorization-check timestamp.

This is the control baseline. Do not replace it with the weaker function observed in staging/rehearsal.

### Async inbox observations

Staging's `async_mirror_inbox` has payload hash validation, unique authority/batch identity, lifecycle timestamps, lease fields, retry metadata and quarantine metadata. Its status check allows:

`RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY, QUARANTINED`

The rehearsal branch adds `UNRESOLVED`. Its documented meaning is an internal, non-authoritative state for structurally valid intake that cannot be matched to one unambiguous, current, verified jurisdiction crosswalk. It is not an official acceptance or rejection and must not be represented as an MRV result.

## Reconciliation decision

**Do not choose either staging or rehearsal as the new production baseline. Do not copy either branch wholesale.**

The target must be a forward-only, additive reconciliation that preserves production authorization semantics while introducing reviewed async-ingestion capabilities.

## Required source-of-truth work before SQL is authored

1. Identify and pin exact Git commit SHAs and migration source files for migration 096 and migrations 20261022–20261025.
2. Verify each migration's checksum, ordering, dependencies, idempotency assumptions and whether its effects are already represented in production.
3. Compare migration source against the live catalog, not only the migration ledger.
4. Determine whether rehearsal-only `UNRESOLVED` status and worker behavior are represented by reviewed source code and tests.
5. Build a single canonical ordered migration manifest. Never renumber or rewrite an already-applied migration to conceal branch divergence.
6. Prepare a new forward migration for any missing production capability. Preserve existing production objects and decision history.

## Implementation sequence

### Gate A — source provenance

- Pin repository commit SHAs for all relevant SQL and worker code.
- Produce a checksum manifest for each migration.
- Map every migration to prerequisites and affected objects.
- Resolve duplicate, renamed or missing migration identities without mutating applied history.

### Gate B — disposable PostgreSQL rehearsal

Use a fresh disposable database, not production and not the only copy of staging.

- Reconstruct production baseline through its recorded migration history.
- Apply the proposed forward-only migration set.
- Verify production verification trigger and authorization snapshot semantics remain intact.
- Apply async inbox, lease, rate-limit and AI evidence-intake migrations in canonical order.
- Verify `UNRESOLVED` is internal-only, non-authoritative and cannot trigger a carbon-credit, EPR or official authority decision.
- Test replay behavior, partial failure, recovery and duplicate execution.
- Compare resulting schema, constraints, indexes, triggers, functions and grants against the intended schema manifest.

### Gate C — security and reliability acceptance

Required automated PostgreSQL tests:

- Unverified, suspended or wrong-organization verifier cannot approve.
- A verifier cannot approve their own activity's evidence.
- Evidence/activity mismatch is rejected.
- Historical authorization snapshot remains unchanged after role or membership changes.
- `UNRESOLVED` cannot become accepted, verified, issued or settled without required independent authority workflow.
- Duplicate authority/batch intake is idempotently rejected or deduplicated.
- Expired worker lease recovery is safe.
- Stale fencing token cannot commit after a newer lease is acquired.
- Exhausted retry transitions to quarantine without losing original evidence.
- No failed or unresolved intake creates authoritative MRV, Guardian, registry or credit side effects.
- All intended tests execute; no relevant test is skipped.

### Gate D — release review

- Obtain independent review from an authorized reviewer.
- Require exact-head PR CI and PostgreSQL acceptance evidence.
- Attach migration checksums, schema diff, test logs and recovery evidence.
- Require explicit production change approval and tested backup/restore plan before any production migration.
- Keep scheduler disabled until operational acceptance is complete.

## Explicit non-actions

No production or staging SQL writes, DDL, migration, data copy/deletion, worker activation, deployment, merge or certification were performed.

## TRL and Shakti Standards

This is an engineering evidence task, not a TRL advancement. Database schema inspection and CI do not establish integrated operational readiness or TRL 9. Any TRL claim must be supported by component, subsystem and real operating-environment evidence under Shakti Standards.

## Evidence references

- Release gate and worker CI/review blockers: https://github.com/vishaltradewinds/rupaykg/issues/145
- Production and staging Neon branch IDs are recorded in the evidence table above.


## Follow-up provenance investigation — 2026-10-31 02:46 UTC

### Canonical repository path and source inventory

The actual migration directory is the repository-root `migrations/` directory. The earlier candidate paths under `db/`, `supabase/`, `database/` and `server/db/` were incorrect.

The root migration directory was enumerated on both `main` and `shakti/canonical-migration-history-mainline`. Both contain the same migration catalogue through `20261021_evidence_artifact_vault.sql`, plus `README.md`. Neither catalogue contains:
- `096_verification_authorization_provenance.sql`
- `20261022_async_mirror_inbox.sql`
- `20261023_async_mirror_worker_leases.sql`
- `20261024_ai_intake_rate_limits.sql`
- `20261025_ai_evidence_intake_jobs.sql`

This is now a confirmed repository-source gap, not merely an unlocated file path. The production ledger records migration 096, while staging/rehearsal ledgers record 20261022–20261025. Those applied database effects therefore cannot currently be reconstructed from the checked `main` or migration-history branch migration catalogues. Do not fabricate replacement SQL, infer checksums from database objects, or mark these sources reconciled.

The migration-history branch is nine commits ahead of `main` and changes only:
- `apps/src/migrate.ts`
- `apps/src/migration-history.ts`
- `apps/src/migration-history.test.ts`

The new migration-history guard rejects duplicate numeric prefixes, missing source filenames and version/filename prefix mismatches before migration application. Its tests cover those catalogue/ledger conflict cases. It does not provide the missing SQL source files, and the runner as inspected validates filenames rather than cryptographic content checksums. It is not sufficient by itself to reconcile the live branch histories.

### Corrected live table inventory

A complete user-table inventory confirms:
- Production has no `async_mirror_inbox`, `async_mirror_inbox_events`, `ai_intake_rate_limits` or `ai_evidence_intake_jobs` tables.
- Staging and rehearsal have those four tables.
- The staging inbox status constraint allows `RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY, QUARANTINED`, but not `UNRESOLVED`.
- Rehearsal permits `UNRESOLVED` as a non-authoritative internal state.
- Production retains the stronger migration-096 verification authorization snapshot controls described above.

### Worker PR source review (patch-level, not execution evidence)

The changed-file inventory and patches for PRs #122, #142, #143 and #144 were inspected:
- PR #122 adds `apps/src/async-mirror-worker.postgres.test.ts` (354 lines) and touches the CI workflow and CORS runtime tests.
- PR #142 changes worker claim eligibility so a PROCESSING row with a NULL lease is treated as expired/reclaimable.
- PR #144 changes the read-only reconciliation count to include NULL leases and adds a matching unit assertion.
- PR #143 changes only the CI workflow trigger.

The PR #122 PostgreSQL integration test is explicitly skipped unless both `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1` and `DATABASE_URL` are set. The test itself creates an isolated schema and tests quarantine, expired/NULL lease recovery, unresolved non-authoritative handling, append-only event history and stale-token fencing. However, the source-level existence of these assertions is not proof they executed. A run with the integration flag unset would skip the test and cannot satisfy the release gate.

### Updated decision

1. Treat the migration-history branch as a migration-runner safety improvement candidate, not as the canonical SQL migration history.
2. Keep PR #154 draft until original migration SQL and immutable provenance are recovered from an authoritative source (such as the original commit/object or a trusted backup/export), then verify byte-for-byte checksums.
3. Do not backfill production's missing async-mirror tables or staging's missing verifier snapshot controls from guessed SQL.
4. Require an exact-head CI run that proves the PostgreSQL integration test executed (zero relevant skips), plus independent reviewer approval and disposable full-history reconstruction.
5. Continue production HOLD, scheduler OFF and certification OFF. No database writes or schema changes were made during this follow-up.


### Provenance correction — migration 096 historical source recovered

A targeted Git path-history query found the original migration 096 source in repository history:
- Original source commit: `ca8f4100782e13f8d72106187fafc8e1e446214f` — “Bind verification to organization and snapshot authority”.
- Original path: `migrations/096_verification_authorization_provenance.sql`.
- Git blob SHA: `258b1f4534efbf915688f78aa84d4ec24a47cbc0`.
- The next commit, `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`, explicitly deleted that 97-line file with commit message “Remove accidentally placed unreviewed verification migration from main”.

Therefore migration 096 is not an unrecoverable source gap: its historical SQL and Git provenance are recovered. It remains absent from current `main` and the migration-history branch because it was explicitly removed as unreviewed. Do not re-add it automatically or rewrite the production ledger. Its original SQL must be independently reviewed against the live production trigger/function, column definitions, foreign keys and the rationale for the removal commit before deciding whether to restore the source as a historical immutable migration record or document it as an applied out-of-band migration.

The four async migration sources `20261022`–`20261025` remain absent from the current migration catalogues and no Git path history was found for those exact paths in the repository. Their original source/provenance remains unresolved. The distinction is important: migration 096 has a recoverable historical source; the four async migrations do not yet have a verified source in the checked repository history.
