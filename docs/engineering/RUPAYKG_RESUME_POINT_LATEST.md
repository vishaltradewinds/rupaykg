# RupayKg — latest engineering resume point

Updated: 2026-11-02 17:53 UTC
Canonical repository: vishaltradewinds/rupaykg
Reference UI repository: vishaltradewinds/rupaykg-aistudio
Governing standard: Shakti Standards

## Immediate posture

- Production Neon: READ-ONLY / HOLD.
- Production tenant isolation: FAIL/BLOCKED — 0/67 public tables have RLS; 0/67 FORCE RLS.
- Production certification: OFF.
- Worker/scheduler: OFF.
- Platform-wide TRL: provisional TRL 3; TRL 9 NOT ESTABLISHED.
- No production DDL/DML, migration, role/grant/RLS change, branch operation, deployment, provider write or certification is authorized by this checkpoint.

## Read first

1. Immutable checkpoint: checkpoints/2026-11-02-auth-mrv-convergence-and-release-gates.md
2. Session log: session-logs/2026-11-02-cto-auth-mrv-convergence.md
3. Append-only execution log: EXECUTION_LOG.md
4. Route-to-data audit: security/2026-11-02-route-to-data-tenant-authorization-audit-draft.md on PR #192.
5. Worker release gate: security/2026-11-02-mrv-worker-rls-release-gate.md on PR #192.
6. P0 bootstrap issue: https://github.com/vishaltradewinds/rupaykg/issues/195
7. P0 tenant isolation issue: https://github.com/vishaltradewinds/rupaykg/issues/196

## Canonical source and current integration refs

- GitHub main: a3fecc0abd2c46549a201058d3963afc0e3a73c9.
- PR #192 canonical auth/bootstrap integration: head 8f28e4f12136bbb9865b02e2fd2827f4aebf8fe3; OPEN / DRAFT / UNMERGED. Exact-head CI 41495054442 passed through the full test suite and was at production-container build at 17:53 UTC; recheck the final conclusion.
- PR #192 base/merge-base is b5e91241d84a6712ff544d3deec1805702f45efd; main is two commits ahead. Main commit 14b735 added AUTH_DATABASE_URL; a3fecc0 reverted it. The PR branch uses a separate auth runtime pool. Resolve this runtime contract before merge.
- PR #213 EPR read-only candidate: head 00f50eedee10035cf98adf58c1b642c4eac7d158; recorded base ae41ed76ee7f5a64045f526edb1d95acda390945; exact-head CI 41493275165 SUCCESS. It uses withRlsRequestTransaction for permission and EPR reads, is read-only, defaults OFF and includes server-only request-context runtime wiring. Reconcile/rebase against current #192 head and rerun CI.
- PRs #205, #211 and #212 are CLOSED UNMERGED as superseded; branches preserved. Do not reopen or merge their duplicate transaction abstractions.
- PRs #193/#194 BWG remain separate candidate changes with no independent reviews recorded in this inspection.
- PR #203 remains the UI/UX parity track; accessibility and field usability acceptance remain separate gates.
- PR #198 remains a design/audit track; production-wide RLS is not implemented.

## Authoritative Neon production

- Project: rupaykg-production-fresh / steep-mud-79906940.
- Sole primary/default branch: main / br-restless-base-b44cip2h.
- Database: rupaykg.
- 67 public base tables; RLS 0; FORCE RLS 0.
- Migration ledger: 92 rows; latest 20261021.
- Organizations, identities, roles, memberships and platform access requests: all 0.
- Inspected rupaykg login role: BYPASSRLS, CREATEROLE, CREATEDB and INHERIT.
- Project metadata: primary branch unprotected; no IP allowlist entries; public connections not blocked.
- Preserve non-primary rehearsal/lab branches. Do not reset or delete them without approval.

## Worker and MRV

- Current worker code has 30-second lease heartbeats around Guardian, Hedera HCS and Mirror Node calls, renewing a 120-second lease.
- Lease-loss cancellation/race tests and an approved worker system-actor/RLS access contract remain open.
- The worker still performs tenant-related SQL directly and does not use the signed tenant-context boundary.
- Migration 20261109 remains an un-applied engineering proposal with no worker grants/RLS/SECURITY DEFINER functions.
- Worker and durable queue stay OFF.
- The MRV source-snapshot digest fix is in PR #192 commit b0287552; exact-head CI 41494418403 passed the full workflow.

## Evidence-based TRL

- National platform: provisional TRL 3.
- Tested software slices: at most component-level TRL 4.
- MRV/carbon/registry/settlement: component-dependent TRL 3–4; live provider and external registry acceptance not evidenced.
- IoT/edge and external integrations: TRL 2–3 / NOT VERIFIED.
- No representative field operation, calibrated instruments, Jabalpur SITE-JBP-01 acceptance, live Guardian/Hedera/Mirror Node proof, statutory portal acceptance, independent operational evaluation or disaster-recovery acceptance is established. TRL 9 is NOT ESTABLISHED.

## Next execution order

1. Recheck CI 41495054442 final result for current PR #192 head.
2. Reconcile PR #192 with main's two commits and settle the separate auth-pool/runtime environment contract.
3. Reconcile PR #213 onto the latest #192 head, rerun exact-head CI and obtain independent security/DBA review.
4. Complete endpoint → SQL/table → pool/client/transaction → role/function → tenant/geography/bilateral scope mapping across all API, worker, webhook and background paths.
5. Complete the 67-table policy/ownership classification and function/trigger/owner/search_path/EXECUTE-grant manifest on disposable production-derived PostgreSQL.
6. Obtain founder approval for two distinct initial authority identities and the out-of-band two-custodian ceremony, then independent security review and DBA-approved production role/secret provisioning.
7. Complete worker system-actor SECURITY DEFINER functions, two-tenant tests, lease-loss/retry/reconciliation tests and independent review.
8. Continue BWG, stakeholder UI and Jabalpur pilot-demo work behind the same Shakti statutory/security gates.
9. Keep production Neon read-only, deployment HOLD, worker OFF and certification OFF.

Render inspection remains blocked pending explicit workspace confirmation. Do not select a workspace autonomously.
