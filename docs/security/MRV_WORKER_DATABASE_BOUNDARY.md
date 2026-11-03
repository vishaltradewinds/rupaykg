# MRV Worker Database Boundary — Engineering Gate

**Status: FAIL-CLOSED / NOT PRODUCTION-READY**

## Confirmed implementation facts

- `apps/src/mrv-submission-worker.ts` currently accepts a PostgreSQL `Pool` and performs direct SQL reads and writes for job claims, leases, state transitions, authorization rechecks and provenance finalization.
- `migrations/20261109_durable_mrv_submission_jobs.sql` creates the durable queue and provenance event structures but does not provision the runtime role, install worker-specific RLS policies, or define a restricted SECURITY DEFINER worker API.
- `apps/src/mrv-worker-server.ts` already requires the dedicated role name `rupaykg_mrv_worker_runtime`, checks RLS and FORCE RLS on all worker tables, and keeps the worker disabled unless explicitly enabled.
- The runtime role contract has now been tightened to reject superuser/BYPASSRLS/CREATEDB/CREATEROLE/replication, role memberships (including owner and pg_read_all_data/pg_write_all_data), public schema CREATE, source-table writes, job INSERT/DELETE/TRUNCATE, and event/provenance UPDATE/DELETE/TRUNCATE. It permits only the current worker's necessary reads, job UPDATE and append-only event/provenance INSERT operations.
- Production worker TLS now requires certificate verification. Explicit plaintext mode is rejected when `NODE_ENV=production`.
- Unit tests cover role membership, elevated flags, source-table writes, sink mutation/truncation and session/current-user mismatch.

## Remaining P0 database boundary work

The runtime contract is a **startup guard**, not yet an independently enforceable database API boundary. The worker still uses direct SQL against protected tables. Before enabling it:

1. Design and review a narrow worker database API (prefer SECURITY DEFINER functions in a locked schema, fixed `search_path`, explicit argument validation and restricted EXECUTE grants) for claim, authorization snapshot/recheck, lease renewal/release, stage transition, provider binding persistence and final provenance transaction.
2. Refactor TypeScript so the worker cannot issue arbitrary table SQL; replace the general `Pool`/checked-out `PoolClient` interface with the narrow API client.
3. Define the runtime role and grants only after the function API is finalized. Do not grant broad table access or add an unrestricted cross-tenant RLS policy to make the worker start.
4. Add disposable PostgreSQL acceptance tests proving direct SELECT/INSERT/UPDATE/DELETE/TRUNCATE denials, function-only allowed operations, fixed search path, tenant isolation, revoked-authorization denial, lease fencing, concurrency, provider idempotency and provenance atomicity.
5. Independently review the role/grant catalog and test the exact migration chain against a disposable Neon-compatible PostgreSQL instance before any production provisioning.

## Operational hold

- Do not set `RUPAYKG_MRV_WORKER_ENABLED=true`.
- Do not provision the role or apply worker migrations to production Neon.
- Do not infer readiness from a successful TypeScript build or role-contract unit tests.
- The worker remains unapproved until the restricted database API and exact-head PostgreSQL acceptance pass.
