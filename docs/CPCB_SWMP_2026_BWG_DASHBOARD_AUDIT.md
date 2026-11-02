# CPCB SWM 2026 — BWG Dashboard Workflow Audit

**Audit date:** 2026-10-18  
**Scope:** Repository source review of RupayKg's stakeholder dashboard and CPCB SWM BWG applicant workflow.  
**Authoritative comparison:** CPCB's current SWM 2026 BWG user guide, read on 2026-10-18: https://swmp.cpcb.gov.in/en/user-guide  
**Current portal:** https://swm.cpcb.gov.in/  
**Status:** Source-level audit and workflow improvements merged to main via PR #26 (commit `8b5b9071d47e0d35355d083c0e70e979873e26e5`); CI #1322 passed. Not a live production test, legal certification, or CPCB integration test.

## Executive finding

**Conformance: PARTIAL / NOT READY TO CLAIM CPCB-WORKFLOW-COMPLETE.**

RupayKg now has a persistent stakeholder-preparation panel, a BWG eligibility pre-check, document/reference checklist, and authenticated organization-scoped create/read/update API. It is useful for readiness, but it is not yet a workflow-complete mirror of the current CPCB BWG portal. The current CPCB guide describes account creation, My Applications draft/resume, eligibility, application data, document uploads and self-declaration, fee/payment and submission, acknowledgement and authority review, correction, approval/certificate download, rejection due to incorrect information or environmental-compensation non-compliance, amendment or Level 1 appeal, dashboard, grievance and event intimation.

The existing generic dashboard also shows records from domain workspaces as a generic list; it does not by itself implement these CPCB-specific application states/actions. No CPCB API, official data exchange, or live deployment is evidenced by this repository review.

## Evidence-based workflow comparison

| CPCB BWG workflow step | Existing RupayKg support at audit start | Finding |
|---|---|---|
| Organization and authorized-person onboarding readiness | Organization membership exists; SWM panel has a record title and stakeholder type | Partial; CPCB-specific authorized person/contact preparation is not a structured form |
| Account creation / OTP / CAPTCHA / password | Official portal link and warning not to enter secrets | Correct boundary; portal action remains user-controlled |
| Eligibility assessment (floor area, water/day, waste/day) | Domain pre-check with OR thresholds and source/period requirements | Partial; UI reuses one source reference and one period for all three different measurements, which can misattribute evidence |
| My Applications: start/resume local vs CPCB draft | RupayKg record selector | Gap; local preparation record is not a portal draft and must be labeled distinctly |
| Complete application data / self-declaration | Generic checklist and notes | Gap; no versioned application packet or declaration readiness/acknowledgement |
| Document upload / versioning / evidence hash | Checklist status only | Gap; no actual document upload, file metadata, hash or versioned document review in this module |
| Fee/payment and Pay & Submit | Official portal link only | Safe boundary, but no explicit workflow step/hand-off checklist |
| Submission acknowledgement and Under Review | CPCB application reference and source reference fields, but no reported status field/history | Gap; cannot record which portal status the user reports or preserve status history |
| Authority correction request and resubmission | No specific state/action model | Gap |
| Approval and official certificate download | No certificate artifact/version/issuer/scope model | Gap; must never issue a RupayKg substitute |
| Rejection due to incorrect details / environmental compensation | No rejection reason category or action-preparation state | Gap |
| File Amendment / Level 1 Appeal to DM | No separate amendment/appeal preparation records | Gap |
| Dashboard organization details, waste generation, application status | Generic metrics and preparation record | Partial; no clear source/timestamp distinction for portal vs operational data |
| Grievances / My Grievances | No CPCB-specific grievance case tracker | Gap |
| Event Intimation / My Events | No CPCB-specific event case tracker | Gap |
| Operational four-stream ledger and handover evidence | Other operational/MRV workspace exists, but not linked into this BWG workflow | Gap in the BWG journey; a separate domain may be reused, not duplicated |
| Annual return / EBWGR reconciliation | Not present in this BWG readiness panel | Gap; exact current portal return fields/schema require validation |
| Authority roles and decisions | General permission model; no CPCB status/decision write action in this panel | Correct boundary; authority decisions must remain official and role-authorized |

Official guide evidence: BWG prerequisites and registration sections 2–5; correction section 6; approval/certificate section 7; rejection, amendment and Level 1 appeal sections 8–9; dashboard section 10; grievances and event intimation sections 11–12. Source: https://swmp.cpcb.gov.in/en/user-guide.

## Source-level defects / risks identified at the start of this audit

1. **Measurement provenance is shared across distinct observations.** The BWG UI has one source reference and one measurement period for floor area, water consumption and daily waste generation. These may have different sources and periods. This can falsely associate evidence with a value.
2. **No CPCB status can be tracked.** The database intentionally fixes cpcb_status_claim to USER_REPORTED_UNVERIFIED, but there is no separate cpcb_reported_status field. Users can store a source reference but not the actual status they observed. No status history exists.
3. **PATCH validation is weaker than POST validation.** The POST route calls safeObservations; PATCH only checks that observations are an object. Invalid/unexpected observation shapes can therefore be accepted on update.
4. **Checklist labels/source classifications are client-controlled.** The API validates checklist item shape but does not enforce the server's canonical checklist for the selected stakeholder. A client could label an arbitrary item GUIDE_LISTED.
5. **Organization header consistency needs hardening.** The UI component receives an organization ID but the shared API helper always overwrites an explicitly supplied organization header with localStorage's active organization. This can cause confusing wrong-scope requests when organization selection changes. Server authorization still applies, but the client request should be consistent and explicit.
6. **No end-to-end acceptance tests are shown for the SWM endpoints' authentication, tenant isolation, status transitions or audit history.** Existing tests cover input validators and CI covers build/migrations/general tests; that is not equivalent to route-level security acceptance.
7. **No live deployment evidence.** A green CI run validates the branch in CI, not the live production environment.

## Changes implemented on the audit branch

- Added a separate local workflow stage (preparation, eligibility, documents, ready for user submission, submission reported, follow-up, correction/amendment/appeal preparation, grievance/event preparation, unresolved/closed).
- Added a separate CPCB status selected by the user (Draft, Under Review, Correction Requested, Approved, Rejected) with the immutable meaning USER_REPORTED_UNVERIFIED. Status changes, source-reference changes and status-note changes are appended to a history table; this is not an official CPCB sync.
- Split floor-area, water-consumption and waste-generation evidence references and periods so each observation retains its own provenance.
- Applied strict observation validation to both create and update endpoints.
- Enforced the canonical server-side checklist for the selected stakeholder; a client cannot invent a checklist item or mark it GUIDE_LISTED.
- Made explicit organization headers on SWM calls survive the shared API helper instead of being overwritten by localStorage's active organization.
- Added validator tests for canonical BWG checklist, invalid status values, local-stage/status separation, bad observations and spoofed checklist labels.

These changes are merged code-level work; CI #1322 passed migration validation, typecheck/build, browser smoke, tests including disposable PostgreSQL acceptance, and production container build. They do not add document upload, a real CPCB portal draft, official status verification, fee/payment, submission, certificate issuance, grievances or event-intimation submission.

## Updated audit posture

| Finding | Status after this branch's changes |
|---|---|
| Shared provenance for three eligibility measures | Addressed in UI state and saved observation structure; verify through CI and round-trip tests |
| No reported CPCB status or history | Addressed with user-reported status plus append-only history; still not independently verified |
| Weaker PATCH observation validation | Addressed by applying the same strict validator |
| Client-controlled checklist source labels | Addressed by comparing against canonical stakeholder checklist |
| Organization header mismatch | Addressed for SWM UI calls and made the shared helper preserve explicit headers |
| Route-level auth/tenant isolation acceptance | Still open; helper tests are not a substitute for end-to-end API tests |
| Live deployment / real pilot | Still open; no live environment was changed |

## Remaining BWG workflow gaps (blocking full conformance)

1. Structured applicant organization and authorized-person details for pre-populating a preparation packet.
2. Actual file upload/storage, content hash, file metadata, revisioning, and independent document-review states.
3. A versioned application preparation packet and explicit self-declaration review; CPCB draft creation and submission remain user-controlled.
4. A proper receipt/certificate artifact record (issuer, date, reference, scope, source, hash, verification status) without generating a substitute certificate.
5. Separate case records for authority correction request, incorrect-detail rejection, EC non-compliance rejection, amendment, Level 1 appeal, grievance and event intimation, each with user-controlled hand-off and versioned evidence.
6. Link BWG daily four-stream generation/segregation, collection, handover, transport and facility receipt/processing using existing operational records; do not duplicate the waste ledger.
7. Validated annual-return and EBWGR reconciliation preparation using the exact current official form/schema and applicable effective-dated rules.
8. End-to-end tests for unauthenticated requests, wrong permission, cross-organization access, geography scope, source/history transactions, concurrency and failure rollback.
9. CI validation, reviewed PR merge, migration deployment through the approved release process, non-production acceptance, and a controlled pilot.

## Required implementation order

1. Keep CPCB as official system of record and add an explicit user-reported portal status that is always USER_REPORTED_UNVERIFIED, with source reference and append-only history.
2. Add a distinct local preparation stage to guide the user through the CPCB journey without representing a local stage as an official CPCB status.
3. Make each eligibility observation carry its own source reference and period.
4. Enforce the canonical server-side stakeholder checklist and apply the same strict observation validation to POST and PATCH.
5. Make organization-header selection deterministic and add route-level tests for authentication, permissions, cross-organization reads/writes, geography scope and history.
6. Add BWG-specific workflow readiness for correction, rejection, amendment/appeal, certificate capture, grievance and event-intimation, as separate tracked cases. These remain user-controlled hand-offs until official integration is authorized.
7. Link the existing operational four-stream/custody records to BWG preparation; do not create a duplicate waste ledger.
8. Confirm current official return formats, filing fields and deadline applicability before enabling return generation/reminders.
9. Deploy only through the approved release process; perform non-production acceptance and a controlled pilot before removing HOLD.

## Non-negotiable boundary

No OTP/CAPTCHA bypass, password collection, browser-token reuse, private endpoint probing, scraping, automated payment/submission, fabricated CPCB status, or RupayKg-issued EBWGR certificate. Any reported portal status must remain user-reported/unverified until supported by an authorized official source or approved machine-readable integration.
