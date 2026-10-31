# RupayKg Pan-India Hardware and Edge Platform Architecture

**Status:** National reference architecture and engineering plan. This is not a production certification, procurement authorization, or claim that field hardware has been qualified.

**Governing standard:** Shakti Standards.  
**Product scope:** A reusable pan-India platform serving bulk waste generators, aggregators, collection centres, transporters, recyclers, processors, treatment facilities and disposal facilities.  
**Core rule:** Build one national platform with configurable site, activity, instrument and methodology profiles. Do not make the architecture dependent on one pilot, one city, one facility, one vendor, one processor or one carbon methodology.

## 1. Product decision

RupayKg is to be engineered as a pan-India operating platform. SITE-JBP-01 / Kathonda is only one possible site-specific evidence pack and must not define the national product architecture or roadmap. Other sites and waste-chain participants must be onboarded through the same configurable platform without forking the product.

National coverage does not mean one universal sensor list. The platform provides common identity, security, ingestion, custody, evidence, audit and operations capabilities; each facility activates only the instrument and workflow profiles justified by its actual processes, applicable law and verified methodology.

## 2. National stakeholder and workflow coverage

| Stakeholder / operating category | Common workflow capability | Examples of optional evidence / device integration (not a procurement list) |
|---|---|---|
| Bulk waste generators | Waste generation, handover, weighment, classification, dispatch and receipts | Existing approved scale/weighbridge records, facility meters, batch/lot evidence |
| Aggregators / collection centres / MRFs | Intake, sorting, grading, weighing, consolidation and custody transfer | Scale interfaces, barcode/QR or tag readers, batch records, optional imaging where lawful |
| Transporters / fleet operators | Assignment, pickup/drop-off, trip evidence, custody and discrepancy handling | Vehicle/phone GPS, seal/tag evidence, weighment references; do not infer measurements from GPS |
| Recyclers / processors | Input-output mass balance, processing batches, quality, energy and residues | Existing meters, scales, process PLC/SCADA interfaces, sampling/lab reports as required |
| Composting / biomethanation / RDF / WtE facilities | Process-specific inputs, outputs, energy, emissions and residues | Only parameters required by the actual process, permits and applicable approved methodology |
| Landfills / disposal facilities | Receipts, placement, operations, gas/leachate or other monitoring where required | Site-specific instruments determined after boundary and methodology review |
| Municipal bodies / producer responsibility / corporate buyers / auditors | Aggregated reporting, reconciliation, approvals, evidence review and export | Read-only reporting, signed exports and audit records subject to access controls |

No participant is required to buy new hardware merely to join the platform if existing records and integrations meet the relevant evidence requirements. Manual, file-based and assisted workflows may be supported where legally and methodologically acceptable, clearly distinguished from directly measured telemetry.

## 3. National platform architecture

1. **Participant and facility registry:** organizations, roles, facilities, locations, activities, permits, site profiles and authorization boundaries.
2. **Device/instrument registry:** exact manufacturer/model/serial or stable asset identity; owner/operator; status; applicable approvals; calibration/verification; supported parameters and interfaces; lifecycle and evidence references.
3. **Integration adapters:** documented, versioned adapters for relevant serial/network interfaces, Modbus variants, APIs, file imports and supported industrial protocols. Each adapter is tested against exact device documentation.
4. **Edge collector:** local acquisition, schema/unit validation, monotonic sequence, time-quality metadata, bounded encrypted/controlled offline queue, duplicate/replay detection and authenticated synchronization.
5. **National ingestion contract:** stable versioned API and idempotency rules; schema validation; rate limits; tenant/facility authorization; audit logging; explicit rejection/quarantine reasons.
6. **Custody and material ledger:** link pickup, weighment, transfer, receipt, processing and residue events without treating an event as proof of a physical fact unless its evidence supports that claim.
7. **Evidence vault and review:** versioned artifacts, hashes, reviewer decisions, revocation/re-review, access controls and retention policy.
8. **MRV methodology engine:** methodology/version and activity-bound mapping; parameter-specific data quality, uncertainty, missing-data and calculation rules; no assumption that one methodology fits all waste activities.
9. **Reporting and exports:** role-scoped dashboards and audit-ready exports; label measured, derived, estimated, sampled, third-party, missing and rejected data distinctly.
10. **Operations and assurance:** fleet health, device/software inventory, patch and certificate lifecycle, calibration renewals, incident management, support and requalification.

Preserve RupayKg's existing authoritative ingestion, instrument registry, field-sync, evidence-vault and MRV paths. Do not create a parallel source of truth in an edge middleware registry, message broker or local database.

## 4. Multi-tenant and pan-India requirements

- Strong tenant and facility isolation; least-privilege roles for generator, aggregator, transporter, processor, verifier, auditor and platform operator.
- Facility-specific language, units, time zones and workflows, while retaining canonical stored units and explicit conversions.
- Intermittent-connectivity operation with idempotent replay and transparent reconciliation.
- Configurable deployment profiles: phone/manual workflow, existing-equipment integration, local gateway, and higher-capability industrial edge. Profiles do not relax evidence or approval rules.
- Stable APIs and versioned schemas to onboard different vendors without platform forks.
- Bulk onboarding/import with validation, dry-run, error reports and rollback-safe processing.
- Data minimization, consent/authority checks, retention, access logging and applicable Indian privacy/security obligations.
- Accessible low-bandwidth web/mobile experiences and local-language support where feasible.
- No dependence on paid proprietary cloud for the basic test/development path; production hosting and service costs require separate transparent cost and risk review.

## 5. Hardware selection and mandatory MeitY rule

The user-mandated project policy is: use only an exact hardware model with verified applicable MeitY approval/recognition for its intended product and use, in addition to all other legally required approvals. Do not infer approval from Indian origin, a programme affiliation, open-source licensing, a vendor assertion, or approval of another model.

For each candidate, record the relevant official authority, scheme, model/revision, intended use, scope, evidence URL/document, validity and reviewer. If no applicable scheme exists or exact-model evidence is unavailable, mark **BLOCKED — MEITY APPROVAL NOT VERIFIED** and do not purchase, install or use that candidate under the current project rule. Record the coverage gap and obtain an explicit policy decision rather than silently substituting another certificate. This is a project selection gate, not a claim that MeitY approval is legally required for every possible category of instrument in every context; the applicability and exact evidence must be reviewed, and the user's stricter project gate remains in force unless explicitly changed.

Also verify, as applicable, metrology, electrical safety, EMC, radio, environmental, sector, site, cybersecurity and calibration/verification requirements. The processor, board, finished gateway, instrument and installed system may be separate qualification subjects.

## 6. Open-source and indigenous technology strategy

Evaluate SHAKTI/RISC-V and other suitable processor/board ecosystems alongside supported MCU and Linux gateway options. Evaluate Zephyr, MCUboot, U-Boot, OpenWrt, EdgeX Foundry, Node-RED, Mosquitto, SQLite and other components by exact deployment fit, licences, maintenance, vulnerabilities, toolchain maturity and total lifecycle cost. A project being open source is not evidence of device safety, industrial reliability, measurement accuracy or certification.

Prefer portable protocols, replaceable adapters, documented schemas and open export formats. Avoid hard dependency on a single chip, gateway vendor, cloud provider or middleware. Use indigenous components when evidence shows they meet functional, compliance, lifecycle and cost requirements.

## 7. National qualification data model

Each candidate instrument/gateway profile must record:
- stakeholder class and supported workflow;
- physical parameter and methodology/permit clause requiring it;
- direct, derived, sampled, estimated or third-party data type;
- range, unit, accuracy/uncertainty, resolution, sampling interval and placement;
- exact manufacturer/model/revision, serial/asset identity and supplier/support;
- interface, protocol version, register map, driver and firmware;
- applicable approval/conformity and calibration/verification evidence;
- environmental, power, isolation, enclosure and communications requirements;
- security, identity, update, key management, debug control and vulnerability response;
- offline queue, clock quality, sequence, duplicate/replay and power-loss behavior;
- installation, commissioning, test result, reviewer and acceptance status;
- lifecycle cost, warranty, replacement, maintenance and support plan.

Unknowns remain **OPEN / NOT VERIFIED**. No weighted score may override a failed mandatory gate.

## 8. Software-first, no-cost engineering path

Before physical hardware:
1. Define versioned synthetic event contracts and facility/instrument profiles.
2. Test schema, unit, authorization, identity, sequence, timestamp, duplicate, replay and payload-integrity behavior locally or in isolated CI.
3. Prove that synthetic fixtures cannot write to production/staging MRV, evidence-vault approvals, Guardian or external anchoring.
4. Validate idempotent offline queue/reconnect and recovery simulations.
5. Add regression tests to the existing CI path.
6. Verify current CI and review findings on the exact commit.

Synthetic results prove only software behavior. They are not physical instrument, calibration, MeitY, site, methodology or production evidence. Do not require paid cloud or APIs for this phase.

## 9. Shakti Standards gates

- **G0 — Reality and context:** identify actual stakeholder, process, site, jurisdiction, boundary, operating conditions and user need.
- **G1 — Legal and methodology:** applicable laws, permits, approved methodology/version and required parameters are established by evidence and reviewed.
- **G2 — Requirements and options:** compare existing records, manual workflow, retrofit, gateway and new hardware; document feasibility, cost and alternatives.
- **G3 — Desk qualification:** exact-model documentation, licences, lifecycle, approval scope, interfaces and security posture verified.
- **G4 — Isolated simulation:** deterministic software tests pass with synthetic data barred from authoritative MRV.
- **G5 — Authorized bench qualification:** only with suitable equipment, explicit authorization and any necessary approvals; interface and fault testing documented.
- **G6 — Field commissioning:** site safety, installation, calibration/verification, communications and acceptance criteria demonstrated.
- **G7 — MRV acceptance:** methodology mapping, data lineage, uncertainty, evidence and independent review accepted.
- **G8 — Operations and continuous assurance:** patching, calibration, replacement, monitoring, incident response, audits and requalification maintained.

Gates apply nationally but evidence is specific to the device, use and site. Passing a gate for one facility does not automatically qualify another facility or another model.

## 10. Rollout without a pilot-specific architecture

Build and qualify the reusable platform primitives first. Then onboard sites in waves based on readiness and demand, using the same national core:
- Wave A: software contract and isolated tests; no hardware purchase.
- Wave B: integrate existing equipment and existing records after evidence/approval checks.
- Wave C: qualify optional gateway/device profiles for repeated use cases.
- Wave D: expand across stakeholder and facility categories with support, monitoring and periodic assurance.

SITE-JBP-01 remains a separate site evidence pack only. Its public-record leads and unresolved process/methodology questions must not be generalized to all India or used to constrain the national platform. A different facility must be able to use the platform with its own verified process and applicable parameters.

## 11. Current decision and open work

- Product target: **pan-India operating platform**, not a pilot-specific product.
- Architecture: shared national core plus configurable facility/activity/instrument profiles.
- Hardware: no final board, sensor or gateway selected or approved.
- Cost: no-cost local/CI simulation first; no unapproved paid services.
- Production: not certified or field-qualified.
- Immediate work: update PR #59 scope to national architecture, review the existing code and schema for national multi-tenant/facility requirements, add isolated tests, resolve MRV assurance findings, and keep all production gates fail-closed.
