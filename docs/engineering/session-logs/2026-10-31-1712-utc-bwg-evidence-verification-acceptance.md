# 2026-10-31 17:12 UTC — BWG evidence provenance and verification binding acceptance

## Previous green baseline
- BWG profile/auth acceptance CI #3994 / run `41221192576` on `06a3e3f1429342db06e37d934155f7aa0857399d`: SUCCESS.
- BWG report permission denials CI #3999 / run `41221567187` on `7b38efb31e5a65606368687ac1dd669dd3c1ab00`: SUCCESS.
- BWG authorised report writes CI #4004 / run `41221825225` on `b9ee2a9b9a796032026e40980dbac27d52248992`: SUCCESS.

## New acceptance implementation
- Latest code SHA: `10ffb40e9b9257da763edb243c845210e26f38cc`.
- Previous intermediate CI #4009 / run `41222274598` for earlier SHA `c63132db2d1911ef1710d819e098a9fb653b4346` failed only in test fixture cleanup: roles were deleted while verifier memberships still referenced them. The fixture cleanup was corrected to remove dependent records and memberships before roles. Do not count #4009 as green.
- Current acceptance suite registers both actual `registerValueRoutes` and actual `registerEvidenceVaultRoutes` against disposable PostgreSQL.
- Evidence is now uploaded through the real evidence vault endpoint as a PDF payload; the independent reviewer uses a distinct authenticated identity with `evidence:review` + `VERIFY_EVIDENCE` and calls the real review endpoint. This creates the artifact version, SHA-256, immutable review record and approved verification through the production code path.
- Added tests: captured/unreviewed evidence is rejected by waste/EPR/ESG BWG report routes; a verification ID for a different evidence item is rejected; a correctly reviewed evidence + its approved verification is accepted and the resulting waste report is `VERIFIED`.
- Cleanup is dependency ordered and failure-resilient: reports, verifications, artifact reviews/versions, evidence, series, activities, verifier sessions/memberships/identities, roles, scopes, profiles, geography, organization and identity.
- CI for latest SHA is not yet confirmed. Next action: obtain exact-SHA CI and inspect integration results. Do not claim green until run completes.

## Boundaries
- All tests use disposable CI PostgreSQL only. No production data/schema/roles/grants/deployment/worker/scheduler/certification changes.
- Even a `VERIFIED` BWG report in these tests only means the evidence review + approved verification path is bound; it does not mean CPCB acceptance, external registry issuance, carbon-credit eligibility or settlement.
