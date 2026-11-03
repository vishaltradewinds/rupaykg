# Value, workspace, CPCB/SWM, BWG and statutory route audit — 2026-11-03

Status: static source audit; draft evidence only. No policy approval, runtime certification, database change or deployment.

## Scope and exact source heads

Inspected the following files at PR #192 head `3df3771587badeb4a0b6494476c268b441a74443`:

- `apps/src/value-routes.ts`
- `apps/src/workspace-routes.ts`
- `apps/src/cpcb-swm-routes.ts`
- `apps/src/bwg-routes.ts`
- `apps/src/statutory-routes.ts`

This is a lexical/static audit of the checked-in source. It does not prove live route behavior or the full set of database functions, triggers, RLS policies, worker paths or provider integrations.

## Findings

### P0 — Value routes have no single tenant-bound transaction boundary

`value-routes.ts` calls `authenticate()`, `hasOrganizationPermission(pool,...)`, activity/evidence/verification lookups, geography checks, and mutations through separate `pool.query` calls. Examples include carbon calculation creation (activity access, permission, evidence, approval, methodology, insert), obligation assessment/update, ESG metric creation, and BWG profile/report mutations.

Impact: a route may authorize one state and mutate against another; tenant scope is not carried as a signed transaction-local database context. This is not safe to expose under a restricted RLS runtime. Several reads use an object ID before a definitive tenant-bound authorization decision.

Required remediation:
1. For each handler, acquire one checked-out client and begin one transaction.
2. Set the signed active-organization context on that client before any protected read.
3. Resolve object ownership, permission, geography, evidence approval, and all dependent references on that same client.
4. Lock mutable source/target rows in deterministic order; write derived rows and audit/provenance atomically.
5. Add exact-role two-tenant Fastify route tests for allow, 403, cross-tenant 404/deny, revoked membership, forged context and transaction rollback.
6. Do not wrap handlers blindly where they already manage transactions; refactor to one explicit client lifecycle.

### P0 — Workspace aggregates span multiple organizations without a bilateral policy

`workspace-routes.ts` builds an array of organization IDs from the authenticated memberships and queries many domains with `organization_id = ANY($1::uuid[])`. Registry reads include current ownership through lateral `registry_events` lookup. Settlement reads include rows where payer or payee is in the ID array, but the geography predicate is evaluated against the underlying credential activity organization.

Impact: a single-organization signed RLS context cannot safely represent a multi-organization membership set, registry current-owner relation, or two-party settlement. The settlement predicate does not independently prove the active user has authority for both payer/payee visibility and the current credential owner. A geography match on the activity's issuer organization is not a substitute for each party's authorization.

Required remediation:
- Keep single-tenant workspace reads strictly limited to the signed active organization.
- Model registry current owner as a separately validated ownership edge, with event-chain integrity and explicit issuer/current-holder scopes.
- Design a separate bilateral settlement claim containing both payer and payee, bind both approvals and current credential owner, and write dedicated policies/functions/tests. The existing single-org helper correctly rejects bilateral contexts; do not bypass it with an organization-ID array.
- Until that model exists, exclude settlements and cross-tenant registry rows from the general workspace response.

### P1 — CPCB/SWM route uses separate pool checks and route-local transaction clients

`cpcb-swm-routes.ts` checks permissions through the pool, checks geography through another pool query joining memberships, then starts a separate `pool.connect()` transaction for insert/update and status-history writes. Read routes similarly authorize with the pool then read through another pool query.

Impact: permission/geography checks are not bound to the transaction that performs the write. History and workspace mutations are atomic with each other, but not with the authorization snapshot. The workspace and status-history tables need explicit tenant policy and append-only controls.

Required remediation:
- Refactor each handler to one checked-out client, signed context first, then permission/geography/object lock/write/history on that client.
- Ensure status-history is append-only to the application runtime; no update/delete/truncate grants.
- Add two-tenant read/write tests and rollback tests for history failure.

### P1 — BWG obligation read and statutory reads/writes are pool-based

`bwg-routes.ts` authorizes with pool helpers and reads obligations through another pool query. `statutory-routes.ts` similarly performs permission checks and profile/applicability queries or mutations through pool-level operations. In several mutation flows, object ownership is first selected by identifier, then permission is checked separately, then the write occurs through a later query.

Impact: there is no signed transaction-local tenant boundary; an object ID alone is not a sufficient authorization scope. EPR scheme catalogue data may be global/reference data, but organization-specific applicability and BWG assessments are tenant-owned.

Required remediation:
- Classify reference catalog reads separately from tenant data.
- Move all tenant-owned profile/assessment/applicability reads and mutations into one signed tenant transaction.
- Bind every mutation to `organization_id` in the SQL predicate and verify the row count.
- Add tests for cross-tenant object IDs, permission revocation, missing geography, and atomic rollback.

## Route-to-data priorities

| Priority | Route cohort | Immediate release blocker |
|---|---|---|
| P0 | Value calculations, obligations, ESG metrics | Separate pool queries; no signed transaction; cross-object ownership binding incomplete |
| P0 | Workspace aggregates | Multi-org array scope and bilateral settlement/registry ambiguity |
| P1 | CPCB/SWM workspaces | Pool permission/geography checks separated from mutation transaction |
| P1 | BWG obligations/reports | Pool-level authorization and object-ID lookup/write separation |
| P1 | Statutory applicability | Pool-level tenant reads and writes; reference-vs-tenant classification needed |

## Acceptance gates

1. Exact route + restricted runtime tests, not just helper unit tests.
2. Tenant A/B data fixtures; verify no cross-tenant rows for every read and aggregate.
3. Permission denied as 403; missing/invalid infrastructure contract as 503; never fail open.
4. Transaction-local signed claims must be set before all protected statements and cleared by commit/rollback before pool release.
5. Database policy tests under the actual `rupaykg_app_runtime` role with NOBYPASSRLS and no role memberships.
6. Bilateral settlement and registry ownership tests separately designed; do not infer them from single-org tests.
7. Function, trigger, grant and worker side-effect inventory reconciled before enabling RLS or feature flags.

## Release disposition

This audit adds no production DDL/DML, grants, roles, policies, secrets, deployments or feature activation. It does not authorize a migration or imply TRL 9. Production remains HOLD; EPR/MRV worker and feature flags remain OFF; PR remains draft/unmerged pending full engineering, security and DBA acceptance.
