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

## 11. Second tenant-scoped route adoption — activity measurements

On 2026-10-31, `POST /api/v1/activities/:activityId/measurements` was moved from separate pool-level authorization and insert operations into `withTenantTransaction(tenantDatabaseContextFromAuth(auth), ...)`.

- The activity authorization/permission lookup and measurement insert now execute on the same checked-out client and transaction.
- The route additionally requires the activity owner organization to equal the server-verified active organization; a cross-organization activity is denied before mutation.
- The transaction-local context is derived from the verified active membership, not from request body or header tenant identifiers.
- This remains a partial route migration. Read paths, other write routes, worker/system paths, and the full table-policy map remain outstanding. No RLS policy or live database change is authorized by this code change.

Exact-head CI must validate the new commit before this adoption is treated as engineering-pass evidence.

## 12. Third tenant-scoped route adoption — evidence upload

On 2026-10-31, `POST /api/v1/evidence-vault/upload` was moved to the shared transaction-local tenant context helper.

- Activity ownership, active-organization equality, geography scope, and evidence-upload permission are now checked on the same checked-out client used for evidence-series creation, evidence metadata, artifact-version bytes, and the final content-URI update.
- Series validation and all evidence writes are part of one transaction. A scope/permission/series rejection returns without committing any partial evidence writes; unexpected failures roll back through the shared transaction helper.
- Tenant context is derived from the server-verified active membership. Request body and headers are not trusted to select a tenant.
- Evidence listing, download, and review were subsequently migrated in the next implementation batch (Section 13); this adoption does not imply full platform tenant isolation or database-enforced RLS.


## 13. Fourth through sixth tenant-scoped route adoptions — evidence vault

On 2026-10-31, the remaining evidence-vault routes were moved to the shared transaction-local tenant helper:

- `GET /api/v1/evidence-vault?activityId=...`: activity ownership, active-organization equality, geography scope, read permission, and artifact listing now run on the same checked-out client and transaction.
- `GET /api/v1/evidence-vault/:evidenceId`: evidence lookup, active-organization check, geography scope, permission check, content-size/hash integrity verification, and retrieval run in one tenant-context transaction. Cross-organization evidence is returned as not found.
- `POST /api/v1/evidence-vault/:evidenceId/review`: evidence row lock, active-organization/geography/permission checks, independent-reviewer check, immutable-state check, review record, verification record, and evidence status update now share one tenant-context transaction. The uploader cannot review their own artifact.

The download response is emitted only after the transaction completes and the stored bytes pass size and SHA-256 verification. The filename used in the response header is sanitized against quote, backslash, CR and LF injection.

These adoptions close the known evidence-vault route-level pool/client split. They do not close the platform-wide RLS blocker: other route modules, auth/bootstrap paths, background workers, exact Render runtime role identification, cross-tenant negative tests, pooled-connection context-leak tests, and clone-based policy/rollback rehearsal remain open. No RLS migration, live role/grant change, merge or deployment is authorized.


## 14. MRV status and provenance read/verification adoption

On 2026-10-31, the following MRV routes were moved to the transaction-local tenant helper:

- `GET /api/v1/mrv/status`: requires an explicit verified active organization and checks `guardian:read` on the same tenant-context transaction. The prior fallback to the first membership was removed.
- `GET /api/v1/mrv/provenance/:activityId`: activity ownership, active-organization equality, geography scope, permission, provenance retrieval and acceptance-fixture eligibility checks share one transaction.
- `GET /api/v1/mrv/hedera/verify/:consensusTimestamp`: provenance lookup and authorization run in a tenant transaction; external Mirror Node verification runs outside the DB transaction; before persisting verification time, the route rechecks active organization, geography and permission in a new tenant transaction and conditionally updates the exact provenance row. Acceptance-fixture status is read in that same persistence transaction.

This deliberately avoids holding a database transaction open during external Hedera network I/O. It also closes the authorization time-of-check/time-of-use gap before persisting the external verification result. The MRV submission route, statutory routes, and other route modules remain outstanding. No RLS migration or live DB change is authorized.


## 15. MRV submission transaction-boundary adoption

On 2026-10-31, `POST /api/v1/mrv/activities/:activityId/submit` was refactored:

- A verified active-organization context is mandatory; the route no longer relies on a membership fallback.
- Activity, verification and evidence binding; activity completion and evidence verification preconditions; geography scope; Guardian operation permission; observations; evidence; measurement quantity; prior idempotent provenance; and acceptance-fixture metadata are read within one tenant-context transaction.
- The session-level advisory lock remains on a dedicated checked-out client solely to serialize the idempotency key. Tenant data reads and writes do not use that lock connection.
- Guardian execution and Hedera HCS submission remain outside a database transaction to avoid holding pooled DB transactions open across network calls.
- Before provenance persistence, the route re-reads activity/verification/evidence state, checks active organization, geography scope and permission in a new tenant-context transaction, then persists the provider result on that same client.
- Obsolete pool-level MRV authorization helpers were removed after all MRV route call sites were migrated.

**Residual control:** external provider submission is not atomically reversible if authorization or source state changes after preflight but before the provider accepts the request. The post-provider transaction prevents persistence after a failed recheck, but it cannot undo an external Guardian/Hedera side effect. A future durable outbox/worker protocol with explicit authorization snapshot, idempotency, cancellation and reconciliation is required before claiming atomic end-to-end authorization. This is not solved by keeping a DB transaction open during network I/O.

The MRV route batch still requires exact-head CI, route integration tests, provider idempotency/replay tests, cross-tenant negative tests and independent review. It does not authorize live Guardian/Hedera submission, RLS activation, merge or deployment.


## 16. Pooled-connection context-leak acceptance test

Added a disposable-PostgreSQL integration test to `apps/src/database-context.test.ts`. It runs the transaction helper with a pool capped at one connection, verifies the first identity/organization inside the transaction, checks that both custom settings are empty after commit when the same pooled connection is queried outside a transaction (PostgreSQL returns an empty string for a reset custom setting), and then verifies that a second tenant context is applied correctly on reuse.

The test is gated to CI, non-production mode, the explicit database-integration flag and a configured disposable `DATABASE_URL`. It does not run against live Neon. Exact-code-head validation is running in CI #41189912605 after an initial typecheck caught escaped SQL template delimiters in the MRV submission refactor; those delimiters were corrected in commit `e5cfed11ff11c72e060ccda3877819165c2fdeb4`. Await this run before treating the MRV batch and new pool-reuse test as validated.


## 17. EPR obligation listing route adoption

On 2026-10-31, `GET /api/v1/epr/obligations` in `apps/src/bwg-routes.ts` was moved to the tenant-context helper:

- The route now requires an explicit verified active organization and no longer accepts `x-rupaykg-organization-id` as a fallback tenant selector.
- `epr:read` / `epr:manage` / `reports:read` permission evaluation and the obligation listing query run on the same checked-out client and transaction.
- The organization filter is bound to the verified active organization derived from the authenticated context.

The BWG registration function also registers `epr-return-routes.ts`; that separate route module remains outstanding and is not covered by this adoption. This is one route only, not a completed EPR/BWG tenant boundary. Exact-head CI is pending.


## 18. EPR return lifecycle route adoption

On 2026-10-31, all four routes in `apps/src/epr-return-routes.ts` were moved to the tenant-context helper:

- `GET /api/v1/epr/returns`: active-organization permission and listing query share one transaction.
- `POST /api/v1/epr/returns`: optional request organization must equal the verified active organization; scheme/obligation eligibility and draft creation share one transaction.
- `POST /api/v1/epr/returns/:returnId/submit`: return/obligation row locks, permission, evidence and approved-verification binding, geography scope, balance checks, return submission and obligation fulfillment update share one transaction.
- `POST /api/v1/epr/returns/:returnId/external-reference`: row lock, active-organization check, permission, state/immutability checks and reference update share one transaction.

The EPR return module no longer performs tenant-sensitive pool-level queries or manual transactions. The parent BWG module's EPR obligation listing was separately migrated in Section 17. Exact-head CI for the full EPR route batch is pending; EPR statutory workflows still require business-rule, authorization, evidence and duplicate/balance acceptance tests, plus independent compliance review. No external government submission is performed by these routes.


## 19. CPCB SWM stakeholder workspace route adoption

On 2026-10-31, all three routes in `apps/src/cpcb-swm-routes.ts` were moved to tenant-context transactions:

- `GET /api/v1/cpcb-swm/workspaces`: active-organization permission and workspace/history listing share one transaction.
- `POST /api/v1/cpcb-swm/workspaces`: permission, optional geography authorization, workspace insert, status-history insert and hash-chain audit event share one transaction.
- `PATCH /api/v1/cpcb-swm/workspaces/:workspaceId`: permission, optional geography authorization, row lock, update, status-history append and audit event share one transaction.

The routes now use the verified active organization rather than a request-selected tenant. Audit writes remain in the same transaction as the governed workspace mutation. Exact-head CI is pending. Statutory status remains explicitly user-reported/unverified; this refactor does not represent a CPCB filing or government acceptance.


## 20. Workspace API tenant transaction adoption

On 2026-10-31, the workspace API was refactored to use one explicit active organization and one transaction-local tenant context per route:

- `GET /api/v1/workspaces/resource-flows`
- `GET /api/v1/workspaces/mrv`
- `GET /api/v1/workspaces/compliance`
- `GET /api/v1/workspaces/carbon`
- `GET /api/v1/workspaces/registry`
- `GET /api/v1/workspaces/settlement`
- `GET /api/v1/workspaces/esg`
- `POST /api/v1/evidence/:evidenceId/verification`

The previous pre-handler authorization hook and pool-level permission/geography queries were removed. Each route now performs its workspace permission check, optional geography authorization and all data reads on the same checked-out client. Evidence verification additionally locks the evidence row, verifies activity ownership and geography, checks the verifier's explicit permission, inserts the verification and updates evidence status in one transaction.

For these routes, cross-organization multi-membership aggregation was replaced with an explicit active-organization context. Registry/settlement visibility remains subject to the existing issuer/current-owner and payer/payee business filters; those bilateral/ownership policies still need independent review before RLS policy design. Exact-head CI is pending.
