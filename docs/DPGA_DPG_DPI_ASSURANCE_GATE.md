# DPGA DPG / DPI Alignment Assurance Gate

**Control owner:** RupayKg engineering governance  
**Assessment date:** 2026-11-07  
**Assessment type:** Internal desk assessment against public DPGA material; not a DPGA review or recognition decision  
**Status:** OPEN — readiness work only; nomination is not authorised by this assessment

## 1. Purpose and hierarchy

This document adds a Digital Public Goods Alliance (DPGA) assurance track to Shakti Standards. It does not replace the Shakti lifecycle, the RupayKg production gate, statutory/regulatory controls, independent security review, field acceptance, or TRL assessment.

Apply the following distinctions:

1. **Public technology** is a reusable technical building block such as a protocol, standard, API, software component or platform.
2. **Digital Public Good (DPG)** is a qualifying digital solution that has satisfied the DPGA DPG Standard and has been recognised through the DPGA review process.
3. **Digital Public Infrastructure (DPI)** is a wider institutional, governance, operational and ecosystem arrangement. A DPG can be used to build DPI; a DPG is not automatically DPI.
4. **DPGA DPG recognition** assesses the nominated core solution. It does not certify every local deployment, prove statutory approval, or confer regulator accreditation.
5. **DPGA DPI collection inclusion** is a separate, additional assessment beyond DPG recognition.

No RupayKg product, package, repository, deployment or organisation may claim DPG recognition, DPI status, DPGA approval, government endorsement or certification unless the relevant external decision and scope are evidenced.

## 2. Reference framework

Use the following sources as separate, complementary references:

- DPGA DPG Standard: https://www.digitalpublicgoods.net/standard
- DPGA DPGs for DPI collection and criteria: https://www.digitalpublicgoods.net/dpgs-for-dpi
- DPGA application FAQs and review process: https://www.digitalpublicgoods.net/digital-public-goods/faqs
- RIS, *Foundations of Digital Public Infrastructure* (Rajeev Chawala and Arun Iyer, 2025), particularly the four-layer ecosystem, DPI Sutras, techno-legal governance, and public-tech/DPG/DPI distinction.

The DPGA DPG Standard is the recognition baseline. The RIS handbook is a conceptual and institutional architecture reference. Shakti Standards remains the controlling lifecycle and assurance system for this repository.

## 3. DPGA DPG Standard — nine indicator groups

Every nominated solution must be assessed against all nine indicator groups. Indicator 9 contains three distinct sub-indicators; do not collapse or omit them.

| Indicator | Requirement | Evidence required before a pass can be recorded |
|---|---|---|
| 1. SDG relevance | Credible contribution to at least one Sustainable Development Goal | Defined outcome pathway, intended beneficiaries, measurable indicators, and evidence supporting the claimed contribution |
| 2. Open licensing | Appropriate approved open licence for the nominated digital-good type | Explicit licence file and notices; licence compatibility review for all included code, data, models, content and dependencies |
| 3. Clear ownership | Clear ownership and accountable stewardship | Copyright/IP ownership records, contributor rights, maintainer/steward identity, governance and contact mechanism |
| 4. Platform independence | No unavoidable restrictive proprietary dependency, or a documented open alternative/interface meeting the standard | Dependency and hosting inventory; portability proof; open interfaces; reproducible deployment or supported alternatives |
| 5. Documentation | Sufficient technical, operational, user and/or developer documentation | Public installation, configuration, API, data model, user, developer, security and maintenance documentation as applicable |
| 6. Mechanism for extracting data | Non-PII data can be extracted/imported using appropriate mechanisms and formats | Documented export/import contract, open formats and tests proving non-PII portability without exposing tenant or personal information |
| 7. Privacy and applicable laws | Respect for privacy and applicable legal requirements | Data inventory/classification, purpose and retention rules, privacy analysis, legal applicability review, safeguards and incident process |
| 8. Standards and best practices | Relevant open standards and accepted best practices are followed | Standards register, versioned conformance statements, interoperability tests, accessibility/security practices where applicable |
| 9A. Data privacy and security | Risks to data privacy and security are mitigated | Threat model, secure defaults, access boundaries, vulnerability process, secrets handling, auditability and test evidence |
| 9B. Inappropriate and illegal content | Risks from inappropriate or illegal content are addressed | Applicability decision, content controls and moderation/reporting process where the solution accepts or distributes user content |
| 9C. Protection from harassment | Risks of harassment and abuse are addressed | Applicability decision, abuse/reporting controls and user-protection process where the solution enables interaction or user-generated content |

**Internal assessment rule:** use PASS, PARTIAL, BLOCKED, NOT ASSESSED, or NOT APPLICABLE — JUSTIFICATION REQUIRED. A missing evidence item is not a pass. Do not publish an aggregate percentage that obscures a failed or unassessed mandatory indicator.

## 4. Additional DPGA DPI collection requirements

The DPGA DPI collection requires three layers:

### Layer 1 — Recognised DPG

The nominated solution must already have passed the DPG Standard and be recognised as a DPG.

### Layer 2 — DPI relevance

The core capability must fit at least one DPGA DPI domain, be reusable across sectors, and be designed for population-scale use.

The DPGA collection currently identifies these domains:

- Digital identity
- Digital payments
- Data exchange
- Registries
- Trust infrastructure

For an environmental MRV component, possible fit is to be tested against **registries**, **data exchange**, or **trust infrastructure**. Environmental MRV is not to be represented as a separate DPGA DPI domain unless the DPGA formally defines it as one. Climate relevance can also be assessed separately through the DPGA Climate Action collection: https://www.digitalpublicgoods.net/dpgs-for-climate-action

### Layer 3 — DPI architecture alignment

The DPGA collection describes the following architecture characteristics:

- Open specifications
- Modular building blocks
- Federated deployment
- Infrastructure-grade security

Evidence must show that the nominated component functions as shared infrastructure on which independent systems can build, rather than as a single closed application or a product-specific feature.

## 5. RIS DPI architecture crosswalk

The RIS handbook's four layers are to be used as an ecosystem design crosswalk, not as a substitute for DPGA recognition:

| RIS layer | RupayKg assurance questions |
|---|---|
| 1. Public Tech | Are the interfaces, schemas, protocols and reusable code documented and openly usable where claimed? |
| 2. DPI | Is there a defined platform boundary, operator, accountability model, service reliability model and lawful operating basis? |
| 3. DPI Network | Can independent participants integrate under transparent, fair and documented rules? |
| 4. Digital Economy | Are regulators, users, parallel networks, service providers and independent assurance roles properly distinguished? |

Apply the five DPI Sutras as assurance principles:

1. Citizen agency and privacy.
2. Interoperability.
3. Techno-legal regulation.
4. Prevention of monopolization.
5. Safeguards against weaponization.

For each Sutra, record a requirement, design control, test, operating owner and evidence reference. A policy statement alone is not implementation evidence.

## 6. Initial repository assessment — 2026-11-07

This is a repository-backed screening assessment of the proposed Open MRV Core boundary, not a formal DPGA eligibility result.

| Indicator / gate | Initial status | Current evidence or gap |
|---|---|---|
| 1. SDG relevance | PARTIAL | Waste/resource efficiency and climate-measurement outcomes may support relevant SDGs, but the candidate outcome model and measurable impact evidence are not yet defined |
| 2. Open licensing | BLOCKED | No root LICENSE/COPYING file was found; root and relevant workspace package manifests declare private true; no open licence grant was verified |
| 3. Clear ownership | NOT ASSESSED | Repository ownership is visible, but IP chain, contributor rights and stewardship governance for a separately nominated component are not evidenced |
| 4. Platform independence | NOT ASSESSED | The full platform has deployment and identity/provider configuration; a standalone candidate must have its own dependency inventory and prove it can operate without mandatory closed proprietary services |
| 5. Documentation | PARTIAL | Existing platform, MRV, registry, production and security documentation exists; standalone Open MRV Core API, install, developer and deployment documentation does not yet exist |
| 6. Data extraction | NOT ASSESSED | No standalone, tested non-PII export/import contract for the candidate has been evidenced |
| 7. Privacy and applicable laws | NOT ASSESSED | Platform controls exist, but candidate-specific data classification, privacy analysis and applicability evidence are not complete |
| 8. Standards and best practices | PARTIAL | TypeScript, API and structured-data foundations exist; a versioned public schema/standards register and conformance tests are not yet evidenced |
| 9A. Data privacy and security | PARTIAL | Existing platform security controls are relevant but cannot be inherited as proof for an unextracted component |
| 9B. Inappropriate and illegal content | NOT ASSESSED | Candidate scope and content-handling applicability have not been formally defined |
| 9C. Protection from harassment | NOT ASSESSED | Candidate scope and interaction/abuse applicability have not been formally defined |

**Current decision: NO-GO for DPGA nomination.** The open-licensing indicator is a direct blocker, and several other mandatory indicators remain unsupported by candidate-specific evidence.

**Current DPI collection decision: NOT READY.** The prerequisite DPG recognition is absent; cross-sector infrastructure relevance, population-scale design, open specifications, federation and independent security evidence are also not established for a separate Open MRV Core.

## 7. Shakti lifecycle gates for DPG readiness

| Gate | Required work | Exit evidence |
|---|---|---|
| DPG-00 — Scope | Freeze the nominated product boundary and exclude unrelated commercial platform functions | Signed scope and component inventory |
| DPG-01 — Rights | Establish copyright ownership, contributor rights, third-party notices and licence compatibility | IP/rights register and legal sign-off |
| DPG-02 — Licence | Select an appropriate approved open licence; add required licence and notice files only after authorised rights decision | Explicit licence, notices and dependency licence report |
| DPG-03 — Product independence | Remove mandatory closed services from the core candidate or document compliant open alternatives | Reproducible standalone build and dependency matrix |
| DPG-04 — Specifications | Publish versioned schemas, API contracts, data formats and compatibility rules | Public specifications and conformance fixtures |
| DPG-05 — Privacy and safety | Complete data classification, privacy analysis, threat model and Do No Harm assessment | Approved assessment and automated tests |
| DPG-06 — Documentation | Produce public installation, API, architecture, operations, developer and contribution documentation | Documentation completeness review |
| DPG-07 — Portability | Demonstrate non-PII import/export without bypassing tenant or access boundaries | Automated round-trip and negative privacy tests |
| DPG-08 — Independent review | Complete security, licensing and technical review | Findings register with closure evidence |
| DPG-09 — Nomination | Complete DPGA eligibility tool and submit an evidence-backed nomination | Submission record; later DPGA decision |
| DPI-00 — DPI assessment | Only after DPG recognition, assess DPI domain relevance and the four architecture characteristics | Separate DPI collection evidence package |

The DPGA FAQ states that applications are reviewed by two reviewers, may involve external experts, and a solution must pass all indicators to be recognised. The DPGA also states that DPG status is valid for one year and is reviewed again. Verify the current process before an actual submission.

## 8. Separation from production, regulatory and TRL gates

- DPG recognition is not statutory approval, environmental authorisation, CCTS methodology approval, ACVA validation, carbon-credit issuance, CPCB/EPR acceptance, security certification or TRL 9.
- The DPG Standard review focuses on the core solution; it does not evaluate each local implementation. Local production, field and regulatory acceptance remain separate Shakti evidence gates.
- No change to the existing production status, deployment status, database controls, release gate or TRL assessment is implied by this document.
- No production migration, tenant/RLS change, database mutation, credential change, release, deployment or external nomination is authorised by this assurance document.
- Do not introduce an open licence into the commercial repository or package without an explicit rights-holder decision and legal review.

## 9. Control and maintenance

Reassess this gate when the nominated boundary, licence, dependencies, data flows, operating model, standards or DPGA Standard changes. Preserve the assessment date, evidence references, reviewer and decision history. Keep the DPG track separate from production acceptance while retaining both under the single Shakti lifecycle.

---

## Official references

- DPGA DPG Standard: https://www.digitalpublicgoods.net/standard
- DPGA DPGs for DPI: https://www.digitalpublicgoods.net/dpgs-for-dpi
- DPGA application FAQs: https://www.digitalpublicgoods.net/digital-public-goods/faqs
- DPGA Climate Action collection: https://www.digitalpublicgoods.net/dpgs-for-climate-action
- RIS, *Foundations of Digital Public Infrastructure*, 2025.

**Document status:** Internal engineering assurance baseline. Not legal advice, DPGA recognition, DPI classification, statutory certification or production approval.


## 10. Commercial-first rule

RupayKg is a proprietary commercial product. DPG recognition is an optional recognition pathway for a specifically nominated solution; it is not a business objective that overrides monetization, IP protection, customer value or commercial sustainability.

The company may use existing DPGA-listed components under their respective licences and charge for its own implementation, integration, managed operations, hosting, configuration and support. Such use does not make RupayKg a DPG, DPGA partner or DPI.

No commercial source code, package or workflow is to be opened or relicensed merely to qualify for recognition. Where openness is strategically useful, first consider publishing interface specifications, data schemas and non-confidential conformance fixtures separately from the proprietary implementation.

The DPGA review does not grant exclusivity. Any open-source release must be evaluated on the assumption that other organisations may also use, modify and commercially offer the released component under its licence.

Controlling records:
- docs/RUPAYKG_COMMERCIAL_MONETIZATION_STRATEGY.md
- docs/DPG_REGISTRY_COMPONENT_EVALUATION_RUPAYKG.md
- docs/RUPAYKG_OPEN_MRV_CORE_FEASIBILITY_ASSESSMENT.md

The commercial go/no-go decision takes precedence over a speculative DPG nomination. This does not alter any statutory, production, security or TRL obligation.
