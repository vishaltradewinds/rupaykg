# RupayKg CTO Run 26 — verification tenant binding and geography correction

**Date:** 2026-11-04, from 07:28 UTC  
**Repository:** `vishaltradewinds/rupaykg`  
**Code PR:** https://github.com/vishaltradewinds/rupaykg/pull/247  
**Documentation PR:** https://github.com/vishaltradewinds/rupaykg/pull/244

## Exact code state
- PR #247 head: `ff75e989fcdef02cbb0719b8aaeb993e506c3a56`.
- PR #247 remains OPEN / DRAFT / UNMERGED.
- Exact-head CI #5367 / run ID `41794095914` completed SUCCESS; all stages passed, including disposable PostgreSQL acceptance for the new regressions.
- Documentation head `3926690892527584c0cc7e3397d4f2ae79000caf` passed exact-head CI #5368 / run ID `41794335224` SUCCESS.
- Candidate migration remains unapplied to every database.

## Changes in this run
1. Bind joined roles to their membership tenant in both `hasOrganizationPermission` and `canVerifyEvidence`.
2. Bind the verification database guard's role join to the same membership organization.
3. Add a malformed cross-tenant membership fixture: org-A membership references an org-B verifier role; direct REJECTED verification must fail.
4. Require a non-null activity geography in the verification database guard and call `organization_has_geography_scope`.
5. Add direct-DB rejection test for evidence whose activity has no geography.

## Local evidence
- Typecheck: PASS.
- Production build: PASS.
- Migration validation: PASS — 92 migrations / 73 schema objects.
- Focused auth unit tests: 5/5 PASS.
- Full workspace suite: 90 PASS, 8 SKIP, 1 FAIL (Windows CORS runtime child-process spawn exited before test assertion).
- PostgreSQL integration tests: SKIPPED locally; no DATABASE_URL and Docker unavailable. Exact-head CI is required to validate the new DB regressions.

## Open design constraints
- `organization_has_geography_scope` currently returns true when no VERIFIED geography roots exist. This permissive behavior remains a separate global fail-closed issue.
- SECURITY INVOKER row locks require UPDATE privilege on at least one column of each locked table. Do not grant broad UPDATE to the API role.
- Candidate design to test: dedicated NOLOGIN / NOBYPASSRLS guard role, narrow column-level UPDATE rights solely for row-locking, explicit RLS SELECT policies scoped by transaction-local guard context, SECURITY DEFINER trigger function with fixed safe search_path, no API membership/SET ROLE/EXECUTE exposure. This is not yet implemented or approved.
- Advisory-lock design is not accepted until mutation-side lock coverage and post-wait snapshot freshness are demonstrated under READ COMMITTED, with concurrency tests.

## Next execution gates
1. Inspect exact-head CI #5367 and resolve failures.
2. Prototype the dedicated guard role on disposable PostgreSQL with FORCE RLS and a non-owner API role.
3. Test positive/negative row visibility, function privileges, trigger execution, role cannot login/BYPASSRLS, cross-tenant denial and DELETE/tamper controls.
4. Reconcile the full role↔membership organization consistency surface and 67-table RLS/geography policy matrix.
5. Rehearse exact historical migration 096 function/trigger composition on a production-like disposable schema.
6. Obtain independent DBA/security review before any merge or deployment.

## Release posture
Production Neon remains READ-ONLY / HOLD. No production/staging SQL writes, migrations, grants, role/ownership changes, RLS activation, deployment, merge, worker activation or certification. PR #247/#244 remain draft/unmerged. SITE-JBP-01 remains PRE-VALIDATION. Production certification and TRL 9 are NOT ACHIEVED.
