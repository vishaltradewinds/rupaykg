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
