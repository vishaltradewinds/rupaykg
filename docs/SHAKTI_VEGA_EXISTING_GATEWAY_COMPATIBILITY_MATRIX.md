# RupayKg SHAKTI / VEGA / Existing Gateway Compatibility Matrix

**Status:** Preliminary desk review; candidate evaluation only  
**Date:** 2026-10-26  
**Procurement:** Not approved  
**Decision rule:** Free-first; pay only when no suitable free/reused option meets a documented mandatory requirement and the paid option is reasonably viable  
**Production posture:** HOLD pending exact site requirements, product evidence and applicable compliance checks

## 1. Purpose

Compare possible routes for RupayKg's hardware/IoT anchor without selecting a board before the pilot's measurement and interface requirements are known. Unknowns are marked VERIFY, not assumed to pass.

## 2. Candidate matrix

| Criterion | Existing site instrument + field terminal/gateway | C-DAC VEGA/ARIES development board | IIT Madras SHAKTI implementation/FPGA or board | Commercial industrial gateway/controller |
|---|---|---|---|---|
| Primary role | Lowest-change route to test an existing instrument interface | Indigenous processor evaluation and embedded prototype | Processor IP/implementation evaluation | Practical field interface and industrial integration |
| Cost to start | Lowest if suitable equipment is already available | Verify exact board stock and price; free documentation does not mean free board | Verify exact implementation, board and access costs | Quote required unless already available |
| Open-source/licence | Depends on installed device; verify | Processor, board and software licences vary; verify exact revision | SHAKTI processor IP is described as BSD-3-Clause; implementation, FPGA IP and board parts require separate review | Often mixed; verify firmware, SDK, licences and updates |
| Interface compatibility | Best chance if equipment is already installed; exact manual/register map required | UART/SPI/I2C/GPIO support does not prove a specific industrial protocol or driver | Depends on exact implementation and peripheral set | Often broad; exact ports and protocols must be verified |
| Production maturity | Existing operational device may be mature; condition and suitability still need evidence | Development board is not automatically production hardware | Research/challenge implementation is not automatically production hardware | Model-specific industrial product may be field-ready subject to qualification |
| Security/update support | Verify device identity, credentials, firmware updates and vendor policy | Review secure boot, key storage, debug lock, patching and toolchain maturity | Review exact implementation; RISC-V alone does not guarantee security | Verify support lifecycle, patch policy, key storage and supply-chain evidence |
| Calibration/legal metrology | Depends on actual measuring instrument and use | Controller does not certify sensor/weighbridge | Controller does not certify sensor/weighbridge | Gateway does not certify sensor/weighbridge |
| MeitY/STQC/BIS/WPC | Depends on exact product and deployment | Product-specific applicability must be established | Product-specific applicability must be established | Exact model/use-case evidence required |
| RupayKg sync integration | Reuse existing field-sync contract where compatible | Adapter/firmware plus validation required | Adapter/firmware plus validation required | Adapter/gateway service plus validation required |
| Offline resilience | Depends on terminal/gateway and durable queue | Must implement and test | Must implement and test | Verify documented storage/recovery and test |
| Evidence currently available | Canonical device enrollment, authenticated offline sync, evidence vault and MRV paths exist in source; actual site device remains unidentified | Official product information exists; exact board revision, availability, cost, drivers and support remain to be verified | Official documentation exists; exact board/implementation, availability, cost and peripheral path remain to be verified | No model selected; no quote or datasheet reviewed |
| Initial decision | **Inspect first** | **Evaluate** if processor experimentation is useful after requirements are known | **Evaluate** as an indigenous processor path, not default production choice | **Fallback** only if reuse/open candidates fail requirements |
| Purchase gate | No purchase if existing equipment is compatible | Exact model/price, requirements, licence and compliance review first | Exact implementation/board, price, support and compliance review first | Document free/reuse alternatives and lifecycle cost; obtain explicit approval |

## 3. Current decision

**Physical board selection: HOLD_FOR_EVIDENCE.**

1. Confirm the actual Kathonda/Jabalpur project boundary, operator permission and intended MRV methodology. Site history documents a waste-to-energy mass-incineration operation; it does not prove an active landfill-gas collection/recovery system. Do not assume BM WA03.001 applies or buy methane-specific instruments on that assumption.
2. Obtain the actual installed instrument inventory, make/model, serial/asset reference, interface manual, register/protocol map, calibration records and relevant methodology parameters.
3. Reuse the existing instrument's supported interface and canonical RupayKg field-sync/evidence path if compatible.
4. Run the offline synthetic-data tests documented in docs/RUPAYKG_NO_COST_IOT_SIMULATION_RUNBOOK.md. Do not send synthetic readings to a live API or store them as site evidence.
5. Compare SHAKTI and VEGA/ARIES against actual interface, timing, power, storage, security and support requirements.
6. Consider a paid industrial gateway only if reuse/open candidates fail a documented requirement or a costed lifecycle comparison justifies it. Explicit approval is required before purchase or paid activation.

## 4. Evidence checklist

For every candidate capture official datasheet/manual revision; exact model/SKU; dated availability/quote or no-cost access evidence; processor, memory, storage, interfaces and voltage levels; driver/toolchain/SDK support and maintenance; licence terms for IP, board design, firmware, SDK and dependencies; security/update policy; operating environment, power and enclosure/IP rating; warranty, spares, lead time and service; design/manufacturing origin and local-content evidence where relevant; product-specific applicable MeitY/STQC/BIS/WPC/legal-metrology evidence; test plan, acceptance thresholds, reviewer and date.

## 5. No-cost prototype acceptance

- Parse a versioned observation contract using synthetic data only.
- Preserve original value/unit, source time, sequence and raw payload hash.
- Reject malformed data and invalid units.
- Detect duplicate/replayed event IDs and sequences where the application contract supports it.
- Require explicit instrument identity and parameter code for measurements.
- Block observations with missing/expired calibration when calibration is required.
- Simulate offline queue, reconnect and idempotent retry without production credentials.
- Demonstrate that unregistered or pending instruments cannot create eligible MRV measurements.
- Keep synthetic data clearly separate from physical site evidence.

Passing these software tests does not prove sensor accuracy, hardware compatibility, certification, field acceptance or production readiness.

## 6. Official starting points

- SHAKTI: https://shakti.org.in/getting_started.html
- C-DAC VEGA: https://www.cdac.in/index.aspx?id=product_details&productId=VEGAMICROPROCESSORS
- C-DAC ARIES IoT v2.0: https://www.cdac.in/index.aspx?id=product_details&productId=ARIESIoTv2.0
- STQC IoT System Certification Scheme: https://stqc.gov.in/en/iot-system-certification-scheme-iotscs
- BIS compulsory certification: https://www.bis.gov.in/product-certification/products-under-compulsory-certification/

**No procurement, physical integration, production deployment or certification is implied by this matrix.**
