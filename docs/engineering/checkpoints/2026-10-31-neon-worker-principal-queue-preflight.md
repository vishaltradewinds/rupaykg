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
