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


## Protected-query runtime audit continuation — 2026-11-09

Additional audit of route modules found pre-context protected-table access in the MRV status and Hedera verification paths. These paths were corrected:
- MRV status permission evaluation now runs inside `withTenantTransaction`.
- MRV Hedera provenance read/authorization/update paths now use tenant-bound clients and transaction-local context.
- External Hedera verification remains outside the DB transaction, followed by a fresh tenant-scoped persistence transaction.

The broader audit also identified platform-admin/onboarding paths that intentionally perform cross-organization administration and therefore require a separate platform-authority RLS policy/break-glass design before production activation. This is not being silently bypassed. Production remains fail-closed.


## CI acceptance closure — 2026-11-09 08:08Z

Latest canonical-branch CI run **6659** completed successfully on commit `97a0b76cd65e6113f8f9e3114856b89a86d50ad8`:
- migration validation: PASS
- migration rehearsal application: PASS
- TypeScript typecheck: PASS
- production build: PASS
- browser smoke test: PASS
- disposable PostgreSQL acceptance suite: PASS
- production container build: PASS

The runtime acceptance suite passed all six runtime-acceptance cases, including authenticated tenant operations, geography authorization, field-sync application, evidence verification, deterministic carbon provenance, and advisory/non-mutating intelligence.

Additional test-harness corrections were made to model the governed `app.authenticate_bearer_session` boundary and transaction-backed platform-admin routes. The production auth implementation was also hardened so malformed `x-rupaykg-organization-id` selectors are rejected before the database authentication bootstrap query.

G-002 engineering/CI acceptance is now PASS on the branch. This does not authorize production RLS activation, and it does not constitute field validation, regulatory certification, or TRL 9.


## Live-preflight gate continuation — 2026-11-09 08:18Z

The isolated rehearsal database was queried through the explicit `rupaykg_runtime_login` role, not the owner role. The executable runtime boundary returned:
- current_user=`rupaykg_runtime_login`
- rolsuper=false
- rolbypassrls=false
- protected RLS-enabled table count=17/17
- governed SECURITY DEFINER functions with runtime EXECUTE and no PUBLIC EXECUTE=3/3

The protected-policy review also confirms `organization_memberships` has SELECT-only tenant policy. No application mutation policy was added because the remaining onboarding/platform-admin mutation paths are cross-organization authority operations and require a separate platform-authority/break-glass design rather than a tenant-policy bypass.

A Render free-plan staging service `rupaykg-g002-runtime-preflight` was created from the canonical CTO branch to establish a real deployed runtime gate without touching production. The service is intentionally not treated as passed yet: its secret `DATABASE_URL` has not been injected because the deployment credential must be supplied through the deployment secret mechanism. Production remains untouched and fail-closed.

## Gate state
- G-002 engineering/CI: PASS
- isolated runtime-role DB acceptance: PASS
- deployed HTTP runtime preflight: OPEN
- production RLS activation: NOT AUTHORIZED / NOT EXECUTED
- regulatory certification: NOT CLAIMED
- field validation: NOT CLAIMED
- TRL 9: NOT CLAIMED


## Deployed runtime preflight attempt — 2026-11-09 08:19Z

A real Render staging deployment was exercised from the canonical CTO branch. The container built successfully, but the application intentionally failed closed during startup because `DATABASE_URL` was not configured in the Render environment. The logs show the expected production configuration guard rejecting startup with `PRODUCTION_CONFIG_INVALID: DATABASE_URL is required`.

This is a useful negative acceptance result: the production runtime does not start with incomplete database configuration. No privileged database credential was committed to Git or embedded in application source.

The remaining deployed-runtime gate is therefore specifically secret injection of the dedicated non-BYPASSRLS `rupaykg_runtime_login` DATABASE_URL into the isolated Render staging service, followed by successful runtime-db-preflight execution and HTTP startup acceptance. Production remains untouched.
