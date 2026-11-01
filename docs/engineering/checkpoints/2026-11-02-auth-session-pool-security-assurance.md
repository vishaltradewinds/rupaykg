# CTO checkpoint — authentication session-pool least-privilege assurance

**Date:** 2026-11-02  
**Repository:** `vishaltradewinds/rupaykg`  
**Branch:** `security/separate-authentication-pool-2026-11-01`  
**PR:** #202  
**Production posture:** HOLD — no production changes

## Scope and implementation
- Split opaque session verification from operational membership authorization using a dedicated auth pool.
- Propagate the session pool through onboarding, workspace, registry/settlement, BWG/EPR, CPCB/SWM, MRV/statutory, evidence-vault and platform-admin route registration.
- Add production `AUTH_DATABASE_URL` validation and a distinct least-privilege login contract.
- The auth login inherits the NOBYPASSRLS `rupaykg_auth` capability and receives function EXECUTE, not direct auth-table SELECT.
- The non-login `rupaykg_auth_verifier_owner` is intentionally BYPASSRLS only for pre-tenant opaque-session verification; it is granted SELECT only on `identity_sessions` and `identities`, has no login/DDL/role/database/replication privileges, has no outbound role memberships, and loses temporary migration membership after ownership transfer.
- Migration validation now rejects outbound role memberships for both the verifier owner and auth capability role.
- Added PostgreSQL integration test `apps/src/auth-session-verifier.postgres.integration.test.ts` to prove the exact owner/table/function grants and PUBLIC denial.
- Added endpoint port equality validation so `AUTH_DATABASE_URL` must target the same PostgreSQL host, port and database as `DATABASE_URL`.
- Fixed platform-admin test fixtures to respond to the new `verify_identity_session` function call rather than the old direct session-table query.

## CI evidence
- Earlier run #4389 failed because a test file contained literal escaped newlines; corrected.
- Run #4394 passed migration execution but failed TypeScript due to a Pool query mock assignment; corrected with a narrow typed mock.
- Run #4397 passed migration validation, full disposable migrations, typecheck, build and browser smoke, but the PostgreSQL acceptance suite failed because legacy platform-admin test fixtures still expected direct `identity_sessions` SQL. Updated those fixtures to recognize `verify_identity_session`.
- Current head: `667fbe25e2d6e073bdcf8494eb634ff3d040c60f`.
- Exact-head CI #4402 / run `41338230513`: IN PROGRESS at checkpoint time.

## Safety and limitations
- No production role grants, production DDL/DML, production migrations, deployment secrets, deployments, workers or schedulers changed.
- The auth verifier function's BYPASSRLS owner is a narrowly scoped non-login exception, not the application runtime. It must remain isolated from all login/runtime identities.
- The split auth pool does not complete transaction-scoped tenant RLS; operational query coverage and the all-table policy programme remain separate gates.
- PR remains draft. No production readiness or TRL 9 claim.

## Next actions
1. Verify exact-head CI #4402 and correct only evidenced failures.
2. Obtain independent review of the BYPASSRLS verifier owner, table grants, migration owner transfer and runtime membership.
3. Confirm production DBA provisioning/secret contract without applying any production role changes.
4. Integrate with PRs #199–#201 only on a controlled integration spine after combined-base CI.
5. Keep production release HOLD until 67-table RLS policy coverage, all route/worker transaction coverage, migration reconciliation and approvals are complete.

## Additional integration defect found after initial checkpoint
A route-wiring audit found that `auth-routes.ts` was not imported or registered by the production `server.ts` entry point. The module existed, but its login/register/auth-me/onboarding application endpoints were not part of the authoritative Fastify server. Corrected the branch by:
- Importing and registering `registerAuthRoutes(app, pool, authPool)` in `server.ts`.
- Passing `sessionPool` to the onboarding handlers in `auth-routes.ts` that previously fell back to the operational pool.
- Returning a controlled 503 on authentication-pool failures rather than allowing unhandled exceptions.
- Adding `apps/src/auth-routes.test.ts` to verify route registration and fail-closed behavior without a database.

Latest head after these corrections: `561aee0649dc90854cd3a09323aec6c3dd9ea6f2`. Exact-head CI #4406 / run `41338395809` is IN PROGRESS. This run includes the full route-wiring correction and integration test. No production changes.
