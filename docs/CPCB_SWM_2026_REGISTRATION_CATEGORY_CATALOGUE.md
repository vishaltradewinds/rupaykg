# CPCB SWM 2026 Registration Category Catalogue for RupayKg

**Status:** Implementation catalogue based on the public CPCB SWM 2026 home page, user guide and FAQ, reviewed 2026-10-19. This is not CPCB approval or a substitute for an authorized walkthrough of authenticated forms.

Official sources:
- Portal: https://swmp.cpcb.gov.in/en
- User guide: https://swmp.cpcb.gov.in/en/user-guide
- FAQ: https://swmp.cpcb.gov.in/en/faq
- Rules 2026: https://swmp.cpcb.gov.in/img/cpcb_doc/solid-waste-management-rules-2026.pdf

## 1. Do not confuse account categories with all waste-chain participants

The public user guide documents five direct registration categories in the portal's registration flow. Several authority roles are officially onboarded or provisioned instead of using open self-registration. Other waste-chain participants need RupayKg operational workspaces, but must not be falsely labelled as CPCB portal registration categories.

| RupayKg category key | Official category / role | How the official portal documents access | RupayKg behaviour |
|---|---|---|---|
| `BWG` | Bulk Waste Generator | Applicant selects BWG, verifies contact channels, completes eligibility assessment, uploads documents and submits to ULB/DP | BWG checklist and OR-threshold pre-check; official status remains unverified until source evidence is reviewed |
| `WASTE_FACILITY` | Waste Facility | Applicant selects Waste Facility and a facility type, then completes the application | Facility-specific readiness; require selected facility subtype before claiming the facility profile is complete |
| `ULB` | Urban Local Body | Nodal officer self-registers; registration is reviewed by DM | Jurisdiction-scoped authority workspace; no authority actions without verified role and permission |
| `DISTRICT_PANCHAYAT` | Rural Local Body — District Panchayat | Nodal officer self-registers; registration is reviewed by DM | Rural district authority workspace; do not route through urban ULB by default |
| `GRAM_PANCHAYAT` | Rural Local Body — Gram Panchayat | Nodal officer self-registers; registration is reviewed by DM | Rural local authority workspace; maintain verified village/GP jurisdiction |
| `SPCB_PCC` | State Pollution Control Board / Pollution Control Committee nodal officer | Guide says nodal officer requests onboarding from CPCB; official credentials are shared after onboarding | Record onboarding evidence and State/UT scope; do not offer public authority self-registration |
| `DISTRICT_MAGISTRATE` | District Magistrate | Guide says DM requests onboarding through UDD/RDD or CPCB and supplies State, district and district code | Record official onboarding evidence and district scope; DM handles documented Level 1 appeal workflow |
| `REGIONAL_OFFICER` | Regional Officer | Created by authorized SPCB/PCC user management | Provisioned child account only; require verified parent SPCB/PCC, region and assigned scope |
| `CPCB_CENTRAL` | CPCB central authority | Public guide does not document public self-registration for this role | Restricted/provisioned workspace only; require official provisioning and explicit access scope |
| `COLLECTOR_TRANSPORTER` | Waste collector / transporter | Not presented as one of the direct account categories in the public manual reviewed; portal guidance says collection agencies should coordinate with their ULB/RLB | Operational participant and evidence chain; do not imply CPCB portal account or registration |
| `PROCESSOR` | Processor / recycler / downstream operator | Not a separate direct account category in the public registration flow; eligible facility operators use Waste Facility and select a facility type | Operational role linked to facility and authorizations; never substitute for required Waste Facility registration |
| Public grievance/event participant | Citizen, complainant, event organizer or venue operator | Public-facing grievance/event-intimation routes are documented; not a general portal registration category in the manual reviewed | Separate grievance/event case workflows, no invented regulator account |

**Important:** CPCB's public guide supports the role and onboarding distinctions above, but the exact registration-category list and form fields should be rechecked against the live Register screen during an authorized walkthrough. Do not represent a RupayKg account as an official CPCB account.

## 2. Waste Facility subtypes to model

The CPCB home page describes facility categories including:
- Refuse-Derived Fuel (RDF) facility
- Material Recovery Facility (MRF)
- MRF-cum-RDF facility
- Compressed Biogas (CBG) / biogas plant
- Compost facility
- Waste-to-Energy facility
- Integrated Solid Waste Management facility
- Co-processing facility
- Common biomedical waste processing facility (biomedical waste itself is governed under its separate regime)
- Sanitary landfill
- Waste collection agency
- Incinerator facility

These are **facility subtypes**, not additional top-level self-registration categories. Store subtype separately from the broad `WASTE_FACILITY` account category. Where the live portal's current dropdown labels differ, capture the exact label, source date and official reference rather than silently normalizing it.

The user guide lists the following facility-document prerequisites: facility layout plan, Consent to Establish (CTE), Consent to Operate (CTO), SPCB/PCC authorization and Environmental Clearance. The applicability of each item must be confirmed for the specific facility, jurisdiction and legal regime; the checklist must support `NOT_APPLICABLE` with reviewer rationale, not silently waive a requirement.

## 3. BWG eligibility pre-check

Treat these published thresholds as alternative OR criteria:
- floor area >= 20,000 m²; OR
- water consumption >= 40,000 litres/day; OR
- waste generation >= 100 kg/day.

RupayKg requires sourced values and measurement periods and labels the result a preliminary readiness aid. The official portal and competent authority determine eligibility/registration. The FAQ says registration is organization-specific and ULB-specific; each qualifying organization/facility must register separately as applicable.

## 4. Required platform controls

1. Use a canonical, versioned category registry; do not scatter hard-coded category names across frontend, API and database.
2. Separate `registration_category`, `facility_subtype`, `operational_participant_type`, `authority_role` and `account_provisioning_mode`.
3. Every category has: official label/source URL, source version/effective date, onboarding mode, required fields/documents, responsible reviewer, jurisdiction, allowed actions, state machine, return/report obligations and evidence rules.
4. Do not allow a user to grant themselves a regulator role or verify their own documents.
5. Keep official CPCB state distinct from RupayKg local preparation state. User-entered status and references remain `USER_REPORTED_UNVERIFIED` until a defined source-verification process records who verified what and when.
6. Do not automate CAPTCHA/OTP, use official credentials, or transmit submissions unless written authorization and an approved technical interface are established.
7. Maintain separate legal-regime workflows for industrial, hazardous, biomedical, e-waste, battery and radioactive waste where applicable.
8. Carbon MRV and any official Carbon Credit Certificate process remain separate: SWM registration, waste movement, and internal calculations do not themselves create credits or an official certificate.

## 5. Implementation status and next engineering gate

This catalogue accompanies the CPCB SWM ecosystem map PR. The current implementation adds authority workspace categories for SPCB/PCC, DM, Regional Officer and CPCB central, plus canonical evidence checklists and UI selection. The migration and CI must pass before this change is considered validated. The workspace now stores the facility subtype separately, but the category options/checklists are still code-defined rather than loaded from a centralized, versioned registry. Build that registry and complete the authorized field-by-field walkthrough before claiming exact parity with the live registration UI.

The public guide documents applicant workflows for BWG and Waste Facility; ULB; District Panchayat; Gram Panchayat; SPCB/PCC; and DM. The guide also describes Regional Officer provisioning through SPCB/PCC user management. Authenticated screens were not available for inspection; do not claim field-by-field parity until an authorized walkthrough is completed.
