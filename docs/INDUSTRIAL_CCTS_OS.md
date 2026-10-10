# RupayKg Industrial CCTS Operating System

Status: implementation specification; not a claim of live regulatory integration or statutory approval.
Owner: RupayKg
Governance: Shakti Standards — one common governance core, project-specific operating systems.
Last reviewed: 2026-10-10

## Objective
Extend RupayKg with an industrial decarbonisation vertical serving (A) CCTS compliance-mechanism entities and (B) non-obligated entities developing eligible CCTS offset projects. These are separate workflows with separate eligibility, evidence, calculations, approvals, and external registry outcomes.

## Verified regulatory baseline
- The Ministry of Power's 12 March 2026 Lok Sabha response identifies seven sectors transitioned from PAT to the CCTS compliance mechanism: aluminium, cement, chlor-alkali, pulp and paper, petrochemicals, petroleum refinery, and textiles; 490 obligated entities had been assigned greenhouse-gas emission-intensity targets at that point.
- The same response states no Carbon Credit Certificates had yet been issued to obligated entities at that point in time. This is dated information, not a claim about the current issuance state.
- The response says government-notified offset sectors include Energy, Industries, Agriculture, Waste Handling and Disposal, Forestry, Transport, Fugitive Emissions, Construction, Solvent Use, and CCUS.
- BEE's approved offset methodology register, last updated 7 July 2026, includes BM IN02.001 (industrial energy efficiency and fuel switching), BM IN02.002 (hydrogen production using methane extracted from biogas), BM WA03.001 (landfill methane recovery), and BM WA03.002 (flaring or use of landfill gas).
- Current sector transition, facility designation, target, methodology version, registration window, verifier accreditation and registry rules must be checked against latest official notifications before operational decisions.

Official sources:
- Ministry of Power, Lok Sabha response, 12 March 2026: https://powermin.gov.in/sites/default/files/uploads/LS12032026_Eng_0.pdf
- BEE approved methodologies: https://beeindia.gov.in/view_content.php?lang=1&lid=571
- BEE CCTS framework and procedures: https://www.beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=116
- BEE accredited Carbon Verification Agencies: https://beeindia.gov.in/view_content.php?lang=1&lid=568

## Product boundaries
### Workflow A — Compliance mechanism
For each facility, capture legal entity, facility identifiers, sector, notification/designation evidence, applicable target notification and period, production denominator, energy/process data, emissions factors and versions, calculation methodology, uncertainty/data-quality flags, supporting evidence, reporting status and reviewer approvals.

The system may calculate an applicable greenhouse-gas emission-intensity metric only after target period, target unit, boundary, denominator, gases, factors and calculation rules are configured from the governing notification. Never infer a target from sector alone.

The system prepares data and audit packs. It must not claim to be BEE, GRID-INDIA, CERC, the official registry, or an accredited verifier; it must not issue certificates or represent a prepared report as an accepted statutory submission.

### Workflow B — Offset mechanism
Keep a separate project record and eligibility gate for project proponent, project boundary, approved sector, methodology ID/version, baseline, additionality/eligibility evidence, monitoring plan, start date, leakage/reversal where applicable, double-counting screening, stakeholder/legal documents, monitoring periods and verification evidence.

A project may progress through Draft → Eligibility Review → PDD/Monitoring Plan → Validation → Monitoring → Verification → Registry Submission → Issuance only through explicitly recorded evidence and authorised decisions. Never mark a stage complete without evidence of the external authority/ACVA action where required.

### Agricultural residue and stubble-burning pathway (operational evidence layer; eligibility gated)

Purpose: support a commercial chain from farmer/FPO → field-level residue record → collection/aggregation → weighbridge/transport → processor or energy user → monitoring evidence pack. This extends RupayKg's waste-to-carbon MRV and KrishiKendra's physical residue chain; it does not create an independent crediting methodology.

### Official methodology register baseline
BEE's live register, last updated 7 July 2026, lists:
- BM AG04.002 — Emission reduction through improved management practices in rice cultivation (Agriculture).
- BM WA03.003 — Production of Compressed Bio-gas (CBG) (Waste Handling and Disposal).
- BM EN01.003 — Electricity and Heat Generation from Biomass (Energy).
- Related tools listed by BEE include BM-T-002 (fossil fuel combustion), BM-T-003 (electricity), BM-T-008 (anaerobic digesters), and BM-T-010 (biomass).

Official register: https://beeindia.gov.in/view_content.php?lang=1&lid=571

These register entries are not blanket approval for every stubble-burning intervention. Before a project can be marked eligible, retrieve the full current approved methodology and version, verify the project activity and feedstock fit its applicability conditions, establish the baseline and additionality as required, identify all relevant gases/sources/sinks, apply only the tools referenced or permitted by that methodology, and document monitoring, leakage, uncertainty and verification requirements. An external summary is not a substitute for the approved text.

**Specific guardrails**
- Do not assume BM AG04.002 covers all residue removal or burning avoidance solely because it concerns rice-cultivation management.
- BM WA03.003 and BM EN01.003 may be relevant to CBG or biomass energy projects only when their actual feedstock, baseline, output, monitoring and other applicability conditions are met. A bale receipt or plant delivery is not itself a carbon reduction.
- The BEE register describes BMT-T-AR-0006 as a soil-organic-carbon tool for afforestation/reforestation activities. Do not apply it to ordinary crop-residue retention unless an authoritative applicable methodology explicitly permits that use.
- Do not hard-code the user-supplied baseline/project formula, IPCC factors, grain-to-straw ratios, global-warming potentials, soil-carbon credit or “one tonne equals one issued CCC” into production calculations without mapping every term to the selected current methodology and applicable CCTS procedures.
- A thermal anomaly is a monitoring signal, not automatically a conclusive legal finding. Preserve source, timestamp, spatial resolution, confidence, field intersection, review outcome and any appeal/correction evidence. Apply methodology-specific consequences only when confirmed.
- Treat any Verra VM0042 route as a separate voluntary-standard pathway unless a documented, lawful mechanism explicitly authorises the intended interaction. Never silently combine or claim the same reduction in multiple registries.
- Keep evidence capture and indicative estimates separate from verified reductions, project registration, registry submission and actual CCC issuance.

### Minimum operational evidence chain
1. Farmer/FPO and authorised land-use/plot evidence; field boundary, area, crop, season and unique parcel ID.
2. Baseline evidence relevant to the selected methodology, including historical practice evidence where required; do not assume every enrolled field would otherwise burn.
3. Residue event records: collection date, residue type, net mass, moisture/basis, calibrated scale reference, geotag, operator and photo/document hashes.
4. Chain of custody: unique lot/QR, source parcels, aggregation, split/merge events, transport vehicle, weighbridge tickets, custody transfers, storage loss and rejection records.
5. End use: processor receipt, feedstock consumption, process output, electricity/fuel substitution where applicable, energy/calorific measurements, fossil fuel/electricity use, digestate or by-product handling and leakage evidence required by the methodology.
6. In-situ records where applicable: equipment and fuel activity, residue treatment, crop/soil parameters, sampling design and laboratory results only when the selected approved methodology requires them.
7. Fire monitoring: source/provider, acquisition time, detection confidence, exact field intersection, human review, false-positive/correction trail, and methodology-specific eligibility consequence.
8. Independent review, versioned methodology and factors, reproducible calculation pack, ACVA evidence, registry submission reference and authoritative issuance record.

### State machine and calculation controls
- Evidence states: RECORDED → QUALITY_CHECKED → REVIEWED; retain corrections rather than overwriting the evidence trail.
- Methodology states: UNMAPPED → SCOPE_REVIEW → APPROVED_FOR_PROJECT only after documented applicability review against the current official methodology. Project-specific approval is not BEE approval.
- Calculation states: NOT_CALCULATED → INDICATIVE_ONLY → METHODOLOGY_CALCULATION_PENDING_REVIEW → VERIFIED_BY_ACVA (external evidence required). No local state may set a project to REGISTERED or CCC_ISSUED without the authoritative external record.
- Do not calculate a final credit quantity until all required inputs, units, factors, baseline, project emissions, leakage, uncertainty and monitoring rules are complete for the selected methodology. Unknown terms must block final calculation rather than silently default to zero.
- CCC issuance is an external registry outcome, not an application-side mint or an estimate rounded to tCO2e.

## Shared services
- Versioned official-source register with publisher, title, URL, publication/effective dates, retrieved-at timestamp, hash, superseded-by, and review status.
- Evidence metadata, immutable audit events, access control and data lineage.
- Unit-normalised calculations with formula and factor versions; reproducible recalculation.
- Distinct identifiers and state machines for compliance targets, offset projects, EPR obligations, ESCerts, and Carbon Credit Certificates.
- Duplicate/double-counting checks across projects, methodologies, registries and environmental claims.
- Exportable review packs; no automatic regulator submission until applicable integration is documented and authorised.

## Proposed domain model
- industrial_organizations
- industrial_facilities
- regulatory_instruments
- sector_transition_rules
- compliance_obligations
- facility_period_measurements
- emission_factor_versions
- emission_intensity_calculations
- offset_projects
- offset_methodology_versions
- monitoring_plans
- mrv_evidence
- verification_events
- registry_submissions
- external_certificate_records
- audit_events

All records need stable IDs, tenant/owner, timestamps, source references, status, and audit history. Do not store secrets in evidence or logs.

## Backend API surface (implemented on the feature branch; not deployed)
- GET /api/v1/industrial-ccts/regulatory-register
- POST /api/v1/industrial-ccts/facilities
- GET /api/v1/industrial-ccts/facilities/{facilityId}
- POST /api/v1/industrial-ccts/facilities/{facilityId}/periods
- POST /api/v1/industrial-ccts/facilities/{facilityId}/calculations
- POST /api/v1/industrial-ccts/target-rules
- POST /api/v1/industrial-ccts/target-rules/{targetRuleId}/review
- POST /api/v1/industrial-ccts/offset-projects
- POST /api/v1/industrial-ccts/offset-projects/{projectId}/evidence

## Known implementation gaps (must remain release blockers)
- The review endpoint records an internal independent approval, official-domain URL, and artifact hash. It does not fetch the document, prove that the hash matches its bytes, or prove the notification supports the target. The reviewer must inspect the source and its applicability; regulator acceptance is not implied.
- The regulatory register is a dated baseline; scheduled refresh, source retrieval, byte-level hashing, supersession detection, and reviewer workflow remain incomplete.
- Emissions factors, gas boundaries, unit conversion/compatibility, uncertainty treatment, full target formula/threshold comparison, and evidence-quality review are not yet a complete statutory calculation engine.
- Offset lifecycle transitions, eligibility rules, PDD/monitoring-plan workflow, ACVA verification, official registry submission, issuance reconciliation, and duplicate-credit screening are not implemented end-to-end.
- A general audit-read API and transactionally complete audit logging for every mutating route are not implemented. The independent target-rule review is currently the only CCTS mutation that writes its audit event atomically.
- Agricultural residue migration 083 adds field, fire-observation, residue-lot, custody-event, processor-receipt, and methodology-review tables only. Authenticated APIs, farmer/FPO onboarding UX, satellite-provider ingestion, mass-balance reconciliation, methodology-specific calculation engines, and integration tests for these tables are not yet implemented.
- Frontend/user journey, rate limiting, idempotency keys, correlation IDs, operational dashboards, deployment configuration, and production monitoring are not complete.

All mutating routes require authentication and organization permission checks. Facility designation, target rule creation, calculations, and offset records fail closed where required evidence is missing. A prepared calculation is not a statutory submission, verified result, or certificate. These routes are a backend foundation, not a production-ready statutory service.

## Mandatory fail-closed rules
1. Unknown or stale target/methodology: no final calculation or eligibility claim.
2. Missing measurements, production denominator, source factors or boundary: mark calculation incomplete; never substitute synthetic values.
3. Unverified legal designation: label facility screening provisional.
4. Missing ACVA/registry response: status pending/unavailable, not verified/issued.
5. No duplicate credit claims or simultaneous attribution of the same reduction without documented lawful basis.
6. Never equate PAT ESCerts with CCTS Carbon Credit Certificates.
7. No live issuance/tradability statement until an authoritative registry record is verified.

## Acceptance criteria
- Unit tests for emissions-intensity arithmetic, units, denominator zero/null, factor versions and reproducibility.
- Authorization and tenant-isolation tests for every facility/project endpoint.
- Negative tests for missing/expired notification, unsupported sector, missing evidence, stale methodology, duplicate project, repeated idempotency key, tampered file/hash mismatch, verifier unavailable, registry timeout and malformed response.
- Audit trail captures actor, action, timestamp, prior/new status, source version and evidence references.
- Compliance and offset state machines cannot be crossed implicitly.
- UI labels provisional, ready for review, submitted, accepted, verified and issued are backed by evidence; never inferred from local success.
- No production rollout until migrations, API/UI tests, security checks, operational monitoring, backup/restore and authorised pilot review pass.

## Delivery sequence
1. Inspect repository conventions, routes, schemas, auth and migration framework.
2. Add regulatory register and domain migrations.
3. Implement API/service layer and deterministic calculations.
4. Implement UI for compliance and offset pathways separately.
5. Add unit/integration/security tests and evidence exports.
6. Verify current official notifications and obtain expert/ACVA review.
7. Deploy behind a feature flag; pilot with one authorised facility; preserve existing waste-to-carbon workflows.