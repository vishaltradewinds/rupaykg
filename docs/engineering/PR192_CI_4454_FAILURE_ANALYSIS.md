# PR #192 — CI #4454 failure analysis

Date: 2026-11-02

## Verified CI evidence

Run: https://github.com/vishaltradewinds/rupaykg/actions/runs/41396879799

Head commit: `456d3c07454890ffbda135de45b5a2c553102746`

Passed: migration validation, disposable PostgreSQL migration, restricted verifier-owner provisioning, synthetic two-custodian bootstrap acceptance, TypeScript typecheck, application build, and browser smoke test.

Failed: full API test suite. The actual failing test hook was isolated to `apps/test/settlement-reconciliation.test.ts` (line 33 in the compiled test). The hook directly inserted its verifier membership without first creating and completing a stakeholder application. The database correctly rejected that write with `STAKEHOLDER_MEMBERSHIP_REQUIRES_APPROVED_APPLICATION`.

The other database error-log entries in CI #4454 were not proven test failures; some are expected negative-path assertions. Do not classify unrelated fixtures as failing without their TAP results.

The API workspace reported 117 passed, 1 failed, and 20 cancelled. The 20 cancellations were downstream of the failed setup hook, not proof those assertions independently failed.

## Corrective action

Update test fixtures to follow the real governed lifecycle: create a `PENDING` stakeholder application, complete every generated `stakeholder_application_approvals` step using a distinct synthetic platform authority, transition the application to `APPROVED`, then create the `VERIFIED` membership. CI already proves the synthetic two-custodian bootstrap can run in the disposable database before the tests.

Do not weaken or bypass the production membership trigger. Do not use `session_replication_role`, disable triggers, or direct `APPROVED` inserts as a test shortcut.

## Release posture

PR #192 remains draft. Production remains HOLD. No production database was touched. The production container build did not run because the test step failed.

## Next execution

1. Implemented a local fixture helper in `apps/test/settlement-reconciliation.test.ts` that locates the synthetic CI super-admin, creates a `PENDING` stakeholder application, approves every generated hierarchical step with that distinct authority, transitions the application to `APPROVED`, and then permits the verifier membership insert.
2. Commit: `388673cbc28640fe36d4916373449991e4922851`.
3. Exact-head CI run #4457: https://github.com/vishaltradewinds/rupaykg/actions/runs/41397360029 — in progress at the time of this checkpoint. Typecheck, migration validation, disposable migration and synthetic bootstrap provisioning had passed; full test suite had not yet completed.
4. After CI, inspect any remaining cancelled tests, then re-run the production container build and security review. Keep the PR draft until independent review and founder/DBA approvals are complete.

## Follow-up repairs and exact-head verification — 2026-11-02

The subsequent CI runs exposed additional legacy test fixtures and one genuine onboarding-model defect. These were repaired without weakening database authorization:

- Added shared test helper `apps/src/test-support/approved-membership.ts`. It locates the synthetic CI super-admin, creates a PENDING application, approves every generated hierarchical approval step using that distinct authority, and leaves membership insertion to the fixture.
- Migrated the lifecycle, registry/settlement runtime, general runtime acceptance, settlement reconciliation, and settlement credential guard fixtures to the governed application lifecycle.
- Added an explicit verifier-permission assertion in the lifecycle test and inserted both actor/verifier memberships only after their approvals.
- Fixed multi-organization onboarding: approved applications are durable approval evidence and must not block a verified identity from joining another organization. Updated the unmerged auth onboarding migration to reject only an existing PENDING application, and added `migrations/20261103_stakeholder_multi_org_approved_memberships.sql` to keep the one-pending-application-per-identity unique index while allowing multiple APPROVED applications. This is necessary for the product's multi-organization access and bilateral settlement model.
- Removed cleanup attempts that tried to delete append-only registry events. Their linked test ledger graph is retained only in disposable CI PostgreSQL, which is destroyed at workflow end.
- Corrected destination-owner fixture permissions to include the explicit retirement permission.

Latest exact-head CI #4475: https://github.com/vishaltradewinds/rupaykg/actions/runs/41399039366
Head: `fc02d4982dc659e6bd8a69cfe4f5eaf906752331`

Passed: dependency audit, migration validation, restricted verifier-owner provisioning, disposable PostgreSQL migrations, synthetic two-custodian bootstrap acceptance, typecheck, build, browser smoke, and full API/disposable PostgreSQL acceptance. The production container build is still running at the time of this update. Do not call the PR fully green until that final step completes.

## Bootstrap owner privilege teardown — 2026-11-02

Security review identified that the migration principal's temporary membership in `rupaykg_bootstrap_owner` must not persist after setup. The migration now requires a direct temporary membership with ADMIN OPTION, requires that no other principal is a member of the owner role, and revokes the migration principal's membership immediately after the SECURITY DEFINER objects are created. The owner role's temporary database CREATE privilege is also revoked.

CI #4479 passed all gates, including 138/138 API tests, two-custodian bootstrap acceptance, browser smoke and production container build, on code head `3302c0ebc68cc7558d264e466423c11dd75f17fa`.

A further CI assertion was added in `.github/workflows/ci.yml` to verify that neither the migration principal's owner-role membership nor the owner's database CREATE privilege remains after migration. Exact-head CI #4480 is running; do not call that additional assertion verified until it passes.
