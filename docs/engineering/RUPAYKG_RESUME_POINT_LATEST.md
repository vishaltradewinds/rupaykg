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
