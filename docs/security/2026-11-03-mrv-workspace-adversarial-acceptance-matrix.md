# MRV workspace endpoint adversarial acceptance matrix

Status: REQUIRED / NOT YET EXECUTED. This document is a test contract, not evidence that any test passed.

Target: `GET /api/v1/workspaces/mrv` on the signed-tenant branch.

## Required positive-path assertions
1. Authenticate identity A with a VERIFIED membership in organization A and active organization A.
2. Instrument the checked-out PoolClient and assert the transaction sequence is BEGIN, signed transaction-local context setup, permission query, optional geography authorization, four protected reads, COMMIT, release.
3. Assert permission/geography authorization and all protected reads use the exact same PoolClient object; no protected query may use Pool.query.
4. Seed organization A activity, measurement, evidence and verification rows and assert they are returned only when within A's geography scope.

## Required cross-tenant negative assertions
5. Seed equivalent rows for organization B, authenticate A, and assert none of B's activity, measurement, evidence or verification rows are returned.
6. Repeat with B-only geography and verify A cannot retrieve it by query parameter.
7. Assert each protected read remains organization-bound through its activity join and geography scope predicate.

## Required fail-closed assertions
8. Missing signed request-context configuration returns HTTP 503 / TENANT_CONTEXT_UNAVAILABLE and performs no protected read.
9. Missing active organization returns HTTP 403 / RLS_ORGANIZATION_CONTEXT_REQUIRED and performs no protected read.
10. Missing/insufficient MRV permission returns HTTP 403 / WORKSPACE_READ_FORBIDDEN and performs no protected read.
11. Geography authorization denial returns HTTP 403 / GEOGRAPHY_FORBIDDEN and performs no protected read.
12. Signed-context setup or any protected query failure rolls back and returns HTTP 503; no partial response is returned.

## Test quality requirements
- Use the repository's Node test runner and disposable PostgreSQL acceptance environment where RLS policies are exercised.
- Do not treat a source-text assertion as a substitute for route execution.
- Assert query parameters and tenant identifiers, not only response length.
- Include both organization A and B rows in every relevant table.
- Keep synthetic fixture identifiers and secrets isolated to tests.
- Attach exact-head CI evidence and retain the test output.

## Release gate
PR #218 and dependent PR #219 remain draft / unmerged until these assertions pass, authenticated two-tenant browser acceptance is completed, and an independent security review signs off. No production database changes, deployment, feature-flag activation, or TRL claim is authorized by this document.
