# RupayKg — Latest Engineering Resume Point

> Mandatory start: read root `AGENTS.md`, this hand-off, the latest immutable checkpoint and linked decision records. Resume from the exact branch below; do not restart from memory.

## Current repository state — 2026-10-31
- Repository: `vishaltradewinds/rupaykg`.
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Latest accepted implementation commits: `06a3e3f1429342db06e37d934155f7aa0857399d` (CI #3994 SUCCESS) and `7b38efb31e5a65606368687ac1dd669dd3c1ab00` (CI #3999 SUCCESS; authenticated waste/EPR/ESG permission denials and no-write assertions). Latest accepted implementation SHA: `b9ee2a9b9a796032026e40980dbac27d52248992` (CI #4004 SUCCESS). Latest in-flight code SHA: `b7f2889813c5f354fec1f40ecc8bab549f0e1389` (real evidence-vault upload + independent review + BWG evidence binding; mismatch fixture now independently approves both evidence items before testing wrong-verification rejection; CI #4021 queued). Verify exact live HEAD and CI before further code changes.
- Main base: `862512c8c904cef0f604df0350f02672318953af`.
- PR #175: OPEN/DRAFT, unmerged; do not merge or rebase without dependency, independent review, migration and security gates. PR URL: https://github.com/vishaltradewinds/rupaykg/pull/175.
- Branch divergence freshly measured at 16:31 UTC: 320 ahead / 1 behind main.
- Latest checkpoint: [BWG positive report-write acceptance — PASSED](./checkpoints/2026-10-31-bwg-positive-report-write-acceptance-passed.md). Previous checkpoint: [BWG report-route permission acceptance — PASSED](./checkpoints/2026-10-31-bwg-report-route-permission-acceptance-passed.md). Previous checkpoint: [BWG authenticated PostgreSQL HTTP acceptance — PASSED](./checkpoints/2026-10-31-bwg-authenticated-postgres-http-acceptance-passed.md). Previous checkpoint: [BWG authenticated PostgreSQL HTTP acceptance](./checkpoints/2026-10-31-bwg-authenticated-postgres-http-acceptance.md). Latest execution log: [Evidence verification mismatch fixture correction](./session-logs/2026-10-31-1718-utc-evidence-verification-mismatch-fixture.md). Previous execution log: [Append-only evidence cleanup correction](./session-logs/2026-10-31-1716-utc-append-only-evidence-cleanup.md). Previous execution log: [Evidence Vault fixture type correction](./session-logs/2026-10-31-1714-utc-evidence-vault-fixture-type-fix.md). Previous execution log: [BWG evidence verification acceptance](./session-logs/2026-10-31-1712-utc-bwg-evidence-verification-acceptance.md). Previous execution log: [BWG positive report-write acceptance tests](./session-logs/2026-10-31-1706-utc-bwg-positive-report-write-tests.md). Previous execution log: [BWG waste/EPR/ESG permission acceptance batch](./session-logs/2026-10-31-1700-utc-bwg-report-route-permissions.md). Previous execution log: [BWG PostgreSQL fixture permission correction](./session-logs/2026-10-31-1652-utc-bwg-postgres-fixture-correction.md). Previous execution log: [Authoritative tenant baseline and geography-scope default](./session-logs/2026-10-31-1649-utc-authoritative-tenant-baseline.md). Previous checkpoint: [Autonomous Neon security and BWG acceptance](./checkpoints/2026-10-31-autonomous-neon-security-bwg-acceptance.md).
- Latest preflight: [Autonomous execution preflight — 16:33 UTC](./session-logs/2026-10-31-1633-utc-autonomous-preflight.md).

## Latest completed work
### Autonomous execution / Shakti governance
- Preflight log commit: `6081d9ced9d6a3cd30f5c15f64cea5f5440e7a4b`.
- Root `AGENTS.md` policy commit: `ec3a2b2a3fe46a1e3fcae7be994f7f775e2699ef`.
- Immutable checkpoint commit: `b2fe65d5fa5634aa7fcaa70557dfb16a48841c8c`.
- Added mandatory section 9, **Autonomous execution and Founder time protection**: proactive discovery and prioritisation; implementation rather than plan-only work; dependency-aware parallelisation; continue safe work around blockers; selective escalation; continuity checkpoints; exception-based reporting; Founder time protection; truthful and bounded authority. Existing completion standard is now section 10.
- No production, schema, deployment, worker, scheduler or certification changes in the governance batch. The follow-on BWG test batch adds HTTP authentication boundary coverage only.

### BWG/EPR engineering
- BWG workspace read authorization implementation: `825d430a4b8140b7e3072a536508632db8547359`.
- BWG permission tests: `824acb8d0c3866651d9038d369565dc7073a62b4`.
- Corrected stakeholder matrix: `d8f13a9abcd7618c4525958ad0972ef45341256c`.
- EPR quantity validation / narrow database constraint mapping work was present at preflight HEAD `4ae53077a37d023818879f9470fce71bb795dcd1`.
- Applicability conflict classifier test commit: `62a9ab9e0dee51bac9b69853d17af0224c8b826a`.
- BWG unauthenticated HTTP boundary test commit: `f9cb9b8ccbd1f4971b06884fabfe1041200782a8`; immutable checkpoint: [BWG HTTP authentication boundary tests](./checkpoints/2026-10-31-bwg-http-auth-boundary-tests.md). All six registered BWG routes are exercised through Fastify injection and must return 401/AUTH_REQUIRED without a session.
- Correct BWG route finding: all six BWG API paths exist in `apps/src/value-routes.ts` and are registered by `registerValueRoutes()` in `apps/src/server.ts`. Do not create duplicate routes or tables.
- Production BWG tables: `bwg_profiles`, `bwg_reporting_periods`, `bwg_waste_reports`, `bwg_epr_reports`, `bwg_esg_reports`.
- Issue #176 tracks remaining authorization, statutory approval linkage, quantity/error semantics and HTTP acceptance: https://github.com/vishaltradewinds/rupaykg/issues/176.

## CI evidence — do not conflate commits
- CI #3955 / ID `41218341622`: SUCCESS on `825d430a4b8140b7e3072a536508632db8547359`.
- CI #3956 / ID `41218359754`: SUCCESS on `824acb8d0c3866651d9038d369565dc7073a62b4`.
- CI #3960 / ID `41218598855`: SUCCESS on `4ae53077a37d023818879f9470fce71bb795dcd1`; validate job included dependency audit, migration validation, production-baseline reconstruction, proposed migration upgrade/idempotency, typecheck, build, browser smoke, disposable PostgreSQL acceptance tests, evidence upload and container build.
- CI #3965 / ID `41219392554`: SUCCESS on `62a9ab9e0dee51bac9b69853d17af0224c8b826a`.
- CI #3967 / ID `41219650791`: SUCCESS on governance commit `ec3a2b2a3fe46a1e3fcae7be994f7f775e2699ef`.
- CI #3971 / ID `41219851252`: SUCCESS on BWG HTTP test commit `f9cb9b8ccbd1f4971b06884fabfe1041200782a8`.
- CI #3972 / ID `41219932994`: SUCCESS on checkpoint commit `a2fc40643ff61721fd5c14114a5361fd2a61914c`.
- CI #3973 / ID `41219963254`: SUCCESS on resume-pointer commit `1570e1850dc0b7a44c557e9dec35f18c029254c6`.
- Never infer a current-head pass from a prior SHA.

## BWG remaining work — verified NOT DONE
1. Full authenticated HTTP acceptance tests for all six BWG API paths remain NOT DONE. The new unauthenticated HTTP test verifies all six routes return 401/AUTH_REQUIRED without a session; authenticated permission, cross-organization and geography cases still require DB-backed acceptance tests.
2. Positive and negative HTTP tests for unauthenticated requests, unverified membership, missing read/write permission, cross-organization access and geography scope.
3. Resolve the statutory workflow boundary: `POST /api/v1/statutory/bwg/assess` writes `organization_bwg_assessments`; BWG profile intake writes `bwg_profiles` as `REVIEW_REQUIRED/PENDING`. Migration 044 requires `APPLICABLE/VERIFIED` before reporting-period creation. No authorized dual-control transition connecting the assessment to verified profile state has been established. Never auto-promote.
4. Test evidence provenance, verification binding, read-after-write, idempotency, period trigger rejection and error semantics.
5. EPR route now explicitly rejects fulfilled quantity above obligated quantity and maps the exact known DB constraint to a stable conflict. Verify with route-level tests; do not rely only on helper tests.
6. Continue route → UI → tables → permissions → reports → tests crosswalk for all 14 route families.

## National product contract
RupayKg is pan-India national environmental infrastructure. Preserve the PostgreSQL-centred modular monolith; do not split services without measured evidence. One shared event/evidence/material model supports role-specific journeys.

Physical lifecycle:
`Obligation/Plan → Generation → Segregation → Storage → Collection Request/Schedule → Pickup → Weigh/Handover → Transport → Facility Receipt → Inspection/Sorting → Aggregation → Processing/Treatment → Recovered Output/By-product/Reject/Residual → Buyer/Offtake or Authorized Disposal → Verification → Reporting/Recognition`.

Truth lifecycle:
`LOCAL_CAPTURED → SYNC_RECEIVED → AUTHORITATIVE → VERIFIED → VALUE_ELIGIBLE → CERTIFIED/ISSUED → REGISTERED → TRANSFERRED/RETIRED → SETTLED → REPORTED`.
Never infer a later state from an earlier one. Distinguish declared, measured, received, reconciled, independently verified, eligible, officially accepted and settled quantities/statuses.

Generator must be first-class and distinct from BWG. A complete general generator journey (all generator types, site/stream ledger, segregation/storage, pickup scheduling, bilateral handover, destination receipt and reconciliation) is not yet proven. Continue collector/transporter/MRF/processor handoffs, mass balance, role-specific reporting, pagination/export and reproducible snapshots.

## Sole authoritative live database and safety posture
- Neon project: `rupaykg-production-fresh`, ID `steep-mud-79906940`.
- Sole production branch: `main`, ID `br-restless-base-b44cip2h`.
- Database: `rupaykg`.
- Latest read-only catalog at 16:33 UTC: 67 public base tables; 0 RLS-enabled; 0 FORCE RLS; 0 public policies; five BWG tables; migration ledger 92 rows through `20261021` (`20261021_evidence_artifact_vault.sql`).
- Inspected roles `rupaykg` and `neon_service` have LOGIN/BYPASSRLS and elevated role/database/replication attributes; `cloud_admin` is SUPERUSER/BYPASSRLS. Least-privilege runtime identity NOT ESTABLISHED.
- Neon primary branch protection freshly confirmed DISABLED (`protected=false`) at 16:33 UTC; all listed staging/rehearsal branches are also unprotected. GitHub main branch protection was disabled at the last recorded check (not refreshed in this batch).
- Actual deployed application runtime DB principal NOT ASSESSED. Latest recorded live deployment was main commit `862512c8c904cef0f604df0350f02672318953af`; recheck only through authorized provider evidence.
- Production SQL read-only by default. No production DDL/DML, migrations, grants/RLS/role changes, production branch operations, deployment, worker activation or scheduler activation without all required gates and explicit Founder approval.
- Production HOLD; tenant isolation NOT ESTABLISHED; worker OFF; scheduler OFF; certification OFF.

## TRL and external assurance
- Internal software engineering maturity only; no independent TRL assessment is established by these CI results.
- Hardware/integrated national service readiness, representative field operation, statutory/CPCB acceptance, independent validation/verification, external registry/Hedera consensus, settlement, SLOs and backup/restore RPO/RTO are NOT ESTABLISHED.
- TRL 9 is NOT ESTABLISHED. Do not claim national production readiness.

## Ordered next execution
1. CI #3994 / run `41221192576` on code SHA `06a3e3f1429342db06e37d934155f7aa0857399d` is SUCCESS, including disposable PostgreSQL acceptance, typecheck, build, browser smoke, migration baseline reconstruction/idempotency, evidence upload and container build. See immutable passing checkpoint. CI #3999 / run `41221567187` on code SHA `7b38efb31e5a65606368687ac1dd669dd3c1ab00` is SUCCESS, including DB-backed permission denials/no-write assertions for waste, EPR and ESG routes. See passing checkpoint. CI #4004 / run `41221825225` on SHA `b9ee2a9b9a796032026e40980dbac27d52248992` is SUCCESS. Positive authorised waste/EPR/ESG writes are tested; records remain PENDING and EPR external submission NOT_SUBMITTED. Current code SHA `b7f2889813c5f354fec1f40ecc8bab549f0e1389` adds real evidence vault upload/review, captured-evidence denial, verification/evidence mismatch denial and correctly bound approved verification. CI #4018 on prior SHA `5d5fa698cca0800de84eaac72d93ddcc5b7db330` passed typecheck/build/browser but mismatch test returned `EVIDENCE_NOT_VERIFIED` because second evidence was not independently approved; current SHA approves both evidence items before supplying the wrong verification ID. CI #4021 queued. CI #4015 append-only cleanup issue was corrected in #4018; all earlier type/cleanup defects documented.
2. Add EPR route-level quantity and exact database-constraint mapping tests.
3. Trace statutory BWG assessment/profile authority and design a dual-control, evidence-backed transition; never auto-promote.
4. Continue the all-route UI/API/schema/permission/report/test crosswalk and generator-to-processor lifecycle.
5. Prioritise P0 tenant isolation, table-specific RLS, ACL/function/sequence ownership, trusted identity context and least-privilege API/migration/worker principals.
6. Reconcile production migration history on a disposable production-derived Neon branch only; never rewrite production ledger.
7. Keep PR #175 draft. It currently has zero submitted reviews and zero inline review threads; do not merge/rebase until independent review, migration/security and release gates pass.
8. Assess actual Render runtime DB principal using provider evidence; do not infer it from Neon inspection identity.
9. Complete worker authority, tenant consumer, runtime identity, monitoring and recovery before activation.
10. Validate statutory sources/external interfaces, qualify hardware, run representative field trials, and prove SLOs, restore, privacy, support and multi-site operations before certification or TRL advancement.

## Resume instruction
Act as autonomous CTO execution owner under Shakti Standards. Discover and prioritise the next safe task without waiting for routine Founder prompts. Execute the largest coherent batch possible, continue independent work around blockers, test and preserve evidence, create immutable checkpoints and update this pointer. Escalate only decisions/approvals that genuinely require Founder authority. Report material verified progress, critical risks and indispensable Founder decisions only.
