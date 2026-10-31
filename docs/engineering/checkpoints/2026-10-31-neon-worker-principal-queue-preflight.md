# Read-only Neon worker principal and queue schema preflight — 2026-10-31

**Repository:** `vishaltradewinds/rupaykg`  
**Working branch:** `shakti/atomic-inbox-claim-2026-10-31`  
**Evidence source:** Neon project `rupaykg-production-fresh` (`steep-mud-79906940`)  
**Production branch:** `br-restless-base-b44cip2h`  
**Staging branch:** `br-spring-hill-b4544vz5`  
**Database:** `rupaykg`  
**Inspection mode:** read-only catalog queries and role listing; no DDL/DML or role changes.

## Findings

### 1. Production does not yet contain the async inbox schema
A catalog query against production main returned no rows for:
- `public.async_mirror_inbox`
- `public.async_mirror_inbox_events`
- `public.government_inbox`
- `public.government_inbox_events`
- `public.government_crosswalks`
- `public.government_jurisdiction_crosswalks`

This is direct evidence that the production main branch has not received the worker/inbox schema candidate. The worker cannot be started against production until an independently reviewed and approved migration chain is applied.

### 2. Staging contains the first two queue tables, but no separate worker role
The same catalog query against staging found:
- `public.async_mirror_inbox`
- `public.async_mirror_inbox_events`

Both are owned by `rupaykg`, have RLS disabled, and grant the current application role SELECT/INSERT/UPDATE/DELETE. This is staging evidence only; it does not establish production schema or worker readiness.

Neon role inventory returned only the project role `rupaykg` on both production and staging. No separate worker login role was present in either branch inventory. Do not create one autonomously; design and review the exact grants first.

### 3. Existing `rupaykg` login is over-privileged for a least-privilege app principal
Read-only `pg_roles` inspection returned for `rupaykg`:
- `rolcanlogin = true`
- `rolbypassrls = true`
- `rolcreatedb = true`
- `rolcreaterole = true`
- `rolreplication = true`
- `rolsuper = false`

The database login is not a suitable least-privilege application role as currently configured. It is also the owner of the two staging inbox tables. A dedicated worker login with explicit table/sequence/function privileges and no elevated role attributes is required before activation. This preflight does not create that role.

### 4. Runtime identity remains unproven
This inspection uses the Neon connector's privileged database connection, not the deployed Render process. It does not prove which Neon endpoint/branch Render uses. A safe, non-secret runtime fingerprint and deployment configuration review remain required.

## Required controls before any worker activation

1. Decide the authoritative migration set and reconcile the production ledger/source exception for migration 096.
2. Rehearse queue schema upgrade against a disposable production-shaped branch; verify idempotency and rollback.
3. Design explicit worker privileges for the actual queue, event, crosswalk, and supporting objects; avoid broad schema grants.
4. Create/test the worker role only in disposable/staging first, with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS` and no ownership of application tables.
5. Verify positive worker operations and negative attempts (DDL, unrelated table access, tenant boundary bypass, unauthorized event mutation).
6. Ensure the API role no longer has unnecessary `BYPASSRLS`, `CREATEROLE`, `CREATEDB`, or `REPLICATION` privileges through a controlled migration/credential rotation plan. Do not blindly revoke before confirming the real Render login and recovery path.
7. Verify Render's actual runtime database identity without logging secrets.
8. Only then consider enabling the worker in a controlled staging environment; production activation requires explicit approval and a rollback plan.

## Status

- Worker: OFF.
- Scheduler: OFF.
- Production: HOLD.
- RLS/tenant isolation: RELEASE BLOCKER.
- Separate worker role: NOT PROVISIONED.
- Production inbox schema: NOT PRESENT at time of inspection.
- No production or staging database objects, roles, grants, secrets or deployment settings were changed by this inspection.
- TRL 9: NOT ESTABLISHED.


## Additional worker readiness dependency check

The runner's read-only schema gate was cross-checked against the staging catalog. It requires all of the following before any queue operation:
- `public.async_mirror_inbox`
- `public.async_mirror_inbox_events`
- `public.government_jurisdiction_crosswalks`
- `public.authoritative_source_snapshots`
- `public.organization_has_explicit_geography_scope(uuid,uuid)`
- `public.government_source_scope_covers_geography(uuid,uuid)`
- An inbox status constraint supporting `UNRESOLVED`
- Trigger `async_mirror_inbox_event_after_change`

The staging catalog query found only the two async inbox tables among the required objects. The crosswalk/source-snapshot tables, scope functions, and expected trigger were not present in the inspected staging branch. Therefore the runner readiness gate would fail closed there. The production branch lacks even the two queue tables.

This shows the next work is not simply to create a worker login. The candidate migration chain must first be reconciled and applied to a disposable production-shaped branch, and the complete required object graph verified. Then exact object-level worker grants can be designed and negatively tested. Do not activate the worker or provision credentials yet.


## Additional code-to-catalog security gap

Source review of the current worker runner shows that it:
- Requires a separate username in `GOVERNMENT_INBOX_DATABASE_URL`.
- Rejects a worker URL that uses the same decoded role name as `DATABASE_URL`.
- Verifies required schema objects exist before queue operations.

It does **not yet** query `pg_roles` to reject `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, or `BYPASSRLS`; it does not check whether the worker is a member of the application role; and it does not prove the exact table/function grants required by the worker. The current `rupaykg` role's elevated attributes show why username separation alone is insufficient.

**Required next code gate:** add a read-only runtime principal/grant attestation that fails closed on elevated attributes and unsafe role membership, then verifies only the specific SELECT/UPDATE and function EXECUTE permissions required by the worker. Add negative tests for inherited application privileges, elevated attributes, table ownership, missing grants and unexpected write/delete access. This must be tested with a dedicated role on a disposable branch before any live worker credential exists. Do not create the role or change grants in production.


## Deployment/entrypoint source check

The candidate PR #157 branch's `apps/package.json` scripts expose only the API start, migration and acceptance-seed commands. Its production Dockerfile starts `node apps/dist/src/production-server.js`. A source search of `apps/src/server.ts` found no worker import, worker startup, scheduler registration or worker loop.

Therefore, even after schema and role blockers are resolved, the worker still needs a separately designed and tested process entrypoint/service lifecycle. Do not start it inside the web API process. The intended deployment should be a distinct background service with explicit environment variables, health/heartbeat observability, graceful shutdown, bounded concurrency, and independent scale/rollback controls. No Render service was created or changed.


## Implemented code gate — worker principal least-privilege attestation

Following the read-only Neon findings, the candidate worker runner now includes a read-only principal attestation in `apps/src/async-mirror-worker-runner.ts`:

- Requires a login role and rejects SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS, INHERIT, and any role memberships.
- Rejects ownership of queue/reference tables, ownership of the public schema, and CREATE on the public schema.
- Requires SELECT and UPDATE on the inbox; SELECT on the jurisdiction crosswalk, approved source snapshots and activities; EXECUTE on both geography-scope functions.
- Rejects direct SELECT/INSERT/UPDATE/DELETE on the append-only inbox event table; the trigger-owned writer remains the intended event append path.
- Rejects reuse of the application database role and malformed application database identity.
- Exposes a combined readiness function that checks schema first, then role privilege posture, before queue claims can be attempted.

Regression coverage added for least-privilege success, elevated flags, role membership, object/schema ownership, schema CREATE, event-table direct access, missing required grants, application-role reuse, missing catalog row, malformed application URL, and ordered fail-closed behavior.

**Important boundary:** This is a reusable guard and tests; no worker entrypoint currently calls it because the candidate still has no separate process entrypoint. It is not runtime activation. The exact-head CI must pass before treating this implementation as validated. The required privileges are based on reviewed worker SQL and the existing candidate integration fixture; the final grants must still be validated on a disposable production-shaped Neon branch, including inherited/PUBLIC grants and column-level permissions.


### Follow-on hardening: column-scoped queue updates

The principal gate was tightened after reviewing every worker UPDATE statement. It now requires UPDATE only on the exact inbox columns used by claim, heartbeat, retry, quarantine and terminal transitions: `status`, `attempts`, `lease_token`, `lease_until`, `quarantined_at`, `last_error_code`, `next_attempt_at`, `processed_at`, and `validation_summary`. A table-level UPDATE grant is explicitly rejected. The regression suite includes a negative case for broad table UPDATE even when the expected column-level grants are present.

This is still a code-side ACL attestation, not a proof that Neon currently grants precisely these permissions. A disposable PostgreSQL/Neon grant fixture must verify the catalog semantics and the actual SQL workload before any live role is provisioned. Exact-head CI for the latest source commit is pending.


## Standalone worker process implementation — 2026-10-31

A separate process entrypoint now exists at `apps/src/government-inbox-worker-process.ts`, with package command `start:government-inbox-worker`.

Safety properties:
- It refuses to start unless `GOVERNMENT_INBOX_WORKER_ENABLED=true` is explicitly supplied.
- It creates only the dedicated worker pool from `GOVERNMENT_INBOX_DATABASE_URL`; there is no application-pool fallback.
- It performs schema readiness followed by read-only least-privilege principal attestation before the first queue claim.
- It runs one bounded worker batch at a time and waits a bounded configurable poll interval (1–60 seconds; default 5 seconds) between cycles.
- It emits aggregate cycle counters only; it does not log payloads or connection strings.
- SIGTERM/SIGINT stop future cycles; the active bounded batch is allowed to finish, with lease fencing supporting crash recovery.
- Pool closure runs in a finally block.

This is source-code implementation only. The script is not configured as a Render service, no worker secrets exist or were added, and no service is enabled. The Docker image build must prove the compiled entrypoint is present. Before any dedicated service is created, complete the disposable exact-grant PostgreSQL rehearsal, resolve the national system-queue vs tenant isolation governance decision, and perform independent security review. Production worker remains OFF.


### Additional privilege and CI hardening — 2026-10-31 18:38 UTC

- The principal attestation now also rejects worker data/function privileges granted to PostgreSQL PUBLIC, and requires public-schema USAGE while prohibiting schema CREATE. This prevents an apparently dedicated worker role from passing merely because required permissions were accidentally made globally available.
- Added a dedicated worker process entrypoint and `start:government-inbox-worker` package command. It requires explicit enablement, runs schema and role checks before the first claim, processes one bounded batch at a time, logs aggregate counters only, handles SIGTERM/SIGINT (including interrupting the idle poll sleep), and closes its pool. It is not configured or activated in Render.
- Runtime API acceptance tests now choose a random port by default to avoid collisions between overlapping CI runs. A preceding intermediate run failed on the fixed port 43128 with EADDRINUSE; the full source head before this correction passed, and the port-collision fix is now under exact-head CI.
- Latest principal/worker source head at this checkpoint: `65c08f35166b2cfbb846e1f46dfe50c93ebb8539`; exact-head CI run [#41230356772](https://github.com/vishaltradewinds/rupaykg/actions/runs/41230356772) is in progress. Do not mark the new ACL checks or process entrypoint accepted until this run passes.
- No production or staging database, roles, grants, secrets, Render service or deployment has been changed. Worker OFF; production HOLD.

- Graceful-shutdown review also made the idle poll sleep abortable, so SIGTERM/SIGINT does not wait out a full 60-second configured idle interval. The active bounded batch still finishes or reaches its own lease/validation timeout before the pool closes.


### Exact-head consolidated CI result — 2026-10-31 18:43 UTC

- Branch head verified unchanged at `226cac5aa6a71f78e75de5fc657b34f25a17cbce`.
- Exact-head workflow run [#41230428453](https://github.com/vishaltradewinds/rupaykg/actions/runs/41230428453) completed successfully.
- All workflow steps passed, including production dependency audit, migration validation, exact production migration-baseline reconstruction, proposed migration-chain application and idempotency, TypeScript typecheck, application build, browser smoke, unit/disposable PostgreSQL acceptance, evidence upload, and production-container build.
- This validates the current source branch and disposable CI environment only. It does not prove that production Neon has the required schema/role/grants, that Render uses the intended database identity, or that the worker is deployed.
- PR #161 remains draft/open/unmerged. Worker OFF; scheduler OFF; production HOLD; certification OFF; TRL 9 not claimed.
- No live Neon schema/role/grant/policy changes, Render service/secrets/deployment changes, or production data mutations were made.


### Tenant-isolation audit and worker grant tightening — 2026-10-31 18:47 UTC

- Read-only production catalog audit of public tables found RLS disabled and zero row-level policies across the inspected application tables. This confirms tenant isolation is not database-enforced in the inspected production snapshot; no policy or schema changes were made.
- Read-only staging column audit found `async_mirror_inbox` and `async_mirror_inbox_events` have no `organization_id` or `tenant_id`. Authority/municipal codes do not substitute for tenant ownership.
- The candidate queue claims across a shared queue. Crosswalk geography-scope checks are useful data validation but are not a database-enforced tenant boundary. Worker production activation is therefore blocked pending tenant-aware queue ownership and isolation design.
- Added `docs/security/TENANT_ISOLATION_SYSTEM_QUEUE_DECISION_2026-10-31.md` with observed facts, prohibited shortcuts, recommended target architecture, implementation sequence and release gates. Proposed architecture only; not implemented or certified.
- Tightened the candidate worker principal attestation to reject inbox INSERT and DELETE privileges in addition to broad table UPDATE, and added regression coverage. The exact source head is undergoing CI; do not treat this grant tightening as accepted until exact-head CI succeeds.
- Previous exact-head CI run [#41230844594](https://github.com/vishaltradewinds/rupaykg/actions/runs/41230844594) passed all 17 workflow steps at source head `72cc1f1c1647e0d3309ffa49220a39897eb109e8`. Newer grant-hardening source heads have separate in-progress runs; the previous pass does not validate those later changes.
- No production/staging DDL, DML, roles, grants, RLS policies, secrets, Render service or deployment changes were made.
- Worker OFF; scheduler OFF; production HOLD; TRL 9 not established.


### Disposable PostgreSQL ACL semantics finding and remediation — 2026-10-31 18:53 UTC

- Extended `apps/src/async-mirror-worker-privileges-db.test.ts` to create a restricted worker login on disposable CI PostgreSQL, grant the intended schema/table/column/function privileges, and execute the actual `assertGovernmentInboxWorkerPrincipal` query against that live catalog.
- The first real-catalog run [#41231391032](https://github.com/vishaltradewinds/rupaykg/actions/runs/41231391032) FAILED as intended: PostgreSQL reported PUBLIC EXECUTE on the two geography-scope helper functions. The code gate correctly rejected the role with `PUBLIC_SCOPE_FUNCTION_EXECUTE`. This was a genuine ACL finding, not a flaky test.
- Root cause: PostgreSQL grants EXECUTE on newly created functions to PUBLIC by default. Migrations `20261030_explicit_geography_scope.sql` and `20261110_government_source_scope_geography_binding.sql` created the helpers without revoking PUBLIC.
- Added migration `20261114_restrict_government_scope_function_public_execute.sql` on parent migration PR #157 to revoke PUBLIC execution on both helper functions. The application owner retains owner rights; isolated worker principals must receive explicit EXECUTE grants.
- The disposable DB acceptance fixture explicitly grants those two EXECUTE permissions to its temporary worker login and then runs the actual principal attestation. It continues to assert direct event INSERT, inbox DELETE, immutable payload hash UPDATE, unrelated evidence SELECT and schema DDL are denied.
- The migration and updated acceptance test are not yet accepted. Exact-head CI must rerun with the updated PR #157 base and current PR #161 head. No production/staging function ACL or schema change was made.
- Production RLS remains absent on all 67 inspected public base tables (0 RLS-enabled, 0 FORCE RLS, 0 policies). Staging queue rows still lack tenant identifiers. Tenant isolation remains a separate hard release blocker.
- Worker OFF; scheduler OFF; production HOLD; TRL 9 not established.


### Exact PostgreSQL catalog attestation — remediation validated — 2026-10-31 18:55 UTC

- Parent migration PR #157 exact-head CI [#41231609311](https://github.com/vishaltradewinds/rupaykg/actions/runs/41231609311) passed on migration head `4d7567afe771f618691e4b3a1d3d7e4742e48053`.
- Worker PR #161 exact-head CI [#41231642460](https://github.com/vishaltradewinds/rupaykg/actions/runs/41231642460) passed on worker head `51951d5d324019bcac24eb35ac976881725c54de`; it includes the updated parent base and the live PostgreSQL principal-attestation acceptance.
- The disposable PostgreSQL test now proves the actual catalog attestation accepts the exact dedicated NOINHERIT/NOBYPASSRLS test role with explicit grants after migration 20261114 revokes PUBLIC EXECUTE on both scope helpers. Negative checks still reject direct event access, inbox DELETE/INSERT, payload hash UPDATE, unrelated evidence SELECT and schema DDL.
- All 17 workflow steps passed on each exact head, including production dependency audit, migration validation and production-baseline reconstruction, migration application/idempotency, typecheck, build, browser smoke, disposable PostgreSQL acceptance, evidence upload and production container build.
- This validates the candidate migration and ACL behavior in disposable CI PostgreSQL only. It does not establish live Neon production schema/role/grants, Render database identity or tenant isolation.
- Tenant isolation remains a separate release blocker: production snapshot has 67 public base tables, 0 RLS-enabled, 0 FORCE RLS, 0 policies; staging inbox and event rows lack tenant keys. No production/staging changes were made.
- PRs #157 and #161 remain draft/open/unmerged. Worker OFF; scheduler OFF; production HOLD; TRL 9 not established.
