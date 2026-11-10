# RupayKg Live Shakti Reconciliation Evidence — 2026-11-10

## Authoritative target

Neon project: `rupaykg-production-fresh`  
Primary branch: `main`

This evidence is based on a read-only inspection of the authoritative production branch.

## Verified live effects

- Protected tenant tables: 17/17 present.
- RLS enabled: 17/17.
- RLS forced: 0/17.
- Protected table owner: 17/17 `rupaykg_ddl`.
- `rupaykg_app_runtime`: NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOINHERIT.
- `rupaykg_ddl`: NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOINHERIT.
- `rupaykg_runtime_login`: LOGIN, NOSUPERUSER, NOBYPASSRLS, INHERIT.
- `app.set_request_context`: SECURITY DEFINER; public EXECUTE revoked; runtime EXECUTE granted.
- `app.authenticate_bearer_session`: SECURITY DEFINER; public EXECUTE revoked; runtime EXECUTE granted.
- `app.is_verified_org_member`: SECURITY DEFINER; public EXECUTE revoked; runtime EXECUTE granted.
- Expected protected policy set: 31 policies present.

## Unresolved authority drift

The production `schema_migrations` ledger does not contain versions 097, 098, 099, or 100.

The live database therefore contains the effective Shakti 097-100 state without an authoritative migration-ledger record of those changes.

This is a **ledger reconciliation gate**, not evidence that the original migrations executed at the current time.

## Controlled reconciliation

`ops/tenant-isolation/RECONCILE_LIVE_SHAKTI_LEDGER.sql` provides a guarded reconciliation operation.

Safety properties:

1. Refuses runtime roles.
2. Verifies the 17 protected tables, RLS state, and ownership before mutation.
3. Verifies the three governed SECURITY DEFINER boundaries.
4. Verifies the expected 31 protected policies.
5. Refuses conflicting migration-ledger entries.
6. Mutates only `schema_migrations`.
7. Records the current reconciliation time, explicitly not a historical execution time.

It has **not** been executed against production.

## Shakti decision

**LIVE EFFECTS:** PASS  
**MIGRATION LEDGER AUTHORITY:** BLOCKED pending controlled reconciliation  
**PRODUCTION CERTIFICATION:** OFF  
**TRL 9:** NOT CLAIMED
