# Pan-India Waste Chain Onboarding & Operations Specification

**Status:** Engineering specification and implementation backlog. Not a legal opinion, regulatory approval, or evidence that any participant is registered.
**Scope:** RupayKg across Indian States and Union Territories.
**Shakti Standards gate:** evidence-first, jurisdiction- and waste-stream-specific, fail closed. Never invent identities, permits, quantities, destinations, processing outcomes or environmental claims.

## 1. Objective

RupayKg must support the complete chain from waste generation to verified recovery or disposal across India. It is not merely a listings marketplace. Each physical lot must have a traceable origin, declared composition, custody history, transport movements, receiving weight, processing outcome, residual destination and evidence trail. A listing, self-declaration, invoice, GPS point or uploaded certificate alone does not prove lawful handling or recycling.

The product must work for formal organisations and small/informal operators using ordinary phones, low bandwidth, assisted onboarding, simple language and conflict-safe offline capture. It must not force every participant into a single legal category or assume all waste is regulated identically.

## 2. Participant and account model

An organisation has one canonical identity and may hold multiple roles, facilities, branches, waste streams, jurisdictions and authorisations. People receive scoped access through verified organisation membership. A platform role is not a legal permission: it never substitutes for a regulator-issued registration, consent, authorisation, permit, licence or contract.

### 2.1 Core participant categories

1. **Waste generators**
   - Residential welfare associations, housing societies, households/community sources.
   - Commercial premises: retail, restaurants, hotels, malls, offices, markets, events, warehouses.
   - Institutional: schools, colleges, universities, hospitals, research institutions, community places.
   - Public sector/government: central/state departments, PSUs, local bodies, public buildings, railway/airport/port/bus terminals.
   - Industrial/manufacturing facilities, industrial parks, workshops and service facilities.
   - Agriculture, horticulture, livestock, fisheries and food-processing sources.
   - Construction, demolition, renovation and infrastructure projects.
   - Healthcare, laboratory and other special-regulated generators under their separate legal regimes.
   - Producers, importers and brand owners with EPR obligations where applicable.
2. **Collectors, aggregators, collection centres and material recovery facilities**
   - Door-to-door/community collection; scrap dealer/kabadi; aggregation yard; sorting, baling or consolidation centre; authorised collection point; cooperative, SHG, FPO or informal-worker collective.
   - Distinguish collection/storage/sorting from processing; each activity can have separate eligibility and authorisation requirements.
3. **Transporters and logistics operators**
   - Own or hired fleet, local collection vehicle, inter-city carrier, bulk carrier, specialised vehicle, and authorised hazardous/special-waste carrier where required.
   - Vehicle, driver, permit, route, consignment and emergency information are independently scoped and expiry-controlled.
4. **Recyclers, processors, treatment/recovery operators**
   - Material recycler; composting/biomethanation/anaerobic digestion; RDF/co-processing; waste-to-energy; dismantling/refurbishing; battery/e-waste/plastic/tyre/used-oil processor; C&D processor; authorised treatment/disposal facility.
   - Distinguish recycling, reuse/refurbishment, treatment, co-processing, energy recovery and final disposal. Do not collapse them into a generic “recycled” status.
5. **Downstream buyers and end-users**
   - Buyers of recovered material, compost, recyclate or RDF; co-processing users; road-construction/material-utilisation projects where applicable.
   - Evidence of actual receipt and permitted use is required before recording utilisation.
6. **Compliance and ecosystem participants**
   - ULB/RLB/Gram Panchayat/District Panchayat; SPCB/PCC-facing compliance team; EPR-obligated producer/importer/brand owner; verifier/auditor; methodology/programme administrator; approved platform support; insurer/financier/marketplace buyer.
   - These are separate capabilities, not a universal super-admin. Authorities are not presumed to be RupayKg users or to endorse the platform.

### 2.2 Required organisation profile

Capture legal/operating name, entity type, identifiers supplied by the participant, registered and operating addresses, authorised representative, contact channels, language preference and consent; State/UT, district, local body/jurisdiction and source-versioned administrative geography; facilities and actual activities at each site; roles, waste streams/material codes, estimated and measured capacities, operating days, storage conditions, service radius and availability; and required registrations/consents/permits with issuing authority, site, scope, waste code, capacity, issue/expiry dates, evidence, status and reviewer decision.

Collect bank/payment details only when needed for a requested financial workflow, segregated from public profiles and protected by least privilege.

Onboarding states: DRAFT → SUBMITTED → EVIDENCE_REQUIRED / UNDER_REVIEW → VERIFIED_FOR_SCOPED_ACTIVITY, or REJECTED / SUSPENDED / EXPIRED. Verification is scoped by organisation + facility + role/activity + waste stream + jurisdiction + capacity + validity period. No blanket “verified company” badge may imply all activities are authorised.

## 3. Waste taxonomy and routing

Use a versioned national taxonomy mapped to official classifications. Keep material identity separate from legal regime, hazard properties and treatment route; a material can trigger more than one regime.

### 3.1 Initial supported waste families

- **Municipal solid waste:** wet/biodegradable; dry recyclable; dry non-recyclable/combustible; sanitary; special-care; horticulture/park waste; street sweepings and inert residuals. Capture the four source-segregation streams required by applicable SWM rules, while preserving more detailed subtypes.
- **Plastic and packaging:** polymer/resin where known, packaging category and contamination; verify applicable Plastic Waste Management/EPR and CPCB/SPCB/PCC registration scope.
- **Electrical/electronic waste:** equipment/category, components, included batteries, dismantling/refurbishment/recycling route and applicable registration.
- **Waste batteries:** chemistry/type, condition, safety requirements and authorised route under applicable Battery Waste Management/EPR rules.
- **Waste tyres and rubber:** tyre type, reuse/retreading/material recovery/pyrolysis route and applicable authorisation/EPR scope.
- **Used oil and other regulated industrial oils:** source/process, grade/contamination, quantity and authorised recovery route; assess hazardous properties and transport/storage conditions.
- **Construction and demolition waste:** concrete, masonry, soil, metal, wood, gypsum, glass and mixed C&D; verify applicable C&D Rules 2025 registration, processing and utilisation requirements.
- **Hazardous industrial waste:** official waste code, hazard properties, compatible packaging, storage, manifest/consignment requirements and authorised treatment/disposal route. Block ordinary marketplace handling where required authorisation is absent.
- **Bio-medical waste:** category, segregation, packaging, authorised collection/treatment chain and separate applicable rules; never mix with ordinary MSW flows.
- **Organic/agri-residue/food-processing waste:** crop residues, husk, bagasse, animal/fish/food residues and manure; distinguish waste, by-product and product status with evidence and applicable state rules.
- **Textile, paper/cardboard, ferrous/non-ferrous metals, glass, wood, used products and other recoverables:** material grade and contamination, with regulated classification added where relevant.
- **Legacy dumpsite/landfill methane and project-specific feedstocks:** project boundary, baseline, methodology, monitoring plan and site approvals are separate MRV gates. A waste movement record alone does not establish carbon reduction.

This is a product starting taxonomy, not a claim that every stream is supported by every jurisdiction. The rules catalogue must record commencement dates, amendments, official source, applicability conditions and responsible authority. Uncertain classification means QUARANTINED_CLASSIFICATION pending qualified review.

## 4. Bulk Waste Generator eligibility and compliance

The CPCB Centralised Solid Waste Management Portal describes the Solid Waste Management Rules, 2026 as effective from 1 April 2026. Its published BWG thresholds are **any one** of: building floor area at least 20,000 m²; water consumption at least 40,000 litres/day; or solid waste generation at least 100 kg/day. These are OR criteria, not an AND condition. Confirm the applicable Gazette text, amendments, local-body by-laws and portal instructions before treating a user as legally registered.

Capture each criterion independently with units, observation period, evidence/source and review state. Support “potentially in scope”, “self-declared”, “evidence verified”, “registered with local body”, “not in scope (reason/evidence)” and “needs legal review”. Threshold estimates do not prove official registration. Record local-body registration/certificate, segregation arrangements, collection/processing route, wet-waste on-site processing feasibility and applicable EBWGR certificate/procurement evidence. RupayKg-generated records must never be presented as official certificates.

Official starting sources:
- CPCB SWM portal: https://swm.cpcb.gov.in/
- SWM Rules 2026 Gazette PDF: https://swm.cpcb.gov.in/images/solid-waste-management-rules-2026.pdf
- MoEFCC/PIB summary: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2219676&lang=1&reg=3
- CPCB C&D waste system (Rules 2025): https://cdwm.cpcb.gov.in/about-system
- CPCB E-Waste EPR system: https://eprewaste.cpcb.gov.in/

These are official starting points. Before encoding legal obligations as executable rules, review the complete applicable Gazette/rules, amendments, official SOPs and state/local requirements. Do not automate external government portals without permission; use official links and evidence capture until authorised integration is confirmed.

## 5. National and State/UT compliance architecture

Implement a versioned rule registry, not hard-coded state assumptions. Each rule record needs: rule ID; jurisdiction level (central/state/UT/local); waste family; regulated activity; participant type; applicability predicate; threshold/unit; required evidence type; authority; validity/renewal logic; effective-from/to dates; official source URL/document hash; reviewer; last-reviewed timestamp; and confidence/status.

Maintain a central baseline with State/UT and local-body overlays. Conflicts or missing rules create LEGAL_REVIEW_REQUIRED, not silent fallback. Separate registrations/consents for generation, collection/transport, storage, processing, EPR, hazardous/special waste and end-use where applicable. Never infer a transporter permit from a recycler registration or one site's approval from another site's approval. State Pollution Control Board/Pollution Control Committee and local-body requirements must be sourced per State/UT and activity. No “all-India approval” badge unless an actual legal instrument supports that scope.

Maintain legal-change review and regression tests for effective dates, thresholds, expired documents, jurisdiction changes and transitional provisions. Every decision stores the rule version used so past transactions remain explainable.

## 6. End-to-end operating workflow

1. **Discover and onboard:** mobile-first registration, assisted onboarding, roles/facilities and verification of identity and authority to represent the entity.
2. **Scope and compliance:** determine State/UT/local body, waste stream and activity; collect evidence; scope every approval by facility, activity, material, capacity and validity.
3. **Declare material lot:** origin, generator, material family/code, segregation, estimated quantity/unit, contamination/hazard declaration, packaging, timestamp, photos/documents and custody owner. Estimated quantity is not a weighbridge measurement.
4. **Match and contract:** request/offer, quote, service terms, permitted destination, service window, pricing and dispute terms. Marketplace matching never overrides compliance checks.
5. **Schedule pickup:** eligible transporter, driver/vehicle, route, required manifests/consignment documents, safety instructions and emergency contact.
6. **Handover and custody:** generator and collector/transporter record transfer with timestamp, parties, lot ID, quantity/method and acknowledgement. Preserve both parties' assertions when they disagree; do not overwrite history.
7. **Transport and weighment:** pickup/arrival events; GPS as supporting evidence only; scale/weighbridge identity, calibration/verification status, gross/tare/net values, unit, timestamps, ticket artifact hash and exceptions. Device data is authoritative only after instrument qualification gates pass.
8. **Receipt and reconciliation:** receiver records accepted/rejected/partial quantity, contamination, reason and evidence. Reconcile origin, pickup, transit, receipt and processing input with approved material/process tolerances; unexplained differences go to review.
9. **Processing:** input lot, batch, process route, operating period, measured outputs, by-products, residues, emissions/effluent where applicable and facility capacity/authorisation. Mass balance must account for input = products/recovered outputs + residues/disposal + documented process losses, with conversions and uncertainty explicit.
10. **Output and downstream utilisation:** create linked output lots; capture buyer receipt and intended/actual use. Use “recycled”, “recovered”, “co-processed”, “treated” or “disposed” only when evidence meets defined criteria.
11. **Settlement and dispute:** compute payable quantities from agreed, reconciled evidence; show adjustments, taxes/fees and dispute status. No automatic payment or certificate issuance based solely on a submitted claim.
12. **Compliance/MRV exports:** role-scoped reports and audit bundles. EPR, BWG/EBWGR and carbon certificates are issued only by the legally authorised issuer/programme; RupayKg may record/link them, not impersonate an issuer.
13. **Correction, recall and audit:** append corrections/superseding records; never mutate an anchored observation set in place. Revoke/suspend scope when evidence is rejected, expires or an incident is raised; preserve audit history.

## 7. Canonical data entities and invariants

Reuse existing tables/routes where present; do not create a parallel ledger without architecture review. Logical domains:
- organisations, identities, memberships, facilities, scoped roles
- jurisdiction reference, waste taxonomy versions, regulatory rules and applicability decisions
- registrations/authorisations, evidence artifacts and evidence reviews
- material lots, composition, custody events, transport assignments, vehicles and weighments
- processing batches, input/output links, mass-balance reconciliations and residual destinations
- contracts, quotes, invoices, settlements and disputes
- compliance obligations, official certificates, MRV submissions and audit events

Required invariants:
- Stable unique IDs/idempotency keys; tenant and facility scope on every read/write.
- Append-only custody/evidence events; explicit correction/supersession links.
- Every quantity stores value, unit, method, source, measured/estimated status and timestamp; uncertainty/quality only when actually available.
- Conversions use a versioned unit/conversion table; no silent mass-volume conversion without material-specific evidence/density.
- No duplicate mass counted across linked source records; cross-links and deduplication are explicit.
- No certificate/credit from a listing, self-declaration, synthetic fixture or unverified downstream claim.
- PII, commercial pricing, sensitive location and worker data are purpose-limited and access-controlled.
- Offline capture is PENDING_SYNC; conflicts are visible and reconciled, never silently last-write-wins for custody, weighment or compliance evidence.
- Every status transition stores actor, timestamp, reason, policy/rule version and evidence reference.

## 8. Permissions and user experience

Task-oriented screens and scoped dashboards:
- **Generator:** waste declaration, pickup, segregation, compliance due dates and receipts.
- **Aggregator:** incoming lots, sorting/grade, storage capacity, outgoing consignments and stock balance.
- **Transporter:** assignments, documents, vehicle/driver readiness, route events and handovers.
- **Processor/recycler:** inbound acceptance, capacity, batch input/output, residues and expiring regulatory evidence.
- **Buyer:** material specifications, verified origin/processor scope, lot traceability and receipt.
- **Local body/compliance team:** only authorised jurisdiction and workflows; evidence requests and reports, not unrestricted cross-tenant access.
- **Verifier/auditor:** read-only review with explicit authority and conflict-of-interest controls.
- **Platform support:** minimum necessary diagnostics; no self-approval of regulated evidence or alteration of immutable records.

Support English and configurable Indian-language labels, low bandwidth, small screens, accessible forms, voice-assisted capture only with explicit consent, resumable drafts, QR lot IDs and printable receipts. Do not require blockchain, continuous GPS or expensive IoT for ordinary transactions. Use manual/paper evidence capture where legally acceptable, marking method and quality honestly.

## 9. National rollout in implementation batches

**Batch A — Product and regulatory foundation**
- Inventory existing schemas/routes and map to this logical model.
- Establish multi-role organisation/facility model and controlled waste taxonomy.
- Create central/State/UT/local rule registry, starting with SWM 2026 and applicable EPR/special-waste frameworks.
- Define onboarding status and evidence/expiry contracts; prepare migration/backfill plan.

**Batch B — Chain of custody**
- Lot declaration, pickup, transport assignment, handover, receipt and dispute.
- Idempotency, append-only audit, offline sync conflict tests and quantity reconciliation.

**Batch C — Processor and circularity accounting**
- Batch input/output/residue links, mass-balance checks, output lineage, downstream receipt and verified utilisation status.

**Batch D — BWG and EPR compliance**
- BWG assessment using three independent OR criteria, local-body registration evidence, applicable wet-waste and EBWGR workflows.
- Stream-specific EPR workflow and official certificate evidence; no cross-stream certificate substitution.

**Batch E — MRV and qualified hardware**
- Reuse existing MRV/instrument/evidence architecture; bind readings to exact instrument, parameter, units, calibration and reviewed source evidence.
- No production sensor selection until actual site process, monitoring plan, legal scope, exact-model MeitY approval, calibration and field acceptance are evidenced.

**Batch F — State/UT expansion and production gates**
- State-by-state regulatory evidence packs and regression suite, then controlled pilot with real participants.
- Production gate requires authorised database identity, migration rehearsal/recovery, security review, monitoring, support process, privacy/legal review, user acceptance and explicit release approval.

## 10. Acceptance criteria

- One organisation can hold multiple scoped roles and facilities without duplicate identities or privilege escalation.
- A generator is classified as potentially in BWG scope if any one 2026 threshold is met; all three inputs, units and evidence are independently preserved.
- Missing/expired/rejected/wrong-scope permission blocks the activity requiring it and gives remediation guidance; it never grants approval by default.
- A transporter cannot carry a restricted lot to a destination lacking valid receiving scope.
- Origin → pickup → transporter → receiving facility → processing batch → output/residual destinations is traceable end-to-end.
- Duplicate events, replay, late writes, conflicting weights, unit mismatch and over-capacity claims are rejected or quarantined with reason codes.
- Processing outputs reconcile to inputs within a documented material/process tolerance; no tolerance is invented where the process basis is missing.
- Reports trace to evidence and rule versions; synthetic fixtures cannot enter authoritative registries, settlements, EPR records or carbon claims.
- State/UT rule gaps and conflicts fail closed and are visible to a designated reviewer.
- CI tests migrations, tenant isolation, permissions, lifecycle transitions, idempotency, offline conflicts, quantity/mass balance, expiry, auditability and duplicate-evidence prevention.

## 11. Open questions that must remain explicit

- Complete current rule/notification/SOP matrix for each waste family and State/UT.
- Official portal API terms, permission and availability; no integration is assumed.
- Current local-body processes for BWG registration and EBWGR certificate issuance.
- Actual operator/site and authorised destination for any real pilot.
- Material-specific mass-balance tolerances and process-loss bases.
- Required languages and assisted-onboarding partners by rollout region.
- Production hosting/database identity, recovery rehearsal and release approval.

**Release posture:** engineering specification only. This document does not verify any participant or confer statutory registration, certificate, EPR credit, carbon credit, hardware approval or production readiness.


## 12. Existing architecture reuse — required before coding

The source audit is in [PAN_INDIA_WASTE_CHAIN_ARCHITECTURE_AUDIT.md](PAN_INDIA_WASTE_CHAIN_ARCHITECTURE_AUDIT.md). It confirms that RupayKg already has canonical organisations/identities/geography, hierarchical stakeholder applications, regulatory source/requirement catalogs, EPR scheme/obligation workflows, BWG/SWM preparation workspaces, and resource-flow/custody tables. Therefore the implementation must extend those components rather than introduce duplicate organisations, onboarding, compliance catalogs or waste ledgers.

In particular:
- Map the existing resource_flows and chain_of_custody_links writers/readers before deciding whether any new table is necessary.
- Keep BWG preparation/status tracking separate from official CPCB application/decision status.
- Treat existing collector-transporter and processor workspace types as a starting point only; define distinct operational permissions and scoped workflows without automatically granting legal authority.
- Reconcile regulatory_sources, regulatory_requirements, epr_schemes and existing applicability controls before adding any catalogue.
- Trace field-sync and MRV/evidence contracts before connecting new custody events to authoritative MRV.
- PR #51 contains proposed MRV hardening but is currently unmerged; do not rely on it as a main-branch or production capability.
