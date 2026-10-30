# RupayKg Authoritative Regulatory Source Register — 2026-10-30

**Status:** RESEARCH_REGISTER / FAIL_CLOSED  
**Scope:** India-wide EPR, SWM, ESG/BRSR, GRI cross-mapping, CCTS/CCC and carbon-credit integrity  
**Implementation effect:** None. This is a source-discovery and control document, not a legal opinion, compliance determination, or authorization to activate regulatory rules.

## 1. Mandatory source-handling policy

1. Primary legal sources take precedence: Gazette notifications and amendments, Acts/Rules, regulator circulars, official portal manuals/SOPs, and regulator-published methodologies.
2. A source is not activation-ready merely because its URL exists or a search result summarizes it. Capture the original artifact, exact title, issuing authority, notification/circular number, publication date, effective date, applicable entity/waste stream, amendment/supersession status, retrieval timestamp, SHA-256, archive object ID, and independent reviewer.
3. Distinguish FINAL / IN_FORCE, FINAL_FUTURE_EFFECTIVE, DRAFT / CONSULTATION, GUIDANCE, STANDARD, and RESEARCH_ONLY. Drafts and consultations must never be applied as binding rules.
4. No inferred rule, threshold, target, formula, eligibility condition, deadline, certificate, or approval may be represented as statutory unless tied to an applicable, version-pinned primary source.
5. Preserve jurisdiction, entity category, waste stream, financial/reporting year, effective interval, and source version on every control and report. Historical reports must retain the exact rule versions used at the time.
6. When sources conflict or amendment history is unresolved, mark the control BLOCKED_SOURCE_RECONCILIATION; do not silently choose the newest-looking page.
7. GRI is a sustainability impact-reporting standard; it does not replace Indian law, SEBI requirements, CPCB returns, EPR obligations, CCTS procedures, independent assurance, or credit issuance.
8. CCTS compliance mechanism and offset mechanism are separate pathways. Eligibility, approved scope/methodology, validation/verification, registry actions and issuance must be independently evidenced. A RupayKg MRV record is not itself a Carbon Credit Certificate.
9. ICVCM Core Carbon Principles, where used, are a complementary voluntary integrity benchmark only; never represent them as Indian statutory law or as a substitute for CCTS or other applicable law.
10. This register is a discovery baseline. Do not set source records to APPROVED or enable production rules until artifacts are archived, hashes computed, currentness and applicability reviewed, and legal/domain review recorded.

## 2. Initial primary-source register

The URLs below are official publisher/regulator entry points. At this checkpoint, source artifacts have not all been downloaded into the governed archive, hash-verified, or independently reviewed. The exact SWM Gazette URL has been identified, but it is not yet archived and hashed in the platform's evidence store. The CCTS compliance-procedure version/date discrepancy is an explicit open reconciliation item. Therefore every entry below remains RESEARCH_ONLY until the evidence fields in Section 3 are completed.

| ID | Domain | Official source / authority | Known status and use | Activation gate |
|---|---|---|---|---|
| IN-SWM-2026-GAZETTE-SO388E | Solid waste management | Gazette of India, S.O. 388(E), 27 Jan 2026: https://egazette.gov.in/WriteReadData/2026/269620.pdf (official Gazette PDF also published by CPCB at https://swm.cpcb.gov.in/images/solid-waste-management-rules-2026.pdf) | Primary Gazette instrument for SWM Rules, 2026; official text identifies notification date 27 Jan 2026. | Archive/hash the Gazette bytes; review the full rules, schedules, commencement, transition/savings and all later amendments; map each operative clause before implementation. |
| IN-SWM-2026-PORTAL | Solid waste management | CPCB Centralised SWM Portal: https://swm.cpcb.gov.in/ | CPCB portal states SWM Rules, 2026 came into force 1 Apr 2026 and describes stakeholder duties and reporting. | Treat as operational guidance; cross-check portal manuals and reporting workflow against Gazette and later official amendments. |
| IN-SWM-2026-PIB | Solid waste management | MoEFCC/PIB release, 28 Jan 2026: https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=2219676&lang=2&reg=48 | Official explanatory release; useful for discovery, not a substitute for Gazette text. | Cross-check every operative requirement against Gazette text. |
| IN-PWM-CPCB-PORTAL | Plastic packaging EPR | CPCB Plastic Waste Management portal: https://pwm.cpcb.gov.in/ | Portal lists Plastic Waste Management Rules and amendments through 2026, plus reporting modules and guidance. | Retrieve exact 2016 rules, Schedule II/EPR guidelines, each applicable amendment through 2026, current SOPs, notices and portal manuals; establish supersession and applicability. |
| IN-PWM-CPCB-EPR | Plastic packaging EPR | CPCB EPR portal: https://eprplastic.cpcb.gov.in/ | Official operational portal and published notices/manuals. | Verify current registration, certificate, return, capacity, reconciliation and correction workflows; do not assume portal status equals legal acceptance. |
| IN-EPR-MULTI-STREAM | Other EPR streams | MoEFCC/PIB circular-economy release: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2244104&lang=1&reg=1 | Official summary identifies separate EPR frameworks for batteries, e-waste, tyres, used oil, end-of-life vehicles, construction/demolition waste and non-ferrous scrap. | Build separate source packs for each stream; do not generalize plastic EPR rules to other streams. Locate exact in-force rules/amendments and official stream-specific portals. |
| IN-SEBI-BRSR-2023 | ESG/BRSR Core | SEBI circular, 12 Jul 2023, SEBI/HO/CFD/CFD-SEC-2/P/CIR/2023/122: https://www.sebi.gov.in/legal/circulars/jul-2023/brsr-core-framework-for-assurance-and-esg-disclosures-for-value-chain_73854.html | Official framework for BRSR Core and ESG value-chain disclosures/assurance. | Apply only to covered listed entities and the relevant reporting period; reconcile subsequent amendments and current LODR Master Circular. |
| IN-SEBI-BRSR-2024-177 | ESG/BRSR Core | SEBI circular, 20 Dec 2024, SEBI/HO/CFD/CFD-PoD-1/P/CIR/2024/177: https://www.sebi.gov.in/legal/circulars/dec-2024/industry-standards-on-reporting-of-brsr-core_90091.html | Industry Standards on Reporting of BRSR Core. | Verify applicability and subsequent SEBI circulars/clarifications; do not encode applicability from a summary alone. |
| IN-SEBI-LODR-MC-2026 | ESG/BRSR | SEBI Master Circular for LODR compliance, 30 Jan 2026 listing: https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=6 | Official current-year master circular index indicates a 2026 LODR Master Circular. | Retrieve the exact document and relevant clauses; reconcile against amendments and later circulars before setting effective rules. |
| IN-CCTS-2023 | Carbon Credit Trading Scheme | BEE CCTS notification, S.O. 2825(E), 28 Jun 2023: https://beeindia.gov.in/sites/default/files/CCTS.pdf | Foundational CCTS notification. | Retrieve Gazette original, parse mechanisms, governance and operative provisions; bind each control to a clause and effective interval. |
| IN-CCTS-AMEND-2023 | Carbon Credit Trading Scheme | BEE-hosted Gazette amendment, S.O. 5369(E), 19 Dec 2023: https://beeindia.gov.in/sites/default/files/CCTS%20Notification.pdf | Amendment introduces/clarifies offset-mechanism provisions. | Reconcile against the principal scheme and later amendments; keep compliance and offset pathways distinct. |
| IN-CCTS-BEE-PROCEDURES | CCTS methods and procedures | BEE Carbon Market official page: https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=189 | Official listing of detailed procedures, methodologies, approved sectors, verifier accreditation and consultation items; page shows materials updated during 2026. | Pin the exact final procedure/methodology version. Draft PDDs, consultation notices and provisional verifier listings are not final approvals. |
| IN-CCTS-COMPLIANCE-PROC-2026 | CCTS compliance mechanism | BEE resources page: https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=309&ls_id=136; BEE Carbon Market documents index: https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=116 | BEE’s official resources page lists “Detailed Procedure for Compliance Mechanism under CCTS” dated 22 May 2026. A separate BEE Carbon Market documents index also lists a similarly titled compliance procedure, but its text listing does not expose enough artifact metadata to establish whether it is the same file, a prior version, or a separate instrument. A date/version conflict is therefore not yet proven. | Retrieve the exact linked PDF from each official listing and compare bytes, title page, revision/date, approval/signature/status and contents; determine whether the records are duplicate links or distinct versions, then establish supersession and applicability. Do not infer a version conflict from a URL or choose a version by page freshness. |
| IN-CCTS-OFFSET-APPROVED-SECTORS | CCTS offset mechanism | BEE office memorandum, 20 Sep 2024: https://beeindia.gov.in/sites/default/files/2024-10/OM%20for%20approved%20Sectors%20in%20Offset%20Mechanism%20under%20CCTS.PDF | Official approved-sector source, subject to later updates. | Reconcile with current BEE approved sectors and final methodologies; sector approval alone does not establish project eligibility or issuance. |
| GRI-UNIVERSAL-2021 | Voluntary sustainability reporting | GRI Universal Standards: https://www.globalreporting.org/standards/standards-development/universal-standards/ | GRI states revised GRI 1, GRI 2 and GRI 3 were published Oct 2021 and effective for reporting from 1 Jan 2023. | Pin standard IDs, versions, translations and applicable reporting period. Treat GRI mapping as separate from legal compliance. |
| GRI-STANDARDS-RESOURCE-CENTER | GRI current standards | GRI Standards Resource Center: https://www.globalreporting.org/how-to-use-the-gri-standards/resource-center | Official catalogue identifies standards and effective dates; it notes revised biodiversity standard effective Jan 2026 and climate/energy topic standards effective for reporting from Jan 2027. | Check the exact topic/sector standard applicable to each disclosure and reporting period; do not apply future-effective standards prematurely. |

## 3. Required evidence fields for each source record

A source cannot leave RESEARCH_ONLY until all applicable fields are populated:

- source_id (stable, immutable)
- publisher and issuing_authority
- document_title, document_type, notification_or_circular_number
- official_url and canonical URL after redirect validation
- publication_date, effective_from, effective_to (nullable), retrieved_at
- legal_status: FINAL_IN_FORCE | FINAL_FUTURE_EFFECTIVE | DRAFT | CONSULTATION | GUIDANCE | STANDARD | SUPERSEDED | WITHDRAWN | UNKNOWN
- jurisdiction, waste_stream_or_domain, entity_scope, reporting_period_scope
- amends_or_supersedes[], superseded_by[], transition_and_savings_notes
- archive_object_id, immutable archived bytes, sha256, MIME type and byte length
- relevant_clauses[] with page/paragraph/schedule anchors
- applicability_analysis and exclusions
- reviewer_id, reviewed_at, legal/domain review outcome and rationale
- source_version, schema_version, approval_event_id
- provenance trail for every derived control, formula, disclosure mapping and report output

Never treat a missing field as approval. Never trust a client-submitted hash or validation status.

## 4. Proposed state machine

DISCOVERED -> RETRIEVED -> ARCHIVED_HASHED -> CURRENTNESS_CHECKED -> APPLICABILITY_REVIEWED -> INDEPENDENTLY_REVIEWED -> APPROVED_FOR_VERSIONED_USE

Any failed check moves the source to BLOCKED or SUPERSEDED; a draft remains DRAFT/CONSULTATION. Changes create a new source version and approval event. Previously issued reports retain their original snapshots.

## 5. Cross-workstream controls

### EPR and SWM
- Separate rule packs by waste stream and covered entity type.
- Model measured/declared quantities separately from accepted quantities and certificates.
- Enforce source evidence, registered-processor/recipient status where required, capacity and category checks, custody/transaction linkage, idempotency and no double consumption.
- Reconciliation differences must remain visible; do not automatically choose a favourable quantity or silently overwrite a return.
- Portal submission, receipt, acceptance, rejection and correction are distinct states.

### ESG/BRSR and GRI
- Every metric carries definition, unit, boundary, period, calculation method, evidence references, estimation flag, responsible owner, reviewer and assurance status.
- BRSR applicability is determined by current SEBI rules and entity scope, not by GRI mapping.
- GRI mapping is many-to-many and versioned; a mapping decision cannot set BRSR/EPR/CPCB/CCTS compliance or verifier approval.
- Evidence changes after review invalidate readiness and require re-review.

### CCTS/CCC and MRV
- Keep compliance-mechanism and offset-mechanism workflows separate.
- Bind projects to the exact applicable final methodology, approved sector, monitoring plan, baseline, additionality/eligibility requirements and current procedure.
- Distinguish estimated reductions, monitored results, validated project design, verified reductions, registry acceptance and actual certificate issuance.
- Prevent duplicate claim/issuance across registries and schemes; record serials, ownership, transfers, retirement/cancellation and reversals where applicable.
- Only an authorized registry/official event can establish issuance or transfer of a Carbon Credit Certificate.

## 6. Immediate next engineering gates

1. Archive and hash the exact primary source artifacts in this register.
2. Verify all amendment/supersession chains and current applicability as of 2026-10-30.
3. Have an independent India environmental-regulatory reviewer approve the EPR/SWM rule packs and a qualified carbon-market reviewer approve CCTS controls.
4. Reconcile the database migration ledger and deployed schema before any integration migration.
5. Integrate source IDs/version/hash into EPR, ESG/BRSR, GRI and CCTS controls without changing concurrent PR #120 shared files or activating research-only sources.
6. Add tests for stale/superseded sources, draft-vs-final classification, missing hashes, wrong entity/waste stream, effective-date boundaries, tampered provenance, tenant isolation, and report snapshot reproducibility.
7. Run the full CI and production-container checks on one coordinated final head. Keep production certification HOLD until all gates pass.

## 7. Shakti Standards and TRL

This register is a documentary source-discovery artifact, approximately TRL 2–3 (engineering estimate only). It is not evidence of a validated production compliance engine. TRL may only advance when the implemented source pipeline, policy engine, evidence lineage, authorization controls, integration tests and representative end-to-end workflow are demonstrated and independently reviewed.

**Release status: HOLD. No production activation, legal-compliance claim, external submission, credit issuance claim, migration or deployment is authorized by this document.**
