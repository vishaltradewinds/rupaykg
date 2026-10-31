# 2026-10-31 — BWG authenticated report-route permission denials PASSED

## Verified source and CI
- Repository: `vishaltradewinds/rupaykg`.
- Branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Implementation SHA: `7b38efb31e5a65606368687ac1dd669dd3c1ab00`.
- CI #3999 / run ID `41221567187`: SUCCESS on exact SHA.
- Run URL: https://github.com/vishaltradewinds/rupaykg/actions/runs/41221567187

## Passed CI gates
Dependency audit, migration validation, exact production migration baseline reconstruction, pre-upgrade schema/verifier capture, migration upgrade-chain application, migration idempotency, typecheck, build, browser smoke, disposable PostgreSQL acceptance, migration evidence upload and production container build.

## Added authenticated HTTP acceptance
Using a real disposable PostgreSQL session, verified organization membership, a reporting period gated by a real `APPLICABLE` + `VERIFIED` BWG profile, and the actual Fastify routes:
- Waste report write without `waste:record` → 403 `BWG_WASTE_FORBIDDEN`.
- EPR report write without `epr:manage` → 403 `BWG_EPR_FORBIDDEN`.
- ESG metric write without `can_write_esg` → 403 `BWG_ESG_FORBIDDEN`.
- The fixture has only unrelated `guardian:read` permission.
- Assertions verify no rows were created in `bwg_waste_reports`, `bwg_epr_reports` or `bwg_esg_reports` after denials.
- Test cleanup deletes report rows, reporting period, profile, geography scopes, role, membership, session, organization and identity.

## Boundaries and next work
- This is a negative authorization acceptance batch. Positive permitted write paths, evidence provenance/verification binding, idempotency, period lifecycle, and all route/UI/schema/report crosswalk remain open.
- The earlier authenticated profile-intake suite remains green at CI #3994 / run `41221192576`.
- No production data, DDL, grants, roles, deployment, worker/scheduler or certification changed.
- Continue with positive authorized waste/EPR/ESG writes using valid authoritative scheme/evidence fixtures, then evidence verification mismatch and tenant boundary cases. Keep statutory states fail-closed.
