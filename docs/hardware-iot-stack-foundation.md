# RupayKg Hardware & IoT Stack — Foundation Architecture
**Status:** Engineering design baseline; NOT a procurement approval, certified design, validated MRV instrument, or production release.
**Date:** 2026-10-30
**Repository:** `vishaltradewinds/rupaykg`
**Workstream branch:** `hardware/iot-stack-foundation-2026-10-30`
**Operating rule:** Shakti Standards — evidence-led, fail-closed, context-specific gates; no unsupported claims of indigenous manufacture, regulatory approval, metrological validity, or carbon-credit eligibility.

## 1. Purpose and boundaries
Build a pan-India, facility-adaptable edge-to-cloud instrumentation stack for RupayKg's waste-chain custody, facility operations, dMRV evidence capture, EPR/ESG reporting support, and eligible CCTS/voluntary-credit workflows. Hardware observations are evidence inputs, not automatic proof of legal compliance or credit issuance. Statutory applicability, approved methodology, monitoring plan, calibration, independent verification, and competent-authority decisions remain separate gates.

This workstream is additive and isolated from ongoing ESG/EPR, GRI, CCTS/CCC, Guardian/Hedera, and platform work. Do not edit or merge other workstreams' files without checking current branch/PR state and coordinating overlapping paths.

## 2. Reference architecture
1. **Measurement layer:** certified/traceable weighing instruments where required; load cells only as a designed and verified weighing system; gas-flow and methane/biogas instrumentation where the approved monitoring methodology calls for it; temperature, pressure, humidity, energy, flow and process sensors only where they serve a defined monitoring parameter.
2. **Local acquisition:** industrial PLC/RTU or industrial gateway for continuous-duty/critical installations; ESP32-class MCU only for non-safety-critical prototypes, auxiliary telemetry, or validated low-risk sensing. No consumer MCU directly controls safety-critical equipment.
3. **Field protocols:** isolated RS-485/Modbus RTU; Ethernet/Modbus TCP; vendor protocol adapters; pulse/4–20 mA inputs through suitable isolated conditioning; USB/serial weighbridge adapters only after interface, electrical, and legal-metrology review. Document protocol, units, scaling, timestamps, quality flags and error states for each adapter.
4. **Edge Oracle:** rugged enclosure, regulated and protected power, surge/ESD protection, watchdog, secure boot/firmware update where supported, device identity, local encrypted queue, clock health, signed configuration, tamper-evident event log and store-and-forward. The Edge Oracle attests what it observed and how; it does not independently certify truth.
5. **Connectivity:** Ethernet/fibre where available; cellular 4G/5G using India-authorized equipment and operator-compliant modules; Wi-Fi only where suitable; LoRaWAN only after regional spectrum, gateway, coverage and security checks. Connectivity loss must not silently drop evidence.
6. **Backend integration:** authenticated device-ingestion API or broker; schema validation; idempotency; replay protection; tenant/facility authorization; append-only raw observations; normalized readings; quality/validation events; evidence lineage to facility, process, instrument, calibration record, operator and methodology parameter. Keep raw readings separate from derived values and reports.
7. **User and operations layer:** field onboarding, device inventory, installation/commissioning checklist, calibration/maintenance due dates, offline sync status, anomaly queues, evidence export, audit trail and role-based access.

## 3. Device-class decision policy
- **Class A — critical/regulated measurement:** use an instrument/system with documented suitability and required legal-metrology, calibration, certification and traceability evidence for its intended use. Never substitute a bare sensor/module for an approved weighing instrument.
- **Class B — industrial process monitoring:** industrial PLC/RTU or qualified industrial gateway; select sensors based on the process, environmental rating, range, accuracy, maintainability and calibration requirements.
- **Class C — auxiliary telemetry/prototype:** ESP32 or equivalent may be evaluated for non-critical temperature, door/tamper, status, or proof-of-concept telemetry. Production use requires environmental, EMC, security, reliability and field-validation evidence.
- **Indigenous compute path:** evaluate C-DAC VEGA/SHakti ecosystem and Indian-designed/manufactured alternatives on exact SKU availability, datasheet, lifecycle support, tooling, certifications and supply chain. Do not claim every component is Indian-made. Use a hybrid supply chain while maximizing Indian design, integration, enclosure, firmware and service capability.
- **MeitY and other approvals:** maintain SKU-specific evidence for applicable scheme/category (including any applicable CRS/BIS, WPC/ETA for radio equipment, TEC/MTCTE for applicable telecom equipment, safety/EMC/environmental obligations and public-procurement conditions). Applicability varies by exact product and use; no blanket “MeitY-approved” assertion is permitted without official evidence for the exact model and scope.

## 4. Instrumentation modules (only enable when justified by methodology/use case)
| Module | Candidate inputs | Integration / safeguards | Acceptance evidence |
|---|---|---|---|
| Weighbridge / weighment | Approved weighbridge indicator output; ticket/transaction reference | Read-only isolated interface preferred; reconcile with operator ticket and scale identity | Instrument approval/applicability, calibration/verification records, unit/scaling test, time and duplicate test |
| Waste-bin / vehicle weight prototype | Load cells + load-cell amplifier | Not a legal-for-trade replacement; mechanical design and temperature/creep compensation required | Bench calibration curve, repeatability, overload and drift test; approved instrument where legally required |
| Methane / biogas | Flow, pressure, temperature, gas composition/methane concentration as required | Select technology/range and installation to approved methodology; hazardous-area assessment where applicable | Manufacturer docs, calibration traceability, installation drawing, gas safety review, uncertainty budget |
| Process conditions | Temperature, humidity, pressure, level, flow | Industrial-rated sensor and calibrated range; define placement and response time | Calibration, range, drift, ingress/environmental rating and maintenance plan |
| Electricity / energy | Meter pulse, Modbus or documented output | Meter class and CT/PT ratios documented; preserve raw registers and scaling | Meter specification, calibration/verification as applicable, ratio and phase tests |
| Vehicle / location | GNSS receiver, optional NavIC-capable device | Treat location as corroborative, not sole custody evidence; consent/access controls and retention policy | Accuracy test, clock/source metadata, spoofing/gap flags, route and custody reconciliation |
| Edge environment / tamper | Enclosure open, power loss, watchdog, temperature | Tamper events are signals, not conclusive evidence of misconduct | Trigger test, event sequence, battery/power-loss recovery and false-positive analysis |

Do not purchase a sensor before mapping it to a named facility process, regulatory/methodology parameter, required uncertainty, operating environment, service plan and evidence owner.

## 5. Canonical observation envelope
Every reading/event should include:
- `event_id` (globally unique), `device_id`, `instrument_id`, `facility_id`, `site_id`, optional `vehicle_id` and `process_id`
- `observed_at` (UTC ISO-8601), `received_at`, clock source/health and monotonic sequence number
- `parameter_code`, numeric/string value, unit, raw value/register/payload reference, scaling/config version
- `quality_status` (valid / suspect / invalid / missing / out_of_range / stale / clock_untrusted), quality reasons and validation version
- `calibration_record_id`, calibration validity at observation time, instrument make/model/serial and firmware/config version
- `custody_reference`, source/transaction reference and operator/automation identity where applicable
- `connectivity_mode`, buffered/offline flag, retry count, firmware version, tamper/power/watchdog state
- integrity metadata: payload hash, signature/key identifier where supported, ingestion idempotency key and chain/ledger reference if later anchored.

Schema validation must reject missing identity, unknown units, impossible timestamps, malformed values and unauthorized facility/device mappings. Suspect/invalid observations are retained with reasons and excluded from eligible calculations unless a governed correction/review resolves them. Never overwrite raw observations; corrections are new linked events.

## 6. Security and resilience baseline
- Unique per-device credentials; no shared fleet-wide secrets or credentials embedded in public firmware.
- Least privilege, facility-scoped authorization, credential rotation/revocation, secure transport, secrets protection and key lifecycle documentation.
- Signed firmware/configuration and secure boot where supported; vulnerability inventory, patch policy, SBOM where feasible, and reproducible build/release records.
- Network segmentation; outbound-only connectivity where practicable; no public inbound device ports by default.
- Offline buffering with bounded storage, encryption at rest where feasible, integrity checks, replay protection, backpressure and explicit gap reporting.
- Safe failure: no actuation of plant equipment in this stack without a separately engineered safety case, interlocks, risk assessment and authorized controls integration.
- Threat model covers physical access, spoofed sensors, replay, clock manipulation, firmware compromise, credential theft, SIM/network loss, cloud outage, duplicate events and operator misuse.
- Personal/location data minimization, retention limits and role-based access; avoid collecting worker location unless operationally necessary and lawfully governed.

## 7. Validation, metrology and MRV gates
1. **G0 — Use-case definition:** facility/process, stakeholder, applicable rule/methodology, monitoring parameter, evidence owner and decision supported.
2. **G1 — Design qualification:** approved architecture, interface control documents, range/accuracy/uncertainty target, hazard review, power/connectivity and data protection review.
3. **G2 — Component evidence:** exact SKU datasheets, traceable calibration/verification evidence, applicable approvals and supply/support status.
4. **G3 — Bench validation:** reference comparison, linearity, repeatability, drift, environmental limits, power-loss, clock, offline buffering, duplicate/replay, firmware update and tamper tests.
5. **G4 — Site commissioning:** installation photos/drawings, serial numbers, calibration certificates, location, wiring, protocol scaling, responsible technician and acceptance signatures.
6. **G5 — Parallel observation:** compare with existing approved/authoritative records over a pre-defined period; quantify gaps, bias, uncertainty and exception rates. No production substitution until acceptance criteria pass.
7. **G6 — Controlled production:** release/version approval, monitoring/alerting, service and calibration schedule, incident response, rollback and change control.
8. **G7 — MRV eligibility:** mapping to the current approved methodology and monitoring plan; validation/verification by competent independent parties where required. Device output alone never grants EPR compliance, ESG assurance, CCTS certificate or carbon credit.

TRL must be assigned per complete use-case/system, not merely per sensor. Record evidence and rationale for each TRL; do not label field-ready based on a design document or a successful bench test alone.

## 8. Minimum test matrix
- Interface: correct protocol, baud/parity, register map, endianness, scale/unit conversion and disconnected sensor behavior.
- Measurement: reference comparison across operating range; repeatability, hysteresis, drift, response time and uncertainty.
- Time/data: UTC normalization, clock loss, time jump, duplicate delivery, replay, out-of-order messages and daylight/timezone handling.
- Network: offline for defined duration, recovery, packet loss, retry/backoff, broker/API unavailable and storage exhaustion.
- Power: brownout, abrupt loss, reboot, watchdog and corrupted queue recovery.
- Security: unauthorized device/facility, revoked credential, bad signature, tampered config, replay, TLS failure and OTA rollback.
- Operations: calibration expired, maintenance overdue, sensor replaced, device moved, firmware upgraded, operator correction and evidence export.
- Safety/environment: ingress, temperature, vibration, EMC and hazardous-area requirements assessed for actual site conditions.

Each test has a test ID, versioned setup, expected result, measured result, evidence artifact, reviewer and pass/fail disposition. Unexecuted tests are NOT PASS.

## 9. Initial deployment pattern
Use one instrumented reference facility as a controlled validation site, but design the data model, device registry, tenant/facility authorization, onboarding and release process for pan-India expansion from day one. The pilot is not a geographic product limitation. Replication to another site requires site-specific risk, instrument, connectivity, calibration and commissioning evidence.

## 10. Work packages and deliverables
- **HW-01 Requirements & regulatory applicability:** parameter-to-methodology matrix, exact approval register, legal-metrology questions and evidence gaps.
- **HW-02 Reference BOM:** two tiers (prototype and industrial), exact candidate SKUs only after current official datasheets and applicable approval evidence are checked; landed cost, lifecycle, lead time, Indian value-add and spares.
- **HW-03 Edge firmware:** device identity, protocol adapters, signed configuration, event envelope, local queue, secure transport, health/tamper telemetry and OTA policy.
- **HW-04 Backend contract:** schema, ingestion endpoint/broker, idempotency, device/facility authorization, validation and immutable raw-event lineage.
- **HW-05 Bench rig:** reference instruments, test harness, synthetic/fault injection, measurement and resilience test report.
- **HW-06 Site commissioning:** wiring diagrams, enclosure/power/network design, installation and calibration evidence templates.
- **HW-07 Operations:** inventory, calibration/maintenance, firmware fleet, alerts, incidents, audit export and end-of-life procedure.
- **HW-08 Assurance:** TRL evidence ledger, Shakti gate checklist, cybersecurity review, regulatory review, field acceptance and release decision.

## 11. Initial exit criteria
The foundation phase is complete only when (a) exact use-cases and parameters are approved; (b) each selected SKU has a completed applicability/evidence record; (c) architecture and event contract are reviewed against the live RupayKg code; (d) bench and site acceptance tests have evidence; (e) security and failure-mode review passes; (f) TRL has evidence-based justification; and (g) a named approver accepts the release. Until then the stack remains **design baseline / engineering only**.

## 12. Authoritative source register to verify per deployment
Use current primary sources and capture title, URL, access date, applicable clause/category, exact SKU/model, decision and evidence file:
- MeitY — applicable electronics/IT schemes, policy and procurement notices.
- BIS — CRS/product certification and applicable Indian Standards; Legal Metrology Department/Rules for weighing instruments and packaged/transaction use as applicable.
- WPC/Department of Telecommunications — radio equipment/spectrum/ETA applicability; TEC — MTCTE applicability for notified telecom equipment.
- CPCB and relevant State Pollution Control Board/Pollution Control Committee — facility, waste and EPR applicability.
- BEE and Ministry of Power — CCTS rules/procedures and current monitoring/verification requirements where the use case falls within scope.
- Official methodology/program documents and competent validation/verification body requirements for any carbon-credit claim.
- Manufacturer official datasheets, installation manuals, calibration documentation, declarations and lifecycle notices.
- CERT-In and applicable Indian cybersecurity/data-protection requirements for incident handling and personal data.

**Source-verification rule:** do not infer current approval from reseller pages, marketplace listings, generic brand claims, or a component-level certificate that does not cover the selected model and intended use. Record unavailable evidence as a blocker, not as an assumption.
