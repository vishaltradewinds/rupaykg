# RupayKg Design System

## Product
RupayKg is India's Circular Economy Operating System for urban and rural resource flows, digital MRV, carbon accounting, EPR compliance, ESG reporting, registry and governed settlement.

## Product acceptance contract
The platform is complete only when each stakeholder can accomplish the outcomes relevant to their role from authoritative platform state. A passing build or deployment is not, by itself, product readiness.

### Stakeholder outcomes
- **Generators:** onboard an organization, establish jurisdiction, record waste/resource activities, attach evidence, track verification and understand compliance obligations.
- **Collectors/aggregators:** manage collection activities, quantities, locations, handovers, evidence and operational exceptions.
- **Transporters:** manage assigned movements, origin/destination, manifests, chain-of-custody evidence and delivery status.
- **Processors/recyclers:** record intake, measurement, processing/recovery outputs, evidence, verification and traceability.
- **ULBs/municipalities:** operate within authorized geography, monitor collection/segregation/processing flows, review evidence and prepare authoritative reporting records.
- **Rural local bodies:** operate the same governed lifecycle for rural/Gram Panchayat contexts with jurisdiction-aware workflows.
- **MRV/verifiers:** inspect evidence, verify or reject within explicit authorization, record rationale and preserve an auditable history.
- **Carbon/project operators:** progress from measured activity through governed methodology/calculation, verification and eligible environmental value without fabricating issuance.
- **EPR participants:** manage applicable obligations and evidence for the relevant waste ecosystem, while distinguishing RupayKG records from regulator portal submission/acceptance.
- **ESG teams:** trace ESG metrics back to operational evidence and verification and prepare applicable BRSR/BRSR Core/value-chain reporting data.
- **Registry operators:** issue, transfer and retire credentials only through authorized lifecycle controls with append-only events and immutable external references where required.
- **Buyers/beneficiaries:** inspect provenance, ownership, status, transfer/retirement and settlement evidence before relying on a value.
- **Administrators/governance:** manage stakeholders, roles, organization/geography scope, exceptions, auditability and system health without bypassing authorization.
- **Regulators/external authorities:** receive only records that are explicitly identified as prepared/submitted/accepted; RupayKG must never infer or fabricate external authority decisions.

### End-to-end lifecycle
Every supported workflow must preserve the chain:

**Generation → Aggregation → Measurement → Transport → Processing → Evidence → Verification → Value Calculation → Certification/Issuance → Registry → Transfer/Retirement → Settlement → Reporting**

A workflow may stop before a later stage when the required authority, evidence, integration or permission is unavailable. The UI must show that boundary explicitly.

### Authoritative state rules
1. PostgreSQL/backend state is the source of truth for platform records.
2. UI state is a projection and must not invent records, approvals, certificates, transactions or external submissions.
3. Every important record should expose organization, authorized geography, lifecycle status, timestamps and evidence/provenance where applicable.
4. Operational record, evidence-backed record, verified record, prepared report, externally submitted report and externally accepted report are distinct states.
5. External regulator/registry/payment authority state must be represented separately unless a real integration has confirmed it.
6. Organization and geography boundaries must fail closed.
7. Permissions must be enforced server-side; hiding a UI control is not authorization.
8. Demo/simulated data must be explicitly labelled and must never appear as production evidence.

## Design principles
1. Evidence before value: operational claims must show their evidence and verification state.
2. Stakeholder outcome first: screens are organized around what a role needs to accomplish, not around backend tables.
3. Government/institutional grade: clear hierarchy, restrained visual language, auditability and accessibility.
4. One national model: urban and rural workflows use shared concepts while allowing different operating realities.
5. Field first: mobile workflows support large touch targets, low bandwidth and intermittent connectivity.
6. State visibility: every important record exposes lifecycle status, owner, geography, timestamps and evidence.
7. No false certainty: distinguish VERIFIED, PENDING, REJECTED, UNAVAILABLE and DEMO/SIMULATED data.

## UI surfaces
- National command center
- State and district operations
- ULB operations
- Gram Panchayat/rural operations
- Generator portal
- Field collection/mobile app
- Weighbridge and measurement
- Transport/logistics
- MRF/processor operations
- MRV and evidence verification
- Carbon accounting
- EPR compliance
- Enterprise ESG
- Registry and credentials
- Settlement and reconciliation
- Regulatory reporting
- AI intelligence
- Administration and audit explorer

## Responsive behavior
Desktop is optimized for operations teams, review queues, maps and data tables. Mobile is optimized for field capture, evidence, scanning, weighing, route tasks and exception handling. Never hide critical evidence or lifecycle state behind decorative UI.

## Stitch workflow
Use Google Stitch to explore high-fidelity screens and interactive flows. Every Stitch project should be derived from this file and the domain/state-machine specifications. Approved designs become implementation references; the backend remains authoritative for all real state.

## Status vocabulary
- VERIFIED: authoritative evidence and required verification completed.
- PENDING: submitted but required verification is incomplete.
- REJECTED: review failed or evidence was rejected.
- UNAVAILABLE: source or integration is not currently available.
- DEMO: explicitly synthetic data for demonstration only.
- SIMULATED: explicitly simulated workflow, never presented as a real transaction.
