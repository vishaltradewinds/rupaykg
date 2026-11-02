# RupayKg — latest engineering resume point

Updated: 2026-11-02 18:02 UTC
Canonical repository: vishaltradewinds/rupaykg
Reference UI repository: vishaltradewinds/rupaykg-aistudio
Governing standard: Shakti Standards

## Immediate posture

- Production Neon: READ-ONLY / HOLD.
- Tenant isolation: FAIL/BLOCKED — 0/67 public tables have RLS; 0/67 FORCE RLS.
- Worker/scheduler: OFF.
- Certification: OFF.
- National platform: provisional TRL 3; TRL 9 NOT ESTABLISHED.
- No production DDL/DML, migrations, role/grant/RLS changes, branch operations, deployments, provider writes or certification without independent gates and explicit founder approval.

## Read first

1. Immutable checkpoint: checkpoints/2026-11-02-mrv-source-snapshot-revalidation.md
2. Session log: session-logs/2026-11-02-cto-mrv-snapshot-revalidation.md
3. Previous checkpoint: checkpoints/2026-11-02-mrv-single-path-and-worker-contract.md
4. Previous checkpoint: checkpoints/2026-11-02-auth-mrv-convergence-and-release-gates.md
5. Append-only execution log: EXECUTION_LOG.md
6. P0 bootstrap issue: https://github.com/vishaltradewinds/rupaykg/issues/195
7. P0 tenant-isolation issue: https://github.com/vishaltradewinds/rupaykg/issues/196

## Current integration refs

- GitHub main: a3fecc0abd2c46549a201058d3963afc0e3a73c9.
- PR #192 branch: shakti/auth-bootstrap-application-integration-2026-11-01.
- Latest PR #192 head: 4781bfe03ac68bf61031b9c2e8924dcd498d259e; OPEN / DRAFT / UNMERGED.
- Exact-head CI 41496454924 for head 4781bfe03ac68bf61031b9c2e8924dcd498d259e has passed migration validation, restricted verifier provisioning, disposable migrations, bootstrap privilege teardown, typecheck/build, synthetic two-custodian bootstrap, browser smoke and the full disposable PostgreSQL test suite including snapshot mutation assertions. Production-container build is still running; do not claim the full workflow green until it completes.
- Earlier exact-head CI 41495348937 passed heartbeat/direct-submit code; 41495848722 passed direct-submit gate tests; 41495699292 passed NEEDS_RECONCILIATION claim exclusion; 41495765539 passed worker contract docs.
- Runs 41496015060, 41496118629 and 41496146332 failed at the incomplete source-snapshot fixture assertion; the fixture was corrected in commits 6edc4d and 4781b.
- PR #192 base/merge-base b5e91241d84a6712ff544d3deec1805702f45efd is two commits behind main. Main commit 14b735 added AUTH_DATABASE_URL; a3fecc0 reverted it. PR #192 requires a separate auth runtime pool. Reconcile before merge.
- PR #213 EPR read-only candidate: head 00f50eedee10035cf98adf58c1b642c4eac7d158, prior exact-head CI 41493275165 SUCCESS on an older base. Reconcile onto latest #192 and rerun.
- PRs #205/#211/#212 are CLOSED UNMERGED as superseded; branches preserved.
- PRs #193/#194 BWG remain separate candidates without independent reviews recorded. PR #203 remains UI/UX parity track; accessibility and field usability acceptance remain open.

## MRV and worker

- Worker authorization now re-reads observations, evidence and measurement quantity/unit before provider stages and compares them with the immutable enqueue snapshot.
- Disposable tests cover measurement quantity and evidence content-hash mutation and exact restoration.
- Queries now use deterministic timestamp + row-ID ordering across enqueue, preflight, re-read, worker revalidation and test fixture.
- The first snapshot CI failures were caused by an incomplete test fixture; the fixture now mirrors the API enqueue source rows and quantity/unit. The current exact-head run must pass before accepting this batch.
- Synchronous MRV submit is default-OFF and refuses to run whenever the durable worker is enabled. Its two route-gate tests passed in CI 41495848722.
- NEEDS_RECONCILIATION jobs are not automatically claimable; exact CI 41495699292 passed.
- Worker uses 30-second heartbeat around Guardian, HCS and Mirror Node calls with 120-second lease renewal. It does not cancel in-flight provider calls on lease loss; bounded timeouts/cancellation remain open.
- Worker still uses direct SQL and lacks a narrow system-actor SECURITY DEFINER/RLS contract. The documented role/function design is not implemented. Worker remains OFF.

## Authoritative Neon production

- Project: rupaykg-production-fresh / steep-mud-79906940.
- Primary/default branch: main / br-restless-base-b44cip2h.
- Database: rupaykg.
- 67 public tables; RLS 0; FORCE RLS 0.
- Migration ledger 92 rows; latest 20261021.
- Organizations, identities, roles, memberships and platform access requests: all 0.
- Inspected rupaykg login role: BYPASSRLS, CREATEROLE, CREATEDB and INHERIT.
- Primary branch unprotected; no IP allowlist entries; public connections not blocked.
- Preserve rehearsal/lab branches; no branch operations without approval.

## TRL

- National platform: provisional TRL 3.
- Tested software slices: at most component-level TRL 4.
- MRV/carbon/registry/settlement: component-dependent TRL 3–4.
- IoT/edge and external integrations: TRL 2–3 / NOT VERIFIED.
- No real-site operation, calibrated instrumentation, live Guardian/Hedera/Mirror Node acceptance, statutory portal acceptance, independent field evaluation or disaster-recovery acceptance is established. TRL 9 is NOT ESTABLISHED.

## Next actions

1. Verify exact-head CI 41496454924; inspect the disposable PostgreSQL snapshot assertions and container build.
2. If successful, preserve the exact CI evidence and update issue #195 without implying production bootstrap.
3. Reconcile PR #192 with main's two commits and settle the separate auth-pool runtime contract.
4. Reconcile PR #213 onto latest #192 and rerun exact-head CI plus independent security/DBA review.
5. Implement narrow worker system-actor functions and two-tenant authorization, revocation, lease-loss, retry and reconciliation tests.
6. Complete endpoint → SQL/table → pool/client/transaction → role/function → tenant/geography/bilateral scope mapping.
7. Complete the 67-table RLS and function/trigger/owner/search_path/EXECUTE-grant manifest on disposable production-derived PostgreSQL.
8. Obtain founder approval for two distinct initial authority identities and the out-of-band two-custodian ceremony, then independent security and DBA approval.
9. Continue BWG, stakeholder UI and Jabalpur pilot-demo tracks behind the same Shakti statutory/security gates.
10. Keep production Neon read-only, deployment HOLD, worker OFF and certification OFF.

Render inspection remains blocked pending explicit workspace confirmation. Do not select a workspace autonomously.
