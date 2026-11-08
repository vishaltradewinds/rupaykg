# RupayKg Environmental Operating System Architecture

## Status

Authoritative architecture for the canonical RupayKg repository.

- Repository: `vishaltradewinds/rupaykg`
- Branch: `main`
- Architecture status: controlled engineering baseline
- TRL status: not implied by architecture completion

## Purpose

RupayKg is engineered as one interoperable Environmental Operating System for circular economy, environmental compliance, digital MRV, carbon accounting, EPR, ESG, environmental attributes, registry operations and governed settlement.

**Canonical principle: ONE ENVIRONMENTAL OPERATING SYSTEM. MANY CONTROLLED IMPLEMENTATIONS.**

A site, ULB, enterprise, project, methodology or field deployment is an implementation/configuration of the system, not an independent software architecture.

## Layer model

`Regulatory → Evidence → MRV → IoT/Measurement → Data → AI → Registry/Integrity → Workflow → Reporting → Ecosystem Integrations`

The layers are interoperable but have different authority boundaries.

### 1. Regulatory layer

Owns:

- statutory and regulatory requirements;
- scheme and programme requirements;
- methodology applicability;
- policy and contractual controls;
- source/version/provenance;
- applicability and jurisdiction;
- authoritative-source boundaries.

Rule: AI, external standards and internal policy documents cannot override applicable Indian law or an authoritative government requirement.

### 2. Evidence layer

Owns capture, classification, hashing, linkage, preservation and retrieval of evidence.

Evidence may include documents, photographs, GPS/time records, weighbridge outputs, meters, sensors, laboratories, attestations, verification records and trusted external-system responses.

Material claims must have evidence lineage or an explicitly governed exception.

### 3. MRV layer

Owns deterministic measurement, reporting and verification logic.

Every authoritative calculation must be reproducible from identified inputs and preserve calculation identity, dataset identity, methodology/version, provenance and integrity hashes where applicable.

AI may assist interpretation or triage but cannot silently replace authoritative calculations.

### 4. IoT / Measurement layer

Owns physical and field measurements including weighbridges, meters, environmental sensors, edge devices, SCADA, field applications, laboratory instruments and gateways/oracles.

The system must distinguish:

- physical measurement;
- authenticated device output;
- software-derived value;
- estimated value;
- manually entered value;
- simulated/test fixture.

Production workflows must not present simulated or unverified values as physical evidence.

### 5. Data layer

Owns canonical versioned data, tenant isolation, lineage, retention, reconciliation, backups, audit trails and data-quality controls.

There must be one authoritative live production data path for each system-of-record responsibility.

The application runtime must not bypass tenant isolation controls. The current Shakti tenant-isolation gate remains open until runtime role, transaction context, RLS and negative cross-tenant tests are all evidenced in the target production environment.

### 6. AI layer

AI supports:

- classification;
- extraction;
- anomaly detection;
- evidence triage;
- workflow assistance;
- forecasting;
- decision support;
- multilingual interfaces;
- natural-language assistance.

AI controls must include model/version provenance, traceability, uncertainty, human review, adversarial testing, hallucination controls and data boundaries.

**AI is assistive intelligence, not authority.**

### 7. Registry / Integrity layer

Owns cryptographic integrity, append-only audit trails, credentials, registry state transitions, evidence-package integrity and justified external anchoring such as Hedera HCS.

Blockchain or distributed-ledger technology must be used only where it provides a defined integrity, ordering, audit or interoperability benefit. It must not be used as branding.

### 8. Workflow layer

Owns explicit lifecycle state and recoverable transitions including onboarding, evidence collection, MRV review, exception handling, verification, approval, issuance, corrective action, reporting and renewal/revalidation.

High-risk state transitions require explicit authorization and auditable evidence.

### 9. Reporting layer

Produces operational, regulatory, ESG, MRV, management and stakeholder reports from authoritative state.

Reports must preserve definition/version traceability, reproducibility, authorization and evidence references.

A report is an output of authoritative state; it is not the authority itself.

### 10. Ecosystem integration layer

Connects controlled interfaces to CPCB, EPR, BEE/CCTS, ULB/LGD, ERP, laboratories, IoT systems, registries, auditors/validators/verifiers, government systems and relevant open digital infrastructure.

Every integration requires:

- data contract;
- trust boundary;
- authentication/authorization;
- failure mode;
- ownership;
- reconciliation;
- provenance;
- versioning;
- operational monitoring.

## Controlled deployment model

A deployment consists of:

1. canonical platform capability;
2. deployment configuration;
3. applicable regulatory profile;
4. stakeholder/tenant configuration;
5. site measurement and evidence adapters;
6. integration adapters;
7. workflow configuration;
8. acceptance evidence.

This permits pan-India reuse without pretending that one configuration is automatically valid for every jurisdiction, methodology or site.

## Reusability classification

| Class | Meaning |
|---|---|
| Core platform capability | Reusable platform behavior |
| Regulatory profile | Jurisdiction/scheme/methodology-specific control |
| Domain adapter | Sector/process-specific implementation |
| Site configuration | Physical/site-specific configuration |
| Evidence instance | Actual field/organizational evidence |
| Integration connector | External system interface |

## Authority hierarchy

1. Applicable Indian law/regulation and authoritative scheme requirements.
2. Approved RupayKg regulatory profile and governed methodology mapping.
3. Validated technical implementation and database/workflow controls.
4. External reference ecosystems and standards used as guidance unless separately authoritative.

External recognition, open-source reuse or ecosystem membership does not certify RupayKg.

## TRL rule

Architecture completion is not TRL 9.

RupayKg readiness must be assessed separately across:

- engineering;
- security;
- data;
- interoperability;
- physical/field integration;
- operational readiness;
- regulatory acceptance;
- independent verification;
- production acceptance;
- sustained operation.

## Shakti lifecycle

`Discovery → Regulatory/Evidence Boundary → Feasibility → Architecture → Design → Engineering → Testing → Security → Validation → Field Acceptance → Approval → Deployment → Operation → Measurement → Continuous Assurance → Scale`

Every material production claim must map to evidence in this lifecycle.

## Golden control

**Reuse what is proven. Verify what is adopted. Localise what is required. Evidence what is claimed.**
