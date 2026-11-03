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
