# SHAKTI Standards — Universal Lifecycle and Technology Readiness Requirements

**Standard status:** Proposed controlled baseline; must be reviewed and approved through the project's governance process before being represented as formally ratified.  
**Applies to:** All AllianceVentures projects and systems that adopt SHAKTI Standards.  
**Golden rule:** **ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.**

## 1. Purpose and governing principles

SHAKTI is a lifecycle assurance standard. It requires each project to establish what is real, what is intended, what evidence exists, what boundaries apply, what remains unproven, and who is authorized to approve each gate.

1. No gate is passed by assumption, confidence, a polished demo, or a document alone.
2. Evidence must match the exact product/system version, environment, use case, operating conditions and claim being made.
3. A build, unit test, CI pass, deployment, health endpoint or HTTP 200 is not proof of field readiness, legal authorization, regulatory acceptance, or production qualification.
4. Each claim must be classified as proposed, implemented, tested in a controlled environment, demonstrated in a relevant environment, independently verified, approved, or sustained in operation.
5. Safety, security, privacy, statutory compliance, environmental integrity, human impact and recovery requirements are context-specific and mandatory where applicable.
6. Never silently discard, mutate, fabricate or misclassify operational, statutory, contractual, financial, custody, measurement or audit evidence.
7. No production certification, live release, destructive migration, or material external action may be inferred from a technical score. Explicit approvals and change controls remain required.
8. Requirements and evidence are tailored to the project; the universal gates remain.

## 2. Universal lifecycle gates

Projects must maintain a gate register with owner, entry criteria, evidence, status, decision-maker, date, version/commit, limitations and next action.

| Gate | Required outcome | Minimum evidence |
|---|---|---|
| S01 Reality discovery | Establish what exists today | Repository/system inventory, source-of-truth identification, live-vs-test distinction |
| S02 Context | Define operating environment and stakeholders | User groups, geography, dependencies, constraints, real-world conditions |
| S03 Need and purpose | State the problem and intended outcome | Validated problem statement, beneficiaries, measurable outcomes |
| S04 Evidence | Establish facts and provenance | Sources, timestamps, ownership, quality, traceability and uncertainty |
| S05 Understanding | Confirm workflows and failure modes | User journeys, threat/failure analysis, domain model |
| S06 Relevance | Confirm the solution addresses the real need | Requirements-to-outcome traceability |
| S07 Boundaries | Define legal, statutory and safety limits | Applicable laws, permissions, standards, privacy, security and authority boundaries |
| S08 Options | Compare feasible alternatives | Build/buy/open-source options, lifecycle cost, lock-in, risks |
| S09 Feasibility | Demonstrate practical viability | Technical, operational, economic, environmental and delivery feasibility |
| S10 Validation | Test claims against evidence | Test plans/results, acceptance criteria, independent checks where required |
| S11 Decision | Make a governed go/no-go decision | Named decision owner, residual risks, explicit decision |
| S12 Design | Approve the project-specific design | Architecture, interfaces, data model, threat model, operational design |
| S13 Engineering | Implement controlled changes | Versioned code/configuration, reviews, traceability, reproducible build |
| S14 Verification | Prove implementation meets requirements | Unit/integration/system/security/performance/recovery tests as applicable |
| S15 Compliance and approvals | Obtain required external/independent approvals | Exact approval evidence, scope, issuer, validity and conditions |
| S16 Readiness/certification | Qualify the defined release/system boundary | Completed applicable gates, evidence pack, independent sign-off where required |
| S17 Deployment/live release | Release under change control | Deployment identity, rollback, monitoring, access controls, authorization |
| S18 Assurance | Sustain safe and correct operation | Monitoring, incidents, backups/restores, vulnerability handling, audits |
| S19 Learning | Improve using measured results | Operational metrics, corrective actions, updated risks and reassessment |

A project may combine implementation steps where sensible, but must not omit a gate or mark it complete without evidence. A gate may be NOT APPLICABLE only with a documented rationale and an authorized reviewer.

## 3. Mandatory Technology Readiness Level (TRL) assessment

A TRL assessment is mandatory whenever a project makes a claim about technology maturity, pilot readiness, field readiness, hardware readiness, production qualification or deployment at scale. It is also mandatory for technology-bearing projects before a field trial or live release. Non-technology projects must use an equivalent readiness rubric for the relevant deliverable.

### 3.1 TRL scale

| TRL | SHAKTI interpretation | Minimum evidence threshold |
|---|---|---|
| 1 — Basic principles | Relevant principles observed | Credible research/observations and stated uncertainty |
| 2 — Concept formulated | Intended application and architecture defined | Use case, design concept, system boundary and feasibility assumptions |
| 3 — Proof of concept | Critical functions demonstrated analytically or experimentally | Reproducible experiment, measured results, known limitations |
| 4 — Controlled validation | Components/subsystems and representative workflows validated in a controlled environment | Reproducible tests, traceable results, test-environment description and defect disposition |
| 5 — Relevant-environment validation | Integrated representative solution demonstrated under relevant conditions | Representative users/data/interfaces/environment, failure/recovery tests and acceptance evidence |
| 6 — Relevant-environment demonstration | Integrated system demonstrated in a relevant operational environment | End-to-end evidence, realistic operational constraints, measured performance and operator feedback |
| 7 — Operational prototype | Prototype demonstrated in an actual operating setting | Authorized field operation, real workflow evidence, operational support and safety controls |
| 8 — System qualified | Complete defined system qualified through acceptance and required qualification | Approved acceptance plan/results, security/compliance/operational qualification and independent sign-offs where required |
| 9 — Proven operation | System proven through sustained, successful real-world operation | Longitudinal operating metrics, incidents/reliability, audit evidence, user outcomes and continuous assurance |

These definitions are a SHAKTI assessment rubric. Where a regulator, contract, funder or domain-specific standard defines a different TRL scheme, record that scheme and map it explicitly rather than silently mixing scales.

### 3.2 Rules for assigning TRL

- Define the system boundary, target use case, user, operating environment, release/version and assessment date first.
- Assign TRL to the whole system and each critical subsystem. Examples include software, data pipeline, AI model, communications, device/sensor, safety controls, external integrations and operational service.
- The overall readiness claim cannot exceed the lowest readiness level of a critical subsystem required for the claimed use case. A weighted average must not conceal a blocker.
- TRL is based on evidence achieved, not a roadmap, feature list, architecture diagram, vendor claim or intended future capability.
- Controlled CI evidence may support TRL 3–4 for the tested software boundary; it does not by itself establish relevant-environment demonstration or sustained operations.
- A live endpoint, deployed service, synthetic fixture, simulated device, sandbox transaction or successful demo does not prove real-world TRL 5–9.
- TRL 5 requires representative evidence under relevant conditions; TRL 6–7 require progressively stronger integrated and actual operational demonstration; TRL 8 requires qualification; TRL 9 requires sustained operational proof.
- If evidence is missing, contradictory, stale or not independently verifiable, record NOT DEMONSTRATED / EVIDENCE INSUFFICIENT. Do not guess a level.
- Record both the last evidenced TRL and the next unfulfilled TRL gate. A higher TRL requires new evidence and formal review; documentation edits cannot advance it.
- Reassess after material architecture, hardware, model, methodology, data, operating environment, supplier, regulatory or release changes.

### 3.3 Required TRL evidence record

Every TRL record must contain:

1. Project, subsystem and unique assessment ID.
2. Exact system boundary, intended use, user, environment and version/commit.
3. TRL scale used and the claimed level.
4. Evidence references with date, source/owner, test conditions, raw results and integrity/provenance information.
5. Acceptance criteria and results, including failures and unresolved defects.
6. Real vs synthetic data, simulated vs physical components, and sandbox vs production distinctions.
7. Relevant statutory, security, privacy, environmental, safety, hardware certification and operational constraints.
8. Independent reviewer(s), decision authority, approval status and date.
9. Known limitations, residual risks, excluded claims and next gate.
10. Reassessment trigger and evidence retention location.

### 3.4 Hardware and field-device requirements

For hardware, sensors, IoT, communications and bare-metal components, record exact manufacturer, model, hardware revision, firmware, intended use, supplier, country/source where relevant, applicable approval/certification and its issuing authority, calibration/maintenance status, installation site, device identity, operator, raw measurement units, timestamp/time source, tamper controls, communications path and server-side acceptance evidence.

Where MeitY approval is a project rule, applicability and approval must be verified for the exact device/model and use case. Never infer approval from a brand, marketplace listing, family name or vendor assertion. If approval is not applicable, document the reason and have it reviewed. A platform registration is not a statutory authorization; a measurement is not verification; a calculation is not a certified environmental claim or credit.

### 3.5 AI/model readiness

Assess the model and the integrated product separately. Record model/version and source, license and usage rights, evaluation dataset provenance, representative and out-of-distribution performance, failure modes, security/privacy, human oversight, reproducibility, monitoring and rollback. An AI-generated answer or benchmark result is not evidence that the complete product is safe, compliant or operationally effective.

## 4. Release and certification gates

No release or certification may be granted solely because the TRL number is high. The release decision must also consider all applicable SHAKTI gates, risk severity, statutory/contractual approvals, security, recoverability, operational ownership and evidence quality.

- Engineering pass is not field acceptance.
- Field acceptance is not statutory approval.
- Deployment is not production qualification.
- TRL 9 is not a substitute for current compliance or authorization.
- Critical unresolved safety, security, statutory, external-trust, data-integrity or recovery blockers keep the release HOLD/BLOCKED, regardless of TRL.

## 5. Required outputs for every project

Maintain versioned artifacts appropriate to the project:

- Reality/context and stakeholder inventory.
- Requirements and evidence traceability.
- Applicable legal/regulatory/approval register.
- Architecture, threat/failure analysis and data governance.
- Test strategy, results and defect disposition.
- TRL assessment and subsystem readiness ledger.
- Deployment, backup/restore, rollback, monitoring and incident runbooks.
- Acceptance/approval record and residual-risk decision.
- Operations metrics and continuous-assurance/reassessment plan.

## 6. Governance and change control

The project owner is responsible for ensuring the register exists; technical, operational, domain and independent reviewers approve only claims within their competence. Preserve history and evidence. Do not overwrite failed results with passing results without retaining the original, rationale and corrective-action link. Any TRL change must identify the new evidence that justifies it.

**Universal decision rule:** No skipped gates, no inferred approvals, no inflated readiness claims, no production certification without evidence and authorized sign-off.

**Golden rule:** ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.
