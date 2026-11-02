# RupayKg — latest engineering resume point

Updated: 2026-11-02 17:23 UTC
Canonical repo: `vishaltradewinds/rupaykg`
Reference UI repo: `vishaltradewinds/rupaykg-aistudio`
Governing standard: Shakti Standards

## Immediate posture

- Production: HOLD.
- Certification: OFF.
- Worker/scheduler: OFF.
- Platform-wide TRL: NOT ASSESSED; TRL 9 NOT ESTABLISHED.
- Neon production is the sole authoritative live database. No production mutations are authorized by this checkpoint.

## Resume from this exact state

1. Read [the latest immutable checkpoint](checkpoints/2026-11-02-cto-run-02-epr-readonly-tenant-rls.md) and [the append-only execution log](EXECUTION_LOG.md).
2. Canonical GitHub main: `a3fecc0abd2c46549a201058d3963afc0e3a73c9`.
3. Authoritative Neon: project `rupaykg-production-fresh` / `steep-mud-79906940`, branch `main` / `br-restless-base-b44cip2h`, database `rupaykg`.
4. Production snapshot: 67 public tables, 0 RLS, 0 FORCE RLS, 92 migration rows/latest `20261021`; only inspected `rupaykg` role is elevated (BYPASSRLS, CREATEROLE, CREATEDB).
5. Current integration stack:
   - PR #192 bootstrap/auth candidate, head `cd6de7c1de0de625ff1181265891c3320f07ceee`, CI [41484881042 PASS](https://github.com/vishaltradewinds/rupaykg/actions/runs/41484881042).
   - PR #205 signed tenant-context bridge, head `2bdcc6f02e730d0a81f2fd69a4db348609ff1663`, CI [41485584069 PASS](https://github.com/vishaltradewinds/rupaykg/actions/runs/41485584069).
   - PR #211 EPR read-only RLS slice, head `0d4ea374d13cec45b7cb4855fce1e4725225fd40`, CI [41490199189 PASS](https://github.com/vishaltradewinds/rupaykg/actions/runs/41490199189). Still DRAFT/unmerged.
6. PR #207 was closed unmerged as superseded by #211. PR #195 P0 remains open; founder-authorized bootstrap and independent DBA/security approvals remain outstanding.
7. Render inspection is blocked until the user explicitly confirms the workspace. Do not select a workspace autonomously.

## Highest-priority next work

- Reconcile current base/head refs across #192 → #205 → #211; do not blind merge.
- Complete machine-readable route → SQL/table → client/transaction → organization/geography/bilateral scope matrix for HTTP, worker, webhook and background paths.
- Complete founder-authorized first-platform-authority bootstrap design approval, independent review, and DBA-approved production role/secret provisioning.
- Rehearse migration sequence and rollback on disposable production-derived PostgreSQL; verify migration-ledger parity.
- Expand RLS only one table/workflow at a time after exact least-privilege runtime acceptance and two-tenant negative tests.
- Resume BWG and stakeholder modules only after their authorization/transaction contracts are clear.
- Keep EPR write routes, production RLS, deployments, worker/scheduler activation and certification disabled until approved.

## Safety invariant

Neon production is read-only for this engineering workflow. Never perform production DDL/DML, migrations, role/grant/RLS changes, branch operations, deployments, worker/scheduler activation or certification without the required independent gates and explicit user approval.
