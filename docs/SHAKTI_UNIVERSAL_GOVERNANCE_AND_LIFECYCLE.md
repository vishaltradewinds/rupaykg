# SHAKTI Standards — Universal Project Governance and Lifecycle

**Authority:** Founder-designated mandatory governing standard for all AVGAT INFRASYS projects and repositories.  
**Applicability:** Every product, platform, service, subsystem, pilot, research programme, integration, release and operational workflow.  
**Conformance:** Mandatory. No project-level waiver or silent omission is permitted.

## 1. Golden rule

**ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.**

Every project MUST follow the complete real-world lifecycle in this standard. The gates are universal; the evidence, engineering controls, statutory requirements, architecture and acceptance criteria are specific to the project's actual context and risk.

A missing or failed gate is a recorded non-conformance. Work may proceed only within a controlled, non-production development context where doing so does not create unsafe reliance or misrepresentation. No project may claim Shakti conformance, production readiness, certification or TRL achievement while required evidence is absent.

## 2. Principal directives

The following are mandatory across all projects:

- **PD-01 — Agentic AI Swarm Systems:** A coordinated swarm architecture is mandatory throughout the system lifecycle. Orchestration, specialist responsibilities, permissions, evidence, independent verification, security, failure recovery, human approvals and operational monitoring must be implemented and evidenced. Refer to `SHAKTI_AGENTIC_AI_SWARM_DIRECTIVE.md`.
- **Reality before design:** Establish the actual problem, users, operating context, constraints, existing systems and field conditions before selecting a solution.
- **Evidence before claims:** Every material claim, decision, metric, requirement and readiness assertion must have traceable evidence, an owner, date/version and confidence/limitations.
- **Law and safety before capability:** Identify applicable statutes, rules, licences, standards, approvals, data protection and professional responsibilities before live operation.
- **Validate before investment:** Prove feasibility and critical assumptions using the lowest-risk, lowest-cost credible method before capital expenditure.
- **Zero-cost first and capital preservation:** Use existing assets, public infrastructure, open standards, open-source software and legitimate partnerships first. No paid service, subscription, API, consultant, equipment or purchase without an evidenced need, total-cost assessment and explicit founder approval.
- **Indigenous and approved technology:** Where devices, electronics, sensors or industrial equipment are selected for Indian public-sector or regulated use, document applicable MeitY/agency approvals, procurement rules, origin claims, security posture and actual supply-chain evidence. Never label a device approved, indigenous or compliant without documentary proof.
- **Pan-India by design where the business mandate is national:** Design for applicable national variation, state/local rules, language, accessibility, connectivity, institutional interfaces and operational scale. A pilot is not national readiness.
- **TRL honesty:** Assess Technology Readiness Level separately for software, hardware, process, models and integrated system where relevant. Record evidence and gaps; never inflate or self-certify readiness.
- **Human accountability:** AI agents support work but do not replace legally authorised persons, qualified professionals, independent verifiers or accountable decision-makers.

## 3. Mandatory lifecycle gates

Every project MUST maintain a gate register for all stages below. A stage may be marked not applicable only with a written, evidence-based rationale approved through project governance; this does not waive a principal directive.

### Gate 0 — Reality and context discovery
Identify the real problem, affected stakeholders, user journeys, operating environment, geography, baseline, constraints, existing systems, failure modes and intended public/business value. Validate findings with users or authoritative evidence.

### Gate 1 — Evidence and requirements
Create a traceable requirements register. Distinguish verified facts, assumptions, hypotheses, estimates and unknowns. Record source provenance, dates, data rights, evidence quality and acceptance criteria.

### Gate 2 — Statutory, regulatory, safety and ethics
Build a jurisdiction- and activity-specific compliance register. Identify applicable laws, rules, permits, licences, standards, data obligations, safety requirements, environmental/social safeguards, institutional approvals and competent authorities. Record applicability decisions and obtain qualified review where needed. Do not infer approval from a technical feature.

### Gate 3 — Feasibility and alternatives
Evaluate technical, operational, legal, market, institutional, environmental, security and financial feasibility. Compare build, buy, reuse, open-source and partnership options. Quantify dependencies, risks, lifecycle costs, exit costs and failure consequences. Prefer reversible experiments.

### Gate 4 — Validation and solution discovery
Test the highest-risk assumptions through prototypes, field observations, controlled experiments, stakeholder validation and independent evidence. Define stop/go criteria before testing. Do not present a prototype as a validated product.

### Gate 5 — Architecture and design
Document system boundaries, data flows, threat model, trust boundaries, interfaces, identity/access model, tenancy, reliability, resilience, observability, backup/recovery, accessibility, interoperability, deployment topology and cost model. Include the mandatory agent swarm architecture and human approval matrix.

### Gate 6 — Engineering and implementation
Use version control, reproducible builds, code review, secure development, dependency management, secrets protection, migrations, configuration separation, documentation and traceable changes. Maintain one clearly designated authoritative source for each critical data domain; quarantine duplicates and obsolete stores rather than allowing conflicting truth.

### Gate 7 — Verification and testing
Test unit, integration, end-to-end, security, privacy, performance, accessibility, reliability, recovery, data integrity, migration, permissions and adversarial cases as applicable. Test agent outputs, prompt-injection boundaries, tool permissions, idempotency, failure recovery and human approval gates. Preserve machine-readable results and defect dispositions.

### Gate 8 — Approval and release readiness
Maintain a release dossier covering requirements, test evidence, security findings, compliance status, risk acceptance, data migration, rollback, operational ownership, support, training, incident response and unresolved limitations. Only authorised approvers may approve release.

### Gate 9 — Certification and external assurance
Identify whether certification, accreditation, laboratory testing, independent validation/verification, audit or regulator approval is required. Use competent, authorised bodies. Record scope, validity, limitations and renewal dates. Internal test results are not external certification.

### Gate 10 — Deployment and commissioning
Use controlled environments, least privilege, signed/versioned artefacts where appropriate, secrets management, staged rollout, backups, rollback and post-deployment verification. Commission physical systems safely and document calibration, installation and acceptance where applicable.

### Gate 11 — Operations and service management
Assign accountable owners. Maintain monitoring, service levels, incident and vulnerability management, backups, disaster recovery, change control, user support, access reviews, asset lifecycle and supplier dependency controls. Ensure safe degraded operation.

### Gate 12 — Measurement and outcomes
Measure actual outcomes against the baseline and acceptance criteria. Track quality, reliability, user value, environmental/social outcomes, cost, performance, security and operational burden as relevant. Separate measured outcomes from estimates and model-generated predictions.

### Gate 13 — Continuous assurance and improvement
Review incidents, defects, drift, regulatory changes, user feedback, cost, supplier risk, agent performance and changing operating conditions. Revalidate requirements and update evidence, architecture, controls and TRL. Retire or safely decommission systems when no longer justified.

## 4. Mandatory cross-cutting control registers

Every repository MUST maintain or link to project-specific registers for:
- Requirements, assumptions, decisions and evidence provenance.
- Applicable law, regulation, permits, approvals and compliance obligations.
- Risk, safety, security, privacy and threat management.
- Agent swarm roles, tools, permissions, tasks, verification and audit.
- Architecture, data lineage, authoritative databases, interfaces and migrations.
- Test plans, results, defects and corrective/preventive actions.
- Third-party dependencies, licences, suppliers and lifecycle costs.
- Deployment, rollback, monitoring, incident response and business continuity.
- TRL/readiness evidence and unresolved gaps.
- Change history, approvals and release records.

Registers may be consolidated where traceability is preserved. Do not create duplicate records that conflict with an authoritative register.

## 5. TRL and readiness discipline

Use the recognised 1–9 Technology Readiness Level scale where appropriate. For each technology component, document:
- What exactly is being assessed and its system boundary.
- Current claimed TRL and the evidence supporting it.
- Test environment and representativeness.
- Reliability, repeatability, integration and operational evidence.
- Independent validation, field demonstration and unresolved risks.
- What evidence is required to reach the next level.

Assess software, hardware, AI models, biological/agricultural processes, industrial processes and integrated systems separately where their maturity differs. TRL is not a substitute for regulatory approval, safety certification, product-market validation or production readiness.

## 6. Agentic AI Swarm conformance

PD-01 is mandatory and non-waivable. Each project must maintain a swarm register and evidence its orchestrator, domain specialists, research/evidence, engineering, security/compliance, independent quality verification, monitoring/recovery and audit/reporting responsibilities. A diagram or proposal is not implementation. Incomplete swarm controls block the applicable Shakti conformance and release gates. Human approval boundaries remain in force.

## 7. Cost and capital discipline

Every project must state its cost assumptions and identify recurring costs, paid dependencies, data/API charges, compute, hosting, equipment, maintenance, training, certification and exit costs. Prefer free/open-source/public options only where they are lawful, secure, maintainable and fit for purpose. Free tiers and public facilities must not be assumed available or free without checking current terms and written confirmation. Do not incur costs or create paid commitments without explicit approval.

## 8. Project-specific implementation pack

Each repository MUST contain or link to:
1. A project charter and intended outcomes.
2. A project-specific applicability and compliance matrix.
3. Lifecycle gate register with owner, status, evidence link and blockers.
4. Architecture and authoritative data-source register.
5. Agent swarm architecture and operational register.
6. Security, privacy, safety and risk assessments.
7. Verification plan, test evidence and defect register.
8. Deployment/operations/rollback and incident runbooks.
9. TRL/readiness matrix where relevant.
10. A current status statement distinguishing proposed, in development, tested, independently validated, approved, deployed and operational.

A shared template may be reused, but project-specific facts, legal obligations, hazards, architecture and acceptance criteria must never be copied blindly from another project.

## 9. Governance and non-conformance

The project owner is accountable for maintaining evidence and closing findings. Critical safety, security, statutory or data-integrity gaps block affected live operation. Unresolved non-conformances must have severity, owner, containment, due date and closure evidence. No one may mark a gate passed solely because a document exists. A gate passes only when its acceptance criteria are met and evidence is reviewed.

**Shakti Golden Rule:** REALITY → EVIDENCE → COMPLIANCE → FEASIBILITY → VALIDATION → DESIGN → ENGINEERING → TESTING → APPROVAL → CERTIFICATION → DEPLOYMENT → OPERATIONS → MEASUREMENT → CONTINUOUS ASSURANCE.

**No relevant lifecycle step may be skipped.**
