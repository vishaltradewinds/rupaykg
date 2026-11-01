# Production authentication runtime role manifest — 2026-11-01

**Status:** Design and application preflight proposal only. Not provisioned in production.

## Authoritative database boundary

Both runtime connection URLs must point to the same Neon host, port, and database path:
- `DATABASE_URL` user: `rupaykg_app_runtime`
- `AUTH_DATABASE_URL` user: `rupaykg_auth_runtime`

The server checks that the two connections report the same `current_database()` and distinct expected `current_user` values. Do not point either URL at a staging branch, a second database, or a different Neon endpoint.

## Required roles

| Role | LOGIN | SUPERUSER / BYPASSRLS | Purpose |
|---|---:|---:|---|
| `rupaykg_app_runtime` | Yes, credential provisioned out-of-band | No | Ordinary API/business queries; may execute only the session resolver among auth-private functions |
| `rupaykg_auth_runtime` | Yes, credential provisioned out-of-band | No | Calls narrow authentication SECURITY DEFINER functions; no direct auth-table access |
| `rupaykg_app_owner` | No | No | Future owner for approved application tables/functions after ownership and policy review |
| `rupaykg_auth_owner` | No | No | Owner of the reviewed authentication and scoped-authorization SECURITY DEFINER functions |
| `rupaykg_migrator` | Separate controlled login | No SUPERUSER/BYPASSRLS at runtime | Reviewed migration execution only; credentials and DDL authority managed separately |

All runtime roles must also have `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, and no `CREATE` on schema `public`. Runtime roles must not be members of either owner role.

## Function ownership and execution grants

All eighteen functions below must be SECURITY DEFINER, have fixed safe `search_path = pg_catalog, pg_temp`, use schema-qualified object references, and be owned by `rupaykg_auth_owner`:

1. `auth_private.resolve_session(text)`
2. `auth_private.find_login_candidate(text)`
3. `auth_private.record_login_failure(uuid)`
4. `auth_private.reset_login_failures(uuid)`
5. `auth_private.issue_session(uuid,text,jsonb)`
6. `auth_private.revoke_session(text)`
7. `auth_private.register_identity(text,text,text,text)`
8. `auth_private.get_self_account_context(text)`
9. `auth_private.has_organization_permission(uuid,uuid,text[])`
10. `auth_private.organization_has_geography_scope(uuid,uuid)`
11. `auth_private.can_read_geography(uuid,uuid)`
12. `auth_private.can_write_geography(uuid,uuid,uuid)`
13. `auth_private.can_write_activity(uuid,uuid)`
14. `auth_private.can_verify_evidence(uuid,uuid)`
15. `auth_private.is_platform_admin(uuid,text)`
16. `auth_private.get_platform_admin_overview(uuid)`
17. `auth_private.list_platform_identities(uuid,text,integer)`
18. `auth_private.list_platform_roles(uuid)`

Execution grants:
- `rupaykg_app_runtime`: EXECUTE on `resolve_session(text)` and all ten scoped authorization functions (organization permission, geography scope/read/write, activity write, evidence verification, platform-admin authority, and the three platform-admin read projections); no credential/session lifecycle or self-context functions.
- `rupaykg_auth_runtime`: EXECUTE on functions 2–8; no EXECUTE on `resolve_session(text)` or any of the ten scoped application authorization functions.
- PUBLIC: no EXECUTE on any of the eight functions.
- Neither runtime role receives SELECT/INSERT/UPDATE/DELETE on `identities`, `identity_sessions`, `identity_password_credentials`, or `organization_memberships`.

The auth owner receives only the underlying table grants required by the reviewed function definitions. Do not grant broad schema ownership or superuser/BYPASSRLS.

## Application startup gate

Production startup fails closed unless:
- both URLs exist and target the same database endpoint/path;
- usernames are exactly the two runtime role names above;
- the database identities are distinct and both non-superuser, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION;
- app runtime has no direct auth-table DML/read privileges and no public-schema CREATE;
- app runtime can execute the session resolver and the seven scoped application authorization functions, but cannot execute credential/session lifecycle or self-context functions;
- auth runtime has no direct auth-table DML/read privileges or public-schema CREATE, can execute functions 2–8, and cannot execute the session resolver or any scoped application authorization function;
- both owner roles exist, are NOLOGIN/NOBYPASSRLS and have no elevated database/role/replication privileges;
- all eighteen functions exist, are SECURITY DEFINER and are owned by `rupaykg_auth_owner`.

Readiness requires both pools to be reachable.

## Not yet authorized

This role manifest does not authorize production changes. Outstanding requirements:
- Build and independently review the exact production SQL migration from the tested disposable-branch definitions.
- Verify grants and FORCE RLS behavior on a fresh disposable Neon branch using the exact final role names.
- Migrate stakeholder onboarding create/withdraw and any platform-admin/worker/CLI auth-table paths behind identity-bound functions before revoking their existing application access.
- Complete the full 67-table ownership/policy matrix and non-HTTP worker inventory.
- Provision passwords/secrets only through an approved secure channel after migration review.
- Validate connection-pool saturation, session concurrency, recovery and rollback.
- Keep production certification OFF until the complete release gate passes.

No production role, grant, RLS policy, function, credential, or database object has been changed by this proposal.
