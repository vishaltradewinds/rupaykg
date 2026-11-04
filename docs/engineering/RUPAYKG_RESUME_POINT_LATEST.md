# RupayKg Engineering Resume Point — 4 November 2026

## Authoritative baseline
- Repository: `vishaltradewinds/rupaykg`
- Baseline main commit: `934062ef8af2ca47bbcbf5e37c12de12a4f9f743`
- Sole authoritative live database: Neon project `steep-mud-79906940`, branch `br-restless-base-b44cip2h` (`main`), database `rupaykg`.
- Production remains READ-ONLY / HOLD. No production DDL/DML, migrations, grants, roles, RLS changes, Neon branch operations, deployments, worker activation or certification are authorized by this checkpoint.
- SITE-JBP-01 Kathonda remains PRE-VALIDATION. TRL 9 is NOT ACHIEVED.

## Latest verified production posture
- Neon main: 67 public tables; 0 RLS; 0 FORCE RLS; 0 public policies; 92 migration-ledger rows; 70 enabled non-internal public triggers.
- Customer role `rupaykg` owns the 67 tables and has BYPASSRLS and elevated role/database capabilities. Actual Render runtime database identity is not proven.
- Neon main reports `protected=false`.
- Render service `rupaykg` (`srv-daki4d7qj5pc73b8qksg`) is live on commit `934062ef8af2ca47bbcbf5e37c12de12a4f9f743`; service configuration reports auto-deploy on every commit to `main`.
- Deployed Dockerfile runs `migrate.js` and `acceptance-seed.js` before API startup. P0 defect tracked in #267.

## Controlling issues
- #196 — tenant isolation: RLS disabled and runtime BYPASSRLS risk.
- #214 — migration source/ledger drift, including production-applied 096 with source removed and staging-only 20261022–20261025 migrations.
- #215 — verification authorization and legacy trigger convergence.
- #267 — migration runner executes at web-service startup with DATABASE_URL.
- #266 — prove deployed runtime database identity safely.
- #285 — synchronized execution register and combined verification/security rehearsal.

## Candidate security work (do not merge independently)
- #272 canonical verification-trigger baseline.
- #250/#251 must be validated together for fail-closed geography and fixture correctness.
- #252 depends on #247; preserve ancestry and test the combined stack.
- #284 integrates signed verification context into write paths but introduces a separate auth-context owner; reconcile with #272's guard owner.
- #268 separates migrator/API startup but requires a safe distinct migrator identity and TLS/CA contract.
- #247 remains historical parallel evidence; do not apply its competing trigger migration alongside #272.
- No security candidate is production-authorized.

## Run 30 engineering candidate
- Draft PR: https://github.com/vishaltradewinds/rupaykg/pull/289
- Branch: `shakti/2026-11-04-disable-implicit-production-migrations`
- PR head at opening: `2ea7123392ceb5f65bdd977928853b919135da58`
- Change: Docker web-service command starts only `node apps/dist/src/production-server.js`; migrations and acceptance seeding are no longer invoked during web-service startup.
- Added this canonical resume point, an immutable checkpoint and session log.
- Exact-head CI status at checkpoint: no workflow run/status returned yet. The workflow is configured for pull requests to main; recheck before claiming validation.
- No merge, Render change, deployment or production database write occurred.
- This change is NOT deployable until a separately invoked, protected migrator workflow, distinct least-privilege migrator credential, migration inventory/checksum/lineage gates, backup/rollback and independent DBA/security review are complete.

## Immediate next actions
1. Recheck PR #289 exact-head CI and inspect all jobs; fix failures only on this branch.
2. Build a controlled, manually invoked migration workflow with distinct least-privilege identity; never auto-run at web startup or use the API runtime credential.
3. Reconcile migration 096 by exact historical SQL/hash and preserve the production ledger; recover staging-only migrations separately.
4. Complete combined #252 + #272 + #250/#251 + #284 rehearsal with #268's migration boundary. One canonical guard owner and one trigger only.
5. Complete 67-table tenant classification and RLS policy matrix; rehearse only on an already-authorized disposable environment.
6. Obtain safe, redacted runtime identity proof from Render. Log access remains blocked pending user confirmation of workspace selection.
7. Keep production read-only and release HOLD until independent gates and explicit approval are satisfied.

## Evidence discipline
CI success is engineering evidence only. It does not establish production deployment safety, statutory acceptance, live MRV operation, field commissioning, Guardian/Hedera consensus, independent review or TRL 9.


## Render runtime identity audit — 4 November 2026 (workspace confirmed)
- User explicitly confirmed the Render workspace; logs were read from service `srv-daki4d7qj5pc73b8qksg` in workspace `tea-dakh7k142hec73aj2kr0`.
- Live deploy remains `dep-dblekp0473hc73b3qsag`, commit `934062ef8af2ca47bbcbf5e37c12de12a4f9f743`; service auto-deploy remains enabled on commits to `main`.
- Render app log at `2026-11-04T08:19:23.898Z` states: `Database migrations are current (91 files).` This is direct evidence the live web-service boot executed the migration runner. The same startup window contains no matching `Applied` migration log entries and no matching acceptance-seed log entries; absence of those log entries does not prove no seed code ran.
- Health-check requests returned HTTP 200. The current `/health` implementation runs `select 1` through the configured application pool, so this indicates database reachability but does not identify which Neon branch/database or database role the app used.
- Read-only inspection of the confirmed authoritative Neon main branch `br-restless-base-b44cip2h` shows 67 public tables, 0 RLS, 0 FORCE RLS, 92 migration ledger rows, latest version `20261021`. A read-only `pg_stat_activity` snapshot showed no non-audit customer application client connection at that instant; only provider/admin/background connections were visible.
- The Neon query's `current_user/session_user = rupaykg` describes the audit connector session, not the Render application. Therefore the actual Render runtime database identity and target branch remain UNPROVEN. Do not infer them from service health, audit connector identity, table ownership or secret names.
- No Render settings/secrets, deployments, Neon production data, roles, grants, migrations or RLS were changed.
- Next proof: implement a minimal authenticated/operationally gated diagnostic on a non-production candidate that logs only `current_database()`, `current_user`, `session_user`, server/branch identity and deployed commit; no connection strings or secret values. Validate it on a disposable environment and deploy only after explicit release approval.
