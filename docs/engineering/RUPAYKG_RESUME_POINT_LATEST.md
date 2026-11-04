# RupayKg Engineering Resume Point — 4 November 2026

## Authoritative baseline
- Repository: `vishaltradewinds/rupaykg`
- Baseline main commit: `934062ef8af2ca47bbcbf5e37c12de12a4f9f743`
- Sole authoritative live database: Neon project `steep-mud-79906940`, branch `br-restless-base-b44cip2h` (`main`), database `rupaykg`.
- Production remains READ-ONLY / HOLD. No production DDL/DML, migrations, grants, roles, RLS changes, Neon branch operations, deployments, worker activation or certification are authorized by this engineering checkpoint.
- SITE-JBP-01 Kathonda remains PRE-VALIDATION. TRL 9 is NOT ACHIEVED.

## Latest verified production posture
- Neon main: 67 public tables; 0 RLS; 0 FORCE RLS; 0 public policies; 92 migration-ledger rows; 70 enabled non-internal public triggers.
- The customer role `rupaykg` owns the 67 tables and has BYPASSRLS and elevated role/database capabilities. Actual Render runtime database identity is not proven.
- Neon main reports `protected=false`.
- Render service `rupaykg` (`srv-daki4d7qj5pc73b8qksg`) is live on commit `934062ef8af2ca47bbcbf5e37c12de12a4f9f743`; service configuration reports auto-deploy on every commit to `main`.
- The deployed Dockerfile starts by executing `migrate.js` and `acceptance-seed.js` before the API. This is a P0 release-governance defect tracked in issue #267.

## Controlling issues
- #196 — tenant isolation: RLS disabled and runtime BYPASSRLS risk.
- #214 — migration source/ledger drift, including production-applied 096 with source removed and staging-only 20261022–20261025 migrations.
- #215 — verification authorization and legacy trigger convergence.
- #267 — migration runner executes at web-service startup with DATABASE_URL.
- #266 — prove deployed runtime database identity safely.
- #285 — synchronized execution register and combined verification/security rehearsal.

## Candidate security work (do not merge independently)
- #272 is the canonical verification-trigger baseline.
- #250/#251 must be validated together for fail-closed geography and fixture correctness.
- #252 depends on #247; preserve ancestry and test the combined stack.
- #284 integrates signed verification context into write paths but currently introduces a separate auth-context owner; reconcile with #272's guard owner.
- #268 separates migrator/API startup but requires a safe distinct migrator identity and TLS/CA contract.
- #247 remains historical parallel evidence; do not apply its competing trigger migration alongside #272.
- No draft candidate is production-authorized.

## Work preserved in this branch
- Branch: `shakti/2026-11-04-disable-implicit-production-migrations`
- Change: production web container starts only the API process; it no longer invokes migrations or acceptance seeding during web-service startup.
- This is a draft engineering candidate only. No Render deployment occurred.
- Manual migration execution is not yet implemented as a protected, separately authorized release workflow. Do not deploy this change until the migrator job/identity, migration inventory/checksum gates, backup/rollback, and independent DBA/security review are complete.

## Immediate next actions
1. Validate this Docker startup separation with exact-head CI and inspect the resulting test/build evidence.
2. Build a controlled, manually invoked migration workflow using a distinct least-privilege migrator identity; it must not auto-run on web startup or use the API runtime credential.
3. Reconcile migration 096 by exact historical SQL/hash and preserve the production ledger; recover staging-only migrations separately.
4. Complete the combined #252 + #272 + #250/#251 + #284 rehearsal with #268's migration boundary. One canonical guard owner and one trigger only.
5. Complete the 67-table tenant classification and RLS policy matrix; rehearse only on an already-authorized disposable environment.
6. Obtain a safe, redacted runtime identity proof from the actual Render service. Workspace selection is pending user confirmation for log access.
7. Keep production read-only and release HOLD until all independent gates and explicit approval are satisfied.

## Evidence discipline
CI success is engineering evidence only. It does not establish production deployment safety, statutory acceptance, live MRV operation, field commissioning, Guardian/Hedera consensus, independent review or TRL 9.
