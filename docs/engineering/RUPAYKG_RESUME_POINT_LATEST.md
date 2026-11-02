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

1. Immutable checkpoint: checkpoints/2026-11-02-mrv-snapshot-final-ci-acceptance.md
2. Previous checkpoint: checkpoints/2026-11-02-mrv-snapshot-ci-green.md
2. Previous checkpoint: checkpoints/2026-11-02-mrv-source-snapshot-revalidation.md
2. Session log: session-logs/2026-11-02-cto-mrv-snapshot-revalidation.md
3. Previous checkpoint: checkpoints/2026-11-02-mrv-single-path-and-worker-contract.md
4. Previous checkpoint: checkpoints/2026-11-02-auth-mrv-convergence-and-release-gates.md
5. Append-only execution log: EXECUTION_LOG.md
6. P0 bootstrap issue: https://github.com/vishaltradewinds/rupaykg/issues/195
7. P0 tenant-isolation issue: https://github.com/vishaltradewinds/rupaykg/issues/196

## Current integration refs

- GitHub main: a3fecc0abd2c46549a201058d3963afc0e3a73c9.
- PR #192 branch: shakti/auth-bootstrap-application-integration-2026-11-01.
- Latest PR #192 head: 250395f4914fe74bb4fdbb19e3beff2867fa5aa8; OPEN / DRAFT / UNMERGED.
- Exact-head CI 41496454924 for head 4781bfe03ac68bf61031b9c2e8924dcd498d259e completed SUCCESS, including migration validation, restricted verifier provisioning, disposable migrations, bootstrap privilege teardown, typecheck/build, synthetic two-custodian bootstrap, browser smoke, full disposable PostgreSQL tests with source-snapshot mutation assertions, production-container build and cleanup. A test-only follow-up commit 59c5dc1d0976dbd7b92e2d9194c3d3f07f40e431 aligns the initial worker-ledger fixture with the same complete source snapshot; exact-head CI 41496873635 is running and must complete before accepting the latest head.
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


## Latest live assurance refresh — 2026-11-02 18:30 UTC

The immutable current checkpoint is `checkpoints/2026-11-02-parallel-execution-live-assurance-refresh.md`. It supersedes the older PR/CI snapshots below where they conflict. Current exact-head evidence: PR #192 CI 41498504841 SUCCESS on `51b673d`; PR #213 CI 41499847180 SUCCESS on `cd96ec5`; PR #203 CI 41454665904 SUCCESS on `18b551c`; BWG PR #193 CI 41332732530 SUCCESS and PR #194 CI 41332741365 SUCCESS. PR #213 remains draft and requires target-base metadata reconciliation plus independent security/DBA review.

Fresh read-only production Neon snapshot: 67 public base tables, 0 RLS, 0 FORCE RLS, 70 public non-internal triggers, 92 migration rows/latest `20261021_evidence_artifact_vault.sql`; only app-named `rupaykg` role observed (LOGIN, BYPASSRLS, CREATEDB, CREATEROLE, INHERIT, REPLICATION); no dedicated `rupaykg_app_runtime`. There are 78 `rupaykg`-owned public functions, all PUBLIC EXECUTE, none SECURITY DEFINER; 37 additional PUBLIC-EXECUTE public functions are owned by `cloud_admin` and must be classified separately. Neon public connections remain unblocked, IP allowlist empty, primary branch unprotected. Keep production READ-ONLY/HOLD, worker OFF, certification OFF, TRL 9 NOT ESTABLISHED.

Next: classify 78 app-owned functions; map 70 triggers; complete 67-table and endpoint-to-data tenant matrix; implement worker system-actor RLS contract on disposable PostgreSQL; reconcile PR #192 auth-pool/main ancestry and PR #213 target-base metadata; finish BWG independent review and UI accessibility/localization/field validation.
