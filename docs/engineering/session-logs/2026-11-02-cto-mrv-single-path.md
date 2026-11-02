# RupayKg CTO session log — MRV single-path enforcement and worker contract

Date: 2026-11-02
Canonical repository: vishaltradewinds/rupaykg
Governing framework: Shakti Standards

## 17:56 UTC — MRV execution-path safety batch

### Engineering changes
- Inspected the current MRV worker and route after the prior checkpoint. Confirmed the worker heartbeat is applied to Guardian, Hedera HCS and Mirror Node calls, with 30-second renewal of a 120-second lease.
- Verified the heartbeat does not cancel an already-running external request if lease renewal fails. The worker discards the result instead of persisting under a lost lease; bounded timeouts and adapter cancellation remain open.
- Verified the synchronous MRV submit route and durable worker were separate provider execution paths. Commit beef362ebe6538e53d28f97a55b619c6c79ec741 now fails closed unless the direct-submit flag is explicitly true and refuses direct submission whenever the durable worker is enabled.
- Added apps/src/mrv-routes.test.ts at commit ffab45c64c301f6e38d9678972071546c323d54e. The two tests prove the disabled route returns 503 before auth/database access by default and remains disabled when the worker flag is enabled. Exact-head CI is pending; no pass is claimed.
- Verified commit 739d11fb802d69fb8a64fa8238b4a4e9104f84f1 adds a PostgreSQL regression proving NEEDS_RECONCILIATION jobs are not automatically claimed.
- Verified commit 61cd23b801f38f95202e908f20abe8745e527993 adds the concrete restricted worker database role/function specification. It is design evidence only; worker direct SQL and missing worker RLS functions remain release blockers.

### CI
- Exact-head run 41495348937 for 461aa5367eed48bfb02524bbf7ca9ea4e56878db completed SUCCESS, including production-container build.
- Run 41495699292 for the NEEDS_RECONCILIATION test commit was in progress at browser smoke.
- Run 41495765539 for the worker-contract documentation head was in progress at build.
- No workflow run was visible yet for the latest test commit ffab45c64c301f6e38d9678972071546c323d54e. Recheck before accepting the new tests.

### Integration and safety
- PR #192 remains the canonical auth/bootstrap integration branch but is still draft/unmerged and two commits behind main relative to its merge base. Main's AUTH_DATABASE_URL addition and subsequent revert must be reconciled before merge.
- PR #213 remains the only EPR read-only candidate, with prior exact-head CI success on an older #192 base; it needs reconciliation and fresh CI.
- PRs #205, #211 and #212 were closed unmerged as superseded; branches preserved.
- Neon production remains 0/67 RLS with the elevated rupaykg login. No production settings, roles, grants, schemas, data, secrets or branches were changed.
- No production DDL/DML, migrations, deployments, external provider writes, worker/scheduler activation, regulatory submissions or certification occurred.
- Production HOLD; worker OFF; certification OFF; TRL 9 NOT ESTABLISHED.

## Next actions
1. Verify exact-head CI for ffab45c and the two in-progress runs.
2. Reconcile #192 with main and #213 with the latest #192 head.
3. Implement and test the narrow worker database function API and lease-loss/reconciliation contract.
4. Continue route-to-data and 67-table RLS assurance on disposable PostgreSQL only.
