# 2026-10-31 — BWG authenticated PostgreSQL HTTP acceptance passed

## Verified source and CI
- Repository: `vishaltradewinds/rupaykg`
- Branch: `shakti/atomic-inbox-claim-2026-10-31`
- Tested implementation SHA: `06a3e3f1429342db06e37d934155f7aa0857399d`
- CI: #3994, run ID `41221192576`
- Exact SHA result: SUCCESS.
- Run URL: https://github.com/vishaltradewinds/rupaykg/actions/runs/41221192576

## Passed gates
1. Production dependency audit.
2. Migration validation.
3. Reconstruction of the exact production migration baseline on disposable CI PostgreSQL.
4. Pre-upgrade schema/verifier baseline capture.
5. Proposed migration upgrade-chain application.
6. Upgrade-runner idempotency.
7. TypeScript typecheck.
8. Application build.
9. Browser smoke test.
10. Test suite including disposable PostgreSQL acceptance.
11. Production-shaped migration evidence upload.
12. Production container build.

## New BWG authenticated HTTP coverage
The real Fastify `registerValueRoutes` plugin, real PostgreSQL pool and real authentication/session/tenant transaction path are exercised on disposable CI PostgreSQL.

Cases include:
- Verified membership without `reports:read` cannot read BWG workspace (403).
- Verified membership without `profile:update` cannot submit a BWG profile (403).
- PENDING membership is rejected (403).
- Request-body organization substitution is rejected (403).
- A geography outside an organization's explicitly verified geography scope is rejected (403).
- A member with `profile:update` and matching verified geography can submit a profile (201).
- Successful intake remains `REVIEW_REQUIRED`; regulatory registration remains `UNKNOWN`. No statutory approval is inferred.
- Denied organization fixtures have no BWG profile rows after requests.
- Fixture roles preserve the DB trigger requiring a non-empty permission set for VERIFIED membership; the negative fixture uses unrelated `guardian:read` rather than weakening the trigger.

## Important limits
- This is a successful CI acceptance batch, not a full authorization certification of all BWG routes. Waste/EPR/ESG authenticated positive/negative route coverage, evidence provenance, idempotency, reporting-period trigger, quantity/error mapping and full UI-to-schema crosswalk remain open.
- The run proves migration compatibility on the disposable CI reconstruction only. No production migration was applied.
- No production data, roles, grants, RLS, deployment, workers, scheduler or certification were changed.
- The test SHA is not the latest branch HEAD after follow-on documentation commits; always verify exact branch HEAD and its CI separately.

## Next critical work
1. Continue authenticated HTTP coverage for waste, EPR and ESG permissions, evidence provenance and period creation.
2. Resolve geography helper permissive default through caller inventory, onboarding contract and staged fail-closed design; do not change production blindly.
3. Design evidence-backed, dual-control statutory applicability approval; no auto-promotion.
4. Advance P0 tenant isolation, RLS, least-privilege DB principals, runtime identity and branch protection.
5. Keep production HOLD until all statutory, security, operations and independent verification gates pass.
