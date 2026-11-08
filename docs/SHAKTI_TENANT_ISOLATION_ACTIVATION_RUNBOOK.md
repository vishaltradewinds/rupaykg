# Shakti Tenant Isolation — Deployment Activation Runbook

## Objective

Activate the tenant-isolation policy foundation only after the application runtime satisfies the database security contract.

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
2. Provision two distinct roles: (a) the application runtime login derived from `rupaykg_app_runtime`, and (b) a controlled migration/DDL role that owns the protected tenant tables and is not SUPERUSER or BYPASSRLS.
3. Run `ops/tenant-isolation/VERIFY_PRE_RLS.sql` using the exact intended application runtime login role and preserve its output as deployment evidence.
4. Confirm:

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

5. Run authenticated tenant transactions through the application and verify `app.current_identity_id()` and `app.current_organization_id()`.
6. Execute the tenant-isolation integration suite with `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1`.
7. Confirm organization A cannot read or mutate organization B state.
8. Only after steps 1–7 pass, execute `ops/tenant-isolation/ACTIVATE_RLS.sql` using the controlled migration/DDL role, not the application runtime role. The script is fail-closed and aborts before RLS changes if the executing role is SUPERUSER, BYPASSRLS, the application runtime role, or does not own the protected tenant tables.
9. Execute `ops/tenant-isolation/VERIFY_RLS_NEGATIVE_TEST.sql` and preserve the PASS output as acceptance evidence. The test must prove tenant A cannot read or mutate tenant B and is transactional/rollback-safe.
10. Repeat the complete application runtime acceptance suite, including cross-tenant negative tests.
11. Record database role, migration fingerprint, preflight output, activation output, negative-test output, application test evidence, deployment commit and rollback procedure.

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

Configure the GitHub Actions secret `RUPAYKG_RUNTIME_DATABASE_URL` with the exact intended non-BYPASSRLS application runtime connection string. The workflow executes the read-only preflight, policy coverage check and transactional post-RLS negative test against that database. RLS activation itself remains a controlled DDL operation and is intentionally not performed by the runtime acceptance workflow. A passing workflow run is deployment evidence; the secret value must never be printed or committed.


### Policy coverage evidence

Before the cross-tenant negative test, the live acceptance workflow executes `ops/tenant-isolation/VERIFY_RLS_POLICY_COVERAGE.sql`. The evidence artifact records the protected-table policy inventory and fails closed if any protected table lacks either a read policy or a mutation policy. This is an evidence-strengthening gate; it does not replace tenant A/B read and mutation isolation testing.
