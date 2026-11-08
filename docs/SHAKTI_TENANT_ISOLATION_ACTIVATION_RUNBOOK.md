# Shakti Tenant Isolation — Deployment Activation Runbook

## Objective

Activate the tenant-isolation policy foundation only after the application runtime satisfies the database security contract.

## Preconditions

All must be true before activation:

1. The application deployment uses a dedicated login role derived from `rupaykg_app_runtime`.
2. The effective runtime role is **not** SUPERUSER and does **not** have BYPASSRLS.
3. Authentication resolves a verified identity and active organization.
4. Every tenant-scoped transaction executes `app.set_request_context(identity_id, organization_id)` before business-state access.
5. Administrative operations use explicit privileged paths and are not performed through the ordinary tenant runtime role.
6. Cross-tenant negative tests pass.

## Activation sequence

1. Apply all migrations to the target PostgreSQL instance.
2. Provision the deployment login role with the minimum required grants and membership in `rupaykg_app_runtime`.
3. Confirm:

```sql
select current_user, session_user;
select rolname, rolsuper, rolbypassrls
from pg_roles
where rolname = current_user;
```

Expected runtime result:

- `rolsuper = false`
- `rolbypassrls = false`

4. Run authenticated tenant transactions through the application and verify `app.current_identity_id()` and `app.current_organization_id()`.
5. Execute the tenant-isolation integration suite with `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1`.
6. Confirm organization A cannot read or mutate organization B state.
7. Only after steps 1–6 pass, enable RLS on the policy-covered tables in a controlled deployment migration/change.
8. Repeat the complete application runtime acceptance suite.
9. Record database role, migration fingerprint, test evidence, deployment commit and rollback procedure.

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
