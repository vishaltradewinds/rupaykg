# Official-source delta register — India EPR / ESG / CCTS / CCC
**Checked:** 2026-10-29  
**Purpose:** Engineering source-freshness evidence for PR #119. This is not legal advice or a legal applicability opinion.  
**Rule:** Current portal summaries help discovery; the operative Gazette notification, regulation, circular, procedure and amendments control. Do not activate a rule solely from this note.

## 1. Solid Waste Management Rules, 2026

The CPCB Centralised Portal for Solid Waste Management states that the Solid Waste Management Rules, 2026 were notified on 27 January 2026 and came into force on 1 April 2026. The official rules PDF states the rules supersede the 2016 rules, subject to things done or omitted before supersession. It describes four-stream segregation and duties spanning urban/rural local bodies, BWGs and waste-processing/disposal facilities.

- Portal: https://swm.cpcb.gov.in/
- Gazette/rules PDF: https://swm.cpcb.gov.in/images/solid-waste-management-rules-2026.pdf

**Engineering gate:** model the rule version and effective date; preserve transitional cases. Do not use the SWM rules engine as a substitute for separate stream-specific EPR rules (plastic packaging, batteries, e-waste, tyres, used oil, etc.). Capture the exact Gazette file and SHA-256 in the regulatory source store before activating production rules.

## 2. BEE / Indian Carbon Market — CCTS mechanisms

BEE maintains distinct compliance and offset mechanism materials. Its current public pages expose the Detailed Procedure for Compliance Mechanism, the Detailed Procedure for Offset Mechanism, methodology/tool lists, target-setting material and draft consultation documents.

- Carbon Market document register: https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=116
- Detailed Procedure for Offset Mechanism and Methodologies: https://beeindia.gov.in/show_content.php?lang=1&level=2&lid=640&ls_id=737
- Approved methodologies/tools page: https://beeindia.gov.in/view_content.php?lang=1&lid=571
- BEE offset account registration page: https://beeindia.gov.in/view_content.php?lang=1&lid=570

The approved-methodology page reports a last-updated date of 7 July 2026 and lists, among others, BM WA03.001 (landfill methane recovery), BM WA03.002 (flaring or use of landfill gas), and BM WA03.003 (compressed biogas production). The BEE carbon-market page also lists draft PDD and draft Programme of Activities consultation items; those drafts are not approved methodologies or final operating procedures.

**Engineering gates:**
1. Keep compliance and offset as separate workflows, with separate eligibility and status models.
2. Resolve the currently approved sector, exact methodology version, project start date, registration window, regulatory-compliance/surplus test, additionality, monitoring plan, validation/verification and double-counting controls before a project can advance.
3. Treat BEE portal summaries as discovery evidence; archive the exact current procedure, amendments and methodology files with hashes and effective dates.
4. Do not represent an internal estimate, EPR certificate, waste tonnage, ESG metric, draft PDD or test record as a CCC. Issued status requires authoritative registry evidence.
5. Recheck BEE documents before every release; the page itself may change without the application's stored source record changing.

## 3. SEBI BRSR / BRSR Core applicability

The SEBI BRSR Core framework introduced a phased assurance glide path for listed entities by market-capitalisation rank. The 2023 SEBI circular describes the BRSR Core glide path as top 150 entities in FY 2023–24, top 250 in FY 2024–25, top 500 in FY 2025–26 and top 1,000 in FY 2026–27. Subsequent SEBI circulars modify parts of the framework, especially value-chain disclosure and assurance; therefore the original schedule must not be treated as the complete current rule.

- BRSR circular (2021): https://www.sebi.gov.in/legal/circulars/may-2021/business-responsibility-and-sustainability-reporting-by-listed-entities_50096.html
- BRSR Core and updated BRSR circular (July 2023 PDF): https://www.sebi.gov.in/web/?file=https%3A%2F%2Fwww.sebi.gov.in%2Fsebi_data%2Fattachdocs%2Fjul-2023%2F1689166456465.pdf
- Industry standards on reporting BRSR Core (December 2024): https://www.sebi.gov.in/legal/circulars/dec-2024/industry-standards-on-reporting-of-brsr-core_90091.html
- Value-chain and green-credits changes (March 2025): https://www.sebi.gov.in/legal/circulars/mar-2025/measures-to-facilitate-ease-of-doing-business-with-respect-to-framework-for-assurance-or-assessment-esg-disclosures-for-value-chain-and-introduction-of-voluntary-disclosure-on-green-credits_93102.html

**Engineering gates:**
- Evaluate applicability per listed entity, reporting year and currently effective SEBI/LODR instruments; do not label BRSR universally mandatory for every RupayKg stakeholder.
- Do not conflate BRSR applicability with value-chain disclosure or assurance applicability. The March 2025 value-chain changes must be reflected in the relevant period profile; the original 2023 schedule is not sufficient by itself.
- Store each report profile with source instrument/version, reporting period, metrics and definitions, estimation flags, evidence lineage, review/assurance state and applicable transition relief.
- A generated export is not a filing, assurance opinion, regulator acceptance or company certification.

## 4. Release implications

| Control | Current engineering disposition |
|---|---|
| Source freshness | Targeted portal recheck performed; exact Gazette/circular/procedure file archive and hashes remain open |
| Legal applicability | Human legal/domain review required per actor, stream, jurisdiction and period |
| CCTS project eligibility | Fail closed until project-specific approved methodology and procedure gates are evidenced |
| CCC status | Use NOT_OBSERVED / PENDING_EXTERNAL_CONFIRMATION unless authoritative registry evidence exists |
| BRSR/BRSR Core | Effective-dated entity/reporting-period profile required; no universal applicability default |
| Draft consultation material | Store as DRAFT; must not be promoted to active policy without final official instrument |
| Production certification | HOLD; this source recheck does not close Shakti Standards approval, testing, TRL, deployment or continuous-assurance gates |

## 5. Sources consulted during this recheck

- CPCB SWM portal and official SWM Rules 2026 PDF (above).
- BEE Carbon Market page, current Detailed Procedure and methodology/tools listings (above).
- SEBI BRSR/BRSR Core circulars and March 2025 value-chain update (above).

**Evidence limitation:** This note records source-page contents available during the check. It does not assert that every source document has been downloaded, hashed, legally reviewed or incorporated into the production policy registry. Those remain explicit release gates.
