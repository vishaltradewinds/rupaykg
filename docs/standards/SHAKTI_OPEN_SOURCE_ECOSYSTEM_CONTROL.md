# RupayKg Shakti Standards — Open-Source Ecosystem Control

Status: MANDATORY ENGINEERING CONTROL

## 1. Purpose

RupayKg shall use open-source ecosystems as a controlled engineering input across the full lifecycle. Open-source reuse is not automatically approved merely because a component is public or free.

The governing rule is:

**ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.**

RupayKg remains a commercial innovation platform. It must not represent itself as a Digital Public Good or Digital Public Infrastructure merely because it uses open-source software, open standards or DPG/DPI ecosystems.

## 2. Reference ecosystem layer

The Shakti Standards reference layer shall continuously assess:

1. Digital Public Goods Alliance (DPGA) and DPG Standard
2. UN Innovation Network (UNIN)
3. FAIR Forward / BMZ open-data and responsible-AI ecosystem
4. Global DPI Repository and comparable DPI reference implementations
5. relevant Indian DPI/open-source ecosystems
6. RISC-V and Indian open processor ecosystems, including SHAKTI where technically appropriate

These are **reference ecosystems, not governing statutory standards**. Their patterns, components and lessons may inform engineering decisions but never override Indian law, regulator directions, contractual obligations, security controls or project-specific evidence.

The DPGA Standard provides useful criteria around open licensing, ownership, platform independence, documentation, data extraction, privacy/law, standards and security; these are treated as assessment inputs, not a claim that RupayKg qualifies as a DPG. 

## 3. Mandatory reuse assessment

Every candidate open-source component must pass an OSS/Digital-Ecosystem Record before adoption:

- component and exact version
- repository/source
- license and compatibility
- provenance
- maintainer/community health
- security/advisory status
- dependency graph
- data/privacy implications
- interoperability/API standards
- offline/edge suitability where applicable
- Indian regulatory suitability
- support/exit strategy
- ability to fork/replace
- evidence of production use where relevant
- test/verification evidence
- commercial-use restrictions, if any

No "latest" or unpinned dependency is acceptable for a controlled production baseline.

## 4. Open-source selection hierarchy

Prefer, in order:

1. open standard/protocol
2. mature open-source implementation with compatible license
3. Indian/open ecosystem implementation with demonstrable fit
4. actively maintained interoperable alternative
5. proprietary component only where an evidence-based requirement cannot reasonably be satisfied otherwise

This is a preference hierarchy, not an absolute prohibition on proprietary components.

## 5. Hardware + software

The same assessment applies to field hardware.

For an edge controller, processor, firmware, driver, RTOS, protocol library or sensor gateway, record:

- hardware/firmware identity
- source availability where claimed
- license
- toolchain
- processor/ISA
- driver provenance
- security update path
- supply continuity
- interface compatibility
- calibration/instrument dependency
- environmental qualification
- Indian regulatory/certification requirements
- replacement path

SHAKTI is an eligible reference option for the indigenous/open hardware track because the IIT Madras SHAKTI ecosystem is open-source and RISC-V based; however, a SHAKTI processor or board must not be selected for field deployment until the exact SoC/board, interfaces, performance, environmental and certification requirements are proven for the RupayKg use case.

## 6. Software architecture rule

Open-source components shall be isolated behind stable RupayKg interfaces wherever practical.

The application owns:

- tenant authority
- identity and authorization
- evidence lineage
- MRV semantics
- regulatory controls
- auditability
- lifecycle state
- data retention
- operational assurance

An upstream open-source dependency must not become the implicit authority for these controls.

## 7. Evidence and traceability

For each adopted component maintain:

`component -> version -> license -> source -> security evidence -> test evidence -> deployment evidence -> owner -> replacement path`

For field data:

`instrument -> edge identity -> raw reading -> canonical measurement -> evidence -> MRV calculation -> audit event`

No transformation may erase provenance.

## 8. Responsible AI

Where AI/ML/open models are used:

- model identity and version are pinned
- model/data provenance is recorded
- licensing is reviewed
- privacy and sensitive-data handling are reviewed
- evaluation datasets and known limitations are recorded
- deterministic/non-deterministic behavior is documented
- human/operational review boundaries are explicit
- AI output cannot silently become statutory evidence

## 9. Shakti lifecycle gates

Open-source assessment is required at:

**Discovery -> Feasibility -> Architecture -> Component selection -> Engineering -> Security -> Integration -> Verification -> Field validation -> Deployment -> Operations -> Continuous assurance**

A component that passes discovery can still fail a later gate.

## 10. Prohibited shortcuts

- copying code without license review
- using an unpinned dependency in production
- equating "open source" with "secure"
- equating "DPG" with "DPI"
- equating open hardware with certified hardware
- treating community documentation as calibration/certification evidence
- replacing statutory requirements with ecosystem guidance
- claiming TRL 9 from software completion alone

## 11. Decision record

Each important adoption decision shall answer:

**Why this component? What evidence supports it? What are its legal/security/operational risks? What is the fallback? How will we know it remains fit for purpose?**

This record becomes part of the Shakti evidence chain.
