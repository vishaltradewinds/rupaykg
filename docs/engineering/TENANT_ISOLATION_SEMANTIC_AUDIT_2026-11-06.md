# Tenant Isolation Semantic Audit & Disposable RLS Acceptance Gate — 2026-11-06

## Scope

This gate follows the cumulative tenant-context migration through PR #315. It is intentionally separate from the regex/static migration gate.

## Findings

### 1. Request-path direct pool access

The statutory route migration removed direct request-path `pool.query`, `pool.connect`, and pool-based organization-permission calls from `apps/src/statutory-routes.ts`.

Repository-wide static checks already performed for the protected patterns returned no matches in `apps/src`.

### 2. Semantic bypass risk

`apps/src/server.ts` still exposes generic helpers:

- `query(...)` -> `pool.query(...)`
- `withClient(...)` -> `pool.connect()`
- `canWriteActivity(client: Pool | PoolClient, ...)`
- `canWriteGeography(client: Pool | PoolClient, ...)`

The health probe intentionally uses the shared pool. The regulatory source catalog is also intentionally global. However, accepting `Pool | PoolClient` for tenant authorization helpers is a semantic risk because a future caller could bypass the transaction-scoped tenant context while still satisfying TypeScript.

**Release decision:** do not treat static zero-match results as proof of tenant isolation.

### 3. Tenant context primitive

`withDatabaseTenantContext()` uses an explicit transaction and PostgreSQL transaction-local `set_config(..., true)`. It sets identity, organization, bilateral scope and service mode before invoking application work and releases the client after commit/rollback.

This is the correct primitive for pooled-connection context isolation, but it does not itself enable RLS and does not prove that every tenant-scoped route uses it.

### 4. Production RLS

Production RLS remains unverified/not enabled. No production mutation is authorized by this gate.

## Required acceptance evidence

The disposable acceptance harness must prove all of the following against a disposable PostgreSQL database:

1. organization A can read its own row;
2. organization A cannot read organization B's row;
3. organization A cannot insert a row claiming organization B;
4. organization A cannot update its row into organization B;
5. organization A cannot delete organization B's row;
6. the same pooled connection cannot retain A's transaction-local organization context after transaction completion;
7. a second transaction starts without the previous transaction's organization setting;
8. a non-BYPASSRLS runtime role is used for RLS assertions;
9. the table owner/migrator role is not used as the application runtime role;
10. service mode is explicit and is not inferred from an API-supplied organization header.

## Current release state

- Engineering CI on PR #315: PASS.
- Tenant-context migration: substantially implemented through the current protected route batch.
- Static direct request-path pool access audit: PASS for the searched protected patterns.
- Semantic audit: OPEN until all `Pool | PoolClient` authorization helper call sites are proven safe.
- Disposable RLS acceptance: REQUIRED.
- Production RLS: NOT ENABLED.
- Migration 096 lineage: UNRESOLVED.
- Production deployment: HOLD.
- Regulatory/field acceptance: NOT COMPLETE.
- TRL 9: NOT CERTIFIED.

## No-go rule

Passing this disposable harness does not authorize production RLS. Production promotion still requires migration-lineage reconciliation, policy-matrix review, runtime least-privilege evidence, independent security/DBA release approval, field/operational acceptance and explicit release authorization.

## 2026-11-06 runtime helper closure

A follow-up semantic scan of the PR #318 code head found four remaining helper signatures accepting `Pool | PoolClient`:

- `apps/src/evidence-vault-routes.ts` — `activityContext`
- `apps/src/onboarding-hierarchy-routes.ts` — `hasAuthority`, `eligible`
- `apps/src/statutory-routes.ts` — `evidenceBindingValid`
- `apps/src/value-routes.ts` — `activityAccess`, `assertActivityGeographyScope`, `hasValuePermission`, `evidenceIsVerified`

These helpers were narrowed to `PoolClient` on the same runtime-hardening branch. Their observed call sites already execute through tenant-context transactions, so the change removes a type-level escape hatch without changing the intended request-path transaction model.

A branch-head static scan now finds no remaining `Pool | PoolClient` helper signatures in the inspected API route set and no request-path `pool.query`, `pool.connect`, or pool-based organization-permission bypass in the protected patterns.

This is still a code-level semantic gate. It does not establish production RLS, production least-privilege roles, migration-096 reconciliation, or TRL 9.
