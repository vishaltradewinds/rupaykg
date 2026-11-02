# RupayKg — focused tenant-route transaction findings

Date: 2026-11-03
Branch: shakti/verifier-identity-tenant-hardening-2026-11-02
Scope: static inspection of server.ts, value-routes.ts, registry-routes.ts, sync-routes.ts, workspace-routes.ts, bwg-routes.ts, cpcb-swm-routes.ts, evidence-vault-routes.ts, epr-return-routes.ts and statutory-routes.ts. No runtime test or source modification was performed for this audit.

## Executive decision

The earlier route-boundary audit's finding that only two of 16 modules use the wrapper is confirmed by the focused scan. Some routes perform authorization reads on a pool connection and later perform mutations on another connection or a manually opened transaction. This separation is not a substitute for a single signed, transaction-local tenant context once RLS is enabled. Existing application-level checks do not establish the RLS context for subsequent statements.

Do not enable production RLS on the strength of current route checks. Complete route refactoring and actual restricted-role tests first.

## Concrete findings

### 1. server.ts root routes are outside the wrapper
- Startup checks exist for app/auth roles, but root-registered geography endpoints use direct pool queries.
- /api/v1/geography/roots performs membership/scope joins through pool.query; fallback calls a separate client helper. /children/:parentId performs a scope check then reads children on the pool.
- These paths have no explicit signed tenant transaction wrapper in server.ts.
- Health checks using select 1 are infrastructure probes and may remain outside tenant context; keep that exception explicit.

### 2. value-routes.ts has direct pool authorization and mutations
- Helpers activityAccess, assertActivityGeographyScope, hasValuePermission, and evidenceIsVerified use pool/client queries without a shared signed transaction requirement.
- Carbon calculation performs evidence/verification/methodology reads and inserts carbon_calculations using the pool.
- EPR assessment reads obligations, credits/evidence/verification and updates obligations using the pool.
- ESG reporting reads reporting periods/evidence/verifications and inserts metrics using the pool.
- BWG dashboard uses multi-query Promise.all across tenant tables; reporting-period and report writes use pool queries.
- Refactor each complete unit of work to one checked-out client and signed transaction context; ensure every authorization read and mutation uses that same client.

### 3. registry-routes.ts uses a local transaction helper, not the signed context wrapper
- The module defines tx(pool, fn) which opens BEGIN/COMMIT but does not itself establish signed identity/organization context.
- Credential issuance and registry event writes run through that helper.
- A SQL transaction alone is not equivalent to the approved RLS request transaction boundary. The route needs explicit authorization context and bilateral issuer/holder scope for registry ownership changes.

### 4. evidence-vault-routes.ts has mixed pool and transaction paths
- Upload uses a manual transaction for series/evidence/artifact writes, but initial activity/geography checks occur through pool.query before the transaction.
- List/download paths include pool reads and geography checks on separate connections.
- Review uses a manual transaction, but it must establish signed context before reading evidence and writing review/verification state.
- Convert each route's authorization and data operations to the same signed transaction; do not leave preflight scope checks outside the transaction.

### 5. epr-return-routes.ts uses manual transactions and preflight pool operations
- Listing and draft creation use pool queries.
- Submit/reconcile flows use manual BEGIN/COMMIT. Submit loads return/obligation/evidence/verification, checks permission and geography, then updates the return and obligation.
- The submit transaction must establish signed tenant context before the first SELECT; otherwise FORCE RLS will deny or, if policy is weakened to accommodate it, risk an unsafe access path.
- Counterparty and scheme/obligation relationships need consistency checks; tenant must be derived from the authorized return row, not accepted as a caller-selected tenant.

### 6. cpcb-swm-routes.ts manually manages transactions
- Workspace creation/update uses pool authorization checks followed by a manually opened transaction for workspace and status-history writes.
- Ensure workspace and history organization IDs are constrained by parent consistency, and all operations use one signed transaction.

### 7. statutory-routes.ts uses pool-based tenant operations
- It combines global verified EPR scheme reads with tenant statutory profile, BWG assessment and EPR applicability reads/writes.
- Split global reference reads from tenant-scoped transactions; do not let a global reference-data exception create broad tenant table access.

### 8. Additional modules
- workspace-routes.ts, sync-routes.ts and bwg-routes.ts were included in the broader scan and lack explicit wrapper adoption. They need endpoint-by-endpoint classification and the same transaction boundary treatment where they access tenant data.
- Do not bulk-wrap auth lifecycle, platform authority, global reference or bilateral flows under a generic single-organization context. Define their separate narrow contexts first.

## Implementation pattern required

For each tenant endpoint:
1. Authenticate and resolve verified identity and selected organization using the trusted auth boundary.
2. Check out one DB client.
3. BEGIN.
4. Establish signed, transaction-local context through the approved withRlsRequestTransaction implementation using verified identity, organization and nonce.
5. Perform membership/permission/geography checks, parent-row reads, and all writes on that same client.
6. Derive tenant IDs from authorized database rows wherever possible; reject mismatched caller-supplied IDs.
7. COMMIT; on failure ROLLBACK and release.
8. Add two-tenant route tests covering SELECT/INSERT/UPDATE/DELETE/RETURNING, FK side channels, missing/forged context and revoked membership.

For bilateral EPR/registry/settlement/chain-of-custody routes, require a purpose-built party-scoped context and policy; do not relax the existing wrapper's bilateral-scope rejection.

## Priority order

P0 before any RLS activation:
- EPR return submit and reconciliation
- Evidence vault upload/list/download/review
- Value routes (carbon calculation, EPR assessment, ESG/BWG)
- Registry credential issue/transfer/event paths
- CPCB workspace create/update/status history
- Root geography endpoints
- Sync/worker routes under separate job-scoped authorization

P1:
- Workspace, BWG dashboard and statutory routes
- Intelligence/analytics tenant aggregation and leakage tests
- Platform-admin/onboarding separate authority context
- Auth route isolation and app/auth DB grants

## Acceptance criteria

- No tenant authorization check is performed on one pool while the protected read/write occurs on another connection.
- Every tenant statement executes after signed context is established on the same transaction/client.
- The application derives organization from authenticated membership and authorized parent rows; body/header IDs are selectors, never proof of access.
- Actual app/auth/MRV runtime credentials pass positive and negative route tests with NOBYPASSRLS and FORCE RLS.
- Bilateral party access is proven for both sides and denied for unrelated tenants.
- Route coverage report is generated from tests/instrumentation, not only text search.

## Release posture

NO-GO for production RLS activation. This document records source-level risks and the required implementation pattern; it does not claim the routes are remediated. Production remains unchanged, RLS 0/67, MRV worker OFF, EPR read OFF, PR #216 draft/unmerged, TRL 9 not established.
