# Site Operator Evidence Request — RupayKg Hardware Readiness

**Reference:** RUPAYKG-SITE-EVIDENCE-REQUEST-2026-10-26  
**Site under consideration:** SITE-JBP-01 / Kathonda, Jabalpur (confirm facility and authorized operator before use)  
**Purpose:** Establish the actual operating process, approved MRV boundary and existing instrument interfaces before any RupayKg hardware selection or purchase.

## Request to the authorized site/operator

RupayKg is preparing a no-cost-first technical compatibility assessment. Please share the following information for the facility and process that are actually within the proposed project boundary. Share only information you are authorized to disclose. Do not send passwords, API keys, private keys, personal identification documents or unrelated confidential data.

### 1. Confirm the project and operating process
- Legal entity operating the relevant facility and the authorized technical contact.
- Facility name/address and the exact process proposed for MRV (e.g., waste-to-energy incineration, landfill-gas recovery, composting, biomethanation/CBG, weighbridge/material recovery).
- Whether the process is currently commissioned and operating; provide dated commissioning/operation evidence.
- Proposed project boundary, start date, applicable methodology/version and evidence of eligibility/registration, if available.
- Written permission for any site visit, interface inspection or data connection.

### 2. Existing equipment inventory
For every sensor, analyser, meter, weighbridge, PLC, SCADA system, controller, gateway or data logger that may be relevant:
- Manufacturer, exact model/SKU/revision and asset ID.
- Nameplate photograph (serial number may be masked in a broadly shared copy).
- Official datasheet, installation/communication manual and firmware revision.
- Available interface/protocol and official register map/API documentation.
- Parameters measured, units, normal operating range, accuracy/resolution and sampling interval.
- Current calibration certificate, calibration due date, uncertainty and traceability, where applicable.
- Product-specific approval/certification records and official verification source, where applicable.
- Firmware support/update policy and security documentation.
- Existing data-export route, gateway and any license or recurring fee.
- Whether the device is already owned/installed and available for reuse.

### 3. Existing system integration
- Existing PLC/SCADA/vendor platform and data-export options.
- Whether a read-only export or isolated test feed can be provided.
- Supported offline buffering/retry behaviour and source timestamp/quality flags.
- Any safe test environment or sample payload with credentials and personal data removed.

### 4. How to submit
Use the companion file docs/SITE_INSTRUMENT_HARDWARE_EVIDENCE_INTAKE.md to record one row per device. Provide official documents or authorized repository references. Keep credentials out of GitHub and ordinary email.

## What RupayKg will do with the evidence
1. Confirm the actual project boundary and methodology before selecting measurement parameters.
2. Check whether existing equipment and interfaces can be reused with the current RupayKg field-sync, evidence-vault and MRV paths.
3. Evaluate no-cost software/toolchain/simulation options first, including SHAKTI or VEGA/ARIES only if they fit a demonstrated requirement.
4. Record compliance gaps, test criteria, lifecycle costs and the reason for any proposed paid option.
5. Keep all hardware at HOLD until exact-model and applicable compliance/calibration evidence is reviewed. No purchase or paid activation occurs without explicit approval.

## Important boundaries
- This request is not a claim that a physical site inspection has occurred.
- Do not assume that a waste-to-energy facility has an active landfill-gas recovery system. BM WA03.001 applicability must be established for the actual project boundary; a proposed Bio-CNG project is not treated as operating without evidence.
- MeitY approval must be verified for the exact model and applicable route; a generic manufacturer statement, processor architecture or Indian-origin claim is insufficient.
- A gateway's identity does not establish a measuring instrument's calibration or accuracy.
- Synthetic prototype data must never be represented as real site measurements or stored as physical evidence.
- No hardware purchase, subscription, paid API, cloud billing activation, site connection or production deployment is authorized by this request.

**Decision until the required evidence is reviewed:** HOLD_FOR_EVIDENCE.

**Shakti Standards:** ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.
