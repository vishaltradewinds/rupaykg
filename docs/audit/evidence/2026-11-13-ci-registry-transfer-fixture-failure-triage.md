# CI Failure Triage — Registry Transfer Fixture

**Date:** 2026-11-13  
**Repository:** `vishaltradewinds/rupaykg`  
**Pull request:** [#355](https://github.com/vishaltradewinds/rupaykg/pull/355)  
**Failed run:** [43432177574](https://github.com/vishaltradewinds/rupaykg/actions/runs/43432177574)  
**Fix commit:** `0762e195d30a50ef7b56c591b774f8b9e6c1bc26`

## Observed failure

The `validate` job passed dependency audit, migration validation and application, SECURITY DEFINER boundary acceptance, isolated-owner membership guard, TypeScript typecheck, production build and browser smoke test. It then failed in the `registry and settlement runtime acceptance` suite:

- Subtest: `requires current-owner transfer permission and permits governed retirement`
- Expected HTTP status: `200`
- Actual HTTP status: `503`
- Database error: `Registry transfer destination must be a verified organization`

## Root cause

The positive-path integration fixture created its destination PROCESSOR organization without explicitly setting its status to `VERIFIED`. The database transfer guard correctly rejected that destination because an unverified organization must not receive a registry credential.

This is a fixture precondition defect, not evidence that the production guard should be weakened.

## Change made

In `apps/src/registry-settlement-runtime.test.ts`, the destination organization fixture now explicitly inserts `status='VERIFIED'`. No production route, database guard, migration, runtime credential or production data was changed.

## Validation state

The fix was committed to the candidate branch as `0762e195d30a50ef7b56c591b774f8b9e6c1bc26`.

At the time this evidence was recorded, GitHub had not yet reported a workflow run or status for the fix commit. Therefore:

- The root cause is evidenced by the failed test assertion and PostgreSQL error.
- The fixture correction is committed.
- The fix is **not yet CI-validated**.
- The failed run's downstream rollback-only RLS negative test and container build were skipped.
- No production Neon migration, RLS activation, role provisioning or deployment was performed.

## Required closure

Re-run the complete CI workflow against the fix commit. Require the registry/settlement suite, rollback-only tenant-isolation negative acceptance and container build to pass before considering this CI blocker closed.
