# Immutable checkpoint — national stakeholder work/reporting matrix — 2026-10-31

## Repository state
- Repository: `vishaltradewinds/rupaykg`.
- Branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Matrix commit / branch HEAD at checkpoint creation: `4e5a4cb66df0fee409708d4187ea7fe7b111ac9a`.
- PR #175 remains OPEN/DRAFT, base `main`, head matches this commit.
- Exact-head CI run #3947 / ID `41217457750` was IN_PROGRESS at checkpoint creation; do not record a pass until rechecked.
- Earlier audit documentation HEAD `1bead07e9815e312e0ad3be4738803043f746ef6` had exact-head CI run #3946 SUCCESS.

## New controlling product contract
- Added `docs/product/NATIONAL_STAKEHOLDER_WORK_AND_REPORTING_MATRIX_2026-10-31.md`.
- Covers household/citizen, all generator types, BWG, waste picker/collector, contractor, transporter, aggregator, MRF, recycler/processor, treatment/disposal facility, PIBO, PRO, buyer/offtaker, verifier/auditor, ULB, Gram Panchayat/district, regulator, carbon/MRV participant, registry/trust rail, funder/insurer/CSR and platform operator.
- Defines shared physical lifecycle, required event/evidence contract, role-specific reports, shared reporting rules, canonical entity model, source-to-code reconciliation, acceptance tests and ordered implementation priorities.

## Generator correction and source findings
- Generator is explicitly a first-class participant, not synonymous with BWG.
- Existing source evidence: `bwg-reporting-panel.ts` includes BWG applicability/registration profile, reporting periods, waste reports, EPR and ESG; `statutory-routes.ts` includes `/api/v1/statutory/bwg/assess`, BWG thresholds and evidence/verification binding; `value-routes.ts` contains BWG review basis; citizen/farmer panel and field capture support general generation records.
- `cpcb-swm-routes.ts` stakeholder enum includes BWG, WASTE_FACILITY, ULB, DISTRICT_PANCHAYAT, GRAM_PANCHAYAT, COLLECTOR_TRANSPORTER and PROCESSOR.
- General generator full journey (site/stream register, segregation/storage, pickup, bilateral handover, destination receipt, reconciliation and report) is not yet evidenced end-to-end.
- BWG UI calls `GET /api/v1/workspaces/bwg`; a matching handler was not found in the route modules inspected (`workspace-routes.ts`, `bwg-routes.ts`, `statutory-routes.ts`). This is an explicit route-to-UI verification item; do not claim the panel is fully operational until server registration and HTTP acceptance are confirmed.
- Field capture writes declared quantity into activity metadata; it is not a calibrated weighment or receiver-accepted quantity.
- Workspace reports are capped recent-row views in inspected handlers; reporting-period aggregation, exports, pagination and reproducibility require dedicated acceptance.

## Current readiness and safety
- Overall remains ENGINEERING CANDIDATE; national production execution NO-GO/HOLD.
- Production Neon remains sole authority; no DDL/DML, migration, role/grant/RLS, production branch, deployment, worker, scheduler or external submission action occurred.
- Tenant isolation NOT ESTABLISHED; worker OFF; scheduler OFF; certification OFF; TRL 9 NOT ESTABLISHED.
- No application code was changed in this batch. Documentation/product contract only.

## Next execution sequence
1. Verify BWG route registration and create HTTP tests for the UI's exact API endpoints.
2. Build route → UI → table → report → permission → test traceability for all 14 route families.
3. Add the missing general generator journey and bilateral custody/quantity reconciliation before dashboards.
4. Continue PR dependency inventory and one integration spine; avoid new overlapping PRs.
5. Keep P0 database tenant isolation, migration and production recovery gates ahead of live execution.
