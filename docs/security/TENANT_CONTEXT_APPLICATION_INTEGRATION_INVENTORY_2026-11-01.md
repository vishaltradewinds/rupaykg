# Tenant-context integration inventory — 2026-11-01

**Baseline:** `main` at `b5e91241d84a6712ff544d3deec1805702f45efd`
**Inspection:** static source review of the API's shared PostgreSQL pool and route modules. No code or runtime changes.

## Verified architecture

- `apps/src/server.ts` creates one shared `pg.Pool` (max 10), defines a direct `query()` helper, and defines `withClient()`.
- The same pool is passed into route registration modules.
- `apps/src/auth.ts` performs authentication by querying `identity_sessions`, `identities`, and `organization_memberships` directly through the pool.
- `AuthContext` contains identity ID, VERIFIED memberships, active organization selected from the `x-rupaykg-organization-id` header, and a bilateral-settlement scope flag.
- Workspace routes reduce organization scope to the active organization when selected; settlement routes have an explicit bilateral-scope exception.
- Route modules use both direct `pool.query()` and direct `pool.connect()` calls. Several of the `connect()` paths explicitly issue `BEGIN`, `COMMIT`, and `ROLLBACK` themselves (notably onboarding, registry, field sync, evidence verification, and MRV flows). They are not currently wrapped in one request-scoped transaction/context abstraction.

## Direct pool access inventory

A source scan of the following 13 API modules found approximately 318 `.query()` call sites and 15 `.connect()` call sites. This is a source inventory, not a count of executed SQL statements; some generic or multiline calls may not be captured by the simple pattern.

| File | Query call sites | Connect call sites |
|---|---:|---:|
| `server.ts` | 8 | 1 |
| `auth.ts` | 4 | 0 |
| `onboarding-hierarchy-routes.ts` | 33 | 2 |
| `value-routes.ts` | 36 | 0 |
| `registry-routes.ts` | 39 | 1 |
| `sync-routes.ts` | 62 | 4 |
| `workspace-routes.ts` | 23 | 1 |
| `bwg-routes.ts` | 1 | 0 |
| `cpcb-swm-routes.ts` | 17 | 2 |
| `intelligence-routes.ts` | 2 | 0 |
| `mrv-routes.ts` | 16 | 1 |
| `evidence-vault-routes.ts` | 28 | 2 |
| `platform-admin-routes.ts` | 49 | 1 |
| **Total** | **318** | **15** |

## Consequence for RLS

Enabling RLS before the application integration is complete would break legitimate API paths or leave policy bypasses. The application currently authenticates before each route's SQL, but most SQL uses a shared pool without an explicit identity/organization transaction context.

Required integration design:
1. Resolve a session using a narrow database authentication function or another reviewed bootstrap path that remains safe once identity/session tables are protected.
2. Derive identity and active organization only from the validated session and currently VERIFIED membership. Never trust a client-supplied organization header without membership validation.
3. Open one transaction per authenticated request and set transaction-local context on that exact client.
4. Route all request SQL through the same client, including existing direct `pool.query()` calls and `pool.connect()` helpers. Existing route-level transactions must either be refactored or safely mapped to nested savepoints; a naive outer transaction would let route-level `COMMIT`/ `ROLLBACK` commands terminate the request transaction. Do not let concurrent pooled requests share a context.
5. Commit before a success response is finalized; roll back on unhandled errors; always release the client.
6. Ensure public endpoints and unauthenticated login/session creation paths remain explicitly separated.
7. Explicitly model bilateral settlement access, platform/regulator authority, worker identities, and multi-organization workspaces; a single `active_organization_id` GUC is insufficient for every route.
8. Add integration tests for Fastify lifecycle/async-context propagation, pooled connection reuse, concurrent requests, absent/revoked membership, multi-org selection, bilateral settlements, and transaction rollback.
9. Inventory every non-HTTP worker/CLI/scheduled job and give each a dedicated non-owner role and explicit service scope.

## Design caution

A proxy/AsyncLocalStorage wrapper with nested-savepoint translation may reduce the need to rewrite hundreds of call sites, but it must be proven against Fastify's real lifecycle, all `.connect()` usage, transaction error paths, and connection-release behavior. A global request transaction can also hold pool connections longer and serialize queries made concurrently through one `PoolClient`; load-test before adoption. Do not patch the application with an unverified context-propagation trick.

## Gate decision

The disposable Neon lab proved basic PostgreSQL RLS behavior only. Application transaction context is **not implemented**. Production RLS rollout remains blocked until the integration design is tested in a disposable branch and the route/worker inventory is complete.
