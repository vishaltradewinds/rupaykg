# Shakti Tenant Isolation — Deployment Activation Runbook

## Objective

Activate the tenant-isolation policy foundation only after the application runtime satisfies the database security contract.

The protected inventory is 18 tenant-owned tables. It now includes `mrv_provenance_events`, whose policy boundary must bind the provenance row's activity, evidence and verification to the active verified organization. Its ownership and policy installation are protected migration 101; enabling RLS remains a separate controlled activation step.

## Preconditions

All must be true before activation:

1. The application deployment uses a dedicated login role derived from `rupaykg_app_runtime`.
2. The effective runtime role is **not** SUPERUSER, does **not** have BYPASSRLS, and does **not** own any protected tenant table. PostgreSQL table owners normally bypass RLS, so runtime ownership would defeat the intended row-level boundary.
3. Authentication resolves a verified identity and active organization.
4. Every tenant-scoped transaction executes `app.set_request_context(identity_id, organization_id)` before business-state access.
5. The runtime role has the required DML privileges on protected tables; RLS remains the row-level boundary.
6. Administrative operations use explicit privileged paths and are not performed through the ordinary tenant runtime role.
7. Cross-tenant negative tests pass.

## Activation sequence

1. Apply all migrations to the target PostgreSQL instance.
2. Keep three identities separate: (a) the application runtime login derived from `rupaykg_app_runtime`; (b) the non-login owner role `rupaykg_ddl`, which owns the 18 protected tables and is not SUPERUSER or BYPASSRLS; and (c) a dedicated acceptance login (for example `rupaykg_ddl_login`) with `LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`. Grant this acceptance login `SET TRUE, INHERIT FALSE` membership to both `rupaykg_ddl` and `rupaykg_app_runtime`, with no ADMIN option and no membership to `rupaykg` or provider-admin roles. Store its connection URL only in a restricted GitHub Actions environment secret. The acceptance script uses `rupaykg_ddl` only for rollback-only fixture setup and switches to `rupaykg_app_runtime` for the actual tenant assertions. Do not reuse the application runtime login as the DDL acceptance login.
3. Run `ops/tenant-isolation/VERIFY_DDL_ROLE_PRE_RLS.sql` using the controlled migration/DDL role and preserve its output. It must prove ownership of all 18 protected tenant tables and fail closed for SUPERUSER, BYPASSRLS, or runtime-role execution.
4. Run `ops/tenant-isolation/VERIFY_PRE_RLS.sql` using the exact intended application runtime login role and preserve its output as deployment evidence.
5. Run `ops/tenant-isolation/VERIFY_SECURITY_DEFINER_BOUNDARIES.sql` using the exact intended application runtime login and preserve its output. It must prove `app.set_request_context`, `app.is_verified_org_member`, and `app.authenticate_bearer_session` are SECURITY DEFINER, use `pg_catalog, public, app`, are executable by the runtime role, and are not executable by PUBLIC.
5. Confirm:

```sql
select current_user, session_user;
select rolname, rolsuper, rolbypassrls
from pg_roles
where rolname = current_user;
```

Expected runtime result:

- `rolsuper = false`
- `rolbypassrls = false`
- `runtime_role_owns_no_protected_tables = true`

6. Run authenticated tenant transactions through the application and verify `app.current_identity_id()` and `app.current_organization_id()`.
7. Verify the authentication/bootstrap path is RLS-compatible before activation. Run `ops/tenant-isolation/VERIFY_AUTH_BOOTSTRAP.sql` using the exact intended application runtime login and preserve its output. The ordinary application runtime must not depend on unrestricted pre-context reads of `organization_memberships`; authentication must use the explicitly governed `app.authenticate_bearer_session(text)` SECURITY DEFINER bootstrap path (or another separately governed authentication database role). The bootstrap function must have an explicit `search_path`, public EXECUTE revoked, runtime EXECUTE granted, and must return only verified memberships attached to the presented bearer session. Do not enable RLS while bearer authentication still requires an unscoped runtime query of the protected membership table.
8. Run the authentication bootstrap contract tests and execute the tenant-isolation integration suite with `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1`.
9. Confirm organization A cannot read or mutate organization B state.
10. Only after steps 1–9 pass, execute `ops/tenant-isolation/ACTIVATE_RLS.sql` using the controlled migration/DDL role, not the application runtime role. The script is fail-closed and aborts before RLS changes if the executing role is SUPERUSER, BYPASSRLS, the application runtime role, or does not own the protected tenant tables.
11. Execute `ops/tenant-isolation/VERIFY_RLS_NEGATIVE_TEST.sql` and preserve the PASS output as acceptance evidence. The test must prove tenant A cannot read or mutate tenant B and is transactional/rollback-safe.
12. Repeat the complete application runtime acceptance suite, including cross-tenant negative tests.
13. Record database role, migration fingerprint, preflight output, activation output, negative-test output, application test evidence, deployment commit and rollback procedure.

## Rollback

Do not disable tenant controls merely to restore application availability.

If activation fails:

- stop production rollout;
- preserve the failure evidence;
- revert the application to the last known-good release only when the rollback path is validated;
- correct the runtime contract;
- rerun negative tenant-isolation tests;
- repeat activation.

## Release rule

**RLS enabled + non-BYPASSRLS runtime + transaction-local tenant context + passing cross-tenant negative tests = tenant-isolation acceptance.**

Policy definitions alone do not constitute acceptance.


## Automated live acceptance

The repository provides `.github/workflows/tenant-isolation-live-acceptance.yml`.

Configure two GitHub Actions secrets: `RUPAYKG_RUNTIME_DATABASE_URL` with the exact intended non-BYPASSRLS application runtime connection string, and `RUPAYKG_DDL_DATABASE_URL` with the controlled migration/DDL connection string. The workflow verifies that the DDL acceptance login is non-BYPASSRLS and can `SET ROLE` to both `rupaykg_ddl` and `rupaykg_app_runtime`; it then runs the DDL-owner preflight, runtime preflight/authentication/policy-coverage checks against the runtime login, and the transactional post-RLS negative test. The negative test switches to `rupaykg_ddl` for fixture setup and `rupaykg_app_runtime` for tenant assertions. RLS activation itself remains a controlled DDL operation and is intentionally not performed by the runtime acceptance workflow. A passing workflow run is deployment evidence; the secret value must never be printed or committed.


### Policy coverage evidence

Before the cross-tenant negative test, the live acceptance workflow executes `ops/tenant-isolation/VERIFY_RLS_POLICY_COVERAGE.sql`. The evidence artifact records the protected-table policy inventory and fails closed if any protected table lacks a read policy. Mutation policy coverage is intentionally not required for read-only protected relations; cross-tenant mutation denial is proven separately by the transactional negative test. This is an evidence-strengthening gate; it does not replace tenant A/B read and mutation isolation testing.
