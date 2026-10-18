# CPCB SWM 2026 — Exact Workflow Conformance Matrix for RupayKg

**Prepared:** 2026-10-18  
**Status:** Repository alignment specification; not a claim of live CPCB integration or legal certification.  
**Repository:** vishaltradewinds/rupaykg  
**Branch:** docs/cpcb-swm-2026-mrv-mapping  
**Authoritative portal guide:** https://swmp.cpcb.gov.in/en/user-guide  
**Official portal:** https://swmp.cpcb.gov.in/en

## 1. Alignment objective

RupayKg must follow the real SWM 2026 portal's actor roles, sequence, states, required evidence and hand-offs. It must not replace the CPCB portal or local-body/authority decisions. A RupayKg task is a readiness, evidence, workflow mirror, reconciliation or reminder unless an official interface is documented and written authorization is confirmed.

The official user guide is the source for portal screens/actions. The SWM Rules, 2026 and current applicable norms govern legal duties, reporting deadlines and certificate authority. Where the guide does not expose a form field, status, return schema, API or rule interpretation, mark it NEEDS OFFICIAL CONFIRMATION; do not invent one.

## 2. Official workflow lanes

### A. Bulk Waste Generator (BWG) registration — applicant lane

1. Pre-check: collect organization/site identity and authorized person details. Check evidence readiness for the guide's prerequisites: Property Tax Document or Building Approval Plan and Water Consumption Bill. Preserve document date, issuer, site association and validity/period.
2. Eligibility assessment: capture floor area (m²), water consumption (L/day), and solid-waste generation (kg/day), each with source and measurement period. Eligibility is met if any one of floor area ≥ 20,000 m², water ≥ 40,000 L/day, or waste ≥ 100 kg/day. Missing values are UNKNOWN/UNDER_REVIEW, not zero. Allow the user to correct inputs before proceeding.
3. Account creation: portal category Bulk Waste Generator; organization name and authorized-person name/designation/email/mobile; CAPTCHA; OTP verification for registered mobile/email; password setup. RupayKg may prepare a checklist and deep-link the user, but must not collect or replay CAPTCHA/OTP or portal passwords.
4. Portal login: password + CAPTCHA or OTP login. This remains a user-controlled portal action unless CPCB provides a sanctioned integration.
5. My Applications: user starts a new form or resumes an existing draft. RupayKg should track a separate local preparation record and the user-supplied portal application reference; do not pretend a local draft is the portal draft.
6. Application form: preserve entered organization/site and eligibility facts, required declarations and required form data. Exact dynamic form fields not documented here must be obtained from the current portal UI/helpdesk; do not infer them.
7. Documents: checklist, upload readiness, self-declaration acknowledgement, versioned file/hash and user confirmation. Support Save as Draft equivalent only within RupayKg; portal save remains user-controlled.
8. Fee and submission: guide says Save & Proceed, then Pay & Submit; payment may be required. RupayKg must not collect portal fees or mark an application submitted based only on an internal action.
9. Submitted: capture user-supplied acknowledgement/receipt, submission timestamp, portal reference and a copy/hash of the receipt. Status becomes UNDER_REVIEW with the appropriate ULB/District Panchayat as described by the guide.
10. Correction requested: capture authority remarks, requested fields, due date if officially provided, and prior submission snapshot. The guide describes one round of correction at this stage. User edits, confirms updated evidence, and performs the portal's Save & Proceed / differential fee / Pay & Submit actions. Record the new acknowledgement; never overwrite the old version.
11. Approved: only after the official portal status/certificate is supplied and verified. Store issuer, registration/certificate reference, issued date, scope, source, verification status and evidence. Link to official downloaded certificate; do not generate a substitute.
12. Rejected: preserve rejection category and authority remarks. The guide distinguishes incorrect details and Environmental Compensation (EC) non-compliance. Present only the corresponding actions available on the portal.
13. Take Action after rejection:
    - File Amendment: for incorrect details, provide details of incorrect information; for EC non-compliance, provide EC payment details as required by the portal. The application reopens for correction, amendment fee may apply, and resubmission is reviewed by the District Magistrate (DM), per guide.
    - Log Appeal (Level 1): capture justification and supporting documents. The guide says the appeal goes UNDER_REVIEW with the DM.
    - Do not auto-select or file either route. Require user review and action.
14. Dashboard: display organization details, waste-generation data and registration status, with source and last-confirmed timestamp. Distinguish portal-observed/user-provided values from local operational values.
15. Grievance: user initiates Raise Grievance, tracks under My Grievances; store reference, content/evidence, submitted receipt and subsequent status updates.
16. Event Intimation: user initiates Intimate Event, and tracks My Events; preserve event reference, event date/type/details exactly as supplied by the official workflow and confirm any field list against current portal form.

### B. Waste Facility registration — applicant lane

1. Register as Waste Facility, choose the portal's facility type, and provide organization/authorized-person details; CAPTCHA, OTP and account setup are portal-controlled.
2. Registration evidence prerequisites listed in the guide: Facility Layout Plan, Consent to Establish (CTE), Consent to Operate (CTO), SPCB authorization, and Environmental Clearance. Applicability and exceptions must be verified with the competent authority; do not mark a document as legally required or not required by inference.
3. Start/resume the application in My Applications; capture facility identity, type, location, capacity/process/waste-stream data only as present in the official form.
4. Complete application, upload documents, save draft if needed, then follow portal Save & Proceed and Pay & Submit flow.
5. Capture official acknowledgement and UNDER_REVIEW state with ULB/DP.
6. Process CORRECTION_REQUESTED with authority remarks, revised documents and any differential fee; retain every version.
7. On APPROVED, capture the official registration certificate and its verified scope/validity. On rejection, preserve reason and follow portal's amendment or Level 1 appeal path; guide says amendment/appeal is reviewed by DM.
8. Support facility dashboard, grievance and event-intimation workflows exactly as applicant lane A. Do not treat facility approval as proof of each later waste receipt or processing batch.

### C1. Urban authority rail — ULB → Ward → generator/collector/facility

- Urban governance is anchored to the competent Urban Local Body (Municipal Corporation, Municipal Council or Nagar Panchayat) and its wards. Do not substitute Gram Panchayat or village hierarchy in an urban tenant.
- The CPCB portal ULB role covers jurisdictional review of BWG and waste-facility applications, official approve/correction/reject actions with remarks, dashboard visibility, grievances and event intimations as defined by the portal.
- RupayKg's urban operational workflow should connect generator/site → ward and collection route → collector/vehicle → transfer/MRF or registered facility → receipt/processing evidence → ward/ULB reconciliation. Treat daily/high-frequency collection, route/vehicle/scale evidence, four-stream segregation, facility capacity and ward-level exceptions as urban operating concerns; use only fields and duties applicable to the actual service and rules.
- ULB review, field verification, regulatory decisions and official EBWGR certificate issuance remain authority-controlled. RupayKg can prepare evidence and reconcile quantities but cannot issue the official certificate or claim that a portal decision occurred without official evidence.

### C2. Rural authority rail — Gram Panchayat / District Panchayat → village / block

- Rural governance is anchored to the actual Rural Local Body (Gram Panchayat and/or District Panchayat as applicable to the CPCB portal role and jurisdiction). Preserve the hierarchy Gram Panchayat → village, with District Panchayat / district-level oversight where applicable. Do not route rural cases through a ULB or ward by default.
- The official CPCB guide explicitly provides separate Gram Panchayat and District Panchayat account/workflow roles. Rural Local Body registration is reviewed by the District Magistrate; the applicable role's exact screens, fields and hand-offs must follow the current portal guide, not an urban assumption.
- RupayKg's rural operational workflow should connect farmer/household/FPO/SHG or other verified source → village collection/aggregation point → weigh/quality and custody evidence → rural carrier or bulk aggregator → eligible processor/biomass buyer → receipt/processing evidence → Gram Panchayat/village-cluster reconciliation and payout where contracted.
- Rural dashboards should emphasize village and collection-centre inventory, seasonal availability, dispersed pickup, aggregation, moisture/quality where relevant, transport consolidation, producer/FPO participation and village-level exceptions. Crop residue, biomass, animal waste, biochar, compost, biogas and carbon activities are RupayKg rural modules only where the material, activity and claim are lawful and eligible; do not automatically label every biomass movement as CPCB SWM 2026 compliance or EBWGR evidence.
- The CPCB SWM 2026 rural-local-body workflow and any separate biomass/carbon programme must be cross-linked only where the legal scope, waste stream, receiving party, authority and evidence chain match. Keep separate regulatory classifications and registries where they do not match.

### C3. Shared authority safeguards and symmetry

- Urban and rural rails must have equal evidence integrity, auditability, exception handling, role-based access, grievance/event tracking and fail-closed status semantics. Symmetry means equivalent governance quality, not identical screens, metrics or collection methods.
- Authority account onboarding, login, jurisdiction and permissions remain within CPCB's portal process. RupayKg must not impersonate authority users or perform official decisions.
- Preserve official decision, reviewer/authority identity as displayed, jurisdiction, remarks, decision time and supplied supporting evidence. Dashboard values must identify their source and last-confirmed timestamp.
- Expose an authority-side workflow in RupayKg only when the participating authority has explicitly authorized it and role/data permissions are established. Otherwise offer readiness, evidence, reporting and reconciliation support only.
- Never infer a local body's jurisdiction from a place name alone; require a verified organization/jurisdiction mapping and retain its source.
 
### D. District Magistrate (DM) — appeal/amendment lane

- The guide describes DM onboarding through the appropriate department/CPCB and jurisdiction mapping.
- Level 1 appeals and amendments routed after rejected applications are reviewed by DM according to the relevant workflow.
- RupayKg may assemble a versioned appeal/amendment evidence pack and track user-provided references/status. It must not decide appeals, alter authority decisions or represent a case as accepted without official evidence.

### E. SPCB / PCC — state oversight lane

- The guide says SPCB/PCC nodal officers are onboarded through CPCB; regional officer user management is available to authorized officers.
- SPCB/PCC can review state-level BWG/facility registrations, respond to facility Level 2 appeals, view state-level dashboards/revenue/grievance analytics, and handle relevant grievances/event intimations as described by the manual.
- Model jurisdictional read scope and authority decisions separately from generator records. No statewide visibility or privileged authority role is assumed by default.

### F. CPCB / central oversight lane

- CPCB operates the centralized portal and publishes applicable rules/norms. Any connector must be based on a documented, approved interface and authorization scope.
- No direct CPCB API, API credentials, schema, sandbox or automated submission mechanism has been verified in this repository audit.
- Until CPCB confirms a supported integration, provide official-source links, user-controlled export/import, acknowledgement/certificate capture and evidence-pack preparation only.

## 3. Operational duties and recurring reporting

These are regulatory/operational lanes, not assumed portal screens. Exact current formats and applicability must be validated against the Rules, CPCB norms, and local by-laws.

- Four-stream source segregation: Wet, Dry, Sanitary, Special Care. Record stream-specific quantity, source, timestamp, measurement method, handover and receiving party. Do not merge streams in a way that destroys traceability.
- Collection and transport: record handover from generator, authorized collector/carrier where applicable, consignment/movement, dispatch and receipt quantities, dates, source/destination, vehicle/scale records when available. No fabricated GPS.
- Registered facility receipt and processing: confirm the receiving facility's registration/authorization scope and validity; link received quantity to the dispatch; record processed quantity, rejects/residuals and source evidence. Dispatch alone is not proof of processing.
- BWG annual return: Rule 6 includes annual return due 30 June concerning EBWGR obligations/certificates. Provide a draft/reporting checklist and evidence reconciliation; official filing and acceptance remain in the portal unless an authorized API is confirmed.
- Facility quarterly/annual reporting: Rule 7 includes applicable facility quarterly and annual returns; the quarterly due date described in the Rules is the 15th of the first month after the quarter, and annual returns by 30 June, subject to precise applicability and current formats. Track reporting periods and due dates with effective-dated rule metadata.
- EBWGR certificates: under Rule 10(1), the local body—not RupayKg—is mandated to generate official EBWGR certificates in the centralized portal. RupayKg may track the official certificate reference and reconcile quantities. Relevant quantities relate to waste collected, transported and sent to registered processors/recyclers; wet-waste certificates depend on processor reporting as specified by the Rules.
- Separate-rule streams: industrial, hazardous, biomedical, e-waste, battery and radioactive streams may be governed by separate regimes. Flag and route to the correct compliance regime; do not treat all material as ordinary SWM waste.
- Environmental compensation: preserve official notices, payment evidence and status. Do not infer that payment resolves non-compliance; only reflect the official portal/authority decision when evidenced.

## 4. RupayKg workflow state model

Use separate state machines for each workflow type. Do not overload a single generic status field across registration, evidence, reporting and grievances.

### Application mirror state (portal state evidence required)

LOCAL_PREPARATION → READY_FOR_USER_SUBMISSION → SUBMISSION_REPORTED → UNDER_REVIEW → one of CORRECTION_REQUESTED, APPROVED, REJECTED.

- Correction path: CORRECTION_REQUESTED → CORRECTION_PREPARED → RESUBMISSION_REPORTED → UNDER_REVIEW.
- Rejection path: REJECTED → user chooses AMENDMENT_PREPARED or LEVEL_1_APPEAL_PREPARED → AMENDMENT_SUBMISSION_REPORTED / APPEAL_SUBMISSION_REPORTED → UNDER_REVIEW_BY_DM.
- These are RupayKg's mirror/preparation states, not claims that CPCB itself exposes identical API enum values.
- A state can become PORTAL_CONFIRMED only with a source artifact (portal screenshot/export/certificate/acknowledgement) or approved machine-readable response. Otherwise mark USER_REPORTED or UNRESOLVED.
- Preserve prior status history; never silently rewrite it.

### Waste chain state

RECORDED → EVIDENCE_ATTACHED → HANDOVER_RECORDED → TRANSPORT_RECORDED → FACILITY_RECEIPT_RECORDED → PROCESSING_EVIDENCE_ATTACHED → RECONCILED.

At any stage, allow EXCEPTION_OPEN, UNRESOLVED, REJECTED or SUPERSEDED with reason, actor and timestamp. RECONCILED is not synonymous with official acceptance, carbon-credit eligibility, or certificate issuance.

### Return/report state

PERIOD_OPEN → DRAFT_ASSEMBLED → VALIDATION_FAILED or READY_FOR_USER_REVIEW → USER_SUBMISSION_REPORTED → PORTAL_ACKNOWLEDGED → AUTHORITY_ACCEPTED / CORRECTION_REQUESTED / REJECTED.

The last three states require official evidence. A generated PDF or internal export alone is not a submission acknowledgement.

### Grievance/event state

Track LOCAL_DRAFT, USER_SUBMISSION_REPORTED, PORTAL_REFERENCE_RECORDED, STATUS_UPDATED_FROM_SOURCE, RESOLVED or UNRESOLVED. Preserve official case reference, source and update history.

## 5. Mapping against current repository evidence

This is a source review of GitHub files, not a complete deployed-system or local working-tree audit.

| Official workflow need | Observed repository support | Conformance |
|---|---|---|
| Urban/Rural context selector and descriptive lens | `apps/web/src/operating-context.ts`, selector, bridge and experience render Urban/Rural labels, hierarchies and field-focus descriptions | Partial: client-side presentation context exists; not an authority-backed jurisdiction or CPCB workflow state |
| Context-aware operating workflow data | `apps/web/src/operating-workflow-experience.ts` loads the same `/api/v1/workspaces/mrv` dataset for either context and selects `activities[0]`; context changes descriptions, not the fetched activity set | Gap: selected Urban/Rural rail is not proven to filter or validate data by geography, organization, waste/material class or competent authority |
| Geography primitives | `migrations/001_core.sql` defines ULB, WARD, GRAM_PANCHAYAT, VILLAGE and CLUSTER geography kinds; `migrations/003_identity_geography_operations.sql` adds source-versioned geography reference fields | Reusable foundation; verified jurisdiction mapping and actor-specific enforcement still need to be proven in the workflow |
| Internal BWG threshold assessment | `apps/src/statutory-routes.ts` has POST `/api/v1/statutory/bwg/assess` and persists an assessment | Partial; not CPCB application workflow |
| Statutory applicability view | GET `/api/v1/statutory/applicability` | Partial; internal data only |
| CPCB registration reference | `organization_epr_applicability` route records a supplied reference/status | Gap: reference is not independently checked against official source in reviewed handler |
| Portal application lifecycle, draft, submission receipt, review/correction/approval/rejection/amendment/appeal | No end-to-end CPCB application workflow demonstrated in reviewed source | Gap |
| BWG/facility exact portal document checklist | No complete portal-conformance checklist demonstrated in reviewed source | Gap |
| Official BWG annual return/facility quarterly and annual return package | No exact current portal return schema and acceptance evidence demonstrated in reviewed source | Gap / confirm formats |
| ULB/DP/GP/DM/SPCB/PCC role-specific workflow mirroring | Internal organization permission model exists; no exact CPCB actor-workflow mirror demonstrated | Gap |
| Grievance and event-intimation case tracking tied to portal references | No end-to-end CPCB-linked workflow demonstrated in reviewed source | Gap |
| Waste evidence/MRV, Guardian/Hedera provenance | MRV route, Guardian adapter and HCS anchor code exist | Complementary capability; not CPCB integration |
| Official EBWGR certificate generation | No RupayKg implementation should be added; official issuance belongs to local body | Explicitly out of scope |
| Authorized CPCB machine interface | No approved API contract or live exchange evidence found in reviewed files | Unresolved discovery gate |

## 6. Implementation order (do not skip gates)

1. Freeze source-of-truth boundary: CPCB portal/competent authority owns official application status, registration, official certificates, grievance/appeal decisions and submission acknowledgements.
2. Build field-level conformance map: inspect the live forms/guide for every BWG and facility field, every required document, all status/action labels and exact return templates. Capture date/version and source evidence. Anything unavailable is NEEDS_OFFICIAL_CONFIRMATION.
3. Map to actual schema: existing migrations already include Urban/Rural geography kinds and source-versioned geography reference fields. Confirm organization-to-jurisdiction bindings and actor authorization before adding tables. Reuse compatible records; do not create parallel geography or organization hierarchies.
4. Close the context-selection gap: make the selected Urban/Rural rail a validated query/filter, not just a client-side label. Scope workspace data to authorized organization plus verified geography kind/jurisdiction; reject cross-rail records and ambiguous geography rather than silently showing the first activity. Add tests proving Urban does not display Rural-only activity and vice versa, including multi-organization cases.
5. Close trust gap: registration references entered by users remain USER_REPORTED until verified; record verification source/method, date and reviewer. Do not promote a reference string to official status.
6. Implement applicant preparation workflow: BWG and facility registration readiness, required-document checklist, versioned submission packet, portal hand-off, receipt/certificate capture, correction/amendment/appeal case preparation, grievance/event tracking.
7. Implement operational chain and reporting: urban ward/route/stream custody and processing evidence; rural village/aggregation/seasonal-supply evidence; period close; reconciliation; current official return formats; missing evidence and deadline checks. Shared evidence quality; context-specific measurements.
8. Confirm integration authority: CPCB's written API/export/import authorization, sandbox, data model, authentication, rate limits, audit and change policy. Do not automate portal interaction absent authorization.
9. Add tests: every state transition; wrong role/jurisdiction; cross-context leakage; missing/expired authorization; user-reported vs portal-confirmed; duplicate acknowledgement; conflicting status; revision history; out-of-period evidence; stream/material mismatch; quantity mismatch; missing processor report; certificate issuer validation; failed/retried exchange; replay/idempotency; privacy and audit log redaction.
10. Verify in working environment: preserve local uncommitted files; run typecheck, migration validation, focused tests, full suite and relevant deployment smoke tests. Remote GitHub file inspection cannot establish local working-tree cleanliness or substitute for test execution.
11. Pilot and release gate: one willing BWG, one authorized collector/transport participant and one registered facility, with the urban or rural authority/jurisdiction explicitly identified; qualified compliance review; official evidence of any portal status; operational runbook, rollback and incident response. Production remains HOLD until acceptance.

## 7. Source links and unresolved questions

- Official portal: https://swmp.cpcb.gov.in/en
- Official user guide: https://swmp.cpcb.gov.in/en/user-guide
- Official SWM Rules 2026 PDF: https://swm.cpcb.gov.in/images/solid-waste-management-rules-2026.pdf
- Portal helpdesk displayed on official portal: swmportal.cpcb@gov.in (verify current contact on the official site before sending).

Questions requiring official confirmation:
1. Is a supported machine-to-machine API available to third-party compliance-support providers? What written authorization and onboarding are required?
2. Are there official schemas/sandbox endpoints for BWG/facility registration, application status, return submissions, EBWGR certificate references, grievances and event intimation?
3. What are the exact current field-level forms, accepted document formats/size limits, fee rules, return templates and error/status definitions?
4. What read/export permissions and privacy/retention restrictions apply to a BWG, facility, local body, SPCB/PCC or other authorized participant?
5. Which local by-laws, state-specific requirements, current norms or amendments alter the generic workflow?

**Release posture:** documentation alignment only; no CPCB live integration proven. Guardian authentication and live WA03.001 MRV/Hedera/Mirror Node acceptance remain independent blockers. Production release remains **HOLD**.
