# Unified authentication and RLS foundation checkpoint

**Date:** 2026-11-02  
**Canonical integration branch:** `shakti/auth-bootstrap-application-integration-2026-11-01`  
**Canonical PR:** #192  
**Production posture:** HOLD — no production changes

## Consolidated architecture
This branch is the controlled integration spine. It retains the more complete `auth_private` authentication lifecycle from PR #192 and now also includes the RLS foundation from PR #200:

- `createSignedRequestContextForAuth`: canonical HMAC token derivation from a verified single-organization AuthContext.
- `withRlsRequestTransaction`: one request-scoped PostgreSQL transaction, transaction-local `app.request_context`, explicit single-organization enforcement, bilateral-scope rejection, rollback/error handling and pooled connection discard on failure.
- `app_security.current_request_context_claims()`: database-side verifier for the signed tenant context.
- Restricted `rupaykg_security_definer` owner: NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB, NOINHERIT, NREPLICATION and no outbound role memberships.
- PostgreSQL integration tests cover valid/forged/expired/missing/unknown-key token behavior, PUBLIC denial, verifier owner, table ACLs and transaction behavior.
- CI provisions the restricted verifier owner only inside its disposable PostgreSQL service. Production DBA provisioning remains an external approval gate.
- Existing `auth_private` role/function design in PR #192 remains canonical for identity registration, login, session revocation and stakeholder onboarding. PR #202's alternate `public.verify_identity_session`/second auth owner design is not being integrated.

## Duplicate branch resolution
- PR #199 closed unmerged as superseded by PR #200.
- PR #200's token/transaction/verifier implementation has been ported to this canonical PR #192 branch.
- PR #201's verifier migration and tests have been ported to this canonical PR #192 branch.
- PR #202 is an alternate/incomplete auth-pool implementation and duplicates the more comprehensive `auth_private` lifecycle already in PR #192; it is not the canonical path. It should be closed as superseded only after this branch's combined CI and review.
- PRs #200 and #201 should likewise be closed as superseded only after this branch's combined CI passes.

## Exact verification
- Previous standalone PR #200 combined RLS foundation CI #4421 / run `41338915697`: PASS.
- Follow-up PR #200 checkpoint CI #4422 / run `41338967311`: PASS.
- PR #201 standalone verifier CI #4390 / run `41337852165`: PASS.
- PR #202 auth-pool CI #4416 / run `41338701474`: PASS, but its design is superseded by the existing `auth_private` lifecycle in PR #192.
- Canonical PR #192 now includes the consolidated RLS foundation. Current head `820be17cb4d39fc0eb6546954515f80200e6669d`; exact-head CI #4433 / run `41339529203` is IN PROGRESS.

## Remaining P0 blocker
CI on the pre-integration PR #192 head showed one actual lifecycle fixture failure: `lifecycle-integration.test.ts` directly inserted a VERIFIED ordinary membership, correctly rejected by the approved-application trigger. The remaining dependent suites were cancelled after that failure. The fixture must be updated through the genuine application approval lifecycle. Because no platform authority exists yet, a two-identity, two-secret, single-use bootstrap function is required for CI and first production bootstrap.

## Founder approval boundary
The bootstrap implementation may be prepared and tested with synthetic identities/secrets in CI, but production execution requires the founder to select two distinct initial authority identities and approve the out-of-band identity-verification and two-secret custody ceremony. No real identity IDs, secrets or production claims are selected or provisioned here.

## Production safety
The authoritative Neon production branch was rechecked read-only:
- 67 public tables; 0 RLS-enabled; 0 FORCE RLS.
- 92 applied migrations; latest version `20261021`.
- `rupaykg` remains a broad owner role with elevated privileges.
- `app_security` and the signed-context verifier do not exist in production.
No production DDL/DML, migrations, role/grant/RLS changes, branch operations, deployments, worker activation or certification were performed.

## Next actions
1. Verify exact-head CI #4433, especially the integrated signed-context migration and test suite.
2. Implement the two-identity/two-secret bootstrap function and trigger exception only as a draft with synthetic CI secrets; obtain independent security review.
3. Replace remaining direct VERIFIED-membership fixtures with the approved onboarding lifecycle.
4. Integrate the RLS transaction wrapper into all route and worker query boundaries only after signed verifier, role contracts and table-policy mapping are reviewed.
5. Complete the 67-table policy matrix and migration reconciliation.
6. Keep production HOLD until founder approval, independent security review, disposable acceptance, all-table policy coverage, route/worker coverage, rollback and release gates pass.


## 2026-11-02 migration-validator correction
- Rechecked canonical PR #192 current head fdf24e18aa4d03e76295ba878f4af27c60b0e059; exact-head CI run #4442 / 41341038683 failed at npm run validate:migrations, so migration provisioning, migration execution, typecheck, build, bootstrap exercise, tests and container build were skipped.
- Root cause identified in scripts/validate-migrations.mjs: the CREATE TABLE/TYPE regex captured only the first identifier. For schema-qualified objects such as bootstrap_private.bootstrap_ceremonies and bootstrap_private.bootstrap_claims, it treated the schema name as the object name and falsely reported a duplicate. This validator defect is independent of SQL execution.
- Corrected the validator in commit 384d84dce411e8491fde7da9ecaa42a2afbf4ac6 to parse optional schema-qualified names and compare canonical schema.object identities (defaulting unqualified objects to public).
- Current PR #192 head is 384d84dce411e8491fde7da9ecaa42a2afbf4ac6. Exact-head CI has not yet been observed; do not claim the fix passes until the new run completes.
- The two-custodian bootstrap SQL and synthetic CI exercise are draft-only. Founder selection of two distinct initial authority identities, independent custodian/secret custody approval, independent security review and DBA approval remain required for any production ceremony. No production changes or deployment.
