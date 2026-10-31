# Immutable checkpoint — BWG HTTP authentication boundary tests — 2026-10-31

## Repository state
- Repository: `vishaltradewinds/rupaykg`.
- Branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Test commit: `f9cb9b8ccbd1f4971b06884fabfe1041200782a8`.
- PR #175 remains OPEN/DRAFT and unmerged; base `main` at `862512c8c904cef0f604df0350f02672318953af`.
- Exact-head CI #3971 / ID `41219851252` was IN_PROGRESS at checkpoint creation. Re-poll before claiming test success.
- CI #3967 / ID `41219650791` completed SUCCESS on governance commit `ec3a2b2a3fe46a1e3fcae7be994f7f775e2699ef`.
- No exact-head CI run had yet been observed for subsequent documentation-only checkpoint/resume commits.

## Change delivered
- Updated `apps/src/value-routes.test.ts`.
- Added a Fastify HTTP test that registers the actual `registerValueRoutes` plugin with no database/session and sends requests to all six BWG endpoints:
  - `GET /api/v1/workspaces/bwg`
  - `POST /api/v1/bwg/profile`
  - `POST /api/v1/bwg/reporting-periods`
  - `POST /api/v1/bwg/reporting-periods/:periodId/waste`
  - `POST /api/v1/bwg/reporting-periods/:periodId/epr`
  - `POST /api/v1/bwg/reporting-periods/:periodId/esg`
- Every endpoint must return HTTP 401 and `AUTH_REQUIRED` without an authenticated database session.
- This exercises real Fastify route registration and HTTP behavior, rather than only testing helper functions.

## Verification and limits
- Route path strings were checked against the actual route registrations in `apps/src/value-routes.ts`.
- Test implementation follows the repository's Node test runner and Fastify injection conventions.
- Local execution was not available because the registered Desktop Commander device was offline; CI #3971 is the authoritative execution result pending.
- This is a negative unauthenticated-access test only. It does NOT complete authenticated positive/negative permission, cross-organization, geography, evidence, statutory approval or full BWG HTTP acceptance coverage.
- No production database, schema, role, RLS, deployment, worker, scheduler or certification change.

## Safety posture
- Sole production database remains Neon project `rupaykg-production-fresh`, primary branch `main`, database `rupaykg`.
- Latest recorded read-only catalog: 67 public tables, 0 RLS-enabled, 0 FORCE RLS, 0 public policies; migration ledger 92 rows through `20261021`; inspected roles remain privileged/BYPASSRLS.
- Production HOLD; tenant isolation NOT ESTABLISHED; worker OFF; scheduler OFF; certification OFF; TRL 9 NOT ESTABLISHED.

## Next actions
1. Poll CI #3971 on exact test commit `f9cb9b8ccbd1f4971b06884fabfe1041200782a8`.
2. If green, add DB-backed authenticated tests for missing permission, unverified membership and cross-organization payload mismatch, using disposable CI PostgreSQL fixtures only.
3. Complete the dual-control statutory BWG applicability determination workflow; do not auto-promote profile status.
4. Update the latest resume pointer with exact current HEAD/CI and continue the P0 security path.
