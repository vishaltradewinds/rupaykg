# Production runtime database credential cutover

**Status:** Prepared runbook; not executed against production.  
**Repository:** `vishaltradewinds/rupaykg`  
**Production boundary:** Neon production remains read-only / HOLD. Do not apply this procedure without explicit production-change authorization.

## Why this is required

The production web container runs `apps/dist/src/runtime-db-preflight.js` before starting the API. The preflight intentionally rejects a connection login that is SUPERUSER or BYPASSRLS, then performs `SET LOCAL ROLE rupaykg_app_runtime` and verifies the isolated runtime role, protected-table RLS/FORCE RLS, and SECURITY DEFINER ownership boundary.

The current production login `rupaykg` is BYPASSRLS. Do not weaken the preflight and do not point the web service at that login. Use a separate, least-privilege LOGIN role that can assume only `rupaykg_app_runtime`.

## Preconditions (read-only)

1. Confirm the target is Neon project `rupaykg-production-fresh`, default branch `main` (`br-restless-base-b44cip2h`), database `rupaykg`.
2. Record `SHOW server_version_num;` and inspect `pg_roles`, `pg_auth_members`, `pg_database`, and the current grants before making changes.
3. Confirm `rupaykg_app_runtime` exists and is NOLOGIN, NOSUPERUSER, NOBYPASSRLS.
4. Confirm the runtime role has only the intended application grants and that the existing protected tables remain owned by `rupaykg_ddl` with RLS and FORCE RLS.
5. Confirm there is no existing `rupaykg_runtime_login` with unexpected attributes or memberships. If it exists, inspect and reconcile it; do not blindly recreate it.

## Controlled role provisioning

Run as the authorized database administrator in a controlled change window. Generate a unique secret in the approved secret manager; never put the actual password in Git, an issue, chat, shell history, or a committed SQL file.

For PostgreSQL 16+, provision a dedicated login with no elevated attributes and no inherited privileges, then grant only the runtime role with explicit SET permission:

```sql
BEGIN;

CREATE ROLE rupaykg_runtime_login
  LOGIN
  NOINHERIT
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS;

GRANT CONNECT ON DATABASE rupaykg TO rupaykg_runtime_login;

GRANT rupaykg_app_runtime TO rupaykg_runtime_login
  WITH INHERIT FALSE, SET TRUE;

COMMIT;
```

Set the password separately through the approved credential-management interface (not by embedding it in a SQL file or command history). If the role already exists, do not run `CREATE ROLE`; inspect and alter it under the approved change procedure.

For PostgreSQL versions before 16, use the server-supported role-membership syntax and verify the resulting membership options explicitly. Do not assume defaults.

## Mandatory read-only verification before changing Render

Run these checks using the new login connection (do not print or expose the password):

```sql
SELECT session_user,
       r.rolcanlogin,
       r.rolsuper,
       r.rolcreatedb,
       r.rolcreaterole,
       r.rolreplication,
       r.rolbypassrls,
       r.rolinherit
FROM pg_roles r
WHERE r.rolname = session_user;

SELECT pg_has_role(session_user, 'rupaykg_app_runtime', 'SET')
       AS can_set_runtime_role;

BEGIN READ ONLY;
SET LOCAL ROLE rupaykg_app_runtime;
SELECT current_user;
ROLLBACK;
```

Acceptance:
- `session_user = rupaykg_runtime_login`
- LOGIN true; SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS, INHERIT all false.
- `can_set_runtime_role = true`.
- `SET LOCAL ROLE` succeeds and `current_user = rupaykg_app_runtime`.
- Existing runtime preflight passes unchanged using this connection string.
- The login has no other role memberships or privileged grants beyond what is explicitly required.

Do not proceed if any check fails.

## Render cutover

Only after the checks above pass and production-change authorization is explicit:

1. In the confirmed Render workspace, open service `rupaykg` (`srv-daki4d7qj5pc73b8qksg`).
2. Update only `DATABASE_URL` to the new `rupaykg_runtime_login` connection string for database `rupaykg`. Preserve the current host/SSL settings and do not change unrelated environment variables.
3. Keep the previous value in the approved secret manager as a rollback reference; do not paste it into logs or tickets.
4. Trigger a controlled deploy of the intended `main` commit. Do not deploy a different commit as part of this credential change.
5. Verify the deployment starts, the runtime preflight emits `ok: true`, and the service health endpoint succeeds.
6. Run the post-deploy tenant-isolation acceptance suite, including cross-tenant negative cases. Verify logs contain no credentials.

## Rollback

If the new login fails before the application serves traffic, restore the prior `DATABASE_URL` from the approved secret manager and redeploy the previously live known-good deployment. Do not relax the preflight or change RLS policies as a rollback shortcut. Keep the new role for diagnosis until its grants and dependencies are reviewed; revoke/drop it only through a separately approved database change.

## Explicitly out of scope

- No production role creation or password issuance by this runbook.
- No production Render environment-variable mutation or deployment.
- No migration 111 application or RLS activation.
- No change to runtime preflight, RLS policies, table ownership, or SECURITY DEFINER boundaries.
- No use of the current BYPASSRLS `rupaykg` owner login for web traffic.

## Release gate after credential cutover

Once the dedicated runtime login is configured and preflight passes, separately review the migration-111 production plan and its owner/SET ROLE prerequisites. Migration 111 remains unapplied until its own controlled migration gate is authorized and passed.
