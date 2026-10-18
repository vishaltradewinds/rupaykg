# RupayKg Mobile Work Checkpoint — CPCB SWM 2026

**Updated:** 2026-10-18  
**Purpose:** Resume work while the Windows PC / Desktop Commander is unavailable.  
**Working repo:** https://github.com/vishaltradewinds/rupaykg  
**Documentation PR:** https://github.com/vishaltradewinds/rupaykg/pull/18  
**Branch:** `docs/cpcb-swm-2026-mrv-mapping`  
**Branch head:** `3852ab42be3118a848ca3b67be076244441ade26`

## Completed using mobile-accessible GitHub and official web sources

- Re-read the CPCB SWM 2026 official portal user guide: https://swmp.cpcb.gov.in/en/user-guide
- Checked the official Solid Waste Management Rules 2026 Gazette PDF: https://swm.cpcb.gov.in/images/solid-waste-management-rules-2026.pdf
- Prepared and added `docs/CPCB_SWMP_2026_MRV_MAPPING.md` (documentation-only, 155 lines).
- Verified the file by fetching it back from the remote branch.
- Opened draft PR #18 for review. No merge, deployment, application-code changes, schema changes, migration changes, or Guardian configuration changes were made.
- Added requirement-to-evidence mapping, rule/source map, proposed evidence lifecycle, domain concepts (explicitly labelled proposal), negative test cases, pilot plan, acceptance gates, and an unsent CPCB support inquiry draft.

## Important verified regulatory details to preserve

- Rules 2026 effective 1 April 2026 (Rule 1).
- BWG threshold alternatives (Rule 3(i)): floor area >= 20,000 sq.m.; water >= 40,000 litres/day; or solid waste >= 100 kg/day.
- Rule 6 covers BWG registration, handling/processing duties, relevant EBWGR obligations, and annual return due 30 June.
- Rule 7 includes relevant facility registration and quarterly/annual reporting requirements.
- Rule 10(1): only the local body is mandated to generate EBWGR certificates on the centralised portal.
- Relevant Rules 2026 text is linked in the mapping document. The mapping is not a complete legal opinion; check amendments, CPCB norms, portal formats and local by-laws before implementation.

## What remains, ordered

1. Review PR #18 and keep it as a draft until documentation and requirements are accepted.
2. While mobile-only, continue public-source research for current CPCB norms, return formats, registration/authorization requirements, and formal API/integration authorization path. Do not claim an API is unavailable merely because the user guide does not document one.
3. Do not send the CPCB inquiry automatically. Draft is in the mapping file and awaits review/authorization.
4. When the PC is online, inspect `D:\GitHub\rupaykg` working-tree status before any edit. Preserve every pre-existing uncommitted change.
5. Read actual local MRV routes, schemas, migrations, data lineage and tests. Map each mapping requirement to actual code/schema files; reuse existing entities and do not invent or duplicate schema.
6. Implement only justified additive changes on a separate reviewed branch after code inspection. Add fail-closed, mismatch, duplicate, custody, authorization and out-of-period tests as appropriate.
7. Run typecheck, migration validation, focused tests and full tests; record exact commands/results. Documentation-only PR #18 did not run code tests.
8. Continue the existing Guardian authenticated-session and live WA03.001 MRV/Hedera/Mirror Node acceptance gates independently. Release remains HOLD until evidence proves all gates pass.

## Guardrails

- Never treat missing or conflicting evidence as verified; use `UNRESOLVED`.
- Do not create an official certificate; only the competent local body may issue EBWGR certificates under Rule 10(1).
- No unapproved CPCB portal automation; do not bypass CAPTCHA, OTP or access controls.
- No secrets in logs or reports. No commits to local working tree are possible until PC is back online; remote doc changes are limited to the dedicated branch and draft PR.
- Do not merge, deploy, or claim production certification until appropriate review and gates pass.

## Existing release blockers (unchanged)

- Guardian authenticated session remains unresolved.
- Real WA03.001 live MRV + Hedera/Mirror Node persisted acceptance remains unverified.
- Production certification/release remains **HOLD**.


## Update — exact portal workflow alignment (2026-10-18)

- Rechecked the live official portal and current published user guide: https://swmp.cpcb.gov.in/en and https://swmp.cpcb.gov.in/en/user-guide.
- Added docs/CPCB_SWMP_2026_WORKFLOW_CONFORMANCE_MATRIX.md on this branch (commit 9e1ec0bc95676bfe0f0b534f5e7791cf361eedc9). It spells out the BWG applicant journey, Waste Facility journey, ULB/DP/GP authority review, DM amendment/appeal path, SPCB/PCC oversight, grievance/event-intimation workflows, recurring reporting duties, evidence states and implementation gates.
- The matrix is explicit about what is shown in the portal guide versus what needs official confirmation. No API, field schema or machine interface is assumed.
- Code review identified a concrete trust gap in apps/src/statutory-routes.ts: the external-registration route accepts a user-supplied reference and REGISTERED_EXTERNALLY status without independently verifying it against an official source. This should remain USER_REPORTED/UNVERIFIED until evidence verification is implemented and tested.
- Current repo review shows internal BWG assessment and statutory applicability routes, plus separate Guardian/Hedera MRV support. These are not equivalent to CPCB application submission, official status synchronization, return submission, or official certificate exchange.
- This remains a documentation/specification change only. No application code, database schema/migration, local working tree, live service, or deployment was changed. Local tests have not been run for this update. PR #18 remains draft and unmerged.
- Next code step when the PC/local tree is available: inspect actual migrations and tests, map each matrix row to existing entities, correct external-registration trust state, then implement a minimal additive workflow mirror with source evidence, versioned states and tests. Do not create duplicate schema before inspection. Keep release HOLD until tests, authorized interface confirmation and separate Guardian/WA03.001 acceptance gates pass.


## Update — Urban/Rural governance symmetry restored (2026-10-18)

- User-confirmed doctrine: RupayKg is one platform with two distinct governance rails; Urban is municipal/ULB → ward → generator/collector/facility, while Rural is Gram Panchayat / District Panchayat → village / block → producer/aggregator/facility. Do not collapse these into one generic local-body workflow.
- Updated `docs/CPCB_SWMP_2026_WORKFLOW_CONFORMANCE_MATRIX.md` in commit `8adb1cd4e24afbeb7a3b47e014b7601b856e620d` to separate Urban authority workflow, Rural authority workflow, and shared safeguards.
- Urban operating evidence emphasizes frequent collection, ward/route/vehicle/scale records, four-stream segregation and facility reconciliation. Rural operating evidence emphasizes village collection points, seasonal supply, producer/FPO/SHG participation, aggregation, quality/inventory, consolidated logistics and village-cluster reconciliation.
- Important boundary: rural biomass, crop residue, animal waste, biochar, compost, biogas and carbon activities are not automatically CPCB SWM 2026/EBWGR records. Cross-link only when legal scope, waste/material classification, authority, destination and evidence match.
- Urban/Rural symmetry means equal traceability, auditability, permissions, grievance handling and fail-closed evidence standards—not identical screens or assumptions. No application code, schema, tests, live portal, Guardian service or deployment was changed.


## Update — source-level Urban/Rural context audit (2026-10-18)

- Inspected current frontend and migration source on the dedicated branch.
- Existing UI context modules are present: `operating-context.ts`, `operating-context-selector.ts`, `operating-context-experience.ts`, `operating-context-bridge.ts`, and `operating-workflow-experience.ts`.
- Important gap: `operating-workflow-experience.ts` requests the same `/api/v1/workspaces/mrv` dataset in both contexts and chooses `activities[0]`. The selected context changes labels/descriptions, but this code does not itself filter the dataset by verified geography kind or jurisdiction. This is a source-level finding, not proof of every backend behavior.
- Existing geography schema already defines `ULB`, `WARD`, `GRAM_PANCHAYAT`, `VILLAGE` and `CLUSTER`, plus source-versioned geography reference fields. Reuse these after confirming organization/geography bindings; do not create duplicate hierarchy tables.
- Updated the conformance matrix in commit `dcbf9e9689c62748328b2cc6a2d0d670fba2a974` to record this gap and require verified organization/geography scoping, cross-context leakage tests, and fail-closed handling of ambiguous jurisdictions.
- No application code, schema, test results, local working tree, live service or deployment changed. Next safe engineering step is to inspect the actual workspace endpoint and authorization/geography joins, then implement and test a server-enforced context filter. Do not rely on browser localStorage as a security or jurisdiction boundary.
