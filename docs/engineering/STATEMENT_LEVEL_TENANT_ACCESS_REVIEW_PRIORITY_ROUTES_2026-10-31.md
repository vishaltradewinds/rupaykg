# Statement-Level Tenant Access Review — Priority Routes — 2026-10-31

## Scope and evidence

This is a source-level review of the current PR #157 candidate branch, commit parent `ddbed3ab68fd0a06f055f3c68e5c678e26384c34`. It expands the earlier regex inventory by tracing the SQL call sites and route handlers in:

- `apps/src/intelligence-routes.ts`
- `apps/src/statutory-routes.ts`
- `apps/src/value-routes.ts`
- `apps/src/sync-routes.ts`
- `apps/src/registry-routes.ts`
- `apps/src/server.ts`
- `apps/src/database-context.ts`

This is a bounded review of these files, not yet a complete repository-wide query graph. It does not inspect every helper implementation, every migration/view/function, dynamic SQL path, all route registrations, or the deployed Render identity.

## Access contract observed

`database-context.ts` derives identity and active organization from server-verified `AuthContext`, acquires one checked-out pool client, starts a transaction, installs transaction-local settings, executes the callback, commits/rolls back and releases the client. This is a useful transaction boundary, but it does not itself provide RLS enforcement or least privilege. The helper's existence is not proof that a route uses it.

## Exact route and SQL findings

### 1. Intelligence workspace — direct-pool tenant queries

File: `apps/src/intelligence-routes.ts`

Route: `GET /api/v1/workspaces/intelligence`

1. Authentication: `authenticate(request, pool)` — authentication helper uses the pool; its internal SQL/context is not part of this route-local query list.
2. Permission: loops through derived organization IDs and calls `hasOrganizationPermission(pool, auth, organizationId, ["audit:read", "projects:manage"])`. This is a pool-level helper call, outside a shared route transaction.
3. Optional geography authorization: direct `pool.query` against `organization_memberships` plus `organization_has_geography_scope(...)`.
4. Findings projection: direct `pool.query` reads `activities` and left joins `geography`; filters organization IDs and geography scope.

Risk: authorization, optional geography check and the data read are separate pool operations. Membership/permission changes can race between checks and read; tenant GUC context is not installed on the read connection. The route supports multiple membership organizations when no active organization is selected, so it is a multi-organization aggregation path and must not be silently converted to a single-active-tenant query without a product/authorization decision.

Safe target: derive the allowed organization set from verified server context; perform permission, geography and projection reads on one checked-out client/transaction. If multi-org aggregation remains intended, represent the explicitly authorized set in a dedicated context contract and prove that policies constrain rows to that set. Do not pass organization IDs from request input as trusted context.

### 2. Statutory routes — five handlers with split authorization and persistence

File: `apps/src/statutory-routes.ts`

All five handlers authenticate through `authFor(..., pool)`; organization selection is currently body `organizationId`, else active organization, else first membership, checked with `canActForOrganization`. That proves a membership relation in application context, not a single transaction-scoped database authorization boundary.

- `GET /api/v1/statutory/epr/schemes`
  - `hasOrganizationPermission(pool,...)`
  - direct pool read of verified global catalog `epr_schemes`.
  - Data is global catalog; authorization is organization-scoped. Catalog access can be read-only/global, but permission check and read should share a deliberate control-plane or tenant transaction contract.
- `GET /api/v1/statutory/applicability`
  - `hasOrganizationPermission(pool,...)`
  - three concurrent pool queries: `organization_statutory_profiles`, `organization_bwg_assessments`, and `organization_epr_applicability` joined to `epr_schemes`; organization filter is parameterized.
  - These reads are not transactionally consistent with the permission check or each other.
- `POST /api/v1/statutory/bwg/assess`
  - organization membership check and permission check use application/helper pool paths.
  - `evidenceBindingValid(pool,...)` directly reads `evidence`, `activities`, and `verifications`, including geography scope.
  - direct insert into `organization_bwg_assessments`.
  - Evidence/verification validation and assessment insert are not atomic; ownership/evidence status can change between validation and write.
- `POST /api/v1/statutory/epr`
  - organization membership and permission checks precede direct global `epr_schemes` lookup.
  - `evidenceBindingValid(pool,...)` checks `evidence`, `activities`, `verifications`.
  - direct upsert into `organization_epr_applicability`.
  - Scheme validation, evidence binding and upsert are not one transaction.
- `POST /api/v1/statutory/epr/:id/external-registration`
  - direct lookup of `organization_epr_applicability` by ID to discover organization.
  - application-level organization and permission checks.
  - direct update of `organization_epr_applicability`.
  - Lookup/authorization/update are separate operations; organization binding can change or record can be concurrently modified between them.

Statutory boundary: response labels say internal applicability preparation only and user-reported external registration is explicitly unverified. Preserve those boundaries; these routes must not claim government registration, legal applicability certification, or authority acceptance.

Safe target: each organization-scoped read/write should resolve and authorize the organization inside a single transaction client. For BWG/EPR writes, lock or otherwise safely revalidate referenced records and perform evidence/verification binding plus mutation atomically. Global `epr_schemes` should be classified as a versioned global reference catalog, not incorrectly treated as tenant-owned. Keep external authority verification as a separate evidence-backed workflow.

### 3. Value routes — mixed adoption; remaining BWG write paths

File: `apps/src/value-routes.ts`

Already uses `createTenantTransaction` for:
- carbon calculation (reads evidence, approved verification, methodology version; inserts `carbon_calculations`);
- EPR obligation assessment (reads `obligations`, membership/geography, EPR credits/evidence/verifications/activities; updates obligation status/quantity);
- ESG metric recording (reads reporting period/evidence/verifications/activities; inserts `esg_metrics`);
- BWG workspace projection (reads BWG profiles, reporting periods, waste/EPR/ESG reports, geography scopes and global EPR schemes).

Remaining direct-pool BWG writes/reads in this file:
- profile update: permission helper and geography check via pool, then upsert `bwg_profiles`;
- reporting-period creation: direct upsert `bwg_reporting_periods`;
- waste report creation: lookup reporting period, optional approved-verification lookup, then insert `bwg_waste_reports`;
- EPR report creation: lookup reporting period, global verified `epr_schemes` lookup, optional approved-verification lookup, then insert `bwg_epr_reports`;
- ESG report creation: lookup reporting period, optional approved-verification lookup, then insert `bwg_esg_reports`.

These paths require tenant-context adoption and atomic parent ownership/evidence/verification checks with the write. The reporting-period lookup must establish the owning organization before any report write; do not trust a client-supplied period ID alone. Global scheme catalog remains global reference data.

Important nuance: the BWG workspace transaction intentionally reads multiple organization IDs from the authenticated membership set. Confirm whether this multi-org view is a deliberate product feature and make the context/policy support explicit before RLS rollout.

### 4. Sync routes — device principal and organization principal must remain distinct

File: `apps/src/sync-routes.ts`

The route module contains direct pool device lookup (`field_devices` by device ID, identity ID and VERIFIED status), plus manually checked-out client work for sync cursors, organization membership, geography authorization and sync event processing. The SQL helpers use `PoolClient` for cursor lock/update and organization/geography checks.

Do not blindly apply the human-user active-organization context to a device sync request. The correct principal is a verified field-device identity cryptographically/operationally bound to its owning identity and authorized organization(s). The target transaction must establish device ownership/status, organization binding, geography scope, cursor lock, idempotency/conflict validation and persisted event on the same checked-out client. A device must not choose or expand its organization scope from an envelope field.

This file needs a separate device transaction context design and replay/idempotency tests before RLS policy work.

### 5. Registry and settlement — bilateral scope, not ordinary tenant scope

File: `apps/src/registry-routes.ts`

The registry module uses a local transaction helper with a checked-out client. Credential lifecycle reads/writes touch `credentials` and append `registry_events`. Settlement operations touch `settlements` and `settlement_events`; authorization checks both payer and payee organization access, then separately checks high-risk `AUTHORIZE_SETTLEMENT` / `SETTLE_FUNDS` permission in the database. Current registry owner must match payer before settlement creation.

Do not force these records into a simplistic single-org RLS policy. Credential ownership and settlement payer/payee are bilateral or lifecycle relationships. Policy design must explicitly represent issuer/current owner, payer, payee, actor and lifecycle state, and prevent either party from mutating the other party's unrelated records. Preserve row locks and event append operations in one transaction.

### 6. Shared server routes — global catalog, tenant aggregate and tenant mutations are mixed

File: `apps/src/server.ts`

- `GET /health`: pool-level `select 1`; infrastructure health only.
- dashboard aggregation uses several pool-level `countFor` queries over activities, measurements, evidence, verifications, obligations, credentials and settlements; organization ID sets are derived from verified memberships, but no single tenant transaction spans all counts.
- `GET /api/v1/regulatory/sources`: unauthenticated global read of `regulatory_sources`; classify as public/versioned regulatory-source catalog and protect provenance/integrity separately.
- geography roots/children use a mix of pool queries and manually checked-out clients; fallback path reads global geography roots then checks scope per root. This needs a consistent read-only geography service contract; do not classify all geography rows as tenant-owned.
- resource-flow and measurement mutation routes use the shared tenant transaction helper.

## Priority remediation order

1. **Statutory route batch**: highest priority because evidence binding and write are separate pool operations; refactor five routes to transaction client and add race/ownership tests.
2. **Intelligence workspace**: transaction-bound permission/geography/projection; explicitly decide multi-org aggregation semantics.
3. **BWG write routes in value-routes**: move profile, period and report writes to tenant transactions with locked parent ownership and evidence validation.
4. **Sync**: design a device-principal transaction context; no blind human-tenant helper reuse.
5. **Dashboard/geography**: classify aggregate/global read paths and provide stable consistent snapshot semantics.
6. **Registry/settlement**: independent bilateral policy model; preserve current row locks and high-risk database permission checks.

## Required evidence before enabling RLS

- Complete statement-to-route inventory for every API route, worker, scheduled task, migration/seed/CLI and helper.
- Exact table classification: tenant-owned, global reference, identity/control-plane, platform-admin, device-owned, bilateral, append-only event, or worker-owned.
- Verified transaction context for every tenant-owned query; no hidden pool query inside a tenant route helper.
- Least-privilege runtime roles; actual Render role identity and effective grants verified.
- Disposable-clone RLS tests for positive access, cross-tenant denial, multi-org aggregation, bilateral settlement, device spoofing, pool connection reuse/context reset, and worker isolation.
- Migration chronology reconciled against production-only migration 096 and the unledgered 20261101 staging/rehearsal drift.
- Independent database/security review, backup/restore proof, rollback rehearsal and approved change window.

## Explicit limitations and release posture

This review is source-level and bounded to the named files. It does not establish runtime behavior for the deployed service, does not prove the actual Render database role, and does not prove complete tenant isolation. It is not an RLS policy specification or production approval.

No production/staging DDL or DML, role/grant change, deployment, worker activation, external government submission, Guardian/Hedera submission, carbon-credit issuance, or certification was performed. RLS remains disabled. PR #157 remains draft; production release remains HOLD.
