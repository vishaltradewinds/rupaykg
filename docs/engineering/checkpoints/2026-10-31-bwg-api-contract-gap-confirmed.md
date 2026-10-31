# Immutable checkpoint — BWG API contract gap confirmed — 2026-10-31

## Current repository state
- Repository: `vishaltradewinds/rupaykg`.
- Branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Branch HEAD when this checkpoint was prepared: `f95cd24d926187de6c959cbf9d4c1f6b6f6e8883`.
- National stakeholder matrix commit: `4e5a4cb66df0fee409708d4187ea7fe7b111ac9a`.
- Matrix exact-head CI run #3947 / ID `41217457750`: completed SUCCESS on matrix commit `4e5a4cb66df0fee409708d4187ea7fe7b111ac9a`.
- BWG contract clarification documentation commit: `f95cd24d926187de6c959cbf9d4c1f6b6f6e8883`; its exact-head CI is not yet verified.
- PR #175 remains OPEN/DRAFT; no merge performed.

## Confirmed Generator/BWG findings
- Generator is a first-class stakeholder distinct from BWG.
- Existing code includes general citizen/farmer and field capture, BWG profile/report UI, statutory BWG assessment, EPR/ESG and CPCB/SWM workspaces.
- BWG frontend `apps/web/src/bwg-reporting-panel.ts` invokes six API paths:
  - `GET /api/v1/workspaces/bwg`
  - `POST /api/v1/bwg/profile`
  - `POST /api/v1/bwg/reporting-periods`
  - `POST /api/v1/bwg/reporting-periods/:periodId/waste`
  - `POST /api/v1/bwg/reporting-periods/:periodId/epr`
  - `POST /api/v1/bwg/reporting-periods/:periodId/esg`
- Source tracing confirmed the server registers `workspace-routes.ts` and `bwg-routes.ts`; neither implements these paths. `statutory-routes.ts` implements BWG assessment/EPR applicability, not the BWG reporting-period API. This is a confirmed UI/API contract gap, not merely an unverified suspicion.
- Created GitHub issue [#176 — Restore and test the Bulk Waste Generator reporting API contract](https://github.com/vishaltradewinds/rupaykg/issues/176).
- No code or database changes were made for this gap. Implement only after schema/ownership/migration and authorization review; reuse canonical tables.

## Product contract
- Controlling matrix: `docs/product/NATIONAL_STAKEHOLDER_WORK_AND_REPORTING_MATRIX_2026-10-31.md`.
- Includes all generator types, BWG, citizen/household, worker/collector, contractor, transporter, aggregator, MRF, recycler/processor, treatment/disposal, PIBO, PRO, buyer/offtaker, verifier, ULB, Panchayat/district, regulator, carbon/MRV, registry/trust, funder/insurer/CSR and platform operator.
- Defines shared lifecycle, required event/evidence contract, role-specific operational/statutory/MRV/commercial/governance reports, canonical entities, current-code reconciliation and acceptance tests.
- The full generator-to-collection-to-transport-to-facility-to-processing-to-reporting journey is not yet proven.

## Safety boundary and production posture
- Sole authoritative live database remains Neon project `rupaykg-production-fresh`, production branch `main` / `br-restless-base-b44cip2h`, database `rupaykg`.
- Production RLS/tenant isolation NOT ESTABLISHED; 0/67 production public tables have RLS enabled.
- Production migration ledger 92 rows; worker migration chain is candidate/rehearsal only.
- Worker OFF; scheduler OFF; certification OFF; TRL 9 NOT ESTABLISHED.
- No production DDL/DML, migration, grants/roles/RLS, production branch operation, deployment, worker activation, scheduler activation, external submission or certification action occurred.
- No application code was changed in this batch. Product documentation and GitHub issue only.

## Next actions
1. Verify exact-head CI for current HEAD and update resume pointer.
2. Resolve issue #176 by tracing canonical BWG tables and permissions, then implementing all six paths with HTTP acceptance tests—without production migration.
3. Build route → UI → table → report → permission → test crosswalk for all 14 route families.
4. Complete general generator journey and bilateral custody/quantity reconciliation.
5. Keep PR consolidation and P0 database security/migration/recovery gates ahead of live execution.
