# RupayKg TRL 5 Evidence Execution Plan

**Status:** Proposed execution plan; no field validation or acceptance is claimed by this document.
**Baseline:** SHAKTI TRL register and audit dated 2026-10-26.
**Target:** Demonstrate the defined RupayKg software-plus-integrations boundary at TRL 5 in a relevant environment.
**Release posture:** Production certification remains HOLD/OFF. This plan does not authorize a live deployment, data migration, external issuance, or statutory claim.

## 1. Decision rule

TRL 5 may be recommended only for a precisely defined system boundary and use case after representative integrated workflows have been demonstrated under relevant operating conditions, evidence is independently reviewed, and critical dependencies meet their own required readiness. The overall system claim cannot exceed its lowest critical dependency. Missing evidence is a blocker, not a pass.

Do not call a simulated test a field test, a CI run an operational demonstration, or a single facility a pan-India validation.

## 2. Work packages and gates

| ID | Work package | Required execution evidence | Pass condition | Initial status |
|---|---|---|---|---|
| T5-01 | Freeze scope and release | Commit SHA, build artifact digest, configuration inventory, system boundary, workflow and environment statement | Independent reviewer confirms the exact assessed version and scope | BLOCKED — not recorded |
| T5-02 | Production safety baseline | Reviewed/merged startup and TLS safeguards; exact-head CI; target identity confirmation; no acceptance-fixture path in production | Exact deployed candidate is verified; no unresolved critical safety finding | BLOCKED — relevant PRs remain unmerged |
| T5-03 | Database recoverability | Authorized backup, restore rehearsal into an isolated target, migration rehearsal, reconciliation report and rollback evidence | Restore and rollback succeed; source/target identity and record counts reconcile | NOT RUN / evidence absent |
| T5-04 | Authorized stakeholder journeys | Evidence-backed end-to-end runs for bulk waste generator, aggregator, transporter, and recycler/processor, with roles and organization/facility scope recorded | Each in-scope role completes allowed actions and is denied unauthorized actions | NOT RUN / field evidence absent |
| T5-05 | Measurement and custody chain | Source instrument identity, calibration status, measurement units/time, operator, weighment evidence, custody transitions and discrepancy handling | Each accepted measurement is traceable to its source and each custody transition is attributable and auditable | NOT RUN / device evidence absent |
| T5-06 | MRV calculation reproducibility | Methodology identifier/version, applicability decision, input evidence manifest, calculation version, independent recomputation and variance report | Independent result matches approved tolerance; excluded/rejected data remain visible and cannot silently enter totals | NOT RUN / independent reconciliation absent |
| T5-07 | External trust integrations | Actual Guardian/Hedera/HCS and Mirror Node evidence where required: authoritative IDs, timestamps, verification result, persisted provenance | Independent verification confirms the external event and stored provenance; mocks are clearly excluded | NOT DEMONSTRATED |
| T5-08 | Network and data-failure handling | Relevant-environment tests for intermittent connectivity, duplicate/replay, out-of-order events, clock drift, retry, conflict, partial failure and recovery | No silent loss, duplicate credit, unauthorized transition or unreconciled accepted record | NOT RUN / field evidence absent |
| T5-09 | Security and authorization | Threat-based tests for tenant/org/facility boundaries, roles, audit trail, session handling and sensitive evidence access | No unresolved critical/high finding in the agreed scope; exceptions are risk-accepted by an authorized owner | INCOMPLETE |
| T5-10 | Device qualification | Exact make/model and intended use, applicable MeitY/other approval evidence, calibration, device identity, tamper checks, installation and measurement comparison | Approval applicability and calibration are verified for each instrument; otherwise the hardware-dependent workflow stays blocked | NOT ASSESSED |
| T5-11 | Operational recovery | Monitored test, alert delivery, incident ownership, backup restore, recovery-time observations, audit-log review | Recovery objectives and alert ownership meet approved criteria; results and deviations are recorded | NOT RUN / evidence absent |
| T5-12 | Independent acceptance | Versioned evidence pack, test results including failures, deviations, residual risks, approvals and signed go/no-go record | Named independent reviewers approve within their remit; no unresolved critical gate | NOT STARTED |

## 3. Representative test transaction

Use only an authorized test facility and consenting/authorized participants. Use real operational records only when access, purpose, retention, privacy and statutory handling are approved. Otherwise use clearly labelled test records and do not describe them as field evidence.

For each run, capture:
- run ID, date/time and time zone, environment, build SHA and artifact digest;
- participant role and organization/facility scope, avoiding unnecessary personal data;
- source activity and evidence IDs, instrument/device identity and calibration reference if applicable;
- each state transition, actor, timestamp, correlation ID and authorization decision;
- measurement units, source record, rejected/adjusted values and reason;
- methodology/version, input manifest, calculation output and independent reconciliation;
- external system identifiers and verification evidence where the workflow requires them;
- failures, retries, offline periods, duplicates, conflicts, recovery result and unresolved discrepancy;
- reviewer, decision, limitations and evidence location/hash.

Never place credentials, tokens, private keys, full personal data or unredacted secrets in the evidence pack or repository.

## 4. Pan-India claim boundary

The product architecture remains pan-India; the readiness claim must be narrower than the architecture until evidence exists. TRL 5 evidence from one relevant environment can support only the defined use case and tested conditions. It does not establish multi-state operations, universal statutory applicability, nationwide instrument approval, or pan-India production readiness.

Before making a pan-India operational claim, maintain a separate state/UT and workflow applicability matrix covering jurisdiction-specific requirements, stakeholder coverage, connectivity, support, language/accessibility, external integrations, data residency/retention where applicable, and operating continuity. Each applicability statement must cite current authoritative evidence and an accountable reviewer.

## 5. Evidence handling and stop rules

- Store immutable source evidence or controlled references with access controls, timestamps, provenance and hashes.
- Keep synthetic, acceptance, staging and operational data distinctly labelled and segregated.
- Record failures and negative results; do not delete failed runs to improve the score.
- Stop and investigate on unexplained mass-balance variance, duplicate/replayed credit, broken custody chain, invalid calibration, unauthorized access, missing external confirmation, or unreconciled recovery.
- Do not issue carbon/environmental credentials or represent a result as regulator-approved based only on an internal platform status.
- No production migration, destructive operation, deployment or certification is authorized by this plan.

## 6. Evidence ledger template

Create one row per test run:

| Run ID | Gate | Release SHA | Environment/site | Evidence reference/hash | Result | Defects/deviations | Reviewer | Decision/date |
|---|---|---|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | NOT RUN | TBD | TBD | TBD |

A gate remains BLOCKED until the evidence and authorized decision are attached. Do not replace NOT RUN, NOT ASSESSED, or NOT DEMONSTRATED with a pass without new evidence.

## 7. Current go/no-go

**Decision: NO-GO for declaring TRL 5 or production certification.**

Reason: reviewed repository evidence supports only a provisional controlled-software TRL 4 assessment; field workflows, approved/calibrated instrument linkage, independent MRV reconciliation, live external trust evidence, recovery exercises and independent acceptance are not established by the current evidence.

**Next action:** close the code-level production safety review first, then prepare a controlled relevant-environment test with authorized participants and a named independent reviewer. Reassess TRL only against the resulting evidence pack.
