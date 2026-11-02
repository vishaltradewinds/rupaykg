# RupayKg Free-First, Viability-Gated Hardware Procurement

**Record:** RUPAYKG-HW-PROC-2026-10-26-01  
**Status:** Mandatory decision policy; not a purchase order or approved-vendor list  
**Applies to:** RupayKg Carbon OS hardware, instruments, IoT, firmware, SDKs, cloud services and specialist testing  
**Standard:** Shakti Standards  
**Current procurement decision:** HOLD until exact use case, candidate model and evidence are known

## 1. Mandatory rule

> **Use free or already-available suitable options first. Pay only when a free/reused option is unavailable or demonstrably inadequate for a mandatory requirement, and the paid alternative is reasonably viable. Never compromise measurement integrity, safety, security or legal compliance to save money.**

This policy permits paid options when justified, but it does not authorize purchases, subscriptions, paid API calls, cloud billing activation, supplier commitments or custom hardware.

## 2. Required decision gates

Every proposed purchase or paid dependency must pass all gates:

1. **Need established:** State the actual site workflow, intended measurement, methodology parameter and required capability.
2. **Reuse checked:** Inspect existing RupayKg code/services, site instruments, available gateways and existing infrastructure before adding a dependency.
3. **Free options searched:** Check suitable open-source software, SDKs/toolchains, protocols, simulation, public documentation, research resources and available government options.
4. **Suitability evidenced:** Check exact compatibility, support, licence, security, reliability, performance, calibration, certification and maintenance. Open-source or free access alone does not establish suitability.
5. **Gap documented:** Explain why each free/reused option cannot satisfy a mandatory requirement. Convenience alone is not sufficient justification.
6. **Paid alternatives compared:** Obtain dated prices/quotes where feasible; compare at least two viable choices when the market permits. Explain any single-source exception.
7. **Lifecycle cost calculated:** Include purchase, integration, freight/tax, licences, connectivity, cloud usage, calibration, certification, support, spares, maintenance and replacement.
8. **Viability recorded:** Document expected benefit, acceptance criteria, lifecycle cost, supplier support, lock-in, schedule and exit plan.
9. **Explicit approval obtained:** No purchase, paid service, cloud billing activation or supplier commitment without the user's explicit approval of purpose and cost.
10. **Reassessment planned:** Revisit paid dependencies if a suitable free alternative appears or the use case changes.

If costs, availability, licensing or applicable compliance evidence are unknown, record them as unknown and HOLD; do not invent prices or assume approval.

## 3. Free-first selection order

1. Existing RupayKg capability and equipment already available at the site.
2. Source inspection, public documentation, local tests and no-cost simulation.
3. Maintained open-source software, protocol implementations, SDKs and toolchains after licence/security review.
4. Suitable no-cost public/research resources, if access and use terms are confirmed.
5. Compatible existing instruments/controllers already installed or owned.
6. Paid off-the-shelf hardware or specialist services only if earlier options fail a documented requirement or verified lifecycle economics justify it.
7. Custom PCB/controller design only after a real interface need is proven; custom silicon is not in scope for the initial pilot without a separate evidence-backed decision.

A free option that cannot satisfy a mandatory security, accuracy, availability, safety or compliance requirement is not a suitable option.

## 4. Hardware candidates — evaluate, do not assume

| Candidate | Potential role | Required verification | Current decision |
|---|---|---|---|
| Existing site instrument and gateway | First choice where compatible; minimizes changes | Exact model, interface, protocol/register map, condition, calibration and applicable approval evidence | Inspect first; site inventory is not yet verified |
| C-DAC VEGA/ARIES | Indian processor/embedded development path | Exact board revision, current availability and price, drivers, licences, support, interfaces and product-specific compliance | Evaluate; no purchase approved |
| IIT Madras SHAKTI | Processor IP and possible embedded-controller path | Exact implementation/board, toolchain, peripherals, licence scope, availability, security and support | Evaluate; no production suitability assumed |
| Open-source RTOS/toolchain | Firmware on supported target | Exact board/driver support, maintenance, licence, update/security features | Candidate after target selection |
| Commercial industrial gateway | Practical option if reuse and open candidates fail requirements | Dated quote, exact datasheet/model, support lifecycle, interfaces, security and applicable conformity evidence | Paid only after comparison and approval |

Open-source processor IP is not the same as a free physical board. A development board is not automatically production hardware. Indian design/origin is not itself proof of MeitY approval or product certification.

Official starting points:
- SHAKTI: https://shakti.org.in/getting_started.html
- C-DAC VEGA: https://www.cdac.in/index.aspx?id=product_details&productId=VEGAMICROPROCESSORS
- C-DAC ARIES IoT v2.0: https://www.cdac.in/index.aspx?id=product_details&productId=ARIESIoTv2.0
- STQC IoT System Certification Scheme: https://stqc.gov.in/en/iot-system-certification-scheme-iotscs
- BIS compulsory certification: https://www.bis.gov.in/product-certification/products-under-compulsory-certification/
- MeitY: https://www.meity.gov.in/

Re-check the exact model, current official requirements, licence and availability at decision time.

## 5. MeitY and statutory applicability

Determine the actual route for the exact product, intended use, site and procurement context. Do not assume one universal MeitY certificate applies to every sensor, gateway, analyser, flow meter or weighbridge.

Where applicable, record evidence for MeitY orders and procurement terms; STQC IoT certification scope; BIS registration/standards or quality-control orders; WPC/DoT requirements for radio equipment; legal metrology for weighing instruments; electrical safety, EMC, environmental rating and calibration; firmware updates, vulnerability handling and product support.

Each requirement must be marked APPLICABLE_AND_EVIDENCED, NOT_APPLICABLE_WITH_RATIONALE, or BLOCKED_PENDING_EVIDENCE. A blocked mandatory prerequisite prevents production procurement/deployment until resolved. A vendor claim or design origin is not a substitute for an applicable certificate or official verification.

## 6. RupayKg measurement integrity

Do not create a second production database, evidence vault, sync platform or trust service. Reuse the canonical RupayKg device enrollment, authenticated offline sync, evidence vault and MRV path where compatible.

For each observation, preserve or link as applicable: exact device/instrument identity, model/serial, firmware and site; original payload/value/unit and normalized value/unit; adapter/parser version; source capture time and server receipt time; sequence/idempotency key and payload hash; calibration evidence and validity at event time where required; authorization, validation state, anomaly/quarantine reason and review history; methodology run/dataset association.

Reject or quarantine malformed, duplicate/replayed, unauthorized, out-of-range, unsupported-unit or untraceable observations. Missing/expired calibration must block downstream approval where required. A sensor reading alone is not a verified emission reduction or carbon credit.

## 7. Decision record template

Complete before any purchase or paid activation:
- Decision ID and date; site/workflow/methodology parameter.
- Exact item/model/version and intended function.
- Existing equipment/software checked.
- Free/reuse alternatives and evidence links.
- Specific mandatory requirements each alternative fails.
- Licence/commercial-use review.
- Paid alternatives and dated quotes.
- Upfront and recurring costs, billing triggers and currency.
- Integration, calibration, certification, support and maintenance costs.
- Applicable MeitY/STQC/BIS/WPC/legal-metrology evidence.
- Security/supply-chain risks.
- Measurable benefit and acceptance tests.
- Lifecycle/exit/replacement plan.
- Decision: FREE_OPTION / PAID_OPTION_JUSTIFIED / HOLD_FOR_EVIDENCE / NOT_REQUIRED.
- Explicit approver, scope and approved amount.
- Reassessment trigger/date.

## 8. Execution batches

**Batch 1 — Discovery, no purchase:** Identify actual site activity and MRV methodology; obtain exact installed instrument inventory, make/model, interface manuals, register map, calibration records and site permissions; compare reuse, SHAKTI, VEGA/ARIES and industrial gateway options; use source review and public documentation first.

**Batch 2 — Software-only prototype:** Use clearly labelled synthetic observations. Test schema, units, identity references, sequence/idempotency, duplicate/replay handling, missing calibration, offline queue/retry and quarantine behavior. Ensure test data cannot be represented as live site evidence. Avoid paid APIs/cloud activation.

**Batch 3 — Physical selection:** Choose the least costly option that demonstrably meets mandatory requirements. Record dated quote, total lifecycle cost and applicable product compliance. Obtain explicit approval before purchase.

**Batch 4 — Bench validation:** Test real device readings against a suitable reference, power/network failure recovery, data integrity, calibration linkage and security. Keep bench data separate from production MRV.

**Batch 5 — Controlled field pilot and release:** Require actual site/operator authorization, verified equipment and calibration evidence, methodology compatibility, acceptance tests and applicable approvals. Production release and continuous assurance remain separate gates.

## 9. Current site and methodology HOLD

The documented Kathonda site history describes a waste-to-energy mass-incineration operation; it does not by itself prove an active landfill-gas collection/recovery system within the proposed project boundary. Do not buy methane-recovery-specific instruments on the assumption that BEE BM WA03.001 applies. Confirm the actual project boundary, active process, operator authorization and methodology eligibility first. A proposed Bio-CNG project is not treated as operating without commissioning and eligibility evidence.

The exact site instrument inventory and model-specific approval/calibration packet have not been verified in this record. All candidate models remain HOLD.

## 10. Current decision and stop conditions

**Current decision: HOLD_FOR_EVIDENCE for physical hardware selection.**

Next action is no-cost discovery and a software-only synthetic-data prototype. Do not buy a board, commission custom hardware, activate a paid service or connect a production MRV workflow until the relevant gates are passed and the cost is explicitly approved.

**Shakti Standards principle:** ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.
