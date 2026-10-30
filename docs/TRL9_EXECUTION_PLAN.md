# RupayKg: Complete Execution Plan to Achieve TRL 9

**Plan date:** 2026-10-30  
**Governance:** Shakti Standards  
**Canonical repository:** `vishaltradewinds/rupaykg`  
**Baseline decision:** Provisional software TRL 4; integrated-platform TRL unverified; hardware/IoT TRL not assessed where evidence is insufficient; production certification HOLD/OFF.  
**Status of this document:** Controlled execution plan; it is not evidence that any gate has passed.

## 1. Standing execution rule

All RupayKg engineering, compliance, ESG, EPR, CCTS/CCC, MRV, carbon methodology, Guardian/Hedera, AI, hardware/IoT, deployment, operations and scale-up work MUST proceed in accordance with this plan and Shakti Standards.

1. Treat this document as the master route to a defensible TRL 9 determination. Maintain component-specific plans and evidence ledgers beneath it; do not create conflicting readiness standards.
2. Work in coherent, dependency-aware batches. Parallelize only independent work; never bypass a prerequisite gate.
3. Before editing a repository area, inspect the canonical repository, current branch/head, relevant files, open PRs, CI and overlapping parallel work. Coordinate with existing PRs and avoid conflicting changes.
4. Use exact-head validation: results from an earlier commit do not validate a later modified head. Never report unrun, pending, skipped, mocked, synthetic or environment-gated tests as passes.
5. Evidence precedes claims. Keep NOT RUN, NOT ASSESSED, NOT DEMONSTRATED, BLOCKED and FAILED states explicit. A document, code path, mock, health check, CI pass or PR merge is not proof of field operation, legal approval, external issuance or TRL 9.
6. Fail closed on unresolved safety, security, authorization, migration, measurement, calibration, evidence lineage, methodology applicability, regulatory interpretation or external confirmation.
7. No production database mutation, migration, deployment, scheduler activation, credential issuance, external transaction, statutory filing or certification is authorized merely by this plan. Each requires its own approved release and operational gate.
8. Keep Indian statutory requirements distinct from voluntary frameworks and integrity benchmarks. ICVCM Core Carbon Principles may complement but never replace Indian law, CCTS requirements or official authority decisions.
9. Maintain pan-India architecture intent, but scope each readiness claim to the tested configuration, sites, workflows, jurisdiction and operating conditions. Do not infer nationwide readiness from a single-site test.
10. Do not advance a component or whole-platform TRL without the required evidence, named accountable owner, appropriate independent review and signed gate decision. The overall system claim cannot exceed the lowest critical dependency necessary for the claimed use.
11. After every batch, report completed work, exact evidence/commit references, checks actually run, failures and blockers, next dependency, and whether the gate passed. Do not mark this plan complete until the relevant gates have passed.
12. Production certification remains HOLD/OFF until the explicit final approval gate is passed.

## 2. What TRL 9 means for RupayKg

TRL 9 means the final, integrated system has been proven through successful operation in its intended real-world environment. It is not earned by a successful build, passing automated tests, a merged PR, a simulated facility, or an internal status label.

Assess separately:
- individual software, hardware, instrument, edge, AI and external-integration components;
- integrated subsystems such as EPR, MRV, carbon calculations and ESG reporting;
- the integrated RupayKg system within a precisely declared scope;
- operational performance and sustained supportability; and
- statutory approvals, accreditations, verifications or certificates, which are distinct claims requiring their own evidence.

## 3. Current baseline and known gaps

The preceding repository audit supports only a provisional software-platform TRL 4 assessment. The complete integrated-platform TRL is unverified. Hardware/IoT and field readiness are not established by adapter contracts or software tests. Production deployment must be evidenced, not inferred from a deployment specification.

Relevant open engineering work includes, subject to current-head revalidation:
- PR #90 — TRL 5 execution-plan documentation;
- PR #93 — TRL evidence ledger;
- PR #87 — TRL in Shakti Standards;
- PR #126 — migration-history fail-closed handling;
- PR #127 — authoritative Indian regulatory source register;
- PR #128 — hardware-edge observation contract;
- PR #129 — strict timezone-aware capture timestamps;
- PR #97 — ICVCM and governed agentic integration;
- PR #102 — Guardian/Mirror Node response hardening;
- PR #108 — dual-ledger migration compatibility acceptance;
- PR #120 — production safety, EPR quantity and ESG verification;
- PR #121 — GRI cross-mapping schema extension.

These are work references, not blanket approval. Inspect actual current status, exact head SHA, overlap and CI before acting. Do not merge, close, rewrite, or deploy any of them solely because they appear in this list.

## 4. Gated execution roadmap

Durations are initial planning ranges only; gates depend on evidence, not elapsed time. Workstreams may overlap where dependencies allow.

| Phase | Objective | Required outputs | Exit gate |
|---|---|---|---|
| 0. Baseline and governance | Establish operational truth | Canonical branch/commit, PR dependency map, component inventory, production/deployment identity, migration-ledger comparison plan, risk register, evidence ledger | Reproducible baseline; unknowns and owners recorded |
| 1. Requirements and architecture | Define the exact system to qualify | System boundary, intended uses, stakeholder journeys, requirements-to-tests matrix, interfaces, threat model, performance/recovery targets | Requirements and acceptance criteria reviewed and approved |
| 2. Software/database integrity | Make core platform safe and reproducible | Migration/source reconciliation, fresh install and upgrade tests, recovery rehearsal, API/tenant/RBAC tests, idempotent state transitions, offline-sync tests, secure release process | No unresolved critical integrity/security defect; exact-head checks pass |
| 3. Regulatory/methodology qualification | Establish correct rule and calculation boundaries | Archived official source artifacts, hashes, effective dates, applicability analysis, amendment lineage, methodology test vectors, independent calculation reproduction | Applicable rules/methods reviewed; unresolved interpretations fail closed |
| 4. Hardware/IoT qualification | Qualify physical measurement chain | Controlled BOM, exact makes/models, approval applicability, calibration and metrology records, device identity/authentication, firmware/interface matrix, hardware-in-loop tests | All critical instruments/interfaces qualified for intended use |
| 5. Integrated laboratory validation | Prove the end-to-end chain under controlled conditions | Device-to-edge-to-cloud-to-evidence-to-calculation-to-review tests, negative cases, failure injection, performance/security/recovery results | Preapproved integrated acceptance suite passes |
| 6. Relevant-environment prototype | Test realistic site conditions | Site permissions/readiness, actual or explicitly labelled test data, environmental/connectivity tests, operator workflows, independent reference comparisons | Representative conditions pass; limitations are controlled |
| 7. Operational prototype | Demonstrate actual use at a real site | Site acceptance, real users, real equipment, operational records, exception/recovery logs, support measurements | Intended workflows work in operation; evidence independently reviewed |
| 8. Final system qualification | Qualify the production configuration | Frozen release/configuration, full regression, security assessment, deployment and recovery proof, training/support docs, signed qualification record | Production candidate meets approved qualification criteria |
| 9. Sustained live operation | Generate TRL 9 operational evidence | Pre-registered operating protocol, representative duration/cycles, telemetry, incident and maintenance records, reconciliations, reliability metrics, recovery exercises | Actual system meets predefined operational criteria repeatedly |
| 10. Independent TRL assessment | Make defensible readiness decision | Versioned evidence pack, independent technical/domain reviews, risk disposition, scope and exclusions, signed go/no-go | No critical gate failed or unproven within claimed scope |
| 11. Controlled national rollout | Extend repeatable operations | State/UT and use-case applicability matrix, deployment waves, support capacity, local validation and continuous monitoring | Each declared rollout scope meets its own gates; no unsupported national claim |

## 5. Work-package details

### 5.1 Repository, release and database integrity
- Use `vishaltradewinds/rupaykg` as canonical source unless a deliberate, approved source-of-truth change is recorded.
- Inspect the current main/release SHA, all open PRs, their exact heads, CI, reviews and overlapping files before edits.
- Reconcile the full source migration catalogue with authorised read-only production/staging ledgers and actual schema objects. Do not rewrite historical ledgers, fabricate checksums, replay migrations against live systems, or weaken fail-closed guards.
- Rehearse fresh installs, supported upgrade paths, interrupted migration recovery, backup restoration and forward-only reconciliation in isolated disposable environments.
- Verify database constraints, indexes, triggers, tenant/geography policies, sequences, roles and evidence-preservation behaviour.
- Require independent database/security review before any approved live operation.

### 5.2 Software security, authorization and reliability
- Test authentication, session lifecycle, tenant/org/facility/geography boundaries, route-level permissions, reviewer/verifier independence, secrets, dependency/container vulnerabilities, rate limits, CORS, sensitive-data access and audit integrity.
- Exercise invalid transitions, repeated requests, concurrent updates, duplicate/replayed events, conflicting versions, partial failures, offline queues, timestamp/timezone errors, clock drift, device restarts and retries.
- Ensure accepted observations cannot silently disappear, duplicate or change meaning.
- Require a defined incident-response plan, monitored alerts, backup/restore evidence, recovery objectives and tested release rollback/forward recovery.

### 5.3 Indian regulatory, EPR, ESG/BRSR, GRI and CCTS/CCC
- Maintain a single controlled regulatory source register with official source artifacts, SHA-256, authority, effective dates, applicability, amendment/supersession lineage, reviewer and linked software rule.
- Distinguish binding law, draft/consultation material, scheme rules, permits/consents, voluntary standards and internal controls.
- For SWM/EPR, map stakeholder duties, evidence, quantity lineage, custody, reconciliation, exceptions, deadlines and official portal actions. Local preparation is not CPCB submission or acceptance.
- For ESG/BRSR/GRI, preserve reporting framework/version, boundaries, metric units, periods, source lineage, estimates/missing values, reconciliation, approval and export reproducibility. Do not conflate GRI reporting with statutory compliance.
- For CCTS/carbon workflows, confirm activity and methodology applicability, source document version, monitoring boundary, baseline/project logic, uncertainty, additionality where required, leakage, double counting and independent reproducibility.
- Clearly separate internally CALCULATED, internally VALIDATED, independently VERIFIED and externally ISSUED states. Never claim an official certificate without authoritative issuance evidence.

### 5.4 MRV and external trust integrations
- Trace every material result back through approved source evidence, instrument/device identity, calibration status, custody/flow allocation, methodology version, calculation, reviewer and decision.
- Test missing evidence, impossible values, expired calibration, mass-balance variance, duplicate allocation, cross-tenant attempts and verifier self-approval.
- For Guardian/Hedera/Mirror Node, require an authorized non-production end-to-end transaction with external transaction/topic identifiers, consensus proof, persisted provenance, digest comparison, timeout/retry/duplicate/mismatch tests and sanitized evidence.
- A mock, unit test or synthetic transaction is not live external acceptance. Technical provenance does not by itself establish statutory or methodology eligibility.

### 5.5 Hardware and IoT
- Freeze the intended device/sensor bill of materials, manufacturer/model, protocol, firmware, range, accuracy, uncertainty, operating environment, supportability and approval requirements.
- Verify any MeitY or other approval requirements against the applicable official procurement/deployment rule; do not assume a generic claim is sufficient.
- Establish calibration traceability and recalibration/expiry behaviour. Invalid or expired calibration must block affected measurements from qualified workflows.
- Validate device identity, authentication, key rotation/revocation, message integrity, sequence/replay protection, clock synchronisation, offline persistence, power-loss behaviour and tamper response.
- Demonstrate the complete physical event → instrument → edge → authenticated transport → server validation → evidence record → calculation → review chain at an authorized site.

### 5.6 Integrated and field validation
- Run unit, contract, integration, end-to-end, hardware-in-the-loop, database, security, performance, resilience, recovery and regulatory regression tests.
- Use negative tests as first-class acceptance cases.
- Qualify the site, permissions, instruments, connectivity, data access, safety procedures, operators and independent references before formal field testing.
- Record actual run ID, release SHA/artifact digest, site/environment, device/calibration identities, timestamps/timezones, evidence IDs/hashes, state transitions, reviewer, failures, retries, recovery and deviations.
- Keep synthetic, test, staging and live operational records distinctly labelled and segregated.

### 5.7 Production and sustained operations
- Freeze source SHA, artifact digest, schema/migration version, device firmware, configuration, methodology/regulatory versions, security policies and external interfaces.
- Verify actual deployment identity, TLS, secrets, authentication mode, origin policy, production data mode, monitoring, alerting, backups, restore, recovery and rollback.
- Before formal TRL 9 operations, predefine sites, use cases, duration/activity cycles, sample sizes, acceptance thresholds, exclusions, recovery objectives, incident thresholds and stop rules.
- Measure availability, data completeness, data integrity, measurement quality, calculation reproducibility, recovery, security, user task completion, integration performance and supportability with auditable denominators.
- Do not set a universal number of days/transactions after the fact. Duration and sample size must be justified by intended use, risk and operating frequency.

## 6. Evidence and decision rules

Each evidence record must include, where applicable:
- unique evidence/run ID and requirement/gate ID;
- exact commit, artifact digest and configuration;
- environment/site and test protocol;
- timestamp and timezone;
- source, instrument/device identity and calibration reference;
- source evidence identifiers and integrity hashes;
- test method, expected result, observed result and pass/fail;
- logs, deviations, defects, retries and recovery evidence;
- reviewer, decision, date and limitations.

Allowed states: `NOT RUN`, `NOT ASSESSED`, `NOT DEMONSTRATED`, `BLOCKED`, `FAILED`, `PASS`, and `NOT APPLICABLE` (with justification). Do not silently convert one state to another.

Stop and investigate on unexplained mass-balance variance, duplicate/replayed credit, broken custody chain, invalid calibration, unauthorized access, missing external confirmation, unreconciled database state, silent data loss or an unresolved critical security/safety defect.

A TRL 9 claim must be limited to the exact qualified system boundary, release, sites/use cases and operating conditions supported by evidence. It does not automatically establish statutory certification, accreditation, legal authorisation, official certificate issuance or pan-India readiness.

## 7. Shakti Standards mandatory gates

- G0 Reality and scope
- G1 Requirements and acceptance criteria
- G2 Baseline and traceable evidence
- G3 Engineering and remediation
- G4 Exact-candidate verification
- G5 Regulatory/methodology applicability
- G6 Hardware/metrology qualification
- G7 Integrated-system validation
- G8 Real-site acceptance
- G9 Final production-system qualification
- G10 Sustained live-operation evidence
- G11 Independent TRL assessment
- G12 Continuous assurance and change control

Each gate requires an accountable owner, objective criteria, evidence, defects/risks disposition, independent review where appropriate, signed decision and rollback/containment plan. Failure blocks progression.

## 8. Governance, resourcing and cadence

Named responsibilities must be assigned for programme leadership, platform architecture, backend/database, frontend, IoT/embedded, instrumentation/metrology, carbon/MRV, regulatory, security, QA/verification, site operations, independent assessment and production support. Roles may be combined only when appropriate independence is preserved.

- Daily: engineering blockers and critical defects.
- Weekly: batch evidence, dependencies and exact-head validation.
- At each gate: formal pass/fail decision.
- Monthly: risk, security, regulatory and readiness reassessment.
- Every release: exact-version verification and approval.
- After incidents: root-cause analysis and corrective action.
- On regulatory/methodology changes: controlled applicability and regression review.

Planning estimate: roughly 9–18 months or longer from the provisional baseline, subject to audit results, site access, hardware lead times, external integration permissions, independent review and sustained-operation evidence. This is not a committed date. Budget must cover engineering, equipment, calibration, site installation, connectivity, security testing, independent assurance, training, support, maintenance and contingency. Cost optimization must not bypass necessary safety, calibration, security or independent assurance.

## 9. Initial execution order

1. **Batch A — Baseline and coordination:** verify canonical branch/head, PR overlap, deployment identity, migration/schema/ledger status, evidence register and risk owners.
2. **Batch B — Critical software integrity:** reconcile migrations; close production startup, authorization, data integrity, audit and synchronization risks.
3. **Batch C — Hardware qualification foundation:** freeze BOM, device requirements, calibration, identity and edge protocol; build hardware-in-loop plan.
4. **Batch D — Regulatory and calculation qualification:** archive/verify official sources, lock applicability and methodology versions, add test vectors and independent recalculation.
5. **Batch E — Integrated laboratory acceptance:** run exact-candidate tests and controlled failure/recovery cases.
6. **Batch F — Relevant-site preparation and prototype:** confirm permissions, instruments, operators and independent references; execute field protocol.
7. **Batch G — Final-system qualification:** freeze production configuration and pass complete release qualification.
8. **Batch H — Sustained operations:** collect representative live-operation evidence under preapproved thresholds.
9. **Batch I — Independent TRL decision:** review the complete evidence package and residual risks.
10. **Batch J — Controlled pan-India rollout:** expand by evidence-backed waves with local applicability and support checks.

Batch order is mandatory where dependencies apply; independent source research, requirements work, hardware procurement planning and test design may run in parallel. The team must inspect and coordinate with active PRs before modifying overlapping files.

## 10. Current go/no-go

**Decision: HOLD / NO-GO for declaring overall TRL 9 or production certification.**

The starting assessment remains provisional software TRL 4; integrated-platform TRL is unverified; hardware/IoT and sustained live-operation readiness are not established by the evidence cited in the preceding audit. No gate is considered passed merely because this plan has been saved.

**Next required action:** execute Batch A against the current canonical repository and active PR state, preserve all parallel work, and report the exact baseline and blockers before making risky changes.