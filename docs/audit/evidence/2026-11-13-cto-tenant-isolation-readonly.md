# CTO Tenant Isolation Read-Only Evidence — 2026-11-13

Repository: `vishaltradewinds/rupaykg`
Release-convergence branch: `cto/20261113-holistic-release-convergence`
Production Neon project: `rupaykg-production-fresh`
Production branch: `main` (`br-restless-base-b44cip2h`)
Database: `rupaykg`

## Verified read-only observations

- Current production connection role: `rupaykg`.
- Current production role has `rolbypassrls = true`.
- Production database reports 67 public ordinary tables.
- 17 public ordinary tables currently have RLS enabled.
- Those 17 RLS-enabled tables are owned by `rupaykg_ddl`.
- The remaining 50 public ordinary tables currently report RLS disabled.
- RLS-enabled tables report `relforcerowsecurity = false`.
- `schema_migrations` currently reaches version `20261021`.
- Versions `097`, `098`, `099`, and `100` are present in `schema_migrations`.
- Repository CI run 6808 for the release-convergence commit completed successfully, including migration validation/execution, typecheck, build, browser smoke, disposable PostgreSQL acceptance, and production-container build.

## Interpretation

This is **partial tenant-isolation rollout evidence**, not production tenant-isolation acceptance.

The database has moved materially beyond the earlier zero-RLS baseline, but the runtime connection observed is still BYPASSRLS and only 17/67 public tables are RLS-enabled. Therefore the platform must not claim complete tenant isolation, security-gate closure, or production readiness from this observation.

## Next controlled gate

Before any further production RLS/role mutation:

1. Reconcile repository migration inventory against production `schema_migrations` read-only.
2. Verify the intended non-BYPASSRLS runtime login/role and grants without changing production.
3. Map the remaining tenant-owned tables and indirect ownership paths.
4. Rehearse the complete activation + negative-test sequence on a disposable Neon branch.
5. Capture cross-tenant SELECT/INSERT/UPDATE/DELETE and no-context fail-closed evidence.
6. Only after non-production acceptance and explicit change-window approval consider production activation.

## Safety decision

No production SQL, role, ownership, RLS, credential, or deployment changes were made during this audit.

## Controlled rehearsal evidence discovered

Existing Neon rehearsal branch `rupaykg-tenant-isolation-lab-20261101` was inspected read-only. It reports:

- `rupaykg_app_runtime`: non-superuser, non-BYPASSRLS.
- The rehearsal branch has 22 RLS-enabled public tables.
- Tenant policies on the inspected protected tables target `rupaykg_app_runtime` and use `app.current_organization_id()`.
- The production/default branch remains at 17 RLS-enabled public tables.
- The rehearsal branch's `rupaykg` owner/login remains BYPASSRLS; this does not constitute application-runtime acceptance.
- The rehearsal branch therefore provides useful policy/runtime-role evidence, but not proof that the current production deployment is correctly configured.

## Current blocker sharpened

The missing production gate is now specifically the **runtime deployment credential + complete policy coverage + transactional cross-tenant acceptance**. The runtime role itself exists and is correctly non-BYPASSRLS, but it is currently `NOLOGIN` on production. No credential or role mutation was performed.
