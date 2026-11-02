# RupayKg Open-Source Hardware Stack Evaluation

**Status:** Research and engineering requirements only. No candidate in this document is approved for production, and this document does not authorize purchases, paid services, merging, deployment, or field installation.

**Governing standard:** Shakti Standards. Complete the requirements, evidence, compliance, feasibility, validation, testing, approval, deployment and ongoing assurance gates. Do not treat an open-source licence or project affiliation as proof of product safety, metrology suitability, certification or reliability.

## 1. AIM

Identify open-source building blocks that may reduce vendor lock-in and development cost for RupayKg's edge collection and hardware trust architecture, without replacing qualified measurement instruments or the existing authoritative RupayKg ingestion, evidence-vault and MRV paths.

## 2. Reference architecture

1. **Physical measurement:** facility-specific scales/weighbridges, meters, flow instruments, gas analysers and other instruments required by the actual process and methodology.
2. **Electrical interface:** model-specific interface and isolation/protection appropriate to the instrument manual and site environment.
3. **Edge compute:** MCU/RTOS for constrained deterministic collection, or Linux gateway for multi-protocol, storage and networking needs. A SHAKTI/RISC-V board is one candidate, not a default.
4. **Local trust controls:** source identity, parameter/unit checks, sequence and timestamp-quality metadata, offline buffering, duplicate/replay protection, power-loss recovery and authenticated synchronization.
5. **RupayKg ingestion:** use the existing device/instrument registry and API; no parallel production ingestion path.
6. **Evidence and MRV:** existing evidence vault, approval gates, methodology-specific calculations, review and controlled submission.

A gateway's approval does not imply that an attached instrument is approved. The processor, board, finished gateway, measurement instrument and installed system are separate qualification subjects where applicable.

## 3. Open-source candidate catalogue

| Stack layer | Candidate | Potential fit | Required qualification / limitation |
|---|---|---|---|
| Processor ecosystem | [SHAKTI](https://shakti.org.in/) | Domestic RISC-V research and potential embedded compute | Verify exact SoC/board availability, SDK, drivers, lifecycle, licences, interfaces and applicable product requirements. MeitY sponsorship of a program is not blanket approval of every board or use. |
| RISC-V prototyping | [BeagleV-Fire](https://docs.beagleboard.io/boards/beaglev/fire/index.html) | RISC-V plus FPGA prototyping | Verify current availability, OS/driver support, power and thermal needs; development board is not assumed industrial-rated. |
| Open board designs | [BeagleBoard documentation](https://docs.beagleboard.org/boards/beagleboard/index.html) | Compare available Linux/embedded boards and published design material | Select only an actively supported exact model and check hardware licence, lifecycle and supply. |
| MCU firmware | [Zephyr RTOS](https://www.zephyrproject.org/) and [supported boards](https://docs.zephyrproject.org/latest/boards/) | Small deterministic peripheral-facing nodes | Confirm exact board support, driver maturity, security features, update path and support period. |
| Embedded boot/update | [MCUboot](https://docs.mcuboot.com/) | Secure boot/update workflow on supported targets | Depends on platform integration and key management; not every security property is automatically enabled. |
| Linux boot | [U-Boot](https://docs.u-boot.org/) | Boot chain on supported SoCs | Platform-specific support and hardening must be demonstrated. |
| Hardware trust research | [OpenTitan](https://opentitan.org/book/) | Reference design for root-of-trust concepts | Research/design reference, not a drop-in certified security module for this deployment. |
| Industrial messaging | [Eclipse Mosquitto](https://mosquitto.org/) | MQTT where useful | Broker is not a device identity, authorization or MRV-evidence system. Configure TLS/authentication and operations securely. |
| Edge framework | [Eclipse Kura](https://eclipse.dev/kura/) | Edge device integration where platform-supported | Evaluate compatibility, support and operational complexity before adoption. |
| Industrial edge middleware | [EdgeX Foundry](https://www.edgexfoundry.org/software/platform/) | Modular industrial edge middleware with device services such as Modbus, MQTT, BACnet and REST | Strong candidate for a lab comparison if multiple protocols are needed; may be heavier than a single-purpose gateway. Do not let its registry/storage become a competing authoritative MRV system. |
| Flow-based integration | [Node-RED](https://nodered.org/about/) | Lightweight visual flow orchestration and integration prototyping | Useful for rapid, inspectable prototypes; operational flows need version control, access controls, controlled deployment and validation. Not a safety controller or MRV authority. |
| Embedded network OS | [OpenWrt](https://openwrt.org/docs/start) | Embedded Linux for supported networking/router hardware | Candidate for network segmentation, VPN and gateway networking where exact-device support and lifecycle fit; not a measurement registry or industrial control system. |
| Local buffering | [SQLite](https://sqlite.org/) | Small local store-and-forward queue | Define encryption/access, bounded storage, crash recovery, retention and replay protection. |
| Industrial protocol | [Modbus specifications](https://www.modbus.org/modbus-specifications) | Interoperability with instruments that support Modbus | Match exact protocol variant/register map, unit scaling, byte order, timeouts and electrical interface to instrument documentation. |
| PCB design | [KiCad](https://www.kicad.org/) | Custom interface/gateway PCB if justified | Retain editable sources, schematic, PCB, BOM, revision history, manufacturing files and component licence/provenance. |
| Open hardware discovery | [OSHWA definition](https://oshwa.org/definition/) and [certified project directory](https://certification.oshwa.org/directory.html) | Discover open design files and licensing | OSHWA status is not statutory product approval, calibration or industrial qualification. |

Reference gateway projects for design study only: [COG1](https://github.com/diegodemarco/cog1) and [Industrial IoT Gateway](https://github.com/alexandru-vrabete/Industrial_IoT_Gateway). They are not prequalified for RupayKg or a specific site.

## 4.1 Mandatory MeitY approval rule

RupayKg's hardware selection rule is a hard gate: **use only an exact hardware model for which the applicable MeitY approval/recognition is verified for the intended product and use, in addition to every other legally required approval.** A MeitY programme affiliation, domestic origin, open-source licence, generic manufacturer claim or approval for a different model/use does not satisfy this gate.

If a measurement instrument, gateway, interface or board has no applicable MeitY approval scheme or no verifiable exact-model evidence, mark it **BLOCKED — MEITY APPROVAL NOT VERIFIED** and do not purchase, install or use it in the project. Do not silently substitute CE, FCC, OSHWA status, BIS registration, a laboratory certificate or another authority's approval for the required MeitY gate. Record the exact evidence and the authority/scope; escalate a genuine scheme-coverage gap for an explicit policy decision rather than bypassing the rule. Additional statutory/metrology/sector approvals remain mandatory where applicable.

## 4. Measurement hardware is a separate qualification stream

Do not select a sensor before identifying the physical parameter, range, accuracy, resolution, response time, operating environment, calibration and methodology requirements.

Candidate instrument categories may include:
- Weighbridge/industrial scale for mass balance.
- Electricity meter for energy.
- Flow meter for a specified liquid or gas.
- Gas analyser for the gases and concentration range actually required.
- Temperature, pressure, level or water-quality instruments where the process and approved monitoring plan require them.

This list is not a procurement specification. No open-source hobby sensor may replace a required industrial/metrology instrument unless its exact suitability and applicable approvals are demonstrated.

## 5. Required qualification matrix

For every exact instrument, board and finished gateway, record:

- Function and intended-use boundary.
- Manufacturer, exact model, revision, supplier and serial/identity scheme.
- Hardware design and firmware/software licences, including third-party IP.
- Availability, lifecycle, patch policy, warranty and support.
- CPU/ISA, memory, storage, watchdog, clock and power/thermal limits.
- Required UART/RS-232/RS-485, Ethernet, SPI, I²C, CAN or other interfaces.
- OS/RTOS, driver and protocol implementation evidence.
- Electrical isolation, surge/ESD, EMC, enclosure and environmental ratings.
- Secure boot/update support, key storage, debug-port controls and vulnerability response.
- Offline queue limits, timestamp quality, sequence monotonicity, duplicate/replay handling and power-loss recovery.
- Applicable statutory, sector, metrology and conformity requirements; verify exact-model evidence and intended use. Never infer approval from a project sponsor or country of origin.
- Calibration/verification requirements for measurement instruments.
- Bench tests, hardware-in-loop tests, field acceptance criteria and failure recovery.
- Total cost: device, interfaces, power, enclosure, installation, calibration, integration, maintenance and support.

Unknown or unverified fields must be marked **OPEN / NOT VERIFIED**, not guessed.

## 6. Candidate scoring rubric

Score each candidate from 0 to 5 only when evidence supports the score; use **U (unverified)** where evidence is missing. Do not convert unknowns to zero or present a false ranking.

| Criterion | Weight |
|---|---:|
| Exact applicable approval/conformity evidence | Gate (must pass) |
| Instrument/protocol compatibility and driver maturity | 20% |
| Security, updates and device lifecycle | 20% |
| Reliability, environmental fit and recovery | 20% |
| Total lifecycle cost | 15% |
| Availability, maintenance and support | 10% |
| Open design/licence and portability | 10% |
| Integration effort and testability | 5% |

A failed mandatory gate disqualifies the candidate for that intended use regardless of weighted score. Scores are only meaningful after the actual facility requirements are known.

## 7. Shakti Standards gates

- **Gate 0 — Context:** establish real facility process, methodology applicability, parameters, environment and operating constraints.
- **Gate 1 — Evidence review:** collect official product manuals, licences, support/lifecycle and exact-model approval evidence. No purchase.
- **Gate 2 — Software simulation:** synthetic data only, isolated from live/staging MRV and registry paths.
- **Gate 3 — Bench feasibility:** only after explicit authorization and equipment access; test actual interfaces, malformed values, disconnection, clock drift, duplicates/replay, power loss and recovery.
- **Gate 4 — Field qualification:** installation, safety review, calibration/verification where required, commissioning and controlled pilot.
- **Gate 5 — Release assurance:** security, reliability, compliance, data lineage and MRV acceptance; define maintenance and monitoring.
- **Gate 6 — Operations:** patching, calibration renewals, device replacement, incidents, audit and continuous assurance.

No later gate can compensate for a failed earlier gate. Passing software CI does not certify physical hardware.

## 8. RupayKg integration rules

- Preserve existing `field_devices`, MRV instrument registry, approval controls, field-sync/offline sync, evidence vault and MRV routes.
- Unknown, unapproved, expired, mismatched or evidence-stale instruments remain ineligible for authoritative MRV.
- A synthetic test must remain clearly labelled and registry-ineligible.
- Do not infer instrument identity or physical origin from free-text labels.
- Keep measured, estimated, derived, missing and rejected values distinguishable.
- Do not claim calibration, certification, site commissioning or real field validation without source evidence.
- Do not purchase, incur paid-service costs, merge or deploy without explicit authorization.

## 9. Immediate next actions

1. Complete the [SITE-JBP-01 measurement requirements register](SITE_JBP_01_MEASUREMENT_REQUIREMENTS_REGISTER.md). It is an evidence-intake template; all site/process facts remain unverified until supported by operator records and official evidence.
2. Obtain a facility process/measurement specification for the pilot site before finalizing instrument categories.
3. Inspect official SHAKTI and candidate board documentation for exact supported board/SoC, toolchain, interfaces and lifecycle.
4. Select one no-cost software prototype target only after verifying its current toolchain and support; simulate the data contract without live MRV submission.
5. Build an evidence-backed comparison using the rubric above. Keep unknowns open.
6. Request real instrument manuals and interface details from the site/operator before any bench design.
7. Proceed to physical hardware only after the user explicitly authorizes any required expenditure and the applicable qualification gates are passed.

## 10. Current decision

**Preferred architecture:** modular and vendor/processor-neutral. Keep qualified instruments separate from edge compute; evaluate SHAKTI alongside suitable open-hardware boards and MCU/Linux gateway options. No processor or sensor is selected or approved by this document.
