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
