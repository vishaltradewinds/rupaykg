# 2026-10-31 — BWG authenticated PostgreSQL HTTP acceptance batch

- Repository: `vishaltradewinds/rupaykg`
- Branch: `shakti/atomic-inbox-claim-2026-10-31`
- Implementation commit: `4730c7f86c82c49d6fa8eff7954af5f37d36aae2`
- File: `apps/src/value-routes.test.ts`
- CI status at checkpoint creation: no exact-commit PR workflow run returned yet. Do not claim this commit green until Actions reports the exact SHA.

## What was added
A CI-only integration test uses the real `pg.Pool`, the actual `registerValueRoutes` Fastify plugin, actual authentication/session lookup, actual tenant transaction, and disposable PostgreSQL created by the repository CI workflow. It is gated by `CI=true`, non-production `NODE_ENV`, `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1`, and `DATABASE_URL`.

Cases:
1. Verified member with no `reports:read`: BWG workspace GET must return 403 `BWG_WORKSPACE_READ_FORBIDDEN`.
2. Verified member with no profile-update permission: profile POST must return 403 `BWG_PROFILE_FORBIDDEN`.
3. PENDING membership: authentication does not treat it as a verified active organization; profile POST must return 403 `ORG_FORBIDDEN`.
4. Cross-organization request-body substitution: caller selects org A in authenticated request context but posts org B in body; profile POST must return 403 `ORG_FORBIDDEN`.
5. Geography denial: a profile writer submits a real disposable geography not in the organization's verified scope; profile POST must return 403 `GEOGRAPHY_FORBIDDEN`.
6. Assert denied cases do not create any BWG profile rows.
7. Unique UUID fixture records and hashed random session tokens; cleanup runs in finally. No live production database is referenced.

## Boundaries
- This is actual PostgreSQL HTTP integration coverage, not a mocked-pool test.
- It covers workspace-read and profile-intake authorization paths. It does not yet prove authenticated positive allow paths or all waste/EPR/ESG route permission combinations.
- The test has not been executed in this session; CI is the execution authority.
- No production data, schema, roles, grants, deployment, workers or scheduler were changed.

## Next
1. Confirm CI executes this exact commit and inspect any failing test output.
2. Correct test/schema/route issues in a coherent follow-up commit; preserve fail-closed behavior.
3. Extend DB-backed authenticated HTTP coverage to waste, EPR and ESG write permissions, verified evidence binding, period trigger and EPR constraint mappings.
4. Continue statutory applicability dual-control workflow and tenant-isolation work.
