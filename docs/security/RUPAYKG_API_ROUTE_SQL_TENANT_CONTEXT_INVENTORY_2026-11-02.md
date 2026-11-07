# RupayKg API route SQL and tenant-context inventory

**Audit date:** 2026-11-02  
**Branch:** `shakti/auth-bootstrap-application-integration-2026-11-01`  
**Scope:** Current API server/auth/route modules and request-context helpers  
**Method:** Static source scan of current branch. Counts below are source lines containing direct `pool.query`, `client.query`, `authPool.query`, or `connect` invocation patterns; multiline calls and wrapper indirection mean these are triage indicators, not exact SQL statement counts or proof of exploitability.

## 1. Route-by-route inventory

| Module | Direct query/connect call lines | Protected domain/auth tables referenced | Signed RLS request helper used |
|---|---:|---|---|
| `server.ts` | 15 | identities, sessions, memberships, roles, evidence, activities, measurements, verifications, obligations, settlements, geography scopes, resource flows | No |
| `auth.ts` | 7 | identities, sessions, memberships, roles, activities, evidence, settlements | No |
| `auth-routes.ts` | 9 | evidence reference plus identity/session lifecycle via database functions | No |
| `onboarding-hierarchy-routes.ts` | 3 | onboarding evidence reference; hierarchy via auth functions | No |
| `platform-admin-routes.ts` | 49 | identities, sessions, memberships, roles, organizations, stakeholder applications | No |
| `value-routes.ts` | 36 | activities, memberships, evidence, verifications, obligations, EPR credits, geography scopes, organizations | No |
| `registry-routes.ts` | 1 | verifications, evidence, activities, registry events, organizations, memberships, settlements | No |
| `sync-routes.ts` | 21 | field devices, memberships, activities, measurements, evidence, resource flows | No |
| `workspace-routes.ts` | 13 | memberships, organizations, resource flows, activities, measurements, verifications, obligations, registry events, settlements | No |
| `bwg-routes.ts` | 1 | obligations | No |
| `cpcb-swm-routes.ts` | 19 | evidence and memberships | No |
| `intelligence-routes.ts` | 2 | memberships and activities | No |
| `mrv-routes.ts` | 15 | activities, memberships, evidence, verifications, measurements | No |
| `evidence-vault-routes.ts` | 27 | evidence, activities, verifications | No |
| **Route/server/auth subtotal** | **218** | — | **0 modules** |

The request-context implementation `rls-request-transaction.ts` contains 5 internal query/connect call lines and is not invoked by the above modules in this scan. `signed-request-context-token.ts` contains no direct pool/query calls. This confirms the P0 integration gap at the API source boundary: helper existence is not universal enforcement.

## 2. Priority remediation order

1. **Platform administration (49 call lines):** identity, session, membership, role, organization and application administration must move behind narrow identity-bound functions with dual-control checks. No broad direct table grants.
2. **Value operations (36):** establish request-scoped tenant transaction and map activity/evidence/verification/EPR/geography scope to exact DB guards.
3. **Evidence vault (27):** scope every read/write to verified organization and activity ownership; preserve append-only evidence and hash integrity.
4. **Field sync (21):** device identity, envelope ownership, idempotency, replay protection and atomic apply must execute within the same verified tenant context.
5. **CPCB/SWM (19) and MRV (15):** derive organization and jurisdiction from trusted auth context; prevent caller-supplied organization/geography from expanding scope.
6. **Server/auth/workspace (35 combined):** isolate identity/auth data access from domain runtime; remove direct auth-table access from app runtime; ensure all domain queries are request-bound.
7. **Registry, BWG and intelligence:** validate organization ownership, settlement bilateral access, external confirmation and worker/service principal scope.

## 3. Required implementation contract

- One verified request context is established after authentication and before protected data access.
- Tenant context is transaction-local and cryptographically bound to the resolved live session; it is never accepted as an arbitrary caller-provided organization ID.
- Every protected query uses the same transaction/client for its request; no shared-pool query may escape the context.
- Existing explicit transactions are refactored or safely nested without issuing conflicting BEGIN/COMMIT/ROLLBACK.
- Public reference-data reads, authentication lifecycle functions, platform-control functions, workers and bilateral settlement operations use separately reviewed contracts; they are not silently forced into a single-tenant path.
- App runtime has no direct access to identity/session/credential tables and cannot assume owner roles, bypass RLS, execute bootstrap, or mutate platform authority.
- Test exact restricted app/auth roles, not postgres/superuser, with two organizations and adversarial cross-tenant requests.

## 4. Acceptance tests before RLS rollout

- Route matrix covers every endpoint and worker/CLI operation, including unauthenticated and privileged routes.
- Tenant A cannot read, create, update or delete Tenant B records through any route or nested/child resource.
- Missing, malformed, expired, revoked, suspended, replayed and mismatched signed contexts fail closed.
- Pooled connection reuse and concurrent requests cannot leak tenant context.
- Rollback and nested transaction behavior is atomic.
- Resource-flow, settlement, registry, evidence and field-sync multi-party rules are explicitly modeled.
- Direct SQL call-site inventory is reduced to approved control-plane/auth/public-reference paths, each with a documented least-privilege grant.
- Exact-role disposable Neon integration and migration-from-live-schema rehearsal pass.

## 5. Limitations and next coverage pass

This inventory covers the named API server/auth/route modules only. It does not claim complete coverage of all packages, web frontend, worker processes, CLI scripts, scheduled jobs, SQL functions/triggers, historical migrations or infrastructure. Those must be enumerated in the next repository-wide pass before production certification. Counts are static source indicators and must not be represented as vulnerability counts.
