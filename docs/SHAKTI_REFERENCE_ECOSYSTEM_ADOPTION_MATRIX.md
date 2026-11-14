# RupayKg Reference Ecosystem Adoption Matrix

**Status:** Controlled engineering reference — 2026-11-08  
**Canonical repository:** vishaltradewinds/rupaykg / main

## Purpose

This matrix converts the Shakti external-reference ecosystem into an actionable engineering control. External ecosystems are **reference inputs**, not automatic authority for RupayKg.

**Adoption rule:** Reference → Cross-map → Legal/Regulatory Check → Technical Validation → Adapt → Implement → Test → Field Validate → Assure.

No external component, standard, architecture or policy is treated as a RupayKg requirement until its applicability and evidence are recorded.

## Decision classes

- **ADOPT** — use the standard/protocol/pattern as a direct engineering baseline where applicable.
- **ADAPT** — reuse the architectural or governance pattern after RupayKg-specific design and Indian regulatory review.
- **OBSERVE** — maintain as reference intelligence; no implementation commitment yet.
- **REJECT** — assessed and deliberately not used; record the reason.
- **PENDING** — insufficient evidence for a final decision.

## Reference register

| Reference ecosystem / asset | Capability | RupayKg relevance | Proposed decision | Evidence required |
|---|---|---|---|---|
| DPGA DPG Standard | Open-source/open-data/open-AI assessment, documentation, ownership, platform independence, privacy/security | Reusable-component governance | ADAPT | Component assessment, licence, ownership, documentation, privacy/security review |
| DPGA DPG Registry | Discovery of reusable digital public goods | Engineering reuse intelligence | ADOPT as discovery source | Source/version, component assessment, licence and technical validation |
| GovStack Building Blocks | Composable interoperable modules and REST APIs | Platform decomposition | ADAPT | API fit, deployment fit, security, operational and integration tests |
| GovStack Digital Registries | Registry lifecycle, identifiers, schema/API patterns | Environmental registry | ADAPT | Registry domain model, versioning, authorization, audit and export tests |
| GovStack Information Mediator | Cross-organization API/event interoperability | External-system integration | ADAPT | Contract tests, authentication, event ordering, failure/retry evidence |
| GovStack Identity/Registration | Identity and entity registration patterns | Organisation/site/device/verifier identity | ADAPT | Indian identity/legal boundary, authorization and tenant tests |
| Universal DPI Safeguards | Rights, safety, privacy, inclusion, governance and lifecycle safeguards | Shakti assurance | ADAPT | Risk register, responsible authority mapping, measurable outcomes and review evidence |
| UNDP DPI Playbook | DPI discovery/design/deployment patterns | Platform strategy | ADAPT | Architecture cross-map and implementation decision |
| Global DPI Repository | Proven DPI implementations and governance patterns | Reference intelligence | ADOPT as research source | Source record, implementation pattern, maturity and contextual applicability |
| UN Innovation Network | Public-sector innovation patterns | Institutional adoption/use-case intelligence | OBSERVE/ADAPT per case | Case evidence, relevance and validation |
| FAIR Forward / BMZ | Open, interoperable and inclusive digital-development practices | Open infrastructure and responsible reuse | ADAPT | Practice mapping, applicability and local adaptation evidence |
| Relevant Indian DPI ecosystems | India-specific interoperability, APIs, governance and deployment patterns | Highest contextual relevance | ADOPT/ADAPT per asset | Official source, legal basis, API/spec version and acceptance evidence |
| W3C Verifiable Credentials 2.0 | Machine-verifiable, cryptographically secured credentials | Environmental claims/credentials | ADOPT where credential use is justified | Signature verification, tamper rejection, issuer/holder/verifier tests, key lifecycle |
| W3C Data Integrity | Cryptographic integrity proofs | Credential/evidence integrity | ADOPT where VC is used | Proof verification and negative/tamper tests |
| W3C PROV | Provenance entities, activities, agents and derivation | Evidence lineage/MRV provenance | ADAPT | Provenance model mapping and end-to-end lineage tests |
| OGC SensorThings API | IoT observations and sensor interoperability | MRV measurement ingestion | ADAPT | Device/observation mapping, authentication, replay/duplicate and offline tests |
| OGC API Features | Standard geospatial feature access | Site/facility/measurement-point data | ADAPT | Geospatial API contract and authorization tests |
| OpenTelemetry | Traces, metrics and logs | Operational assurance | ADOPT | Trace correlation, alerting, retention and incident reconstruction |
| CAD Trust | Carbon data interoperability and registry transparency | Carbon registry interoperability | ADAPT | Data model mapping, lifecycle, double-counting and exchange tests |
| UNFCCC Article 6.4 registry patterns | Issuance/transfer/retirement/cancellation lifecycle | Carbon/environmental attribute registry | ADAPT subject to applicable authority | Legal applicability, lifecycle controls and external acceptance |
| OpenAQ | Environmental observation data architecture | Environmental measurement/data lineage | OBSERVE/ADAPT | Source provenance, raw-to-derived lineage and quality controls |
| ICVCM Core Carbon Principles | Carbon-credit quality benchmark | Complementary carbon integrity benchmark | ADAPT as non-statutory benchmark | Separate benchmark mapping; never substitute for Indian law |
| GRI | Sustainability reporting/cross-mapping | Reporting interoperability | ADAPT as complementary framework | Mapping version, applicability and disclosure evidence |

## RupayKg capability mapping

### 1. Trust and identity

**External references:** W3C VC, GovStack Identity/Registration, Indian DPI.

Target:

Organisation → Facility → Site → Person/Role → Device → Verifier → Credential

Controls:
- cryptographic identity where appropriate
- authorization independent of credential possession
- tenant isolation
- issuer trust
- revocation/status
- audit trail.

### 2. Evidence and provenance

**External references:** W3C PROV, DPI Safeguards, DPGA.

Target lineage:

Raw Evidence → Activity → Observation → Validation → Calculation → Claim → Report → Registry Event

Every material derived environmental claim should be traceable to its source evidence and calculation version.

### 3. Environmental measurement

**External references:** OGC SensorThings, OGC API Features, OpenAQ patterns.

Target:

Device → Sensor → Observed Property → Observation → Location → Timestamp → Quality State → Evidence

Preserve raw observations. Do not overwrite source measurements with normalized or derived values.

### 4. Registry

**External references:** GovStack Digital Registries, CAD Trust, UNFCCC registry patterns.

Target lifecycle:

Draft → Submitted → Validated → Approved → Issued → Held → Transferred → Retired/Cancelled

The exact lifecycle must remain governed by the applicable Indian regulatory profile.

### 5. Interoperability

**External references:** GovStack Information Mediator, OpenAPI, Indian API ecosystems.

Target:

RupayKg Core → controlled adapter → external system

Do not embed external-system assumptions into core MRV logic.

### 6. Operational assurance

**External references:** OpenTelemetry, DPI Safeguards.

Target:

Request → Service → DB → Calculation → Registry → External Connector

with correlated traces, metrics, logs, alerts and incident evidence.

### 7. AI governance

**External references:** DPI Safeguards, DPGA principles and responsible-AI reference practice.

Target:

Input → Model/Version → Output → Evidence → Uncertainty → Human/Policy Decision

AI remains advisory unless a separately authorized rule explicitly permits automated action.

## Shakti adoption gate

Before any external reference is implemented:

1. Record source and version.
2. Identify the exact capability being reused.
3. Map it to a RupayKg architecture layer.
4. Determine Indian statutory/regulatory applicability.
5. Check privacy, security, sovereignty and data-governance implications.
6. Check licence and commercial-use constraints.
7. Validate technical compatibility.
8. Define required local adaptation.
9. Implement behind a controlled interface.
10. Add automated tests.
11. Perform field/production validation where applicable.
12. Record residual risk and owner.
13. Approve or reject adoption.
14. Update the control matrix.

## Non-negotiable boundaries

- A DPG is not automatically a RupayKg dependency.
- A DPI pattern is not automatically legally applicable in India.
- International standards do not override Indian law.
- A cryptographically valid credential does not by itself prove the truth of the underlying environmental claim.
- A sensor observation does not automatically constitute verified MRV.
- An external registry pattern does not establish regulatory approval.
- AI output is not evidence merely because a model produced it.
- A successful software test is not field validation.
- Architecture reuse is not TRL 9 evidence.

## Priority implementation sequence

### P0 — Immediate
- Build the machine-readable reference register.
- Cross-map current RupayKg components against the register.
- Identify existing implementations that duplicate reusable external capabilities.
- Verify tenant isolation before exposing new cross-system interfaces.

### P1 — Core platform
- Formalize provenance model.
- Formalize environmental registry lifecycle.
- Establish interoperable API/event boundary.
- Complete VC/Data Integrity implementation only where required.
- Establish OGC-compatible measurement boundary.

### P2 — External interoperability
- CAD Trust/carbon-registry mapping.
- Indian DPI/API integration profiles.
- Government/PSU connector framework.
- Controlled external credential exchange.

### P3 — Assurance
- DPI Safeguards risk/control mapping.
- OpenTelemetry operational evidence.
- Continuous conformance tests.
- Field validation and sustained-operation evidence.

## Governing principle

**RupayKg does not copy the reference ecosystem. RupayKg learns from it, verifies it, localises it, and selectively incorporates what survives Shakti review.**

**Shakti remains the control plane. Indian statutory/regulatory authority remains the highest external authority. External ecosystems remain evidence-backed reference sources unless separately made authoritative.**


## CAD Trust focused interoperability profile

The detailed design is maintained in [CAD Trust Interoperability Profile](CAD_TRUST_INTEROPERABILITY_PROFILE.md).

**Decision: ADAPT.** Initial work is schema discovery, field-level crosswalk and fixture-based validation. Any connector must sit behind the existing external-integration mediator/adapter registry; no parallel carbon registry or MRV subsystem is to be created.

- First runtime mode: read-only observer/subscriber only, after endpoint and terms validation.
- No CAD Trust publishing, write credentials, Chia node, tokenisation or production infrastructure in this phase.
- Map CAD Trust v2 Program, Methodology, Project, Project-Methodology, Stakeholder, Validation/Verification, Issuance/Unit and lifecycle events to existing RupayKg domains; preserve Generator, Aggregator and Recycler as distinct stakeholder roles.
- Use cross-registry matches as double-counting risk signals requiring provenance and review, not as proof of physical activity or automatic claim rejection.
- Tenant isolation, data minimisation, schema versioning, failure handling and acceptance gates remain mandatory.
- No TRL uplift or registry-participant status is implied.
