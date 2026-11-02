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
