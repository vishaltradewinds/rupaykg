# RupayKg Agentic AI — stakeholder and permission matrix

**Status:** Engineering design baseline for the agentic foundation; not evidence that every listed workflow is implemented or live.
**Scope:** Pan-India architecture across waste generation, collection, transport, processing, compliance, MRV, carbon markets, assurance, communities and public authorities.
**Current safety boundary:** Existing agentic endpoints are authenticated, organization-scoped, read-only and advisory. They do not mutate authoritative records, submit statutory filings, issue credits, approve identities or replace a verifier.

## 1. Current implementation — exact boundary

The current source-code increment exposes four allow-listed goals:

| Goal | What exists now | What it does not do |
|---|---|---|
| `review_measurements` | Plans a measurement review from scoped operational records and flags missing measurements | Does not validate sensor calibration, certify measurements or change records |
| `prepare_compliance` | Checks for activity, evidence and approved verification prerequisites | Does not make a final legal determination or submit a return |
| `trace_resource_flow` | Plans a source-grounded custody/evidence reconciliation | Does not create missing custody events or certify mass balance |
| `onboard_stakeholder` | Checks existing stakeholder application, legal-evidence and organization-verification prerequisites | Does not create a stakeholder, approve identity or grant membership |

The current source uses PostgreSQL records, including activities, measurements, evidence, verifications, stakeholder applications, organization memberships and organization verification evidence. Exact applicability and access must be checked against the deployed schema and authorization model before adding tools. The model explanation adapter is optional, disabled by default, and has no tool or action execution access.

## 2. Stakeholder coverage matrix

**Status key**
- **Current generic workflow** — an existing workflow may serve the role, but there is no dedicated role-specific agent.
- **Design required** — stakeholder is in the target architecture; dedicated workflow and permissions are not yet implemented in this increment.
- **External integration required** — requires a separately authorized external system or device integration.
- **Human authority required** — AI may prepare evidence or recommendations but cannot exercise the reserved decision.

| # | Stakeholder / actor | Intended agentic workflow | Required source/evidence | Action boundary | Status |
|---:|---|---|---|---|---|
| 1 | Bulk Waste Generators (BWGs) | Waste inventory, measurement review, applicable compliance preparation | Activity, quantity, period, evidence, applicable generator details | Prepare only; authorised person approves filings | Current generic workflow; role-specific design required |
| 2 | Other waste generators / source organisations | Waste generation and handover traceability | Source, stream, quantity, date, receiving party | No inferred handover | Current generic workflow |
| 3 | Waste aggregators | Aggregation, sorting and custody reconciliation | Inbound/outbound lots, weights, source and destination | No automatic quantity correction | Current generic workflow |
| 4 | Waste transporters / logistics operators | Trip and custody exception checks | Manifest, vehicle/trip, timestamps, handover and weighment | No fabricated custody event | Current generic workflow |
| 5 | Recyclers and waste processors | Input-output reconciliation and evidence preparation | Inbound lots, processing activity, outputs, rejects and evidence | No claim of recycling without evidence | Current generic workflow |
| 6 | Organisation representatives | Stakeholder onboarding checklist | Legal identity, organisation details, representative authority | Human onboarding decision | Current onboarding checklist |
| 7 | Compliance teams | Compliance evidence coverage and reporting preparation | Applicable rule/period, activities, evidence, verification | No autonomous legal conclusion or filing | Current generic workflow |
| 8 | MRV / measurement teams | Measurement completeness, anomaly triage and provenance | Value, unit, method, source, timestamp, calibration where relevant | Human validates anomalies and methodology | Current generic workflow; richer MRV design required |
| 9 | Independent verifiers / validation bodies | Independent evidence review and verification workflow | Methodology, evidence package, conflicts and verifier credentials | Verifier alone records the independent decision | Prerequisite checks only; dedicated workflow required |
| 10 | Platform administrators / security operators | Tenant configuration, access review, incident and service health | Audit logs, roles, security events, configuration | Least privilege; no self-approval of high-risk actions | Existing platform controls; agent workflow not implemented |
| 11 | Authorised organisational reviewers | Review blockers, record decisions and approve permitted next steps | Reviewer role, decision rationale, linked evidence | Human approval gate; role separation | Human gates exist in plans; durable approval workflow not implemented |
| 12 | CPCB | Prepare applicable reporting/evidence packages | Applicable CPCB requirements and accepted source records | No submission without authorised integration and confirmation | External integration required |
| 13 | SPCBs / PCCs | State/UT jurisdiction-specific compliance preparation | Jurisdiction, applicable requirements, authorisations | No assumed uniform state rule | External integration and rule mapping required |
| 14 | Urban Local Bodies / municipal corporations | Collection, processing and city waste-flow reconciliation | Contracts, service areas, collection and facility records | No official status claim without source confirmation | Design and integration required |
| 15 | Municipal waste-management departments | Operational exception triage and service reporting | Route, collection, facility, complaint and performance records | Human handles escalations | Design required |
| 16 | State / district administrations | Authorised programme monitoring and escalation | Authorised aggregated reports and provenance | Strict jurisdiction and data-access scope | Design required |
| 17 | Material Recovery Facilities (MRFs) | Sorting, material classification and lot reconciliation | Weighment, sorted fractions, rejects and dispatch evidence | Classification remains reviewable | Design required |
| 18 | Composting / biomethanation operators | Organic-waste input/output evidence | Feedstock, process logs, outputs, rejects and operating records | No output or diversion claim without evidence | Design required |
| 19 | Waste-to-energy / other authorised treatment facilities | Receipt, treatment and output reconciliation | Inbound weights, treatment logs, residues and output records | No unverified treatment claim | Design required |
| 20 | Plastic-waste processors / recyclers | Plastic stream and processing evidence | Material category, process, output and applicable authorisation | Methodology and eligibility checks required | Design required |
| 21 | Producers, Importers and Brand Owners (PIBOs) | EPR obligation tracking and evidence preparation | Applicable category, obligation period, certificates and evidence | No EPR compliance assertion without authoritative validation | Design required |
| 22 | Producer Responsibility Organisations (PROs), where applicable | Collection/processing coordination and evidence packaging | Agreements, service records, linked processors and quantities | Mandate and eligibility must be checked | Design required |
| 23 | Collection contractors / service providers | Service schedule, completion and exception management | Work order, route, service evidence and acceptance | No self-approval of disputed service | Design required |
| 24 | Weighbridge operators | Capture validation and discrepancy detection | Device ID, gross/tare/net, timestamp, calibration and ticket | Device/source integrity checks; no silent edits | External device integration required |
| 25 | IoT / sensor operators | Device health, measurement provenance and alerts | Device identity, calibration, readings, connectivity and logs | No device control until separately secured and approved | External device integration required |
| 26 | Laboratories / testing facilities | Test-report intake and provenance | Lab identity, method, sample chain, report and signatory | No inferred test result or accreditation | Integration and verification required |
| 27 | Carbon project developers | Project eligibility, methodology and evidence preparation | Project boundary, baseline, monitoring plan, methodology and evidence | No credit issuance or validation claim | Design required |
| 28 | Carbon programme administrators / registries | Submission package preparation and status reconciliation | Registry rules, authorised credentials, submission receipts | Only registry-confirmed state is authoritative | External integration required |
| 29 | Independent carbon validators / verifiers | Validation/verification evidence review | Applicable methodology, sampling, evidence and independence declarations | Independent decision reserved to verifier | Dedicated workflow and credentials required |
| 30 | Carbon-credit buyers / corporate offtakers | Due diligence and traceability review | Project provenance, registry status, claims and contractual evidence | No unsupported credit or impact claims | Design required |
| 31 | Financial / settlement partners | Payment and settlement reconciliation | Authorised invoices, transaction references and settlement confirmations | No movement of funds without explicit permission and controls | External integration required |
| 32 | Auditors / assurance providers | Evidence sampling, control testing and audit-package preparation | Immutable audit trail, source links, approvals and exceptions | Read-only by default; findings independently signed | Design required |
| 33 | Technology / integration partners | Partner onboarding, connection health and failure recovery | Contracts, API scopes, credentials, health checks and audit logs | Scoped credentials; no broad tenant access | Design required |
| 34 | Tribal communities, waste pickers, SHGs and informal-sector workers | Accessible multilingual onboarding, participation and consent-aware evidence capture | User consent, identity options, role, service and transaction evidence | Accessible human support; no exclusion solely for lack of smartphone or English | Design required |
| 35 | NGOs / community organisations / implementation partners | Training, community coordination and programme reporting | Mandate, consent, programme and activity evidence | Access limited to assigned programme and consent | Design required |

## 3. Cross-cutting roles and control separation

These are control roles, not additional commercial stakeholder categories:

- **Identity and access owner:** verifies identity, organisation membership and role grants.
- **Data steward:** maintains source quality, classifications, retention and correction procedures.
- **Compliance owner / legal reviewer:** confirms applicability and approves regulated submissions.
- **Independent verifier / auditor:** must remain independent from the activity owner and agent that prepared evidence.
- **Platform security operator:** monitors access, incidents, secrets, rate limits and tenant isolation.
- **Human approver:** records a named decision and rationale for consequential actions.
- **AI/model operator:** manages model configuration and evaluation but cannot grant itself domain permissions.
- **External-system authority:** the connected regulator, registry, credential verifier, device or settlement system remains authoritative for its own confirmed outcomes.

## 4. Permission and tool design rules

Before any stakeholder-specific tool is enabled, document and test all of the following:

1. Authenticate the user/service identity and verify active organisation membership.
2. Authorise the exact action and resource; apply geography, programme, waste-stream and record-level scope where relevant.
3. Use an explicit allow-list of tools per role. Model output must never create its own permissions or select arbitrary URLs, SQL or shell commands.
4. Default to read-only. Writes require a separately defined operation, validated schema, idempotency key, audit event and explicit approval where consequential.
5. Keep source facts, user claims, model inference and verified conclusions distinguishable.
6. Preserve provenance: source identifier, capture time, actor/device, transformations, verification state and correction history.
7. Enforce separation of duties for onboarding, verification, statutory submission, credit issuance and settlement.
8. Fail closed when identity, scope, source data, external status or approval is unavailable.
9. Prevent cross-tenant access; test negative authorization cases, not only successful access.
10. Minimise data sent to models. Do not send raw evidence or personal data unless the specific use is approved and necessary.
11. Record model/provider/version, prompt/template version, input-summary fingerprint, output, latency and failure class where appropriate; avoid logging secrets or unnecessary personal data.
12. Provide accessible, multilingual and low-bandwidth flows with human escalation for users who cannot complete digital verification.
13. Define retention, consent, correction, grievance and incident-response paths before production.
14. Test jurisdiction-specific rules as versioned rules with effective dates; do not encode a single national assumption where rules differ.
15. Do not claim legal compliance, verified recycling, carbon-credit issuance, payment settlement or device authenticity without authoritative evidence.

## 5. Recommended implementation sequence

| Batch | Scope | Exit evidence |
|---|---|---|
| A — Stakeholder and permission baseline | Maintain this matrix; map each role to actual schema, permissions, jurisdiction and allowed tools | Reviewed role/action matrix; schema mapping; negative-access test cases |
| B — Read-only domain tool registry | Typed, allow-listed tools for activity, measurement, evidence, verification, onboarding and resource-flow queries | Unit/integration tests; tenant-isolation tests; tool inventory; audit events |
| C — Evidence intelligence | Document intake, extraction, provenance, claim-vs-fact labels, human correction | Golden test set, extraction accuracy and failure thresholds, malware/privacy controls |
| D — Durable workflow and approvals | Persist runs, idempotent retries, resumability, human approval records and escalation | Migration review, recovery tests, duplicate-action tests, approval separation |
| E — External integrations | Prioritise regulator/registry APIs, credential signing/verification, weighbridge and sensor integrations by verified access and value | Sandbox/live contract tests, credentials review, reconciliation and failure recovery |
| F — Evaluation and field assurance | Model evaluation, prompt-injection tests, cost/latency limits, field trials and Shakti Standards / TRL evidence | Independent review, signed test evidence, operational runbooks and explicit go/no-go gates |

## 6. Shakti Standards / TRL / release gates

- **Current increment:** code and automated tests exist; this is not evidence of pan-India field readiness.
- **TRL:** assess software and hardware separately. Do not claim a higher TRL without the defined evidence for that level and representative operational environment.
- **No skipped gates:** requirements and statutory discovery → architecture and threat model → implementation → automated and integration testing → independent review → controlled field validation → operational readiness → explicit approval.
- **Release posture:** production certification remains **HOLD/OFF** until all required security, privacy, regulatory, integration, recovery and field-validation gates have objective evidence and an authorised approver signs off.

## 7. Immediate engineering follow-up

This document is a baseline for engineering, not a claim that all 35 categories have been implemented. The next code batch should add a typed read-only tool registry only after matching each proposed tool to actual database schema and existing authorization helpers. Do not add speculative database fields, synthetic stakeholder records, external write actions or broad administrator bypasses.
