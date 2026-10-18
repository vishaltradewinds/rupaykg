# CPCB SWM 2026 — RupayKg MRV Mapping and Mobile-Prepared Work Plan

**Prepared:** 2026-10-18  
**Status:** Architecture/design proposal only; not an implementation, legal opinion, portal integration, or certification.  
**Repository:** `vishaltradewinds/rupaykg`  
**Branch:** `docs/cpcb-swm-2026-mrv-mapping`

## Executive decision

Build a compliance-support and evidence-reconciliation layer around the existing RupayKg MRV system. Do not create a parallel official registry, do not issue official certificates, and do not assume an API exists. The central portal and competent authorities retain their statutory functions. Missing, conflicting, or unverified facts must remain `UNRESOLVED` and must never be promoted to verified evidence by inference.

This document is intentionally additive. It does not modify application code, schemas, migrations, Guardian configuration, or live services.

## Authoritative source map

1. CPCB SWM 2026 user guide: https://swmp.cpcb.gov.in/en/user-guide
   - BWG registration prerequisites and flow, eligibility assessment, document upload, self-declaration, fee/payment, submission, authority review, corrections, approval/certificate download, rejection, amendment/appeal, grievances, event intimation, dashboard.
   - Facility registration includes layout plan, CTE, CTO, SPCB authorization, and environmental clearance as listed by the guide.
   - The guide documents user-facing workflows but does not document a public API in the reviewed sections. This is not proof that no private/authorized API exists.
2. Solid Waste Management Rules, 2026 official Gazette PDF: https://swm.cpcb.gov.in/images/solid-waste-management-rules-2026.pdf
   - Rule 1: effective 1 April 2026.
   - Rule 2: scope; certain waste streams such as industrial, hazardous, biomedical, e-waste, battery waste, and radioactive waste are addressed by separate rules. Route them to the correct regime rather than treating them as ordinary municipal solid waste.
   - Rule 3(i): BWG thresholds are alternatives: building floor area >= 20,000 sq.m.; water consumption >= 40,000 litres/day; or solid-waste generation >= 100 kg/day.
   - Rule 5: general waste-generator duties, including source segregation into four streams.
   - Rule 6(a): BWGs register with the concerned local body through the centralised portal; changes to submitted information/registration conditions must be notified.
   - Rule 6(b)-(g): handover/processing arrangements, wet/horticulture waste processing, relevant exemption/certificate provisions, EBWGR obligations, and engagement only with entities whose required registration exists.
   - Rule 6(h): BWG annual return by 30 June on the centralised portal concerning EBWGR obligations/certificates.
   - Rule 7(a),(c): relevant facility registration and facility quarterly/annual return duties; quarterly due date is the 15th of the first month after the quarter and annual returns by 30 June, subject to the precise scope and format in the Rule.
   - Rule 8: local-body/authorized collection and transport responsibilities, destination to registered processing facilities, certificate and return workflows.
   - Rule 10(1): only the local body is mandated to generate EBWGR certificates on the centralised portal. RupayKg must not represent its own evidence record as an official certificate.
   - Rule 10(3)-(5): certificate quantity is linked to solid waste collected, transported and sent to registered processors/recyclers; wet-waste certificate generation is contingent on processing-facility reports; relevant transactions are recorded in the portal.
   - Rule 39(36)-(38): local-body BWG identification/mapping and certificate scheme details; read together with the applicable current norms and guidelines.
3. These clauses are an initial mapping aid, not a complete legal interpretation. Validate exact definitions, exceptions, amendments, notifications, applicable CPCB norms, and jurisdiction-specific by-laws before turning a requirement into a customer-facing legal conclusion.

## Requirement-to-evidence mapping

| Requirement / workflow | RupayKg support record | Minimum evidence / validation | Boundary |
|---|---|---|---|
| BWG screening | Organization/site assessment version | Floor area source; water bill/period; waste generation records/period; assessor and date | Screening only; preserve each input and source; never infer eligibility from missing values |
| Registration readiness | Checklist and submission packet | Portal-required documents, declarations, submission receipt/status where user supplies them | Official submission and status remain in the CPCB portal |
| Generator waste ledger | Waste batch / collection event | Generator/site, waste stream, quantity + unit, measurement method, date/time, source record | Separate measured facts from estimates |
| Collection and custody | Custody-transfer event | Collector/transport operator identity, relevant registration evidence, handover receipt, timestamp, quantity, source/destination | Missing handover or invalid registration = unresolved exception |
| Transport | Movement event | Origin, destination, carrier, dispatch/receipt time, quantity, vehicle/consignment evidence where applicable | No fabricated GPS or location evidence |
| Facility receipt and processing | Facility receipt + processing event | Facility identity/registration evidence, received quantity, stream, processing quantity, rejects/residuals, supporting weighbridge/operation record | Do not mark processed based only on dispatch |
| EBWGR reconciliation | Obligation vs evidenced quantities report | Source quantities, applicable norm/methodology version, certificate reference supplied/verified from authorized source, mismatch report | RupayKg does not mint or substitute for local-body certificates |
| Annual return preparation | Draft report and evidence manifest | Period coverage, required fields/format version, missing items, reconciled totals | Draft/export support only until accepted by portal/authority |
| Facility quarterly/annual return support | Facility reporting pack | Inbound quantities, processed quantities, rejects/residuals and relevant source records | Confirm exact reporting format and deadlines against current rules |
| Amendment / grievance / event | Case tracker | Official reference, submitted content, timestamps, status evidence | User-authorized recordkeeping; no unattended official submission |
| Carbon/EPR claims | Separate methodology-specific assessment | Approved methodology, boundary, additionality where relevant, monitoring and verification evidence, registry status | SWM compliance evidence alone does not establish carbon-credit eligibility |

## Proposed evidence lifecycle

1. **Captured** — entered or uploaded, source and actor recorded.
2. **Validated structurally** — required fields, units, time range, file type and references checked.
3. **Cross-checked** — compared against independent counterpart record where available.
4. **Reconciled** — quantities and custody links agree within explicitly configured, justified tolerances.
5. **Verified** — only after the project's approved verification process and required independent evidence exist.
6. **Unresolved / rejected / superseded** — explicit status with reason and audit trail.

Do not collapse these states into a single boolean. Preserve raw source evidence, derived calculations, assumptions, human decisions and third-party attestations as distinct record types. Corrections should append a traceable revision rather than silently overwrite historical evidence.

## Suggested domain concepts (proposal, not current schema assertion)

- Organization and Site
- Regulatory Applicability Assessment (threshold inputs, source references, rule/methodology version, outcome, reviewer)
- Waste Stream and Waste Batch
- Weighing / Measurement Record
- Custody Transfer and Transport Movement
- Facility Receipt and Processing Batch
- Evidence Artifact (hash, media type, origin, timestamp, uploader, access classification)
- Registration / Authorization Reference (issuer, identifier, validity period, verification source/status)
- Obligation Period and Reconciliation Run
- Official Certificate Reference (issuer, certificate ID, period, quantity, source/verification state; never generated by RupayKg)
- Return / Submission Reference (draft, user-submitted, portal-acknowledged, authority-approved states)
- Exception / Grievance / Amendment Case
- Audit Event and methodology/rule version history

Before coding, map these concepts to the existing database and MRV models. Reuse compatible entities and flows; do not create duplicate tables or competing truth sources.

## Validation rules and negative cases

- Each quantity has a numeric value, unit, stream, measurement period/time, source and attribution.
- Conversions are explicit, deterministic, tested and retain the original unit/value.
- A receipt cannot silently exceed the related dispatch quantity; legitimate differences require a documented exception and reconciliation.
- A processing claim requires a receipt/processing source; dispatch alone is not processing proof.
- A certificate reference requires an issuer and verifiable reference evidence; an internal ID is not an official certificate.
- Duplicate artifact hashes and duplicate source references are flagged for review; do not auto-delete records.
- Missing authorization, expired registration, wrong facility category or separate-rule waste stream blocks a clean-compliance result.
- Unmatched movements, missing processing reports, conflicting weights, out-of-period evidence and late returns are surfaced as exceptions.
- Rule, threshold and reporting format changes are versioned with effective dates; prior assessments remain reproducible.
- Tenant/site authorization and evidence access are checked on every relevant read/write path.
- No data is posted to CPCB without verified authorization, supported interface, explicit user approval and audit logging.

## API / integration discovery gate

**Current status: not verified.** No public API has been established by the reviewed user guide.

Before any automated connection:
1. Request official API/interface documentation, sandbox details, onboarding procedure, authorization model, permitted data scope, rate limits, support contact and change/version policy from CPCB.
2. Obtain written approval from the competent authority and, where necessary, participating local bodies.
3. Validate legal basis, consent/notice where required, data minimization, retention, deletion, security, audit, incident response and user authorization.
4. Use documented interfaces only. Do not bypass CAPTCHA, OTP, access controls, or imitate a human session for unattended submission.
5. Until approval exists, support user-controlled export and evidence-pack preparation only.

## Pilot plan

**Pilot scope:** one willing BWG, one authorized collection/transport participant, and one registered processing facility. Do not use fictitious production records.

1. Confirm each participant's legal status and the site/waste streams in scope.
2. Collect a bounded sample period of source records (generator logs, collection receipts, weighbridge tickets, facility receipt/processing records).
3. Capture every handoff and preserve original evidence plus hashes and timestamps.
4. Reconcile generated, collected, transported, received, processed and residual quantities by stream and period.
5. Have a designated reviewer investigate mismatches; never silently normalize them.
6. Compare the generated report with the applicable official return format and have a qualified compliance reviewer assess it.
7. Record acceptance criteria, defects, false positives, missing evidence, user effort, and all unresolved issues.
8. Release only after security, authorization, data integrity, auditability and operational gates pass.

## Acceptance gates

- [ ] Legal rule/definition and reporting format reviewed against current authoritative sources.
- [ ] Existing RupayKg schema and MRV lineage mapped; no duplicate source of truth.
- [ ] Role/tenant authorization tests pass.
- [ ] Evidence provenance and immutable audit trail verified.
- [ ] Duplicate, mismatch, missing-evidence, expired-registration and out-of-period tests pass.
- [ ] Quantities reconcile deterministically with traceable calculations.
- [ ] No internal evidence is labelled as official CPCB/ULB certificate.
- [ ] Official API authorization verified in writing before integration.
- [ ] Pilot reviewed by participating users and compliance reviewer.
- [ ] Guardian authentication and the independent live WA03.001 acceptance requirements remain separately required; this work does not clear them.

## Immediate continuation when PC is online

1. Inspect the local working tree before editing; preserve all pre-existing modifications.
2. Read existing MRV route, schemas, migrations, evidence lineage and tests.
3. Produce a file-by-file mapping to the above requirements and identify gaps using actual code, not assumptions.
4. Implement only the smallest reviewed additive change on a dedicated branch; add tests for fail-closed and reconciliation behavior.
5. Run relevant typecheck, unit tests, migrations validation and full test suite as practical; record exact commands/results.
6. Keep the CPCB mapping document and this plan in the same reviewable PR if appropriate; do not deploy or claim certification without acceptance evidence.

## Suggested CPCB inquiry (draft only; not sent)

**Subject:** Request for official SWM 2026 portal integration documentation and authorization process

Dear CPCB SWM Portal Support,

We are evaluating a compliance-support and waste-evidence reconciliation system intended to help participating waste generators and authorized service providers prepare traceable records and reports while retaining all statutory decisions and official certificates within the CPCB/local-body process.

Please advise whether an officially supported API or other machine-to-machine integration interface is available for the SWM 2026 Centralized Online Portal. If available, kindly share the official documentation, sandbox/onboarding procedure, authorization and data-sharing requirements, security controls, and applicable terms. If no such interface is available, please confirm the permitted methods for user-controlled document export and any restrictions on third-party compliance-support tools.

We will not automate portal submissions or access protected workflows without the required written authorization.

Regards,  
RupayKg Team

**Official portal helpdesk shown on the CPCB portal:** swmportal.cpcb@gov.in (the current portal page also renders this address in obfuscated form). Source: https://swmp.cpcb.gov.in/en and https://swm.cpcb.gov.in/.

**Status of draft:** prepared for review only; not sent. Contact address was verified from the official portal page, but sending remains a separate action and has not been performed.
