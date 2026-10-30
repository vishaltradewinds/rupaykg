# RupayKg TRL-9 Integrated Platform Execution Plan

**Plan baseline:** 2026-10-30  
**Repository:** `vishaltradewinds/rupaykg`  
**Track:** Parallel to repository cleanup and migration-provenance reconciliation  
**Status:** Execution framework established; TRL-9 **NOT CLAIMED**  
**Release posture:** Production HOLD · scheduler OFF · certification HOLD/OFF

## 1. Objective and decision rule

Demonstrate that the defined RupayKg release operates reliably as an integrated circular-economy/MRV platform in its real intended environment, with representative real users, real waste/resource flows, authorized measurement devices or traceable source records, external trust services where configured, production operations, security controls, and independently reviewable evidence.

A successful build, green CI, HTTP 200, test fixtures, simulated device readings, testnet activity, or a live service alone is not TRL 9. TRL applies to a defined system configuration and operational use case; do not award one undifferentiated TRL score to software, sensors, external integrations, and the whole platform.

## 2. Current evidence baseline — do not overstate

The repository contains a digital MRV lifecycle, Guardian/Hedera/Mirror Node acceptance contract, Golden Transaction gate, SWM 2026 mapping, migration validation, and release-gate documentation. Render has a live service. The 2026-10-30 checkpoint also records unresolved migration-source/ledger divergence and unproven Render-to-Neon target and immutable deployment artifact/SQL provenance.

Outstanding blockers include:
- Production database target and immutable deployed artifact/migration provenance.
- Independent review and exact-head PostgreSQL acceptance for worker recovery.
- Authoritative live Guardian execution, Hedera consensus and Mirror Node payload verification for a real, non-fixture activity.
- Real urban and rural end-to-end Golden Transactions.
- Real device/field evidence and the complete hardware IoT stack acceptance.
- Security, backup/restore, rollback, monitoring, incident response, and sustained-operation evidence.
- Current, use-case-specific statutory applicability and required authority approvals.

**No current TRL number is assigned by this document.** Establish a baseline only after evidence is inventoried and independently reviewed. Do not infer TRL 8 or 9 from the deployment status.

## 3. Parallel execution lanes

### Lane A — Source, database, artifact and release provenance (P0)
1. Finish the repository cleanup review without merging unreviewed feature or migration branches.
2. Establish the exact Render deployment, image digest, source commit and runtime configuration identity without printing secrets.
3. Establish whether the runtime database endpoint resolves to the intended Neon project/branch using an authorized metadata-only method; record identifiers, not credentials.
4. Reconcile migration file inventory, checksums, migration ledger and schema/function/trigger state for production, staging and rehearsal.
5. Investigate date-stamped migration ledger timestamps that predate filenames.
6. Run migration validation and clean disposable PostgreSQL tests on the exact candidate SHA.
7. Obtain independent review and explicit release approval before any production remediation.

**Exit evidence:** signed/attributed provenance record linking source SHA → build → immutable artifact digest → deployment → database target identifier → migration checksums/ledger → reviewer/approval. No migration replay, rollback, renumbering, or production write is authorized by this plan.

### Lane B — Core software reliability and security (P0/P1)
1. Map every open implementation PR to its exact head/base SHA, CI, dependency, and unique behavior; choose canonical stacks without losing unique work.
2. Close worker reliability gates: exact-head PostgreSQL tests, exhausted null-lease quarantine, recovery, fencing-token safety, zero prohibited MRV/Guardian side effects, and explicit zero relevant skips.
3. Validate authorization, tenant/geography isolation, reserved-role dual control, immutable audit behavior, idempotency, replay protection, rate limiting, and fail-closed paths.
4. Run the repository's migration validator, unit/integration suites, typecheck, build, browser smoke, production-container build, and security/dependency scans on the exact candidate SHA.
5. Demonstrate backup restoration, rollback rehearsal, alerting, incident response, and recovery-time/recovery-point objectives using non-production systems first.
6. Record unresolved defects and risk acceptance; no P0 security, data integrity, authorization, or settlement defects may be waived silently.

**Exit evidence:** exact-SHA CI/run links and retained logs, test inventory with pass/fail/skip counts, security findings with disposition, independent review, and successful operational recovery rehearsal.

### Lane C — MRV, Guardian, Hedera and registry integrity (P0)
1. Use a real, authorized activity with actual measurement observations, evidence, authorized verification and applicable methodology; explicitly exclude acceptance fixtures.
2. Run the deployed RupayKg → real Guardian adapter workflow using an approved Guardian release/policy and secure credentials.
3. Record authoritative Guardian execution ID and verified status.
4. Anchor the exact provenance tuple to the configured Hedera network; record topic, transaction ID and consensus timestamp.
5. Retrieve the message from Mirror Node and verify exact identifiers, payload and integrity hash.
6. Persist and verify the Mirror Node verification marker for that exact provenance row.
7. Prove registry/value issuance remains blocked when any stage, identity, hash, eligibility, or statutory evidence is absent or mismatched.
8. Test negative cases: missing configuration, timeout, malformed response, duplicate/idempotent submission, consensus failure, Mirror Node absence, hash mismatch, and acceptance-fixture issuance attempt.

**Exit evidence:** redacted acceptance manifest with correlation/idempotency identifiers, external transaction references, payload/hash match, negative-test results, and reviewer attestation. Never commit tokens, private keys or secret material.

### Lane D — Hardware and field IoT integration (parallel P0/P1)
1. Freeze the field use case and site conditions: material/waste stream, measurement purpose, operating range, units, sampling cadence, environment, calibration, power/connectivity and responsible operator.
2. Produce a bill of materials and interface map for each sensor, meter, edge controller, communications link and gateway. Identify origin, certification/approval status, data-sheet revision, firmware and lifecycle support. Where the project requires MeitY-approved devices, record the applicable official evidence; do not assume that a processor brand or Indian assembly proves approval or 100% domestic manufacture.
3. Define a device identity/enrollment, secure boot/firmware update (where supported), signed device messages, time synchronization, local buffering, offline replay protection, sequence numbers, and tamper/fault detection design.
4. Verify raw-data capture, unit conversion, calibration metadata, clock drift, missing/out-of-range readings, duplicate delivery, sensor disconnection, power loss, network outage, and recovery.
5. Test device → edge → API → MRV observation → evidence object → verification → calculation lineage end to end. Preserve raw readings and transformations; never replace missing readings with synthetic operational data.
6. Perform bench tests first, then controlled site tests, then sustained field operation with an operator runbook and maintenance/calibration schedule.
7. Keep device-level TRL separate from the integrated platform TRL. Record component failures and replacement/recalibration events.

**Exit evidence:** approved device/BOM dossier, calibration and traceability records, firmware/configuration hashes, bench and site test logs, fault-injection results, data lineage reconciliation, operator sign-off, and field run duration/availability metrics. No device list or sensor accuracy is assumed complete until physically verified.

### Lane E — Regulatory, methodology and claims integrity (P0)
1. Version and retain authoritative source copies, effective dates, applicability decisions and reviewer notes for relevant Indian SWM/BWG/EPR/CCTS/CCC, carbon-credit, data protection, and sector/site obligations.
2. Separate legal requirements, platform workflow support, methodology rules, voluntary integrity benchmarks, and authority decisions.
3. Treat ICVCM Core Carbon Principles as a complementary voluntary integrity benchmark, never a substitute for Indian law or the applicable crediting program.
4. Validate methodology eligibility, additionality, baseline, quantification, uncertainty, leakage, permanence/reversal where relevant, safeguards, verification and double-counting prevention for each selected use case.
5. Keep CPCB/ULB/SPCB/BEE/registry/other authority certificates and portal status sourced from competent authority records. RupayKg must not fabricate, impersonate or imply official issuance.
6. Test out-of-scope waste streams, missing documents, expired registrations, inconsistent quantities, unsupported methodologies and conflicting evidence as unresolved or blocked.

**Exit evidence:** versioned legal/applicability matrix reviewed by a qualified domain/legal reviewer, methodology evidence pack, authority references, claims-control tests, and documented jurisdiction/site limitations.

### Lane F — Real operations and representative use (P0)
1. Select and authorize representative urban and rural sites and real operating partners; define consent, data ownership, safety, support and responsibilities.
2. Complete one real urban Golden Transaction and one real rural Golden Transaction through all applicable lifecycle stages.
3. Reconcile source quantities, custody transfers, facility receipt/processing, rejects/residuals, measurements, verifier decisions, external provenance and downstream registry/settlement state.
4. Demonstrate operator onboarding, language/accessibility needs, field usability, exception handling, support escalation, and training.
5. Operate the integrated configuration for a pre-agreed representative period covering ordinary use and foreseeable failures. Define thresholds before the trial; do not invent pass rates after seeing results.
6. Capture user/partner acceptance, incident records, maintenance actions, service availability, data completeness, reconciliation error rates and unresolved exceptions.

**Exit evidence:** site authorization, dated operational logs, non-fixture transactions, reconciled source records, user/partner acceptance, incident/availability report, and independent field acceptance.

### Lane G — Production operations and continuous assurance (P1)
1. Establish monitoring for API/service health, queue/worker lag, database health, external integration failures, failed verifications, reconciliation exceptions, device health, and security alerts.
2. Define severity, on-call responsibility, incident communication, escalation, restore and rollback procedures.
3. Test backup restore and recovery in a separate environment; document RPO/RTO results and compare with approved targets.
4. Confirm capacity and performance under representative and stress workloads, including degradation when Guardian/Hedera/network/device links are unavailable.
5. Verify data retention, deletion/hold rules, privacy boundaries, auditability, access reviews and secret rotation.
6. Review field feedback, incidents, defects and methodology/regulatory changes on a defined cadence.

**Exit evidence:** operational runbooks, monitoring/alert demonstrations, restore/rollback records, load and resilience test reports, access/security review, and signed operations handover.

## 4. TRL stage gates

| Gate | Required demonstration | Decision rule |
|---|---|---|
| G0 — System boundary | Versioned configuration, use cases, intended environment, interfaces, exclusions and acceptance criteria | No score until system boundary is explicit |
| G1 — Evidence baseline | Repository, runtime, schema, integration, hardware, regulatory and operational evidence inventory | Unknowns recorded; no assumptions promoted to facts |
| G2 — Component verification | Core software, device components, security controls and external adapters tested individually | Failed/untested components remain blockers |
| G3 — Integrated verification | Software, hardware/edge, database, Guardian/Hedera and MRV lineage pass controlled integration tests | No synthetic data represented as real |
| G4 — Representative environment | Real authorized sites, operators, devices/source records and non-fixture transactions | Both applicable urban/rural pathways accepted |
| G5 — Operational qualification | Sustained operation, failure recovery, monitoring, support, backup/restore and user acceptance | Predeclared acceptance thresholds met |
| G6 — Independent TRL-9 review | Independent assessor verifies representative real-environment evidence against the defined configuration and criteria | TRL 9 only if every mandatory criterion passes and residual risks are explicitly dispositioned |

TRL 9 is a claim about a specific configuration and operational context. Any material change to the deployed software, migration state, device firmware, measurement chain, methodology, or external trust integration may require targeted requalification.

## 5. Evidence ledger schema

For every acceptance item capture:
- unique evidence ID and gate;
- requirement and test/operation procedure version;
- system/configuration identifier and source commit;
- environment/site and test date/time;
- responsible operator and independent reviewer;
- source artifact/log location and cryptographic digest where practical;
- inputs, expected result, observed result, pass/fail/blocked;
- counts of tests passed, failed, skipped and not run;
- defects, risk disposition and corrective-action reference;
- signatures/approval and re-test link.

Evidence must be attributable, reproducible, tamper-evident where required, and retained according to policy. Screenshots alone are insufficient for critical data-integrity or external-consensus claims where machine-readable records are available.

## 6. Current blockers and non-negotiable controls

- Migration 096 source/ledger and candidate-branch identity collision remains unresolved.
- Render's exact Neon target and immutable deployed artifact digest remain unproven.
- No release, migration replay/rollback, scheduler activation, certification, or production data/schema write is authorized by this plan.
- Real Guardian/Hedera/Mirror Node acceptance remains outstanding until authoritative records are collected.
- Real field hardware acceptance and real urban/rural transactions must be demonstrated; acceptance fixtures do not qualify.
- No claim of statutory certification, issued carbon credit, official CPCB certificate, verified device accuracy, domestic manufacture, or TRL 9 without its specific evidence.

## 7. Execution order and parallelism

Proceed in parallel on lanes B, C (non-production test environment), D, E and F preparation while lane A resolves release provenance. Use disposable databases, testnet/sandbox environments and controlled sites where appropriate. Production-side execution is conditional on authorization, reviewed change plan, backup/rollback evidence and closure of applicable release gates.

Do not allow the migration collision to silently block independent design/testing work, but do not use parallel work as a reason to merge risky candidate branches or modify production.

## 8. Next batch acceptance checklist

- [ ] Publish exact-head inventory of all candidate PRs and branch dependencies.
- [ ] Resolve independent reviewer and exact-head worker PostgreSQL acceptance.
- [ ] Produce Render deployment-to-source/artifact/database provenance manifest without exposing secrets.
- [ ] Reconcile production/staging/rehearsal migration identity and timestamps.
- [ ] Build a device/BOM/interface and measurement traceability matrix with authoritative approval evidence.
- [ ] Prepare real Guardian/Hedera/Mirror Node acceptance environment and evidence manifest.
- [ ] Prepare urban and rural site qualification and non-fixture Golden Transaction test plans.
- [ ] Complete current regulatory/methodology applicability review for selected real use cases.
- [ ] Define operational SLOs, RPO/RTO, performance/security acceptance thresholds before testing.
- [ ] Obtain independent review of evidence and explicit release approval.
- [ ] Assign a TRL score only after independent gate-by-gate evidence review.

**Current decision: TRL 9 NOT DEMONSTRATED. Workstream active; production HOLD remains in force.**
