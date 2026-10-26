# SITE-JBP-01 — Measurement Requirements Register

**Status: OPEN — NOT A VERIFIED SITE SPECIFICATION**

This register is an intake and qualification template for the proposed SITE-JBP-01 / Kathonda MSW facility. It deliberately does not assume the facility's current process, operator, project boundary, treatment technology, gas capture, or applicable carbon methodology. No physical instrument or gateway is selected by this document.

**Shakti Standards rule:** establish reality and evidence first. Do not select equipment, declare methodology applicability, or accept readings as authoritative MRV evidence until the relevant gates pass.

## 1. Required site and process evidence

| Required fact | Evidence required | Current status |
|---|---|---|
| Legal site name, address, owner/operator and authorized site contact | Official facility/operator record and written confirmation | OPEN — not verified |
| Actual operating process and process-flow diagram | Current process description, diagram, operator walkthrough and dated photographs where permitted | OPEN — not verified |
| Project boundary and activity start date | Approved project documentation and boundary map | OPEN — not verified |
| Waste input types and daily/monthly throughput | Weighbridge records, operating logs, sample period and units | OPEN — not verified |
| Process outputs, residues and destinations | Mass balance, operating records and destination evidence | OPEN — not verified |
| Energy/fuel use and sources | Meter/fuel records, units, time interval and source | OPEN — not verified |
| Existing instrumentation and calibration status | Instrument list, exact model/serial, manuals, calibration/verification records and maintenance history | OPEN — not verified |
| Site conditions | Temperature, humidity, dust, rain, flooding, corrosion, vibration, power quality and connectivity | OPEN — not verified |
| Required carbon/accounting methodology and version | Official methodology, eligibility analysis and approved monitoring plan | OPEN — not verified |
| Statutory and conformity obligations | Applicable permits, metrology requirements, exact-model conformity/approval evidence and competent review | OPEN — not verified |

## 2. Public-record leads discovered (verify before use)

A public MP Pollution Control Board status/inspection report filed through the National Green Tribunal website describes the Kathonda facility as a **Waste-to-Energy (WtE) plant using mass-incineration technology**, capable of processing mixed municipal solid waste. The report says the plant was recommissioned in January 2026 after an overhaul. It also includes an MPPCB consent order dated 16 March 2026 for M/s Jabalpur MSW Pvt. Ltd., listing 600 TPD MSW processing capacity and an 11.50 MW power plant, with consent/authorisation validity stated through 28 February 2028 subject to conditions. These are public-record leads, not confirmation of today's operating condition or the scope of any RupayKg project. The operator's current records and the complete consent conditions must be collected and verified before design.

- Official NGT-hosted MPPCB status/inspection report and consent-order attachment: https://www.greentribunal.gov.in/sites/default/files/news_updates/STATUS%20CUM%20INSPECTION%20REPORT%20BY%20MPPCB%20IN%20OA%20NO.%20819%20of%202024%20NEWS%20ITEM%20TITLED%20JABALPUR%20KATHAUNDA%20PLANT%20MEIN%20KACHARA%20JALNE%20KE%20BAAD%20DUR%20DUR%20TAK%20FAIL%20RAHE%20DHOOL%20KE%20KAN.pdf
- CPCB's central SWM portal states the Solid Waste Management Rules, 2026 were notified on 27 January 2026 and came into force on 1 April 2026: https://swmp.cpcb.gov.in/en

**Engineering consequence:** the public record points to a WtE mass-incineration process, not proof of a landfill methane-recovery activity. Do not use BM WA03.001 or assume a landfill methane monitoring plan for this plant without a separate, documented activity boundary and methodology applicability assessment. A WtE project's candidate measurement domains may include incoming/feed waste mass, feed composition/calorific value, electricity generated/exported, auxiliary fuel, stack emissions and ash/residue flows—but these are only investigation prompts, not a final MRV parameter list. Final parameters must come from the actual process boundary, approved methodology/monitoring plan, permits and verified instrument records.

The current rule set and each permit's conditions must be checked against official, current documents before implementation. A consent-validity date does not itself establish compliance with every condition.

## 3. Methodology gate — no premature instrument selection

Before naming any MRV sensor, determine the real facility process and applicable approved methodology. In particular, do not infer that a landfill methane-recovery methodology applies merely because the site is an MSW facility. Landfill disposal, biomethanation, composting, RDF production, waste-to-energy, material recovery and other processes can have different measurement and eligibility requirements.

For each proposed monitored parameter, document:
- the methodology clause and why the parameter is required;
- whether it is directly measured, calculated, sampled, estimated or obtained from a third party;
- unit, expected range, accuracy/uncertainty requirement, resolution and sampling interval;
- instrument placement and sampling method;
- calibration/verification, traceability and maintenance requirements;
- data gaps, substitution rules and uncertainty treatment permitted by the methodology;
- required evidence, reviewer and retention period.

If the methodology or applicability is unresolved, mark the parameter **BLOCKED — METHODOLOGY NOT CONFIRMED**. Do not fabricate a monitoring plan.

## 4. Instrument register (one row per parameter/instrument)

| Field | Required value |
|---|---|
| Parameter code and description | OPEN |
| Methodology reference / monitoring-plan clause | OPEN |
| Measurement type (direct / derived / sampled / third-party) | OPEN |
| Unit, range, accuracy, resolution, frequency | OPEN |
| Instrument category and intended measurement principle | OPEN |
| Manufacturer, exact model, revision and serial/asset ID | OPEN |
| Protocol and physical interface | OPEN |
| Calibration/verification standard, status and due date | OPEN |
| Exact-model approval/conformity evidence for intended use | OPEN |
| Installation location and environmental requirements | OPEN |
| Evidence artifact/version and integrity metadata | OPEN |
| Data owner, operator, reviewer and maintenance owner | OPEN |
| Failure mode, backup method and data-gap treatment | OPEN |
| Lifecycle cost and supplier/support evidence | OPEN |
| Bench/field acceptance test and pass criteria | OPEN |

Do not assign an instrument code or mark an instrument verified until the real device and required evidence are available. Unknown values remain unknown; free-text labels are not proof of physical source.

## 5. Edge gateway requirements (to be decided after instruments are known)

| Requirement | Evidence/decision required | Status |
|---|---|---|
| Required physical interfaces and electrical characteristics | Exact instrument manuals/register maps | OPEN |
| Supported protocol/driver on candidate board | Official board/OS/driver documentation and bench test | OPEN |
| Power, enclosure and environmental requirements | Site survey and component ratings | OPEN |
| Secure boot/update and key handling | Exact platform capability, configuration and test evidence | OPEN |
| Offline storage capacity and retention | Calculated from sample rate, outage duration and payload size | OPEN |
| Monotonic sequencing, time quality and replay/duplicate controls | Design review and automated fault tests | OPEN |
| Recovery after power loss/network loss | Repeatable test with recorded results | OPEN |
| Authenticated ingestion to RupayKg | Integration tests against existing device/instrument registry and ingestion API | OPEN |
| Firmware/software maintenance and vulnerability response | Supported lifecycle, update procedure and owner | OPEN |
| Total lifecycle cost | Itemized hardware, integration, installation, calibration, support and replacement estimate | OPEN |

## 6. Mandatory test cases before field use

1. Reject unknown, unregistered, expired, held or unapproved instruments.
2. Reject parameter/unit mismatch, out-of-range values and malformed payloads.
3. Reject or quarantine stale timestamps and invalid sequence progression according to the defined policy.
4. Verify duplicate and replay protection, including reconnect/retry.
5. Disconnect the network and verify bounded buffering, integrity and correct ordered replay.
6. Interrupt power during writes and verify recovery without silent loss or duplication.
7. Verify unauthorized device/user cannot write or approve evidence.
8. Verify evidence changes and instrument identity/spec changes follow immutable versioning rules.
9. Test driver behavior against the exact instrument model and documented register map.
10. Document test environment, build/version, raw results, failures, fixes, reviewer and sign-off.

Synthetic fixtures are for isolated software testing only. They must not be sent to live/staging authoritative MRV paths or used as calibration, commissioning or real-field evidence.

## 7. Decision gates

- **G0 Context discovery:** site/operator/process and boundary evidence verified.
- **G1 Methodology:** applicable methodology/version and parameter requirements independently reviewed.
- **G2 Desk qualification:** exact candidate hardware/firmware, licenses, support lifecycle and approval evidence collected.
- **G3 Simulation:** software-only synthetic tests pass while registry-ineligible.
- **G4 Bench:** real instrument access and bench work explicitly authorized; interface and fault tests pass.
- **G5 Field installation:** safety, applicable approvals, calibration/verification, installation and commissioning documented.
- **G6 MRV acceptance:** data lineage, uncertainty/quality treatment, security and methodology-specific acceptance independently reviewed.
- **G7 Operations:** monitoring, maintenance, calibration renewal, patching, incident response and periodic requalification assigned.

A failed mandatory gate blocks progression. Passing application CI does not establish instrument calibration, site commissioning, statutory approval or production certification.

## 8. Next practical action

Collect the evidence listed in Section 1 from the site owner/operator and identify the actual process. Then produce the methodology-to-parameter map before selecting sensors or edge hardware. No purchase or paid service is authorized by this register.
