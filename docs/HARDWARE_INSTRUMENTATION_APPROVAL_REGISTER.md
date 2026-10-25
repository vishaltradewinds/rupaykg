# RupayKg — Hardware and Instrumentation Approval Register

Record: RUPAYKG-HW-REG-2026-10-25-01
Status: Requirements baseline; all unverified models remain HOLD.
Purpose: Control candidate hardware for RupayKg waste-to-carbon MRV. This is not a purchase order or approved-vendor list.

## Non-negotiable rule

Use only hardware whose applicable MeitY approval/certification status has been verified, per the project owner's requirement. Determine the exact approval route for each product category; do not assume one universal MeitY certificate applies to every industrial gateway, sensor, gas analyser, flow meter or weighbridge. Where the required approval or exact-model evidence is missing or ambiguous, keep HOLD. Do not procure or deploy.

## Status values

- VERIFIED: exact model and applicable approvals, calibration, engineering and security evidence reviewed.
- PENDING: evidence requested or review underway.
- HOLD: mandatory evidence missing or ambiguous; procurement/production use prohibited.
- EXPIRED: required approval or calibration is no longer valid.
- REJECTED: fails a mandatory requirement.
- NOT APPLICABLE WITH WRITTEN JUSTIFICATION: applicability review recorded; does not silently waive the user's MeitY requirement.

No exact model is VERIFIED in this initial register.

## Candidate register

| ID | Category | Minimum requirements | Evidence to verify | Status |
|---|---|---|---|---|
| HW-01 | Industrial IoT gateway | Supported OS, Ethernet, required serial interfaces, secure local buffering, reliable clock | Exact model; applicable MeitY/STQC scope; safety/EMC/radio applicability; firmware support | HOLD |
| HW-02 | RS-485/Modbus interface | Isolation where required, documented protocol, industrial noise tolerance | Exact model, electrical safety/EMC applicability, protocol and bench tests | HOLD |
| HW-03 | RS-232 interface | Only if existing site equipment requires it | Exact model, isolation and electrical applicability, interface test | HOLD |
| HW-04 | Industrial power supply/protection | Correct input/output, load margin, isolation and surge protection | Exact model, applicable safety/EMC evidence, installation conditions | HOLD |
| HW-05 | Continuous landfill-gas flow meter | Gas compatibility, range, accumulated volume, accuracy/uncertainty and conditions documented | Applicable approval, calibration traceability, installation and methodology fit | HOLD |
| HW-06 | Direct methane analyser | Direct CH4 measurement, range, accuracy, response time, output and sampling documented | Applicable approvals, calibration/reference method, drift/maintenance controls, methodology fit | HOLD |
| HW-07 | Gas temperature transmitter | Add only if required by the meter/methodology/site plan | Exact model, calibration, range, environmental suitability | HOLD |
| HW-08 | Gas pressure transmitter | Add only if required by meter/methodology/site plan | Exact model, calibration, pressure range and applicable approvals | HOLD |
| HW-09 | Moisture measurement/correction | Establish compatible moisture basis or required correction | Method, calibration, correction algorithm and uncertainty | HOLD |
| HW-10 | Weighbridge and indicator | Capacity/division, auditable gross/tare/net records | Applicable Legal Metrology approval/verification and site acceptance | HOLD |
| HW-11 | Weighbridge interface | Controlled acquisition of weight/ticket, timestamp and identity | Interface spec, integrity, duplicate/replay handling, end-to-end test | HOLD |
| HW-12 | Electricity meter | Range, accuracy class and data output fit to use | Applicable meter rules, calibration/verification, interface test | HOLD |
| HW-13 | LTE/4G router/modem | Required bands, secure management, reconnect, interfaces | Applicable telecom/radio/WPC/ETA status for exact model, as applicable | HOLD |
| HW-14 | Local storage and trusted time | Power-loss-safe buffering, time sync and quality metadata | Retention, security, offline recovery and timestamp tests | HOLD |
| HW-15 | Security component/device identity | Key storage/provisioning suited to threat model | Exact part, security docs, provisioning and lifecycle controls | HOLD |

No manufacturer/model is named as approved. The records reviewed do not establish an exact eligible gateway, landfill-gas flow meter or methane analyser. This is an evidence gap, not proof that no eligible product exists.

## BM WA03.001 monitoring requirements

The official BEE BM WA03.001 methodology describes continuous flow meters with accumulated-volume recording and direct methane-content measurement. Methane measurement location and moisture/humidity basis must be compatible with the methodology. It allows periodic methane measurement only subject to its specified confidence/precision conditions. Consult the current methodology and site-specific monitoring plan before selecting equipment.

Official source: https://beeindia.gov.in/sites/default/files/BM%20WA03.001.pdf
BEE approved methodologies list: https://beeindia.gov.in/view_content.php?lang=1&lid=571

Do not add separate temperature/pressure instruments automatically if the chosen meter already provides required data.

## Required evidence for each candidate

1. Manufacturer datasheet and exact model/SKU/revision.
2. Official certificate/registration/test report and issuing authority, where applicable.
3. Official registry entry or authority confirmation matching exact model and scope.
4. Written applicability review for MeitY/STQC and all other applicable statutory/contractual regimes.
5. Calibration certificate, traceability, uncertainty and next due date for measurement instruments.
6. Protocol/interface specification and compatibility test.
7. Security/firmware support assessment.
8. Acceptance results, including fault and recovery tests.
9. Reviewer, date, decision and retained evidence reference/hash.

Vendor claims alone are insufficient. Missing official evidence means HOLD.

## First validation batch

1. Obtain the Jabalpur pilot's actual instrument inventory, exact model numbers, certificates, calibration records and interface manuals.
2. Verify each model and requirement against official records and the applicable methodology.
3. Design integration around actual site interfaces; do not buy before requirements and eligibility are verified.
4. Bench-test instrument/gateway ingestion before site commissioning.
5. Test instrument → gateway → authenticated ingestion → original evidence retention → normalized observation → MRV trace/reconciliation.
6. Test offline buffering, clock drift, malformed values, unit mismatch, calibration expiry, duplicates, replay, out-of-order data and recovery.
7. Only then consider procurement/site commissioning approval.

## Official source starting points

- MeitY CRO FAQs (the order applies to notified product categories; verify the current schedule and exact model): https://www.meity.gov.in/writereaddata/files/Modified-FAQs-CRO.pdf

- STQC IoT System Certification Scheme: https://stqc.gov.in/en/iot-system-certification-scheme-iotscs-0
- STQC certified products: https://www.stqc.gov.in/certified-product
- Department of Consumer Affairs Legal Metrology overview: https://consumeraffairs.gov.in/pages/legal-metrology-overview
- BEE approved methodologies: https://beeindia.gov.in/view_content.php?lang=1&lid=571
- BEE BM WA03.001: https://beeindia.gov.in/sites/default/files/BM%20WA03.001.pdf

These sources are starting points, not proof that any specific model is approved. Procurement and production deployment remain HOLD.
