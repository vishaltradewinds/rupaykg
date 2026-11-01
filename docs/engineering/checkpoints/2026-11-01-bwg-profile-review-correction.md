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


## Full BWG report-write PostgreSQL acceptance — 2026-11-01

Added `apps/src/bwg-report-write-postgres.integration.test.ts` (opt-in disposable CI PostgreSQL only). The test creates unique test organization, identities, sessions, tenant roles and geography; inserts an explicitly labelled disposable fixture representing an already authority-verified BWG profile; then exercises real Fastify routes and PostgreSQL:

- Authorized reporting-period creation passes only with the seeded verified BWG profile; external submission remains NOT_SUBMITTED.
- A verified member without reporting permissions receives 403 and cannot create a period.
- Authorized waste, EPR and ESG write routes each succeed; every report remains PENDING without verified evidence. EPR external submission remains NOT_SUBMITTED.
- A verified member with only unrelated guardian:read permission receives 403 on waste, EPR and ESG writes.
- Database counts confirm denied requests created no extra report rows.
- All fixtures and rows are cleaned up in finally blocks.

The existing separate integration test continues to prove that an above-threshold self-declared profile remains REVIEW_REQUIRED/PENDING and the real database trigger blocks reporting-period creation with sanitized HTTP 409 and no period row.

Exact-head CI #4293 / ID 41327867697 passed at `a2e9133ae674449496528dcdd768fe38f5326634`, including dependency audit, migration validation, disposable PostgreSQL migrations and acceptance tests, typecheck, build, browser smoke test and production container build.

The authority-approved BWG profile used in the positive route test is an isolated fixture inserted directly into disposable CI PostgreSQL solely to test downstream report routes. It is not an external CPCB registration, not production evidence, and not a production mutation.


## Evidence provenance, verifier independence and cross-tenant rejection — 2026-11-01

Expanded `apps/src/bwg-report-write-postgres.integration.test.ts` with real disposable PostgreSQL fixtures:
- An evidence record with VERIFIED status, content hash/URI, an activity belonging to the requesting organization and a verified geography scope can support a waste report only when paired with an APPROVED verification.
- The verifier is a distinct identity from the activity actor and has explicit `VERIFY_EVIDENCE` authorization. The test does not weaken or bypass the database's verification gate.
- The evidence-backed report is marked VERIFIED.
- Evidence in CAPTURED state is rejected with HTTP 409 / `EVIDENCE_NOT_VERIFIED`.
- A random/mismatched verification ID is rejected with HTTP 409 / `VERIFICATION_INVALID`.
- Evidence belonging to another organization is rejected with HTTP 409 / `EVIDENCE_NOT_VERIFIED`, even when its evidence status is VERIFIED.
- Existing no-evidence report writes remain PENDING; EPR remains NOT_SUBMITTED; unauthorized write requests remain 403 and do not create rows.
- Evidence, verification, activity, membership, role, identity and organization fixtures are cleaned up in test teardown.

The first evidence run exposed the actual DB permission requirement `VERIFY_EVIDENCE`; the fixture was corrected to carry that explicit permission. No application authorization logic or production permission was weakened.

Exact-head CI #4297 / ID 41328373072 passed at `00874fca582690781ecad23ff4184a3c50e9502e`, including dependency audit, migration validation, disposable PostgreSQL migration and acceptance tests, typecheck, build, browser smoke test and production container build.

All authority-approved BWG profile and evidence states used by these positive downstream-route tests are inserted only as labelled fixtures in disposable CI PostgreSQL. They are not CPCB submissions, production records, or assertions of actual external registration.


## Disposable fixture teardown correction — 2026-11-01

A follow-up review of `apps/src/bwg-applicability-postgres.integration.test.ts` found that the test created disposable organization, geography, identity, role, membership, geography scope, session and BWG profile rows but did not remove them in teardown. Added deterministic cleanup in dependency-safe order, including report/period/profile rows, organization scopes and memberships, role, organization, session, identity and geography. This keeps repeatable CI runs isolated and prevents fixture accumulation.

No production code, schema or production data changed. Exact-head CI #4307 / ID 41329615974 is running at `d0050f8790ba418c4a3568c8b3df0823832f1e46`; do not count this cleanup correction as passed until that run completes.


## Exact-head fixture cleanup CI confirmation — 2026-11-01

The disposable applicability fixture teardown correction at code head `d0050f8790ba418c4a3568c8b3df0823832f1e46` passed exact-head CI #4307 / ID 41329615974. All workflow steps passed: dependency audit, migration validation, disposable PostgreSQL migration/acceptance, TypeScript typecheck, build, browser smoke test, tests and production container build. Teardown now executes as part of the passing PostgreSQL acceptance suite.

This remains an engineering CI result. PR #193 remains draft/unmerged pending independent review. Production remains HOLD.
