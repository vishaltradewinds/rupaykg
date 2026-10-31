# RupayKg authoritative database and repository policy

**Observed:** 2026-10-31 13:27–13:29 UTC  
**Canonical implementation:** `vishaltradewinds/rupaykg`, branch `main`  
**Only authoritative live database:** Neon project `rupaykg-production-fresh` (`steep-mud-79906940`) → branch `main` (`br-restless-base-b44cip2h`) → database `rupaykg`  
**Active read/write endpoint:** `ep-restless-flower-b48dupda`  
**PostgreSQL:** 18.6  
**Release posture:** Production HOLD; worker OFF; scheduler OFF; certification OFF; TRL 9 not claimed.

## Decision

Production main is the single source of official RupayKg platform state, schema history and production truth. Application changes still go through Git branches, pull requests and independent release gates. Do not use production as a casual development or test target.

## Read-only database evidence

Inspected the Neon project list, project metadata, branch inventory, compute endpoints and PostgreSQL catalog. Ran read-only identity/schema queries using `current_database()`, `version()`, `session_user`, `current_user`, `pg_is_in_recovery()`, `to_regclass()` and the migration ledger.

| Branch | ID | Endpoint | Ledger rows | Inbox | Events | Crosswalk | Source snapshots | Classification |
|---|---|---|---:|---|---|---|---|---|
| main | `br-restless-base-b44cip2h` | `ep-restless-flower-b48dupda` | 92 | No | No | No | No | **Authoritative production-of-record** |
| rupaykg-gov-inbox-staging-20261020 | `br-spring-hill-b4544vz5` | `ep-cold-pond-b4vcushk` | 95 | Yes | Yes | No | No | Legacy staging; non-authoritative and incomplete for current worker |
| shakti-unresolved-migration-rehearsal-20261028 | `br-broad-glade-b46npw8o` | `ep-red-bar-b4ywq6ug` | 95 | Yes | Yes | No | No | Older staging-derived rehearsal; superseded/non-authoritative |
| shakti-prod-main-rehearsal-20261031 | `br-spring-lab-b4hqez2o` | None | Not queried | Not verified | Not verified | Not verified | Not verified | Fresh main-derived rehearsal candidate; no compute endpoint |

Each of the three queried databases returned database `rupaykg`, PostgreSQL 18.6, `session_user=current_user='rupaykg'` and `pg_is_in_recovery()=false`.

### Worker schema finding

Production main does not contain `public.async_mirror_inbox`, `public.async_mirror_inbox_events`, `public.government_jurisdiction_crosswalks` or `public.authoritative_source_snapshots`.

Staging and the older rehearsal contain the inbox and event tables, but not the crosswalk or source-snapshot relations. Neither is a valid runtime target for the current worker's full provenance-resolution contract. Do not apply isolated migrations. Reconcile and rehearse the complete ordered migration chain on a fresh disposable branch derived from authoritative main.

The fresh 2026-10-31 rehearsal branch was created from main and has no endpoint. It is only a future rehearsal candidate, not a second source of truth. No compute was provisioned and no migrations were run there.

## Mandatory database-use rules

1. Production main is read-only for engineering inspection. No schema/data/role/grant/RLS writes, migration replay/rollback, queue processing or worker activation without a separately approved change plan.
2. Staging, rehearsal, local PostgreSQL and CI PostgreSQL are test environments only; none can become official platform truth.
3. Use fresh isolated branches derived from production main for controlled migration rehearsals. Record exact parent, branch ID, migration inputs, results and cleanup.
4. Keep the older staging branches frozen until a retention/dependency review. Do not use them as production substitutes.
5. Verify the deployed application's database target through safe metadata comparison; never print or commit connection strings, passwords, tokens or keys.
6. Never renumber, rewrite or edit applied migration history to force ledgers to match. Resolve discrepancies with forward-only reviewed migrations.
7. The observed `rupaykg` owner login is privileged and BYPASSRLS (prior read-only audit); it must not be the long-running worker identity.
8. Fail closed when database identity, migration chain, authority scope, role, RLS behavior or provenance cannot be proven.

## Repository source-of-truth map

- `main`: canonical implementation branch.
- `README.md`: repository entry point.
- This file: authoritative database identity and branch-use register.
- `docs/CURRENT_SOURCE_OF_TRUTH.md`: current project/release checkpoint.
- `docs/EXECUTION_STATUS.md`: short status index; dated older snapshots are historical evidence.
- `migrations/README.md`: migration policy; preserve migration SQL and history.
- `docs/engineering/EXECUTION_LOG.md`: append-only engineering resume log.
- `docs/LEGACY_*.md`: historical domain/reference material only; retain it as knowledge, not as a competing implementation specification.
- `rupaykg-aistudio`: reference-only legacy repository, not current implementation or deployment authority.

Four transient `docs/CI_LATEST_WEB_TYPECHECK_VERIFICATION_*.md` markers are cleanup candidates. Their original blob IDs are recorded in `docs/archive/CI_MARKER_CLEANUP_2026-10-31.md` before removal from this review branch. CI evidence must instead be recorded by exact commit SHA and workflow-run URL.

## Current worker gate

PR #161 remains draft/open/unmerged, stacked on PR #157. Runtime head `fd2e52e3f73d03f73632bdccd0f0b6a03193f8b5` passed CI [#41205115744](https://github.com/vishaltradewinds/rupaykg/actions/runs/41205115744). Current PR head `1b0d972b3b8899f4960e5030856fff645b177941` contains only a later documentation update.

The worker migration set is not applied to production main. Staging has only part of the required schema and is not a substitute. Open gates: explicit national-queue versus tenant-scoped authority approval; RLS/tenant-isolation decision; exact deployment principal verification without secret disclosure; full ordered migration-chain rehearsal from main; independent security review; exact-head CI for subsequent runtime changes; separate deployment approval.

## Shakti and TRL

Apply Shakti Standards end-to-end: discovery → evidence → statutory/technical boundaries → feasibility → design → engineering → testing → independent review → approval → deployment → operation → measurement → continuous assurance. Include TRL evidence. CI success is engineering evidence only and does not establish statutory approval, certification or TRL 9.

## Safety record

Neon inspection was read-only. No live database writes, migrations, role/grant/RLS changes, endpoint/branch changes, Render configuration changes, deployments, worker activation, scheduler activation or certification occurred.


## 8. Migration-ledger versus repository-file reconciliation — 2026-10-31

A read-only comparison of the live `schema_migrations` ledgers against the canonical repository `main` migration directory found a concrete source-control gap:

| Migration identity | Production main ledger | Staging ledger | Repository `main` file | Worker PR #157/#161 stack |
|---|---|---|---|---|
| `096_verification_authorization_provenance.sql` | Applied as version `096` | Not present | Missing | Present; Git blob `258b1f4534efbf915688f78aa84d4ec24a47cbc0` |
| `20261022_async_mirror_inbox.sql` | Not present | Applied | Missing | Present |
| `20261023_async_mirror_worker_leases.sql` | Not present | Applied | Missing | Present |
| `20261024_ai_intake_rate_limits.sql` | Not present | Applied | Missing | Present |
| `20261025_ai_evidence_intake_jobs.sql` | Not present | Applied | Missing | Present |

The production main ledger has 92 rows and ends with version `096` plus date-coded migrations through `20261021`. Staging has 95 rows: it lacks `096` but contains date-coded migrations through `20261025`. Repository `main` currently contains migrations through `20261021` but not the four date-coded staging migrations or migration `096`.

The worker integration stack contains the missing migration files. In particular, the `096_verification_authorization_provenance.sql` file on PR #161 has Git blob SHA `258b1f4534efbf915688f78aa84d4ec24a47cbc0`, matching the previously recorded historical Git blob identity. This is a Git blob ID, **not** a SHA-256 of the deployed SQL artifact and does not by itself prove which exact bytes were executed by the live database or Render deployment.

**Required resolution:** preserve production main as the only authoritative database; do not edit either live ledger or apply isolated migrations. Before merging the migration-bearing worker stack, compare the exact source migration blobs, all migration ordering/dependencies, the production baseline and staging ledger history. Rehearse the full ordered migration chain from a fresh disposable branch of production main and retain SQL-byte hashes, migration report and schema diff. Independent review must decide whether the worker migrations are a valid forward-only addition or require a separately governed migration-history reconciliation.

This finding is a blocker for merging/deploying migration-bearing work until reconciled. It does not invalidate the earlier worker CI result, which ran against disposable PostgreSQL and is not live Neon evidence.
