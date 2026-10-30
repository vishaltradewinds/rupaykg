# RupayKg Hardware SKU & Approval Evidence Register
**Status:** Template initialized; no SKU is approved by this register until evidence is attached and reviewed.
**Parent architecture:** `docs/hardware-iot-stack-foundation.md`
**Branch:** `hardware/iot-stack-foundation-2026-10-30`

## Decision rules
- One row per exact manufacturer + model/SKU + hardware revision + radio variant.
- A brand-level or family-level claim is insufficient where approval applies to a particular model.
- `Unknown`, `Not checked`, and `Evidence unavailable` are valid statuses; never convert them to `Pass`.
- Record official source, exact document title/revision, retrieval date, relevant scope/clause, reviewer and immutable evidence location.
- Any change to model, radio module, firmware, enclosure, intended use or installation environment triggers applicability review.
- “Indian-made”, “MeitY-approved”, “BIS-certified”, “legal-metrology compliant”, “industrial grade” and “MRV eligible” must each be supported independently; none implies the others.

## Register
| Field | Required content |
|---|---|
| Register ID | Unique identifier |
| Function / monitoring parameter | Why this component is needed and which approved workflow/methodology parameter it supports |
| Criticality class | A: critical/regulated measurement; B: industrial process monitoring; C: auxiliary/prototype |
| Manufacturer and exact SKU | Model, hardware revision, radio variant and firmware where relevant |
| Design / manufacture / assembly origin | Separate factual statements; list evidence and country for each |
| Interface and protocol | Electrical interface, register map/protocol version, units and isolation requirements |
| Measurement specification | Range, accuracy, resolution, response time, uncertainty and environmental limits |
| Calibration / traceability | Certificate, reference standard, due date, provider and traceability chain |
| Legal metrology applicability | Applicable rule/category, authority decision and evidence; mark not applicable only with rationale |
| BIS / CRS / IS applicability | Scheme, exact model match, registration/certificate and validity where applicable |
| WPC / ETA applicability | Radio module/model match, band, antenna and approval evidence where applicable |
| TEC / MTCTE applicability | Equipment category, notification and status where applicable |
| Electrical safety / EMC / ingress | Applicable standard and test evidence for the installation |
| Environmental / hazardous-area suitability | IP/IK, temperature, vibration, chemical exposure, hazardous-area certification if required |
| Cybersecurity | Secure boot, signed updates, credentials, vulnerability policy, SBOM, TLS and key-management evidence |
| Manufacturer support | Warranty, lifecycle, spare availability, end-of-life notice and service response |
| India value-add | Indian design, firmware, PCB, assembly, enclosure, testing, integration and service evidence separately |
| Cost and procurement | Quote date, unit price, taxes, landed cost, MOQ, lead time, spares and recurring charges |
| Intended sites | Site/process and environmental conditions |
| Evidence links | Official documents and internal evidence artifact paths |
| Reviewer / review date | Named reviewer and date |
| Decision | Proposed / Evidence pending / Rejected / Conditionally accepted / Accepted for bench / Accepted for field / Released for defined use |
| Conditions and expiry | Conditions, review date, expiry and change triggers |

## Required decision gates
1. **G0 Applicability:** use-case and monitoring parameter approved.
2. **G1 Document match:** official documents match exact SKU/revision and intended use.
3. **G2 Compliance review:** applicable certification, metrology, telecom/radio, safety, environmental and procurement obligations resolved.
4. **G3 Technical qualification:** measurement and interface specifications satisfy documented targets.
5. **G4 Bench validation:** test evidence reviewed; no unexecuted test is treated as passed.
6. **G5 Field acceptance:** commissioning, parallel observation and uncertainty/exception analysis accepted.
7. **G6 Release:** named approver authorizes a bounded use, site scope, firmware/configuration and maintenance plan.

## Initial candidate families to evaluate (not approvals)
- Industrial PLC/RTU and gateway class for continuous-duty facilities.
- ESP32-class development boards only for non-critical prototype/auxiliary telemetry pending qualification.
- Load-cell + amplifier modules only for prototypes; any transaction/legal weighing function must use a suitable compliant weighing instrument/system.
- Weighbridge indicator interfaces and ticket/transaction reconciliation.
- Flow, pressure, temperature and gas-analysis instrumentation only when justified by an approved monitoring plan.
- Industrial energy meter outputs, isolated pulse inputs and Modbus interfaces.
- GNSS/NavIC-capable telemetry where location is operationally necessary and lawful.
- Power supplies, surge protection, UPS/battery, enclosure, isolation, antenna and cellular modules treated as part of the system qualification.

This list is a planning taxonomy, not a recommended bill of materials. No exact SKU is selected until requirements and authoritative evidence are reviewed.
