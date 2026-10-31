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
