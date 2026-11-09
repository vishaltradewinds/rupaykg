# RupayKg — G-002 Live Preflight Checkpoint — 2026-11-09

## Canonical engineering target
- Repository: vishaltradewinds/rupaykg
- Canonical baseline: main
- Baseline commit: e8a230bbefad078fd11cebf543efe6a258d88559
- Working branch: cto/20261109-g002-live-preflight
- Do not use vishaltradewinds/rupaykg-aistudio as the primary repository.

## Live production reconciliation
Neon project: steep-mud-79906940
Production branch: br-restless-base-b44cip2h (Neon branch name: main)
Database: rupaykg

Read-only inspection on 2026-11-09 established:
- schema_migrations max version is 20261021 with 92 migration rows.
- rupaykg is non-SUPERUSER but BYPASSRLS=true.
- rupaykg_app_runtime is non-SUPERUSER and non-BYPASSRLS.
- rupaykg_runtime_login is non-SUPERUSER and non-BYPASSRLS.
- all inspected public application tables are owned by rupaykg.
- inspected public application tables have RLS disabled.
- no public RLS policies were present for the protected tenant table set.
- app.set_request_context exists as SECURITY DEFINER, but its live search_path is currently 'public, app' rather than the required hardened 'pg_catalog, public, app'.
- app.is_verified_org_member and app.authenticate_bearer_session are not yet present in the live production app schema.

## Engineering interpretation
Production is not acceptance-ready for tenant-isolation activation. Repository migrations 097/098/099 are present on canonical main and are designed to establish the missing runtime/authentication/RLS foundation. Production must not be changed until controlled rehearsal, DDL/runtime role separation, policy validation, cross-tenant negative acceptance, and rollback evidence are complete.

## New controlled preflight gate
Added ops/tenant-isolation/VERIFY_MIGRATION_SCHEMA_COMPATIBILITY.sql. It is read-only and checks required tables, required columns, the hardened SECURITY DEFINER boundary, and absence of the protected tenant policy set before foundation activation.

## Next execution gate
1. Run compatibility preflight on controlled rehearsal.
2. Validate 097/098/099 execution in rehearsal.
3. Run VERIFY_SECURITY_DEFINER_BOUNDARIES.sql as the exact runtime role.
4. Prove controlled DDL/owner role separation.
5. Run VERIFY_PRE_RLS.sql.
6. Run cross-tenant negative acceptance on rehearsal.
7. Prepare rollback evidence.
8. Only after all gates pass, request/perform controlled production migration and RLS activation.

## TRL
No TRL uplift is claimed. RupayKg remains below TRL 9 until engineering, operational, field, regulatory and production evidence support the claim.
