# 2026-10-31 — BWG PostgreSQL integration fixture correction

- Previous code SHA: `3a94f5304e0365779aeda5132eb94be3b841287b`.
- CI #3989 / run `41221030798`: dependency audit, migration validation/reconstruction/upgrade/idempotency, typecheck, build and browser smoke all SUCCESS; disposable PostgreSQL test suite FAILED at the new BWG test.
- Exact failure: PostgreSQL trigger rejected the test role because a VERIFIED membership requires an explicit non-empty role permission set. The test fixture had used an empty permissions array.
- Corrected in code SHA `06a3e3f1429342db06e37d934155f7aa0857399d`: the negative-permission fixture now receives unrelated `guardian:read`, which is non-empty but does not grant `reports:read`, `profile:update`, or BWG write capabilities.
- This preserves the actual database governance invariant rather than weakening/disabling its trigger.
- Awaiting exact-SHA CI for `06a3e3f1429342db06e37d934155f7aa0857399d`; do not claim DB acceptance passed until it completes.
- No production changes. All fixtures run only on CI disposable PostgreSQL and cleanup is in `finally`.
