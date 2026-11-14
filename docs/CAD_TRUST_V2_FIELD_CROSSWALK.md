# CAD Trust v2.0.2 — RupayKg field-by-field crosswalk

**Status:** Read-only schema reconciliation; no connector or migration implemented.  
**Date:** 2026-11-14.  
**CAD Trust source:** `Chia-Network/cadt/docs/cadtrust-schema-v2.0.2.json`, commit `45639f36fcedc73a6545e6bb6952b001fa7bf550`, blob `577f4e394c30d4a225485b2e5f25f1c38a0fd550`.  
**RupayKg source:** Neon project `steep-mud-79906940`, isolated branch `br-billowing-lake-b4n7j0td` (`rupaykg-rls-acceptance-20261114`), database `rupaykg`. Branch parent timestamp: `2026-11-14T08:01:30Z`. Production was not queried or changed.

## 1. Executive result

CAD Trust v2.0.2 defines 15 entities. RupayKg already has adjacent domains for carbon projects, methodology versions, calculations, evidence, verification, geography, organisations and registry events. It is not a one-to-one implementation of CAD Trust.

**Do not clone CAD Trust's 15 tables.** The correct next step is a versioned mapping/validation package with fixtures, then a read-only GET-only adapter if justified. No production schema changes are warranted by this assessment alone.

Status meanings: **DIRECT** = same concept; **PARTIAL** = related but transform/context required; **GAP** = no safe equivalent; **EXTERNAL** = CADT-generated/external identifier; **NOT EQUIVALENT** = superficially similar local object has a different meaning.

## 2. Field-level crosswalk

### Program — `/v2/program`
RupayKg candidate: `carbon_market_mechanisms` (`code`, `name`, `participation_model`, `authority`, `source_url`, `status`, `description`).

| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_program_id` | retain as external CADT ID only | EXTERNAL |
| `program_name` | mechanism `name` is adjacent, but a mechanism is not a crediting programme | PARTIAL |
| `program_registry` | no registry operator field | GAP |
| `program_registry_id` | no external programme ID | GAP |
| `program_description` | mechanism `description` | PARTIAL |
| `created_at`, `updated_at` | local timestamps are not CADT timestamps | EXTERNAL |

**Rule:** Do not equate `carbon_market_mechanisms` with a CADT programme.

### Methodology — `/v2/methodology`
RupayKg candidates: `methodology_versions`, `ccts_methodology_registry`.

| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_methodology_id` | external CADT ID | EXTERNAL |
| `methodology_code` | `methodology_versions.methodology_code`; CCTS catalogue `code` for CCTS entries | DIRECT/PARTIAL |
| `methodology_name` | no name on `methodology_versions`; CCTS `title` is relevant | PARTIAL |
| `methodology_type` | no equivalent; mechanism/item_kind are not interchangeable | GAP |
| `methodology_version` | `methodology_versions.version` | DIRECT |
| `methodology_date` | `effective_from` | PARTIAL |
| `methodology_link` | `source_reference` or CCTS `source_url` | PARTIAL |
| `created_at`, `updated_at` | own timestamps only | PARTIAL |

Preserve RupayKg's richer rules, applicability, parameter dictionary, equation mapping, reconciliation evidence, source hash and regression verification fields; do not flatten them into CADT.

### Stakeholder — `/v2/stakeholder`
RupayKg candidates: `organizations`, `organization_memberships`, `roles`, `stakeholder_applications`, `stakeholder_application_approvals`.

| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_stakeholder_id` | external CADT ID | EXTERNAL |
| `stakeholder_name` | `organizations.legal_name/name` | PARTIAL |
| `stakeholder_type` | `organization_type` and role catalogue; explicit mapping needed | PARTIAL |
| `stakeholder_link` | `external_reference` is not guaranteed to be a URL | GAP |
| `cad_trust_project_id` | no project-stakeholder relationship; membership is not project participation | GAP |
| `created_at`, `updated_at` | local timestamps only | PARTIAL |

Preserve Generator, Aggregator and Recycler/Processor as distinct roles; also retain municipality/ULB, producer, verifier and other stakeholders. Do not infer project participation from tenant membership.

### Label — `/v2/label`
| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_label_id` | external CADT ID | EXTERNAL |
| `label_name`, `label_type` | no governed carbon-credit eligibility-label catalogue identified | GAP |
| `label_link`, `label_date` | no label entity | GAP |
| `created_at`, `updated_at` | CADT-managed | EXTERNAL |

Do not repurpose EPR scheme names, ESG disclosure codes or regulatory framework codes as carbon-credit labels without a controlled mapping.

### Project — `/v2/project`
RupayKg candidate: `carbon_projects` (`id`, `organization_id`, `geography_id`, `project_code`, `title`, `methodology_version_id`, `status`, `created_at`, `carbon_mechanism`, `regulatory_source_id`).

| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_project_id` | external CADT ID | EXTERNAL |
| `org_uid` | `organization_id` is local tenant relation, different ID namespace | PARTIAL |
| `project_registry_name` | no registry-name field | GAP |
| `project_id` | `project_code` candidate; internal vs registry-assigned semantics differ | PARTIAL |
| `project_crediting_program` | `carbon_mechanism` is not programme ID | GAP |
| `project_name` | `title` | DIRECT |
| `project_link` | no project URL | GAP |
| `project_description` | no dedicated description | GAP |
| `project_sector` | no project-sector field; CCTS catalogue sector is methodology-level | GAP |
| `project_type`, `project_subtype` | no project type/subtype | GAP |
| `project_status` | `status`; controlled vocabulary translation required | PARTIAL |
| `project_status_date` | no status-effective date | GAP |
| `project_unit_metric` | no project-level metric field | GAP |
| `cad_trust_reference_project_id` | CADT-generated reference | EXTERNAL |
| `cad_trust_program_id` | no CADT programme FK | GAP |
| `created_at`, `updated_at` | `created_at` exists; no `updated_at` identified | PARTIAL |

### Project methodology — `/v2/project-methodology`
RupayKg currently has one required `carbon_projects.methodology_version_id`, not a many-to-many junction.

| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_project_methodology_id` | no relationship row/ID | GAP |
| `cad_trust_project_id` | internal `carbon_projects.id`, with external ID separate | PARTIAL |
| `cad_trust_methodology_id` | one `methodology_version_id` FK | PARTIAL |
| `project_methodology_date`, `project_methodology_description` | no relationship date/description | GAP |
| `created_at`, `updated_at` | no junction row | GAP |

Only add a join table if multiple methodologies per carbon project is a confirmed RupayKg product requirement.

### Validation — `/v2/validation`
RupayKg `verifications` are not a validation entity.

| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_validation_id`, `validation_id` | no validation ID/report model | GAP |
| `validation_type`, `validation_body` | no corresponding fields | GAP |
| `validation_date` | no validation date | GAP |
| `validation_credit_period_start_date`, `validation_credit_period_end_date` | no validation crediting period | GAP |
| `cad_trust_project_id` | no validation-to-carbon-project relationship | GAP |
| `created_at`, `updated_at` | no validation row | GAP |

### Verification — `/v2/verification`
RupayKg candidate: `verifications` (`verifier_identity_id`, `decision`, `scope`, `rationale`, `decided_at`, evidence/activity and authorization references).

| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_verification_id` | local `verifications.id` is not CADT ID | PARTIAL |
| `verification_id` | no external registry verification ID | GAP |
| `verification_start_date`, `verification_end_date` | only `decided_at`; no period | GAP |
| `verification_body` | verifier identity is a person, not necessarily the verification body | PARTIAL |
| `cad_trust_project_id` | indirect activity/evidence relation, no direct project FK | PARTIAL |
| `cad_trust_validation_id` | no validation FK | GAP |
| `created_at`, `updated_at` | `decided_at` is decision time, not CADT row timestamps | PARTIAL |

### Location — `/v2/location`
RupayKg candidates: `geography`, `carbon_projects.geography_id`.

| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_location_id` | external CADT ID | EXTERNAL |
| `location_country`, `location_region` | geography hierarchy/name/code; explicit code translation needed | PARTIAL |
| `location_gis` | no validated GIS geometry contract identified | GAP |
| `location_map_type`, `location_map_file_link` | no map format/file URL fields | GAP |
| `cad_trust_project_id` | project has one nullable `geography_id`; CADT location is child entity | PARTIAL |
| `created_at`, `updated_at` | geography has `created_at`, no `updated_at` | PARTIAL |

### Estimation — `/v2/estimation`
RupayKg candidate: `carbon_calculations` (`inputs`, `result`, `unit`, `calculated_at`, `baseline_result`, `uncertainty`, hashes and calculation trace).

| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_estimation_id` | local calculation ID is not CADT ID | PARTIAL |
| `estimation_start_date`, `estimation_end_date` | no explicit period columns | GAP |
| `estimation_unit_count` | `result` is candidate only; meaning/unit must be validated per methodology | PARTIAL |
| `estimation_reference_no` | no external estimation reference | GAP |
| `cad_trust_project_id` | `carbon_project_id` | PARTIAL |
| `created_at`, `updated_at` | `calculated_at` is calculation time, not row timestamps | PARTIAL |

### Rating — `/v2/rating`
| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_rating_id`, `rating_type`, `rating_name`, `rating_value`, `rating_link` | no dedicated project-rating model | GAP |
| `cad_trust_project_id` | no project-rating relationship | GAP |
| `created_at`, `updated_at` | no rating row | GAP |

### Co-benefit — `/v2/co-benefit`
RupayKg `esg_metrics` is adjacent, not equivalent by default.

| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_co_benefit_id` | no equivalent | GAP |
| `co_benefit_id` | `esg_metrics.esg_attribute/metric_code` candidate only after controlled vocabulary mapping | PARTIAL |
| `cad_trust_project_id` | ESG metric links to reporting period/activity, not directly to carbon project | GAP |
| `created_at`, `updated_at` | no co-benefit entity | GAP |

### Issuance — `/v2/issuance`
RupayKg candidates: `registry_events`, `credentials`, `environmental_attribute_claims`; none is an issuance-batch entity.

| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_issuance_id` | no issuance entity ID | GAP |
| `issuance_id` | `registry_events.external_reference` is event-level, not issuance ID | PARTIAL |
| `issuance_date` | `registry_events.created_at` is event record time, not issue date | PARTIAL |
| `cad_trust_verification_id` | verification FK exists on adjacent records, not issuance | PARTIAL |
| `cad_trust_project_methodology_id`, `cad_trust_location_id` | no relationship IDs | GAP |
| `created_at`, `updated_at` | no issuance row | GAP |

### Unit — `/v2/unit`
RupayKg candidates `epr_credits`, `credentials`, `environmental_attribute_claims` are **not safe equivalents** to carbon-credit units.

| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_unit_id`, `org_uid` | external CADT namespace | EXTERNAL |
| `unit_serial_id`, `unit_start_block`, `unit_end_block` | no carbon-unit serial/block range | GAP |
| `unit_count` | EPR/credential/claim quantities refer to different instruments | NOT EQUIVALENT |
| `unit_type`, `unit_vintage_year` | no carbon-credit unit type/vintage model | GAP |
| `unit_status`, `unit_status_reason`, `unit_status_date` | adjacent statuses have different lifecycle semantics | NOT EQUIVALENT |
| `unit_retirement_detail`, `unit_retirement_beneficiary`, `unit_retirement_beneficiary_id` | claim `retired_at` only; no beneficiary detail | PARTIAL |
| `unit_link`, `unit_itmos_reference_id` | no carbon-unit URL/ITMO reference | GAP |
| `unit_metric` | EPR/credential units are different instruments | NOT EQUIVALENT |
| `unit_current_owner` | ownership exists in other workflows, not carbon-unit owner | PARTIAL |
| `cad_trust_issuance_id` | no issuance parent | GAP |
| `created_at`, `updated_at` | adjacent timestamps are not carbon-unit timestamps | NOT EQUIVALENT |

**Non-negotiable:** never map EPR credits to CADT carbon units because both have quantities, units, issuers or transfers.

### Unit label — `/v2/unit-label`
| CADT field | RupayKg mapping | Status |
|---|---|---|
| `cad_trust_unit_label_id`, `cad_trust_label_id`, `cad_trust_unit_id` | no local carbon label or carbon-unit parent | GAP |
| `label_unit_date`, `label_unit_description` | no relationship record | GAP |
| `created_at`, `updated_at` | no relationship record | GAP |

## 3. Reusable domains — preserve and adapt

| RupayKg domain | Reuse |
|---|---|
| `carbon_projects` | Tenant-owned project identity, code, status, geography, mechanism, methodology version |
| `methodology_versions` | Versioned rules, applicability, parameter dictionary, equations, source hash and regression evidence |
| `ccts_methodology_registry` | Official CCTS catalogue evidence; not a universal CADT programme registry |
| `carbon_calculations` | Methodology-bound inputs/results, uncertainty, hashes and trace |
| `activities`, `resource_flows`, `measurements`, `mrv_observations` | Physical operations, material flows, measurements and field observations |
| `evidence` and artifact tables | Evidence object, hash, URI, capture and review/version chain |
| `verifications` | Internal verifier decision, scope, rationale and authorization snapshot |
| `mrv_provenance_events` | Guardian/HCS integrity provenance, separate from CADT registry IDs |
| `organizations`, memberships, roles | Stakeholder identity and tenant access |
| `geography`, `geography_sources` | Governed geography and source provenance |
| `registry_events`, `credentials` | Credential lifecycle/event history, not CADT issuance/unit |
| `environmental_attribute_claims` | Claim quantity, basis, framework, evidence, verification and retirement |

## 4. Adapter design and controls

- Keep RupayKg's canonical MRV, evidence, tenant, methodology and physical-activity domains authoritative.
- Add a provider-specific, versioned anti-corruption mapping layer; do not mirror CADT tables.
- Store CADT IDs separately from local UUIDs; never overload local primary keys.
- Quarantine unmapped fields, unknown picklists and ambiguous matches.
- Treat cross-registry duplicate matches as review signals, not automatic claim invalidation.
- Start with GET-only observer access; no CADT write credentials or publisher flow.
- Apply tenant-scoped access, data minimisation, pagination, rate limits, timeouts, schema validation and response provenance.
- Never infer project participation from tenant membership.
- Never equate validation with verification or EPR units with carbon-credit units.
- No automatic issue, transfer, retirement or claim mutation from imported records.

## 5. CADT v2 field and ordering rules

Pinned schema insert order: `program → methodology → stakeholder → label → project → project_methodology → validation → verification → location → estimation → rating → co_benefit → issuance → unit → unit_label`. This is documented for future publisher evaluation only; initial observer integration is read-only.

CADT instructs integrations to send only fields with `source=user_input`; `system` and `api_generated` values are generated by CADT. Validate picklists against the live governance endpoint when an authorised CADT node is available; the pinned schema picklists are a dated snapshot. Preserve required fields and array types; never infer missing registry facts.

## 6. Acceptance tests before connector code

1. Fixtures for all 15 entities and all fields listed above.
2. Required/type/date/URL/array/picklist validation.
3. Unknown/unmapped field quarantine with explicit reasons.
4. External-ID uniqueness and tenant-isolation tests.
5. Exact duplicate, probable match, related-but-not-duplicate and false-positive fixtures.
6. Explicit tests proving EPR credits cannot be exported as carbon-credit units.
7. GET-only contract; tests fail on POST/PUT/PATCH/DELETE.
8. Pagination, timeout, rate-limit, malformed-payload and outage tests.
9. Source timestamp, response hash and mapping-version provenance.
10. No automatic issue, transfer, retirement or claim mutation from imported CADT data.

## 7. Decision

**No CADT mirror schema and no 15-table clone.** The existing RupayKg database covers important source domains but lacks several CADT-specific registry relationships and lifecycle entities. Implement a pure, versioned mapping/validation package with fixtures first; propose a read-only adapter only after API terms, endpoint access, security and data-governance checks. No production migration, production query, CADT credential, registry write, Chia node, new paid service, certification claim or TRL uplift is included.
