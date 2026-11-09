# RupayKg G-002 Production Read-Only Preflight — 2026-11-09 08:26Z

Status: PRE-ACTIVATION / NO PRODUCTION MUTATION

## Authoritative production target

- Repository: `vishaltradewinds/rupaykg`
- Target branch: `main`
- Neon project: `steep-mud-79906940`
- Production branch: `br-restless-base-b44cip2h`
- Database: `rupaykg`

## Read-only production evidence

Observed against the authoritative production branch:

- Current DB role: `rupaykg`
- SUPERUSER: `false`
- BYPASSRLS: `true`
- Migration count: `92`
- Maximum migration: `20261021`
- Protected tables: all 17 present
- Protected-table owners: all 17 currently owned by `rupaykg`
- Protected-table RLS: 0/17 enabled
- FORCE RLS: 0 public tables
- `rupaykg_ddl`: not present
- `rupaykg_app_runtime`: present, NOLOGIN/NOSUPERUSER/NOBYPASSRLS
- `rupaykg_runtime_login`: present, LOGIN/NOSUPERUSER/NOBYPASSRLS

The current production owner account also has elevated role capabilities and is a member of Neon-managed/platform runtime roles. This is additional reason not to use the existing owner account as application runtime.

## Runtime function preflight

The production branch is still on the pre-097 migration state. The inspected `app` functions therefore do not yet constitute the hardened 097/098/099 acceptance contract. In particular, the observed `app.set_request_context(uuid,uuid)` currently has `search_path=public, app` and PUBLIC EXECUTE remains true. This is not accepted as the final production security state.

## Rehearsal evidence

The isolated G-002 rehearsal branch `br-lingering-lake-b4svl185` independently verifies the intended final ownership/runtime model:

- 17/17 protected tables owned by `rupaykg_ddl`
- 17/17 protected tables RLS-enabled
- 0 protected tables owned by runtime login
- `rupaykg_ddl`: NOLOGIN/NOSUPERUSER/NOBYPASSRLS
- `rupaykg_runtime_login`: LOGIN/NOSUPERUSER/NOBYPASSRLS

## Engineering decision

Production remains FAIL-CLOSED and unchanged.

The next production mutation is a controlled change-window operation that must:
1. apply the canonical 097/098/099 security migrations as required by the production activation runbook;
2. perform the hardened 100 ownership separation under DDL authority;
3. verify the exact production runtime login;
4. activate RLS under DDL authority;
5. run production negative tenant-isolation acceptance;
6. cut application runtime over only to the dedicated non-BYPASSRLS runtime credential.

No regulatory certification, field validation, or TRL 9 claim is implied by this technical preflight.

## Safety boundary

This checkpoint records read-only inspection only. No production DDL, RLS activation, credential rotation, application cutover, or destructive database operation was executed.
