# RupayKg TRL 9 execution reconciliation — 2026-11-03

## Purpose and controlling objective

This checkpoint operationalizes the master TRL 9 execution baseline supplied on 2026-11-03. RupayKg is intended to become a working, pan-India sovereign digital MRV and circular-economy operating system, demonstrated through Jabalpur SITE-JBP-01 (Kathonda). Engineering completion, operational acceptance, regulatory recognition and TRL 9 are distinct gates.

## Evidence checked in this reconciliation

Repository: `vishaltradewinds/rupaykg` (public GitHub repository; default branch `main`).

Live repository inspection confirmed:
- PR #213 is open and draft. Its GitHub PR metadata currently reports head `8c32583683320642e15bb48f43454d87d5537917`, base `ae41ed76ee7f5a64045f526edb1d95acda390945`, and 52 changed files.
- The PR body records earlier exact-head CI run #5120 as pending and later candidate corrections. The issue #215 discussion records still later candidate commits, including `a4db4c5...` and `a7805f6...`, with no exact-head CI pass claimed for those later commits. This conflicts with the currently returned PR head metadata. **The authoritative branch tip must be re-read from Git refs and reconciled before any merge or test claim.**
- PR #216 head `8693239b28587fb61e0f61c2f2d021b97f073fba`, PR #218 head `feeac1de3325a831012e1dc4967dfe95f9914e6d`, PR #229 head `1946b63ba9aba3a4c3c12c32f1a7948397c45960`, and PR #232 head `ca403e962f9fa6c5f27a0e29151c47e27e42a614` each returned a completed successful PR workflow run in the inspection. These CI results do not establish database, security, operational or TRL 9 acceptance.
- PR #213 exact head as returned by PR metadata had no associated PR workflow run at inspection time.
- PR #219 pilot-demo branch head `c488c5e6a1624c142f81941ba0edceb7f98ea7c3` is open/draft and diverges from its stated security parent `feeac1de3325a831012e1dc4967dfe95f9914e6d`: compare reports 9 commits ahead and 9 behind, with merge base `337bc5cc6abbf09acdc786c7c37ab7b4d1a57eb6`. Do not merge or retarget blindly; perform a reviewed rebase/cherry-pick or regenerate the demo branch from the current secured parent, then rerun CI.
- The issue #215 discussion documents that the verifier candidate now has important subject-bound authorization and geography controls, but its PostgreSQL negative-acceptance suite has been committed and **not executed**. It also identifies decision-time snapshot columns/values and approved-decision DELETE protection as gaps requiring explicit assertions and implementation proof.
- The same discussion identifies a geography policy decision: no implicit unlimited geography. National authorities need an explicit verified India root; local organizations need verified jurisdiction roots; Jabalpur needs a verified Jabalpur root and source-versioned administrative crosswalk. Missing, ambiguous, expired or cyclic mappings must deny/quarantine rather than silently grant national scope.
- The issue #215 worker-boundary audit says MRV worker queue, authorization, lease updates and final provenance still use a general Pool. A dedicated database principal and closed typed function interface, plus lease/concurrency/provider idempotency acceptance, remain required.
- A read-only rehearsal profile had one geography row, zero organizations, zero verified organization geography-scope rows and no cycle fixtures. This empty profile cannot establish hierarchy coverage or authorization correctness.
- Desktop Commander device `DESKTOP-AGPFFLB` was offline at inspection. No local checkout, local PostgreSQL execution or local source modifications were possible in this session.

## Immediate P0 work — do not waive

### 1. Establish authoritative source and migration history
- Read current Git refs for main and all active migration/security PRs; reconcile stale PR metadata versus discussion-reported commits.
- Reconcile production migration 096 source and ledger without replaying or rewriting production history.
- Compare main, staging and rehearsal migration catalogues; identify staging-only async mirror and AI intake schema.
- Establish one authoritative live database and explicit environment mapping.
- Produce immutable source/checksum provenance and independent DBA-reviewed disposition for every mismatch.
- Verify database owner, runtime, migration and worker principals; least privilege; append-only history; pinned search_path.
- No live DDL until independent review and disposable clean-install/upgrade rehearsal pass.

### 2. Verifier, geography and tenant isolation
- Populate the four decision-time authorization snapshot fields atomically from server/database-derived authorization for both APPROVED and REJECTED decisions; reject caller-supplied values.
- Enforce approved-decision immutability at the database boundary, including DELETE denial; corrections use superseding records.
- Add cyclic geography fixtures where the verified root itself participates in the cycle.
- Define and test national, state, district, ULB, facility and pilot scopes; explicit India root for national authority; verified Jabalpur root for pilot.
- Run disposable PostgreSQL tests for clean migration, two-tenant isolation, permission revocation, identity suspension, cross-organization membership, self-verification, evidence binding, approved/rejected snapshots, mutation/delete denial, missing/expired/ambiguous/cyclic geography.
- Execute the opt-in DB suite and record exact command, PostgreSQL version, migration head, commit SHA and results. Static regex checks are not database acceptance.

### 3. EPR, MRV, BWG and Evidence Vault
- Audit every protected handler for authentication, authorization and protected data access on the same signed tenant transaction.
- Convert remaining shared-pool reads in resource-flows, compliance, carbon, registry, settlement and ESG route-by-route.
- Finish Evidence Vault upload, review and write-path authorization.
- MRV worker must not use a general API Pool for privileged queue/authorization/provenance operations. Use a dedicated non-login, non-bypass principal with a reviewed function boundary.
- Test concurrent claims, stale/expired leases, lease theft, revocation between irreversible stages, provider timeouts/retries and idempotency-key payload mismatch.
- Do not enable worker or global RLS using the ordinary API database role.

## Parallel P1 streams

- Jabalpur field workflow: stakeholder and facility onboarding, jurisdiction, source/material flows, weighbridge capture, evidence/OCR, methodology, reconciliation and verifier acceptance.
- Hardware: RS232 weighbridge, sensor calibration, device identity, secure ingestion, offline synchronization, accuracy and MeitY applicability checks.
- Guardian/Hedera/VC: distinguish submitted, consensus-confirmed and independently verified states; verify Mirror Node reconciliation, asymmetric W3C VC signing, custody/rotation and independent provenance.
- Registry/commercial: eligibility, issuance boundaries, transfer, retirement, buyer/seller, settlement, financial reconciliation and statutory reporting.
- Stakeholder demonstration: role-specific dashboards backed by authorized APIs; visibly label synthetic, measured, verified and officially recognized records.
- CDPI Wave 1: source-backed inventory, license/attribution review, architecture mapping, high-value integrations and regression/security tests; build reusable integration standards for other AVGAT INFRASYS platforms.

## Branch integration control

- PR #219 currently diverges from its declared security parent by 9 commits in each direction. Keep draft. Reconcile the diff and branch ancestry with an explicit reviewed integration plan; do not use GitHub's blind update-branch action.
- Treat each PR as an engineering candidate until exact-head CI and dependency-specific acceptance pass.
- Before each merge, verify current head SHA, base SHA, changed files, merge base, CI run tied to exact head, review state and downstream dependency graph.
- Do not parallelize conflicting edits to the same migration, authorization helper, transaction boundary or schema object. Assign one integration owner per shared surface and rebase dependent work after that surface is stable.

## Release gates

Production remains HOLD. Global RLS activation, production migrations, role/grant changes, worker activation, feature-flag enablement, deployment and certification are not authorized by this checkpoint.

TRL 9 remains NOT ESTABLISHED until real field deployment, real stakeholder participation, validated measurement, complete end-to-end operations, independent verification, reliability/security evidence, traceable reproducible outcomes, acceptance records and applicable external approvals are demonstrated.

## Session actions and limitations

- Created this checkpoint branch: `shakti/trl9-execution-reconciliation-2026-11-03`.
- This document is a control-plane reconciliation record only. It does not change application code, database state, RLS, production configuration or certification status.
- GitHub comment creation was blocked by the connector safety layer; Desktop Commander was offline. No PR comment, code fix, PostgreSQL run, merge or deployment is claimed.
- Next required action: bring the authorized development workstation online, reconcile current Git refs and perform the P0 code/test batch on the authoritative branch; do not infer that work has run in the background.


## Follow-up source audit — durable MRV worker boundary

Inspected the actual candidate source on `security/epr-explicit-client-read-2026-11-02`:

- `apps/src/mrv-submission-worker.ts` exports `runMrvSubmissionWorkerOnce(pool: Pool, workerId: string)`. The same general `Pool` is used for queue claim, live authorization, lease renewal/release, state transitions and final provenance persistence. Its `withClient(pool, ...)` helper calls `pool.connect()` directly. The feature flag is a deployment guard, not a database privilege boundary.
- `apps/src/mrv-submission-jobs.ts` accepts `PoolClient` for the SQL helpers and re-checks organization, identity suspension, verified evidence, approved independent verification, membership, permission and geography before provider stages. These are useful application checks but do not constrain what the worker database principal can query or mutate.
- `migrations/20261109_durable_mrv_submission_jobs.sql` explicitly installs no grants, RLS policies, SECURITY DEFINER worker functions or role changes. Therefore it does not yet establish a least-privilege worker execution path.
- The worker has useful lease-token fencing, provider idempotency persistence, Guardian/Hedera stage separation, Mirror Node reconciliation and a final provenance transaction. Those controls do not remove the general-pool privilege gap.

### Required remediation before worker activation

1. Define a dedicated worker database principal with NOLOGIN/NOBYPASSRLS/NOINHERIT ownership posture as appropriate, no privileged role memberships, and no direct table DML privileges.
2. Move queue claim, authorization recheck, lease mutation, stage transition and final provenance into a small reviewed set of database functions with explicit arguments and fixed search_path. Prefer SECURITY INVOKER where feasible; if SECURITY DEFINER is necessary, use a non-login non-bypass owner, schema-qualified objects, pinned search_path, strict EXECUTE grants and adversarial privilege tests.
3. Change the TypeScript worker API to accept only a narrow typed worker repository/client interface, not a general application Pool. Keep external Guardian/Hedera/Mirror calls outside database transactions.
4. Prove direct SELECT/INSERT/UPDATE/DELETE denial and permitted-function-only execution using disposable PostgreSQL tests under the actual worker role.
5. Execute the full concurrency, stale-token, lease-theft, expiry/reclaim, authorization-revocation, provider-timeout/idempotency, Mirror reconciliation and finalization-after-lease-loss matrix.
6. Only after those tests and independent DBA/security review may the worker be enabled in a non-production rehearsal. No production role grants, migration, worker activation or RLS change is authorized by this review.

This is a source-level finding, not a claim that PostgreSQL acceptance has passed. The workstation remains unavailable for local execution; exact-head CI and disposable DB evidence must be recorded separately.
