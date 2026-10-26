# RupayKg Site Instrument & Hardware Evidence Intake

**Record:** RUPAYKG-SITE-HW-INTAKE-2026-10-26  
**Target:** SITE-JBP-01 / Kathonda, Jabalpur — subject to confirmation by site owner  
**Status:** Awaiting site/operator evidence; no physical inspection claimed  
**Use:** Complete one row per installed instrument or controller before hardware selection or procurement.

## Instructions for the site/operator

Please provide only documents and information you are authorized to share. Redact personal data, passwords, API keys, SIM identifiers where sensitive, and unrelated confidential information. Do not email or commit credentials. A photo of the nameplate plus the official manual is useful, but neither substitutes for calibration or approval evidence.

## A. Confirm the project before specifying instruments

- Legal project owner and authorized site contact:
- Site address and facility name:
- Actual operating process (e.g., mass-burn WtE, landfill gas collection, composting, biomethanation/CBG, wastewater treatment, weighbridge/material recovery):
- Intended RupayKg project boundary and start date:
- Applicable MRV methodology and version; evidence of eligibility/registration if any:
- Exact parameter(s) to measure and why each is needed by the methodology:
- Existing equipment and data systems already available:
- Site access/connection authorization and responsible operator:
- Is any proposed Bio-CNG/landfill-gas process commissioned and operating? Provide commissioning/operation evidence; proposal/DPR alone is not sufficient.

**STOP:** If the process, boundary, methodology or parameter cannot be evidenced, keep instrument selection on HOLD. Do not infer that BM WA03.001 Landfill Methane Recovery applies to the Kathonda WtE facility. Assess BM WA03.003 CBG only if its actual project requirements and operating status are established.

## B. One row per instrument

| Field | Required value/evidence |
|---|---|
| Instrument asset ID | Site-owned ID or NOT_ASSIGNED |
| Function / parameter | What it measures; methodology parameter code |
| Manufacturer and exact model | From nameplate and manual |
| Serial number | May be masked in a public copy; provide securely to authorized reviewer |
| Hardware/firmware revision | Exact version |
| Measuring instrument or gateway only? | MEASURING, GATEWAY, CONTROLLER, OTHER |
| Interface | RS-232/RS-485, Modbus RTU/TCP, pulse, 4–20 mA, HART, USB, Ethernet, vendor API; only if verified |
| Protocol/register map | Official manual revision and relevant page/registers |
| Output schema | Raw value, unit, timestamp, quality flags, sequence, error states |
| Sampling/reporting interval | Actual supported interval and required interval |
| Power/environment | Voltage, backup, temperature, humidity, dust/water exposure |
| Connectivity/offline behaviour | Network type, local storage, queue/retry, clock source |
| Calibration | Certificate ID, lab, date, due date, uncertainty/traceability and covered range |
| Product approval/compliance | Exact applicable certificate/registration/official verification source; do not write “MeitY approved” without evidence |
| Security/update lifecycle | Authentication, encryption, firmware update process, support end date |
| Existing integration | Current gateway/software, vendor support and data export options |
| Cost/availability | Existing/owned, free evaluation, or dated quote including recurring fees |
| Evidence location | Authorized document repository reference; no secrets |
| Reviewer and decision | HOLD, VERIFIED, REJECTED; reviewer/date/reason |

Attach, where applicable:
1. Clear nameplate photo.
2. Official datasheet and installation/communication manual.
3. Register map/API specification and sample payload with credentials removed.
4. Current calibration certificate and traceability/uncertainty evidence.
5. Exact-model regulatory certificates/official authority record.
6. Firmware/support/security documentation.
7. Existing gateway details and written site connection permission.
8. Dated vendor quote only if a paid option is being considered.

## C. Measurement/evidence integrity requirements

For each measurement, the adapter must preserve the raw source payload and source timestamp; record receipt timestamp, unit, quality flags, sequence/idempotency key, payload SHA-256, instrument identity and adapter version; bind the observation to an exact instrument and parameter specification; and link calibration evidence valid at the time of measurement when required.

Malformed, duplicate/replayed, unauthorized, out-of-range, unsupported-unit or untraceable records must be rejected or quarantined. Missing/expired calibration blocks approval where required. A gateway's identity does not prove the measuring instrument's calibration or regulatory suitability.

Do not put synthetic test data into the site evidence vault. Do not use production credentials in a bench prototype. No new database/evidence vault or alternate MRV path should be created.

## D. Free-first candidate decision record

For each candidate (existing equipment, open-source software/SDK, SHAKTI, C-DAC VEGA/ARIES, or industrial gateway), record:
- Exact capability requirement and why it is necessary.
- Whether existing equipment can satisfy it.
- Free/reuse alternatives checked and evidence.
- Mandatory requirements each alternative fails, if any.
- Exact model/version, licence and support.
- Applicable product-specific MeitY/STQC/BIS/WPC/legal-metrology route and evidence.
- Dated price/quote, full lifecycle cost and recurring/billing triggers if paid.
- Security, supply-chain, calibration, maintenance and replacement plan.
- Acceptance tests and measurable pass criteria.
- Decision: FREE_OPTION, PAID_OPTION_JUSTIFIED, HOLD_FOR_EVIDENCE, or NOT_REQUIRED.
- Explicit approval before any purchase or paid activation.

## E. Bench acceptance gate

Before any field connection:
- Parse versioned synthetic observations offline.
- Reject malformed data, invalid units, range violations, unknown instrument identity and pending approval.
- Verify duplicate/replay and offline reconnect/idempotent retry behaviour.
- Test missing/expired calibration gates and evidence reference integrity.
- Confirm the test data cannot be represented as real site evidence.
- Compare physical readings with a suitable traceable reference only after the exact model, safe wiring, site authorization and calibration requirements are known.

## F. Current known status

As of 2026-10-26, no exact Kathonda instrument inventory/model/manual/calibration packet has been verified in the reviewed repository evidence. This document is an intake template, not a completed site survey. No board, sensor, gateway or paid service is approved. No physical site inspection or hardware compatibility test is claimed.

**Next required action:** The authorized site/operator supplies the filled intake and evidence. Until then, hardware choice remains HOLD_FOR_EVIDENCE.

**Shakti Standards:** ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.
