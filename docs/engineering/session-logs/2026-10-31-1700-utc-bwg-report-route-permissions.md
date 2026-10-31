# 2026-10-31 17:00 UTC — extend authenticated BWG route permission acceptance

- Previous accepted test SHA: `06a3e3f1429342db06e37d934155f7aa0857399d`, CI #3994 / run `41221192576`: SUCCESS, including production-shaped migration reconstruction, typecheck, build, browser smoke, disposable PostgreSQL acceptance, evidence upload and container build.
- New code SHA: `7b38efb31e5a65606368687ac1dd669dd3c1ab00`.
- CI #3999 / run `41221567187` is in progress for this exact SHA.
- Added DB-backed authenticated HTTP denials for:
  - `POST /api/v1/bwg/reporting-periods/:periodId/waste` without `waste:record` → 403 `BWG_WASTE_FORBIDDEN`.
  - `POST /api/v1/bwg/reporting-periods/:periodId/epr` without `epr:manage` → 403 `BWG_EPR_FORBIDDEN`.
  - `POST /api/v1/bwg/reporting-periods/:periodId/esg` without ESG write capability → 403 `BWG_ESG_FORBIDDEN`.
- Each request uses a real disposable DB session/member and a reporting period whose profile satisfies the real trigger (`APPLICABLE` + `VERIFIED`). The role retains only unrelated `guardian:read`.
- Added no-write assertions for all three BWG report tables after denied requests. Fixture cleanup deletes reports and period before tenant rows.
- CI #3999 early gates dependency audit, migration validation and exact production-baseline reconstruction have passed; pre-upgrade schema/verifier capture was in progress at log time. Full test result is pending.
- No production writes, schema changes, grants, role changes, deployment, worker/scheduler activation or certification.
- Next: inspect #3999 exact-SHA result; if green, extend positive allowed-path and evidence/verification binding tests. Continue security review of permissive geography-scope default and P0 RLS/runtime identity controls.
