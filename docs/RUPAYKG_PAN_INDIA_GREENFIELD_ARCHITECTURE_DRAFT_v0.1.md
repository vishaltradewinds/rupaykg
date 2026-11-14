# RupayKg — Pan-India Greenfield Platform Architecture (Draft)

- **Document ID:** RKG-ARCH-GREENFIELD-001
- **Version:** 0.1-draft
- **Date:** 2026-10-26
- **Status:** Architecture proposal for engineering validation; not production certification.
- **Guiding rule:** Build the national platform from requirements. Do not make legacy data recovery or migration a critical path unless a specific legal, contractual, or product acceptance requirement proves it necessary.

## 1. Aim

Build one usable, secure, pan-India platform connecting bulk waste generators, aggregators, transporters, recyclers/processors, facility operators, auditors/verifiers and authorized public-sector stakeholders. The platform must support multiple waste categories and operating models without being tied to one city, landfill, pilot, device vendor, or single generator.

## 2. Product principles

1. **Pan-India by design:** state, district, urban local body, facility, material category and applicable rule sets are configurable data, not hard-coded pilot assumptions.
2. **Multi-organization:** each participant belongs to an organization; access is scoped by organization, site, role and permitted workflow.
3. **Evidence before claims:** every material movement, measurement, processing event, correction and MRV result has attributable evidence and an audit trail.
4. **Hardware-vendor neutral:** use documented adapters and protocols. Exact model approval/conformity is checked per device and deployment; no blanket claim that all hardware is MeitY-approved.
5. **Offline-tolerant field operations:** mobile-first capture, local pending queue, idempotent sync, conflict handling and visible sync state; offline data is not treated as verified until validation rules pass.
6. **No invented regulatory authority:** rules and methodologies are versioned, source-linked and approval-gated. Registry presence is not implementation, authorization or credit issuance.
7. **Free-first and reversible:** no paid recovery/upgrade without explicit approval; isolate changes and retain rollback paths.
8. **Deployment last:** architecture and test work can proceed in development/staging while live database mapping remains unverified; do not switch the live connection to make progress.

## 3. Stakeholder roles

- **Bulk waste generator:** register site, declare material/quantity, request collection, review custody handoff and reconcile receipts.
- **Aggregator/collection operator:** accept jobs/lots, consolidate lots with traceable parent-child links, record custody and weighment.
- **Transporter:** accept manifest, record vehicle/driver authorization as applicable, custody handoffs, route/time events and delivery exceptions.
- **Recycler/processor:** receive and weigh lots, inspect material, record process batches, outputs, rejects/residues and supporting evidence.
- **Facility/site operator:** maintain site, scale/device and operational status; report calibration, maintenance and exceptions.
- **Auditor/verifier:** access authorized evidence packages, review provenance and record findings without silently editing source events.
- **Government/program administrator:** manage approved program configuration and access scoped reports; cannot bypass audit or evidence controls.
- **Platform administrator/support:** manage tenant onboarding and technical support with audited, least-privilege access; no unlogged impersonation.

## 4. Core workflow

1. Organization and site onboarding; verification status is explicit.
2. Material/waste declaration using a versioned material taxonomy.
3. Collection order or transfer request.
4. Lot creation with source, material, estimated quantity, unit and evidence.
5. Weighment/measurement event with device/manual method, calibration context, operator, time, unit, quality flags and raw-evidence reference.
6. Custody transfer: sender and receiver confirmations, manifest, transporter and vehicle references where required.
7. Facility receipt: received quantity, variance reason, contamination/rejection and evidence.
8. Processing batch: input lots, process method/version, output fractions, rejects/residues, yield and supporting measurements.
9. Evidence validation and exception resolution.
10. MRV calculation using an approved, versioned methodology and explicitly declared boundaries/assumptions.
11. Human review/verification where required; immutable decision event with reviewer and reason.
12. Reports/export and authorized downstream claims only when eligibility and authorization are independently satisfied.

Every transition records actor, organization, timestamp, previous/new state, evidence references, reason, correlation/idempotency key and schema/methodology version. Corrections append a superseding event; they do not erase the original record.

## 5. Initial domain model (logical, not a database migration)

- `Organization`, `OrganizationMembership`, `Role`, `Permission`
- `Site`, `Facility`, `Jurisdiction`, `ProgramConfiguration`
- `MaterialCategory`, `MaterialTaxonomyVersion`
- `WasteDeclaration`, `CollectionOrder`, `Lot`, `LotRelationship`
- `CustodyManifest`, `CustodyEvent`, `TransportAssignment`
- `MeasurementEvent`, `Device`, `DeviceModel`, `CalibrationRecord`, `DeviceHealthEvent`
- `FacilityReceipt`, `ProcessingBatch`, `OutputFraction`, `RejectOrResidue`
- `EvidenceObject`, `EvidenceLink`, `EvidenceValidation`
- `Methodology`, `MethodologyVersion`, `MRVRun`, `MRVResult`, `ReviewDecision`
- `AuditEvent`, `OutboxEvent`, `IntegrationDelivery`, `IncidentOrException`

Design requirements:
- Tenant and site scope enforced server-side; client-supplied organization IDs are never authorization.
- Stable IDs, foreign keys, explicit units, UTC timestamps plus recorded source timezone where relevant, and versioned enumerations.
- Quantity/unit conversions are explicit, deterministic and tested; no silent rounding.
- Evidence metadata includes source, capture time, content hash, MIME/type, uploader/device identity, access classification and retention policy. Binary evidence is stored separately from transactional rows using a controlled object-storage abstraction.
- Append-only audit history for security-sensitive actions and domain transitions.
- Idempotency keys for ingest/sync APIs and duplicate/replay detection for device events.
- PII minimization, retention schedules and access/export controls appropriate to applicable law and contract.
- Database migrations are additive where practical, reviewed, tested on disposable/non-production databases, and have a rollback or forward-fix plan.

## 6. API surface (candidate namespaces)

- `/api/v1/organizations`, `/sites`, `/memberships`
- `/materials`, `/declarations`, `/collection-orders`
- `/lots`, `/custody-manifests`, `/measurements`
- `/facilities/receipts`, `/processing-batches`
- `/devices`, `/device-models`, `/calibrations`, `/device-events`
- `/evidence`, `/evidence-validations`
- `/methodologies`, `/mrv-runs`, `/review-decisions`
- `/audit-events`, `/reports`, `/health`

These are candidate contracts, not a claim that all endpoints currently exist. Define OpenAPI request/response schemas, error codes, pagination, filtering, authorization rules, idempotency, rate limits and audit expectations before implementing each slice.

## 7. Hardware anchor layer

Use a hardware adapter interface so the core workflow does not depend on one vendor or bus:
- weighing scales/weighbridges and serial/RS-232/RS-485/Ethernet/mobile capture where applicable;
- GPS/vehicle telemetry where justified and lawful;
- site-level environmental/process sensors only where the selected methodology requires them;
- signed device identity, monotonic sequence/counter where supported, timestamp quality, calibration status, firmware/model identity and health/diagnostic events;
- store raw readings and normalized values with conversion/version metadata;
- tolerate intermittent connectivity with a bounded encrypted queue and idempotent upload;
- make manual entry an explicitly labelled fallback with reason and independent evidence requirements.

Before procurement or deployment, verify exact manufacturer/model and applicable MeitY procurement terms, BIS, WPC, electrical/EMC, legal-metrology and calibration requirements as applicable to that specific device and use. Do not infer compliance from brand, interface, or a generic category.

## 8. Security and trust boundaries

- Authentication is not authorization. Enforce organization/site/role scopes on every protected API and object retrieval.
- Separate runtime and migration identities; runtime role receives only required privileges.
- Explicit TLS certificate and hostname verification to the chosen database and integrations.
- Secrets only in deployment secret stores; never in source, logs, evidence exports or support tickets.
- Production must fail closed on missing/unsafe configuration and must never seed synthetic acceptance fixtures.
- Verify CORS/security headers, rate limiting, request size limits, upload scanning, webhook signatures, replay prevention and abuse controls.
- Audit privileged actions, role changes, exports, evidence replacement attempts and methodology configuration.
- Define incident response, backup/restore, RPO/RTO, retention and breach escalation before production.

## 9. Greenfield build sequence

**Batch A — Product contracts:** user journeys, role matrix, state machine, evidence checklist, OpenAPI contracts and acceptance criteria.

**Batch B — Core vertical slice:** organization/site onboarding → lot creation → measurement → custody handoff → facility receipt, backed by a clean development schema and non-production fixtures.

**Batch C — Processing and MRV:** processing batches, input/output reconciliation, methodology versioning, deterministic calculation tests and reviewer workflow.

**Batch D — Hardware anchor:** device registry, model/conformity register, adapter contract, calibration and raw measurement event validation; add specific hardware integrations only after exact requirements are known.

**Batch E — Nationalization:** configurable jurisdiction/program/material taxonomies, language/accessibility, bulk operations, exports, operational monitoring and onboarding tools.

**Batch F — release gates:** tenant-isolation/security testing, authenticated end-to-end tests, restore drill, field/device evidence, independent review and a reversible deployment plan.

Each batch must end with requirement → evidence → analysis → decision → owner → status → traceability. Use PASS / FAIL / BLOCKED / NOT VERIFIED / NOT APPLICABLE with explicit rationale. Do not call a design draft a deployed capability.

## 10. Explicitly out of scope for the first greenfield batches

- Bulk migration or reconciliation of legacy database rows.
- Recovery/payment for a suspended historical database.
- Assuming either existing Neon project is the live production database.
- Claiming operational pilot completion, regulatory certification, credit issuance or hardware approval without direct evidence.
- Switching the live database, merging release PRs or deploying before the applicable release gates pass.

## 11. Initial acceptance criteria

- A new organization can be created and assigned scoped members without seeing another tenant's data.
- A lot can progress through collection, measurement, custody, receipt and exception handling with a complete traceable event history.
- Duplicate API/device submissions are safely idempotent or quarantined for review.
- Every measurement preserves unit, method, timestamp, source/device/manual flag, calibration context and evidence reference.
- Processing inputs/outputs and variance reasons are validated and reproducible.
- An MRV result identifies the exact methodology version, inputs, assumptions, calculation version and reviewer decision; unapproved methodology cannot create an authorized claim.
- Synthetic fixtures cannot be created in production.
- CI exercises positive, negative, cross-tenant, replay, malformed-input and failure-recovery paths.
- A clean development database can be initialized from migrations without importing legacy data.

**Current implementation status:** architecture proposal only. Each capability must be checked against the repository and implemented/tested in separate batches. Production remains on hold until release-specific gates pass.
