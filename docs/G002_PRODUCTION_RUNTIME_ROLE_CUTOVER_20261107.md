# G-002 Production Runtime Role Cutover Runbook — 2026-11-07

## Objective

Move the deployed RupayKg API from the current administrative PostgreSQL identity to a dedicated non-admin, NOBYPASSRLS runtime identity without changing production schema/data in an uncontrolled manner.

## Required runtime identity

The production API must connect as a role equivalent to:

- LOGIN = true
- SUPERUSER = false
- CREATEROLE = false
- CREATEDB = false
- REPLICATION = false
- BYPASSRLS = false
- policy target role: `rupaykg_app_runtime`

The application startup guard in `apps/src/runtime-db-role-guard.ts` fails closed if any administrative/RLS-bypass capability is present. If `RUPAYKG_EXPECTED_RUNTIME_DB_ROLE` is set, the guard also requires the exact role name.

## Current production state

Production has not been mutated by this reconciliation work.

The existing production `rupaykg` role remains privileged and must not be used by the application runtime after cutover.

## Controlled sequence

1. Provision the dedicated runtime role through the approved database administration path.
2. Grant only required schema/table/function privileges.
3. Verify the runtime role is NOBYPASSRLS/non-admin.
4. Verify required tenant RLS policies target the runtime role.
5. Configure the deployment secret `DATABASE_URL` to use the runtime role.
6. Configure `RUPAYKG_EXPECTED_RUNTIME_DB_ROLE=rupaykg_app_runtime`.
7. Deploy the G-002 branch to a non-production environment first.
8. Confirm startup log contains `RUNTIME_DB_ROLE_GUARD: PASS`.
9. Run tenant A/B read/write isolation tests.
10. Confirm health and application regression tests.
11. Only then perform production cutover with a rollback credential retained separately.
12. Re-verify production RLS coverage and runtime identity from read-only evidence.

## Fail-closed rule

Do not weaken, bypass, disable, or remove the startup guard to make deployment succeed. If the service cannot start because it is still using the administrative identity, the database identity/cutover is incomplete.

## Evidence required for G-002 closure

- deployed service runtime role independently observed;
- role privilege matrix captured;
- production RLS table/policy inventory captured;
- tenant A/B runtime isolation evidence;
- application regression evidence;
- rollback path tested;
- independent review recorded.

No production role or RLS mutation is authorized by this document itself.
