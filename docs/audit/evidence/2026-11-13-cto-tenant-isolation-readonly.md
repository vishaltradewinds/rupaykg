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
