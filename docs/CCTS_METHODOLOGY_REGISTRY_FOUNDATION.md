# RupayKg Carbon OS — CCTS Methodology Registry Foundation

**Status:** Registry foundation only; no methodology calculation adapter is certified by this change.  
**Official source:** [BEE — Methodologies and Tools under Offset Mechanism](https://beeindia.gov.in/view_content.php?lang=1&lid=571)  
**Source page last-updated date:** 2026-07-07  
**Rechecked:** 2026-10-18

## Purpose

RupayKg is a cross-sector carbon MRV and compliance platform. BWG is one stakeholder role, not the platform's organising principle. Projects must be matched to their applicable official methodology and supporting tools using project facts and the current authoritative rules.

## Registry snapshot

This implementation captures the 12 methodologies and 17 tools appearing on the cited BEE register snapshot. It records the exact listed identifier and title, sector, source, snapshot date, and implementation status.

Every record deliberately starts as `REGISTRY_ONLY`. This means the official register lists it as approved, but RupayKg has not thereby implemented the method, checked a project's eligibility, or validated its calculations. Version-specific source documents, applicability conditions, required monitoring parameters, equation transcription, emissions factors, uncertainty rules, validation test vectors, and ACVA review must be completed before any adapter may be promoted.

## Mandatory status separation

- **Registry approval:** BEE's source list labels the method/tool approved.
- **Project applicability:** unresolved until the exact method's eligibility conditions are evaluated against evidence.
- **Adapter implementation:** separate engineering status; currently not certified by this registry slice.
- **Validation/verification:** independent official process; never inferred from a passing software test.
- **CCC issuance:** only reported after authoritative issuance evidence is reconciled.

The domain helper `cctsMethodologyReadiness` therefore returns `UNRESOLVED` for a listed methodology until future work adds validated project-specific applicability and calculation adapters. Unknown identifiers and tools also fail closed.

## Registry entries

The canonical code snapshot lives in `packages/domain/src/ccts-methodologies.ts`; tests assert 12 methodologies and 17 tools. The database migration `migrations/20261020_ccts_methodology_registry.sql` persists the same source snapshot, with implementation status defaulting to `REGISTRY_ONLY`.

## Next gates

1. Import and retain the actual official PDF for each methodology and each referenced tool, including version/effective date, source URL, retrieval timestamp, and SHA-256.
2. Extract the applicability criteria, monitoring requirements, equations, parameters, emission factors, leakage treatment, uncertainty, and reporting outputs into reviewed specifications.
3. Map shared RupayKg evidence/operations to each methodology's monitoring plan without creating duplicate operational ledgers.
4. Implement adapters one at a time with source-linked tests, official examples/test vectors where available, boundary cases, regression tests, and independent technical review.
5. Implement a project-level eligibility decision that can return only `ELIGIBLE_FOR_FURTHER_ASSESSMENT`, `INELIGIBLE`, or `UNRESOLVED`; never promise issuance.
6. Connect validation/verification and official certificate reconciliation only to documented, authorized workflows.
7. Recheck BEE's official register and detailed procedure before release and retain each historical snapshot. Draft proposals must not be added as approved methods.

## Release boundary

This is a source registry foundation, not an all-methodologies implementation, MRV calculation approval, CCTS project registration, independent verification, or CCC issuance. Production readiness remains on HOLD until the full applicable gates are independently evidenced.
