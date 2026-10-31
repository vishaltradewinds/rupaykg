# Jabalpur Pilot — Hardware Evidence Intake and End-to-End Acceptance Plan

Record: RUPAYKG-JBP-HW-ACCEPT-2026-10-25-01
Site: SITE-JBP-01 — Kathonda MSW Processing and Disposal Facility
Purpose: Obtain real site evidence and define a testable instrument-to-MRV acceptance gate.
Status: OPEN — site inventory and model-specific evidence not present in the reviewed repository paths. All hardware remains HOLD.

## 0. Critical site-reality and methodology compatibility HOLD

**The documented Kathonda operation is a mass-burning waste-to-energy (WtE) plant, not a demonstrated landfill-methane-recovery project.** The CPCB reply filed before the National Green Tribunal describes mass-burning technology processing about 600 TPD with 11.5 MW designed generation capacity and says the sanitary landfill constructed for the purpose was not being used properly (historical report covering 2024). Source: https://www.greentribunal.gov.in/sites/default/files/news_updates/REPLY%20BY%20CPCB%20IN%20OA%20NO.%20819%20of%202024%20NEWS%20ITEM%20TITLED%20JABALPUR%20KATHAUNDA%20PLANT%20MEIN%20KACHARA%20JALNE%20KE%20BAAD%20DUR%20DUR%20TAK%20FAIL%20RAHE%20DHOOL%20KE%20KAN.pdf

The official IBBI corporate-process page lists an NCLT resolution-plan approval for Jabalpur MSW Private Limited dated 4 April 2025: https://ibbi.gov.in/claims/order-process/U90001DL2013PTC247509. A reproduced NGT order dated 13 July 2026 states that JMC's report described the WtE plant as recommissioned in January 2026 after overhaul and operating continuously, with 30,759.50 MWh of grid electricity exported from January through June 2026; it identifies Jabalpur MSW Private Limited under Kundan Group as the operator and disposes of the OA. The same order describes a separate proposed 100 TPD Bio-CNG plant under CITIIS 2.0, with feasibility/DPR and final approval steps still in progress at that time. Reproduced NGT order: https://www.casemine.com/judgement/in/6a8448a7979ea4201d807bf0

This evidence establishes that Kathonda's documented primary operation is WtE mass incineration. It does **not** establish an active landfill-gas collection/recovery system within the proposed RupayKg project boundary. BEE BM WA03.001 is explicitly titled **Landfill Methane Recovery**. Therefore, do not treat the WA03.001 methane flow-meter/analyser list as a procurement specification for the WtE plant. A separate landfill-gas project would need its own verified boundary, evidence that gas is actually collected/recovered, and methodology eligibility. A proposed Bio-CNG project is not an operating asset until commissioning and eligibility are evidenced.

BEE's approved-methodology list (last updated 7 July 2026) separately lists BM WA03.003, **Production of Compressed Bio-gas (CBG)**. The NGT order describes a proposed 100 TPD Bio-CNG project under CITIIS 2.0, but feasibility/DPR and final approval steps were still in progress at the time of that order. Treat BM WA03.003 as a possible future route to assess only if that separate project is formally approved, designed, commissioned and shown to meet the methodology. Do not treat the proposal as an operating asset or assume eligibility. Official list: https://beeindia.gov.in/view_content.php?lang=1&lid=571.

Before selecting any methodology-specific hardware, obtain written confirmation from JMC/site management of:
1. Exact project boundary and asset/site coordinates.
2. Whether the intended project is WtE mass burning, legacy-waste/RDF processing, the proposed Bio-CNG plant, or a distinct landfill-gas recovery activity.
3. Current operating/commissioning status, current operator and asset-control authority after June 2026.
4. Whether an active landfill cell exists within the boundary and whether landfill gas is actually collected/recovered; identify gas collection, flaring/use equipment and measurement points.
5. Existing instruments and their exact models, current authorizations, approved monitoring plan, methodology version and BEE/CCTS eligibility basis.

If the intended activity is WtE mass burning or general waste processing without landfill-gas recovery, pause the BM WA03.001 hardware plan and revalidate methodology eligibility with the responsible program authority. Do not buy methane sensors based only on the site name. Status remains HOLD until the site/process/methodology gate is closed.

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

## 3. Measurement requirements — conditional on site eligibility

Only apply the following BM WA03.001 requirements after the site-reality/methodology compatibility gate above is passed. Confirm the current methodology and site monitoring plan. The methodology requires continuous gas-flow measurement with accumulated-volume recording and direct methane-content measurement; measurement location and moisture/humidity basis must be compatible. Any periodic methane measurement option must meet the methodology's stated confidence/precision conditions. Do not add separate temperature or pressure sensors automatically if the selected instrument already supplies the required values.

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
MeitY CRO FAQs (check notified category and exact-model scope; do not infer universal approval): https://www.meity.gov.in/writereaddata/files/Modified-FAQs-CRO.pdf

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

## 8. Current code enforcement status

The default branch's previously reviewed MRV path did not bind observations to model-specific hardware approval. The proposed implementation is in [draft PR #49](https://github.com/vishaltradewinds/rupaykg/pull/49), with related register/API documentation and tests. That PR adds an organization-scoped instrument register, MeitY evidence reference/hash, calibration and firmware/security gates, measurement-role and supported-parameter mapping, append-only decision history, and an MRV submission guard. Its CI passed, but the PR remains draft and has not been merged; therefore the default branch must not yet be treated as having these controls.

The implementation records evidence references and reviewer attestations; it does not independently authenticate certificate genuineness or retrieve/recompute hashes from the production evidence vault. Structured per-parameter range/unit/accuracy mapping and the actual evidence-store contract remain review gates. Field-device identity verification is not product approval. A successful software build is not hardware certification, field validation or regulatory approval.

## 9. Current blockers

1. **Site/process and methodology compatibility unresolved:** official CPCB/NGT material describes Kathonda as a mass-burning WtE facility and notes the sanitary landfill was not being used properly as of September 2024. Confirm current site state and the exact project boundary before treating BM WA03.001 as applicable.
2. No site-provided exact instrument inventory/model/certificate/calibration/manual/firmware packet was found in the repository files checked for this batch.
3. No hardware model is VERIFIED; no purchase, physical connection or deployment is authorized.
4. Draft code PR #49 must complete review and be merged before the default branch has the proposed software gate; evidence-store and structured measurement-specification gates remain open.

Next action: first obtain written site/operator confirmation of the real process, operating status, project boundary and methodology eligibility. Only then obtain the actual instrument packet and reconcile every model against official MeitY/other applicable approvals, calibration, firmware/security and interface evidence. Do not purchase or deploy until all relevant gates pass.


## 0.1 July 2026 NGT order update

The NGT order dated 13 July 2026, considering the JMC progress report dated 10 July 2026, records continuous WtE operation since January 2026 and 30,759.50 MWh grid export from January through June 2026. It states MoHUA had approved the proposed 100 TPD Bio-CNG project under CITIIS 2.0, PDMC feasibility/DPR preparation was underway, and finalization before the Central Government remained pending. O.A. 819/2024 was disposed of after considering this progress report.

Sources: NGT portal listing: https://www.greentribunal.gov.in/index.php?page=1183. Reproduced order: https://indiankanoon.org/doc/76746794/.

This is a status update, not proof of Bio-CNG commissioning, methane recovery, instrument availability, or carbon-credit eligibility. Keep WtE and Bio-CNG as separate activity boundaries.
