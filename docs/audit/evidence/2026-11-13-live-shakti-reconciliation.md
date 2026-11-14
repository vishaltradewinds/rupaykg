# Live Shakti production reconciliation — 2026-11-13

## Target and method

Read-only inspection of the authoritative Neon production target:

- Project: `rupaykg-production-fresh` (`steep-mud-79906940`)
- Primary branch: `main` (`br-restless-base-b44cip2h`)
- Database: `rupaykg`
- Session identity observed: `rupaykg`
- PostgreSQL: 18

No production data, schema, roles, grants, memberships, policies, or migration ledger entries were changed.

The reusable audit query is `ops/tenant-isolation/VERIFY_LIVE_SHAKTI_STATE.sql`. It runs inside a read-only transaction and contains SELECT statements only.

## Verified state

- 18/18 protected tables are present.
- 17/18 have RLS enabled.
- 0/18 have FORCE RLS enabled.
- 17/18 are owned by `rupaykg_ddl`.
- The sole exception is `public.mrv_provenance_events`: RLS disabled, owner `rupaykg`.
- 31 public policies are present.
- Migration ledger versions 097, 098, 099 and 100 are present (recorded 2026-11-10 17:10:12.112 UTC).
- Migration 101 is absent.
- `rupaykg` is LOGIN, non-superuser, BYPASSRLS=true, CREATEROLE=true.
- `rupaykg_ddl` is NOLOGIN, non-superuser, NOBYPASSRLS, NOINHERIT.
- `rupaykg_runtime_login` is LOGIN, non-superuser, NOBYPASSRLS.
- `rupaykg` owns `schema_migrations` and has SELECT/INSERT/UPDATE there.
- `pg_has_role('rupaykg','rupaykg_ddl','SET')` is false. Its direct DDL membership is SET=false, INHERIT=false, ADMIN=true.

## Interpretation

The 097–100 migration-ledger gap asserted by the older 2026-11-10 PR evidence is no longer present. The live ledger now records all four versions. Do not run the old `RECONCILE_LIVE_SHAKTI_LEDGER.sql`; it would attempt to insert duplicate ledger records.

Migration 101's production precondition remains unmet. The migration executor cannot currently SET ROLE to `rupaykg_ddl`. The PR #348 migration fails closed and its runbook documents a separately authorized temporary SET-only membership, migration execution, ledger/owner verification, and membership revocation. This audit does not authorize that privileged change.

## Decision

- **Historical 097–100 ledger reconciliation:** no longer required; verified present.
- **Migration 101 code path:** disposable restricted-login CI rehearsal passed.
- **Production migration 101:** BLOCKED pending explicit DBA authorization and a controlled change window.
- **RLS activation:** NOT AUTHORIZED; separate gate after migration and full acceptance.
- **Production release / TRL 9:** not certified by this audit.
