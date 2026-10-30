# RupayKg Hardware & IoT Stack — Parallel Workstream

**Status:** Architecture baseline / research-only. Not production-approved.  
**Branch:** `hardware/iot-stack-parallel-2026-10-30`  
**Scope:** A complete, vendor-neutral field hardware-to-MRV path for RupayKg, developed independently from concurrent EPR/ESG/GRI and hardware-foundation branches.

## 1. Non-negotiable design rules

1. **Reuse the canonical RupayKg device registry, enrollment, sync envelope, evidence vault, measurement/MRV handoff and audit controls.** Do not introduce a second device registry, second evidence store, or competing physical-evidence persistence path.
2. **Fail closed:** no sensor reading, calibration status, device identity, GPS point, weighment, verifier decision, certificate or regulatory submission may be fabricated when unavailable or unverified.
3. **Raw evidence first:** preserve the original signed/source payload, device and instrument identity, timestamp, units, calibration reference, firmware/configuration version, operator/site context, sequence number and integrity hash. Normalized measurements must link back to the immutable source envelope.
4. **Separate observation from assertion:** a device reports a measurement; RupayKg policy decides whether it is admissible for a workflow. Device data alone does not prove EPR fulfillment, carbon-credit eligibility, CCTS/CCC issuance, ESG assurance or government acceptance.
5. **Instrument-specific calibration:** no generic “sensor calibrated” flag. Require the actual instrument model, serial number, calibration certificate, issuing lab/authority, range, accuracy, due date, method, and evidence hash as applicable.
6. **Vendor-neutral and India-ready:** prefer locally serviceable components and open protocols; record country of origin, manufacturer, OEM, model, component provenance, repairability and spares. Do not make unsupported “100% Indian-made” claims.
7. **Compliance is applicability-based:** MeitY/STQC, BIS/QCO/CRS, DoT/WPC ETA, electrical safety, legal metrology and procurement requirements must be evaluated per finished product, interface, use, location and procurement context. Do not label every component “MeitY-approved” without a specific applicable approval/certification record.
8. **No production activation** until source inspection, safety review, calibration evidence, security testing, field acceptance, authorized stakeholder approval and Shakti Standards release gates pass.

## 2. Target architecture

```
Physical process / site
  ├─ Weighbridge indicator / scale (prefer existing calibrated instrument)
  ├─ Waste/biomass quantity and process sensors (selected per methodology)
  ├─ Optional GPS/site identity, RFID/QR custody tag, tamper/open sensors
  └─ Optional energy, water/flow, temperature, pressure, gas/methane instruments
        │
        ▼
Isolated instrument interface
  ├─ RS-232 / RS-485 / Modbus RTU, pulse, 4–20 mA, digital I/O as applicable
  ├─ Electrical isolation, surge/ESD protection, input validation
  └─ Read-only acquisition by default; no actuator/control path in MRV scope
        │
        ▼
Site edge gateway
  ├─ Industrial MCU/MPU selected after requirements and lifecycle review
  ├─ Secure device identity, signed firmware/update policy, secure boot where supported
  ├─ Monotonic sequence, trusted-time status, local encrypted queue
  ├─ Store-and-forward, backpressure, bounded retention and health diagnostics
  └─ Network adapter: Ethernet first where available; cellular/Wi-Fi/LoRaWAN only
     after coverage, power, security and WPC/ETA applicability checks
        │
        ▼
Authenticated ingestion boundary
  ├─ Mutual/device authentication, replay/idempotency protection, schema validation
  ├─ Rate/size limits, revocation, clock-skew and duplicate handling
  └─ Quarantine malformed, stale, uncalibrated or untrusted readings
        │
        ▼
Canonical RupayKg field-device / sync / evidence / measurement services
  ├─ Immutable raw source envelope + cryptographic hash
  ├─ Normalized observation linked to source envelope
  ├─ Calibration and instrument approval gate
  ├─ Methodology + activity + custody + site + reporting-period binding
  └─ Existing MRV, EPR, ESG and CCTS/CCC policy engines decide admissibility
        │
        ▼
Human review / independent verification / authorized external systems
  └─ No automatic legal filing, credit issuance or compliance certification by IoT alone
```

## 3. Instrument families and interface policy

| Family | Preferred acquisition path | Mandatory evidence / controls | Status |
|---|---|---|---|
| Weighbridge / weigh scale | Read-only output from the existing indicator: documented RS-232/RS-485/Modbus or approved digital interface | Instrument make/model/serial, display/indicator linkage, unit, gross/tare/net semantics, stable-weight signal, timestamp, calibration/verification record, operator/site, original frame and duplicate/replay controls | First integration candidate; exact site model not yet evidenced |
| Waste/biomass quantity | Certified scale, batch counter or method-specific instrument; no inferred mass from unrelated sensor data | Approved methodology, unit conversion, uncertainty/accuracy, calibration, custody and source records | Select per project methodology |
| Moisture / composition | Instrument output or documented sampling workflow | Sample identity, sampling method, lab/test evidence where required, calibration and uncertainty | Optional; methodology-dependent |
| Gas / methane / emissions | Appropriate range-rated gas instrument and/or approved analytical source | Gas species, concentration/unit, flow, pressure/temperature compensation, calibration gas/certificate, uncertainty and methodology binding | No instrument model selected |
| Flow / water | Pulse, 4–20 mA or Modbus interface as supported | Meter identity, unit, range, calibration, reset/rollover handling, leak/tamper diagnostics | Optional; site-specific |
| Energy / electricity | Meter output / Modbus / documented utility data | Meter identity, CT/PT ratios where applicable, interval, units, quality flags, calibration and source lineage | Optional; site-specific |
| GPS / site / custody | Device location with accuracy and freshness metadata; QR/RFID for object identity | Explicit consent/purpose where relevant, site boundary, accuracy, time, anti-spoofing and operator confirmation; location alone does not prove custody | Supporting evidence only |
| Gateway health | Secure local telemetry | Device identity, firmware/configuration version, boot/restart log, storage/network health, update provenance and revocation | Required |

**Selection rule:** do not choose a specific sensor/board based on a generic shopping list. First obtain the site's actual instrument make/model/manual, output protocol, environmental conditions, power budget, accuracy requirements and calibration chain.

## 4. Device identity and message contract

Every source envelope should bind, where available:

- `schema_version`, globally unique `event_id`, `device_id`, `instrument_id`, `site_id`, `organization_id`
- `observed_at`, `received_at`, clock quality / offset, monotonic `sequence`
- `measurement_type`, raw value/payload, normalized value, unit, quality flags and uncertainty
- instrument model/serial, gateway identity, firmware/configuration digest
- calibration record ID, validity interval and evidence hash
- operator/session context for manual actions; custody/batch/vehicle/weighment reference when applicable
- raw payload hash, canonicalization version, device authentication result and ingestion decision
- explicit state: `OBSERVED`, `QUARANTINED`, `CALIBRATION_BLOCKED`, `READY_FOR_REVIEW`, `REJECTED`; never auto-promote to statutory acceptance or credit issuance.

The API/schema must be reconciled with existing canonical source-envelope and sync types before implementation. This table is a target contract, not a claim that these fields already exist.

## 5. Connectivity, offline operation and recovery

- Prefer wired Ethernet for fixed installations when practical; keep instrument bus and enterprise network separated.
- Use RS-232/RS-485/Modbus only when supported by the instrument manual; verify baud/parity/address/register map and electrical levels on a bench.
- Cellular/Wi-Fi/LoRaWAN are transport choices, not trust anchors. Confirm coverage, encryption, power, interference, data costs and applicable DoT/WPC requirements.
- Queue locally with bounded capacity, durable write-before-ack semantics, sequence numbers and idempotent replay.
- Preserve original observation time separately from server receipt time. Mark uncertain clocks; do not silently rewrite timestamps.
- Define power loss, full disk, corrupt queue, network outage, device replacement, key revocation and duplicate delivery acceptance tests.
- A device that has been offline must not overwrite newer data or claim a live reading. Backfilled events retain original observation time and late-arrival status.

## 6. Security and physical safety baseline

- Unique device credentials; no fleet-wide shared secret; no credentials or private keys in source control.
- Mutual authentication where feasible, TLS for IP transport, authenticated message integrity for queued/bus data, key rotation/revocation and replay defense.
- Secure boot and signed firmware updates where the chosen platform supports them; maintain SBOM, firmware hashes, update history and rollback policy.
- Disable unused services/debug ports in deployed mode; change vendor defaults; least privilege; segregate OT/device networks from corporate and public networks.
- Tamper-evident enclosure, protected ports, surge/ESD protection, suitable ingress/temperature ratings and safe power isolation selected to site conditions.
- Treat RS-232/RS-485/4–20 mA/pulse wiring and industrial power as site-engineering work; require competent installation and applicable electrical safety review.
- Do not connect control outputs or write-capable Modbus registers in the first MRV release. Read-only acquisition is the default.
- Define incident response, vulnerability reporting, patch SLAs, asset inventory, log retention and secure decommissioning.

## 7. Indian statutory, certification and procurement applicability

Maintain a versioned evidence register for each finished device/system and procurement context. At minimum, assess:

1. **STQC/MeitY IoT System Certification Scheme (IoTSCS):** the official scheme describes evaluation across sensing/embedded components, communication protocols, gateways, cloud, end-user devices and UI. Decide applicability and assessment level with STQC; do not claim certification before issuance.
2. **BIS / QCO / CRS:** check the exact product category, current order, standard, effective date, exemptions and finished-product scope. BIS lists products under compulsory certification; it is not a blanket approval for every sensor or MCU.
3. **DoT/WPC:** assess RF module and finished-product requirements for cellular, Wi-Fi, Bluetooth, LoRa or other radio functions. Keep RF test report, module/finished-product mapping and applicable ETA/authorization evidence.
4. **Legal Metrology:** determine whether the instrument and transaction/use case fall under the applicable Legal Metrology Act/Rules, model approval, verification/stamping and state authority process. A generic IoT gateway cannot certify a weighment.
5. **Electrical/environmental and site requirements:** power supply, earthing, surge, hazardous-area classification if relevant, enclosure/IP rating, EMC and site-specific installation approvals.
6. **Public procurement / Make in India:** record the applicable order and product-specific value-addition/eligibility evidence when public procurement is involved. Do not infer domestic value addition from assembly or brand ownership.
7. **Data protection and cyber security:** minimize personal/location data, enforce purpose-based access, retention and incident handling; map applicable Indian law and CERT-In directions to the actual deployment.

Official source entry points (verify current versions and exact applicability before design freeze):
- STQC IoT System Certification Scheme: https://stqc.gov.in/iot-system-certification-scheme-iotscs
- STQC IoTSCS rules and procedures (official PDF): https://www.stqc.gov.in/sites/default/files/2024-05/STQC_IoT_D01-Rules-Procedures-Issue3-0.pdf
- BIS products under compulsory certification: https://www.bis.gov.in/product-certification/products-under-compulsory-certification/
- BIS Scheme II / CRS list: https://www.bis.gov.in/product-certification/products-under-compulsory-certification/scheme-ii-registration-scheme/
- DoT Equipment Type Approval: https://preprodeservices.dot.gov.in/equipment-type-approval-eta
- CERT-In advisories: https://www.cert-in.org.in/

This register is a research starting point, not legal advice or proof that any selected device is certified/approved.

## 8. Shakti Standards lifecycle gates

| Gate | Evidence required | Pass condition |
|---|---|---|
| G0 — Reality discovery | Site/process map, instrument inventory, manuals, stakeholders, power/connectivity and environmental constraints | Actual field context known; assumptions listed |
| G1 — Methodology and measurand | Applicable RupayKg workflow, required quantity/quality, unit, accuracy and uncertainty | Measurement is fit for intended claim |
| G2 — Compliance applicability | Dated official-source register, product-category mapping, legal metrology and radio/electrical applicability | Each applicable obligation assigned an owner and evidence |
| G3 — Architecture/design | Threat model, interface map, data contract, BOM provenance, lifecycle/spares and cost model | Independent design review accepted |
| G4 — Bench verification | Interface captures, simulator/test fixture, malformed/replay tests, power/network failure tests | Repeatable tests pass; no synthetic production data |
| G5 — Calibration/metrology | Actual certificate/verification evidence, range, uncertainty, due date and linkage to instrument serial | Current and applicable for the intended measurement |
| G6 — Site acceptance | Authorized installation, parallel comparison against trusted source, environment/power/network tests | Signed acceptance with discrepancies resolved |
| G7 — Security and certification | Device/gateway penetration/configuration test, SBOM/firmware provenance, applicable certification | No unresolved release-blocking findings |
| G8 — Canonical integration | Source envelope → normalized observation → calibration gate → measurement/MRV trace | Full lineage, tenant/geography authorization and idempotency verified |
| G9 — Operational readiness | SOPs, support/spares, monitoring, key rotation, backups, incident and decommission procedures | Named operator and recovery drill complete |
| G10 — Release/continuous assurance | Independent review, TRL evidence, rollback, change control, periodic calibration/security review | Authorized sign-off; otherwise production remains HOLD |

TRL is evidence-based and provisional. Hardware prototype success alone does not establish deployment readiness, certification or production acceptance.

## 9. First implementation batches

**Batch A — source and code audit (before runtime edits):**
- Trace canonical device registry/enrollment, sync envelope, field capture, evidence vault, measurement/MRV services and migration ownership.
- Identify exact existing interfaces and avoid duplicate schemas, tables, routes or persistence.
- Inventory current hardware-related branches/PRs and keep this workstream isolated.

**Batch B — instrument adapter contract and calibration gate:**
- Define typed, versioned read-only adapter contract for weighbridge first.
- Bind each observation to the immutable source envelope and instrument/calibration identity.
- Add tests for invalid frames, unknown device, expired/missing calibration, unit mismatch, replay, duplicate event, clock drift, offline backfill and unauthorized tenant/site.

**Batch C — edge reference implementation:**
- Choose MCU/gateway only after actual instrument/manual and operating conditions are known.
- Produce wiring/interface specification, BOM with provenance, firmware threat model, secure enrollment and offline queue design.
- Use bench fixtures or clearly marked test fixtures; never treat simulated data as production evidence.

**Batch D — end-to-end acceptance and deployment package:**
- Demonstrate source-to-MRV lineage with a real, authorized instrument and current calibration evidence.
- Add installation SOP, test record, incident/recovery drill, support/spares plan, monitoring and release rollback.
- Keep production certification OFF/HOLD until all mandatory gates pass.

## 10. Current known gaps and truth status

- Canonical repository is `vishaltradewinds/rupaykg`; the separate `rupaykg-aistudio` repository contains a legacy PhysicalEvidenceGateway and must not become a competing persistence path.
- A previous source-level architecture review identified existing canonical field-device enrollment/provenance, sync envelopes, replay/idempotency controls, field capture, evidence vault and MRV handoff as reuse targets.
- Actual site instrument make/model/manual, wiring/interface evidence, calibration package, hardware-in-the-loop results and live deployment verification are **not yet evidenced in this document**.
- No claim is made here that hardware has been purchased, connected, tested, certified, or accepted by a government authority.
- No production database, live site, external portal, or deployment is changed by this document.

## 11. Definition of done

The hardware/IoT stack is complete only when a real instrument can be securely enrolled, produce a reproducible and authenticated observation, survive offline/replay/failure conditions, preserve immutable source lineage, pass an instrument-specific calibration gate, bind to the correct methodology/activity/custody/site, reach the existing RupayKg MRV workflow, and pass security, legal applicability, site acceptance and independent Shakti review. Until then, status is **ENGINEERING IN PROGRESS / PRODUCTION HOLD**.
