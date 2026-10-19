# CPCB SWM 2026 Ecosystem Map for RupayKg
**Status:** Regulatory/product discovery baseline; not CPCB endorsement or production certification.
**Reviewed:** 2026-10-19

Primary sources:
- CPCB portal: https://swmp.cpcb.gov.in/en
- User manual: https://swmp.cpcb.gov.in/en/user-guide
- FAQ: https://swmp.cpcb.gov.in/en/faq
- Resources: https://swmp.cpcb.gov.in/en/resources
- Gazette of India, Solid Waste Management Rules 2026 (144 pages): https://swmp.cpcb.gov.in/img/cpcb_doc/solid-waste-management-rules-2026.pdf
- Terms: https://swmp.cpcb.gov.in/en/terms-and-conditions
- Privacy: https://swmp.cpcb.gov.in/en/privacy-policy
- Cookie policy: https://swmp.cpcb.gov.in/en/cookie-policy

## 1. Scope and evidence limits

The public home, manual, FAQ, resources listing, terms, privacy and cookie policy were reviewed. Registration, grievance and event-intimation links resolve to dynamic application routes that do not expose their full forms as readable static pages. Role dashboards and application forms require authorised login. Therefore this maps the publicly accessible information and documented workflows; it does not claim inspection of every authenticated screen, private API or database behavior. An authorised walkthrough is still required for exact form fields and return schemas.

The portal describes the Solid Waste Management Rules 2026, notified 27 January 2026 and effective 1 April 2026. The Gazette is the legal source; portal text is useful operational guidance but its own Terms page cautions that website content should not be treated as law in place of authoritative verification.

**Critical boundary:** RupayKg is an independent workflow, evidence, operations and MRV platform unless formal government integration is authorised. RupayKg registrations, internal credentials, blockchain records, calculations or marketplace transactions are not CPCB registration, official approval, verified carbon credits or government-issued Carbon Credit Certificates (CCC). Statutory decisions stay with the competent authority. Do not assume an official API exists, automate CAPTCHA/OTP, or use government credentials without written authority and a supported interface.

## 2. Stakeholder map

| Stakeholder | What they do | What RupayKg should support | Boundary |
|---|---|---|---|
| Residential premises, RWA/society and households | Segregate and hand over waste; participate in local services | Simple multilingual guidance, collection schedules, service evidence and complaints | Do not assume every household is a BWG |
| Bulk Waste Generator (BWG) | Determine applicability, register, segregate, account for waste and file required returns | Organisation/site profiles, eligibility assessment, four-stream ledger, authorised collection receipts, evidence vault, compliance calendar, return preparation and status tracking | CPCB/local authority owns official registration/certificate |
| Government/institutional BWG | Perform applicable generator duties across sites | Multi-site hierarchy, delegated roles, procurement/contract records and audit-ready evidence | Validate any government-specific fee/exemption treatment against current official guidance |
| Commercial BWG: hotels, hospitals, malls, airports, railways, ports, markets, venues, industrial units and others | Site-level waste segregation, handover, records and returns | Site operations, manifests, weighments, processor reconciliation and downstream evidence | Some waste streams fall under separate legal regimes |
| Waste collection/transport agencies | Collect, transport and hand over waste | Vehicle/route manifests, custody transfers, weights, timestamps, photos, receipts and exception handling | Portal says collection agencies should contact ULB/RLB for registration; do not mark registered without evidence |
| MRF and recyclers | Sort materials and route recoverables to authorised destinations | Fraction-level mass balance, recycler authorisation checks, invoices, receipts and chain of custody | Dispatch alone does not prove recycling or final use |
| RDF and MRF-cum-RDF plants | Produce/manage refuse-derived fuel and report quality, availability and dispatch | Batch/lot traceability, calorific value/quality evidence, stock, availability, dispatch and offtake reconciliation | Keep current rule-specific technical and reporting requirements versioned |
| Compost, biomethanation, biogas/CBG facilities | Process organics and manage products/residues | Feedstock logs, process parameters, outputs, quality tests, sales/use, residues and methane monitoring where relevant | Environmental benefit/carbon claims require separate MRV and verification |
| Waste-to-energy, incineration and co-processing facilities | Treat appropriate waste and manage energy, emissions, ash and residues | Feedstock classification, weighment, operating data, emissions, ash/residue destinations and energy/offtake evidence | Apply relevant consents and other regimes; no generic compliance shortcut |
| Integrated SWM facilities | Coordinate collection, sorting, recovery, treatment and disposal | Multi-process operations, facility capacity, mass balance, permits and sub-facility records | Model each process separately |
| Sanitary landfill/disposal operators | Accept residual/inert waste and manage site/environmental risks | Load acceptance, weights, cell/site mapping, operations, leachate/groundwater, gas, fire, odour and closure/aftercare evidence | RupayKg cannot approve a site or substitute for regulatory monitoring |
| ULB (Urban Local Body) | Register/oversee BWGs and facilities; review documents; physically verify; handle grievances/events | Jurisdiction registry, application queue, document checklist, inspections, geotagged evidence, reasoned approve/correct/reject decisions, returns and dashboards | Official decisions only by authorised officers |
| District Panchayat (RLB-DP) | Rural jurisdiction review and oversight | District jurisdiction mapping, field verification, applications, returns and grievances | Respect delegated role and boundary |
| Gram Panchayat (RLB-GP) | Local rural governance and waste-management workflows | Low-bandwidth/mobile-first local records, collection routes, village assets and evidence capture | Do not assign powers beyond law and assigned role |
| District Magistrate (DM) | District oversight and Level 1 appeals as documented | Appeal queue, evidence bundle, reasoned decisions, due dates and district dashboard | Appeal decision belongs to DM |
| State UDD/RDD | State-level local-government oversight; UDD is Level 2 reviewer for BWG appeals per FAQ | State escalations, jurisdiction mapping and program dashboards | Confirm current state delegation |
| SPCB/PCC and Regional Officers | State monitoring, facility oversight and Level 2 facility appeals | Permit/consent register, inspections, facility monitoring, appeals, grievance queues and state dashboards | Regulatory powers remain with SPCB/PCC |
| CPCB/MoEFCC | Central rules, guidance, portal and national oversight | Versioned official source register and export-ready evidence; authorised exchange adapter only if approved | No implied endorsement, data sharing or CCC issuance through RupayKg |
| State departments/land authorities | State planning, infrastructure, land and coordination | Capacity-gap analysis, infrastructure inventory and decision records | RupayKg cannot allot land or approve projects |
| Waste pickers, SHGs, cooperatives and informal workers | Collect, sort and recover material; livelihoods | Consented worker/group profiles, safe-work records, fair payment evidence, receipts and grievances | Protect personal data and avoid excluding informal actors |
| Contractors, concessionaires, PPP operators and transporters | Deliver contracted services | Contracts, SLAs, route evidence, quantity reconciliation, payment and exception records | Contractual/statutory decisions remain with responsible parties |
| Cement plants, RDF buyers, recyclers, energy buyers and compost users | Receive and use recovered material/products | Buyer checks, product specs, orders, dispatch/receipt and proof of use | Sale or dispatch alone is not proof of environmental outcome |
| Accredited auditors, verifiers and laboratories | Independent assurance/testing where required | Evidence room, sampling plan, calibration, findings and corrective actions | Verify recognition for the relevant program; RupayKg cannot self-appoint an official verifier |
| Event organisers and venue operators | Submit event intimation where required | Calendar, attendance/location prompts, waste plan, submission receipt and follow-up | FAQ says events/gatherings of more than 100 persons at an unlicensed location must be intimated at least 3 days in advance; verify exact legal applicability |
| Citizens/complainants | Raise and track grievances | Accessible intake, location/evidence, acknowledgement, assignment, status and closure feedback | A RupayKg complaint is not a CPCB grievance unless submitted through an authorised channel |

## 3. BWG applicability and segregation

The CPCB home page and FAQ show BWG eligibility as **OR**, not AND:
- Building floor area of 20,000 m² or more; OR
- Water consumption of 40,000 litres/day or more; OR
- Solid waste generation of 100 kg/day or more.

RupayKg should show which criterion triggered screening, capture evidence/source/date, and label the result preliminary pending the official application and authority review. The FAQ says registration is organisation-specific and ULB-specific. Account creation alone does not complete registration.

The portal highlights four-stream segregation: wet, dry, sanitary and special-care waste, handed separately to authorised collectors. Record streams separately from generation through collection, transfer, processing and final destination. Never treat mixed-load weighment as proof of segregation.

The Gazette states industrial waste, hazardous waste/chemicals, biomedical waste, e-waste, battery waste and radioactive waste are excluded from the SWM Rules because separate regimes apply. RupayKg must detect these classifications and route to separate workflows rather than implying SWM registration is sufficient.

## 4. Facility taxonomy shown on CPCB home page

- RDF
- Material Recovery Facility (MRF)
- MRF-cum-RDF
- Compressed Biogas/Biogas Plant
- Compost Facility
- Waste-to-Energy
- Integrated SWM Facility
- Co-processing Facility
- Common biomedical waste processing facility (portal description distinguishes sanitary/special-care waste from biomedical waste under separate rules)
- Sanitary Landfill
- Waste Collection Agency
- Incinerator Facility

Use type-specific forms and obligations: accepted waste streams, capacity, permits/consents, operating status, process inputs, products, residuals, monitoring and reporting cadence. The facility manual lists facility layout plan, CTE, CTO, SPCB authorisation and environmental clearance as prerequisites; applicability must be validated for each facility and jurisdiction.

## 5. Portal journeys and authority transitions

### BWG
Eligibility screening → account verification → organisation/site-specific application → evidence and self-declaration → fee where applicable → submission → ULB/DP review and physical verification → approved/certificate OR correction requested OR rejected → amendment or Level 1 appeal to DM → Level 2 appeal to UDD for BWG where applicable → monthly returns after approval → grievances/events.

### Waste facility
Select facility type → site/organisation details → required layout, consents/authorisations and evidence → fee where applicable → ULB/DP review and physical verification → certificate or correction/rejection → Level 1 appeal to DM → Level 2 appeal to SPCB/PCC for facilities → applicable periodic and operational reporting.

### ULB / District Panchayat / Gram Panchayat
Local-body self-registration → DM review → approved role → receive BWG/facility cases in assigned jurisdiction → verify/reject each document with reasons → field verification with geolocation and photos; optionally inspection documents/video → approve, request correction or reject with reason/category → monitor registrations, returns, grievances and event intimations.

### District Magistrate
Onboarding through UDD/RDD or CPCB using state/district details → dashboard → manage local-body users and district applications → review Level 1 appeals and approve/reject with comments → grievances/events.

### SPCB/PCC
CPCB onboarding of state nodal officer → create Regional Officer users → dashboard for BWG/facility registrations, revenue and grievance analytics → review state-level applications and Level 2 facility appeals → approve/reject with comments → grievances/events.

### Cross-cutting services
Event intimation and grievances need their own lifecycle: intake, acknowledgement, jurisdiction routing, assignment, due date, evidence, action, response, escalation and closure. FAQ allows public-facing entry for non-registered users. FAQ states registration applications are reviewed by the concerned ULB/DP followed by physical verification. BWG/facility Level 1 appeals go to DM; Level 2 BWG appeals to UDD and facility appeals to SPCB/PCC. Government local bodies are fee-exempt; non-government BWGs and facilities pay registration and annual-return fees per FAQ. Obtain current official fee guidance before configuring amounts.

## 6. Required application state machine

Use explicit states:
- Draft
- Submitted / Under Review
- Correction Requested
- Resubmitted / Under Review
- Approved
- Rejected
- Amendment submitted / under verification
- Level 1 appeal pending at DM; approved/rejected
- Level 2 appeal pending at competent state authority; approved/rejected
- Official certificate recorded and source-verified
- Expired/suspended/withdrawn only when supported by authoritative evidence

Every transition stores actor, role, jurisdiction, timestamp, previous/new state, reason, comments, evidence references and source authority. Block actions from unauthorised roles or outside jurisdiction. Preserve versions; never silently overwrite. Keep CPCB portal state separate from RupayKg assistance/workflow state.

## 7. Evidence contract and mass balance

Each waste movement should record source organisation/site, stream/classification, date/time, origin/destination, net weight and unit, weighing-device identity/calibration evidence, collector/vehicle/route, custody timestamps, handover/receipt, attestation, photo/video/geolocation where lawful, facility acceptance/rejection, process batch, downstream recipient, invoice/dispatch and proof of receipt/use. Record provenance (manual, device, import, third-party attestation or official source), quality checks, anomalies and corrections.

Reconcile opening inventory + accepted inputs = products/outputs + residuals/rejects + closing inventory + explained process losses, using process-specific tolerances and measurement uncertainty. Flag unexplained differences. Do not infer carbon reductions from waste tonnage alone.

## 8. RupayKg capability architecture

1. Identity, organisations, sites, jurisdiction, delegated roles and access audit.
2. Official source register: Gazette, rules, notifications, resource versions, effective dates and clause-to-obligation traceability.
3. Applicability engine: BWG thresholds, facility type, jurisdiction and separate-regime exclusions.
4. Compliance case management: applications, documents, inspection, correction, rejection, amendment, appeals and official certificate references.
5. Waste-stream ledger: four-stream separation, movements, custody and weighment.
6. Facility operations: permits, capacity, process batches, outputs, residuals, monitoring and calibration.
7. Returns/reporting: monthly BWG returns after approval and facility/local/state reports at the applicable cadence; configurable by rule and facility class.
8. Field inspection: mobile/offline forms, photos/video, geolocation, officer identity, timestamps and sync conflict handling.
9. Grievance and event-intimation workflows.
10. Circularity marketplace: material listings, buyer/seller checks, quality, contracts, dispatch/receipt and payment reconciliation.
11. MRV: project boundary, baseline, monitoring plan, calibrated data, uncertainty, leakage, independent verification, double-counting controls and methodology-specific approvals.
12. Carbon-credit boundary: no CCC/credit status unless applicable Indian CCTS/BEE methodology, registry and verification/issuance evidence is verified. SWM compliance alone is not carbon-credit eligibility.
13. Stakeholder dashboards: jurisdiction-filtered registrations, returns, capacity, flows, mass-balance exceptions, grievances, inspections and data-quality labels.
14. Integration gateway: documented permission/API spec, schema versioning, idempotency, retries, audit logs and least-privilege credentials. Until authorised access exists, use controlled exports/imports with provenance.
15. Security, privacy and inclusion: least privilege, encryption, purpose limitation, retention/deletion, secure documents, incident response, accessible Hindi/English/local-language UX, low-bandwidth phones and protections for informal workers.

## 9. Minimum data entities

Party; Organisation; Site; Authorised Representative; Jurisdiction; Authority; Role Assignment; Delegation; Waste Stream; Waste Classification; Waste Lot; Weighment; Movement; Custody Transfer; Facility; Facility Type; Permit; Consent; Capacity; Process Batch; Product Output; Residual; Monitoring Observation; Registration Case; Application Version; Document; Document Review; Inspection; Decision; Amendment; Appeal; Official Certificate Reference; Monthly Return; Annual Return; Event Intimation; Grievance; Notification; Evidence Object; Evidence Attestation; Source Register Entry; Rule Version; Obligation; Audit Event; MRV Project; Methodology Version; Monitoring Plan; Calculation Run; Verification Finding; Credit Claim; Official Credit Status.

Use stable IDs, referential integrity, source hashes and timestamps. Do not store OTPs or secrets. Do not put personal identifiers or confidential source documents on a public/immutable ledger; consider hash anchoring only after privacy/legal review.

## 10. Phased delivery and gates

**P0 — Regulatory truth:** capture the Gazette and official resource versions; map every obligation to clause, stakeholder, evidence, frequency and authority; validate exclusions and state overlays with a qualified reviewer. Gate: all live rules trace to a source and unresolved questions remain blocked.

**P1 — Stakeholder workflows:** organisation/site identity, jurisdiction, BWG eligibility, facility onboarding, local-body review, inspection, corrections/rejections, amendments, two appeal levels, grievances and events. Gate: tests cover all permitted transitions and prove unauthorised actions are blocked.

**P2 — Waste integrity:** four-stream records, manifests, calibrated weighment, mass balance, downstream receipt, offline evidence. Gate: no unexplained mass-balance gaps and every change is auditable.

**P3 — Returns and dashboards:** monthly BWG returns after approval, facility-specific periodic reports, local/state dashboards and grievance/inspection metrics. Gate: reports reconcile to underlying records and human sign-off precedes submission.

**P4 — Marketplace and MRV:** verified counterparties, product quality, dispatch/receipt, independent review, double-counting checks and separate credit status. Gate: no transaction automatically creates a credit.

**P5 — Authorised interoperability and pilot:** obtain written integration permission/specifications or use an approved manual exchange; pilot a jurisdiction with a BWG, collector, processor and authority; run privacy/security, reconciliation, recovery and field-acceptance tests. Gate: no production certification without authority/stakeholder sign-off and documented evidence.

## 11. Mandatory acceptance tests

- BWG eligibility uses inclusive thresholds and OR logic.
- Registration is organisation/site and ULB-specific as applicable; account creation alone is not registration.
- Under-review submissions are not editable until a correction workflow is opened.
- BWG/facility review records local-body physical verification.
- Approved BWGs can file monthly returns.
- Appeal routing is DM → UDD for BWG Level 2, and DM → SPCB/PCC for facility Level 2.
- Government local-body fee exemption and non-government BWG/facility fee rules are source-linked; actual amounts come only from current official guidance.
- Four streams remain distinct through custody and destination.
- Separate-regime waste is flagged and not silently processed under SWM-only compliance.
- Official certificate references require issuer, identifier, date, source and verification status.
- Waste tonnage, blockchain transactions or internal MRV credentials never automatically become official CCC.

## 12. Blockers to close before claiming full compliance

1. The public site did not expose an official API specification or prove RupayKg has integration access. Obtain written permission and technical documentation.
2. Capture and version individual items from the dynamically loaded Resources page, including current fee guidance.
3. Obtain an authorised walkthrough of authenticated forms, monthly-return schemas, facility-specific reporting and authority screens.
4. Review the full Gazette, amendments/orders and state-specific overlays against every workflow; this is a product discovery document, not a legal opinion.
5. Validate jurisdiction, officer delegation, consent and permit applicability for each pilot.
6. RupayKg's separate production database, Guardian policy identifier and release gates remain separate blockers; this mapping does not close them.

## 13. Reference pages

- Home: https://swmp.cpcb.gov.in/en
- Manual: https://swmp.cpcb.gov.in/en/user-guide
- FAQ: https://swmp.cpcb.gov.in/en/faq
- Resources: https://swmp.cpcb.gov.in/en/resources
- Register: https://swmp.cpcb.gov.in/en/register?tenant=cpcb
- Gazette PDF: https://swmp.cpcb.gov.in/img/cpcb_doc/solid-waste-management-rules-2026.pdf
- Terms: https://swmp.cpcb.gov.in/en/terms-and-conditions
- Privacy: https://swmp.cpcb.gov.in/en/privacy-policy
- Cookie policy: https://swmp.cpcb.gov.in/en/cookie-policy


## 14. Additional Gazette-derived requirements to model explicitly

The Gazette review confirms the central portal is intended as more than an application inbox. Rule 16 describes a central repository for registration and annual returns, national/state/district data on generation, collection, processing and landfilling, public-domain dashboards, sanitary-landfill and legacy-dumpsite details, separate modules for obligated entities, source-linked orders/guidelines, received/sorted/forwarded waste flows and audits of collection, treatment, processing, recycling and disposal entities. RupayKg should support this data lineage and reporting architecture, but must not claim that its own dashboards satisfy the CPCB portal duty.

Additional data/reporting dimensions to include in discovery:
- Local-body waste generation and collection by ward, source category and waste stream; district/state aggregation must reconcile to site-level records.
- Collection, transport, secondary storage, sorting, processing, recycling, disposal and landfill flows, including quantities received, sorted, sent to processors, rejects/residues and tipping fees where required.
- Facility infrastructure inventory: operating and planned capacities, land area, distance/proximity constraints, technology type, site status, and landfill/legacy dumpsite inventory.
- RDF capacity, production, quality, availability, dispatch and industrial offtake; cement/co-processing destination and evidence of receipt/use.
- Rural local-body planning: ward-wise waste estimates and projections, collection/transport plan, infrastructure maps, markets/community assets, garbage-vulnerable points, litter hotspots, waste ingress points into drains/water bodies and clean-up schedules.
- Waste picker/informal worker database at ward level, with recognition/integration of individuals or representative organisations, consent and appropriate privacy controls.
- Environmental compensation: track alleged non-compliance, authority, rule/guideline basis, notices, response, decision, amount, payment evidence and appeal. Only the competent SPCB/PCC (or authority empowered by the rules) can make the official levy/decision; RupayKg must not auto-impose a statutory penalty.
- Reporting and audit trail for facility operations, downstream transfers, environmental monitoring and independent audits. The Gazette contemplates public data and audit information; privacy/security review must determine which fields can be public and which must be restricted.

## 15. Gazette-to-platform traceability gate

Before any module is called legally complete, create a row for every applicable Gazette clause and relevant official amendment with: exact clause/sub-rule/schedule; source file URL and checksum; effective date; obligated actor; trigger; required action; required data/evidence; due date/frequency; reviewing/enforcing authority; exception/exclusion; reporting destination; test case; product module; owner; reviewer; implementation state. This document is the ecosystem map, not that clause-by-clause register. The clause register must be created and reviewed as the next regulatory engineering task.
