# RupayKg — restricted PostgreSQL role provisioning rehearsal plan

Date: 2026-11-03  
Scope: design for disposable production-shaped PostgreSQL only. Not a production migration and not permission to provision roles in Neon production.

## Why role provisioning is a blocking dependency

The live production database currently exposes only the elevated rupaykg login among the intended runtime/owner roles. The application startup contract expects dedicated app and auth runtime identities; the MRV worker expects a separate worker runtime. Production role separation is therefore not ready. All production tables are owned by rupaykg, which has BYPASSRLS and elevated role attributes. Do not attempt to activate RLS or function ACL narrowing while connections still use this owner.

## Intended role graph

| Role | Login | BYPASSRLS | INHERIT | Purpose |
|---|---:|---:|---:|---|
| rupaykg_app_owner | no | no | no | Own app business schema objects; no application login. |
| rupaykg_auth_owner | no | no | no | Own auth schema objects; no application login. |
| rupaykg_app_runtime | yes | no | no | Request-serving application; tenant-scoped transactions only. |
| rupaykg_auth_runtime | yes | no | no | Authentication/session operations only; no business-table broad access. |
| rupaykg_mrv_worker_runtime | yes | no | no | Dedicated MRV worker/queue execution; job-scoped capabilities. This exact name is required by apps/src/mrv-worker-server.ts. |
| rupaykg_security_definer | no | no | no | Optional narrowly scoped NOLOGIN owner for reviewed SECURITY DEFINER functions only; omit unless a concrete function requires it. |
| rupaykg_migrator | yes, controlled | no | no | Short-lived controlled schema migration identity; not used by app, auth or worker. |
| rupaykg_bootstrap | yes, temporary | no | no | Two-custodian bootstrap only; temporary elevated attributes must be removed and verified before application startup. |

Role attributes are target requirements, not proof that every role should be created immediately. The exact runtime role names must match application startup checks. No runtime may be a member of any owner, migrator, bootstrap or security-definer role. No role may inherit privileges from an owner role.

The existing production rupaykg role is not repurposed in-place as a runtime. Preserve it as the controlled legacy owner/admin only until a reviewed ownership transfer and recovery plan exists.

### MRV worker-specific contract correction

The exact runtime role is rupaykg_mrv_worker_runtime, as asserted by apps/src/mrv-worker-server.ts. The worker currently checks that it is not a member of rupaykg_app_owner or rupaykg_auth_owner, is NOBYPASSRLS/NOINHERIT, has no public CREATE, can execute public.organization_has_geography_scope(uuid,uuid), has its required table grants, and sees FORCE RLS on all 11 worker-required tables. The current source does not define or assert a dedicated MRV worker owner role; do not invent one as a prerequisite without a code/schema design decision. If an owner is introduced, add matching startup assertions and tests.

Read-only production catalog inspection found mrv_submission_jobs and mrv_submission_job_events absent, while mrv_provenance_events exists. The production schema_migrations ledger has no applied MRV submission/worker/queue migration. Consequently the worker cannot satisfy its production startup contract today. Worker remains disabled until a reviewed migration creates and secures the queue tables and full job lifecycle acceptance passes.

## Rehearsal sequence

1. Create a disposable PostgreSQL instance using the exact production PostgreSQL major version, extensions, schema and migration history.
2. Create roles in a controlled bootstrap phase; verify login, NOINHERIT, NOBYPASSRLS, no owner membership and no unexpected role attributes.
3. Transfer representative application-owned objects to app/auth NOLOGIN owners in rehearsal only. Include tables, sequences, views, functions, triggers and default privileges.
4. Apply schema USAGE and table/sequence privileges per role matrix. App runtime must have no access to password hashes, auth session tokens, migration ledger, audit-chain head or unrestricted global admin tables.
5. Apply reviewed search_path hardening and trigger-function ACL candidate migrations. Verify trigger execution through DML without direct EXECUTE from PUBLIC.
6. For ordinary callable functions, grant exact signatures only to roles with demonstrated route/worker callers. Do not blanket grant or revoke.
7. Enable and FORCE RLS table-by-table in the disposable database only after policies and route transaction wrappers are complete.
8. Run app, auth and worker integration suites using actual restricted connection strings. Test cold start and normal requests, not just SQL SET ROLE.
9. Test failure behavior when the runtime attempts CREATE, ALTER, TRUNCATE, SET ROLE, owner access, auth-table access, cross-tenant reads/writes, direct helper calls and forged context.
10. Export role/catalog/ACL snapshots and test evidence. Rehearse restore and rollback. Obtain independent DBA/security sign-off.

## Minimum role assertions

The rehearsal must fail unless all runtime roles satisfy:
- rolcanlogin true only for the intended runtime.
- rolbypassrls false.
- rolinherit false.
- rolsuper false, rolcreatedb false, rolcreaterole false, rolreplication false.
- no membership path to app_owner, auth_owner, security_definer, migrator or bootstrap.
- no ownership of public tables, sequences, views, functions or schemas.
- no CREATE on public; no CREATE on extension schemas.
- no direct auth credential/session/password access from app_runtime.
- no direct business-table access from auth_runtime except the minimum auth lookup paths.
- worker_runtime can access only its job queue and the tables required for its registered worker operations.
- PUBLIC has no EXECUTE on trigger-returning application functions after the trigger ACL migration, while trigger DML still succeeds under actual runtime roles.
- no ordinary callable function has PUBLIC EXECUTE revoked until the exact caller grants and positive/negative integration tests are present.

## Role and function permission design rules

- Prefer SECURITY INVOKER functions under the calling runtime's RLS context.
- SECURITY DEFINER is exceptional. Each such function requires a dedicated NOLOGIN owner, pinned search_path, strict input validation, explicit tenant/actor authorization, minimum table grants and a dedicated negative-test suite.
- A SECURITY INVOKER trigger function executes with the invoking DML role's privileges. Nested function EXECUTE and table privileges must be verified under the exact role that performs the DML.
- Avoid broad EXECUTE on functions that mutate EPR credits, allocations, obligations, environmental claims or settlement state.
- Route-used permission helpers may be granted to app_runtime only after their semantics are converted to explicit permissions and signed tenant context.
- Internal helper functions used only by triggers should receive the minimum EXECUTE privileges required by the trigger caller. A trigger binding is not a blanket authorization boundary for direct invocation of a normal callable function.
- Do not rely on function ownership as an authorization check.

## Required test matrix

| Test | App runtime | Auth runtime | Worker runtime |
|---|---|---|---|
| Startup role attributes and no owner membership | pass | pass | pass |
| Read own authorized tenant rows | pass | not applicable | job-scoped only |
| Read another tenant's rows | deny | deny | deny unless explicit job capability |
| Read password/session tables | deny | minimum auth-only | deny |
| Create/alter schema objects | deny | deny | deny |
| Invoke unapproved EPR mutation function | deny | deny | deny |
| Execute required trigger path via authorized DML | pass | not applicable | only if worker DML needs it |
| Run registered MRV job | deny | deny | pass |
| Forged/missing signed tenant context | deny | deny | deny |
| Membership revoked during/after request | deny on next transaction | auth revocation honored | job capability revalidated |

## Stop conditions

Stop the rehearsal and do not promote if any runtime has BYPASSRLS, owner membership, inherited owner rights, public schema CREATE, cross-tenant visibility, broad auth data access, unbounded worker access, an untested SECURITY DEFINER function, or a route that bypasses the signed tenant transaction wrapper.

## Release status

Production remains HOLD. No production role was created or modified. This document is a rehearsal specification; role provisioning and object ownership transfer remain unexecuted until an isolated rehearsal environment is provisioned and independently reviewed.
