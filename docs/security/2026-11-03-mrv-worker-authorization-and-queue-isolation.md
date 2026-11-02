# RupayKg — MRV worker authorization and queue isolation review

Date: 2026-11-03
Branch: shakti/verifier-identity-tenant-hardening-2026-11-02
Scope: static inspection of apps/src/mrv-worker-server.ts, apps/src/mrv-submission-worker.ts and apps/src/mrv-submission-jobs.ts, plus prior read-only production catalog evidence. No code or production changes.

## Executive finding

The MRV worker has a distinct runtime role and a durable-queue execution design, but its current database contract is broader than a simple tenant-scoped API runtime. The worker has to discover and claim due jobs across organizations, then revalidate each job's organization, identity, membership, role permission, activity, evidence, verification and geography before irreversible Guardian/Hedera stages.

The current worker implementation does not establish the signed tenant transaction context used by request routes. Its short BEGIN/COMMIT blocks call queue/job functions directly. Therefore a normal tenant RLS policy cannot be copied onto worker tables and expected to work. A separate, narrowly scoped worker capability design is required.

## Verified source contracts

### Runtime role
apps/src/mrv-worker-server.ts requires exact login role rupaykg_mrv_worker_runtime and checks:
- LOGIN, NOINHERIT, not superuser, not BYPASSRLS, not CREATEDB/CREATEROLE/REPLICATION.
- No membership in rupaykg_app_owner or rupaykg_auth_owner.
- No CREATE in public.
- EXECUTE on public.organization_has_geography_scope(uuid,uuid).
- SELECT on all 11 worker-required tables.
- UPDATE on mrv_submission_jobs.
- INSERT on mrv_submission_job_events and mrv_provenance_events.
- RLS enabled AND FORCE RLS on all 11 worker-required tables.

### Required tables
organizations, identities, organization_memberships, roles, activities, evidence, verifications, geography, mrv_submission_jobs, mrv_submission_job_events, mrv_provenance_events.

### Worker data flow
- claimNextMrvSubmissionJob atomically selects the next due job across the queue using FOR UPDATE SKIP LOCKED, assigns worker lease owner/token/expiry and increments attempt count.
- isMrvSubmissionJobStillAuthorized rechecks job/activity organization and geography bindings, verified organization, verified non-suspended requesting identity, verified evidence, approved verification, verified membership, organization-scoped role permission guardian:operate, geography scope, and immutable payload snapshot equality against live observations/evidence/measurement data.
- Provider calls are performed outside DB transactions.
- Guardian idempotency key and Hedera transaction ID are persisted before external calls.
- Lease heartbeat/renewal and lease-token fencing guard later state transitions.
- Finalization inserts MRV provenance idempotently and marks the job complete within a transaction.

## Critical RLS design gap

The worker opens ordinary database transactions but does not call withRlsRequestTransaction or set a signed tenant context. It must claim jobs across tenants, so a normal organization context cannot be assumed at claim time.

A safe policy design must separate:
1. **Queue discovery/claim capability:** permits the worker to see only due, claimable job metadata and atomically claim one row, without granting broad tenant business-table visibility.
2. **Job-scoped authorization capability:** after a lease is acquired, permits reading exactly the job's organization/activity/evidence/verification/identity/membership/role/geography records needed to revalidate that job, bound by job ID, lease token and live lease.
3. **Job mutation capability:** permits only allowed state transitions and event append operations for the currently leased job; tenant/business rows remain read-only to worker except final provenance append.
4. **Provenance finalization capability:** allows idempotent append for the exact activity/verification/evidence binding of the live leased job after Guardian, Hedera consensus and Mirror Node proof are present.

Do not solve this by granting worker_runtime unrestricted SELECT across all tenant tables under FORCE RLS. The current startup check's SELECT-on-all-11 requirement is a coarse connection contract, not a sufficiently narrow authorization design.

## Required design alternatives to evaluate in rehearsal

Preferred option: reviewed SECURITY DEFINER functions owned by a dedicated NOLOGIN worker capability owner, with:
- pinned search_path (pg_catalog, public, pg_temp);
- fixed, non-user-controlled SQL;
- strict worker role check and live lease-token verification;
- job ID as the only tenant selector, with organization/activity/evidence/verification relationships derived from the job row;
- minimal row/column output, no arbitrary SQL or caller-selected organization;
- explicit current authorization revalidation;
- exact allowed job state transitions;
- audited calls and negative tests for forged job IDs, expired leases, other workers' leases and cross-job mutation;
- no general direct table grants beyond what is necessary to invoke the functions.

If SECURITY DEFINER is not selected, implement an equally constrained capability mechanism and update startup assertions. Do not introduce a generic bypass role or trust a worker-supplied organization ID.

## Additional implementation concerns to test

- The worker currently requires SELECT on identities, memberships, roles, evidence, verifications, activities, organizations and geography; replace this broad grant shape with job-scoped functions or demonstrate that RLS safely constrains every row under the worker context.
- Event-table append-only behavior and job event ordering must be enforced in the database, not only application code.
- The queue claim function must not reveal payload snapshots to unauthorized workers before lease acquisition.
- Lease token must be unguessable, hashed/handled safely, never logged, and checked on every mutation.
- Lease expiry/reclaim races must not allow an old worker to persist provider results.
- Provider idempotency/reconciliation must be tested after crash at every stage.
- Job payload snapshot immutability must be enforced; worker must not have unrestricted UPDATE on payload, tenant binding, source IDs, or idempotency key.
- The MRV worker must not be able to create/modify organizations, identities, memberships, roles, activities, evidence, verifications or geography.
- Provenance INSERT must be constrained to a job whose live lease and verified external evidence bindings are still valid.
- The app runtime must not claim queue jobs or mutate worker state.

## Production schema blocker

Read-only production catalog inspection confirms mrv_submission_jobs and mrv_submission_job_events are absent. The production schema_migrations ledger has no applied MRV submission/worker/queue migration. The worker cannot pass startup today and remains OFF.

## Rehearsal acceptance

- Use exact production PostgreSQL version and schema in disposable environment.
- Test two organizations with separate jobs and concurrent workers.
- Worker A must not read or mutate another worker's unleased job payload.
- Expired/stolen lease token must fail all mutations and provenance finalization.
- Worker can claim eligible jobs from both tenants but only access each job through the narrow capability path.
- Changing membership, permission, identity status, evidence, verification, geography or source observations after enqueue must stop irreversible provider stages.
- Crash/restart after Guardian submission, HCS transaction ID persistence, HCS submission, consensus and Mirror verification must reconcile without duplicate external effects.
- App/auth runtime must not execute worker capability functions.
- Independent DBA/security review required before any production queue migration or worker activation.

## Release posture

NO-GO for MRV worker activation. No production queue schema, role, grant, function, RLS, feature flag or deployment was changed. Production remains HOLD; worker OFF; TRL 9 not established.
