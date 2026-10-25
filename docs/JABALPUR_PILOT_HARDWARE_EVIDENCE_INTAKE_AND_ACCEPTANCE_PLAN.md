# Jabalpur Pilot — Hardware Evidence Intake and End-to-End Acceptance Plan

Record: RUPAYKG-JBP-HW-ACCEPT-2026-10-25-01
Site: SITE-JBP-01 — Kathonda MSW Processing and Disposal Facility
Purpose: Obtain real site evidence and define a testable instrument-to-MRV acceptance gate.
Status: OPEN — site inventory and model-specific evidence not present in the reviewed repository paths. All hardware remains HOLD.

## 1. Scope and non-negotiable controls

This is an intake and test plan, not evidence that the site has any particular instrument and not an approval to buy, connect, or deploy hardware.

- Use only hardware satisfying the project owner's MeitY-only rule. Verify exact manufacturer, model, SKU/revision and the applicable official approval/certification route. A generic certificate, another model's certificate, vendor marketing or a search result is not proof.
- If an exact applicable MeitY approval cannot be verified, HOLD the candidate. Do not use a “not applicable” entry to bypass the owner's rule; escalate for a written decision.
- Verify other independently applicable requirements too: calibration and measurement traceability, Legal Metrology for relevant weighing instruments, electrical safety/EMC, telecom/radio/WPC/ETA, cybersecurity, contract and methodology requirements.
- No procurement, site commissioning or production release until the relevant evidence and test gates pass.
- Keep source observations immutable. Store corrections and normalized values as linked records, not destructive edits.

## 2. Request from site/operator — one row per instrument/device

Please supply this packet for every existing device used to produce MRV data or transmit it:

| Field | Required value |
|---|---|
| Site and process location | Actual location and measurement point |
| Instrument role | Gas flow, methane content, weighbridge, electricity, gateway, etc. |
| Manufacturer / exact model / SKU / revision | From nameplate, not memory |
| Serial number / asset ID | Mask only where a security policy requires it; retain controlled traceability |
| Datasheet and manual | Manufacturer-issued, revision/date recorded |
| Output and protocol | Modbus RTU/TCP, 4–20 mA, pulse, serial, file export, API, or other actual interface |
| Range, units and accuracy | Including conditions and uncertainty where specified |
| Approval/certification | Issuer, identifier, model scope, validity, official verification source/date |
| Calibration / verification | Certificate ID, lab, traceability, uncertainty, calibration date and due date |
| Installation | Location, orientation, sampling point, line conditions, commissioning record |
| Firmware/software | Version, support status and update policy |
| Existing data records | Sample redacted payloads, raw files, logs, weight tickets and timestamps |
| Custodian | Site owner, operator, responsible engineer and evidence contact |
| Exceptions | Missing plates, expired certificates, gaps, repairs, substitutions, or unknown values |

Evidence files should be named `SITE_DEVICEID_DOCUMENTTYPE_YYYY-MM-DD.ext`. Preserve original files and record a SHA-256 hash, received time, source and reviewer. Do not publish personal or sensitive site credentials.

## 3. Measurement requirements to confirm before choosing equipment

For the selected BEE BM WA03.001 route, confirm the current methodology and site monitoring plan. The methodology requires continuous gas-flow measurement with accumulated-volume recording and direct methane-content measurement; measurement location and moisture/humidity basis must be compatible. Any periodic methane measurement option must meet the methodology's stated confidence/precision conditions. Do not add separate temperature or pressure sensors automatically if the selected instrument already supplies the required values.

Required site facts before instrument selection:
1. Actual gas train and measurement points; gas composition and operating envelope.
2. Flow range, expected turndown, pressure/temperature/moisture conditions, and required time resolution.
3. Methane measurement arrangement, sampling line and moisture basis.
4. Existing weighbridge and ticket workflow for waste mass; identify whether it is legally verified and how gross/tare/net are recorded.
5. Existing electricity/flare/plant-status records needed by the monitoring plan.
6. Network/power outages, local storage needs, time source and physical/security constraints.
7. Applicable methodology version, monitoring plan, baseline, boundary and calculation units.

Official methodology: https://beeindia.gov.in/sites/default/files/BM%20WA03.001.pdf
BEE methodology list: https://beeindia.gov.in/view_content.php?lang=1&lid=571

## 4. Exact-model approval gate

For each candidate, create an evidence row with:
- Candidate ID and intended use.
- Exact model/SKU/revision and manufacturer.
- The current primary-source rule that requires approval/certification, with applicability rationale.
- Official issuing authority and official lookup or written confirmation.
- Certificate/registration/test-report identifier, model scope, factory/site scope if relevant, status and expiry.
- Calibration and uncertainty evidence for measurement instruments.
- Interface, security lifecycle, maintenance and spare-part support.
- Reviewer, review date, evidence hash and decision.

Disposition: VERIFIED / PENDING / HOLD / EXPIRED / REJECTED. A model is VERIFIED only after the full applicable evidence is reviewed. MeitY status and other statutory/technical requirements must be recorded as separate determinations. “Not found” is not the same as “not required”; unresolved applicability remains HOLD under the owner's rule.

## 5. End-to-end acceptance matrix

| Test ID | Scenario | Expected result | Required evidence |
|---|---|---|---|
| E2E-01 | Valid instrument sample | Authenticated ingestion, correct unit/value, linked source evidence | Raw sample, request/response IDs, persisted record |
| E2E-02 | Duplicate delivery | Idempotent handling; no duplicate MRV contribution | Duplicate IDs and database/reconciliation evidence |
| E2E-03 | Out-of-order observations | Original event time preserved; deterministic ordering/aggregation policy | Raw timestamps and computed output |
| E2E-04 | Offline gateway then reconnect | Durable buffer drains without loss or double counting | Disconnect/reconnect logs and record counts |
| E2E-05 | Invalid units/range/NaN/null | Reject or quarantine; no silent coercion | Validation error and quarantine record |
| E2E-06 | Clock drift / missing timestamp | Time-quality flag and defined handling; no fabricated timestamp | Clock source, drift measurement, quality flag |
| E2E-07 | Calibration expired/unknown | Reading blocked or quarantined from eligible calculation | Calibration state and calculation exclusion |
| E2E-08 | Certificate/model mismatch | Device stays HOLD; production ingestion cannot be treated as eligible evidence | Register decision and access/control log |
| E2E-09 | Replay/tampered payload | Reject or detect; immutable original and security event retained | Replay fixture, signature/hash result, alert |
| E2E-10 | Power loss/restart | Durable queued data recovered; no loss or duplicate contribution | Power-cycle log and reconciliation |
| E2E-11 | Sensor disconnection / stuck value | Quality alarm, bounded handling, no invented readings | Fault injection and alert record |
| E2E-12 | MRV reconciliation | Raw source → normalized observation → calculation version → reported result traceable | Reproducible lineage and reconciliation report |
| E2E-13 | Permission/tenant boundary | Unauthorized device/user cannot submit or read another site's evidence | Negative authorization tests |
| E2E-14 | Evidence retention | Raw payload, receipt metadata, hash and transformation version preserved | Retention query and integrity verification |

Every test needs preconditions, software/firmware versions, fixture, operator, expected result, actual result, evidence references, pass/fail, defects and retest. Do not mark a test passed without executed results.

## 6. Data contract for each observation

Minimum proposed fields (map to the existing domain model after code audit; do not create a parallel schema without review):

- `site_id`, `device_id`, `instrument_id`, `parameter`
- `value_raw`, `unit_raw`, `value_normalized`, `unit_normalized`
- `event_time`, `received_time`, `time_quality`
- `calibration_status`, `quality_flags`, `eligibility_status`
- `source_record_id`, `raw_payload_hash`, `raw_evidence_location`
- `transformation_version`, `methodology_version`, `calculation_run_id`
- `correction_reason`, `corrected_by`, `corrected_at` where a correction is made

These are acceptance requirements, not a claim that current production code already implements these fields. Inspect the existing schema and migrations before any implementation change.

## 7. Gate sequence

G0 — Site inventory and monitoring plan received.
G1 — Exact models and official approval evidence verified.
G2 — Calibration, measurement range, uncertainty and installation suitability verified.
G3 — Protocol and security design reviewed.
G4 — Bench tests and negative/fault tests pass.
G5 — Instrument-to-MRV lineage and reconciliation independently reviewed.
G6 — Site/operator acceptance and evidence archive complete.
G7 — Authorized release decision recorded.

Any failed or missing mandatory gate keeps the affected device/data path on HOLD. A successful software build is not hardware certification, field validation or regulatory approval.

## 8. Current blockers

1. No site-provided exact instrument inventory was found in the repository files checked for this batch.
2. No exact model/certificate/calibration/manual bundle is available in the reviewed record.
3. Repository code search returned no matching results for the searched MRV/hardware terms; this is not proof the code is absent. A full tree-level code audit and local test execution remain outstanding.
4. No hardware model is VERIFIED; no purchase, physical connection or deployment is authorized.

Next action: request the operator's instrument packet, then reconcile every row against the existing repository schema and live interface documentation before coding or purchasing.
