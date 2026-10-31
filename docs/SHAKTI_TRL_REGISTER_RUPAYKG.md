# RupayKg — SHAKTI TRL Register and Current Readiness Decision

**Assessment date:** 2026-10-26  
**Assessment basis:** Repository and CI evidence available at the time of assessment; not an independent field certification.  
**Related universal policy:** [SHAKTI Standards](SHAKTI_STANDARDS.md)  
**Detailed audit:** [RupayKg Technology Readiness Level Audit](TECHNOLOGY_READINESS_LEVEL_AUDIT_2026-10-26.md)

## Current decision

- **Overall software-platform TRL:** provisionally **TRL 4** for the controlled software/test boundary only.
- **TRL 5:** NOT DEMONSTRATED. Representative end-to-end real-world acceptance evidence is not established by the reviewed repository.
- **Critical subsystem readiness:** must be assessed separately; the overall claimed level cannot exceed the lowest critical subsystem required for the use case.
- **Physical hardware/IoT TRL:** **NOT ASSESSED — EVIDENCE INSUFFICIENT**.
- **Pan-India production readiness:** NOT PROVEN.
- **Production certification/release:** **HOLD / OFF** until applicable gates and approvals are evidenced.

This status must not be interpreted as saying that every subsystem has reached TRL 4. The rating is provisional and limited to the software components and workflows for which controlled tests exist.

## Subsystem readiness register

| Subsystem | Current evidence status | TRL decision | Evidence required to advance |
|---|---|---|---|
| Core application, APIs and domain lifecycle | Code and controlled CI tests exist | TRL 4 provisional | Independent review and representative end-to-end acceptance |
| PostgreSQL schema/migrations | Clean CI PostgreSQL migration and tests exist | TRL 4 controlled environment only | Target identity, backup/restore, migration rehearsal, reconciliation and rollback proof |
| Identity, organization and geography authorization | Code controls and automated tests exist | TRL 4 provisional | Deployed tests using real authorized identities and adversarial authorization cases |
| Field/offline synchronization | Controlled tests exist | TRL 4 provisional | Field trials with intermittent networks, duplicates, conflicts, replay and recovery |
| MRV and evidence lifecycle | Controlled software paths/tests exist | TRL 4 provisional | Real activity evidence, instrument lineage, independent verification and audit sampling |
| Methodology-specific carbon calculations | Technical controls exist; production eligibility not established | TRL 5+ not demonstrated | Exact methodology applicability, independent numerical reconciliation, regression evidence and authorized approval |
| Guardian/Hedera/Mirror Node trust chain | Integration contracts/tests documented; live proof not established | Live TRL not demonstrated | Real Guardian verification, consensus evidence, persisted provenance and independent Mirror Node verification |
| Registry/credentials/settlement | Guardrails and controlled tests exist | Real operating readiness not demonstrated | Authorized end-to-end transaction, external confirmation, reconciliation and independent audit |
| Physical IoT, weighbridge and environmental sensors | Exact-device approval, calibration and field evidence incomplete | NOT ASSESSED | Exact model/use case, applicable MeitY approval evidence, calibration, installation, device identity and field acceptance |
| Pan-India operations | No verified sustained multi-region evidence in this assessment | NOT DEMONSTRATED | Representative multi-state operation, support, continuity, monitoring, recovery and longitudinal outcomes |

## Mandatory gates to reach TRL 5

1. Freeze the assessed release, system boundary, use case and relevant environment.
2. Resolve the production startup/acceptance-fixture safety concern through reviewed code changes; verify the exact merged/deployed commit before claiming remediation.
3. Establish the intended database target identity and data classes without exposing secrets; prove backup restoration before any migration/cutover.
4. Execute representative real Urban and Rural workflows using authorized stakeholders and real operational evidence.
5. Preserve correlation IDs and state transitions through activity, measurement, evidence, verification, MRV, provenance, eligibility, registry and settlement as applicable.
6. Demonstrate required external Guardian/Hedera/Mirror Node trust stages with authoritative IDs and timestamps.
7. Validate exact hardware/device approval applicability, calibration, enrollment, measurement units, timestamps, tamper/failure cases and end-to-end data lineage.
8. Test intermittent connectivity, duplicate/replayed messages, out-of-order records, clock drift, bad calibration, rejected data, retries and reconciliation.
9. Demonstrate backup restore, rollback, alerting, audit logs, incident ownership and recovery.
10. Obtain domain, security, operations, statutory and hardware sign-offs within each reviewer's remit.
11. Publish a versioned evidence pack with failures, limitations, owners, reviewers, dates and a clear go/no-go decision.

## Evidence and change-control rules

- CI success is evidence for the exact tested commit and test environment only.
- PR evidence is not evidence that the change is on main or deployed.
- A running URL or HTTP 200 is not a real end-to-end acceptance test.
- Synthetic/demo/acceptance data must remain separate from operational records.
- Never migrate, delete, mutate or shut down source data until source/target identity, retention, backup/restore, mapping, reconciliation, rollback and authorization gates are complete.
- No PR merge, production deployment, live database migration, external financial action or certification is authorized by this readiness register.
- If any critical dependency is unverified, keep the relevant gate blocked and do not average the blocker away.

## Review record

**Status:** Provisional repository-evidence assessment.  
**Independent sign-off:** Not recorded.  
**Next decision:** Review real-world TRL 5 acceptance evidence; until then maintain HOLD/OFF for production certification.
