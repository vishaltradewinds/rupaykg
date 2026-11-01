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

## Additional auth-route integration correction
An initial direct search of `server.ts` incorrectly suggested the auth routes were unregistered. Tracing the registration chain showed `registerValueRoutes(app, pool, authPool)` already calls `registerAuthRoutes(app, pool, authPool)`. A direct second registration caused Fastify duplicate-route errors. The redundant direct import/registration has been removed from `server.ts`; the single existing registration path is retained.

The actual auth-route issue was that onboarding handlers inside `auth-routes.ts` called `requireAuth` without passing `sessionPool`, causing fallback to the operational pool. Corrected those handlers to use the separate auth pool and added controlled 503 handling for auth-pool failures. Added `apps/src/auth-routes.test.ts` for route-module fail-closed behavior without a database.

The first CI run #4408 confirmed duplicate route registration and an outdated regex in the parallel `apps/test/production-config.test.ts` suite. The duplicate registration was removed. The current branch also contains the updated host/port/database expectation. Latest code head: `b1c98f6d8bed2b839dab04d5ba2ef22432a8af22`; exact-head CI not yet observed at checkpoint update time. No production changes.
