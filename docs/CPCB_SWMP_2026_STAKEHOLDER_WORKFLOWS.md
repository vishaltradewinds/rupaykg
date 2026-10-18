# CPCB SWM 2026 — RupayKg Stakeholder Workflows and Implementation Acceptance

**Prepared:** 2026-10-18  
**Status:** First functional stakeholder-readiness slice implemented and merged; further operational workflows, live deployment, legal certification, and CPCB integration remain unverified / incomplete.  
**Repository:** `vishaltradewinds/rupaykg`  
**Branch:** `feature/cpcb-swm-stakeholder-workflows`  
**Authoritative portal guide:** https://swmp.cpcb.gov.in/en/user-guide  
**Official portal:** https://swm.cpcb.gov.in/

## 1. Objective and boundary

Make RupayKg useful to the same stakeholder groups served by CPCB's SWM 2026 portal by supporting their operational work, compliance preparation, evidence custody, deadline management, and accurate hand-off to CPCB. RupayKg complements the portal; it must not create a parallel official registry or impersonate CPCB, ULB/DP, DM, SPCB/PCC, or any other authority.

CPCB's current guide documents BWG and waste-facility registration, account creation, OTP/CAPTCHA, application drafting, document upload, self-declaration, payment/submission, application tracking, corrections, appeals, grievance and event-intimation workflows. It also documents ULB/DP review and authority actions. RupayKg can prepare and track the stakeholder's own work, but official account authentication, payment, submission, decisions and certificates remain on CPCB's portal unless CPCB explicitly authorizes a supported integration.

**API status:** UNCONFIRMED. Public user-guide pages reviewed do not establish an SWM API. The CPCB API-integration procurement discovered in November 2025 was for the separate Common Consent Management Portal; it is not evidence of an SWM API. No private endpoint probing, scraping, CAPTCHA/OTP bypass, credential replay, or unauthorized submission is allowed.

## 2. Stakeholders and practical jobs-to-be-done

### A. Bulk Waste Generator (BWG)
- Determine whether any eligibility threshold is met; preserve the source and period for each measurement.
- Prepare organization/site details and a document checklist before opening the official portal.
- Maintain waste segregation, handover, processing and EBWGR-related evidence; reconcile quantities across collection, transport and registered processors.
- Track CPCB application references, acknowledgements, authority remarks, correction tasks, certificate references and annual-return readiness without asserting an unverified official status.
- Support annual-return readiness for the applicable period and deadline (Rules 2026 currently state 30 June; validate applicable rules/updates before production reminders).

### B. Waste facility / processor
- Maintain facility identity, facility type and registration/authorization evidence, including layout plan, CTE, CTO, SPCB/PCC authorization and environmental clearance where applicable to the facility and current requirements.
- Record intake, weights, processing outputs/residues, destination and period, with evidence and measurement method.
- Prepare applicable quarterly/annual return evidence and reconciliation; never label an internal RupayKg record as a CPCB-issued registration/certificate.

### C. Urban/Rural Local Body (ULB, District Panchayat, Gram Panchayat)
- Capture collection, transportation and delivery records with geography, dates, quantity, stream, responsible operator and registered destination.
- Reconcile generator declarations, collection/transport evidence and processor intake.
- Prepare authority review work queues and evidence packages for authorized staff.
- Only the competent local body may generate official EBWGR certificates on the central portal. RupayKg may store a user-supplied certificate reference and evidence copy with provenance, but cannot issue the certificate.

### D. Collectors, transporters and field operators
- Mobile-first activity capture, source/destination, four-stream classification, timestamp, quantity/unit, scale/weighbridge reference, vehicle/route where relevant, and photo/document evidence.
- Preserve offline/sync idempotency and actor/geography authorization. Missing fields remain unresolved; duplicate events must be quarantined or reconciled, not silently counted twice.

### E. Authorities / regulators
- Read only within verified role and geography scope.
- Show evidence and discrepancies, not inferred legal conclusions.
- Authority decisions must be performed by authorized users with server-side checks and audit records; no RupayKg UI should claim to be the CPCB portal.

## 3. Eligibility rules that may be safely implemented

A BWG qualifies when **any one** of these thresholds is met:
- Building floor area >= 20,000 m²; OR
- Water consumption >= 40,000 litres/day; OR
- Solid-waste generation >= 100 kg/day.

Each input must carry value, unit, source/evidence reference, measurement period, and capture time. Missing values are UNKNOWN, not zero. Values that conflict or lack a valid period must remain UNRESOLVED. Eligibility helper is a readiness aid, not an official determination by CPCB.

Source: SWM Rules, 2026 and CPCB SWM portal/user guide. Recheck amendments, norms, local by-laws and portal requirements before production release.

## 4. Minimum useful product slice — build in this order

### Slice 1 — real, persisted stakeholder readiness
1. Add an authenticated CPCB SWM work area to RupayKg, visible only to users with the appropriate verified organization membership and permission.
2. Persist a local preparation record, distinct from a CPCB application. Minimum fields: stakeholder type, organization/site, geography, eligibility observations and sources, checklist items, evidence references and hashes, user-entered CPCB reference/acknowledgement, declared official status with provenance, due dates, unresolved issues, timestamps and audit trail.
3. Implement BWG eligibility with boundary tests at 19,999/20,000 m², 39,999/40,000 L/day and 99/100 kg/day, including OR semantics and missing/invalid inputs.
4. Support a document checklist and task status: MISSING, PROVIDED_UNVERIFIED, VERIFIED, REJECTED, EXPIRED, NOT_APPLICABLE, UNRESOLVED. Never silently upgrade user-entered evidence or portal references to VERIFIED.
5. Provide a visible official-portal hand-off link and user checklist. Clearly label the official login/payment/submission step as user-controlled.

### Slice 2 — operational traceability
6. Reuse existing resource-flow, activity, measurement, evidence, MRV and geography models; do not create parallel copies of these concepts.
7. Link generation -> collection -> transport -> facility intake/processing with quantity/unit, dates, stream, origin/destination, actor and evidence. Enforce duplicate/custody checks and geography scope.
8. Build reconciliation views that highlight missing links, quantity mismatches, period gaps and unverified destinations.
9. Add reminders and draft-return readiness for applicable annual/quarterly duties only after the relevant rule, role, period and due date are confirmed.
10. Store certificate/registration references as USER_REPORTED_UNVERIFIED until checked against evidence from the authorized source. No self-issued EBWGR certificate.

### Slice 3 — official integration (blocked pending permission)
11. Obtain written CPCB confirmation that an SWM interface exists and that RupayKg is eligible for access.
12. Obtain API catalogue/specification, permitted fields/operations, authorization model, data-sharing/legal basis, sandbox, security requirements, rate limits, certification/UAT and production onboarding steps.
13. Implement only against the official spec and sanctioned sandbox. Keep connector disabled until written approval, successful UAT and release authorization.

## 5. Non-functional and security acceptance

- PostgreSQL remains the authoritative store for RupayKg records; no production synthetic data.
- Enforce verified identity, organization membership, role permission and geography scope server-side on every read/write.
- Use transactionally consistent audit records for state-changing operations.
- Use idempotency keys for field sync and external event ingestion; duplicates cannot double-count quantities.
- Keep original evidence metadata, hash, issuer/source, capture time, measurement period, reviewer and review decision.
- Separate operational evidence verification, Guardian MRV verification, Hedera consensus/Mirror Node checks, CPCB official status and statutory certificate issuance. One is not proof of another.
- Do not store CPCB passwords, OTPs, CAPTCHA answers, session cookies, private keys or other secrets.
- Accessibility: mobile-first, plain language, low-bandwidth and field-friendly. Do not make a smartphone camera or GPS mandatory unless the relevant workflow actually requires it.
- All unsupported/ambiguous legal requirements must display NEEDS OFFICIAL CONFIRMATION; fail closed.

## 6. Required tests and release gates

### Domain tests
- BWG OR-threshold boundaries, missing inputs, invalid units, period mismatch, conflicting observations.
- Four-stream classification and excluded waste regimes routed for review rather than treated as ordinary municipal solid waste.
- Evidence status transitions and source provenance; no user-entered reference can become official VERIFIED by itself.
- Quantity reconciliation, partial delivery, duplicate sync, rejected evidence, unregistered destination and out-of-period records.

### API/security tests
- Unauthenticated request -> 401; no database/config -> fail closed.
- Cross-organization and out-of-geography access -> 403.
- Permission denied writes -> no mutation.
- Invalid IDs, malformed dates, negative/zero quantity, invalid unit and missing evidence -> rejected.
- Concurrent/duplicate submissions -> idempotent and auditable.
- Official CPCB state/certificate cannot be created by a generic EPR upsert or by a stakeholder-controlled payload.

### Acceptance and deployment
- Migration validation, typecheck, lint, focused tests, full test suite and production build must pass.
- Test against a non-production database and realistic but clearly synthetic fixtures; do not use a fixture as pilot evidence.
- Independent review of rule mapping, permissions, audit trail, data retention and user-facing legal boundary.
- Production remains HOLD until Guardian authenticated-session and live WA03.001 MRV/Hedera/Mirror Node acceptance are separately evidenced, plus all new workflow gates pass.
- Do not deploy or change live services as a side effect of this feature branch.

## 7. Current verified state and next actions

### BWG dashboard audit checkpoint — 2026-10-18

- Official CPCB SWM 2026 BWG guide reviewed: https://swmp.cpcb.gov.in/en/user-guide.
- Audit report: [docs/CPCB_SWMP_2026_BWG_DASHBOARD_AUDIT.md](https://github.com/vishaltradewinds/rupaykg/blob/main/docs/CPCB_SWMP_2026_BWG_DASHBOARD_AUDIT.md).
- PR #26 merged: https://github.com/vishaltradewinds/rupaykg/pull/26.
- Merge commit: `8b5b9071d47e0d35355d083c0e70e979873e26e5`.
- CI run #1322 passed: migration validation and database migration execution, typecheck, build, browser smoke, tests including disposable PostgreSQL acceptance, and production container build.
- Improvements include separate local workflow stage vs user-reported CPCB status, status/source/note history, independent provenance for each BWG eligibility measure, strict validation on POST and PATCH, canonical server-side checklist enforcement, and explicit organization-header preservation.
- Conformance remains PARTIAL. Still missing: real document upload/versioning, versioned application packet and self-declaration, dedicated correction/amendment/appeal/grievance/event case records, linked four-stream custody chain and reporting preparation, route-level authorization/tenant-isolation tests, production deployment verification and pilot acceptance.
- Follow-up PR #27 merged as commit `5617e49876ac7959a302e1dd47c22e6fdf777be5`; CI #1327 passed. The API workspace now explicitly declares `@rupaykg/domain` and the lockfile is synchronized.
- No CPCB API has been confirmed or used; no OTP/CAPTCHA, payment, official submission or certificate action was performed. Production remains HOLD.

## 8. Current verified state and next actions

- Existing general workspaces include Operations, MRV & Evidence, Compliance & EPR, Registry and reporting. The existing BWG-named compatibility route module registers EPR-return routes and EPR obligations; its name alone did not establish CPCB SWM workflow support.
- **Implemented and merged in PR #25:** `docs/CPCB_SWMP_2026_STAKEHOLDER_WORKFLOWS.md`; domain helper `packages/domain/src/cpcb-swm.ts`; domain tests `packages/domain/src/cpcb-swm.test.ts`; migration `migrations/20261018_cpcb_swm_stakeholder_workspaces.sql`; authenticated API `apps/src/cpcb-swm-routes.ts`; API validation tests `apps/src/cpcb-swm-routes.test.ts`; compliance-workspace UI and mobile styles in `apps/web/src/main.tsx` and `apps/web/src/styles.css`.
- The first slice persists stakeholder preparation records, BWG sourced-observation pre-check data, checklist states, optional user-entered CPCB references, due dates and notes. API enforces verified organization membership, read/write permission and geography scope; state-changing writes create audit events. User-provided CPCB references remain `USER_REPORTED_UNVERIFIED`; applicants cannot self-mark checklist evidence `VERIFIED`.
- **PR #25 merged** to `main` as commit `6b8dc1616e465080df7c2eb7164c85d896ce25c8`. Latest CI run #1319 passed migration validation, database migration execution, typecheck, production build, browser smoke test, tests including disposable PostgreSQL acceptance, and production container build. This verifies CI behavior only; it does not establish that the production service has been deployed or that a live pilot has been accepted.
- Existing documentation: `docs/CPCB_SWMP_2026_MRV_MAPPING.md`, `docs/CPCB_SWMP_2026_WORKFLOW_CONFORMANCE_MATRIX.md`, `docs/CPCB_SWMP_2026_MOBILE_WORK_CHECKPOINT.md`.
- API discovery checkpoint: PR #24, https://github.com/vishaltradewinds/rupaykg/pull/24 (merged). It documents official API discovery and keeps production on HOLD.
- Official CPCB SWM guide: https://swmp.cpcb.gov.in/en/user-guide
- Official CPCB portal/helpdesk: https://swm.cpcb.gov.in/ ; `swmportal.cpcb@gov.in`, +91-11-43102489 (verify contact on the official portal before use).
- CPCB's November 2025 API Integration Service Provider tender was for the Common Consent Management Portal, not confirmed SWM integration: https://cpcb.nic.in/tender.php and https://cpcb.nic.in/openpdffile_tend.php?id=VGVuZGVyRmlsZXMvOTQzXzE3NjM3MjY1NjBfbWVkaWFwaG90bzIzNzUyLnBkZg%3D%3D.
- No inquiry has been sent and no API authorization has been received.

**Next engineering step:** inspect the existing migrations, domain models, workspace APIs and frontend state; implement Slice 1 as a reviewed, additive feature on this branch, with a migration, authorization, audit trail, tests and a dedicated mobile-first UI. Do not report the platform as CPCB-ready until that implementation and its gates are actually verified.
