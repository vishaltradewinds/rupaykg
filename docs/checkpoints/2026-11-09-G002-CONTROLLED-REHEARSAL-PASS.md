# RupayKg — G-002 Controlled Rehearsal PASS — 2026-11-09

## Canonical scope
- Repository: vishaltradewinds/rupaykg
- Production Neon project: steep-mud-79906940
- Production branch: br-restless-base-b44cip2h
- Controlled rehearsal branch: br-lingering-lake-b4svl185
- Rehearsal branch parent: canonical production branch

## Rehearsal execution
Canonical migrations 097, 098 and 099 were applied to the fresh rehearsal branch.

Observed after migration:
- 3 expected tenant SECURITY DEFINER functions present.
- All 3 have hardened PostgreSQL function search_path: pg_catalog, public, app.
- Runtime role exists with BYPASSRLS=false.
- Runtime role has EXECUTE on the three governed functions.
- PUBLIC has no EXECUTE on the three governed functions.
- 31 public RLS policies present.
- 17 protected tenant tables have RLS enabled.
- All 17 protected tenant tables are owned by dedicated rupaykg_ddl in rehearsal.
- rupaykg remains BYPASSRLS=true, but is not the application runtime role.

## Cross-tenant negative acceptance
A transactional fixture test was executed with two independent organizations and identities.

PASS:
- tenant A sees exactly its own organization.
- tenant A sees zero rows from tenant B.
- tenant A update against tenant B affected zero rows.
- tenant A delete against tenant B affected zero rows.
- fixture rows were cleaned up before transaction commit.

This demonstrates the intended row-isolation boundary for the exercised organization scope.

## Repository corrections discovered during rehearsal
The existing operational scripts contained executable defects which were corrected on the CTO branch:
1. SECURITY DEFINER verification now checks pg_proc.proconfig for the hardened search_path instead of matching pg_get_functiondef formatting.
2. RLS activation DO block delimiter corrected.
3. RLS activation SELECT-policy check corrected to PostgreSQL policy command names.
4. RLS activation protected-table ownership count corrected from 18 to the actual 17 protected tables.
5. Negative-test DO block delimiters corrected.

## Production safety
Production was not mutated.

Post-rehearsal production verification:
- public policy count: 0
- RLS-enabled protected tables: 0
- expected tenant functions: 1
- rupaykg BYPASSRLS: true

Therefore the rehearsal evidence does not constitute production activation or TRL uplift.

## Next gate
The remaining G-002 work is production deployment preparation:
1. finalize the DDL/runtime role split as a canonical migration/operating procedure;
2. validate application runtime login/session path against the dedicated non-BYPASSRLS role;
3. validate all application queries touching protected tables under the runtime role;
4. prepare controlled production migration with rollback evidence;
5. obtain explicit production-change authorization before applying to production.

Fail-closed remains the production posture until those gates are completed.


## Runtime-login acceptance extension — 2026-11-09

The rehearsal role graph was further hardened and tested:
- `rupaykg_runtime_login` is LOGIN, NOSUPERUSER, NOBYPASSRLS.
- `rupaykg_runtime_login` inherits only `rupaykg_app_runtime` for application privileges.
- `rupaykg_ddl` and `rupaykg_app_runtime` are NOLOGIN.
- The privileged owner role `rupaykg` was removed from the DDL/runtime role memberships in rehearsal.
- As `rupaykg_runtime_login`, schema/table privileges and all three governed SECURITY DEFINER function EXECUTEs were verified.
- PUBLIC EXECUTE remains revoked.

One important limitation remains: the Neon SQL control plane executes through the project owner connection, so a separate network-authenticated application connection using the runtime-login credential was not established from this tool session. Therefore application-level runtime acceptance is not claimed complete.


## Application runtime DB preflight — 2026-11-09

Added `apps/src/runtime-db-preflight.ts` and the `runtime-db-preflight` npm command. The preflight is fail-closed and verifies that the application connection is using a non-superuser, NOBYPASSRLS role; all 17 protected tables have RLS enabled and are not owned by the runtime role; and the three governed SECURITY DEFINER functions are executable by the runtime role while PUBLIC EXECUTE remains revoked.

This is an executable deployment/runtime gate. It does not itself establish a live application network connection from this tool session; that remains dependent on the deployed service using the runtime-login credential as `DATABASE_URL` and passing this preflight.


## Production application fail-closed enforcement — 2026-11-09

The application path is now explicitly prepared for the runtime-role cutover:
- Production configuration requires `RUPAYKG_REQUIRE_RUNTIME_DB_ROLE=true`.
- Production startup sets that requirement from the validated production configuration.
- The API server performs a startup database-role assertion and refuses to start if the application connection is superuser or BYPASSRLS.
- The executable `runtime-db-preflight` separately verifies the protected-table RLS/ownership boundary and SECURITY DEFINER privilege boundary.

This deliberately makes a production deployment fail closed if `DATABASE_URL` still points at the privileged owner role. The deployment is therefore not certified ready until `DATABASE_URL` is changed to the dedicated runtime-login credential and the preflight passes against the deployed database.


## Runtime-role database acceptance — 2026-11-09 07:47Z

A Neon connection was executed explicitly as `rupaykg_runtime_login` on the isolated rehearsal branch:
- `current_user=rupaykg_runtime_login`
- `rolsuper=false`
- `rolbypassrls=false`
- all 17 protected tables returned zero rows without an established tenant context, demonstrating fail-closed visibility at the runtime-role connection boundary;
- all 17 protected tables remain RLS-enabled and owned by `rupaykg_ddl`, not the runtime role;
- runtime login has EXECUTE on `app.set_request_context`, `app.authenticate_bearer_session`, and `app.is_verified_org_member`;
- PUBLIC EXECUTE is revoked on all three.

This is stronger evidence than role metadata alone, but it is still not the same as a deployed HTTP application connection. The network-authenticated deployed application gate remains open.

## Application query audit correction — 2026-11-09

The API overview endpoint had tenant-table reads through the generic pool without establishing transaction-local tenant context. It was corrected to execute the overview aggregation inside `withTenantTransaction`, using the tenant-bound client for permission checks and protected-table reads.

Production configuration/server source also had literal escaped newline artifacts from the previous automated edit; those were normalized, and the production config now returns the required `requireRuntimeDbRole: true` contract.

The CI workflow was observed running against the branch after the runtime-role hardening changes; final CI conclusion remains pending and must be checked before any certification claim.
