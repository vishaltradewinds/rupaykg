# RupayKg Field Edge Hardware Stack — Controlled Engineering Baseline

Status: ENGINEERING BASELINE / NOT FIELD-CERTIFIED

Purpose: define the hardware-to-software boundary for SITE-JBP-01 and later pan-India deployments without treating a bill of materials, bench test, or software integration as field validation or TRL 9.

## 1. Edge architecture

```
[Approved sensor / instrument]
        |
        | native interface: RS-232 / RS-485 / pulse / digital I/O
        v
[Edge acquisition controller]
        |
        | signed device identity + timestamp + quality flags
        v
[Local acquisition service]
        |
        | canonical measurement envelope
        v
[RupayKg field-device sync API]
        |
        v
[Authoritative tenant-scoped PostgreSQL]
        |
        +--> evidence / MRV lineage
        +--> carbon calculation
        +--> audit trail
```

The edge controller is an acquisition and integrity anchor. It is not a substitute for statutory verification, laboratory calibration, accredited measurement, or regulatory approval.

## 2. Minimum hardware stack

| Layer | Baseline | Acceptance gate |
|---|---|---|
| Controller | ESP32-class industrial edge controller or an India-origin/open RISC-V alternative where interface/performance requirements are met | lifecycle, security, supply, environmental and interface review |
| Serial interface | Isolated RS-232/RS-485 interface module where required | electrical isolation, baud/framing validation, cable-length test |
| Digital inputs | isolated dry-contact / pulse input as required by instrument | debounce, edge-count accuracy, fail-safe state |
| Sensors | only instrument-specific sensors with documented range, accuracy and calibration evidence | calibration certificate + datasheet + serial-number traceability |
| Power | protected DC input with surge/reverse-polarity protection | brownout/restart and transient test |
| Storage | industrial non-volatile local buffer | power-loss recovery and bounded retention test |
| Communications | Ethernet/Wi-Fi/cellular according to site availability | reconnect, queue, replay and duplicate suppression test |
| Enclosure | site/environment-rated enclosure selected from actual field conditions | ingress, temperature, mounting and serviceability evidence |
| Time | RTC/NTP/GNSS-derived time source as appropriate | drift, loss-of-network and monotonic ordering test |

This is a controlled baseline, not a claim that every component is Indian-manufactured or MeitY-approved. Procurement and certification status must be evidenced per device SKU before field deployment.

## 3. Canonical measurement envelope

Every hardware-originated measurement entering RupayKg should be mappable to:

- `deviceId`
- `measurementId`
- `capturedAt`
- `source`
- `value`
- `unit`
- `method`
- `quality`
- `rawReference` (when raw instrument evidence is retained)
- `firmwareVersion`
- `hardwareSku`
- `calibrationReference`
- `sequence`
- `payloadHash`

The application must never silently convert an unverified instrument reading into certified MRV evidence.

## 4. Software boundary

The existing field-device enrollment/sync layer is the authoritative application boundary.

Required properties:

1. Device identity is unique.
2. Device is bound to one organization.
3. Authenticated identity and active organization are authoritative.
4. Measurement ingestion is idempotent or replay-safe.
5. Offline data is queued locally and replayed with sequence/hash evidence.
6. Duplicate packets do not create duplicate authoritative measurements.
7. Invalid units, timestamps, values and device status fail closed.
8. Raw evidence and transformed measurement remain traceable.
9. Firmware/hardware/calibration metadata travels with the measurement lineage.
10. Device revocation prevents further authoritative ingestion.

## 5. Hardware acceptance sequence

### H1 — component evidence
Capture manufacturer, exact SKU, datasheet, serial/lot, operating range, interface and calibration requirements.

### H2 — bench interface
Prove electrical interface, framing, scaling, units and error behavior using known test values.

### H3 — edge resilience
Prove power interruption, network loss, reboot, local queue, replay and duplicate handling.

### H4 — software integration
Prove field-device enrollment, tenant binding, measurement ingestion, evidence linkage and audit events in disposable infrastructure.

### H5 — site acceptance
At SITE-JBP-01, reconcile instrument readings against field records and calibration evidence. Record environmental and operational conditions.

### H6 — continuous assurance
Track device status, calibration expiry, firmware version, communication health, anomalous readings and evidence-chain integrity.

## 6. Security baseline

- No default production credentials.
- Unique device identity/credential per device.
- Credentials are not embedded in source code.
- Firmware provenance and version are recorded.
- OTA update mechanism, if used, must support authenticity and rollback.
- Debug interfaces must be disabled or access-controlled before field deployment.
- Device revocation must be enforceable server-side.
- Physical tamper controls are site-specific and must not be assumed from the controller alone.

## 7. Current readiness boundary

Software field-device enrollment and tenant-authority controls exist in the RupayKg application. Hardware procurement, exact SKU selection, calibration evidence, electrical/EMC/environmental validation, field installation, and SITE-JBP-01 acceptance remain separate evidence gates.

Therefore:

**Software integration readiness != hardware certification != field validation != TRL 9.**
