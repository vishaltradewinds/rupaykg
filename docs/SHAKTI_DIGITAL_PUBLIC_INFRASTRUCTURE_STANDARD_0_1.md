# SHAKTI Digital Public Infrastructure (DPI) Standard — v0.1

**Status:** Founder-directed universal architecture standard; proposed for inclusion in the SHAKTI Standards baseline. This document is not a government notification, statutory standard, certification, or claim of official DPI recognition.

**Applicability:** Every SHAKTI-governed project that creates shared digital infrastructure, multi-stakeholder platforms, registries, public-purpose data exchange, sector networks, or interoperable services. Requirements apply proportionately to the system boundary and risk, without weakening the universal principles.

**Golden rule:** ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.

## 1. Purpose

A SHAKTI-aligned Digital Public Infrastructure is a reusable, interoperable and governed digital foundation that enables multiple independent stakeholders and systems to participate in trusted workflows. It must create public-interest value without requiring the platform operator to own every participant's data, infrastructure, research, decisions or statutory authority.

A platform may be designed for national public purpose without being officially designated, endorsed, adopted or operated by a government. Such recognition or integration must never be claimed without documentary evidence from the competent authority.

## 2. Mandatory DPI principles

1. **Public purpose and inclusion:** identify beneficiaries, access barriers, language/accessibility needs, affordability and measurable public-interest outcomes.
2. **Open standards and interoperability:** publish versioned data schemas, API contracts, identifiers, event semantics and conformance tests. Prefer documented, implementable standards over proprietary interfaces.
3. **Federation and subsidiarity:** participants should be able to retain authoritative source records in their own systems and exchange only authorised, necessary data. Avoid unnecessary centralisation.
4. **Data rights and stewardship:** define data controller/steward/processor roles, ownership or licence, lawful basis, purpose, retention, correction, portability, revocation where applicable and grievance routes.
5. **Privacy and security by design:** least privilege, strong authentication, organisation and tenant isolation, encryption, secure key management, threat modelling, incident response and independent security testing.
6. **Neutrality and portability:** avoid compulsory dependence on a single vendor, cloud, AI model, device, laboratory, payment provider or identity provider. Provide export, migration and exit paths.
7. **Trust and verifiability:** preserve provenance, signatures where appropriate, timestamps, version history, audit trails, evidence quality and independent review.
8. **Accessibility and multilingual participation:** design for low-bandwidth, mobile-first, assistive technology, local language and assisted/offline workflows as appropriate.
9. **Transparency and accountability:** publish governance, eligibility, service levels, charges (if any), change processes, dispute handling and limitations.
10. **Sustainable operations:** fund and staff support, uptime, backups, disaster recovery, monitoring, maintenance, security updates and long-term stewardship.

## 3. DPI reference architecture

Every project must define and version its own architecture, addressing the following capabilities where applicable:

- **Participant and organisation layer:** verified stakeholder onboarding, organisation affiliation, delegated authority, role and credential lifecycle. Do not create a new foundational identity unnecessarily when a lawful, suitable identity provider can be integrated.
- **Registries and reference data:** governed identifiers and registries for the domain's entities, facilities, products, services, sources or assets, with authoritative-source designation and correction/dispute procedures.
- **Consent, purpose and policy layer:** capture and enforce lawful purpose, permissions, data-sharing agreements, consent where it is the applicable basis, retention and revocation semantics.
- **Interoperability layer:** documented APIs, event/webhook contracts, common vocabularies, schema versioning, conformance suites, rate limits and backward-compatibility policy.
- **Workflow and transaction layer:** traceable state transitions, idempotency, acknowledgements, dispute/error handling and human approval gates.
- **Evidence and trust layer:** provenance, signed records where appropriate, immutable or tamper-evident audit evidence, verification status and correction history.
- **Analytics and intelligence layer:** controlled analytics and AI/agentic services with source traceability, permission boundaries, evaluation, human oversight and safe fallback.
- **Operations and resilience layer:** monitoring, support, incident management, backups, restore tests, disaster recovery, capacity, cost controls and vendor exit.

Not every project needs every component. Applicability and exclusions must be justified in the architecture decision record and reviewed.

## 4. Governance and authority boundaries

- The DPI operator governs the platform service, technical standards and its own access decisions; it does not acquire statutory authority by operating the platform.
- Government registries and official determinations remain authoritative only within the authority and scope established by law or the issuing body.
- Research institutions, laboratories, professionals, businesses and participants retain responsibility for their own source records, research conclusions, test results, professional duties and contractual commitments.
- The platform must distinguish operator verification, participant attestation, automated checks, independent validation, professional certification and statutory approval.
- No participant may alter another participant's authoritative record without a recorded, authorised correction process.
- Define a governance body or accountable owner, change-control process, conflict-of-interest rules, complaints and appeals, incident disclosure and independent oversight proportionate to risk.

## 5. Data and interoperability contract

Each shared data object must define, as relevant: unique identifier; issuing authority; owner/steward; schema and version; provenance; creation/update time and time source; units and controlled vocabularies; sensitivity/classification; lawful purpose; access policy; retention; correction history; validation status; and links to source evidence.

Every API/event contract must specify authentication, authorisation, tenant boundary, request/response schema, error semantics, idempotency, pagination, rate limits, versioning, deprecation, audit events, data minimisation and security requirements.

Federated exchange must fail closed when identity, authority, consent/lawful basis, purpose or schema validation cannot be established. Do not treat a successful API response as proof that the exchanged data is true or legally authoritative.

## 6. Security, privacy and resilience gates

Before a live release, evidence must include as applicable:
- Data-flow map, classification, threat model and privacy impact assessment.
- Identity proofing/assurance rationale, MFA or equivalent controls for privileged roles, credential revocation and delegated-authority controls.
- Positive and negative tenant-isolation tests; least-privilege service/database roles.
- Encryption in transit and at rest, key/secrets rotation and recovery controls.
- API security, abuse/rate limiting, input validation, supply-chain and dependency controls.
- Backup and restore rehearsal, disaster recovery objectives, incident response and breach notification workflow.
- Independent penetration/security testing and closure or explicit risk acceptance by authorised owners.
- Data export, deletion/retention and vendor/platform exit rehearsal.

## 7. Agentic AI and automation

The mandatory SHAKTI Principal Directive PD-01 applies to every DPI component and workflow. Agentic systems must use bounded identities and tools, least privilege, provenance, prompt-injection controls, independent verification, durable audit, cost/resource limits, safe fallback and human escalation.

AI agents may assist discovery, translation, data quality, workflow routing, anomaly detection and decision support. They must not fabricate identity, consent, source authority, laboratory results, statutory approval or stakeholder authorisation. Consequential decisions remain with the legally and professionally authorised human or institution.

## 8. Universal DPI lifecycle gates

Every DPI project must evidence:
1. Public-purpose and beneficiary discovery.
2. Stakeholder, authority and ecosystem mapping.
3. Legal, statutory, privacy, competition, accessibility and sector-specific boundary assessment.
4. Existing infrastructure and authoritative-source discovery; avoid duplicating existing national or sector registries.
5. Federation-versus-centralisation and build-versus-integrate feasibility analysis.
6. Governance, data rights, business/funding and long-term stewardship model.
7. Versioned architecture, schemas, API and conformance specifications.
8. Security, privacy, inclusion and resilience validation.
9. Multi-party interoperability testing with independent participants, not only internal mocks.
10. Controlled pilot/field validation with explicit scope, consent/legal basis and rollback.
11. Independent review and required statutory/institutional approvals.
12. Operational readiness, support, incident handling, backup/restore and change control.
13. Measured adoption, service quality, inclusion, public value, cost and harm.
14. Continuous assurance, standards evolution and exit/transition readiness.

No national-scale claim is permitted from a single-site demonstration. National readiness requires representative geographic, institutional, linguistic, infrastructure and operating-condition evidence, plus sustained operations.

## 9. SHAKTI evidence and TRL requirements

Maintain an evidence register for each critical subsystem and the whole DPI: identity, registries, APIs, consent/policy, data exchange, trust/evidence, AI/swarm, security, operations and external integrations. Apply the SHAKTI TRL rubric and PD-01. Overall readiness cannot exceed the least-ready critical dependency for the claimed use case.

A prototype, documentation, simulated integration, API mock, internal test or signed memorandum alone does not establish live interoperability or national operational readiness. Record missing evidence as NOT DEMONSTRATED.

## 10. Required project artifacts

- DPI purpose, public-value and stakeholder/authority map.
- Governance charter, RACI, conflict-of-interest and grievance procedures.
- Authoritative-source and existing-infrastructure register.
- Data rights, classification, consent/lawful-purpose and retention matrix.
- Federated architecture and data-flow diagrams.
- Versioned identifier, schema, API and event specifications.
- Conformance, interoperability, security, privacy, accessibility and resilience test reports.
- Agentic AI swarm register and approval matrix under PD-01.
- Funding, operating-cost, service-level, support and vendor-exit plan.
- TRL/subsystem readiness register, independent reviews and release decision.
- Operational metrics, incidents, corrective actions and continuous-assurance records.

## 11. Release rule

A DPI component remains HOLD/BLOCKED where critical legal authority, data rights, identity assurance, tenant isolation, security, interoperability, independent evidence, recovery or operational ownership is absent. No project may claim SHAKTI DPI conformance, official government recognition, national adoption or TRL advancement without exact supporting evidence and authorised review.

**Universal rule:** Build shared public-purpose infrastructure, not a closed data silo; interoperate without appropriating authority; verify without overstating trust; scale only on evidence.
