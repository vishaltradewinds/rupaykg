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

### Shared services
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

## API contract proposal
- GET /api/industrial-ccts/regulatory-register
- POST /api/industrial-ccts/facilities
- POST /api/industrial-ccts/facilities/{facilityId}/periods
- POST /api/industrial-ccts/facilities/{facilityId}/calculations
- POST /api/industrial-ccts/compliance-obligations
- POST /api/industrial-ccts/offset-projects
- POST /api/industrial-ccts/offset-projects/{projectId}/eligibility-review
- POST /api/industrial-ccts/offset-projects/{projectId}/evidence
- GET /api/industrial-ccts/audit/{entityType}/{entityId}

These routes are proposals only until implemented and covered by tests. Mutating requests require authentication, authorisation, schema validation, idempotency for submissions, correlation IDs, audit logging and rate limiting.

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