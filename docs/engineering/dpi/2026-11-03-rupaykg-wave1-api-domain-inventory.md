# RupayKg Wave 1 — API surface and domain contract inventory

**Date:** 2026-11-03  
**Baseline:** main at a3fecc0abd2c46549a201058d3963afc0e3a73c9  
**Wave 1 RFC:** docs/engineering/dpi/2026-11-03-rupaykg-wave1-cdpi-foundation-rfc.md  
**Purpose:** Establish a source-backed inventory for OpenAPI, JSON Schema and partner conformance contracts.  
**Evidence boundary:** Static source inspection only. No runtime calls, database reads/writes, migrations, production configuration or live partner calls were performed.

## 1. Mainline API documentation status

The existing docs/API.md defines useful high-level principles: all endpoints are versioned under /api/v1; success means the contract operation completed; dependency failures remain dependency failures; synthetic/demo data is explicitly marked; mutations authenticate, authorise, validate, persist and audit transactionally; and external authority references/status are persisted.

The mainline Git tree contains no discovered OpenAPI/Swagger document and no general API JSON Schema directory. docs/API.md is a 25-line principles document. Guardian policy schemas exist for a specific policy, but they are not a substitute for RupayKg public/partner API schemas.

**Finding:** Complete machine-readable partner contracts are not evidenced. OpenAPI and general domain JSON Schemas remain Wave 1 deliverables.

## 2. Pinned source inventory

| Source file | Mainline blob SHA | Contract domain |
|---|---|---|
| apps/src/server.ts | ecdd9c49b27f1aef02c07e3f7a79f872d07a7f06 | Health/status, overview, regulatory sources, geography, resource flows, measurements, sync and route registration |
| apps/src/auth.ts | 49a16d3c0ac7399c8a677b6530f0c6ab72e9b8c3 | Identity, session, verified memberships, active organisation, permissions |
| apps/src/registry-routes.ts | a2d82ee7d9ae94adc8dfbbdc0e3a751f0d0a3f03 | Environmental credentials, lifecycle events, settlement |
| apps/src/evidence-vault-routes.ts | 797f9ff77e8442d3752c20bc1698b400777c8ea3 | Evidence upload, listing, download, review |
| apps/src/mrv-routes.ts | 450e2b621160d8ed952b18d00d1f1b8f3b374e88 | Guardian submission, MRV provenance, Hedera/Mirror Node verification |
| apps/src/workspace-routes.ts | 17de4663018f6b9293d5663a9f99cf116a40c8ab | Domain workspaces and evidence verification |
| apps/src/bwg-routes.ts | 1afcc80d2e21bb0c1215a1c53d4ef251b75367cc | EPR obligation read |
| apps/src/cpcb-swm-routes.ts | ef46fc1635e1813fbf943b7d15d862801ec3c676 | CPCB SWM workspaces |
| apps/src/value-routes.ts | 7e02adc1d4f1cf170c09bd7010b54637934f4a6f | Carbon calculations, EPR assessment, ESG metrics, BWG reporting |
| apps/src/sync-routes.ts | 457e8a53a3efa0b6e045a0b4e737212a36b0b63f | Field devices, offline envelopes, conflicts |
| apps/src/onboarding-hierarchy-routes.ts | 2a92730980d5b229ab0fd882f930762b61599da6 | Onboarding review and legal verification |
| docs/API.md | 91262df2f606c3f2fb772dbad300024072d58878 | Existing API contract principles |
| docs/REGISTRY.md | 2d88e5ede1f86cd4f02cb669e73c52a88954c30d | Credential/registry lifecycle principles |
| docs/MRV_EVIDENCE_VAULT.md | 6897c27084c3edf76c27316d67cf652330a628c1 | Evidence API and operational limitations |

These hashes pin the inspection snapshot only. Re-fetch source files before implementation because active PRs may change them.

## 3. Endpoint inventory (mainline only)

This list records route declarations found in inspected source. It does not assert that every route is safe for external exposure or production use.

### Platform and operational API — server.ts

| Method | Path | Contract purpose |
|---|---|---|
| GET | /health | Service and database readiness |
| GET | /api/v1/status | Service version and source-of-truth metadata |
| GET | /api/v1/overview | Authenticated aggregate dashboard |
| GET | /api/v1/regulatory/sources | Regulatory source catalogue |
| GET | /api/v1/geography/roots | Authorised geography roots |
| GET | /api/v1/geography/children/:parentId | Authorised geography children |
| POST | /api/v1/operations/sync | Operational sync |
| POST | /api/v1/resource-flows | Record a resource/material flow |
| POST | /api/v1/activities/:activityId/measurements | Record a measurement |

### Credentials and settlement — registry-routes.ts

| Method | Path | Contract purpose |
|---|---|---|
| POST | /api/v1/credentials | Issue environmental credential |
| POST | /api/v1/credentials/:credentialId/activate | Activate credential |
| POST | /api/v1/credentials/:credentialId/transfer | Transfer credential |
| POST | /api/v1/credentials/:credentialId/retire | Retire credential |
| POST | /api/v1/settlements | Create settlement |
| POST | /api/v1/settlements/:settlementId/authorize | Authorise settlement |
| POST | /api/v1/settlements/:settlementId/settle | Settle transaction |
| POST | /api/v1/settlements/:settlementId/confirm | Confirm settlement |

### Evidence and MRV

| Method | Path | Contract purpose |
|---|---|---|
| POST | /api/v1/evidence-vault/upload | Upload evidence artifact |
| GET | /api/v1/evidence-vault | List evidence versions for activity |
| GET | /api/v1/evidence-vault/:evidenceId | Retrieve evidence artifact |
| POST | /api/v1/evidence-vault/:evidenceId/review | Record reviewer decision |
| GET | /api/v1/mrv/status | Guardian/Hedera status |
| POST | /api/v1/mrv/activities/:activityId/submit | Submit MRV evidence to Guardian/Hedera |
| GET | /api/v1/mrv/provenance/:activityId | Read persisted MRV provenance |
| GET | /api/v1/mrv/hedera/verify/:consensusTimestamp | Verify persisted HCS anchor through Mirror Node |

### Workspaces

| Method | Path | Contract purpose |
|---|---|---|
| GET | /api/v1/workspaces/resource-flows | Resource-flow workspace |
| GET | /api/v1/workspaces/mrv | MRV workspace |
| POST | /api/v1/evidence/:evidenceId/verification | Record evidence verification |
| GET | /api/v1/workspaces/compliance | Compliance workspace |
| GET | /api/v1/workspaces/carbon | Carbon workspace |
| GET | /api/v1/workspaces/registry | Registry workspace |
| GET | /api/v1/workspaces/settlement | Settlement workspace |
| GET | /api/v1/workspaces/esg | ESG workspace |

### EPR, BWG, CPCB, carbon and ESG

| Method | Path | Source | Contract purpose |
|---|---|---|---|
| GET | /api/v1/epr/obligations | bwg-routes.ts | EPR obligations read |
| GET | /api/v1/cpcb-swm/workspaces | cpcb-swm-routes.ts | CPCB SWM workspace list |
| POST | /api/v1/cpcb-swm/workspaces | cpcb-swm-routes.ts | Create CPCB SWM workspace |
| PATCH | /api/v1/cpcb-swm/workspaces/:workspaceId | cpcb-swm-routes.ts | Update CPCB SWM workspace |
| POST | /api/v1/carbon/calculations | value-routes.ts | Carbon calculation |
| POST | /api/v1/epr/obligations/:obligationId/assess | value-routes.ts | Assess EPR obligation |
| POST | /api/v1/esg/reporting-periods/:periodId/metrics | value-routes.ts | Record ESG metric |
| GET | /api/v1/workspaces/bwg | value-routes.ts | BWG workspace |
| POST | /api/v1/bwg/profile | value-routes.ts | Create/update BWG profile |
| POST | /api/v1/bwg/reporting-periods | value-routes.ts | Create reporting period |
| POST | /api/v1/bwg/reporting-periods/:periodId/waste | value-routes.ts | Record BWG waste report |
| POST | /api/v1/bwg/reporting-periods/:periodId/epr | value-routes.ts | Record BWG EPR report |
| POST | /api/v1/bwg/reporting-periods/:periodId/esg | value-routes.ts | Record BWG ESG report |

### Offline sync and onboarding

| Method | Path | Source | Contract purpose |
|---|---|---|---|
| POST | /api/v1/field-devices/enroll | sync-routes.ts | Enrol field device |
| POST | /api/v1/field-devices/:deviceId/verify | sync-routes.ts | Verify field device |
| GET | /api/v1/field-devices | sync-routes.ts | List authorised field devices |
| POST | /api/v1/field-sync/envelopes | sync-routes.ts | Submit offline envelope |
| POST | /api/v1/field-sync/envelopes/:envelopeId/apply | sync-routes.ts | Apply offline envelope |
| GET | /api/v1/field-sync/conflicts | sync-routes.ts | List sync conflicts |
| POST | /api/v1/field-sync/conflicts/:conflictId/resolve | sync-routes.ts | Resolve sync conflict |
| GET | /api/v1/onboarding/review-queue | onboarding-hierarchy-routes.ts | Onboarding review queue |
| POST | /api/v1/onboarding/applications/:applicationId/verify-legal | onboarding-hierarchy-routes.ts | Verify legal documents |
| POST | /api/v1/onboarding/applications/:applicationId/:action | onboarding-hierarchy-routes.ts | Apply onboarding action |

## 4. Contract families to author

Create schemas by bounded domain rather than one giant schema file:

1. Common: Problem/error envelope, Page, SourceProvenance, AuditReference, DataClassification, Idempotency.
2. Identity and authority: IdentityReference, OrganisationReference, MembershipStatus, ActiveOrganisationContext, DelegationGrant, ConsentRecord.
3. Geography: GeographyReference, JurisdictionReference, GeographyScope.
4. Operations: Activity, ResourceFlow, Measurement, FieldDevice, OfflineEnvelope, SyncConflict.
5. Evidence: EvidenceRecord, EvidenceArtifactVersion, EvidenceReview, VerificationDecision.
6. MRV: MethodologyReference, Observation, MRVSubmission, ProvenanceEvent, ExternalAnchor.
7. Registry: CredentialRecord, CredentialStatus, RegistryEvent, IssuerReference, SettlementReference.
8. Compliance/reporting: RegulatorySource, EPRObligation, EPRAssessment, BWGProfile, ReportingPeriod, ESGMetric.

Do not create schemas solely from UI labels. Trace persisted columns, runtime validation, state machine, source of truth and actual response serialization. Preserve PostgreSQL numeric values and measurement units without accidental floating-point loss or unit ambiguity.

## 5. Immediate contract authoring order

| Priority | Contract family | Reason | Acceptance |
|---|---|---|---|
| P0 | Common error, auth scope and organisation context | Required by every partner contract | Stable codes/statuses; no caller-controlled tenant selection |
| P1 | Organisation, facility and geography references | Required for participant onboarding and authorised scope | Source authority, identifier namespace and version are explicit |
| P1 | Activity, resource flow and measurement | Core operational records | Units, timestamps, provenance, idempotency and correction semantics explicit |
| P1 | Evidence and verification | Required for MRV and EPR traceability | Hash, media type, source, version, reviewer and verification meaning explicit |
| P1 | MRV provenance | External trust boundary | Guardian/HCS/Mirror Node statuses and external references are not conflated |
| P2 | Credentials and settlement | High-impact lifecycle and financial semantics | Issuer authority, status, ownership, approvals and legal boundary reviewed |
| P2 | Compliance/reporting | Statutory reporting workflows | Statutory source/version/applicability and methodology are traceable |

## 6. Security and interoperability findings

### 6.1 Mainline tenant-boundary gap

Static inspection of pinned mainline files shows the API server creates a shared PostgreSQL Pool; authentication in auth.ts receives that pool; and multiple route modules perform independent pool.query calls for authentication, permission checks and protected data reads/writes. server.ts also has generic pool-backed query helpers.

This is not the required universal signed tenant-context transaction boundary. Newer EPR/MRV draft PRs are targeted branch changes and do not make the mainline finding disappear. Do not publish external API guarantees or enable RLS on the assumption that every route is already tenant-safe.

### 6.2 Contract exposure policy

- Public unauthenticated endpoints must be explicitly enumerated and reviewed; a route being readable in code is not enough.
- Partner endpoints require authenticated client identity, audience, scopes, tenant context and data-sharing purpose.
- A request-supplied organizationId may be a requested scope, but server-side verified membership and authorisation must be authoritative.
- Return generic 404/403 behaviour that does not disclose cross-tenant record existence.
- Do not expose internal database IDs as globally portable identifiers without namespace and authority semantics.
- Do not promise synchronous success for an external authority action unless the authoritative result is actually persisted.
- All state transitions define idempotency, concurrency, replay and correction semantics.

### 6.3 Evidence and credential semantics

Existing docs/REGISTRY.md requires persisted source activity/measurement, verified evidence, methodology/calculation where applicable, configured issuer trust root and recorded authorisation before issuance. Its lifecycle is ISSUED -> ACTIVE -> TRANSFERRED -> RETIRED. The external API profile must add issuer authority, credential format, subject binding, validity, status/revocation, schema version, presentation and dispute semantics without weakening those gates.

Existing docs/MRV_EVIDENCE_VAULT.md documents a bounded PostgreSQL bytea store (5 MiB per file), SHA-256, immutable version/review rows, reviewer separation and explicit limitations: not large-scale object storage, malware scanning, OCR, legal admissibility or retention certification. Do not market it as a production evidence repository beyond the documented capability.

## 7. Required next implementation artefacts

1. Route-to-actor-to-resource-to-table matrix for every endpoint above.
2. Machine-readable OpenAPI draft generated from actual route request/response validation, not inferred placeholders.
3. JSON Schemas for common and first operational/evidence families.
4. Contract tests for required/optional fields, unknown fields, units, timestamps, idempotency, pagination and error mapping.
5. Independent mock participant/client using only published contracts (no direct DB access).
6. Security review of public/partner exposure, tenant scope and privacy classification.
7. Exact-head CI and disposable PostgreSQL two-tenant acceptance for any code changes.

**Disposition:** Inventory complete for inspected mainline route declarations; request/response schema completeness and tenant safety remain unproven. This document is not an API release contract.


## 8. First-pass route-module to table-family mapping

This is a source-level discovery map, not the final route-by-route authorisation matrix. It lists concrete table references found in SQL statements in each pinned module. The final matrix must resolve each endpoint to exact operations, row ownership, policy class, actor permissions and same-client transaction behaviour. Dynamic SQL, CTE aliases and helper calls require manual review.

| Module | Observed domain tables (deduplicated) | Initial access class |
|---|---|---|
| server.ts | activities, credentials, evidence, geography, measurements, obligations, organization_geography_scopes, organization_memberships, regulatory_sources, resource_flows, settlements, verifications | Mixed: global regulatory/geography reference plus organisation-owned operational records |
| auth.ts | activities, evidence, identities, identity_sessions, organization_memberships, roles | Identity/authentication control plane plus organisation membership |
| registry-routes.ts | activities, credentials, evidence, mrv_provenance_events, organization_memberships, organizations, registry_events, settlement_events, settlements, verifications | Organisation-owned credential/settlement lifecycle with cross-party transfer semantics |
| evidence-vault-routes.ts | activities, evidence, evidence_artifact_reviews, evidence_artifact_series, evidence_artifact_versions, verifications | Organisation-owned evidence and append-only review/audit history |
| mrv-routes.ts | activities, evidence, measurements, mrv_observations, mrv_provenance_events, organization_memberships, verifications | Organisation-owned MRV records plus external-provider provenance |
| workspace-routes.ts | activities, carbon_calculations, credentials, esg_metrics, esg_reporting_periods, evidence, geography, measurements, methodology_versions, obligations, organization_memberships, organizations, registry_events, resource_flows, settlements, verifications | Read projections across multiple domain-owned resources; requires per-source permission and tenant scoping |
| bwg-routes.ts | epr_obligations, epr_schemes, geography, obligations | Statutory/reference scheme plus organisation/jurisdiction-scoped obligations |
| cpcb-swm-routes.ts | audit_events, cpcb_swm_stakeholder_workspaces, cpcb_swm_status_history, organization_memberships | Organisation-scoped workspace plus append-only audit/status history |
| value-routes.ts | activities, bwg_epr_reports, bwg_esg_reports, bwg_profiles, bwg_reporting_periods, bwg_waste_reports, carbon_calculations, epr_credits, epr_obligations, epr_schemes, esg_metrics, esg_reporting_periods, evidence, geography, methodology_versions, obligations, organization_geography_scopes, organization_memberships, verifications | Mixed statutory references and organisation-owned reporting/value records |
| sync-routes.ts | activities, audit_events, evidence, field_devices, field_sync_conflicts, field_sync_cursors, field_sync_envelopes, measurements, organization_memberships, resource_flows | Device principal, organisation-owned operational records and append-only sync/audit events |
| onboarding-hierarchy-routes.ts | geography, identities, organization_geography_scopes, organization_memberships, organization_verification_evidence, organizations, roles, stakeholder_application_approvals, stakeholder_applications | Identity/authority control plane, organisation onboarding and geography references |

### 8.1 Table policy classes to confirm against the full schema

- **Identity/auth control plane:** identities, identity_sessions, roles, organization_memberships. Access must not be inferred from ordinary tenant row ownership; session revocation and membership state must remain authoritative.
- **Organisation-owned operational:** activities, resource_flows, measurements, evidence, obligations, reporting periods, profiles and workspace rows. Each requires explicit owner/tenant policy and parent-child consistency.
- **Evidence and audit append-only:** evidence_artifact_versions, evidence_artifact_reviews, verifications, registry_events, settlement_events, audit_events, field_sync_envelopes and field_sync_conflicts. Define append/read rules, correction semantics and retention separately.
- **External/source registries and reference:** geography, regulatory_sources, epr_schemes, methodology_versions. Establish authority, update provenance, freshness and permitted projections; do not apply generic tenant-owned policy.
- **Cross-organisation/bilateral:** credentials, registry ownership/transfer history, settlements and EPR credits. Define both parties' visibility and allowed state transitions explicitly; a single organization_id policy is insufficient.
- **External trust/provenance:** mrv_provenance_events. Separate local activity ownership from external Guardian/HCS/Mirror Node claims and preserve provider references/read-back evidence.

The table classes above are hypotheses to validate against complete DDL, constraints, triggers, views, functions, worker principals and actual data. They are not approved RLS policies.

## 9. Specific source-backed contract cautions

1. The mainline server.ts uses a shared Pool and generic pool-backed query helper. Auth is invoked with that Pool. Multiple mainline route modules still issue independent pool queries for permission and protected data access. Route-level signed-context PRs are separate, unmerged branch work.
2. Geography has both source-owned reference semantics and organisation_geography_scopes. The public/partner schema must not imply that the platform is the authoritative creator of every geography identifier.
3. Evidence Vault stores bounded files in PostgreSQL bytea with a documented 5 MiB limit. Contract size limits and content-type validation must match actual implementation and must not claim malware scanning or legal admissibility.
4. Credentials are currently an internal RupayKg registry record/lifecycle. Do not describe them as W3C VCs until issuer, holder, verifier, format, signature, status and trust-registry interoperability are actually implemented and tested.
5. MRV provenance has distinct Guardian, Hedera consensus and Mirror Node verification states. Do not collapse these into a single VERIFIED flag.
6. Settlement routes are high-impact and require a separate financial authority, regulated partner and reconciliation review before any external API contract or payment integration.
7. Regulatory sources, EPR schemes, methodologies and statutory applicability need source/version/effective-date provenance. A platform calculation or assessment must not be represented as an official statutory determination.

## 10. Next route-matrix work

The next technical artefact must be a route-by-route matrix with one row per endpoint and these columns: method/path, auth required, actor class, permission, active-organisation rule, geography rule, input fields, response fields, tables read, tables written, transaction/client, external dependencies, idempotency/replay, audit event, data classification, and known test coverage.

Do not mark an endpoint contract-ready until its route-specific input/output schema and its authorization/data-access path have both been traced. Prioritise common auth/context, organisation/geography, resource flows/measurements, evidence, and MRV; defer settlement and external credential exchange until their separate assurance reviews.


## 10.1 Field-data contract and provenance blockers

The mainline API surface has a stronger offline field-sync envelope than its direct operational endpoints, but the two paths are not yet semantically equivalent:

- Direct resource-flow and measurement routes are inline in server.ts and perform permission/geography checks via pool calls before a separate pool insert. They lack a single transaction and idempotency key.
- The measurements table already has captured_by_identity_id, device_id, latitude, longitude and location_accuracy_m, but the direct measurement route does not populate these fields.
- resource_flows currently has no idempotency key or actor/device provenance columns.
- Offline envelopes persist actor, device, capture time, client sequence, idempotency key, payload hash and applied entity link. However device authorization is checked before the intake transaction; organization binding is not checked against active organization; apply does not revalidate the device or pass device context to applyOperation.
- Offline MEASUREMENT_CREATE does not populate measurement captured_by_identity_id/device_id or create the corresponding mrv_observations instrument/uncertainty/evidence lineage. EVIDENCE_CREATE captures identity but omits device_id; ACTIVITY_CREATE captures actor but omits device_id.

**Contract rule:** use one canonical field-operation schema across online and offline paths. It must identify actor, verified organization, assigned device, capture and observation timestamps, idempotency, geography, instrument/sensor identity, method/version, unit, uncertainty/quality, and evidence references. The server derives actor and organization authority from authenticated membership and the enrolled device; clients cannot self-assert these as authoritative claims. Domain records must retain a stable envelope/source link. Do not label a raw measurement as an MRV observation or verified evidence.

Runtime validation is currently manual in the inline routes; introduce versioned JSON Schema and attach it to Fastify routes before generating the OpenAPI 3.x partner contract. Keep draft/internal until same-client authorization, device-org binding, two-tenant/two-device negative tests and provenance linkage pass.


## 10.2 CDPI Wave 1 machine-readable field-operation target schema

Added contracts/schemas/field-sync-envelope.v1.schema.json as a JSON Schema 2020-12 draft target for the canonical field-sync envelope and its four allow-listed operation types: ACTIVITY_CREATE, MEASUREMENT_CREATE, EVIDENCE_CREATE and RESOURCE_FLOW_CREATE.

The schema makes the trust boundaries explicit: deviceId resolves to an enrolled field_devices record; organizationId is a declared target that must be checked against the authenticated active organization and immutable device binding; actor/device authority is server-derived; payload hash, server cursor and received time are server-generated; idempotency and sequence conflicts are authoritative server decisions. Measurement target fields include instrument identity, calibration evidence, uncertainty, GPS accuracy, method version and evidence links so a raw quantity is not mistaken for an MRV observation.

**Status is deliberately draft-target-not-runtime-enforced.** Current sync-validation.ts only performs manual checks for envelope basics and applyOperation performs manual operation-specific checks. The schema is not yet attached to Fastify route validation, the current runtime does not accept every target field, and no external OpenAPI contract is approved. Next implementation steps: align the runtime validators and persistence mappings, add negative contract tests, attach the schema to Fastify, then generate OpenAPI 3.1 from the same source. Do not publish to partners until tenant/device and provenance acceptance passes.
