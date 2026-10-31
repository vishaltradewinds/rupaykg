# RupayKg database tenant isolation — implementation design and execution gates

**Status:** design only; no RLS migration or live role/grant change authorized.
**Security classification:** P1 release blocker.
**Evidence date:** 2026-10-31.

## 1. Observed production baseline

Read-only inspection of Neon production branch `br-restless-base-b44cip2h` found:
- 67 public base tables.
- RLS disabled and zero policies on all 67 tables.
- Inspected connection role `rupaykg`: `rolsuper=false`, `rolbypassrls=true`, `rolcreaterole=true`, `rolcreatedb=true`.
- The Render service's exact connection role remains unverified. Never infer that its role is the same from a service name or redacted environment metadata.

Application authorization currently derives a verified session, verified organization memberships, an explicit active organization for multi-organization identities, role permissions and geography scope. These controls are valuable, but they are not a database-enforced tenant boundary.

## 2. Non-negotiable design principles

1. Do not enable blanket RLS without a table-by-table policy and tested access path.
2. The runtime API role must not own tenant tables, be superuser, have `BYPASSRLS`, `CREATEROLE`, or `CREATEDB`.
3. Separate API runtime, migration owner, read-only operations, and worker roles. Migration credentials are never loaded into the web process.
4. Every authenticated tenant query must execute inside a transaction that sets transaction-local identity and organization context. Do not use persistent session-level `SET` on pooled connections.
5. Missing, malformed, stale, or unverified context must deny access. No "empty context means all tenants" fallback.
6. Bilateral settlement access is an explicit two-party policy, not a general multi-tenant bypass.
7. Shared reference data and platform-wide administration are explicit policy classes, not exceptions hidden inside tenant policies.
8. SECURITY DEFINER functions require a fixed safe `search_path`, narrow EXECUTE grants, and review of every table they touch.
9. Background workers receive separate service identities and narrowly scoped policies; they do not impersonate human users.
10. RLS supplements, never replaces, application authorization, audit events, and statutory approval gates.

## 3. Data access classes to map before migration

| Class | Representative tables | Intended access rule |
|---|---|---|
| Organization-owned operational | activities, obligations, BWG profiles/reports, EPR applicability/returns, statutory profiles, stakeholder workspaces | Verified membership + active organization + geography scope + permission |
| Activity-child records | measurements, evidence, verifications, carbon calculations, resource flows, evidence artifact series/versions/reviews | Derive tenant through parent activity/organization; no caller-supplied tenant assertion |
| Registry and credit ownership | credentials, registry events, environmental claims, allocations/transfers | Issuer/current owner/authorized recipient rules; preserve immutable event and ownership constraints |
| Bilateral financial | settlements, settlement events, payer/payee obligations | Explicit payer/payee participation and action-specific permission; neither party gains broad organization access |
| Identity and sessions | identities, identity credentials/password credentials, sessions, memberships | Self-only identity/session reads; tightly restricted membership administration; service-only token hash operations |
| Governance and audit | audit events/chain heads, access-change requests, stakeholder approval requests | Tenant-bound visibility; platform security role for cross-tenant investigation; append-only write path |
| Field devices and sync | devices, sync envelopes/conflicts/cursors, operation envelopes | Device identity + enrolled organization + worker/service role; reject cross-tenant replay |
| Shared authoritative reference | geography, geography sources, regulatory sources/requirements, EPR schemes, CCTS methodology registry, methodology versions | Read-only public/authorized reference; writes reserved for governed ingestion and approval services |
| Platform/system control | migration ledger, worker leases, async mirror inbox/crosswalk/source snapshots | Separate worker/control-plane role; no ordinary tenant CRUD |

This table is a classification hypothesis, not a claim that every table's foreign keys and all access routes have already been proven. Final policy mapping must use the exact current schema and all SQL call sites.

## 4. Transaction-local context contract

Proposed application transaction wrapper (pseudocode, not yet wired):

```sql
BEGIN;
SELECT set_config('rupaykg.identity_id', :verified_identity_id, true);
SELECT set_config('rupaykg.organization_id', :active_organization_id, true);
-- execute authorized SQL only on this checked-out client
COMMIT;
```

The third argument `true` makes the setting transaction-local. The identity and organization IDs must come from server-side session/membership verification, never request JSON. For bilateral operations, use a separate, explicitly scoped transaction context containing the settlement ID and verified party membership; do not let a caller set arbitrary party IDs.

Every code path must use the same checked-out client for context setup and data queries. Existing `pool.query` calls in authenticated routes must be audited/refactored before tenant RLS is enabled. A transaction helper must roll back on errors and always release the client.

## 5. Role and policy migration sequence

### Gate A — inventory and access-path map
- Identify actual Render connection role from safe, non-secret runtime diagnostics (role name and boolean privilege flags only).
- Enumerate all SQL tables touched by each API route, auth path, worker, cron and operational script.
- Record table ownership, grants, sequences, functions, views, triggers and SECURITY DEFINER functions.
- Identify any direct DB client usage outside the API service.
- Produce a route × table × permission matrix and negative-access test cases.

### Gate B — roles on a disposable clone
- Create non-login owner/migration role and separate no-login runtime role.
- Grant only schema usage, required table DML, sequence usage and narrow function execution.
- Ensure runtime role is not owner and has no RLS bypass or role-management/database-creation privilege.
- Verify ownership, default privileges and inherited memberships; revoke broad PUBLIC grants where safe.
- Keep migration runner credentials separate from application runtime credentials.

### Gate C — policy primitives
- Implement reviewed SECURITY INVOKER helper functions where possible.
- Implement transaction-local context validation with strict UUID parsing and fail-closed semantics.
- Add RLS policies by data class, including SELECT/INSERT/UPDATE/DELETE separately where needed.
- Force RLS for tenant tables only after owner/worker/migration access paths are explicitly accounted for.
- Add policy comments and machine-readable policy inventory.

### Gate D — negative and positive acceptance
For each tenant table and every route:
- Tenant A can access its permitted rows.
- Tenant B cannot read, update, delete, or infer Tenant A rows.
- Missing context, wrong organization, unverified membership, expired/revoked session and out-of-scope geography all deny.
- Multi-organization user must select one active organization.
- Bilateral settlement allows only the payer/payee actions explicitly defined.
- Platform admin and regulator flows require dedicated privileged roles and audit evidence.
- Worker cannot mutate authoritative MRV or verification state outside its approved contract.
- Pool reuse test proves transaction context does not leak across requests.
- SECURITY DEFINER and owner-bypass tests prove no unintended bypass.

### Gate E — rollout rehearsal
- Restore a production-equivalent clone from a verified backup.
- Run migrations as the migration owner only.
- Run full API and worker acceptance under the exact non-owner runtime role.
- Exercise rollback and restore; record duration, locks, failures and data checksums.
- Independent security reviewer signs the role/policy matrix and test evidence.
- Only after approval may a production change window be considered.

## 6. Immediate code hardening completed in this work batch

PostgreSQL TLS configuration in the API server previously used `rejectUnauthorized: false` when `DATABASE_SSL` was not explicitly `false` or `require`. This silent insecure fallback has been removed:
- New `apps/src/database-tls.ts` defaults to certificate verification.
- Explicit `DATABASE_SSL=false` is the only path that disables TLS, and production configuration separately restricts that mode to its validated Render internal-database case.
- CA certificates are passed through only when explicitly supplied.
- Unit tests cover default verification, explicit require, CA pass-through and explicit disable.

This TLS fix does not resolve the RLS/tenant-isolation blocker.

## 7. Release decision

**HOLD.** Do not enable production RLS, change production roles/grants, rotate connection credentials, merge, deploy, or run migrations based solely on this design. Required evidence is the verified runtime role, complete table/route mapping, disposable-clone migration, cross-tenant tests, connection-pool isolation tests, rollback proof and independent review.

No live database writes were made for this design.


## 8. Initial route/data-access inspection (static source review)

A targeted static review of API modules confirms that RLS cannot safely be switched on yet. The following is an initial map of access patterns, not a complete exhaustive SQL table inventory:

| Module | Current pattern observed | RLS readiness |
|---|---|---|
| `server.ts` | Shared `pool.query` helper plus `withClient`; authenticated overview and several endpoints query through pool | Not ready; context wrapper required |
| `auth-routes.ts` | Session issuance, identity, membership and onboarding routes use pool-level queries | Separate identity/bootstrap policy class required |
| `evidence-vault-routes.ts` | Pool-level authorization/lookups mixed with explicit transactions for artifact upload/review | Not ready; every query in tenant flow must share context transaction |
| `cpcb-swm-routes.ts` | Pool-level reads/permission checks mixed with client transactions for workspace changes | Not ready |
| `registry-routes.ts` | Transaction helper used for high-risk registry/settlement mutations; authentication and some permission checks occur outside it | Partial foundation only |
| `sync-routes.ts` | Device checks and sync operations use both pool and client transactions | Separate device/service context required |
| `value-routes.ts` | Many tenant-sensitive pool-level queries and mutations across carbon, EPR, ESG and BWG data | Not ready |
| `mrv-routes.ts` | Multiple pool-level queries across activity, evidence, verification and provenance | Not ready |
| `workspace-routes.ts` | Pool-level reads plus isolated client transaction for some writes | Not ready |
| `bwg-routes.ts` | Pool-level queries for EPR obligations and reports | Not ready |
| `onboarding-hierarchy-routes.ts` | Pool-level onboarding review-queue query | Separate approval/administration policy required |
| `async-mirror-worker.ts` | Pool-level claim/update/query operations | Must use a dedicated worker role and narrow system policies, never human tenant context |

### Refactor order

1. Introduce a typed transaction-context helper with transaction-local GUC setup, rollback-on-error and guaranteed release; test that context is cleared on pooled connection reuse.
2. Refactor central server helpers and high-volume tenant modules (value, workspace, BWG, MRV, CPCB, evidence) so authentication, permission checks and all data queries use one context-bearing client.
3. Refactor registry and sync modules with explicit bilateral and device contexts.
4. Keep auth/bootstrap and worker paths separate, with dedicated roles and narrow functions/policies.
5. Only after the complete route × table × permission map is signed off, create an RLS migration against a disposable clone and add exhaustive positive/negative acceptance tests.

Do not retrofit transaction-local context by setting a GUC in one pool query and assuming later pool queries inherit it; that is incorrect under connection pooling and creates cross-request risk.


## 9. Transaction-local context infrastructure — implemented, not yet adopted by routes

Added:
- `apps/src/database-context.ts`
- `apps/src/database-context.test.ts`

The helper:
- Derives identity and organization only from an `AuthContext` with an explicitly active, VERIFIED membership.
- Rejects missing/malformed identity or organization UUIDs before acquiring a connection.
- Checks out one PostgreSQL client, begins a transaction, sets identity and organization using transaction-local `set_config(..., true)`, executes caller work on that same client, commits, rolls back on failure and always releases the client.
- Preserves the original application error if rollback itself fails.

Tests cover transaction ordering, same-client work, rollback, release, invalid context rejection and verified-membership derivation.

**Important boundary:** this helper is infrastructure only and is not yet wired into production routes. Existing route handlers still use pool-level queries. No RLS policy should be enabled until those call sites are refactored and tested. The custom transaction-local settings are a context carrier for the trusted application server; they are not cryptographic claims and do not defend against a fully compromised application database credential or arbitrary SQL execution. Policies must independently check active membership and the threat model must include this limitation.


## 10. First route adoption — resource-flow creation

The `POST /api/v1/resource-flows` route now uses the transaction-local tenant helper:
- Verified active membership context is derived from `AuthContext`.
- Permission lookup (`waste:record`), source/destination geography authorization and the resource-flow insert run on the same checked-out PostgreSQL client and transaction.
- The route no longer performs its permission/geography checks and write through separate pool-level operations.
- Any failed check returns a denial and the transaction commits no resource-flow mutation; thrown database failures roll back.

This is the first route adoption, not platform-wide tenant isolation. Read paths and other mutation routes remain to be inventoried/refactored. The production RLS gate remains closed until all tenant-sensitive SQL paths, worker roles, shared/system tables and cross-tenant tests are covered.
