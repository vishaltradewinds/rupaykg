# 2026-10-31 16:42 UTC — BWG authenticated HTTP acceptance implementation and CI correction

- Code commit: `0ea8bbce218c0a055feca8ae893acd91450e84a7`.
- Initial implementation commit: `4730c7f86c82c49d6fa8eff7954af5f37d36aae2`.
- The real PostgreSQL integration test was added to `apps/src/value-routes.test.ts` and is gated to disposable CI PostgreSQL only.
- Coverage: missing reports:read; missing profile-update permission; PENDING/unverified membership; request-body cross-organization substitution; geography denial when the organization has a different verified geography scope; assert no BWG profile writes on denied requests.
- Initial exact-SHA CI #3978 / run `41220707529` FAILED at typecheck due duplicate `Pool` import and using the type-only import as a runtime constructor. This was diagnosed from the job log and corrected in commit `0ea8bbce218c0a055feca8ae893acd91450e84a7` by consolidating to one runtime import.
- Exact-SHA CI #3982 / run `41220846345` is QUEUED for the corrected code commit. Do not call the corrected implementation green until this run completes.
- Checkpoint commit `a4718b832f302d73c7fe9a8c24c9c5ae069a933e` had CI #3979 / run `41220746319`, which also failed at the same typecheck stage because it captured the pre-fix implementation. The checkpoint itself contains no executable code.
- Geography fixture correction: `organization_has_geography_scope` returns true when an organization has no verified geography scopes. To test a true out-of-scope denial without changing application semantics, fixture now grants one separate verified geography and submits a different geography. This documents the existing permissive-default behavior for future security review.
- No local Desktop Commander execution. CI disposable PostgreSQL is the test authority.
- No production database writes, DDL, role changes, deployment or activation.

## Next
1. Inspect CI #3982 typecheck and integration test execution.
2. Fix any fixture/schema/assertion failures, then re-run exact SHA.
3. Review the permissive default of `organization_has_geography_scope` as a security design decision; do not change production behavior without a complete migration/backward-compatibility assessment.
4. Extend real DB-backed authorization tests to waste/EPR/ESG routes and evidence verification.
5. Continue P0 tenant isolation/RLS and least-privilege principal work.
