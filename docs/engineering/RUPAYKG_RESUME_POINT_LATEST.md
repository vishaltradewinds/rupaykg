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

## 2026-11-02 unified RLS foundation integration
- PR #200 is now the controlled RLS foundation branch: canonical AuthContext token helper + single-org/bilateral-safe transaction wrapper + PR #201's restricted-owner database verifier migration + PostgreSQL verifier integration tests + CI-only restricted-owner provisioning + DBA documentation.
- PR #199 closed unmerged as superseded by #200 after its token helper/tests were consolidated and the simpler transaction wrapper was replaced by the stronger PR #200 boundary.
- PR #201 exact-head CI #4390 passed independently. Its migration/test/workflow changes are now ported to PR #200; do not merge PR #201 separately. Combined exact-head CI #4421 / run `41338915697` passed migration validation, CI-only restricted-owner provisioning and full migrations; typecheck was running at last check. The combined checkpoint commit `aa7f4b25990150fb8cdda6636446401797326a8d` will trigger/has a subsequent exact-head CI run.
- PR #202 latest code CI #4416 / run `41338701474` **PASS** across dependency audit, migration validation, migrations, typecheck, build, browser smoke, all tests and production container build. It isolates session verification behind a restricted auth pool and passes that pool into the onboarding auth handlers.
- PRs #200 and #202 remain draft. Independent security review, integrated-base CI, production DBA provisioning/secret approvals and all-table RLS route coverage remain open.
- Production Neon remains unchanged; no production DDL/DML, migration, role/grant/RLS change, deployment, worker activation or certification. Release HOLD; TRL 9 not established.

## 2026-11-02 unified authentication + RLS integration spine
- Canonical branch is PR #192 `shakti/auth-bootstrap-application-integration-2026-11-01`; checkpoint `docs/engineering/checkpoints/2026-11-02-unified-auth-rls-foundation.md`.
- Ported PR #200's canonical AuthContext token helper, transaction-scoped `app.request_context` wrapper, rollback/connection-discard logic, signed-context verifier migration and PostgreSQL tests into PR #192.
- CI now provisions `rupaykg_security_definer` only in disposable PostgreSQL before migrations; production role provisioning remains a DBA/founder approval gate.
- PR #199 closed unmerged as superseded by #200. PR #200 and #201 are to be closed as superseded only after combined PR #192 exact-head CI passes. PR #202 is an alternate/incomplete auth-pool design and duplicates PR #192's existing comprehensive `auth_private` lifecycle; do not merge it.
- Standalone RLS foundation CI #4421/#4422 passed; standalone verifier CI #4390 passed; PR #202 CI #4416 passed but is not canonical.
- Canonical PR #192 combined head `820be17cb4d39fc0eb6546954515f80200e6669d`; exact-head CI #4433 / run `41339529203` IN PROGRESS. Checkpoint commit `2da35440f9ca642dd8c14d359355ea2425cc83cc` triggers a follow-up exact-head run.
- Read-only production Neon recheck: 67 public tables, 0 RLS enabled, 0 FORCE RLS; 92 applied migrations, latest `20261021`; `rupaykg` remains elevated owner; signed-context schema/function absent. Production unchanged.
- Remaining P0: one lifecycle integration fixture directly inserts a VERIFIED ordinary membership and now correctly fails the approved-application guard. Replace via real onboarding + two-person authority bootstrap; implement draft bootstrap only with synthetic CI identities/secrets. Founder must approve two distinct initial authority identities and the external two-secret custody ceremony before production execution.
- No production DDL/DML, migrations, role/grant/RLS changes, branch operations, deployment, worker activation or certification. Production release HOLD.

## 2026-11-02 duplicate PR closure and bootstrap gate
- PRs #199, #200, #201 and #202 are now CLOSED UNMERGED. Their useful canonical RLS components from #199–#201 are integrated into PR #192; #202's alternative `public.verify_identity_session` auth stack was superseded by PR #192's existing `auth_private` lifecycle. No duplicate security branches should be reopened or merged.
- Combined PR #192 CI #4434 / run `41339569733` applied `20261101_signed_request_context_verifier.sql` and passed the transaction-local context, signed-token and database-verifier tests. Overall test suite still fails one `lifecycle-integration.test.ts` fixture because it directly inserts a VERIFIED membership without an approved application. The platform-admin PostgreSQL fixture also still disables the membership trigger for bootstrap; this must be replaced.
- Issue #195 updated with the proposed two-identity/two-custodian/two-secret bootstrap model. It is not executed. Founder approval of two distinct initial authority identities and the out-of-band custody ceremony is indispensable before production bootstrap; synthetic CI implementation/testing may proceed as draft only.
- Latest PR #192 code head remains `820be17cb4d39fc0eb6546954515f80200e6669d`; later commits are checkpoint/resume documentation only. PR remains draft and production release HOLD.


## 2026-11-02 migration-validator correction
- Rechecked canonical PR #192 current head fdf24e18aa4d03e76295ba878f4af27c60b0e059; exact-head CI run #4442 / 41341038683 failed at npm run validate:migrations, so migration provisioning, migration execution, typecheck, build, bootstrap exercise, tests and container build were skipped.
- Root cause identified in scripts/validate-migrations.mjs: the CREATE TABLE/TYPE regex captured only the first identifier. For schema-qualified objects such as bootstrap_private.bootstrap_ceremonies and bootstrap_private.bootstrap_claims, it treated the schema name as the object name and falsely reported a duplicate. This validator defect is independent of SQL execution.
- Corrected the validator in commit 384d84dce411e8491fde7da9ecaa42a2afbf4ac6 to parse optional schema-qualified names and compare canonical schema.object identities (defaulting unqualified objects to public).
- Current PR #192 head is 384d84dce411e8491fde7da9ecaa42a2afbf4ac6. Exact-head CI has not yet been observed; do not claim the fix passes until the new run completes.
- The two-custodian bootstrap SQL and synthetic CI exercise are draft-only. Founder selection of two distinct initial authority identities, independent custodian/secret custody approval, independent security review and DBA approval remain required for any production ceremony. No production changes or deployment.


## 2026-11-02 PostgreSQL bootstrap migration syntax repair
- Canonical PR #192 CI run #4445 / 41395807273 passed dependency audit and the corrected schema-qualified migration validator, then failed during disposable PostgreSQL migration execution at `20261102_platform_authority_bootstrap.sql` with PostgreSQL 42601 syntax error near `THEN` (character 23252). All later CI stages were skipped.
- Inspection found `public.prevent_direct_membership_activation()` had been corrupted by a partial/duplicated merge: the UUID-regex `IF` statement was cut off, and the remainder of the bootstrap exception block was appended after the function terminator, producing `$$; then`.
- Replaced the entire trigger function with a complete, structurally valid PL/pgSQL implementation: strict UUID-format check, bootstrap-owner identity check, locked CONSUMING singleton/ceremony binding, two distinct unconsumed custodian claims, and unchanged ordinary application + reserved-role dual-control guards.
- Fix committed to canonical PR #192 branch as `b1dc9d103e56351d499b1b6a4b7f1181ff80a4b4`. Exact-head CI has not yet been observed; do not claim migration or bootstrap acceptance until it completes.
- No production DDL/DML, role/grant/RLS changes, branch operations, deployment or bootstrap ceremony. Production remains HOLD; founder and DBA approval gates unchanged.


## 2026-11-02 bootstrap CI defect and repair
- CI run #4446 / `41396017085` tested SQL repair commit `b1dc9d103e56351d499b1b6a4b7f1181ff80a4b4`. Migration validation, dependency audit, full disposable PostgreSQL migration, TypeScript typecheck and build all **PASS**. Bootstrap acceptance then **FAILED**: both concurrent finalizers failed because the migration inserted `public.roles.description`, a column absent from the live schema. PostgreSQL logs identified the exact error; the assertion consequently observed 0 successful finalizers rather than 1.
- Corrected `migrations/20261102_platform_authority_bootstrap.sql` to insert only `organization_id,name,permissions` into `public.roles`, and renamed PL/pgSQL output variables to `v_organization_id` / `v_role_id` to avoid collisions with SQL column names in UPDATE/INSERT statements. Corrected audit payload and immutable audit-row insert to bind the newly created organization ID explicitly.
- Repair commits: `0494e834149734c83dfc3d141f05cbbd7f14bad7` (schema-aligned role insert and variable qualification), `7500aa3fe4ca713840cc935a6473702a01a02cd9` (audit binding correction). Latest PR #192 head at checkpoint: `7500aa3fe4ca713840cc935a6473702a01a02cd9`; PR remains open/draft. No CI run for this exact head was visible at the time of this checkpoint; verify Actions before relying on it.
- Next: run exact-head CI and continue repairing only from disposable PostgreSQL evidence. After bootstrap test passes, complete all later acceptance/browser/container gates and audit negative cases, including replay, expired/missing token, unauthorized role grants, concurrent attempts, and runtime inability to execute bootstrap.
- Production remains HOLD. No production DDL/DML, migration, role/grant/RLS change, secret provisioning, deployment, worker activation or certification was performed. Founder identity/trust-model approval, independent security review, and DBA approval remain outstanding.


## 2026-11-02 membership-trigger search-path defect and repair
- CI #4449 / run `41396269748` tested role-schema correction commit `7500aa3fe4ca713840cc935a6473702a01a02cd9`. Migration validation, dependency audit, restricted-owner provisioning, full disposable PostgreSQL migration, typecheck and build **PASS**. Two-custodian acceptance **FAILED** at membership insert: existing `public.enforce_verified_membership_role_permissions()` used unqualified `FROM roles`; bootstrap SECURITY DEFINER function correctly sets `search_path = pg_catalog, pg_temp`, so PostgreSQL raised `relation "roles" does not exist`. Both concurrent finalizers rolled back; no bootstrap succeeded.
- Root cause traced to `migrations/030_authorization_role_defaults.sql`. Added a replacement definition to `migrations/20261102_platform_authority_bootstrap.sql` that retains locked `search_path = pg_catalog, pg_temp` and explicitly reads `public.roles`; it preserves the original verified-membership rule requiring a nonempty JSON-array permission set. This fixes resolution without adding `public` to a SECURITY DEFINER search path.
- Repair commit: `bfae544fa5afa3472bb1c07c4d8a95678d3a0aea`. Exact-head CI was not yet visible at checkpoint update time; verify before treating repair as validated.
- Production remains HOLD; no production mutation or secret/role provisioning performed.


## 2026-11-02 — CI #4454 follow-up

- Latest auth bootstrap head at CI start: `456d3c07454890ffbda135de45b5a2c553102746`.
- CI run #4454: https://github.com/vishaltradewinds/rupaykg/actions/runs/41396879799
- Passed migration validation, disposable PostgreSQL migration, restricted verifier-owner provisioning, synthetic two-custodian bootstrap acceptance, typecheck, build, and browser smoke.
- Full API test suite failed because legacy integration fixtures directly insert ordinary `VERIFIED` memberships without a completed stakeholder application. Root error: `STAKEHOLDER_MEMBERSHIP_REQUIRES_APPROVED_APPLICATION`. 117 passed, 1 failed, 20 cancelled in the API workspace; inspect cancellations after fixture setup is repaired.
- Detailed analysis: `docs/engineering/PR192_CI_4454_FAILURE_ANALYSIS.md`.
- Next: add shared test fixture helper that uses pending application → all hierarchical approval steps → approved application via the synthetic CI super-admin → verified membership. Migrate every integration fixture, do not weaken production guards.
- PR #192 remains draft; production remains HOLD; no production DB operation occurred. Container build skipped because tests failed.

## 2026-11-02 — governed integration fixtures and multi-organization onboarding

- CI #4454 root cause was a legacy settlement verifier fixture directly inserting a VERIFIED membership. Subsequent TAP evidence identified the same unsafe pattern in lifecycle, registry/settlement runtime, general runtime acceptance, and settlement credential guard fixtures.
- Shared helper: `apps/src/test-support/approved-membership.ts`. It performs PENDING application → hierarchical approvals by synthetic CI super-admin → APPROVED application. Fixtures insert membership only after the helper succeeds.
- Multi-org model defect fixed: approved applications were incorrectly included in the one-active-application-per-identity constraint and auth onboarding function's APPLICATION_EXISTS check. Approved applications are durable evidence, not pending requests. Updated unmerged `20261026_auth_scoped_onboarding_mutations.sql` to block only PENDING duplicates and added `migrations/20261103_stakeholder_multi_org_approved_memberships.sql` to enforce one pending request while permitting multiple approved org memberships.
- Append-only registry ledger cleanup corrected: immutable registry events and their linked test graph remain in disposable CI PostgreSQL; no test cleanup deletes or rewrites them.
- Latest code head at CI #4475: `fc02d4982dc659e6bd8a69cfe4f5eaf906752331`; run https://github.com/vishaltradewinds/rupaykg/actions/runs/41399039366.
- Passed migration validation, disposable PostgreSQL migration, restricted verifier owner provisioning, synthetic two-custodian bootstrap, typecheck, build, browser smoke, and full API/disposable PostgreSQL test suite. Production container build remains in progress; poll #4475 before claiming full CI green.
- PR #192 remains draft. Production remains HOLD. No production database migration, DDL/DML, grants, bootstrap, secrets, or deployment performed. Founder identity/trust model, independent security review, and DBA authorization remain release blockers.

## 2026-11-02 — bootstrap owner privilege teardown

- Security review found the migration principal's temporary membership in `rupaykg_bootstrap_owner` could otherwise remain after migration.
- Bootstrap migration now requires a direct temporary owner-role membership with ADMIN OPTION, rejects any additional owner-role members, revokes the migration principal's membership immediately after creating the SECURITY DEFINER objects, and revokes the owner's temporary database CREATE privilege.
- CI provisioning grants the temporary membership WITH ADMIN OPTION. Added a post-migration CI assertion that the migration principal is no longer a member of the owner role and the owner role no longer has database CREATE.
- CI #4479 passed all engineering gates on code head `3302c0ebc68cc7558d264e466423c11dd75f17fa`, including 138/138 API tests, two-custodian bootstrap acceptance, browser smoke, and production container build.
- Exact-head CI #4480 for the privilege-teardown assertion is running: https://github.com/vishaltradewinds/rupaykg/actions/runs/41399782645.
- PR #192 remains draft; production remains HOLD. No production database changes or deployment. Founder initial-authority selection, independent security review and DBA approval remain release gates.

## 2026-11-02 — corrected PostgreSQL privilege teardown assertion

- CI #4484 failed because `pg_has_role('postgres', 'rupaykg_bootstrap_owner', 'MEMBER')` reports effective superuser membership semantics, not only a direct role-membership grant.
- Corrected the assertion to query `pg_catalog.pg_auth_members` for the exact direct membership edge from `postgres` to `rupaykg_bootstrap_owner`. This checks the actual grant the migration revokes.
- Migration teardown remains: revoke migration principal's temporary owner membership and revoke owner's temporary database CREATE privilege.
- Commit: `3dd4b378ba3a43bacd37ef968d4e5d31bd078008`; CI #4485: https://github.com/vishaltradewinds/rupaykg/actions/runs/41400170361.
- Exact-head CI is validating. Do not promote or merge PR #192 until the assertion and all other gates pass. Production remains HOLD.


## 2026-11-02 — CI #4485 completed
- CI run #4485 / `41400170361` completed with overall conclusion **SUCCESS** on bootstrap privilege teardown fix commit `3dd4b378ba3a43bacd37ef968d4e5d31bd078008`.
- Passed dependency audit, migration validation, restricted verifier-owner provisioning, full disposable PostgreSQL migrations, bootstrap-owner temporary membership and database-CREATE privilege teardown assertions, synthetic two-custodian bootstrap acceptance, TypeScript typecheck, production build, browser smoke, full API/disposable PostgreSQL tests, and production-container build.
- The run validates its triggering code commit. Current PR head at checkpoint review is `90bdfa2e06b0539765bab5995c83caf6a3f9d223` (resume/checkpoint documentation update); verify a current-head workflow run before treating the latest documentation commit as fully CI-covered.
- PR #192 remains OPEN and DRAFT. Do not merge or deploy: broad API runtime compatibility, onboarding create/withdraw and hierarchical approval conversion, tenant/RLS coverage, independent security review, founder-approved initial authority identities/trust ceremony, and DBA authorization remain outstanding.
- Production Neon and live Render remain unchanged. No production DDL/DML, migration, role/grant/RLS change, bootstrap ceremony, secret provisioning, deployment, worker activation, or certification occurred. Production HOLD; TRL 9 not established.


## 2026-11-02 — Onboarding create/withdraw route isolation
- Replaced direct application-server INSERT/UPDATE transactions in `apps/src/auth-routes.ts` with calls to the existing `auth_private.create_stakeholder_application` and `auth_private.withdraw_stakeholder_application` SECURITY DEFINER functions through the dedicated auth runtime pool.
- Both mutation functions receive only the SHA-256 hash of the bearer token; database functions independently resolve the live, unrevoked, unexpired session and derive the identity. Caller-supplied identity IDs are not accepted.
- Removed the application-side role-permission construction and direct table writes. Geography validation, pending-duplicate protection, atomic creation, evidence persistence, and identity-scoped withdrawal now execute inside the database function transaction.
- Added Fastify route tests asserting hashed-token forwarding, expected database-function invocation, response behavior, and absence of direct DML in route queries.
- Commits: route change `2f52b09924bd64f539acdace2f4ae98c1d7ee774`; route tests `d0b605dce2eb49a11d1b6256d9dce5e0330e24d7`; regex assertion correction `66647ddb484e229d6b6735ac803ec1c4c995950a`.
- CI #4487 and #4488 passed all gates including container build. CI #4489 (route code commit) and #4490 (route test commit) were still running at checkpoint write; do not infer a pass until final workflow conclusions are confirmed.
- Remaining onboarding security scope: `apps/src/onboarding-hierarchy-routes.ts` still performs review-queue reads, legal verification writes, hierarchical approval/rejection writes, and authority checks through application-issued SQL. These need identity-bound database functions with least-privilege grants, explicit transaction/concurrency controls, and negative authorization tests. This work is NOT complete.
- PR #192 remains OPEN/DRAFT. No merge, production migration, role/grant/RLS change, live database mutation, deployment, or certification. Production HOLD; TRL 9 not established.


## 2026-11-02 — Onboarding route validation follow-up
- CI #4489 passed all gates on route implementation commit `2f52b09924bd64f539acdace2f4ae98c1d7ee774`.
- CI #4490 failed only in the newly added route unit tests: their regex assertions were over-escaped and did not match the valid `auth_private.resolve_session` SQL text. The implementation compiled, built, passed browser smoke and bootstrap acceptance; the test job caught the assertion defect.
- Corrected route assertions to explicit SQL string checks in commit `11402c42b854579ad4513e7cc8f8907262900e19`. CI #4491 passed all gates including disposable PostgreSQL acceptance and production-container build.
- CI #4492 is validating the current resume-checkpoint commit; browser smoke was in progress at last poll. Treat #4491 as the latest fully green validation of the route-test fix until #4492 concludes.
- Next route-isolation gate remains hierarchical review/legal verification: the review queue, legal verification, approval/rejection, authority checks and hierarchy-step writes in `apps/src/onboarding-hierarchy-routes.ts` still execute SQL directly through the application pool. Do not claim the onboarding security boundary is complete.
- No production operations were performed. PR #192 remains draft/open; production HOLD; TRL 9 not established.


## 2026-11-02 — exact-head bootstrap/onboarding CI green
- Canonical PR #192 head: `1f1b4f3a734183b37b7986ce4f908b2df4f763b5`; branch `shakti/auth-bootstrap-application-integration-2026-11-01`; PR remains OPEN and DRAFT.
- Exact-head GitHub Actions CI #4511 / run `41403690304`: **SUCCESS** on the exact head above. Passed dependency installation/audit, migration validation, restricted verifier-owner provisioning, full disposable PostgreSQL migrations, bootstrap-owner temporary-privilege teardown assertions, synthetic two-custodian bootstrap acceptance, TypeScript typecheck, API build, browser smoke, full API tests including disposable PostgreSQL acceptance, and production-container build.
- Latest migration correction: `public.ensure_organization_governance_profile()` is now a schema-qualified SECURITY DEFINER trigger owned by `rupaykg_auth_owner`, with pinned search_path and required narrow INSERT grant; it skips the internal `PLATFORM_AUTHORITY` organization because platform governance is not a regulated operating organization. CI asserts owner/security-definer properties and required grants. This is tested only in disposable CI PostgreSQL.
- Identity-bound onboarding create/withdraw and hierarchical review/legal verification/approve/reject operations now route through database SECURITY DEFINER functions using the SHA-256 hash of a live bearer session token; the database derives identity and enforces reviewer authority/geography scope and atomic row locking. This is a meaningful engineering integration milestone, not proof that every API module is compatible with least-privilege runtime grants.
- Resume next with a dedicated negative-authorization audit of hierarchical onboarding: unauthenticated, expired/revoked/suspended sessions; wrong geography; unauthorized reviewer; self-approval; wrong hierarchy step; duplicate/concurrent decisions; replay; immutable audit evidence; and proof app runtime cannot execute bootstrap. Then inventory all remaining direct auth/tenant-table access and complete 67-table RLS classification plus disposable tenant-isolation tests.
- Open P0 approval gates remain: founder must choose/verify two distinct initial authority identities and approve the out-of-band two-custodian/two-secret bootstrap trust ceremony; independent security review must assess owner/function grants, secret handling, trigger exception and audit evidence; DBA must approve the NOLOGIN owner/migrator and any one-time production secret. No production bootstrap.
- Production Neon remains the sole authoritative live DB; no production DDL/DML, migrations, role/grant/RLS changes, secret provisioning, or database branch changes were performed. Live Render remains on main commit `b5e91241d84a6712ff544d3deec1805702f45efd`; no deployment. Workers/schedulers remain OFF. Production certification OFF; provisional platform TRL 3; TRL 9 not established.


## 2026-11-02 — hierarchical onboarding authorization hardening (validation pending)
- After exact-head CI #4511 passed on `1f1b4f3a734183b37b7986ce4f908b2df4f763b5`, added fail-closed route tests for unknown/revoked session rejection, database-side expired/revoked session rejection, self-approval denial, and auth-runtime outage with no application-pool fallback. Test assertion escaping was corrected before validation.
- Security review of `migrations/20261104_identity_bound_hierarchical_onboarding.sql` identified that legal verification and PLATFORM-level review should not accept a matching role name from an arbitrary organization. Tightened review-queue visibility, legal verification, and PLATFORM-level approval to require a VERIFIED `PLATFORM_AUTHORITY` organization and an explicit `admin:users` permission. All reviewer memberships now also require their organization to be VERIFIED.
- Code changes are on canonical PR #192 head `19878ab557b1a793726b261401fd56b5684edb3b`. Exact-head CI #4515 / run `41404081100` is IN PROGRESS; do not claim these latest changes validated until it completes.
- Next security checks: database-level PostgreSQL negative tests for wrong-org platform role, missing `admin:users`, out-of-geography reviewer, duplicate/concurrent review, and role/session revocation between authentication and mutation; verify function ownership and grants remain restricted to `rupaykg_auth_owner` / `rupaykg_auth_runtime`. Then complete broader tenant/RLS inventory.
- Production remains HOLD and unchanged; no production DDL/DML, migration, role/grant/RLS change, secret provisioning, deployment, worker activation or certification. PR #192 remains draft; TRL 9 not established.


## 2026-11-02 — review-queue authorization parity and negative permission test (CI pending)
- Review of the full SQL found one remaining authorization parity defect: mutation and legal-verification functions required a VERIFIED PLATFORM_AUTHORITY organization plus `admin:users`, but the review-queue `canReview` calculation still trusted role name alone. Corrected the queue calculation to use the same verified-organization and explicit-permission predicate; non-platform reviewers also require a verified organization and applicable geography scope.
- Extended disposable PostgreSQL acceptance to temporarily remove `admin:users` from the synthetic platform super-admin role and assert (a) the application disappears from the review queue and (b) legal verification is rejected; the test restores the exact original permission JSON before continuing.
- Changes: migration `20261104_identity_bound_hierarchical_onboarding.sql` commit `d796afacd38ab696250edf35eb3853f86acfdc6c`; acceptance test commit `434ec340357053df275a59bc8602a34a155f2138`.
- Exact-head CI #4518 / run `41405997954` is IN PROGRESS. Migration validation, disposable PostgreSQL and full acceptance have not yet been confirmed on this head. Previous exact-head CI #4516 passed all gates on `2a88c7c2`.
- Follow-on: add negative acceptance for a forged super_admin role in a non-platform organization and explicit geography-scope denial; verify review-queue visibility, not just mutation rejection. Then audit function grants, RLS/tenant coverage and direct table access. Do not close the issue or mark production-ready.
- Production Neon and Render remain unchanged; PR #192 remains draft/open; no production bootstrap/deploy/worker activation/certification. Provisional TRL 3; TRL 9 not established.


## 2026-11-02 — CI #4518 exact engineering-head result
- Exact code commit `434ec340357053df275a59bc8602a34a155f2138` completed GitHub Actions CI run `41405997954` with overall conclusion **SUCCESS**. The workflow job is completed successfully; this validates the code head, including the queue authorization-parity migration and PostgreSQL negative permission test.
- Verified acceptance: the synthetic platform authority loses queue visibility and legal-verification capability when `admin:users` is removed; the test restores the original permission JSON before continuing.
- PR #192 remains OPEN/DRAFT. The later resume-pointer documentation commit `bad25a40bddeb1268e659586b66fe326ec7e14ec` is docs-only; code validation above applies to `434ec340`.
- Next engineering gate: add disposable-PostgreSQL negative tests proving a role named `super_admin` in a non-`PLATFORM_AUTHORITY` organization cannot gain platform review queue visibility, legal verification or PLATFORM approval. Then test geographic-scope denial and revocation/concurrency boundaries. Do not bypass production triggers or weaken guards to make fixtures pass.
- Production Neon and live Render remain unchanged. No production DDL/DML, migration, role/grant/RLS change, bootstrap, secret provisioning, deployment, worker activation or certification. PR #192 remains draft; release HOLD; provisional TRL 3; TRL 9 not established.


## 2026-11-02 — forged platform-role negative test added
- Added disposable PostgreSQL acceptance in `apps/src/ci-platform-authority-bootstrap.ts` for a forged `super_admin` role name with `admin:users` permission inside an ordinary operator organization.
- The test asserts direct VERIFIED membership activation is rejected by the existing `RESERVED_ROLE_REQUIRES_DUAL_CONTROL` database guard; the ordinary-organization identity receives no platform review/legal-verification capability; and legal verification is rejected with `ONBOARDING_AUTHORITY_FORBIDDEN`.
- Test commit: `ec5273142094f6abbf7b17179ff579cf4e13f75e`.
- Exact commit CI #4521 / run `41407079696` is IN PROGRESS. Do not report the test as passed until PostgreSQL acceptance and the complete workflow conclude successfully.
- Next: add a geography-scope negative test using a valid, approved reviewer membership and a deliberately disjoint verified geography root; assert both queue visibility and decision mutation are denied. Then add concurrency/revocation tests and continue all-table RLS/runtime-access inventory.
- PR #192 remains draft/open. Production Neon and Render remain unchanged; no production database operations, bootstrap, secret provisioning, deployment, worker activation or certification. Production HOLD; provisional TRL 3; TRL 9 not established.


## 2026-11-02 — Full-codebase risk audit and accelerated execution plan
- Published `docs/engineering/RUPAYKG_FULL_CODEBASE_AUDIT_AND_EXECUTION_PLAN_2026-11-02.md` (commit `cf4169658ff30c16b96aa1d406fa95e24bc1719a`).
- Audited PR #192's 54 changed files and current API/auth/security/infra/migration surface, plus existing auth compatibility, tenant isolation, disposable lab and TRL evidence. This is a broad initial risk audit; final line-by-line coverage of every package, historical migration, frontend path and worker remains an explicit inventory gate.
- P0 findings: production remains 0/67 RLS and broad owner role; signed request-context transaction wrapper is not integrated across route SQL; proposed restricted app runtime is not yet compatible with direct SQL in platform-admin and multiple business routes; platform authority production bootstrap still requires founder identity selection, independent review and DBA approval.
- Current branch source inventory still shows direct SQL call sites in platform-admin, server, value, registry, sync, workspace, CPCB, MRV, intelligence and evidence routes. Do not enable RLS or cut over runtime roles before route/worker/grant matrix is complete.
- CI #4521 passed on forged-role negative-test code commit `ec5273142094f6abbf7b17179ff579cf4e13f75e`; this remains laboratory acceptance, not production certification.
- PR #192 remains OPEN/DRAFT; Render auto-deploy path tracks main. No production DDL/DML, grants, RLS, secrets, bootstrap or deployment performed.
- Execution order: complete route/worker inventory; finish auth/bootstrap negative tests; convert platform-admin and remaining direct authorization paths; integrate request transaction boundary; complete 67-table policy/FK matrix; exact-role disposable Neon; reconcile migration drift; external MRV/regulatory acceptance; calibrated field pilot; independent TRL assurance.
- Provisional system TRL remains 3. Indicative overall TRL 9 planning range 12–24+ months, contingent on pilot site, calibrated hardware, authorized integrations, sustained operations and independent evaluation. Not a commitment or certification.


## 2026-11-02 — Database-enforced geography scope acceptance test
- Added to `apps/src/ci-platform-authority-bootstrap.ts` in commit `3e4d5bb6dc7a307ebf0f12643e4f8ae16045098e`.
- Disposable PostgreSQL fixture creates a synthetic state root, descendant district and out-of-scope state; asserts verified root authorizes descendant but not outside geography; inserts an in-scope activity and asserts the database trigger rejects out-of-scope activity.
- This closes a concrete negative-test gap for the existing `organization_has_geography_scope` and activity trigger. It does not yet test route-level queue scope decisions, resource-flow source/destination guards, or prove the scope model for all approval levels.
- CI status for this exact commit has not yet been returned by the commit workflow/status endpoints; do not treat this change as validated until PR workflow jobs complete.
- No production database change. PR #192 remains draft. Next: run/poll exact-head CI, then test geography-scoped review queue/decision and resource-flow source/destination denial.


## 2026-11-02 — API SQL / tenant-context source inventory
- Added `docs/security/RUPAYKG_API_ROUTE_SQL_TENANT_CONTEXT_INVENTORY_2026-11-02.md` (commit `cbb93ddbcd4bd2e6ae137a543c07351b8a5055b7`).
- Static scan across 14 API/auth/route modules found 218 source lines with direct query/connect call patterns; request-context helper itself has 5 internal query/connect call lines but is not invoked by any of the 14 route/server/auth modules in this scan.
- Highest remediation concentration: platform-admin 49 call lines, value routes 36, evidence vault 27, sync 21, CPCB/SWM 19, MRV 15. Counts are triage indicators, not SQL statement counts or vulnerability counts.
- 0/14 scanned API route/server/auth modules use the signed RLS request helper. This substantiates the P0 route integration gap; no RLS enablement or runtime cutover until the complete route/worker contract is implemented and tested.
- Added prioritized remediation order and exact-role acceptance criteria to the inventory.
- CI #4526 run id `41408414934` was observed in progress on the resume checkpoint head; check latest PR head and exact-head run before claiming the geography acceptance test passed.
- No production change. PR #192 remains open/draft. Next: poll exact-head CI; then continue auth/geography negative tests and begin platform-admin route migration only after reviewing its full handler/function contract.


## 2026-11-02 — Geography fixture enum correction
- Reviewed the core geography enum against the new test fixture and caught that the schema uses `STATE_UT`, not `STATE`.
- Corrected both synthetic root/out-of-scope fixtures to canonical `STATE_UT` in commit `fe698f9821138f43f013c1b0631916058e574bb2` before treating the acceptance test as valid.
- The previous CI #4528 was running against the earlier fixture; it is not the final code state. Require a new exact-head run for `fe698f9` and poll through completion.


## 2026-11-02 — UI/UX audit checkpoint
- Preserved previous API SQL / tenant-context inventory and geography fixture correction in prior checkpoint entries.
- Added `docs/ux/RUPAYKG_UI_UX_DESIGN_AUDIT_AND_EXECUTION_PLAN_2026-11-02.md` in commit `448c999cf0dcea227014e0ee23c34ac92491d5b5`.
- Static UI audit reviewed `apps/web/index.html`, React `main.tsx`, primary/mobile CSS, role dashboard, stakeholder journey, citizen/farmer guided panel, field capture, offline operation queue, operating-context scripts and representative domain panels.
- P0 findings: landing navigation and its tab-controlled explanatory panels are both hidden by `minimal-stakeholder.css`; UI is split between React and independently mounted scripts with competing visual/context/navigation systems.
- P1 findings: uneven localization despite 23 language choices; partial/unverified accessibility; mobile floating-control overlap risk; offline queue lacks a demonstrated complete user recovery surface; context/organization orientation and dense technical forms need improvement.
- Report includes a national role-first UX architecture, batch execution plan, acceptance evidence and field validation requirements.
- Scope caveat: static source audit only; no live browser/device usability, WCAG certification, Lighthouse/axe, screen-reader or translation review. No UI code changed in this batch.
- Immediate next change: repair landing navigation/content visibility and add browser tests, then consolidate shell/context/navigation. Keep backend authorization and statutory authority boundaries unchanged.
- PR #192 remains open/draft; production database and deployment remain untouched.


### CI verification follow-up — 2026-11-02
- Exact-head CI run #4529 (`41408626206`) for geography fixture commit `fe698f9` completed SUCCESS.
- Exact-head CI run #4530 (`41408644879`) for resume checkpoint commit `b46088d` completed SUCCESS.
- Later documentation-only UI/UX audit and resume pointer commits have no workflow run returned; no application code was changed in those commits.


## 2026-11-02 — AI Studio theme comparative audit and adoption specification
- Compared current `rupaykg` UI against `rupaykg-aistudio` main (reference commit `c2380d6e0a8628588959cac43ff7a519acc0c07a`). Target inspected on canonical PR #192 branch before this docs update (head `080fad902456c0498b7c60cec743e72662ee2957`).
- Published `docs/ux/RUPAYKG_AISTUDIO_THEME_COMPARATIVE_AUDIT_AND_ADOPTION_SPEC_2026-11-02.md` in commit `8d2006be956d926021f802f0161adc85c1c40973`.
- Canonical visual target: reference exact tokens `#050505` page, `#151619` cards, `rgba(255,255,255,0.08)` borders, white primary text, 60% white muted text, 5% white glass, emerald `#10b981`; Inter body, Space Grotesk headings, JetBrains Mono metadata.
- Content target: public landing with Platform / Stakeholders / How it works / Compliance / Impact; Urban/Rural context selector; stakeholder journeys for Government, Waste & Recycling, Businesses/BWGs, Farmers/FPOs, Carbon/ESG and Regulators; four-step Record → Track → Verify → Report story; compliance boundary and evidence-first language. Full approved copy deck and authenticated navigation map are in the report.
- Preserve current target capabilities and security: Operations, MRV & Evidence, Compliance & EPR, Carbon & Value, Registry, Settlement, ESG/BRSR, Intelligence and governed Administration. Do not port the reference repo's older backend, DB/auth model, demo metrics or unverified credit claims.
- P0 UI defect reconfirmed: `apps/web/public/minimal-stakeholder.css` hides `.landing-nav` and `.landing-panel`; this prevents users reaching important public explanatory content. Repair with keyboard-accessible navigation/sections.
- This was a static comparative audit and specification only. No UI source, production DB, API, deployment or authorization behavior changed in this batch. PR #192 remains draft; production remains HOLD; TRL 9 not established.
- Next execution: fix landing navigation visibility and browser tests; establish canonical theme token stylesheet and apply to public/authenticated shell; then incrementally restyle shared components and workflows without changing API contracts or permission gates. Validate exact-head CI and browser/mobile behavior before any release.

## 2026-11-02 production Neon read-only re-verification
- Re-identified the Neon project `rupaykg-production-fresh` (`steep-mud-79906940`) and its sole authoritative production branch `main` (`br-restless-base-b44cip2h`), database `rupaykg`.
- Read-only catalog/SQL verification: 67 public base tables; 0 RLS-enabled; 0 FORCE RLS; 92 applied migrations, latest `20261021`; database owner `rupaykg`; production schemas `auth_private` and `app_security` absent.
- This confirms the production security gap remains open: no tenant isolation is enforced by PostgreSQL RLS on the production branch and the signed request-context verifier is not installed there.
- Several additional Neon branches were observed and classified as staging/rehearsal/lab branches. They are not authoritative production databases. No branch was deleted, reset, or mutated; destructive branch cleanup requires explicit approval and evidence/lineage reconciliation.
- Detailed evidence: `docs/engineering/checkpoints/2026-11-02-production-neon-readonly-reverification.md`.
- No production DDL/DML, migration, role/grant/RLS change, secret access, deployment, worker activation or certification. Production remains HOLD; system TRL 9 not established.

## 2026-11-02 first-pass production 67-table RLS policy matrix
- Queried live production `information_schema.columns` and foreign-key metadata read-only for all 67 public tables and published the structural ownership map in `docs/security/PRODUCTION_67_TABLE_TENANT_RLS_POLICY_MATRIX_DRAFT_2026-11-02.md`.
- Classified each table by direct tenant root, parent-derived child, bilateral/multi-party, identity/auth control plane, platform control plane, global reference, or system metadata.
- Identified critical parent-derived and bilateral edges including activities → measurements/evidence/verifications, reporting periods → BWG/ESG reports, field devices → sync envelopes/cursors/conflicts, payer/payee settlements, EPR issuer/recycler transfers, registry owner transfers and chain-of-custody actor/flow/activity links.
- This is a structural first pass, not a final RLS predicate or migration. Polymorphic source references, JSON ownership, triggers, function grants, dynamic SQL and worker/service principals remain to be mapped.
- Production baseline remains 0/67 RLS and 0/67 FORCE RLS. No production changes were made.
- Next: reconcile the table matrix with route/worker/SQL call sites and function/trigger ownership; validate parent equality and bilateral policies in disposable Neon using exact restricted roles before any RLS rollout.
- Additional read-only production role catalog: only non-system roles `cloud_admin` and `rupaykg` were visible. `cloud_admin` is SUPERUSER/BYPASSRLS; `rupaykg` is LOGIN/CREATEROLE/CREATEDB/BYPASSRLS. No dedicated least-privilege app/auth/migrator/function-owner roles are present. This is a P0 release blocker for RLS and production auth cutover.
- Release path rechecked: GitHub `main` head is `a3fecc0abd2c46549a201058d3963afc0e3a73c9`; Render `rupaykg` service auto-deploys commits to `main` and current LIVE deploy `dep-dbjo4dqvcj2c73f7bt00` runs that same commit. The prior auth-pool deploy `14b7356` failed and was superseded by the production-config revert. PR #192 must remain draft/unmerged until production auth pool, role grants, migration and secret setup are reviewed and release-ready.
## 2026-11-02 worker and sync runtime inventory
- Read-only repository and Render inventory found no first-class RupayKg background worker, queue consumer, cron/scheduler entrypoint or Render worker/cron service. Current sync implementation is API-driven via `apps/src/sync-routes.ts` with field/operation envelope, cursor and conflict tables.
- Detailed inventory: `docs/engineering/checkpoints/2026-11-02-worker-runtime-inventory.md`.
- Do not assume envelope tables constitute an operational queue consumer. Workers/schedulers remain OFF. If a separate worker is required, design a distinct least-privilege service principal, signed tenant context, lease/retry/dead-letter/idempotency/recovery tests and operational runbook before deploying.
## 2026-11-02 hierarchical reviewer authority and geography search-path hardening
- Fixed role-name spoofing: both review queue visibility and review mutation now require the reviewer organization type to match the authority tier (PLATFORM_AUTHORITY; regulator for STATE/DISTRICT; ULB or regulator for LOCAL geography kinds) in addition to role name and verified geography scope.
- Added disposable PostgreSQL acceptance for forged regulator role in a processing-facility org, real synthetic regulator onboarding, in-scope/out-of-scope queue visibility, denied out-of-scope decision, and DISTRICT → STATE → PLATFORM progression.
- Added migration `20261105_geography_scope_search_path_hardening.sql` after a test exposed unqualified `geography` references failing inside restricted search_path context. All geography helper/trigger table references are now explicitly schema-qualified and functions set `search_path=pg_catalog,pg_temp`.
- Checkpoint: `docs/security/2026-11-02-hierarchical-reviewer-authority-hardening.md`.
- Exact code head `6362242235ed7c1841d260f8d8f9321730fd79fd`, CI run `41432595295`; full disposable PostgreSQL acceptance passed; production container build was still in progress at checkpoint. Do not claim the entire workflow passed until completion.
- Follow-up: exact-head CI `41432595295` for `6362242235ed7c1841d260f8d8f9321730fd79fd` completed **SUCCESS**, including full disposable PostgreSQL acceptance and production container build. This remains PR-only engineering evidence, not production approval.
- Neon branch activity was classified: six lab/staging/rehearsal branches have compute endpoints and recent activity; retain pending evidence reconciliation. `shakti-prod-main-rehearsal-20261031` (`br-spring-lab-b4hqez2o`) is the only zero-compute/no-endpoint cleanup candidate. No branch deleted; Neon requires explicit user confirmation for destructive branch deletion.
## 2026-11-02 RLS request-context secret contract
- Extended production config to require `RUPAYKG_REQUEST_CONTEXT_SECRET` (minimum 32 bytes) and `RUPAYKG_REQUEST_CONTEXT_KEY_ID` (strict ID format); rejects either value under a `VITE_*` prefix to prevent client-bundle exposure.
- Added config tests, .env.example placeholders and Render `sync:false` secret declarations. No secret value has been generated or provisioned.
- Documented the separate `rupaykg_security_definer` owner, `app_security.request_context_keys`, narrow runtime verifier EXECUTE grant requirement and two-location secret custody/rotation procedure in `docs/security/PRODUCTION_AUTH_RUNTIME_ROLE_MANIFEST_2026-11-01.md`.
- Important: `withRlsRequestTransaction` remains unused by tenant-data routes; this configuration is a prerequisite only. Do not enable production RLS or grant the verifier function until route/worker transaction coverage, exact roles and tests are complete.
