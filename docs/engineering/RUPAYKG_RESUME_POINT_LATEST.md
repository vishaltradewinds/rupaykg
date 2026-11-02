# RupayKg — latest engineering resume point

Updated: 2026-11-02 17:56 UTC
Canonical repository: vishaltradewinds/rupaykg
Reference UI repository: vishaltradewinds/rupaykg-aistudio
Governing standard: Shakti Standards

## Immediate posture

- Production Neon: READ-ONLY / HOLD.
- Production tenant isolation: FAIL/BLOCKED — 0/67 public tables have RLS; 0/67 FORCE RLS.
- Worker/scheduler: OFF.
- Production certification: OFF.
- Platform-wide TRL: provisional TRL 3; TRL 9 NOT ESTABLISHED.
- No production DDL/DML, migration, role/grant/RLS change, branch operation, deployment, provider write or certification is authorized by this checkpoint.

## Read first

1. Immutable checkpoint: checkpoints/2026-11-02-mrv-single-path-and-worker-contract.md
2. Session log: session-logs/2026-11-02-cto-mrv-single-path.md
3. Previous immutable checkpoint: checkpoints/2026-11-02-auth-mrv-convergence-and-release-gates.md
4. Append-only execution log: EXECUTION_LOG.md
5. P0 bootstrap issue: https://github.com/vishaltradewinds/rupaykg/issues/195
6. P0 tenant isolation issue: https://github.com/vishaltradewinds/rupaykg/issues/196

## Current GitHub state

- Main: a3fecc0abd2c46549a201058d3963afc0e3a73c9.
- Canonical PR #192 branch: shakti/auth-bootstrap-application-integration-2026-11-01.
- Latest PR #192 head: ffab45c64c301f6e38d9678972071546c323d54e; OPEN / DRAFT / UNMERGED.
- New exact-head CI for ffab45c is not yet visible. Do not claim the direct-submit route tests pass until CI completes.
- Earlier exact-head CI 41495348937 passed on head 461aa5367eed48bfb02524bbf7ca9ea4e56878db, including the heartbeat and direct-submit gate code, full tests and container build.
- Run 41495699292 for the NEEDS_RECONCILIATION claim-exclusion test was in progress at browser smoke.
- Run 41495765539 for the worker contract documentation was in progress at build.
- PR #192 base/merge-base b5e91241d84a6712ff544d3deec1805702f45efd is two commits behind current main. Main commit 14b735 added AUTH_DATABASE_URL; a3fecc0 reverted it. PR #192 requires a separate auth runtime pool. Reconcile this contract before merge.
- PR #213 EPR read-only candidate: head 00f50eedee10035cf98adf58c1b642c4eac7d158, exact-head CI 41493275165 SUCCESS on older base. Reconcile onto latest #192 and rerun.
- PRs #205, #211 and #212 are CLOSED UNMERGED as superseded; branches preserved.
- PRs #193/#194 BWG remain separate candidates without independent reviews recorded. PR #203 remains the UI/UX parity track; accessibility and field usability acceptance remain open.

## MRV worker and execution path

- Synchronous MRV submit now defaults OFF and refuses to run when the durable worker is enabled.
- New route tests in apps/src/mrv-routes.test.ts prove default-off and mutual exclusion before authentication/database access; exact-head CI pending.
- Worker uses a 30-second heartbeat around Guardian, HCS and Mirror Node calls, renewing a 120-second lease. If lease renewal fails, the result is not persisted under the lost lease.
- The heartbeat does not cancel an already-running provider request; bounded provider timeouts and adapter-level cancellation remain open.
- A PostgreSQL regression now asserts NEEDS_RECONCILIATION jobs are not automatically claimed.
- The worker still performs direct SQL and lacks a narrow system-actor SECURITY DEFINER/RLS contract. Migration 20261109 remains an un-applied proposal without worker grants/policies/functions. Worker remains OFF.
- Worker contract specification is in docs/security/2026-11-02-mrv-worker-rls-release-gate.md on PR #192; specification is not implementation.

## Authoritative Neon production

- Project: rupaykg-production-fresh / steep-mud-79906940.
- Primary/default branch: main / br-restless-base-b44cip2h.
- Database: rupaykg.
- 67 public tables; RLS 0; FORCE RLS 0.
- Migration ledger 92 rows; latest 20261021.
- Organizations, identities, roles, memberships and platform access requests: all 0.
- Inspected rupaykg login role: BYPASSRLS, CREATEROLE, CREATEDB and INHERIT.
- Primary branch unprotected; no IP allowlist entries; public connections not blocked.
- Preserve non-primary rehearsal/lab branches; no branch operations without approval.

## Evidence-based TRL

- National platform: provisional TRL 3.
- Tested software components: at most component-level TRL 4.
- MRV/carbon/registry/settlement: component-dependent TRL 3–4.
- IoT/edge and external integrations: TRL 2–3 / NOT VERIFIED.
- No real-site operation, calibrated instrumentation, live Guardian/Hedera/Mirror Node acceptance, statutory portal acceptance, independent field evaluation or disaster-recovery acceptance is established. TRL 9 is NOT ESTABLISHED.

## Next execution order

1. Verify exact-head CI for ffab45c and runs 41495699292 / 41495765539.
2. Reconcile PR #192 with main's two commits and settle the auth-pool runtime contract.
3. Reconcile PR #213 onto latest #192 and rerun exact-head CI plus independent security/DBA review.
4. Implement narrow worker system-actor functions and two-tenant authorization, lease-loss, revocation, retry and reconciliation tests.
5. Complete endpoint → SQL/table → pool/client/transaction → role/function → tenant/geography/bilateral scope mapping.
6. Complete the 67-table RLS and function/trigger/owner/search_path/EXECUTE-grant manifest on disposable production-derived PostgreSQL.
7. Obtain founder approval for two distinct initial authority identities and the out-of-band two-custodian ceremony, then independent security and DBA approval.
8. Continue BWG, stakeholder UI and Jabalpur pilot-demo tracks behind the same Shakti statutory/security gates.
9. Keep production Neon read-only, deployment HOLD, worker OFF and certification OFF.

Render inspection remains blocked pending explicit workspace confirmation. Do not select a workspace autonomously.
