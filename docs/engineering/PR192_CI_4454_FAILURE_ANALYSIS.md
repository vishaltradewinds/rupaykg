# PR #192 — CI #4454 failure analysis

Date: 2026-11-02

## Verified CI evidence

Run: https://github.com/vishaltradewinds/rupaykg/actions/runs/41396879799

Head commit: `456d3c07454890ffbda135de45b5a2c553102746`

Passed: migration validation, disposable PostgreSQL migration, restricted verifier-owner provisioning, synthetic two-custodian bootstrap acceptance, TypeScript typecheck, application build, and browser smoke test.

Failed: full API test suite. The failing integration fixtures directly insert `VERIFIED` ordinary memberships without first creating and completing a stakeholder application. The database correctly rejects those writes with `STAKEHOLDER_MEMBERSHIP_REQUIRES_APPROVED_APPLICATION`.

Known failing fixtures from the run:

- `apps/src/lifecycle-integration.test.ts` — verifier and unauthorized-reader memberships.
- `apps/test/settlement-reconciliation.test.ts` — verifier membership in the setup hook.

The resulting suite reported 117 passed, 1 failed, and 20 cancelled in the API workspace. Cancellation is downstream of the failed setup hook, not proof those 20 assertions independently failed.

## Corrective action

Update test fixtures to follow the real governed lifecycle: create a `PENDING` stakeholder application, complete every generated `stakeholder_application_approvals` step using a distinct synthetic platform authority, transition the application to `APPROVED`, then create the `VERIFIED` membership. CI already proves the synthetic two-custodian bootstrap can run in the disposable database before the tests.

Do not weaken or bypass the production membership trigger. Do not use `session_replication_role`, disable triggers, or direct `APPROVED` inserts as a test shortcut.

## Release posture

PR #192 remains draft. Production remains HOLD. No production database was touched. The production container build did not run because the test step failed.

## Next execution

1. Implement a reusable test-only helper for the pending → hierarchical approval → approved application sequence.
2. Migrate all DB integration fixtures that directly insert ordinary `VERIFIED` memberships, including the lifecycle, settlement-reconciliation, and registry-settlement runtime fixtures.
3. Run the complete CI suite; inspect all cancelled tests after setup is repaired.
4. Re-run the production container build and security review. Keep the PR draft until independent review and founder/DBA approvals are complete.
