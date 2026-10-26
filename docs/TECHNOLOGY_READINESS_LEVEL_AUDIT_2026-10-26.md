# RupayKg Technology Readiness Level (TRL) Audit

**Assessment date:** 2026-10-26  
**Repository assessed:** `vishaltradewinds/rupaykg`  
**Baseline:** `main` at `0ddcf6087620880e21ea60f954c9f05d6b759469`  
**Assessment type:** Repository-evidence review; not an independent certification, field audit, or production acceptance.

## Executive decision

**Provisional software-platform assessment: TRL 4 (components/workflows validated in a controlled environment), with TRL 5 not yet demonstrated by the available evidence.**

This is a conservative assessment of what the repository evidence supports, not a claim that every subsystem has reached TRL 4. The repository contains a substantial TypeScript monorepo, PostgreSQL migrations, authorization and lifecycle controls, evidence/MRV paths, integration tests, and a CI workflow that builds and tests the application. Those are meaningful engineering outputs.

The repository does **not** establish that the complete pan-India operating platform has been demonstrated end-to-end with real, authorized stakeholders, real field activity, approved instruments, independently verified MRV, and sustained operation. Deployment or HTTP 200 alone does not advance the TRL.

**Hardware TRL: NOT ASSESSED / EVIDENCE INSUFFICIENT.** The repository does not provide sufficient verified device-level evidence, MeitY approval records tied to exact models/use cases, calibration certificates, field installation records, or instrument-to-platform acceptance results to assign a defensible hardware TRL.

This report does not authorize production certification, a release, a database migration, a deployment, or a merge.

## TRL interpretation used

The scale is applied as an evidence rubric for this software-plus-hardware system:

- **TRL 1–2:** principles and intended concept/architecture identified.
- **TRL 3:** critical concepts demonstrated analytically or experimentally.
- **TRL 4:** components and workflows validated in a controlled environment.
- **TRL 5:** representative integrated workflows demonstrated in relevant operating conditions.
- **TRL 6:** integrated system demonstrated in a relevant operational environment.
- **TRL 7:** integrated prototype demonstrated in an actual operational setting.
- **TRL 8:** complete system qualified through required acceptance and qualification testing.
- **TRL 9:** system proven through sustained, successful real-world operation.

This mapping is an assessment rubric, not a claim that every scheme or subsystem uses identical TRL criteria. A formal TRL determination needs an agreed system boundary, use case, environment, and independent evidence review.

## Evidence observed in the repository

### Evidence supporting a provisional TRL 4

1. **Software architecture exists:** web application, API, domain packages, migrations, and documented lifecycle model are present.
2. **Controlled validation exists:** the CI workflow runs migration validation, clean PostgreSQL migrations, type-checking, production build, browser smoke checks, automated tests, and a production-container build.
3. **Safety controls are implemented in code:** repository evidence includes organization/geography authorization, evidence and verification boundaries, lifecycle/state controls, guarded registry/settlement operations, and AI-advisory boundaries.
4. **Subsystem tests exist:** test files cover evidence vault, MRV, Guardian/Hedera adapters, lifecycle integration, authorization, production configuration, registry/settlement and synchronization.
5. **Release gates are documented:** `docs/PRODUCTION_READINESS_MATRIX.md`, `docs/SHAKTI_PRODUCTION_GATE_RUPAYKG.md`, `docs/GOLDEN-TRANSACTION-READINESS-2026.md`, and `docs/GUARDIAN_LIVE_ACCEPTANCE.md` distinguish CI evidence from external/live acceptance.

### Evidence that is missing or insufficient for TRL 5+

1. **Real end-to-end transactions:** no evidence in the assessed main-branch repository proves both real Urban and Rural transactions completed through the full lifecycle with authoritative IDs and statuses.
2. **External Guardian/Hedera trust chain:** documented acceptance requires real Guardian verification, HCS consensus, persisted provenance, and independent Mirror Node verification. Repository documentation explicitly treats these as external acceptance gates.
3. **Physical instruments and sites:** no complete, verified evidence package was found tying exact approved hardware models, calibration/maintenance status, field installation, device identity, measurements, and platform records together under relevant operating conditions.
4. **Pan-India operational evidence:** no evidence establishes sustained multi-state operations, production-grade support, regional connectivity/offline recovery, stakeholder onboarding at scale, or representative stress/continuity performance.
5. **Production recovery and assurance:** live backup restoration, rollback drills, monitoring/alerting and incident response evidence must be demonstrated, not just documented.
6. **Statutory and external approvals:** the platform's own workflow state does not substitute for regulator-issued registration, approvals, verification, or certificates.

## Material repository finding: main and proposed remediation differ

At the assessed `main` commit, the root `Dockerfile` startup command runs database migrations and then `apps/dist/src/acceptance-seed.js` before starting the production server. This creates a material release-safety concern: acceptance fixtures must never be inserted into an operational dataset.

A proposed fix exists in **PR #85** (`security/greenfield-data-safety`), which removes acceptance seeding from normal startup and adds production configuration/TLS checks before migration. Its exact head `dfb98dd847cc1a865cdb12322a63004b4c96d9e2` has a successful CI run `40322437474`. **That PR is open and unmerged**; its controls must not be described as present on main or live production until merged, deployed, and accepted.

The greenfield data-migration strategy is in **PR #84**, also open and unmerged. Its exact head `25e48edbf2daf437270748a6b55e16db836fc7d3` has successful CI run `40323378832`. The strategy correctly treats greenfield as a target data model/data migration decision, not as permission to discard genuine operational records.

A successful PR CI run validates the tested commit in CI; it does not prove live service behavior, database target identity, production TLS, actual data migration safety, or production acceptance.

## Subsystem readiness ledger

| Subsystem | Repository-evidence assessment | What is needed to increase confidence |
|---|---|---|
| Core application/API/domain model | TRL 4 provisional | Independent review plus end-to-end acceptance against agreed real workflows |
| PostgreSQL schema/migrations | TRL 4 in clean CI only | Confirm intended source/target DB identity, backup/restore, migration rehearsal, data reconciliation, rollback |
| Identity, roles and geography controls | TRL 4 in tests | Real identities, independent authorization tests, tenant/geography abuse cases in deployed environment |
| Field/offline synchronization | TRL 4 in controlled tests | Field-device trials with intermittent networks, replay/conflict recovery and real operator workflows |
| Evidence vault and MRV lifecycle | TRL 4 in controlled tests | Real activity and evidence, instrument lineage, independent verification, audit sampling |
| Carbon methodology and calculations | Below production-accepted status; external gates open | Exact current methodology/version, applicability decision, independent numerical reconciliation and regression evidence, authorized review |
| Guardian/Hedera/Mirror Node | Integration contract implemented; live TRL unproven | Real external execution, authoritative IDs, consensus timestamp, persisted record and Mirror Node verification |
| Registry, credentials and settlement | Guardrails tested; real operating readiness unproven | Authorized real transaction, external confirmation/reconciliation, dual control and independent audit |
| Physical IoT / weighing / environmental instruments | Not assessed | Exact model/use case, MeitY approval applicability and evidence, calibration, installation, data lineage and field acceptance |
| Pan-India operations/support | Not demonstrated by repository evidence | Multi-region representative trials, continuity/offline tests, monitoring, support, incident and recovery evidence |

## Required gates to reach TRL 5

Do not advance the platform to TRL 5 until all applicable items below have objective evidence:

1. **Freeze the assessment boundary:** identify the platform release, subsystem, target user, operating environment, and the exact real-world task being assessed.
2. **Close main-branch release-safety blockers:** review PR #85, verify the resulting exact main commit, and confirm normal production startup cannot seed acceptance/demo data. Do not merge automatically.
3. **Establish database identity and recoverability:** inspect sanitized source/target identity metadata, confirm backups and a successful restore, and rehearse migration/reconciliation without destructive source changes.
4. **Run representative Urban and Rural transactions:** use real authorized stakeholders and activities; capture immutable/correlated IDs and statuses for activity, measurement, evidence, verification, MRV, provenance, eligibility, registry and settlement as applicable.
5. **Verify external trust rails:** record real Guardian execution, Hedera transaction/consensus, persisted provenance, and Mirror Node verification. Missing stages remain blocked.
6. **Validate physical measurement chain:** document exact device make/model/firmware, approval applicability/evidence, calibration, enrollment, authorized operator/site, timestamps, units, raw observations, transport, and server-side acceptance. Never infer MeitY approval from a vendor name alone.
7. **Test field conditions:** intermittent network, duplicate/replayed messages, out-of-order readings, device replacement, clock drift, bad calibration, tampering, rejected records, retry/recovery, and reconciliation.
8. **Prove operational recovery:** restore a backup, exercise rollback, confirm alerting and audit logs, and verify incident ownership/runbooks.
9. **Obtain independent sign-off:** domain/MRV, security, operational, statutory and hardware reviewers must sign only the evidence within their remit.
10. **Update the readiness ledger:** record evidence links, exact release/commit, test environment, results, limitations, approver and date. Failed or unavailable dependencies remain explicit blockers.

## Shakti Standards decision

- **Engineering implementation:** substantial progress; controlled CI evidence exists.
- **Relevant-environment validation:** incomplete.
- **Real operational demonstration:** not established by this repository audit.
- **Production qualification/certification:** **HOLD / OFF**.
- **Pan-India production readiness:** **NOT PROVEN**.
- **Current provisional overall software-platform TRL:** **TRL 4**, pending independent review; not a certification.
- **Hardware TRL:** **not assessed due to insufficient evidence**.

The next decision should be evidence-driven progression from controlled tests to representative real-world acceptance—not a rewrite of the whole platform and not a declaration of readiness based on CI alone.
