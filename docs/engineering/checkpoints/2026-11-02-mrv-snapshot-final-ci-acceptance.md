# CTO verification checkpoint — MRV source snapshot final CI acceptance

Date: 2026-11-02 18:04 UTC
Canonical repository: vishaltradewinds/rupaykg
Governing standard: Shakti Standards
Status: latest MRV source snapshot candidate CI PASS; production HOLD; worker OFF; certification OFF.

## 1. Exact-head CI acceptance

- Code/test head 59c5dc1d0976dbd7b92e2d9194c3d3f07f40e431 completed exact-head workflow 41496873635 with all 22 steps SUCCESS.
- The subsequent documentation-only head 250395f4914fe74bb4fdbb19e3beff2867fa5aa8 completed workflow 41496954424 with all 22 steps SUCCESS.
- Verified stages: dependency audit, migration validation, restricted verifier-owner provisioning, disposable PostgreSQL migrations, temporary bootstrap privilege revocation, synthetic two-custodian bootstrap, TypeScript typecheck, production build, browser smoke/artifact upload, full tests including disposable PostgreSQL acceptance, production-container build and cleanup.

## 2. Accepted MRV source-snapshot behavior

- Worker authorization re-reads live MRV observations, evidence and latest measurement quantity/unit before provider stages and compares them with the immutable enqueue-time JSONB snapshot.
- Measurement quantity mutation and evidence content-hash mutation both invalidate authorization; restoring exact enqueue-time values restores the authorization result.
- The first source-snapshot CI failures were caused by incomplete synthetic fixtures, not by a reason to weaken the source comparison. The fixtures now capture the same observations, evidence, quantity and unit as the API enqueue path.
- Deterministic ordering uses timestamp plus row ID for observation/evidence arrays and latest measurement selection.
- The source comparison remains fail-closed. CI acceptance is limited to disposable PostgreSQL and synthetic data.

## 3. Accepted MRV execution safety gates

- Legacy synchronous MRV submit defaults OFF and refuses to run whenever the durable worker is enabled. Its two route tests passed in CI 41495848722, asserting 503 before auth/database access.
- NEEDS_RECONCILIATION jobs are not automatically claimable; CI 41495699292 passed the operator-review hold assertion.
- Worker lease heartbeat runs every 30 seconds around Guardian, HCS and Mirror Node calls with a 120-second lease. Lease-loss results are not persisted under a stale token.
- The heartbeat does not cancel an already-running provider call; bounded provider timeouts and adapter-level cancellation remain open.
- Worker direct SQL remains a release blocker. The narrow system-actor SECURITY DEFINER function API is specified but not implemented. Worker and queue remain OFF.

## 4. Current GitHub integration state

- PR #192 current head: 250395f4914fe74bb4fdbb19e3beff2867fa5aa8; OPEN / DRAFT / UNMERGED.
- PR #192 is two commits behind main relative to merge base b5e91241d84a6712ff544d3deec1805702f45efd. Main is a3fecc0abd2c46549a201058d3963afc0e3a73c9. Main added and then reverted AUTH_DATABASE_URL; PR #192 restores the separate auth runtime pool. Reconcile this contract before merge.
- PR #213 is the only EPR read-only candidate; prior exact-head CI 41493275165 passed on an older base. Reconcile/rebase against current #192 and rerun full CI before independent review/merge.
- PRs #205/#211/#212 are CLOSED UNMERGED as superseded; their branch histories remain preserved.
- PRs #193/#194 BWG exact-head CI runs 41332732530 and 41332741365 passed, but no independent reviews are recorded and both are based on old main merge-base b5e91241. Reconcile with current main and obtain independent review before merge.
- PR #203 UI/UX exact-head CI 41454665904 passed; no independent review is recorded. Accessibility, localization and field usability acceptance remain open.
- Issues #195 and #196 have been updated with the current CI and production evidence.

## 5. Authoritative Neon production — read-only

- Project: rupaykg-production-fresh / steep-mud-79906940.
- Primary/default branch: main / br-restless-base-b44cip2h.
- Database: rupaykg.
- Public base tables: 67; RLS 0; FORCE RLS 0.
- Migration ledger: 92 rows; latest 20261021.
- Organizations, identities, roles, memberships and platform access requests: all 0.
- Inspected rupaykg login role: BYPASSRLS, CREATEROLE, CREATEDB and INHERIT.
- Neon primary branch is unprotected; no IP allowlist entries are configured and public connections are not blocked.
- PR #192 requires rupaykg_app_runtime and rupaykg_auth_runtime as separate roles; neither was present in the inspected production role set. No role or secret was provisioned.
- No production database, setting, branch, role, grant, secret or deployment was changed.

## 6. Shakti lifecycle and TRL

- Context/evidence discovery: repository, PRs, CI, issues and authoritative Neon catalog inspected.
- Statutory boundary: no statutory portal acceptance, external registry submission or regulator approval claimed.
- Feasibility/design/engineering: signed tenant context, MRV snapshot binding, provider-path exclusion and worker contract advanced in candidate code.
- Testing: exact-head CI and disposable PostgreSQL acceptance passed for the current tested code head.
- Independent approval, production migration, runtime role/secret provisioning, deployment, live operations and continuous assurance remain OPEN.
- National platform: provisional TRL 3.
- Tested software components: at most provisional TRL 4.
- MRV/carbon/registry/settlement: component-dependent TRL 3–4.
- IoT/edge/external integrations: TRL 2–3 / NOT VERIFIED.
- No real-site operation, calibrated instruments, live Guardian/Hedera/Mirror Node acceptance, statutory portal acceptance, independent field evaluation or disaster-recovery acceptance is established. TRL 9 is NOT ESTABLISHED.

## 7. Required approvals and next actions

1. Reconcile PR #192 with main and settle the separate auth runtime pool contract.
2. Reconcile PR #213 onto current #192 and rerun exact-head CI.
3. Complete endpoint → SQL/table → client/transaction → role/function → tenant/geography/bilateral scope mapping across HTTP, worker, webhook and background paths.
4. Complete the 67-table ownership/RLS policy and function/trigger/owner/search_path/EXECUTE-grant manifest on disposable production-derived PostgreSQL.
5. Implement the narrow worker function API, remove direct tenant-table SQL from worker runtime, and prove two-tenant, revocation, lease-loss, retry and reconciliation behavior.
6. Obtain founder approval for two distinct initial authority identities and the out-of-band two-custodian ceremony; obtain independent security and DBA approval for production roles/secrets and migration/rollback.
7. Keep Neon production read-only, worker/scheduler OFF, deployment HOLD and certification OFF.

Immutable checkpoint. Do not rewrite this file.
