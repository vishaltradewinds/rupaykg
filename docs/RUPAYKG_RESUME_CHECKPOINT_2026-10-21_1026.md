# RupayKg Resume Checkpoint — 2026-10-21 10:26 UTC

## Resume instruction
Resume engineering from this checkpoint in the existing repository and branch. Continue the Pan-India-by-design conformance work; do not restart discovery or ask the user to repeat context. Work practically and report only verified results.

## Governing product rule
RupayKg is Pan-India by design. Jabalpur/Kathonda is one validation site only, not the platform boundary. Preserve distinct Urban (ULB/ward/locality) and Rural (Gram Panchayat/village/cluster) governance rails. If a district/sub-district/municipal mapping is ambiguous, keep it unresolved and fail closed; never infer official IDs.

## Repository and release posture
- Repository: `vishaltradewinds/rupaykg`
- Branch: `intelligence/ai-evidence-intake-middleware`
- PR: #41 — https://github.com/vishaltradewinds/rupaykg/pull/41
- Head at checkpoint: `b49d8712efe7fa15504d671c1bbec68dc26808b6`
- Latest CI run at checkpoint: #1661, run ID `39583080336`, FAILED: https://github.com/vishaltradewinds/rupaykg/actions/runs/39583080336
- PR remains open, draft, unmerged and undeployed.
- Do not merge, deploy, or apply production migrations. Production and Shakti certification remain HOLD.

## Work in the branch
1. CPCB SWM workspace API requires explicit geography on create/update; database trigger rejects missing geography, organizations without verified roots, and out-of-scope geography.
2. Added strict helper `organization_has_explicit_geography_scope(organization_id, geography_id)`, leaving the legacy helper's compatibility behavior unchanged. High-impact MRV, EPR return, statutory evidence-binding, and value-layer routes use strict scope checks.
3. Added PostgreSQL acceptance assertions for missing/unscoped/unrelated geography cases.
4. Strengthened the existing `migrations/20261031_government_jurisdiction_crosswalk.sql` rather than retaining a duplicate migration. It defines evidence-backed mapping requests and two-person approval constraints for `authority_code + municipal_code + source_version` to organization/geography/optional activity. It requires explicit verified geography scope and a source-versioned canonical geography for VERIFIED mappings.
5. No real government identifiers were imported or fabricated. The crosswalk is not yet consumed end-to-end by the government inbox worker and does not itself constitute government authorization.
6. Updated Pan-India architecture conformance audit and migration documentation.

## Immediate next action — fix latest CI failure first
Run #1661 failed in disposable PostgreSQL acceptance:
- Test: `government inbox worker persists retry recovery, quarantine and append-only transition evidence in disposable PostgreSQL`
- File: `apps/src/async-mirror-worker-db.test.ts`
- Assertion around compiled test line 73 expected `STRUCTURAL_ONLY`, actual `STRUCTURAL_AND_JURISDICTION_CROSSWALK_RESOLVED`.
- Logs: https://github.com/vishaltradewinds/rupaykg/actions/runs/39583080336
Inspect the worker result contract and test setup before deciding whether the test is stale or the worker has incorrectly claimed resolution. Do not merely change the expected string until confirming whether a verified crosswalk actually existed in the fixture and was consumed. If crosswalk resolution is real, add assertions that verify the exact resolved authority/municipality, organization, geography, and optional activity and preserve unresolved/quarantine behavior for missing or ambiguous mappings. If it is not real, correct the worker to remain STRUCTURAL_ONLY until verified mapping is actually resolved.

## Remaining engineering sequence
1. Fix run #1661's failed PostgreSQL acceptance test based on actual semantics; rerun CI on the new head.
2. Add an authenticated, permission-checked API for crosswalk request creation and independent approval/rejection. Database triggers are necessary but not sufficient for actor authorization and append-only audit evidence.
3. Implement inbox worker resolution against the approved crosswalk. Match exact authority code, municipal code, source version, effective date, and one unique VERIFIED row; fail closed on no match or ambiguity. Bind to organization/geography and optional activity; do not treat external payload as trusted instructions.
4. Test missing, expired, revoked, ambiguous, wrong-source-version, wrong-tenant, wrong-activity, requester-self-approval, and stale evidence-digest cases in disposable PostgreSQL.
5. Complete repository-wide geography authorization inventory, including shared helpers in auth/server and all high-impact routes; classify lower-risk legacy call sites before altering the compatibility helper.
6. Implement/version jurisdiction-specific rule applicability and a verified government-source crosswalk. No invented LGD/authority codes.
7. Run multi-jurisdiction, Urban/Rural, tenant-isolation, lifecycle, migration-from-legacy-data and worker restart/retry/quarantine acceptance.
8. Only then gather clean staging evidence, alerts/on-call ownership, audit-chain concurrency/rollback, production-readiness and Shakti gates.

## Hard boundaries
- No production database writes or migrations, deployment, official submissions, external government API claims, Guardian/Hedera mutation, carbon-credit issuance, or official compliance/verification claims.
- User has said official API/access applications have been applied. Treat that as user-reported application status, not proof of approval, sandbox contract, or usable credentials.
- Continue using the existing PR and branch; do not create an unrelated branch or merge the draft PR.
- Report actual code/CI work and blockers; never claim completion before CI and evidence support it.
