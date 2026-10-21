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


## Resume update — 2026-10-21 10:31 UTC

### Completed since the 10:26 checkpoint
- Investigated failed CI run #1661 using the actual PostgreSQL acceptance log and inspected the worker implementation and fixture.
- Confirmed the worker had legitimately resolved the fixture's exact VERIFIED jurisdiction crosswalk; the test expectation `STRUCTURAL_ONLY` was stale, not a worker defect.
- Updated `apps/src/async-mirror-worker-db.test.ts` in commit `9fe15bbb1fcd8d2970fe8bab459ee94c10165c76`.
- The acceptance test now checks the resolved state and exact fixture organization/geography, nullable activity, source version, and continues asserting that official acceptance, MRV mutation and Guardian submission are false.
- Commit: https://github.com/vishaltradewinds/rupaykg/commit/9fe15bbb1fcd8d2970fe8bab459ee94c10165c76

### Verification status
- CI run #1661 failure was confirmed to be this stale test assertion. Its migration validation, migration application, typecheck, build and browser smoke steps had passed; test failure prevented the production-container build.
- The new commit currently has no reported combined status checks or associated PR workflow runs in the connector response. **Do not claim the correction passes CI until a new run is visible and green.**
- PR #41 remains draft, unmerged and undeployed; production release remains HOLD.

### Next action
1. Recheck Actions/status for commit `9fe15bbb1fcd8d2970fe8bab459ee94c10165c76`; if no workflow starts, inspect PR/branch synchronization and arrange a supported CI run without merging/deploying.
2. If the acceptance suite passes, continue the remaining Pan-India audit: crosswalk negative cases (wrong source version, expired/revoked and ambiguous mapping), broader geography authorization call-site inventory, jurisdiction-specific versioned applicability rules, and multi-jurisdiction/Urban-Rural/tenant-isolation coverage.
3. Keep all real government identifiers evidence-backed; never manufacture LGD/authority IDs. Do not mutate inherited staging inbox rows.


## Resume update — 2026-10-21 10:47 UTC

### Confirmed progress since the earlier checkpoint
- Corrected the asynchronous government inbox worker test to assert the real exact-source-version crosswalk resolution result and to retain synthetic organization/geography/source-version assertions.
- Inbox payloads now require an explicit `sourceVersion`; the worker matches the exact version in the approved crosswalk. A wrong version remains `UNRESOLVED`, with official acceptance, authoritative MRV mutation, and Guardian submission explicitly false.
- Crosswalk request API now requires `evidenceReference` to resolve to an immutable `db://evidence-vault/<artifact-version-uuid>` artifact, with a matching SHA-256 and organization/activity scope. Unbound references are rejected before a request is persisted.
- Added database-level evidence-binding triggers for both crosswalk requests and crosswalk records. A VERIFIED crosswalk must have a matching vault artifact and its evidence status must be independently `VERIFIED`; application checks are not the only enforcement layer.
- Updated disposable PostgreSQL fixtures to use vault-backed evidence, and regression coverage to reject unbound evidence.
- Updated the CPCB SWM database acceptance fixture to preserve its original dual-control test while meeting the new evidence-binding invariant.

### Latest verification
- Current branch head at this update: `554e806a57013a07788df66eedcf941b6dd4b98c`.
- GitHub Actions run #1673: https://github.com/vishaltradewinds/rupaykg/actions/runs/39587109042
- At checkpoint update time, dependency audit, migration validation/application, typecheck, build, browser smoke test, and disposable PostgreSQL acceptance all passed; production-container build was still running. Recheck the final run conclusion before treating this gate as fully green.
- Earlier runs #1669–#1672 failed while the new evidence-binding invariant exposed an outdated direct-insert test fixture; the fixture was corrected and the latest run’s full test/acceptance step now passes.

### Remaining gates — do not release
1. Confirm run #1673 completes successfully, including production-container build.
2. Add/verify regression cases for expired, revoked, ambiguous, wrong-tenant, and wrong-activity mappings; ensure unresolved data never becomes authoritative.
3. Complete repository-wide geography authorization and Urban/Rural governance rail inventory, then version jurisdiction-specific applicability rules using authoritative source evidence only.
4. Demonstrate clean isolated staging worker restart/retry/quarantine, alert delivery with named on-call ownership, audit-chain concurrency/rollback, and authorization.
5. Verify official CPCB/BEE/Indian Carbon Market integration contracts, credentials and approvals when supplied; do not infer access or simulate official acceptance.
6. Keep PR #41 draft, unmerged and undeployed until all applicable Shakti gates have evidence and explicit approval.

### Non-negotiable scope
RupayKg is Pan-India by design. Jabalpur/Kathonda is a validation site only. Preserve distinct Urban (ULB/ward/locality) and Rural (Gram Panchayat/village/cluster) governance rails. Never fabricate official identifiers, claim external approval, or treat structural intake validation as official acceptance, statutory compliance, MRV verification, or credit issuance.


## Resume update — 2026-10-21 10:51 UTC

- Added disposable PostgreSQL regression coverage proving that a crosswalk with the exact authority/municipality/source version is still not resolved when it is expired at the batch's sync-window timestamp or has been revoked.
- The expiry fixture keeps the crosswalk valid at database wall-clock time while making it expired relative to the batch timestamp; the database intentionally rejects attempts to update a VERIFIED mapping to an already-expired timestamp.
- Current code/test head: `f9d4685c70ca48f02a9b3ab8cc479d8e3fe00dea`.
- GitHub Actions run #1676: https://github.com/vishaltradewinds/rupaykg/actions/runs/39587595524. Migration validation/application, dependency audit, typecheck, build, browser smoke test and disposable PostgreSQL acceptance all passed. Production-container build was still running at this checkpoint update; recheck the final run conclusion before claiming the full gate passed.
- The earlier complete run #1673 passed all steps, including production-container build, on the prior head. Run #1676 is the current verification for the additional expiry/revocation regression tests.
- Release remains HOLD. PR #41 stays draft, unmerged and undeployed. Continue wrong-tenant/wrong-activity and ambiguous mapping tests, Pan-India Urban/Rural governance and geography authorization audit, and official integration/approval evidence gates.
