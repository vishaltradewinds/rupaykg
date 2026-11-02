# Disposable Neon rehearsal — geography fail-closed and verifier scope migrations

**Date:** 2026-11-02  
**Branch:** `rupaykg-rls-assurance-lab-20261101` (`br-red-salad-b4oqb4nx`)  
**Project:** `steep-mud-79906940`  
**Database:** `rupaykg`  
**Production branch:** untouched.

## Scope

Rehearsed the candidate SQL definitions corresponding to PR #213 migrations:
- `20261105_geography_scope_search_path_hardening.sql`
- `20261106_verifier_same_org_geography_scope.sql`
- `20261107_verifier_subject_org_verified.sql`
- `20261108_geography_scope_fail_closed.sql`

Applied only function replacements on the disposable lab branch using a single transaction. The production primary branch was not used. No production data, migration ledger, role, grants, secrets, deployment or worker state was changed.

## Observed results

- All seven function replacements completed successfully in the lab transaction.
- `organization_has_geography_scope(random_org, random_geography)` returned FALSE when no VERIFIED scope row exists.
- `has_verification_permission_for_activity(random_identity, random_activity)` returned FALSE for an unknown activity.
- `organization_has_geography_scope` and `prevent_invalid_verification` both show pinned `search_path=pg_catalog, pg_temp`.
- The existing `enforce_verification_independence()` function remains unchanged and still checks VERIFIED membership globally without an organization predicate.
- The lab branch had zero organization and zero activity rows at test time; therefore this was a missing-context / fail-closed smoke test, not a complete two-tenant positive/negative integration test.
- The branch already contained one RLS-enabled public table (`epr_returns`) from prior lab work; do not describe it as a pristine branch. The test changed only the listed functions.

## Acceptance still required

1. Seed two synthetic organizations, two geographies, verified/pending scopes, activities, identities, memberships and roles inside a disposable transaction or isolated fixture schema.
2. Prove same-organization verifier succeeds only for verified subject organization and verified matching/ancestor geography.
3. Prove foreign-organization-only membership, pending membership, suspended identity, unverified organization, missing geography, pending geography, and self-verification all fail.
4. Decide whether non-approved verification rows may be created by cross-organization verifiers; align `enforce_verification_independence()` with the approved-decision policy if not.
5. Verify all trigger functions under the proposed NOBYPASSRLS runtime role and the actual signed request context.
6. Run candidate migrations via the repository migration runner against a fresh disposable production snapshot and capture exact migration ledger parity; the direct function rehearsal does not replace migration-runner CI.

## Decision

Candidate function behavior is directionally correct for missing geography and unknown subject activity. This is not a release pass. Production remains READ-ONLY / HOLD. Keep EPR route OFF, worker OFF, certification OFF.
