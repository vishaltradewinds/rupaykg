# Pan-India Waste Chain — Existing Architecture Audit

**Audit basis:** source files on main reviewed 26 October 2026. This is a repository/source audit, not a live production test or legal certification.
**Decision:** extend the existing architecture; do not create a second waste ledger or a second onboarding system.

## 1. Existing foundations confirmed in source

| Capability | Existing source | What it establishes | What it does not establish |
|---|---|---|---|
| Canonical organisations, identities, geography, roles, activities, measurements, evidence, verifications, obligations, credentials and audit events | migrations/001_core.sql | Shared identity/operational foundation exists | Current production schema/version is not verified by this source review |
| Resource-flow records | migrations/007_resource_flow_mrv.sql: resource_flows | Flow stores organisation, origin type, resource form, material code, declared quantity/unit, source/destination geography and lifecycle status | Full material composition, regulated classification, pickup/receipt measurement and facility scope are not explicit in this table |
| Custody sequence | migrations/007_resource_flow_mrv.sql: chain_of_custody_links | Ordered flow links can record actor organisation, activity, quantity/unit, geography, timestamp and evidence | Vehicle/driver, handover acknowledgements, dual-party disagreement, weighment method and transport documents are not explicit here |
| MRV observations and evidence requirements | migrations/007_resource_flow_mrv.sql | Activity-linked observations, method, instrument identifier, unit, time and evidence requirements exist | A general waste transaction must not automatically become an MRV/carbon claim |
| Hierarchical stakeholder application and approval | migrations/029_stakeholder_onboarding.sql; migrations/077_hierarchical_stakeholder_onboarding.sql; apps/src/onboarding-hierarchy-routes.ts; docs/STAKEHOLDER-ONBOARDING-HIERARCHY.md | Applicant, organisation, requested role/type, geography and staged local/district/state/platform approval are modelled | Approval does not prove a regulator-issued permit or activity-specific statutory registration; legal applicability must remain separate |
| Legal verification evidence and approval governance | migrations/062_stakeholder_onboarding_governance.sql; migrations/063_organization_legal_verification.sql; migration 078 and related guards | Review decisions and separated approval duties exist | It does not mean every role needs the same approval chain; the legal basis for each gate must be scoped and reviewed |
| Regulatory source/requirement catalog | migrations/026_regulatory_source_provenance.sql; migrations/039_india_regulatory_requirements.sql; migrations/042_india_regulatory_requirement_catalog.sql; migrations/053_authoritative_regulatory_baseline.sql; migrations/064_statutory_applicability_controls.sql | Versioned source and requirement concepts plus evidence-based applicability controls exist | Complete current State/UT/local rule coverage is not demonstrated by the existence of a catalog |
| EPR scheme and obligation/return records | migrations/005_carbon_epr_esg.sql; migrations/067_epr_scheme_catalog.sql; migrations/068-072 EPR lifecycle; apps/src/bwg-routes.ts; apps/src/epr-return-routes.ts | Several national EPR schemes and scoped obligations/returns are already modelled | Do not assume every stream, amendment, external certificate or portal state is current/complete without per-scheme verification |
| BWG/SWM workspace and eligibility/reporting | apps/web/src/bwg-reporting-panel.ts; migrations/036-044; migrations/20261018_cpcb_swm_stakeholder_workspaces.sql; migrations/20261019_cpcb_bwg_workflow_tracking.sql; docs/CPCB_SWMP_2026_BWG_DASHBOARD_AUDIT.md | BWG thresholds, a preparation workspace, user-reported CPCB status history and compliance reporting exist | The existing audit explicitly says it is not a complete mirror of the CPCB portal and not a live portal/API integration |
| Evidence artifact vault | `migrations/20261021_evidence_artifact_vault.sql`; `apps/src/evidence-vault-routes.ts`; `docs/CPCB_SWMP_2026_STAKEHOLDER_WORKFLOWS.md` | A bounded evidence-artifact vault and its routes are present on main; workflow docs record the relevant backend/workspace work as merged | Presence in source does not establish production deployment, access-policy correctness, or end-to-end operation |



**Separate pending capability:** instrument-bound validation and related MRV hardening proposed in PR #51 remains open/unmerged as of this audit. Do not treat that branch as a main-branch or production capability.

## A0 source-path trace (completed 26 October 2026)

| Path | Source evidence | Finding for custody implementation |
|---|---|---|
| Authoritative resource-flow create | `apps/src/server.ts`, `POST /api/v1/resource-flows` | Writes `resource_flows` after authentication, `waste:record` permission, and source/destination geography checks. It creates no custody event or destination-organisation assignment. |
| Resource-flow workspace read | `apps/src/workspace-routes.ts`, `GET /api/v1/workspaces/resource-flows` | Lists flows for verified organisation IDs and geography scope; no custody timeline, handover, receiver acceptance or dispute projection is present in this route. |
| Offline resource-flow create | `apps/src/sync-routes.ts`, allow-listed `RESOURCE_FLOW_CREATE` operation | Applies the same canonical `resource_flows` table in the field-sync transaction after verified membership and `waste:record` permission. **Gap found:** both geography IDs can be omitted, causing both conditional scope checks to be skipped; the direct endpoint requires at least one geography. It does not create custody links. |
| Offline envelope/idempotency/conflicts | `migrations/009_field_sync.sql`, `011_field_sync_application.sql`, `033_field_sync_tenant_integrity.sql`, `034_operation_sync_device_binding.sql`, `050_field_sync_conflict_audit.sql`; `apps/src/sync-routes.ts` | Durable envelope, device binding, idempotency and conflict/audit mechanisms exist. They are an envelope layer, not a waste-specific custody state machine. New events must not bypass or weaken these controls. |
| Canonical custody table | `migrations/007_resource_flow_mrv.sql`, `chain_of_custody_links` | The table currently holds flow, sequence, actor organisation, optional activity, positive quantity/unit, geography, timestamp and optional evidence. In this source inventory, no application writer/reader for this table was found; its sequence constraint alone does not implement acknowledgement, rejection, partial receipt or disputes. |
| Domain model | `packages/domain/src/resource-flows.ts` | The `ChainOfCustodyLink` interface currently represents only from/to activity IDs, optional evidence and recorded time; it is not aligned with the persisted custody row or operational event lifecycle. |
| Evidence | `apps/src/evidence-vault-routes.ts`, `migrations/20261021_evidence_artifact_vault.sql` | Evidence upload/read/review is activity, organisation and geography scoped. Reuse evidence references; do not build a second artifact store. |
| Existing resource-flow UI | `apps/web/src/resource-flow-panel.ts` | The UI submits flow declarations to the authoritative create route. It is intake only, not a custody workflow or end-to-end chain trace. |


**Additional fail-closed finding:** the offline `RESOURCE_FLOW_CREATE` operation currently permits both source and destination geography IDs to be absent, unlike `POST /api/v1/resource-flows`. This should be corrected and regression-tested before offline resource-flow intake is treated as geographically scoped.

**A0 decision:** implement custody as an additive, append-only event extension tied to existing `resource_flows`, with explicit flow-party assignment/authorization before cross-organisation writes. The current owner organisation plus geography scope is not sufficient by itself to authorize an unrelated transporter or receiver to append to a flow. Reuse existing field-sync envelopes for offline event delivery, and keep an event-level idempotency key and conflict-preserving acknowledgement model. Do not add API/migration behavior until this authorization boundary, legacy-row compatibility, append-only enforcement and disposable-PostgreSQL migration tests are included.

## 2. Confirmed product gaps to resolve

1. **Stakeholder taxonomy is too coarse for operations.** The current CPCB workspace has a combined COLLECTOR_TRANSPORTER type and a PROCESSOR type. Pan-India workflows need distinct operational profiles for generator, collector/aggregator, transporter, sorting/MRF, recycler, treatment facility, downstream buyer, EPR obligated entity, local body and verifier. These are functional roles and must not automatically create legal permissions.
2. **Multi-role/facility scope must be explicit.** A single organisation can generate one material, aggregate another, transport under a third authorisation and process only at a specific permitted site. Access and legal eligibility must be evaluated per organisation + facility + role/activity + material/waste family + jurisdiction + capacity + validity.
3. **Resource flow needs a documented extension map.** Reuse resource_flows and chain_of_custody_links. First map their existing writers/readers and constraints; then add only missing fields/tables in additive, migration-tested changes. Do not create a duplicate lot/ledger table by default.
4. **Pickup/transport/receipt evidence needs stronger domain contracts.** Explicitly model the assigned transporter, vehicle/driver evidence where applicable, origin handover, transit events, receiver acceptance, partial/rejected loads, weighment source and disputed quantities. Preserve both parties' assertions; don't overwrite.
5. **Processor mass balance is not established by the two base flow tables.** Add a governed processing-batch/input-output/residual link only after identifying existing process/measurement tables. Require documented material/process-specific tolerance and reject invented losses or output yields.
6. **Regulatory coverage must be tested, not inferred.** Existing source catalog entries cover several streams but do not prove a complete up-to-date State/UT/local matrix. Track source date, effective period, responsible authority, activity/material scope and review state. Missing or conflicting applicability is a hard stop.
7. **BWG and EPR must stay distinct.** BWG eligibility and local-body/EBWGR workflow are not interchangeable with plastic, e-waste, battery, tyre, used-oil or C&D EPR regimes. The official external portal remains authoritative.
8. **Offline operation and low-tech participants need explicit tests.** Existing field sync should be reused only after testing tenant binding, idempotency, conflict preservation, late updates and source evidence for the new waste-chain events.
9. **Do not equate onboarding hierarchy approval with statutory authorization.** A platform's hierarchy can govern membership, but activity activation must separately check the current, scope-matched external authorization when required.
10. **Production identity/status remains an independent gate.** GitHub CI and repository files are engineering evidence only; they do not prove the live database has the intended schema, data or release.

## 3. Implementation order

**A0 — Inventory:** trace all writers/readers of resource_flows, chain_of_custody_links, field sync, measurements, evidence and stakeholder workspaces. Capture exact schema, authorization, idempotency and lifecycle contracts before migrations.

**A1 — Taxonomy and rule applicability:** add a versioned participant-role and waste/material taxonomy only if no equivalent canonical registry exists. Reconcile existing regulatory_sources, regulatory_requirements, epr_schemes and applicability tables. Avoid duplicating catalogs.

**B — Custody workflow:** add missing domain fields/events for handover, transport, receipt, dispute and weighment, using the existing resource-flow ledger and append-only audit pattern.

**C — Processing accounting:** link accepted input lots to processing batches, outputs, residues and downstream receipts; enforce source-linked mass balance and capacity limits.

**D — Role-specific workspaces:** separate generator, aggregator/MRF, transporter, processor/recycler, buyer and compliance views while sharing canonical organisation, facility, evidence and resource-flow records.

**E — Rule and pilot qualification:** verify one waste family and one jurisdiction at a time using current official source packs; test with real consenting participants before any claim of live operation.

## 4. Non-negotiable acceptance gates

- No parallel waste ledger or duplicate onboarding identity.
- No role implies statutory authorisation.
- No cross-tenant or cross-facility data access.
- No flow may skip required custody/receiver events for its configured route.
- Unknown or expired legal scope blocks the regulated action and gives a reason code.
- Duplicate/replayed events are idempotent; conflicting evidence is preserved and queued for review.
- Every measured quantity identifies method/source/time/unit; estimates remain labelled as estimates.
- Processing inputs, outputs, residues and documented losses reconcile within a reviewed material/process basis.
- EPR/BWG official certificates remain externally issued; RupayKg stores traceable references and supporting evidence only.
- Migrations are additive, reversible/recoverable according to the release plan, validated against disposable PostgreSQL, and reviewed before merge.
- No merge/deployment or production certification until independent review and production/database/security/recovery gates pass.

## 5. Authoritative reference starting points

- CPCB SWM Rules 2026 portal: https://swm.cpcb.gov.in/
- Official SWM Rules 2026 Gazette PDF: https://swm.cpcb.gov.in/images/solid-waste-management-rules-2026.pdf
- CPCB C&D Rules 2025 system: https://cdwm.cpcb.gov.in/about-system
- CPCB E-Waste EPR portal: https://eprewaste.cpcb.gov.in/

Each source must be rechecked for the specific rule, amendments, scope and effective date before production policy is encoded. This audit does not confer statutory approval or establish live production status.
