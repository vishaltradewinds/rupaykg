# CTO session log — 2026-11-02

## Scope
Resumed from the latest RupayKg engineering state. Rechecked repository PRs, issue blockers, CI, Neon project/branches and the signed tenant-context verifier before making changes.

## Evidence and findings
- Canonical repository confirmed: `vishaltradewinds/rupaykg`; default branch `main`.
- Current tenant-isolation stack includes PRs #198–#201; all are separate drafts/branches and must not be blindly merged.
- PR #201's original migration was run on disposable Neon branch `br-red-salad-b4oqb4nx`. Catalog inspection found its SECURITY DEFINER function and key table were owned by `rupaykg`, a broad BYPASSRLS role. PUBLIC execute/key-table SELECT were denied and search_path was pinned, but the owner was still too privileged.
- PR #201 was corrected to require pre-provisioned `rupaykg_security_definer` with NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB, NOINHERIT, NREPLICATION and no outbound role memberships. It owns the schema, key table and verifier. CI provisions this role only in disposable PostgreSQL. Integration tests assert owner, flags, ACLs, fixed search_path and signature fail-closed cases.
- First corrected PR #201 CI #4388 failed because SET LOCAL ROLE remained active when the migration runner attempted to insert the migration ledger row. Added RESET ROLE at migration end; exact-head CI #4390 is running.
- PR #202 session-verification pool work was reviewed. CI #4389 failed on TypeScript because test source contained literal escaped newline sequences. Branch head advanced with the source correction; exact-head CI #4391 is running.
- Issues #195 (first platform authority bootstrap) and #196 (tenant isolation) remain open. Founder-approved identity/secret custody and independent security review remain gates.
- Neon authoritative production project remains `rupaykg-production-fresh`, production branch `br-restless-base-b44cip2h`. No production database writes, DDL, role/grant/RLS changes or branch operations were performed.

## Repository changes
- PR #201: restricted SECURITY DEFINER owner precondition, schema/table/function ownership, migration-local role reset, CI-only role provisioning, strengthened PostgreSQL integration assertions and checkpoint document `docs/engineering/checkpoints/2026-11-02-signed-context-verifier-owner-hardening.md`.
- Issue #196 updated with the owner-privilege finding and correction.
- PR #201 description updated with DBA prerequisites and release limitations.
- PR #202 current head includes correction of the malformed test source; CI is pending.

## Exact CI state at checkpoint
- PR #201 head `89b64981d6b7d1de4c78c8ffb68c70f7d74730db`, run #4390 / ID `41337852165`: IN PROGRESS.
- PR #202 head `698270155755ef6493ba9f8bcc5c3a62b3ab9f38`, run #4391 / ID `41337889844`: IN PROGRESS.
- Earlier PR #201 run #4388 failed on migration-ledger ownership; correction committed.
- Earlier PR #202 run #4389 failed TypeScript due literal `\\n` in test source; corrected on subsequent head.

## Safety / release
Production remains HOLD; certification OFF. No PR merged, no production deployment, no production DDL/DML, no production role/grant/RLS changes, no worker/scheduler activation, no external submission and no TRL 9 claim. Disposable Neon rehearsal was limited to additive schema creation; original test owner state remains in that disposable branch as evidence and was not destructively cleaned up.

## Next actions
1. Verify exact-head CI #4390 and #4391; fix any remaining failures.
2. Rehearse corrected PR #201 migration on a clean disposable PostgreSQL environment with the exact pre-provisioned NOLOGIN owner and migration-principal membership contract.
3. Review PR #202's auth verifier owner role, grant surface, and same-database pool assumptions; retain draft until independently reviewed.
4. Continue P0 two-identity bootstrap design/fixtures without selecting real identities or creating production secrets.
5. Keep the integration spine controlled; do not merge independent security PRs until combined-base CI and independent review pass.
6. Maintain production isolation HOLD until all 67 table policies, route/worker transaction coverage, runtime role separation, migration reconciliation, rollback and approval gates close.

## Additional auth-route integration work
- Discovered `auth-routes.ts` was not registered in production `server.ts`; added import and `registerAuthRoutes(app, pool, authPool)`.
- Changed onboarding handlers in auth-routes to use the separate auth session pool; auth-pool exceptions now fail closed with a 503 response.
- Added `apps/src/auth-routes.test.ts` route registration/fail-closed regression coverage.
- Added PR #202 checkpoint `docs/engineering/checkpoints/2026-11-02-auth-session-pool-security-assurance.md`.
- Latest PR #202 head `9cda4b65091f08b2a2c478322d9d72d4e54722a5`; exact-head CI #4408 / run `41338438338` in progress. PR #201 exact-head CI #4390 passed.
- Production still unchanged; both security PRs remain draft and unmerged.

## Route-registration audit correction
The first route-wiring conclusion was incorrect: `registerValueRoutes` already calls `registerAuthRoutes`, and the server passes `authPool` to `registerValueRoutes`. I removed the redundant direct registration after CI showed Fastify duplicate-route errors. The actual issue was that onboarding handlers in `auth-routes.ts` omitted `sessionPool`; corrected them to use the auth pool. CI #4408 also exposed an outdated error-message assertion in the parallel production-config test suite; current head updates that expectation. PR #202 current head `d67d597de1ada8f89cede1ff7c09fd9ca1627e47`; exact-head CI #4416 / run `41338701474` is in progress.

## RLS token/transaction consolidation
- Compared PR #199 and #200; their signed-token files/tests duplicated. Consolidated `createSignedRequestContextForAuth` and its tests into PR #200, added bilateral-scope rejection, and made `withRlsRequestTransaction` use the canonical helper.
- PR #200 uses the stronger transaction wrapper and supersedes PR #199's simpler wrapper. Closed PR #199 unmerged to remove duplicate implementations.
- PR #200 exact code CI #4414 passed all steps. Checkpoint/docs commit CI #4418 is in progress.
- PR #202 route-wiring audit correction: auth routes were already registered through `registerValueRoutes`; removed redundant direct registration. Actual onboarding defect was missing sessionPool argument, now corrected. PR #202 CI #4416 passed migrations, typecheck, build, browser smoke and full tests; container build still running.
- PR #201 exact-head CI #4390 passed all steps.
- No production changes. Release HOLD; independent security review and integrated-base assurance remain open.

## Unified RLS foundation batch
- Ported PR #201 database signed-context verifier migration, restricted owner provisioning workflow step, PostgreSQL integration tests and DBA documentation into PR #200.
- PR #200 now contains the canonical AuthContext-derived token helper, the stronger RLS transaction wrapper, database verifier and fail-closed tests. PR #199 was closed unmerged as superseded. PR #201 remains open but is no longer to be merged independently; close it only after combined PR #200 CI passes.
- PR #200 combined CI #4421 passed migration validation, restricted-owner CI provisioning and full migrations; typecheck was running. Checkpoint commit `aa7f4b25990150fb8cdda6636446401797326a8d`.
- PR #202 exact-head CI #4416 passed all checks including PostgreSQL tests and production container build. The onboarding auth handlers now use the separate session pool; the indirect auth-route registration was preserved (redundant direct registration removed).
- Updated the canonical resume pointer. No production database, roles, grants, RLS, deployments, workers or certification were changed.

## Canonical integration spine and production audit
- Compared PR #192 and PR #202. PR #192 already has the more complete `auth_private` lifecycle and separate auth runtime; PR #202's alternate `public.verify_identity_session` and direct credential-query design is not canonical. Do not merge #202.
- Ported PR #200's token helper, transaction wrapper, verifier migration and PostgreSQL tests into PR #192; CI now provisions the restricted verifier owner only in disposable PostgreSQL. PR #200/#201 remain separate until combined CI passes.
- Read-only Neon production audit reconfirmed 67 public tables, 0 RLS-enabled, 0 FORCE RLS; 92 migrations, latest 20261021; broad `rupaykg` owner; no signed-context schema/function in production.
- PR #192 pre-integration CI #4424 exposed one actual failing lifecycle fixture: direct VERIFIED ordinary membership insert rejected by the approved-application guard. This is correct security behavior; remaining dependent suites cancelled. A two-identity/two-secret bootstrap path is required for legitimate CI onboarding fixtures and first production bootstrap.
- Checkpoint: `docs/engineering/checkpoints/2026-11-02-unified-auth-rls-foundation.md`. Current combined PR #192 code head `820be17cb4d39fc0eb6546954515f80200e6669d`; CI #4433 in progress.
- Production unchanged; no production DDL/DML, migrations, roles, grants, RLS, branch ops, deployment or certification.

## Duplicate PR cleanup and bootstrap approval gate
- Closed PRs #199, #200, #201 and #202 unmerged. Their canonical RLS components from #199–#201 are integrated into PR #192; #202 was an alternate auth stack and is superseded by the existing auth_private lifecycle.
- Combined PR #192 CI #4434 applied the signed-context verifier migration and passed RLS transaction, token and database-verifier tests. One lifecycle fixture remains failing due direct VERIFIED membership insertion without approved application; platform-admin test fixture still disables the trigger. Both require the real two-person bootstrap and approved onboarding lifecycle.
- Updated issue #195 with a two-identity/two-custodian/two-secret bootstrap trust-model proposal. No identities or secrets were selected/provisioned. Founder approval and independent review remain required before production use.
- Latest PR #192 code head `820be17cb4d39fc0eb6546954515f80200e6669d`; docs-only follow-up commits recorded in resume pointer. Production remains unchanged.


## 2026-11-02 migration-validator correction
- Rechecked canonical PR #192 current head fdf24e18aa4d03e76295ba878f4af27c60b0e059; exact-head CI run #4442 / 41341038683 failed at npm run validate:migrations, so migration provisioning, migration execution, typecheck, build, bootstrap exercise, tests and container build were skipped.
- Root cause identified in scripts/validate-migrations.mjs: the CREATE TABLE/TYPE regex captured only the first identifier. For schema-qualified objects such as bootstrap_private.bootstrap_ceremonies and bootstrap_private.bootstrap_claims, it treated the schema name as the object name and falsely reported a duplicate. This validator defect is independent of SQL execution.
- Corrected the validator in commit 384d84dce411e8491fde7da9ecaa42a2afbf4ac6 to parse optional schema-qualified names and compare canonical schema.object identities (defaulting unqualified objects to public).
- Current PR #192 head is 384d84dce411e8491fde7da9ecaa42a2afbf4ac6. Exact-head CI has not yet been observed; do not claim the fix passes until the new run completes.
- The two-custodian bootstrap SQL and synthetic CI exercise are draft-only. Founder selection of two distinct initial authority identities, independent custodian/secret custody approval, independent security review and DBA approval remain required for any production ceremony. No production changes or deployment.
