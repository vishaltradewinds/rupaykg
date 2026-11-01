# BWG Statutory Authority and Evidence Boundary

**Status:** Engineering control specification; not a legal opinion.  
**Applicable source:** Solid Waste Management Rules, 2026, S.O. 388(E), Gazette of India, published 28 January 2026; effective 1 April 2026.  
**Official Gazette PDF:** https://moef.gov.in/uploads/pdf-uploads/pdf_69a16e3b04c107.91022257.pdf  
**Official MoEFCC rules index:** https://moef.gov.in/rules-regulations-3

## 1. Statutory facts that the platform must preserve

1. Rule 3(1)(i) defines a bulk waste generator (BWG) by at least one criterion: building floor area of 20,000 sq. m. or above; water consumption of 40,000 litres per day; or solid waste generation of 100 kg per day. The definition applies to the enumerated institutional, commercial and residential-society categories.
2. Rule 6(a) requires every BWG to register with the concerned local body through the centralised online portal. The registration certificate specifies conditions for the registration to remain valid; changes in registration information or conditions must be notified to the local body.
3. Rule 6(b)-(m) establishes operational duties including collection/hand-over, wet-waste and horticulture processing, Extended Bulk Waste Generator Responsibility (EBWGR), use of registered entities, annual returns and residual-waste handling.
4. Rule 6(h) requires annual returns by 30 June each year on the centralised online portal; returns are submitted to the local body for further processing and are made publicly available through the local body's website.
5. Rule 10(1) states that **only the local body** is mandated to generate EBWGR certificates on the centralised online portal. RupayKg must not mint, issue, simulate or represent an internally generated token as an official EBWGR certificate.
6. Rule 16 assigns the Central Pollution Control Board (CPCB) responsibility to establish and operate the centralised online registration/annual-return system. Rule 16(4) requires State Pollution Control Boards and local bodies/authorities to use it. Rule 16(8) allows CPCB to charge fees for portal use, subject to its guidelines.
7. Rule 39(36) requires Urban Local Bodies to identify BWGs through detailed survey, update the list on the portal annually by 1 April and geotag identified BWGs.
8. Rule 39(37)-(38) assigns local bodies responsibility for notifying EBWGR certificate costs and issuing those certificates under the prescribed scheme. Rule 39(40) requires local bodies to report waste generation and collection monthly on the centralised portal.

## 2. Authority boundary

| Actor | Authoritative responsibility | RupayKg treatment |
|---|---|---|
| BWG / entity | Supplies its registration application, measurements, declarations and annual-return data | Store as declared/submitted evidence; never self-verify |
| Concerned local body | Receives BWG registration through the portal; issues the registration certificate and sets conditions; processes annual returns; issues EBWGR certificates | Record external authority, certificate reference, status and receipt; preserve source provenance |
| CPCB | Establishes and operates the centralised portal; issues norms/guidelines and operates the national data repository | Treat official portal as the statutory system of record |
| SPCB/PCC | Performs duties and oversight allocated by the Rules; uses the centralised portal | Record only its actual statutory actions/communications |
| RupayKg | Supplementary digital MRV, evidence, reconciliation, workflow and audit-trail infrastructure | Never impersonate the portal, local body, CPCB or SPCB/PCC |

RupayKg is not the statutory registration authority and is not a substitute for the CPCB centralised portal or local-body determination.

## 3. Required application states

- `DECLARED`: organization has submitted measurements or claims.
- `SCREENING_ONLY`: deterministic threshold screen has been calculated for internal routing; it is not a statutory determination.
- `REVIEW_REQUIRED`: external registration / authority evidence is outstanding.
- `REGISTRATION_SUBMITTED`: a portal submission reference is recorded, but no certificate has been verified.
- `REGISTERED_EXTERNALLY_UNVERIFIED`: a certificate reference/document is user-reported; authenticity and status have not been confirmed.
- `REGISTERED_EXTERNALLY_VERIFIED`: certificate has been verified against an authoritative source or by a separately authorized local-body verification process, with provenance retained.
- `CONDITIONS_CHANGED`, `SUSPENDED`, `EXPIRED`, `CANCELLED`: authority-reported lifecycle changes; do not infer from missing data.

Do not use `VERIFIED` to mean "the threshold calculation ran successfully." Threshold screening and statutory registration are separate concepts. Do not promote an organization-submitted profile or internal assessment into `REGISTERED_EXTERNALLY_VERIFIED`.

## 4. Minimum registration evidence record

Retain:
- organization and legal-entity identifiers;
- concerned local body and jurisdiction/geography identifier;
- each threshold measurement, unit, measurement period, source and evidence artifact;
- rule version and exact clause used for screening;
- portal submission reference and submission timestamp, if supplied;
- registration certificate number, issuing local body, issue date, validity/renewal dates and stated conditions;
- original certificate/document and cryptographic hash;
- source portal URL/export/receipt or authority correspondence;
- verification method, verifier identity/role, verification timestamp and outcome;
- amendments/condition changes and their authority evidence.

A user-uploaded certificate without authoritative confirmation remains user-reported and unverified.

## 5. EBWGR certificate boundary

- Only the local body issues EBWGR certificates on the centralised portal.
- RupayKg may record, validate structural fields, reconcile waste quantities and evidence, and link a verified local-body certificate to the obligation.
- RupayKg must never generate an official-looking EBWGR certificate, assign a false authority number, mark its own calculation as issued, or assert acceptance without the official portal receipt.
- Local-body costs/fees are not RupayKg prices. The platform must not assume certificates are free; Rule 10(7)-(8) and Rule 39(37)-(38) assign cost-setting/collection to local bodies under applicable guidelines and approvals.

## 6. Integration gates

1. Confirm current CPCB portal production availability and official BWG module/registration workflow; this document does not assume availability merely because Rule 16 set a six-month establishment timeline.
2. Obtain the official integration/API/export specification and authorization from CPCB/local body before connecting. Do not scrape, automate or submit on behalf of an entity without explicit legal/technical authorization.
3. Confirm the local body's jurisdiction, certificate issuer identity and delegated roles.
4. Implement source-authenticated receipt ingestion, signature/hash validation where available, replay protection and immutable audit records.
5. Keep annual-return validation distinct from statutory submission and local-body processing. Record each state separately: prepared, submitted, received, under review, validated, accepted/rejected.
6. Keep EBWGR certificate generation disabled in RupayKg; only ingest local-body-issued certificates.
7. Do not unlock statutory reporting or certification merely because a local calculation or evidence upload completed.

## 7. Current engineering release posture

- Profile intake must remain `REVIEW_REQUIRED` / `PENDING`.
- Reporting-period creation remains fail-closed until the externally authoritative BWG registration/applicability gate is met.
- The statutory assessment handler, where used, is internal preparation only.
- No production migration, data mutation, deployment, external portal submission or certification is authorized by this engineering change.
- Before implementation of the external authority workflow, perform a fresh legal and portal integration review against the then-current Gazette, CPCB directions, local-body by-laws and official portal specifications.


## 8. Live CPCB portal verification — 2026-11-01

The CPCB Centralised Portal for Solid Waste Management is live and exposes a BWG registration flow. This is no longer an assumed future dependency.

Official resources inspected:
- Portal: https://swm.cpcb.gov.in/
- BWG sign-up: https://swm.cpcb.gov.in/register
- User guide: https://swmp.cpcb.gov.in/en/user-guide
- FAQ: https://swmp.cpcb.gov.in/en/faq
- CPCB resources / fee guidelines: https://swmp.cpcb.gov.in/en/resources

Observed official portal process:
1. Create an organization account with authorized representative contact details and OTP verification.
2. Complete the BWG application and eligibility assessment.
3. Upload supporting documents and attest the self-declaration.
4. Save a draft or proceed to fee payment and submit.
5. After submission, application status is Under Review with the appropriate ULB / District Panchayat; applicant can track status and download the acknowledgement receipt.
6. The applicant may respond to authority remarks, corrections or rejection and download the registration certificate after approval.

The portal FAQ states registration is organization-specific and ULB-specific. It also says an authorized representative may submit for the organization, but details are validated by the concerned local body. Account creation alone does not complete registration. Approval timelines depend on the concerned authority's review.

The CPCB resources page lists a "User Fee Structure" guideline for use of the centralised portal, dated 15 October 2026. Rule 16(8) permits CPCB to charge portal fees. The actual fee schedule amount has not been verified in this audit; therefore no RupayKg business model, customer quote or statutory workflow may assume portal registration/annual-return use is free. RupayKg service pricing and statutory CPCB/local-body fees must remain separate and transparent.

### Immediate implementation decision

- Do not build a parallel BWG registration portal or claim that RupayKg itself registers an entity.
- Implement a guided hand-off to the official CPCB portal and retain application/acknowledgement references.
- Ingest the final local-body registration certificate and authority status only through a documented, authorized integration or evidence-backed verification procedure.
- Keep draft, submitted, under-review, correction-required, rejected and registered states distinct.
- Never infer approval from account creation, eligibility assessment, document upload, payment, or acknowledgement receipt.
- Before any browser automation/API integration, obtain and review CPCB's official integration specification, authorization terms and permitted data access. The user-facing portal is not itself proof that an API or automated submission permission exists.


## 9. Portal fee treatment — official CPCB FAQ verification

The CPCB portal FAQ states that all non-government BWGs and Waste Facilities are required to pay a fee for registration and filing annual returns. The FAQ separately states that government entities such as ULBs, District Panchayats and Gram Panchayats are not required to pay registration fees.

Sources:
- Official CPCB portal FAQ: https://swmp.cpcb.gov.in/en/faq
- Official CPCB resources page lists the User Fee Structure guideline dated 15 October 2026: https://swmp.cpcb.gov.in/en/resources

Implementation rules:
- Never advertise statutory CPCB registration or annual-return filing as universally free.
- Keep CPCB portal fees separate from RupayKg subscription, service or implementation charges.
- Before quoting any statutory fee, retrieve the current CPCB fee guideline and confirm the entity category, fee basis, effective date, payment stages, amendment/differential fees and applicable exemptions.
- Do not hard-code a fee amount from secondary summaries or infer that a registration-fee exemption also waives annual-return fees.
- RupayKg may show an informational statutory fee notice and link to CPCB; the applicant pays CPCB through the official portal.
