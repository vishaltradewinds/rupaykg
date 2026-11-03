# Neon Live Catalog Audit — 2026-11-03

Status: READ-ONLY OBSERVATION / RELEASE BLOCKER. No SQL writes, migrations, role changes, grants, RLS changes or worker activation were performed for this audit.

## Target identity

| Field | Observed value |
|---|---|
| Neon project | `rupaykg-production-fresh` |
| Project ID | `steep-mud-79906940` |
| Branch | `main` |
| Branch ID | `br-restless-base-b44cip2h` |
| Database | `rupaykg` |
| PostgreSQL | 18 |
| Branch state | ready; default and primary |
| Repository | `vishaltradewinds/rupaykg` |
| Inspection | Neon catalog queries via read-only SELECT |

The branch has no MRV worker API schema, no `public.mrv_submission_jobs` table and no `public.mrv_submission_job_events` table. The current repository's durable worker migration `20261109_durable_mrv_submission_jobs.sql` is therefore not reflected in this live branch.

## Protected relation RLS inventory

The following 12 existing relations were inspected directly in `pg_class` and `pg_policy`. Every existing relation is owned by `rupaykg`, has RLS disabled, FORCE RLS disabled, and has no policies.

| Relation | Exists | RLS | FORCE RLS | Policies |
|---|---:|---:|---:|---:|
| `organizations` | Yes | Off | Off | 0 |
| `identities` | Yes | Off | Off | 0 |
| `organization_memberships` | Yes | Off | Off | 0 |
| `roles` | Yes | Off | Off | 0 |
| `activities` | Yes | Off | Off | 0 |
| `evidence` | Yes | Off | Off | 0 |
| `verifications` | Yes | Off | Off | 0 |
| `geography` | Yes | Off | Off | 0 |
| `organization_geography_scopes` | Yes | Off | Off | 0 |
| `mrv_observations` | Yes | Off | Off | 0 |
| `measurements` | Yes | Off | Off | 0 |
| `mrv_provenance_events` | Yes | Off | Off | 0 |
| `mrv_submission_jobs` | **No** | N/A | N/A | N/A |
| `mrv_submission_job_events` | **No** | N/A | N/A | N/A |

This is a live-main observation, not a rehearsal result. The absence of the two durable queue tables means the worker cannot be enabled against this branch using the current repository contract.

## Live role posture

The only matching role found among the worker/bootstrap role names queried was:

| Role | LOGIN | SUPERUSER | CREATEDB | CREATEROLE | INHERIT | REPLICATION | BYPASSRLS |
|---|---:|---:|---:|---:|---:|---:|---:|
| `rupaykg` | Yes | No | Yes | Yes | Yes | Yes | **Yes** |

No `rupaykg_mrv_worker_runtime`, `rupaykg_mrv_worker_api_owner`, `rupaykg_security_definer`, `rupaykg_bootstrap_owner` or `rupaykg_bootstrap_custodian` role was present in the queried role set.

The current database owner/runtime role's `BYPASSRLS` and elevated attributes mean it is not an acceptable restricted MRV worker identity. Do not run the worker using this role. Do not attempt to repair this by casually stripping attributes from the existing database owner; first map application, migration, backup and recovery dependencies and establish a separately controlled least-privilege role plan.

## Migration ledger observation

The live `public.schema_migrations` table contains **92 rows**. Its latest applied timestamp is `2026-10-27T13:46:14.262Z`, headed by version `096`; the next visible version is `20261021`. A direct predicate check found **no** versions matching the current repository's November 2026 worker/verifier migration set (`20261106`, `20261108`, `20261109`, `20261112`, `20261113`). The direct catalog checks independently confirm that the durable worker queue/API objects are absent.

The repository migration chain and live database have therefore diverged. Do not infer that GitHub migration files are deployed merely because they exist in the branch.

## Consequences and mandatory sequence

1. Treat live-main MRV worker status as **NOT INSTALLED / NOT ENABLED**.
2. Keep all worker runtime flags off; do not create or grant the worker role yet.
3. Reconcile the entire repository migration chain against the live ledger and schema before any rollout. Determine whether the latest migration state is a legitimate lagging deployment, a different authoritative database, or an incomplete migration history.
4. Review the existing `rupaykg` role's dependencies before any attribute or ownership changes. It is the current owner of all inspected protected tables and has elevated role attributes.
5. Build the durable job/event ledger and eight-function API only on an isolated disposable Neon branch first. The cross-tenant claim path needs a separate, narrowly scoped queue-broker security boundary; no broad application policy, BYPASSRLS or custom-GUC trust shortcut is acceptable.
6. Enable and FORCE RLS only after complete table/policy/trigger/function-owner catalog evidence and two-tenant adversarial tests.
7. Reconcile live-main migration history and take an independently reviewed backup/restore checkpoint before proposing any production migration.

## Evidence boundary

This report records the exact catalog facts returned by read-only Neon queries. It does not establish that all tables in the full 67-table application schema have been audited, nor does it establish application availability, tenant data correctness, regulatory acceptance, pilot operation or TRL 9.


## Rehearsal branch reconciliation — 2026-11-03 follow-up

Three existing non-primary branches were inspected read-only. Branch IDs and names were resolved from Neon before querying.

| Branch | Branch ID | Migration ledger observation | Durable worker objects |
|---|---|---|---|
| `shakti-prod-main-worker-migration-rehearsal-20261031` | `br-young-mouse-b4jhqbci` | Contains versions through `20261113` | Jobs table absent; events table absent; `mrv_worker_api` schema absent; no matching MRV worker roles |
| `verification-authz-rehearsal-2026-11-03` | `br-twilight-base-b4eec0j6` | Stops at `20261021` | Jobs table absent; events table absent; `mrv_worker_api` schema absent; no matching MRV worker roles |
| `shakti-unresolved-migration-rehearsal-20261028` | `br-broad-glade-b46npw8o` | Stops at `20261025` | Jobs table absent; events table absent; `mrv_worker_api` schema absent; no matching MRV worker roles |

### Critical interpretation

The worker migration rehearsal branch's ledger contains `20261106` through `20261113`, including the durable worker migration version, while the expected queue tables and worker API schema are absent from the catalog. This is a **ledger-to-schema inconsistency**. It is not proof that the migration SQL executed successfully. The rehearsal must be treated as failed/unverified until the migration runner, SQL execution logs, branch lineage, schema diff and migration ledger write path are reconciled.

The three branches have different parents/creation points and different ledger cutoffs. They are not interchangeable rehearsal environments. In particular, the verifier rehearsal is a fresh branch from live main and does not inherit the worker rehearsal's ledger entries. Do not merge their ledgers or treat one branch's successful migration marker as evidence for another branch's schema.

### Required corrective actions before another rehearsal

1. Identify the migration runner used to populate `schema_migrations` and verify whether it records a version before or after successful SQL execution/transaction commit.
2. Inspect the actual SQL execution logs and migration transaction outcomes for `20261106`–`20261113` on the worker rehearsal branch.
3. Compare the branch's catalog to the expected post-migration schema, including all indexes, constraints, triggers, functions, ownership and grants—not only the two queue tables.
4. Do not manually delete or rewrite migration ledger rows. Preserve evidence and create a new clean disposable rehearsal branch from the authoritative main lineage after the migration-runner defect is understood.
5. Make the migration acceptance gate assert both ledger state and catalog postconditions. A migration must fail acceptance if its expected objects, definitions, constraints, triggers or privileges are absent even when its version is recorded.

No changes were made to any Neon branch during this follow-up.


## Migration-runner source review — 2026-11-03

Inspected `apps/src/migrate.ts` at the same PR head and the root/workspace package scripts.

The checked-in runner's normal per-file path is transactionally ordered:

1. It creates/uses `schema_migrations(version, filename, applied_at)`.
2. It checks whether the version is already recorded and, if so, compares the stored filename.
3. For a new version it reads the SQL file, opens a checked-out client, begins a transaction, executes the entire SQL file, inserts the migration ledger row, and commits.
4. On error it rolls back and throws; it does not intentionally continue after a failed migration.

Therefore, **the rehearsal ledger/schema inconsistency is not explained by this runner simply writing the version before executing the migration**. The source runner inserts the row after SQL execution in the same transaction. The observed discrepancy needs a deeper forensic explanation; likely avenues to verify include whether the rehearsal used this exact runner and exact migration file bytes, whether the SQL was later changed under the same filename, whether the ledger was copied/seeded or manually altered, whether a different database/schema was queried, and whether the migration execution was subsequently rolled back or objects removed out-of-band. These are investigation hypotheses, not established causes.

### Runner integrity gap

The runner stores only `version`, `filename` and `applied_at`; it does not store or compare a cryptographic checksum of the migration file contents. If a numbered SQL file is edited after successful application, the runner sees the same version/filename and silently skips the changed contents. This prevents reliable proof that the SQL bytes currently in Git are the bytes applied to a database.

### Required engineering correction

Before accepting another rehearsal or production migration, add a forward-compatible migration manifest/checksum mechanism that:
- calculates SHA-256 over the exact UTF-8 migration bytes;
- records the checksum atomically with the successful migration transaction;
- refuses startup when an already-recorded version/filename has a different checksum;
- handles legacy ledger rows without checksums explicitly as `LEGACY_UNVERIFIED` (never silently backfill a checksum and claim historical provenance);
- validates expected catalog postconditions for critical migrations, including relation definitions, constraints, indexes, triggers, functions, owners and grants;
- emits a machine-readable applied/pending/drift report and stops on any unexplained mismatch.

Do not change or rewrite existing applied migration rows in place. A new forward-only migration/runner upgrade and a separately reviewed reconciliation procedure are required. Do not apply this runner change to live main until it has been tested on clean-install, legacy-upgrade, checksum-mismatch and rollback fixtures.

The runner source review does not explain the missing objects and does not establish which migration bytes, if any, were applied on the rehearsal branch.


## Checksum runner implementation and branch-ledger evidence — 2026-11-03

### Repository changes

The migration runner has been upgraded on this draft PR to:
- add nullable `schema_migrations.checksum_sha256` for forward compatibility;
- calculate SHA-256 over the exact migration file bytes and reject invalid UTF-8;
- write the checksum in the same transaction as the migration SQL and ledger row;
- acquire a PostgreSQL advisory lock for the runner;
- fail closed on legacy NULL checksums, malformed hashes, filename drift, checksum drift and ledger rows with no repository file;
- re-check critical MRV catalog postconditions even when a migration is already recorded;
- check the durable queue's tables, trigger functions, triggers, constraints and required indexes, plus the final claim-index key order, validity and status predicate;
- emit a JSON applied/verified/pending report or a JSON BLOCKED report.

New unit tests cover exact-byte/newline hashing, successful matching, legacy NULL rejection, changed bytes under the same filename, filename drift, orphaned ledger rows and malformed checksums. The static migration validator now requires the checksum helper/tests and both existing/new migration postcondition paths.

### Actual branch ledger schema

A follow-up read-only query checked the columns and row counts on all four branches:

| Branch | Ledger rows | First applied | Last applied | Checksum column |
|---|---:|---|---|---|
| live main | 92 | 2026-10-17 | 2026-10-27 | Absent |
| verifier rehearsal | 92 | 2026-10-17 | 2026-10-27 | Absent |
| unresolved migration rehearsal | 95 | 2026-10-17 | 2026-10-20 | Absent |
| worker migration rehearsal | 115 | 2026-10-17 | 2026-10-31 | Absent |

All four ledgers use only `version`, `filename` and `applied_at`. They contain no historical checksums. The worker rehearsal's 115 rows and later cutoff are therefore not proof of successful execution of the queue migration; the catalog still lacks the queue tables, event table and worker API schema.

### Deployment consequence

The new runner will intentionally stop on the first historical row with a NULL checksum and report `LEGACY_UNVERIFIED`. It will not silently backfill hashes from current Git files. The existing live main branch and all three inspected rehearsal branches are therefore **not eligible to run the new migration runner unattended**.

A controlled recovery must first establish migration provenance from the exact deployed migration artifacts and execution evidence. Where historical bytes cannot be established, retain an explicit legacy-unverified record and use a separately reviewed forward-only baseline/reconciliation procedure. Never manufacture historical checksums from current repository files. The runner change is source code only and has not been executed against any Neon branch.

### Verification boundary

No local TypeScript/Node test execution was available in this environment, and GitHub Actions has not returned a run for the latest PR head. The implementation is committed but **not yet CI-validated**. No Neon branch was modified.


### Final runner hardening correction

The runner now checks whether the checksum column exists before attempting any compatibility ALTER. If an existing non-empty ledger lacks that column, it stops with `LEGACY_UNVERIFIED` **without changing the ledger schema**. Only a fresh ledger or an empty legacy ledger can receive the new column automatically. It also validates previously recorded critical MRV migrations on every run, rather than checking postconditions only when applying a new file. Newly applied migrations are committed only after their catalog postconditions pass; the JSON report removes each successfully applied file from the pending list.

The implementation and static validator were corrected after source inspection to ensure these fail-closed paths are present. This remains unexecuted locally and has no exact-head CI evidence.
