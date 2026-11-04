# CTO execution checkpoint — MRV source snapshot revalidation

Date: 2026-11-02 18:01 UTC
Governing standard: Shakti Standards
Canonical repository: vishaltradewinds/rupaykg
Status: fail-closed source revalidation implemented in candidate branch; fixture correction submitted; exact-head CI in progress; production HOLD; worker OFF.

## 1. Candidate code state

PR #192 remains OPEN / DRAFT / UNMERGED.
Latest head: 4781bfe03ac68bf61031b9c2e8924dcd498d259e.
Branch: shakti/auth-bootstrap-application-integration-2026-11-01.

### Source snapshot revalidation

- Commit 30661ab6dc350f19dcbd44d4034486a428c151fc extends isMrvSubmissionJobStillAuthorized() to re-read the live observation rows, evidence rows and latest measurement quantity/unit before every irreversible provider stage.
- The function compares a normalized live snapshot against the immutable enqueue-time JSONB snapshot using stable JSON serialization. A changed measurement quantity or evidence content hash denies provider authorization.
- Commits f0ffd8523f69602752d5a5e74d818bdd12d939e5 and 3d4879fbaa02c66dcf02f446f39e8900f3c902bf add disposable PostgreSQL assertions for measurement and evidence-hash mutation, and restoration of the exact enqueue-time values.
- Commit b60f53fa64790527cb3b72d53429f4362e35a8f2 adds deterministic timestamp + row-ID ordering to the worker revalidation queries.
- Commit 770232b9066a307cf5f458e7299068b174afd64d aligns the API enqueue, direct-submit preflight and post-provider re-read queries to the same timestamp + row-ID ordering.
- Commit 6edc4d726663ffaf828dbcf910cf39bfd32010af corrected the disposable test fixture to construct the same complete source snapshot as the real API route: live observations, evidence rows, quantity and unit.
- Commit 4781bfe03ac68bf61031b9c2e8924dcd498d259e aligned the test fixture's ordering with the API and worker queries.

### CI failure diagnosis and correction

- Exact-head run 41496015060 failed in the disposable MRV job integration test at the initial “valid requester membership and current MRV bindings authorize provider work” assertion.
- The failure was caused by an incomplete test fixture, not by a reason to weaken the fail-closed implementation: the fixture stored empty observations/evidence and omitted quantity/unit, while the database contained a verified evidence row and a measurement. The live snapshot comparison correctly rejected the mismatch.
- The fixture now queries and stores the same source rows and quantity/unit as the API enqueue path. The evidence-hash mutation test and deterministic ordering are included in the current head.
- Exact-head run 41496454924 for head 4781bfe is in progress; at 18:01 UTC it had passed dependency installation and was at TypeScript typecheck. Do not claim the source-snapshot acceptance tests pass until this exact-head run completes successfully.
- Prior runs 41496118629 and 41496146332 also failed at the same incomplete fixture assertion. They remain historical failed runs.
- Exact-head run 41495848722 for the synchronous MRV route gate tests completed SUCCESS. The default-off and worker/direct mutual-exclusion tests passed before the container build completed.
- Exact-head run 41495699292 for NEEDS_RECONCILIATION claim exclusion completed SUCCESS.
- Exact-head run 41495765539 for the worker database-contract documentation completed SUCCESS.
- Exact-head run 41495348937 for the heartbeat/direct-submit gate code completed SUCCESS, including the full test suite and production-container build.

## 2. Other MRV safety controls retained

- The legacy synchronous POST /api/v1/mrv/activities/:activityId/submit route is disabled unless RUPAYKG_MRV_DIRECT_SUBMIT_ENABLED=true and refuses execution whenever RUPAYKG_MRV_WORKER_ENABLED=true. The durable queue is the intended canonical provider path.
- apps/src/mrv-routes.test.ts proves the direct route returns MRV_DIRECT_SUBMIT_DISABLED before authentication/database access by default and also when the worker is enabled. Exact test run 41495848722 passed.
- The durable worker uses a 30-second heartbeat around Guardian, HCS and Mirror Node calls, renewing a 120-second lease. If the lease is lost, provider results are not persisted under the stale token. The heartbeat does not cancel an in-flight provider call; bounded timeouts and adapter-level cancellation remain open.
- NEEDS_RECONCILIATION jobs are not automatically claimable; they require explicit operator review. Exact test run 41495699292 passed.
- The worker still uses direct SQL and has no approved signed-tenant/system-actor database contract. The proposed narrow worker runtime/function API is documented but not implemented. Worker and queue remain OFF.

## 3. Integration and production gates

- PR #192 is still two commits behind main relative to merge base b5e91241d84a6712ff544d3deec1805702f45efd. Main is a3fecc0abd2c46549a201058d3963afc0e3a73c9. Main commit 14b735 added AUTH_DATABASE_URL; a3fecc0 reverted it. PR #192 requires a separate auth runtime pool. Reconcile this contract before merge.
- PR #213 remains the only EPR read-only candidate, head 00f50eedee10035cf98adf58c1b642c4eac7d158, prior exact-head CI 41493275165 SUCCESS on an older base. Reconcile onto the current #192 head and rerun CI before independent review/merge.
- PRs #205, #211 and #212 are CLOSED UNMERGED as superseded; branch histories are preserved.
- Issues #195 and #196 were updated with current bootstrap, CI and production tenant-isolation evidence.
- Neon production remains 67 public tables, 0 RLS, 0 FORCE RLS, 92 migration rows/latest 20261021, zero organizations/identities/roles/memberships/platform access requests, and an elevated rupaykg login role. The primary branch is unprotected; project metadata has no IP allowlist entries and public connections are not blocked. No production setting or database object was changed.
- Founder-approved initial authority identities/two-custodian secret ceremony, independent security review and DBA-approved production roles/secrets remain indispensable.

## 4. TRL and release posture

- National platform: provisional TRL 3.
- Tested software slices: at most provisional component-level TRL 4.
- MRV/carbon/registry/settlement: component-dependent TRL 3–4.
- IoT/edge and external integrations: TRL 2–3 / NOT VERIFIED.
- No real-site operation, calibrated instrumentation, live Guardian/Hedera/Mirror Node acceptance, statutory portal acceptance, independent field evaluation or disaster-recovery acceptance is established. TRL 9 is NOT ESTABLISHED.
- Production Neon: READ-ONLY / HOLD. Worker/scheduler: OFF. Certification: OFF.

## 5. Next actions

1. Recheck exact-head CI 41496454924. If it fails, inspect the first failing assertion and preserve the fail-closed comparison.
2. Verify the evidence-hash mutation and restoration assertions pass in disposable PostgreSQL.
3. Add observation-row mutation coverage if a representative observation fixture is available; retain deterministic timestamp + ID ordering.
4. Reconcile PR #192 with main's two commits and the AUTH_DATABASE_URL/auth-pool runtime contract.
5. Reconcile PR #213 onto the latest #192 head and rerun full CI.
6. Replace worker direct SQL with the narrow system-actor SECURITY DEFINER function API, then run two-tenant, revocation, lease-loss, retry and reconciliation tests.
7. Complete the 67-table RLS and route/worker/function/trigger/role manifest on disposable production-derived PostgreSQL.
8. Keep production, worker, deployment and certification gates closed until founder, independent security and DBA approvals are complete.

This checkpoint is immutable. Subsequent work must add a new checkpoint rather than rewrite it.
