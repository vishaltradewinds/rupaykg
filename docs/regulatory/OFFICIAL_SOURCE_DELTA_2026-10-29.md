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


## 3A. BEE Accredited Carbon Verification Agency (ACVA) register — live verifier control

The BEE public ACVA register reports **Last Updated On 21 October 2026** and lists each agency's accreditation certificate number, provisional/final status, issue and validity dates, mechanism accreditation, and sectors accredited under the offset and compliance mechanisms.

- Official register: https://beeindia.gov.in/view_content.php?lid=568

**Engineering gates:**
1. Verification eligibility must be checked against the current ACVA register for the relevant mechanism (compliance versus offset), sector, accreditation status, and validity period at the time of the verification activity.
2. Do not infer that an agency accredited for one mechanism or sector is authorized for another; persist the source snapshot/version and the exact scope used for the decision.
3. Re-check accreditation status for each decision and preserve a dated evidence snapshot. A verifier's identity, organization membership, or generic "approved" flag alone is not proof of current BEE accreditation.
4. A local RupayKg verification record remains an internal workflow state until the required authorized verifier and applicable authoritative registry/process evidence are present. Never equate an ACVA register entry with a project's validation, verification, or CCC issuance.
5. Download and hash the actual register/document where technically possible; until retained evidence is attached, this remains a source-page observation rather than an immutable audit artifact.

## 3B. Freshness discrepancy — plastic packaging EPR and BEE waste methodologies

The current CPCB plastic-waste portal page lists Plastic Waste Management (Amendment) Rules for 2023, 2024, 2025 and 2026. This is a source-discovery finding only; the page listing does not establish which provisions apply to a particular actor or reporting period.

- CPCB plastic EPR portal: https://pwm.cpcb.gov.in/

**Engineering gates:** obtain each applicable Gazette notification and amendments, archive the exact documents and SHA-256 hashes, resolve commencement/transitional clauses, and map actor/category/financial-year applicability before activating targets or certificate calculations. Keep the portal's document index distinct from the operative legal instrument and from actual CPCB filing/acceptance.

A second freshness discrepancy was identified in the BEE Offset Mechanism methodology listing. The official BEE live page was rechecked after the earlier observation and explicitly lists BM WA03.001 (landfill methane recovery), BM WA03.002 (flaring or use of landfill gas), and BM WA03.003 (Production of Compressed Bio-gas (CBG)) under Waste Handling and Disposal. The earlier statement that .003 was not visible was incorrect and is superseded by this direct official-source check.

- BEE live methodology listing: https://beeindia.gov.in/view_content.php?lang=1&lid=571
- BEE Offset Mechanism procedure and methodologies page: https://beeindia.gov.in/show_content.php?lang=1&level=2&lid=640&ls_id=737

**Engineering gates:** the current listing supports recording BM WA03.003 as listed by BEE, but project activation still requires the exact methodology document and current procedure to be archived and hashed, version/effective date recorded, and project-specific eligibility reviewed. Do not infer registration, validation, verification, or CCC issuance from the methodology listing.

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

## 5. Plastic Waste Management (Amendment) Rules, 2026 — G.S.R. 237(E)

The official Maharashtra Pollution Control Board circular entry hosts the regulator copy of the notification dated 31 March 2026. The notification states that the amendment comes into force on publication in the Official Gazette. The CPCB plastic-waste portal also lists the 2026 amendment alongside prior amendments.

- Regulator-hosted notification entry: https://mpcb.gov.in/en/node/7306
- CPCB Plastic Waste Management portal: https://pwm.cpcb.gov.in/

**Engineering gates:** record G.S.R. 237(E), publication/effective date, exact archived PDF bytes and SHA-256; review the complete amendment and any later operative directions. Do not hard-code a target table solely from a summary. Resolve actor, packaging category, reporting year, statutory exceptions and reporting requirements before applying the amendment to an organisation. Keep the 2026 amendment as a versioned rule overlay rather than overwriting historical calculations.

## 6. BEE Accredited Carbon Verification Agency register

BEE's official ACVA register page was checked on 29 October 2026 and displayed a last-updated date of 21 October 2026. It identifies agencies by accreditation certificate, validity, mechanism and sector scope.

- Official BEE ACVA register: https://beeindia.gov.in/view_content.php?lid=568
- Published accreditation procedure and eligibility criteria: https://www.beeindia.gov.in/sites/default/files/ACV_Procedure_Doc_18102024_Published.pdf

**Engineering gates:**
1. Resolve the assigned agency against the live register at assignment time; check validity, provisional/final status, the relevant compliance/offset mechanism and sector scope.
2. Persist the register snapshot/reference, certificate number, checked-at timestamp, scope decision and any applicable conflict/independence checks with the validation/verification record.
3. Re-check agency status before relying on a completed validation or verification. A listed agency is not evidence that a particular project was eligible, that a specific verification was completed, or that CCCs were issued.
4. Archive and hash the exact register/PDF snapshot. Until this evidence exists, keep ACVA authority decisions pending and CCTS/CCC state fail-closed.

