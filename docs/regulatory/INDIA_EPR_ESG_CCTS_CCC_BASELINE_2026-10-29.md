# India EPR, ESG and CCTS/CCC Regulatory Baseline
**Prepared:** 2026-10-29  
**Status:** Research baseline for engineering and compliance review — NOT legal advice, regulator approval, or production certification.  
**Scope:** Pan-India RupayKg platform architecture; applicability must be resolved by waste stream, actor, jurisdiction, reporting period, scheme version and activity.

## 1. Governing design rule

RupayKg must preserve three distinct control planes and link them only through traceable evidence:

1. **EPR / waste-law compliance:** category-specific legal obligations, registrations, targets, evidence, authorised operations and certificates.
2. **ESG / sustainability disclosures:** reporting boundary, metric definition, source evidence, calculation method, estimation status, assurance and disclosure version.
3. **Indian Carbon Market / CCTS / CCC:** eligible mitigation project, approved methodology, additionality/regulatory surplus, monitoring, validation, verification, BEE/Registry process and actual certificate status.

Waste tonnage, an EPR certificate, an ESG metric, a carbon-reduction estimate, verified emission reductions and issued CCCs are different records. One must not automatically imply another. Every external status needs an authoritative reference; use NOT_OBSERVED where the source cannot confirm it.

## 2. Primary official source register

Archive the exact applicable notification/order, amendment, effective date, version/hash and applicability decision at implementation time. A portal landing page alone is not a complete legal record.

| Topic | Official source | Engineering consequence |
|---|---|---|
| Solid Waste Management Rules, 2026 | https://swm.cpcb.gov.in/ and https://swm.cpcb.gov.in/images/solid-waste-management-rules-2026.pdf | Rules took effect 1 April 2026 and supersede the 2016 rules, subject to transitional provisions. Model ULB/RLB, BWG, collector, processor and facility roles; four-stream segregation and relevant certificate/reporting duties. Keep streams covered by separate rules out of the SWM-only rules engine. |
| Plastic packaging EPR | https://pwm.cpcb.gov.in/ | Versioned PIBO/processor/recycler obligations, packaging categories, targets, certificates, returns and current amendments. Do not hard-code targets without effective-date logic. |
| Common EPR portal / battery waste | https://epr.cpcb.gov.in/ and https://eprbattery.cpcb.gov.in/ | Registration, annual returns, category-specific targets and certificate lifecycle. Check current portal notices/manuals before enabling operational workflows. |
| E-waste | https://eprewastecpcb.in/ | Keep E-Waste Management Rules, 2022 and amendments separate from plastic, battery and SWM rules. Confirm current portal and registration process against CPCB notices. |
| Waste tyre | https://eprtyres.cpcb.gov.in/ | Category-specific producer/recycler registration, targets and certificates. Confirm current rules and portal manuals. |
| Used oil | https://eprusedoil.cpcb.gov.in/ | Separate used-oil EPR eligibility, target, evidence and certificate accounting. |
| Circular economy / EPR rule summary | https://www.pib.gov.in/PressReleasePage.aspx?PRID=2244104&lang=1&reg=1 | Government summary lists distinct EPR frameworks including tyre, battery, e-waste, plastic, used oil, end-of-life vehicles, C&D waste and non-ferrous scrap. The relevant Gazette notification and current amendments control. |
| CCTS / Indian Carbon Market | https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=116 | Maintain separate compliance and offset mechanisms, applicable procedures, registry roles and effective versions. |
| CCTS approved methodologies/tools | https://beeindia.gov.in/view_content.php?lang=1&lid=571 | Versioned methodology registry. The BEE live page rechecked on 2026-10-29 lists BM WA03.001 (landfill methane recovery), BM WA03.002 (landfill-gas flaring/use), and BM WA03.003 (Production of Compressed Bio-gas (CBG)). Archive/hash the exact methodology document and applicable procedure/version and resolve project-specific eligibility before activation; listing alone does not prove a project's eligibility or CCC issuance. |
| CCTS Detailed Procedure for Offset Mechanism | https://beeindia.gov.in/sites/default/files/Detailed%20Procedure%20for%20Offset%20Mechanism_CCTS.pdf | Project eligibility, start date, regulatory compliance, sector scope, exclusivity, double-counting prevention, environmental safeguards and regulatory surplus are explicit gates. The published procedure states 1 January 2025 as the start date for ICM project activity registrations and says no retrospective projects will be considered; verify any later superseding procedure before applying. |
| BEE CCTS current notices/documents | https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=116 | Distinguish approved documents from drafts. BEE page includes draft Programme of Activities material; a public consultation draft is not a final rule. |
| SEBI BRSR | https://www.sebi.gov.in/legal/circulars/may-2021/business-responsibility-and-sustainability-reporting-by-listed-entities_50096.html | BRSR applicability depends on entity status and current SEBI/LODR requirements. Do not present it as universally mandatory for every MSME, municipality, recycler or project. |
| SEBI BRSR Core industry standards | https://www.sebi.gov.in/legal/circulars/dec-2024/industry-standards-on-reporting-of-brsr-core_90091.html | Metric definitions, source traceability and assurance readiness should be configurable; verify subsequent SEBI amendments and current applicability for each reporting period. |
| SEBI BRSR Core/value-chain circular and updates | https://www.sebi.gov.in/legal/circulars/jul-2023/brsr-core-framework-for-assurance-and-esg-disclosures-for-value-chain_73854.html and https://www.sebi.gov.in/legal/circulars/mar-2025/measures-to-facilitate-ease-of-doing-business-with-respect-to-framework-for-assurance-or-assessment-esg-disclosures-for-value-chain-and-introduction-of-voluntary-disclosure-on-green-credits_93102.html | Use the latest applicable consolidated requirements and transition reliefs; do not assume the original 2023 timetable remains unchanged. |
| ICVCM Core Carbon Principles | https://icvcm.org/the-core-carbon-principles/ | Supplemental voluntary integrity benchmark only; never a replacement for Indian law, CCTS eligibility or government issuance. |

## 3. EPR controls required in RupayKg

### 3.1 Applicability and obligation calculation
- Resolve the legal actor first: producer, importer, brand owner, manufacturer, recycler, refurbisher, bulk waste generator, ULB/RLB, collection/processing facility or another role.
- Resolve waste stream and subcategory from applicable rules, not a free-text label.
- Store jurisdiction, registration/authorisation, financial/reporting year, rule/amendment version, effective dates, target schedule, units and calculation provenance.
- Keep NOT_APPLICABLE, UNKNOWN, PENDING_REVIEW and APPLICABLE distinct. Do not infer obligation from an organisation name alone.
- Recompute schedules only under a versioned, reviewable rule set; retain original results and corrections as audit records.

### 3.2 Quantity and evidence integrity
- Never credit caller-supplied reported_quantity as fulfilled quantity without authoritative source binding.
- Bind measurement/custody to material/category, unit and conversion, source/receiver, activity, geography, reporting period, method/version, facility authorisation and evidence provenance.
- Distinguish measured, estimated, declared, verified, eligible, allocated, submitted, regulator-accepted, rejected, reversed and reconciled quantities.
- Prevent duplicate consumption across returns/obligations with transactional database constraints or equivalent atomic controls; preserve an allocation ledger.
- Rejection, cancellation and resubmission require explicit reversal/reconciliation. Never alter totals from an unverified client payload.
- Certificate states must be supported by the relevant portal/authoritative record; a local external-reference field is not a submission, transfer or certificate issuance.
- Fail closed on stale/revoked verifier permissions, self-review, cross-tenant/geography access and missing evidence.
- Add route-level disposable-PostgreSQL tests for concurrency, duplicate evidence, rejection/reversal, invalid units/category/period, authorisation revocation and tenant/geography boundaries.

### 3.3 Stakeholder workflows
Provide scoped workflows for producers/importers/brand owners, recyclers/refurbishers, waste generators/BWGs, ULB/RLB, collectors, processors, transporters, auditors/assurance providers and regulator-facing administrators. Each workflow shows legal role, allowed actions, evidence, deadlines, blockers, submission state and audit trail. Do not imply regulator access or portal integration until tested and authorised.

## 4. ESG / BRSR controls required

- Determine whether the organisation is subject to BRSR/BRSR Core, another sectoral disclosure, a contractual ESG request or a voluntary framework.
- Record reporting entity, consolidation/reporting boundary, financial year, organisational/geographic boundary, metric definition, unit, source activity, calculation method, factors and versions, estimation assumptions, restatements and evidence links.
- Separate raw observations, calculated metrics, management declarations, reviewed metrics, assured metrics and published disclosures.
- An evidence ID or verification ID alone does not make a metric verified. Verification requires a persisted authoritative decision with current verifier authority, scope, independence, methodology, evidence, period and revocation/freshness checks.
- Do not treat waste diverted, recycled content, avoided emissions and carbon credits as equivalent metrics. State boundaries and calculation methodology.
- Geography-filtered views must enforce organisation permissions and requested geography; unlocated/manual metrics must not be silently attributed to a location.
- Keep NOT_ASSESSED, PENDING, VERIFIED, ASSURED, PUBLISHED and RESTATED distinct. ASSURED can only be set through the applicable assurance workflow.
- Generate BRSR-ready exports only with metric-to-source lineage, definition/version, estimation flags, assurance status and reconciliation summary. RupayKg does not certify a disclosure or replace the listed entity's accountability.

## 5. CCTS / CCC controls required

### 5.1 Separate the two mechanisms
- **Compliance mechanism:** governed by notified obligated-entity status and GEI targets. Do not infer that any industrial facility is obligated or that a reduction automatically earns a CCC.
- **Offset mechanism:** project-based and available only when project, sector, methodology and procedural eligibility conditions are satisfied. Model the approved lifecycle: account/project registration, PDD and methodology, validation, project registration, monitoring, verification, issuance decision, registry status and subsequent transaction/retirement where applicable.

### 5.2 Eligibility and credit integrity gates
- Store methodology ID/version, sector, project boundary, start date, baseline, additionality, monitoring plan, parameters, emission factors, leakage, uncertainty, permanence/reversal risk where applicable, safeguards, validation/verification and source data.
- Enforce applicable start-date and no-retrospective-project rules; never backfill eligibility without explicit support in the governing procedure.
- Assess regulatory surplus: BEE's detailed procedure states activities mandated by law are not eligible under the Offset Mechanism. EPR or SWM compliance activity must not automatically count as offset-credit additionality; require project-specific legal and methodology assessment.
- Enforce exclusivity and double-counting controls across carbon registries, environmental credit programmes and claims. Preserve exceptions only where the governing procedure permits them.
- Do not calculate an issuance promise from an estimate. Report potential separately from monitored reductions, verified reductions, approved issuance and registry-confirmed issued CCCs.
- Show ISSUED, TRANSFERRED, RETIRED or SURRENDERED only when supported by authoritative registry/exchange records and identifiers. Otherwise use NOT_OBSERVED or PENDING_EXTERNAL_CONFIRMATION.
- CCC eligibility must never be inferred from an EPR certificate or ESG dashboard value. One physical event may support multiple reporting needs only if each framework permits it and accounting prevents double claims.

### 5.3 External integrations
Treat BEE, Grid Controller of India Limited Registry, accredited Carbon Verification Agencies, power exchanges, CPCB/SPCB/PCC and local bodies as distinct authorities. Store correlation IDs, external identifiers, timestamps, document hashes, status source and retry/idempotency state; redact secrets. A mock, CI test, local record or policy package is not live acceptance. Live acceptance requires authorised endpoints/credentials, exact record binding, persisted response and independent evidence review.

## 6. Common evidence and policy model

Every regulatory object should carry, where applicable: authority, instrument ID/version, publication/effective dates, jurisdiction, applicability basis, review date/reviewer, source URL, source SHA-256 and status. Keep immutable source records plus controlled corrections and append-only audit events. Evidence provenance should include origin system, actor, timestamp, location where lawful/necessary, instrument/device/calibration where applicable, source hash, chain of custody and transformation lineage. Use distinct statuses such as NOT_APPLICABLE, NOT_ASSESSED, PENDING, DECLARED, MEASURED, VERIFIED, ASSURED, SUBMITTED, ACCEPTED, REJECTED, REVERSED, ISSUED, RETIRED and NOT_OBSERVED; do not use one generic verified boolean across regimes. Select rules/methodologies by effective date and never silently rewrite historical calculations.

## 7. Prioritised engineering work batches

### Batch A — Regulatory source of truth
1. Convert this register into machine-readable, versioned policy metadata.
2. Retrieve/hash exact current Gazette notifications, amendments, CPCB portal manuals/orders, BEE procedures/methodologies and SEBI circulars; capture publication/effective dates and supersession links.
3. Obtain domain/legal review of applicability and interpretations before enabling statutory workflows.

### Batch B — EPR quantity authority and lifecycle
1. Implement governed measurement/custody-to-obligation binding and unit/category/period/methodology validation.
2. Implement atomic allocation/consumption and reversal/reconciliation ledger.
3. Add route-level PostgreSQL concurrency/adversarial tests; keep submission blocked until gates pass.

### Batch C — ESG evidence and reporting
1. Build versioned metric dictionary and reporting-boundary registry.
2. Add source-linked metrics, estimate/assurance distinctions, geography and role authorisation.
3. Add BRSR/BRSR Core mapping as a versioned output profile with explicit applicability and current SEBI requirements.

### Batch D — CCTS/CCC project and registry lifecycle
1. Implement project eligibility and regulatory-surplus checks before PDD creation/registration.
2. Version approved methodologies and monitoring-plan templates from BEE; block draft procedures from production rules.
3. Separate potential, monitored, verified, issued and transacted credit quantities; enforce exclusivity/double-counting checks.
4. Execute Guardian/Hedera/Mirror Node and external-registry acceptance only with authorised credentials and real approved records.

### Batch E — Shakti Standards release gate
1. Exact-head CI, schema/migration-history reconciliation, security/tenant isolation and rollback evidence.
2. Independent statutory/domain review and stakeholder UAT for producer, recycler, BWG, ULB/RLB, verifier, ESG reporting owner and carbon project developer.
3. Record subsystem TRL and evidence; CI is not field validation. Current project baseline remains provisional software TRL 4; TRL 5 not demonstrated, hardware not assessed, production certification HOLD/OFF until evidence changes the decision.

## 8. Current blockers to carry forward

- EPR submission stays fail-closed until authoritative quantity binding and rejection/reversal accounting are implemented and tested.
- ESG evidence references alone cannot establish verified or assured status; persisted verification authority, scope, period, methodology and evidence lineage must be validated.
- Migration-history discrepancy must be reconciled from exact historical sources; do not bypass fail-closed migration guards or run live migrations.
- Live Guardian/Hedera consensus/provenance/Mirror Node acceptance is not established by CI or deterministic package tests.
- Do not merge, deploy or certify on the strength of this document. It is a policy baseline pending review, implementation and exact-head validation.

## 9. Review cadence

Re-check official source pages and Gazette notices before each rule-engine release and at each financial-year/reporting-period transition. A source change opens a controlled impact review identifying affected calculations, forms, schemas, tests, reports, open cases and historical records. Never silently change past obligations or published metrics.

## 10. Official-source freshness recheck — 2026-10-29

This section records a targeted official-source recheck for current engineering priorities. It is not a complete legal opinion or a claim that every underlying Gazette instrument has been archived and hashed.

### BEE / Indian Carbon Market
- The BEE Carbon Market page lists the **Detailed Procedure for Compliance Mechanism under CCTS** and the **Detailed Procedure for Offset Mechanism and Methodologies** as current document families. Preserve these as separate compliance-versus-offset control planes. Do not infer that a project can earn CCCs from compliance-period emissions performance, EPR certificates, waste tonnage or an ESG metric alone. Source: https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=116
- BEE's current public page also exposes the **Greenhouse Gases Emission Intensity Target Rules, 2025**, target-setting notifications, methodology materials and draft consultation documents. The engineering ingestion process must distinguish final/operative instruments from draft consultations and stakeholder-comment notices; a draft must never be promoted to an active eligibility rule. Source: https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=116
- BEE's register of Accredited Carbon Verification Agencies showed a page update dated **21 October 2026**. At validation time, any verifier assignment must query the current official register and check mechanism, sector scope, accreditation type, validity and status; do not freeze the page's current names into a long-lived allowlist. Source: https://beeindia.gov.in/view_content.php?lid=568
- The offset procedure's project start-date, regulatory-compliance, approved-sector/methodology, additionality, validation/verification and double-counting gates remain mandatory inputs to a project-specific eligibility decision. The platform must represent missing evidence as BLOCKED/PENDING_REVIEW, not as eligible or issued.

### SEBI / BRSR and value-chain disclosures
- SEBI's 28 March 2025 circular modified the value-chain ESG disclosure/assurance approach. The official FAQ states value-chain disclosures and related assessment/assurance are voluntary from FY 2025–26 and describes the relevant top-250 listed-entity and value-chain scope. Do not implement the original 2023 timetable as if unchanged; select requirements by reporting year and the latest applicable SEBI/LODR instrument. Sources: https://www.sebi.gov.in/legal/circulars/mar-2025/measures-to-facilitate-ease-of-doing-business-with-respect-to-framework-for-assurance-or-assessment-esg-disclosures-for-value-chain-and-introduction-of-voluntary-disclosure-on-green-credits_93102.html and https://www.sebi.gov.in/sebi_data/faqfiles/apr-2025/1745399101865.pdf
- Voluntary value-chain disclosure does not make all ESG disclosures voluntary. Applicability of BRSR/BRSR Core to the listed entity, its reporting period and other applicable laws must be determined separately. Do not generalize a listed-entity reporting relaxation to every RupayKg stakeholder.

### Required ingestion and release controls
1. Store instrument title, issuing authority, official URL, document hash, publication/issue date, effective-from/effective-to, supersession link, legal status (FINAL, DRAFT, SUPERSEDED, WITHDRAWN, UNKNOWN), applicability basis, review date and reviewer.
2. A changed source document or new official notice creates a review task; it must not silently rewrite historic rule evaluations or past calculations.
3. Keep a draft, consultation, press summary, portal banner and operative Gazette notification as distinct source types. The authoritative legal instrument controls where sources conflict.
4. Before a policy version can affect calculations or stakeholder submissions, require human legal/domain approval, test fixtures for both effective-date boundaries, and an auditable change record.
5. This recheck does not close the broader Gazette/source-hash archive gate. Exact current notifications, amendments, effective dates and applicable portal manuals still need to be retrieved and hashed per waste stream, jurisdiction, actor and reporting period.


## 7. Source-freshness correction — 29 October 2026

A follow-up check of the official BEE Offset Mechanism methodology listing confirms that BM WA03.003 (Production of Compressed Bio-gas (CBG)) is listed alongside BM WA03.001 and BM WA03.002. An earlier statement in this baseline that .003 was not visible was incorrect and is superseded. The methodology's listing does not itself prove project eligibility, registration, verification, or CCC issuance; archive/hash the exact methodology document and applicable procedure before project-specific activation.

The CPCB Plastic Waste Management portal currently indexes amendment rules through 2026. The index is a discovery aid; applicable Gazette notifications, commencement and transitional clauses, actor/category, financial year, and subsequent amendments must be reviewed and archived before any EPR target or certificate logic is activated.

This baseline remains research-only. Neither portal-page review nor a generated RupayKg report proves legal compliance, regulator acceptance, assurance, or certificate issuance.

## 8. Source-specific control updates — 29 October 2026

### Plastic Waste Management Amendment, G.S.R. 237(E)
The regulator-hosted notification entry identifies the Plastic Waste Management (Amendment) Rules, 2026 dated 31 March 2026. The notification says it comes into force on publication in the Official Gazette. Before encoding its amended requirements, archive the exact PDF bytes, compute and verify SHA-256, inspect all clauses and exemptions, and map each obligation by actor, packaging category, reporting year and current CPCB directions. Do not apply a summarized target table universally. Sources: https://mpcb.gov.in/en/node/7306 and https://pwm.cpcb.gov.in/.

### BEE Accredited Carbon Verification Agency register
BEE's official ACVA register displayed a last-updated date of 21 October 2026 on the 29 October 2026 check. Each assignment must check the live register for current accreditation, validity, compliance-versus-offset mechanism, and applicable sector scope; persist a timestamped snapshot/reference and the decision with the project verification record. A listing does not establish a specific verification outcome, project eligibility or CCC issuance. Source: https://beeindia.gov.in/view_content.php?lid=568. Published accreditation procedure: https://www.beeindia.gov.in/sites/default/files/ACV_Procedure_Doc_18102024_Published.pdf.

The exact-notification and live-register snapshots remain unarchived and unhashed at this checkpoint. These additions improve source discovery and control requirements but do not close the evidence gate or change RESEARCH_ONLY / FAIL_CLOSED status.

