# RupayKg Resume Checkpoint — 2026-10-21 10:12 UTC

## Governing rule
**Pan-India by design is a fundamental product rule. RupayKg must not be architected as a single-pilot platform.** Pilots are bounded validation environments only. Apply Shakti Standards: evidence-led discovery, statutory boundaries, feasibility, design, implementation, tests, approval, deployment, operation, measurement, and continuous assurance. Do not claim official compliance, integration, verification, or credit issuance without the relevant authoritative evidence.

## Repository and release posture
- Repository: `vishaltradewinds/rupaykg`
- Branch: `intelligence/ai-evidence-intake-middleware`
- PR: https://github.com/vishaltradewinds/rupaykg/pull/41
- PR #41 remains **open, draft, unmerged, and undeployed**.
- Latest observed PR head: `f4c9bdb3d1893b7aecc93816d49af38213b5a651`.
- Latest observed CI run: #1660, ID `39581441306`, failed. URL: https://github.com/vishaltradewinds/rupaykg/actions/runs/39581441306
- Failure is in PostgreSQL acceptance test `government inbox worker persists retry recovery, quarantine and append-only transition evidence`: expected `STRUCTURAL_ONLY`, actual `STRUCTURAL_AND_JURISDICTION_CROSSWALK_RESOLVED` at `apps/src/async-mirror-worker-db.test.ts` compiled line 73. On resume, inspect the source test and worker fixture to determine whether the assertion or implementation is wrong; do not merely change the expected value without confirming intended semantics. Other logged database errors are deliberate negative assertions unless a test summary says otherwise.

## Completed/committed work in the branch
1. Added Pan-India fundamental rule and architecture conformance audit; README points to them.
2. CPCB SWM workspace API requires an explicit geography UUID. API and database trigger require an explicit verified organization geography root and reject out-of-scope geography. Legacy NULL-geography rows were not silently rewritten.
3. Added `organization_has_explicit_geography_scope(organization_id, geography_id)` while preserving the legacy helper for compatibility. MRV, EPR return, statutory evidence-binding, and value-layer geography/evidence paths were switched to strict scope checks.
4. Added PostgreSQL acceptance assertions for no-root rejection, in-scope authorization, and unrelated-geography rejection.
5. Strengthened existing migration `migrations/20261031_government_jurisdiction_crosswalk.sql` (do not add a duplicate migration with the same timestamp/name sequence). It includes a versioned, evidence-backed jurisdiction crosswalk from authority/municipal codes to organization, canonical geography, and optional activity; request lifecycle constraints; dual-control checks; explicit geography scope; source-versioned target checks; and ambiguity protection.
6. No official geography identifiers have been imported or inferred. No official source crosswalk has been validated, and no government authority is implied by internal approval.

## Next actions — resume here
1. Fix and rerun CI #1660's failing PostgreSQL acceptance test. Inspect `apps/src/async-mirror-worker-db.test.ts`, `apps/src/async-mirror-worker.ts`, the fixture setup, and migration `20261031_government_jurisdiction_crosswalk.sql`. Confirm whether the test should remain structural-only or whether a crosswalk fixture was intentionally added; keep unmapped batches unresolved and fail closed.
2. Re-run the complete CI pipeline on the newest branch head. Do not report green unless the newest commit passes.
3. Continue the repository-wide inventory of every legacy `organization_has_geography_scope` call site, classify risk, and add tests before changing additional compatibility behavior.
4. Implement the authenticated API workflow for creating and independently approving/rejecting crosswalk requests, with permission checks and audit-chain writes. A schema-only crosswalk is not operationally complete.
5. Wire the government inbox worker to resolve `authorityCode`/`municipalCode` through the approved crosswalk and bind the result to organization/site/activity only when unambiguous, current, source-versioned, and evidence-backed. Otherwise leave unresolved/quarantined; never guess a mapping.
6. Add integration tests for duplicate/ambiguous identifiers, expired/revoked mapping, requester self-approval, approver permissions, organization/activity mismatch, tenant isolation, and multi-jurisdiction operations.
7. Continue versioned jurisdiction-specific rule/methodology applicability and nationwide coverage checks.
8. Keep PR draft, unmerged and undeployed. No production migrations, deployments, official submissions, Guardian/Hedera mutation, accredited verification, or credit issuance until their separate gates are evidenced and explicitly approved.

## Interrupted operation note
The last tool operation began composing `apps/src/government-jurisdiction-crosswalk-routes.ts` but was interrupted before a tool result. Treat that file as **not created** unless a fresh repository check proves otherwise. Resume by inspecting existing route conventions and platform-admin authorization/audit code before implementing it.

## Last verified status
- PR #41: open, draft, not merged.
- Latest CI #1660: failed on the specific assertion described above.
- Production/deployment: unchanged; no production migration/deployment was performed by this work.
