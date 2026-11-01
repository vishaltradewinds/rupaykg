# RupayKg Engineering Checkpoint — 2026-11-01

## Stakeholder approval geography integrity

- Related discovery: [PR #180](https://github.com/vishaltradewinds/rupaykg/pull/180), finding TSI-003.
- Implementation: draft PR for migration `20261103_stakeholder_approval_geography_integrity.sql`.
- Scope: ensure each hierarchical approval row has exactly the same nullable geography as its parent stakeholder application.
- Current workflow seeds all approval levels with the application geography; reviewer authority scope is evaluated separately by the application route.
- Migration preflight aborts if existing approval rows differ from their parent application's geography.
- A database trigger uses null-safe `IS DISTINCT FROM` comparison and locks the parent application while validating approval inserts/updates.
- A second trigger prevents changing application geography after its approval chain exists, avoiding drift after approvals have been seeded.
- Tests cover matching geography, mismatched insert/update, parent geography drift, and NULL-safe behavior.
- Initial CI run `41293969590` found that the NULL-scope test fixture reused an identity/organization/role tuple already consumed by the first case, violating the existing unique application constraint before the NULL assertion. The fixture now creates a distinct identity; exact-head CI is required again.
- No application route behavior, production database, staging database, role, grant, RLS, secret, Render configuration or deployment is changed by this proposal.
- Required release gates: exact-head CI, disposable PostgreSQL acceptance, review of current production data/catalog, and independent security review.
- This is one narrow relational integrity control; it does not establish full tenant isolation or TRL 9.
