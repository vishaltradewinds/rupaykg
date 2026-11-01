# RupayKg BWG Profile Review Correction — 2026-11-01

## Repository state
- Repository: vishaltradewinds/rupaykg
- Base: main
- Corrective branch: fix/bwg-profile-needs-independent-review-2026-11-01
- Draft PR: https://github.com/vishaltradewinds/rupaykg/pull/193
- PR head before this checkpoint: a11db687d840e5fca0d51c7c995ac8aaf53c9033
- Related engineering issue: #176

## Source finding
The BWG profile intake route in apps/src/value-routes.ts previously calculated APPLICABLE/NOT_APPLICABLE directly from organization-submitted threshold values and persisted the profile as VERIFIED. The reporting-period database trigger requires a profile to be APPLICABLE and VERIFIED. This created an unsafe trust-boundary: ordinary intake could satisfy the statutory profile gate without independent approval.

A separate statutory BWG assessment handler exists in apps/src/statutory-routes.ts, but current apps/src/server.ts does not register registerStatutoryRoutes. The handler is labelled INTERNAL_APPLICABILITY_PREPARATION_ONLY; it is not an operational external-authority approval process. Do not describe it as such or wire it into production without a reviewed authority/approval model.

## Corrective change in PR #193
- Submitted threshold measurements are retained as internal screening evidence.
- Screening metadata is explicitly tagged INTERNAL_SCREENING_ONLY.
- Intake status is REVIEW_REQUIRED.
- Persisted profile status is PENDING.
- No migration or schema change.
- Added apps/src/value-routes.test.ts Fastify HTTP regression coverage. Above-threshold organization-submitted measurements cannot self-certify statutory applicability or profile verification.

## Exact-head CI evidence
Workflow run #4276 / ID 41326114062 passed at PR head a11db687d840e5fca0d51c7c995ac8aaf53c9033. All steps succeeded:
- dependency audit
- migration validation
- disposable PostgreSQL migration run
- TypeScript typecheck
- full build
- production web browser smoke test
- tests including disposable PostgreSQL acceptance
- production container build
- cleanup

This is engineering CI evidence only. It is not a production deployment, statutory determination, regulatory approval, or certification.

## Remaining gates
1. Authenticated HTTP acceptance for all six BWG endpoints: permitted and denied roles, missing permissions, unverified membership, cross-organization mismatch, geography denial, evidence/verification binding, read-after-write, idempotency and quantity boundaries.
2. Establish the actual statutory applicability authority and independently authorized reviewer/approval evidence. No automatic transition from assessment to APPLICABLE/VERIFIED.
3. Reconcile the six route-to-UI contracts and distinguish declared, measured, received, reconciled and verified quantities.
4. Reconcile migration chronology against the authoritative Neon production ledger using disposable production-derived branches only.
5. Independent review and exact-head CI before PR merge.

## Database and release safety
- Sole authoritative Neon project remains rupaykg-production-fresh (project ID steep-mud-79906940), primary branch main.
- Use disposable child branches for schema inspection and acceptance only.
- No production DDL/DML, migrations, deployments, worker/scheduler activation, external submissions, or certification.
- Production remains HOLD.


## Follow-up authenticated HTTP acceptance — 2026-11-01

Expanded Fastify route tests now cover:
- Profile: authenticated intake remains REVIEW_REQUIRED/PENDING; unauthenticated request, missing verified membership, cross-organization write, missing profile-update permission and geography-scope denial are rejected.
- Reporting-period creation: permission denial and authorized creation.
- Waste report: permission denial and authorized intake remains PENDING when no verified evidence is supplied.
- EPR report: permission denial and authorized intake remains PENDING; response explicitly states NOT_SUBMITTED.
- ESG report: database-backed permission denial and authorized intake remains PENDING when no verified evidence is supplied.

These HTTP route tests use a controlled fake PostgreSQL Pool. They are useful route-contract/authorization tests but are not a substitute for full authenticated route acceptance against a live disposable PostgreSQL instance.

Latest exact-head CI before this documentation addendum: workflow #4282 / ID 41326628054 passed at code head b46eca16fb42cbcadfae9b3df60f2613d7296481. All steps succeeded, including migration validation, disposable PostgreSQL migration/acceptance, typecheck, build, browser smoke test, production container build and cleanup.

This remains an engineering pass only. PR #193 is draft/unmerged; independent review is outstanding. Production remains HOLD.


## Business-rule error semantics and live disposable PostgreSQL proof — 2026-11-01

Additional source and disposable Neon schema inspection established:
- The reporting-period trigger raises SQLSTATE 23514 with exact message: `BWG applicability must be verified before creating a reporting period`.
- The EPR table has exact check constraint `bwg_epr_reports_fulfilled_le_obligated` enforcing fulfilled quantity <= obligated quantity.
- Before correction, API catches translated these known business-rule failures to generic HTTP 503 responses.

PR #193 now:
- maps only the exact BWG applicability trigger failure to sanitized HTTP 409 / `BWG_APPLICABILITY_NOT_VERIFIED`;
- rejects fulfilled quantity greater than obligated quantity before insert with HTTP 400 / `BWG_EPR_FULFILLED_EXCEEDS_OBLIGATED`;
- maps only the exact EPR check constraint to sanitized HTTP 409 with the same business code; unrelated PostgreSQL errors remain generic service failures;
- adds helper and route tests for exact matching and no SQL detail leakage.

Added `apps/src/bwg-applicability-postgres.integration.test.ts`, gated by `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1`. It uses a disposable CI PostgreSQL database and the real Fastify routes to prove that an above-threshold profile remains REVIEW_REQUIRED/PENDING, the actual trigger rejects reporting-period creation with HTTP 409, and no period is created.

Exact-head CI #4287 / ID 41327350512 passed at code head `fba4959f08c928eaf4a863a15b2109aa0d4acee4`, including migration validation, disposable PostgreSQL integration tests, typecheck, build, browser smoke test, production container build and cleanup.

This is engineering validation only. PR #193 remains draft/unmerged pending independent review. Production remains HOLD.


## Official SWM Rules 2026 and live CPCB BWG portal verification — 2026-11-01

Reviewed the official Gazette S.O. 388(E) and live CPCB Centralised Portal:
- Gazette PDF: https://moef.gov.in/uploads/pdf-uploads/pdf_69a16e3b04c107.91022257.pdf
- CPCB portal: https://swm.cpcb.gov.in/
- CPCB BWG user guide: https://swmp.cpcb.gov.in/en/user-guide
- CPCB FAQ: https://swmp.cpcb.gov.in/en/faq
- CPCB resources: https://swmp.cpcb.gov.in/en/resources

Statutory boundary:
- Rule 3(1)(i): BWG criteria are >=20,000 sq.m floor area OR >=40,000 L/day water OR >=100 kg/day solid waste, for enumerated categories.
- Rule 6(a): register with the concerned local body through the centralised portal; certificate carries continuing conditions.
- Rule 6(h): annual returns due 30 June on portal for local-body processing.
- Rule 10(1): only the local body generates EBWGR certificates on the portal.
- Rule 16 assigns CPCB operation of the centralised portal and permits portal-use fees under sub-rule (8).
- Rule 39(36)-(40) assigns ULB identification/geotagging, certificate cost and issuance, and monthly reporting duties.

The portal is live. Its official guide shows organization account, BWG eligibility assessment, document upload and self-declaration, fee payment, submission, ULB/District Panchayat review, acknowledgement tracking, authority remarks and certificate download. FAQ confirms registration is organization-specific and ULB-specific; account creation is not registration approval.

Repository standard added: `docs/engineering/standards/BWG_STATUTORY_AUTHORITY_BOUNDARY.md`. RupayKg is supplementary MRV/workflow infrastructure, not the statutory portal. It must hand off to CPCB, retain receipt/certificate provenance, and never issue official EBWGR certificates. CPCB's resources page lists a portal User Fee Structure guideline dated 15 October 2026; the actual fee schedule amount is not verified in this checkpoint, so no cost assumption is allowed.

Latest exact code CI #4287 / ID 41327256588 passed. Docs-only CI for the current legal boundary addendum is running as #4291 / ID 41327634618.
