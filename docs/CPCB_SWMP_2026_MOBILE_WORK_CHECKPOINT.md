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
