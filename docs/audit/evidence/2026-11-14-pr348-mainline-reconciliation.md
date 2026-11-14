# PR #348 mainline reconciliation evidence

**Date:** 14 November 2026  
**Repository:** `vishaltradewinds/rupaykg`  
**PR:** #348 — `cto/20261112-mrv-provenance-rls`  
**Reconciliation base:** `main` at `e62c67b47fa0f743ac1c53713b07859c115eab4e`  
**Reconciliation merge commit:** `c537796a`  
**Current branch head at evidence capture:** `1e1fbecba0fccf67e6acda9934dfc8d88f55e1e9`

## Scope and conflict handling

The branch was merged with current `main` in a separate local clone/workspace. The merge surfaced nine substantive conflicts:

- `.github/workflows/ci.yml`
- `.github/workflows/tenant-isolation-live-acceptance.yml`
- `apps/package.json`
- `apps/src/runtime-db-preflight.ts`
- `apps/src/tenant-db.ts`
- `apps/src/workspace-routes.ts`
- `ops/tenant-isolation/ACTIVATE_RLS.sql`
- `ops/tenant-isolation/VERIFY_RLS_NEGATIVE_TEST.sql`
- `ops/tenant-isolation/VERIFY_RLS_POLICY_COVERAGE.sql`

The authenticated tenant boundary from `main` was preserved. `withTenantTransaction` requires the opaque context token, switches to `rupaykg_app_runtime` inside the transaction, and calls the three-argument `app.set_request_context(identity, organization, contextToken)` before tenant-scoped queries. The legacy two-argument setter and pre-context membership query were not restored.

## Migration ledger reconciliation

The dependent migration-ledger remediation from PR #368 was integrated into #348 and PR #368 was closed as superseded (not merged). The MRV provenance RLS migration is now version `111_shakti_mrv_provenance_tenant_rls.sql`. The runner rejects duplicate numeric prefixes across the full migration inventory and retains the separate controlled runner boundary for tenant-isolation migrations. The CI rehearsal, runbook, migration allowlist and one-shot workflow reference migration 111. The obsolete migration-101 one-shot workflow was removed.

## Local validation

Executed on the connected Windows workstation in the isolated clone:

- `npm run validate:migrations` — PASS; 104 migrations and 75 schema objects validated.
- `npm run typecheck` — PASS; exit code 0 across workspaces.
- `npm test` — PASS; all workspace test commands exited 0. A Windows-only URL pathname issue in the CORS runtime test was corrected using `fileURLToPath`; the rerun passed. PostgreSQL-service integration cases are not claimed as locally executed.
- `npm run build` — PASS; API and production web bundle built.
- `git diff --check` and conflict-marker scan — PASS.

## Release boundary

The branch was pushed by fast-forward only; no force-push. GitHub reported PR #348 mergeable. Exact-head GitHub Actions status remains a required external gate and must be green before merge. Production Neon remains READ-ONLY / HOLD. Migration 111 has not been applied to production; no production role change, RLS activation, deployment, secret mutation or certification was performed.
