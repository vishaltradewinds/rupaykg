# RupayKg engineering execution log

Append-only record. Do not rewrite earlier entries.

## 2026-11-02 17:23 UTC — CTO automation run 2

- Re-established canonical repository `vishaltradewinds/rupaykg` and inspected GitHub main, open PRs/issues, latest CI runs, exact-head job steps/logs, and Neon production project/branches/catalog.
- Confirmed production Neon: project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`; 67 public tables, 0 RLS, 0 FORCE RLS, 92 migration-ledger rows/latest `20261021`, only inspected `rupaykg` role with BYPASSRLS/CREATEROLE/CREATEDB.
- Reviewed PR #211 EPR read-only RLS route and exact-head CI. Added negative integration assertions for EPR INSERT/UPDATE/DELETE and signing-key table SELECT; used savepoints to ensure each expected permission error is independently tested.
- Commit: `0d4ea374d13cec45b7cb4855fce1e4725225fd40`.
- Exact-head CI [41490199189](https://github.com/vishaltradewinds/rupaykg/actions/runs/41490199189) SUCCESS: migrations, restricted roles in disposable CI PostgreSQL, typecheck, build, two-custodian bootstrap test, browser smoke, full tests and container build.
- Diagnosed preceding CI failure [41490061149](https://github.com/vishaltradewinds/rupaykg/actions/runs/41490061149): failed expected-denial assertion due aborted transaction; fixed with savepoints and verified on new exact head.
- Updated PR #211 body with exact-head evidence.
- Closed PR #207 unmerged as superseded by the stronger #211 EPR read-only RLS implementation; preserved its branch.
- Updated P0 issue #195 with current PR #192 CI pass and the still-missing founder/DBA/security approvals.
- Render service inspection remains blocked pending explicit workspace selection. No workspace was selected.
- No production database, role, grant, migration, secret, deployment, worker, scheduler or certification change was made.
- Next: reconcile #192 → #205 → #211; complete endpoint/table/transaction/tenant matrix; obtain founder and independent security/DBA gates; keep production HOLD.


## 2026-11-02 17:53 UTC — auth/MRV convergence and branch hygiene

- Reconfirmed canonical repository, latest PR heads, exact-head CI jobs and the authoritative Neon production branch. Read-only production query: 67 public tables, 0 RLS, 0 FORCE RLS, 92 migration rows/latest 20261021, zero organizations/identities/roles/memberships/platform access requests, and elevated rupaykg login role.
- Reverified the MRV source-snapshot typecheck correction: commit b028755 uses a separate SHA-256 digest rather than passing non-anchor fields to the strict Hedera AnchorPayload hash. Exact-head CI 41494418403 passed the complete workflow. Documentation-only head c68c023 passed 41494550889. Current PR #192 head 8f28e4f is a test-deduplication commit; CI 41495054442 had passed full tests and was at production-container build at 17:53 UTC.
- Reverified PR #213 EPR read-only candidate CI 41493275165 SUCCESS. It uses one signed tenant transaction client for permission and protected reads, defaults OFF, and registers no EPR write routes. Rebase/reconciliation against the newer #192 head and independent review remain required.
- Closed PRs #205, #211 and #212 unmerged with explicit supersession comments; preserved their branches. PR #213 remains the only EPR read-only candidate in this integration stack.
- Inspected current MRV worker source: 30-second heartbeat wraps Guardian, HCS and Mirror Node calls and renews a 120-second lease. Prior “no heartbeat” note is stale. Worker still lacks the signed-tenant/system-actor RLS access model; lease-loss cancellation/race tests remain open; worker stays OFF.
- Main is two commits ahead of PR #192's merge base. Main commit 14b735 added AUTH_DATABASE_URL and a3fecc0 reverted it; PR #192 requires a separate auth runtime pool. This contract must be reconciled before merge; no blind rebase/merge.
- Neon metadata also reports an unprotected primary branch, no IP allowlist entries and public connections not blocked. This is an additional hardening item; no setting was changed.
- Added immutable checkpoint: docs/engineering/checkpoints/2026-11-02-auth-mrv-convergence-and-release-gates.md. Added session log: docs/engineering/session-logs/2026-11-02-cto-auth-mrv-convergence.md. Updated the latest resume pointer in this documentation branch.
- No production DDL/DML, migrations, role/grant/RLS changes, Neon branch operations, secrets, deployments, provider writes, worker/scheduler activation or certification occurred. Production HOLD; certification OFF; TRL 9 NOT ESTABLISHED.


## 2026-11-02 17:56 UTC — MRV single-path enforcement and worker contract

- Verified code commit 248e997 adds a 30-second heartbeat around Guardian, HCS and Mirror Node calls with 120-second lease renewal. Lease-loss results are discarded; in-flight provider calls are not cancelled, so bounded timeouts and adapter cancellation remain open.
- Verified commit beef362 fails closed on the legacy synchronous MRV submit route unless explicitly enabled and refuses direct submission whenever the durable worker is enabled. This prevents concurrent direct/worker provider execution.
- Added apps/src/mrv-routes.test.ts at commit ffab45c64c301f6e38d9678972071546c323d54e. It asserts default-off and worker/direct mutual exclusion before auth/database access. Exact-head CI for ffab45c is pending; no test pass is claimed.
- Verified commit 739d11 adds a disposable PostgreSQL assertion that NEEDS_RECONCILIATION jobs are not automatically claimed. Run 41495699292 was in progress at browser smoke. Run 41495765539 for the worker contract documentation was in progress at build.
- Verified exact-head CI 41495348937 SUCCESS on head 461aa5367eed48bfb02524bbf7ca9ea4e56878db, including migration validation, disposable migration/bootstrap, typecheck/build, browser smoke, full tests and container build.
- Closed PRs #205/#211/#212 unmerged as superseded; branches preserved. PR #213 remains the only EPR read-only candidate pending rebase to current #192 and fresh CI.
- Production Neon remains 0/67 RLS and the elevated rupaykg login is unchanged. Main is two commits ahead of PR #192's merge base; AUTH_DATABASE_URL/auth-pool contract must be reconciled before merge.
- Added immutable checkpoint docs/engineering/checkpoints/2026-11-02-mrv-single-path-and-worker-contract.md and session log docs/engineering/session-logs/2026-11-02-cto-mrv-single-path.md; refreshed the resume pointer.
- No production DDL/DML, migrations, roles/grants/RLS changes, branch operations, secrets, deployments, provider writes, worker/scheduler activation or certification. Production HOLD; worker OFF; certification OFF; TRL 9 NOT ESTABLISHED.


## 2026-11-02 18:01 UTC — MRV source snapshot revalidation and CI fixture repair

- Worker authorization now re-reads observations, evidence and latest measurement quantity/unit before provider stages. The immutable enqueue snapshot comparison rejects changed source data.
- Disposable tests cover measurement quantity and evidence content-hash mutation and exact restoration. Deterministic timestamp + row-ID ordering was aligned across worker revalidation, API enqueue, direct preflight/re-read and the test fixture.
- Exact CI 41496015060 failed because the synthetic fixture omitted live evidence and quantity/unit while the database contained them. The fail-closed comparison was correct; the fixture was repaired to query the same source rows as the API. Runs 41496118629 and 41496146332 also failed at this same fixture assertion.
- Exact CI 41495848722 passed the direct-submit default-off/mutual-exclusion tests; 41495699292 passed NEEDS_RECONCILIATION claim exclusion; 41495765539 passed the worker contract docs. Current exact-head CI 41496454924 for 4781bfe was at TypeScript typecheck at 18:01 UTC; no source-snapshot pass is claimed until it completes.
- Added immutable checkpoint docs/engineering/checkpoints/2026-11-02-mrv-source-snapshot-revalidation.md and session log docs/engineering/session-logs/2026-11-02-cto-mrv-snapshot-revalidation.md; refreshed the latest resume pointer.
- Production Neon remains 0/67 RLS with the elevated rupaykg login. PR #192 remains draft/unmerged and two commits behind main; PR #213 needs rebase/fresh CI. PRs #205/#211/#212 remain closed unmerged as superseded.
- No production DDL/DML, migration, role/grant/RLS change, branch operation, secret, deployment, provider write, worker/scheduler activation or certification. Production HOLD; worker OFF; certification OFF; TRL 9 NOT ESTABLISHED.
