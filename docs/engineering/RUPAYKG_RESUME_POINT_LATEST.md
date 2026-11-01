# RupayKg resume point — latest

**Last updated:** 2026-11-01  
**Canonical repository:** vishaltradewinds/rupaykg  
**Current integration branch:** shakti/auth-bootstrap-application-integration-2026-11-01  
**Last verified code head:** 003f4e29bf555660681da3052f8152353fa42013  
**Checkpoint/docs commit:** 82b1fca3fe10dcdb074982d3feceed4508f9b357  
**Resume pointer:** this file is part of the latest branch checkpoint; fetch the live branch HEAD on the next run for any later docs-only update.  
**Main baseline/live Render commit:** b5e91241d84a6712ff544d3deec1805702f45efd  
**Release posture:** HOLD — production certification OFF — TRL 9 not established

## Read first
1. Immutable checkpoint: docs/engineering/checkpoints/2026-11-01-cto-auth-trigger-hardening-checkpoint.md
2. Session log: docs/engineering/session-logs/2026-11-01-cto-autonomous-session.md
3. Provisional component TRL: docs/engineering/TRL_ASSESSMENT_2026-11-01.md
4. P0 bootstrap issue: https://github.com/vishaltradewinds/rupaykg/issues/195
5. Whole-platform Shakti/TRL audit: https://github.com/vishaltradewinds/rupaykg/issues/112
6. Auth integration PR: https://github.com/vishaltradewinds/rupaykg/pull/192

## Exact current state
- PR #192 code head 003f4e29bf555660681da3052f8152353fa42013; draft/unmerged. Checkpoint/docs commit 82b1fca3fe10dcdb074982d3feceed4508f9b357. Docs-follow-up CI #4350 (run 41332260286) is in progress. Exact-head CI #4345 (run 41331793993) failed at full disposable PostgreSQL tests. Migration validation, migration execution, dependency audit, typecheck, build and browser smoke passed. New reserved-role and APPROVED-application negative tests passed; see checkpoint.
- Main HEAD b5e91241d84a6712ff544d3deec1805702f45efd; main CI #4007 passed.
- PR #193 exact-head CI #4335 passed; no independent review.
- PR #194 exact-head CI #4333 passed; no independent review.
- Production Neon branch br-restless-base-b44cip2h is the sole authoritative live database. Read-only snapshot: 0 organizations, 0 identities, 0 roles, 0 memberships, 0 platform access requests; 67 public base tables, 0 RLS-enabled, 0 FORCE RLS; migration ledger 92 rows. Do not mutate production.
- Render service rupaykg tracks main with auto-deploy enabled; latest live deployment remains commit b5e91241d84a6712ff544d3deec1805702f45efd. Do not merge/deploy auth PR until all runtime and release gates close.
- Staging branch/queue evidence remains preserved; workers and schedulers remain OFF.
- Overall national platform provisional TRL 3; software components with lab acceptance at most TRL 4; IoT and external integrations TRL 2–3/not verified.

## Next actions (ordered)
1. Founder approval of two distinct initial authority identities and the out-of-band bootstrap trust ceremony; independent security review. A single initial super_admin cannot create the second under existing dual control.
2. Implement and test a two-identity, two-secret, atomic one-time bootstrap only on disposable CI; empty-by-default claim, dedicated NOLOGIN owner, immutable audit, no public route and no app-runtime EXECUTE.
3. Replace the legacy platform-admin fixture that disables the membership trigger. Convert remaining direct VERIFIED membership fixtures to the real onboarding/review lifecycle; resolve CI #4345 without weakening guards.
4. Convert onboarding create/withdraw and hierarchical review/approval routes to identity- and authority-bound auth_private functions. Complete app-runtime compatibility before any role cutover.
5. Complete 67-table tenant/RLS classification and test the transaction-context adapter on disposable Neon. Production currently has 0/67 RLS.
6. Reconcile production 92-row and staging 95-row ledgers against exact source files and schema objects. Never rewrite historical ledger rows or replay blindly.
7. Obtain independent reviews for PR #193/#194 and other tenant-isolation/auth PRs; passing CI alone is not merge approval.
8. Keep workers OFF until staging queue lineage, constraints, leases, idempotency, recovery and side-effect boundaries are reconciled.
9. Advance TRL only after real urban/rural operations, calibrated hardware, external trust-chain acceptance, recovery testing and independent review.

## Safety boundary
No production DDL/DML, migration, role/grant/RLS changes, deployments, worker/scheduler activation, regulatory submissions, credit issuance or certification are authorized by this resume point. Continue repository and disposable-environment work only until the stated approvals and gates exist.

## 2026-11-02 autonomous CTO session
- Session log: `docs/engineering/session-logs/2026-11-02-cto-session.md`.
- Latest verifier owner checkpoint: PR #201 `docs/engineering/checkpoints/2026-11-02-signed-context-verifier-owner-hardening.md`.
- PR #201 head `89b64981d6b7d1de4c78c8ffb68c70f7d74730db`; exact-head CI #4390 / run `41337852165` IN PROGRESS after correcting a migration-ledger permission failure by resetting the temporary migration role before ledger insertion.
- PR #202 head `698270155755ef6493ba9f8bcc5c3a62b3ab9f38`; exact-head CI #4391 / run `41337889844` IN PROGRESS after correcting malformed test-source newline escapes. Earlier #4389 failed typecheck; do not report it as a current-head result.
- Disposable Neon rehearsal of PR #201's original migration exposed that the SECURITY DEFINER function/key table were owned by broad `rupaykg` (BYPASSRLS). Corrected PR #201 now requires a pre-provisioned NOLOGIN/NOBYPASSRLS restricted owner, validates no outbound role memberships, and asserts owner/ACL/search_path properties.
- Issues #195 and #196 remain open. Founder-approved two-identity bootstrap ceremony and independent security review remain necessary.
- No production DDL/DML, migration, role/grant/RLS changes, branch operations, deployment, worker activation or certification performed. Production remains HOLD; TRL 9 not established.

## 2026-11-02 CI status correction
- PR #201 latest code head `89b64981d6b7d1de4c78c8ffb68c70f7d74730db`; exact-head CI #4390 / run `41337852165` **PASS** across migration validation, disposable restricted-owner provisioning, full PostgreSQL migrations, typecheck, build, browser smoke, unit + PostgreSQL integration tests and production container build. The migration-ledger failure was fixed with `RESET ROLE` after creating verifier objects.
- PR #202 latest code head `c21136996f88a09ae12f2dc5b0323db150f0bda9`; exact-head CI #4397 / run `41338076306` QUEUED at last check. The previous #4394 failure was a TypeScript assignment issue in a shared-pool test mock; current head contains the corrected typed mock and a new PostgreSQL integration test for verifier owner/capability grants.
- PR #202's auth verifier owner intentionally has BYPASSRLS solely for pre-tenant session verification, but is NOLOGIN and has SELECT only on `identity_sessions` and `identities`; new migration checks reject outbound role memberships. The `rupaykg_auth` capability is NOBYPASSRLS and also rejects outbound role memberships. The API login receives EXECUTE only and must not inherit the verifier owner.
- Issue #196 received exact-head CI and owner-hardening evidence updates. PRs #201 and #202 remain draft; no merges or production changes.

## 2026-11-02 authentication-pool assurance update
- PR #201 exact-head CI #4390 / run `41337852165` **PASS** on `89b64981d6b7d1de4c78c8ffb68c70f7d74730db`. This includes the restricted verifier owner, role provisioning in disposable CI, full migrations, PostgreSQL integration, typecheck, build, browser smoke and production container build. PR #201 remains draft for independent review and clean disposable Neon rehearsal.
- PR #202 adds a PostgreSQL integration test for the auth verifier owner/capability grants; rejects outbound role memberships for both the BYPASSRLS verifier owner and NOBYPASSRLS auth capability; verifies owner only reads `identity_sessions` and `identities`; checks API capability EXECUTE-only access; and requires `AUTH_DATABASE_URL` to match operational host, port and database.
- PR #202 CI #4397 / run `41338076306` failed in platform-admin tests because fixtures still expected direct session-table SQL; current code changes those fixtures to recognize `verify_identity_session`. Run #4402 / `41338230513` is checking that fix; run #4403 / `41338270226` is checking the latest checkpoint head `86cab42383b17761ae23e0c1a9cd0166f1ffb995`. At checkpoint update time both are still in progress.
- PR #202 checkpoint: `docs/engineering/checkpoints/2026-11-02-auth-session-pool-security-assurance.md`.
- No production DDL/DML, migrations, role/grant/RLS changes, branch operations, deployment, worker activation or certification. Production remains HOLD. No merge or TRL 9 claim.

## 2026-11-02 auth-route production wiring correction
- PR #202 code review found `apps/src/auth-routes.ts` was not imported or registered by authoritative `apps/src/server.ts`; production start uses `production-server.ts` → `server.ts`. Registered `registerAuthRoutes(app, pool, authPool)` in the server.
- Updated onboarding handlers inside `auth-routes.ts` to use the separate session-verification pool and return a controlled 503 on auth-pool errors.
- Added `apps/src/auth-routes.test.ts` for route registration and fail-closed behavior.
- PR #202 checkpoint updated: `docs/engineering/checkpoints/2026-11-02-auth-session-pool-security-assurance.md`.
- PR #202 current head `9cda4b65091f08b2a2c478322d9d72d4e54722a5`; exact-head CI #4408 / run `41338438338` IN PROGRESS. Prior code-head run #4406 had migration, typecheck and build in progress after route wiring; #4408 covers the checkpoint commit.
- PR #201 remains exact-head CI PASS (#4390). Both PRs remain draft and unmerged pending independent security review and controlled integration.
- Production remains untouched and release HOLD.

## 2026-11-02 route-registration audit correction
- Correction: `auth-routes.ts` was already registered indirectly by `registerValueRoutes(app, pool, authPool)`; the direct import/registration added during the audit was redundant and has been removed after CI exposed duplicate Fastify routes.
- The real defect was that onboarding handlers in `auth-routes.ts` omitted `sessionPool` and therefore fell back to the operational pool. They now use the separate auth pool; auth-pool errors fail closed. Module-level route tests remain.
- The parallel production-config test suite also had an outdated expected error string; current branch test expectation matches the host/port/database validation message.
- PR #202 latest head `d67d597de1ada8f89cede1ff7c09fd9ca1627e47`; exact-head CI #4416 / run `41338701474` IN PROGRESS. Earlier #4408 failed due duplicate route registration and outdated regex; both corrections are on current head.

## 2026-11-02 RLS token/transaction consolidation
- PR #199 duplicated the signed-token file/tests also present in PR #200. Ported the AuthContext-derived `createSignedRequestContextForAuth` helper and tests into PR #200, added explicit bilateral-scope rejection, and changed `withRlsRequestTransaction` to use the canonical helper.
- PR #200 retains the stronger transaction boundary; PR #199's simpler `withSignedRequestDatabaseContext` wrapper is superseded. Closed PR #199 (not merged) to prevent duplicate implementations.
- PR #200 exact code-head CI #4414 / run `41338613533` **PASS** across migrations, typecheck, build, browser smoke, all unit/PostgreSQL tests and production container build. Docs checkpoint commit triggers CI #4418 / run `41338785023`, IN PROGRESS.
- PR #202 route audit correction: auth routes were already registered indirectly by `registerValueRoutes`; redundant direct registration was removed after CI exposed duplicate Fastify routes. Actual defect fixed: onboarding auth handlers now pass the separate session pool. Exact-head CI #4416 / run `41338701474` has passed migration validation, full migration, typecheck, build, browser smoke and all unit/PostgreSQL tests; container build still in progress.
- PR #201 exact-head CI #4390 / run `41337852165` **PASS**.
- Production unchanged; PRs #200, #201, #202 remain draft pending independent security review and controlled integration. Production release HOLD.
