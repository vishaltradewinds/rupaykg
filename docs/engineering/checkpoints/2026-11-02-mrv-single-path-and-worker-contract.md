# CTO execution checkpoint — MRV single-path enforcement and worker contract

Date: 2026-11-02 17:56 UTC
Governing standard: Shakti Standards
Canonical repository: vishaltradewinds/rupaykg
Status: new safety gates implemented in candidate code; exact-head CI pending; production HOLD; worker OFF.

## 1. New engineering changes on canonical PR #192

Canonical integration branch: shakti/auth-bootstrap-application-integration-2026-11-01
Latest head at 17:56 UTC: ffab45c64c301f6e38d9678972071546c323d54e
PR #192 remains OPEN / DRAFT / UNMERGED.

### Single MRV provider execution path

- Commit beef362ebe6538e53d28f97a55b619c6c79ec741 adds a fail-closed guard to POST /api/v1/mrv/activities/:activityId/submit.
- The legacy synchronous provider path now returns MRV_DIRECT_SUBMIT_DISABLED unless RUPAYKG_MRV_DIRECT_SUBMIT_ENABLED=true.
- It also refuses to run whenever RUPAYKG_MRV_WORKER_ENABLED=true, preventing the direct route and durable worker from executing provider submissions concurrently.
- The durable queue remains the intended canonical provider path; direct mode is a controlled fallback only.
- Added apps/src/mrv-routes.test.ts at commit ffab45c64c301f6e38d9678972071546c323d54e. It tests that the direct route returns 503 before authentication or database access when disabled by default, and also remains disabled when the worker flag is true even if direct-submit is true.
- The new route tests are not yet accepted: no exact-head workflow run for ffab45c has been observed.

### Worker lease heartbeat and reconciliation

- Commit 248e9979fbd0eb62b2338f05bec928e9228dc61b adds a 30-second lease heartbeat around Guardian, Hedera HCS and Mirror Node calls, renewing a 120-second lease.
- If renewal fails, the worker discards the provider result rather than persisting under a lease it no longer owns. The next owner must reconcile using the same persisted Guardian idempotency key or Hedera transaction ID.
- The heartbeat does not cancel an already-running external call. Bounded provider timeouts and adapter-level cancellation remain open.
- Commit 739d11fb802d69fb8a64fa8238b4a4e9104f84f1 adds a disposable PostgreSQL regression proving NEEDS_RECONCILIATION jobs are not automatically claimed; they remain held for explicit operator review.
- The exact workflow runs for the 739d11 test commit and the subsequent documentation head were still in progress at the time of inspection. See the CI table below.

### Restricted worker database contract

- Commit 61cd23b801f38f95202e908f20abe8745e527993 expands the worker release-gate document with a concrete restricted database contract.
- Proposed runtime role: rupaykg_mrv_worker_runtime, LOGIN/NOBYPASSRLS/NOINHERIT/no elevated attributes/no role memberships; EXECUTE-only access to reviewed worker functions; no direct table/sequence/view/signing-key privileges.
- Proposed owner: rupaykg_mrv_worker_owner, NOLOGIN/NOBYPASSRLS, owns only narrow SECURITY DEFINER functions, fixed search_path, schema-qualified objects, no dynamic SQL, PUBLIC EXECUTE revoked.
- Required narrow function API covers claim, current authorization, Guardian key persistence, HCS binding persistence, lease renewal, stage advance, retry release and atomic provenance finalization.
- This is a specification, not an implemented migration or approved role contract. Current worker TypeScript still issues direct SQL; migration 20261109 intentionally has no worker grants, RLS policies or SECURITY DEFINER functions. Worker remains OFF.

## 2. Exact-head CI state

| Head / change | Workflow | Verified state |
|---|---|---|
| 461aa5367eed48bfb02524bbf7ca9ea4e56878db — heartbeat, direct-submit gate and corrected worker note | 41495348937 | SUCCESS; migration validation, disposable migrations/bootstrap, typecheck, build, browser smoke, full tests and production container all passed |
| 739d11fb802d69fb8a64fa8238b4a4e9104f84f1 — NEEDS_RECONCILIATION claim exclusion test | 41495699292 | IN PROGRESS at browser smoke when inspected |
| 61cd23b801f38f95202e908f20abe8745e527993 — worker contract documentation | 41495765539 | IN PROGRESS at build when inspected |
| ffab45c64c301f6e38d9678972071546c323d54e — synchronous MRV route gate tests | No run visible yet | PENDING; do not claim test pass |

Earlier source-snapshot correction commit b0287552b9211e4c7610ed18da8f0eb1ddbe3780 passed exact-head CI 41494418403. Documentation-only head c68c023b264522b16530b07e6b846c65135a414e passed 41494550889. The latest green result at the time of this checkpoint is 41495348937 on 461aa, not the current head ffab.

## 3. Integration and production boundaries

- PR #192 is two commits behind current main relative to merge base b5e91241d84a6712ff544d3deec1805702f45efd. Main is a3fecc0abd2c46549a201058d3963afc0e3a73c9. The auth-pool contract must be reconciled deliberately; no blind rebase or merge.
- PR #213 remains the only EPR read-only candidate. Head 00f50eedee10035cf98adf58c1b642c4eac7d158; exact CI 41493275165 SUCCESS on its older base. It must be reconciled onto the current #192 head and rerun before review/merge.
- PRs #205, #211 and #212 are CLOSED UNMERGED as superseded; their branches are preserved.
- Production Neon remains 67 public tables, 0 RLS, 0 FORCE RLS, 92 migration rows/latest 20261021, zero organizations/identities/roles/memberships/platform access requests, and an elevated rupaykg login role.
- The primary Neon branch remains unprotected; project metadata has no IP allowlist entries and public connections are not blocked. No settings were changed.
- Founder-approved initial authority identities/two-custodian secret ceremony, independent security review and DBA-approved production roles/secrets remain indispensable.

## 4. TRL and Shakti decision

- System-level provisional TRL remains 3.
- Tested software components remain at most provisional TRL 4.
- MRV/carbon/registry/settlement remain component-dependent TRL 3–4.
- IoT/edge and external integrations remain TRL 2–3 / NOT VERIFIED.
- No real-site, calibrated instrumentation, Guardian/Hedera/Mirror Node production, statutory portal or independent operational acceptance was established. TRL 9 is NOT ESTABLISHED.
- Production remains READ-ONLY / HOLD; certification OFF; worker/scheduler OFF.

## 5. Next actions

1. Obtain and inspect exact-head CI for ffab45c; repair any route-test or registration failure without weakening the guard.
2. Recheck runs 41495699292 and 41495765539; update the status only from their exact job conclusions.
3. Add explicit lease-loss/provider timeout/reconciliation tests and ensure the worker does not persist under a lost lease.
4. Replace worker direct SQL with the narrow system-actor SECURITY DEFINER API, then test two-tenant isolation and revocation between every provider stage.
5. Reconcile PR #192 against main's two commits and the AUTH_DATABASE_URL contract.
6. Reconcile PR #213 onto current #192 and rerun its full CI.
7. Finish the 67-table RLS, route, worker, function, trigger, owner and grant matrix on disposable production-derived PostgreSQL.
8. Keep production, worker, deployment and certification gates closed until founder, independent security and DBA approvals are complete.

This checkpoint is immutable. Subsequent work must create a new checkpoint rather than rewrite this file.
