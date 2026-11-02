# RupayKg — tenant transaction-boundary route coverage audit

Date: 2026-11-03  
Scope: static source inspection of PR #216 head branch, plus read-only production catalog check.  
Status: engineering inventory; no source/runtime/production behavior changed by this audit.

## Executive finding

The signed transaction boundary exists in apps/src/rls-request-transaction.ts, but adoption is incomplete. A first-pass scan of 16 route/auth modules found explicit withRlsRequestTransaction import/use only in:

- apps/src/mrv-routes.ts
- apps/src/epr-return-read-route.ts

The other 14 scanned modules did not import/use that wrapper. This is a static scan, not proof that every query in those modules is tenant-sensitive; route-by-route classification is still required. The server entrypoint apps/src/server.ts also contains direct pool.query calls and direct tenant/business writes outside the wrapper.

RLS must remain disabled until all tenant-data access paths are either migrated to the signed boundary or explicitly classified as auth/platform/global service operations with a separately tested security contract.

## Module-level first-pass scan

| Module | Wrapper import/use | Direct pool/query evidence | Initial disposition |
|---|---|---|---|
| auth.ts | no | direct pool queries | Auth resolver path; keep separate auth contract, review every query and ensure no broad auth-table reads from app runtime. |
| auth-routes.ts | no | database calls through supplied pool parameters | Auth lifecycle; must use AUTH_DATABASE_URL/auth runtime or narrowly scoped auth_private functions only. |
| onboarding-hierarchy-routes.ts | no | query calls through supplied clients | Onboarding/platform workflow; define explicit applicant and platform-review authorization, do not assume ordinary tenant scope. |
| value-routes.ts | no | 34 direct pool/query lines in static scan | Tenant business route; migrate tenant reads/writes to signed transaction boundary. |
| registry-routes.ts | no | 11 direct pool/query lines | Tenant and multi-party registry; design issuer/holder/owner-specific context before migration. |
| sync-routes.ts | no | 11 direct pool/query lines | Tenant/device/queue operations; separate app request and worker/device capabilities. |
| workspace-routes.ts | no | 13 direct pool/query lines | Tenant workspace data; migrate tenant operations. |
| bwg-routes.ts | no | direct pool/query line(s) | Tenant reporting data; parent organization via reporting periods and evidence. |
| cpcb-swm-routes.ts | no | 15 direct pool/query lines | Tenant and authority workspace data; separate organization and regulator authority scope. |
| intelligence-routes.ts | no | direct pool/query lines | Classify each endpoint as global reference or tenant-derived analytics; no unrestricted aggregate leakage. |
| mrv-routes.ts | yes | 13 direct pool/query lines remain | Partial adoption only; audit every handler and query, do not treat module import as full migration. |
| evidence-vault-routes.ts | no | 21 direct pool/query lines | Tenant/evidence access; migrate with activity/evidence parent consistency and reviewer scope. |
| platform-admin-routes.ts | no | 24 direct pool/query lines | Platform-authority workflow; needs a separate narrowly scoped signed authority context, not a bypass around RLS. |
| epr-return-read-route.ts | yes | 3 wrapper mentions; helper query present | Candidate scoped route; verify all queries execute inside wrapper and feature remains OFF until RLS gates pass. |
| epr-return-routes.ts | no | 28 direct pool/query lines | EPR tenant and bilateral paths; migrate only after multi-party authorization model is defined. |
| statutory-routes.ts | no | 10 direct pool/query lines | Tenant statutory profiles plus global regulatory reference; split data classes and migrate tenant paths. |

The counts above are source-line pattern indicators, not precise SQL statement counts. They are useful for prioritization, not a complete query inventory.

## Additional server entrypoint observations

apps/src/server.ts itself:
- creates separate DATABASE_URL and AUTH_DATABASE_URL pools;
- asserts production app runtime is rupaykg_app_runtime and auth runtime is rupaykg_auth_runtime;
- rejects BYPASSRLS, owner membership and direct auth table access;
- has direct pool queries and writes in root-registered routes and geography/resource-flow/measurement endpoints;
- contains legacy authorization helpers using organization_memberships and organization_has_geography_scope;
- does not universally wrap these root-level tenant queries in withRlsRequestTransaction.

The production startup checks are useful fail-closed controls, but they do not make an unwrapped query safe under RLS. A NOBYPASSRLS role with missing signed context will correctly see no rows or fail writes; every relevant endpoint must be migrated before enabling policies.

## MRV worker schema-contract mismatch

apps/src/mrv-worker-server.ts requires the following tables: organizations, identities, organization_memberships, roles, activities, evidence, verifications, geography, mrv_submission_jobs, mrv_submission_job_events and mrv_provenance_events.

A read-only production catalog check confirmed:
- mrv_provenance_events exists.
- mrv_submission_jobs does NOT exist.
- mrv_submission_job_events does NOT exist.

Therefore the current MRV worker startup contract cannot be satisfied by the inspected production schema as it stands. Worker enablement remains OFF. Before any worker activation, reconcile migrations/schema history and add the missing durable job tables in a reviewed candidate migration, then test queue claims, retries, idempotency, lease expiry, dead-letter behavior, tenant isolation, event append-only semantics and worker role grants in disposable PostgreSQL.

The worker startup also requires FORCE RLS on all 11 listed tables and EXECUTE on public.organization_has_geography_scope(uuid,uuid). These requirements must be included in the exact worker role rehearsal; do not infer that app runtime grants are sufficient.

## Prioritized route reconciliation

1. Enumerate every endpoint and SQL statement in server.ts and the route modules above. Tag each as tenant, bilateral, identity/auth, platform-authority, global reference, append-only audit, or worker queue.
2. For tenant routes, derive organization only from verified AuthContext and signed request context; never trust body/header organization IDs without membership and permission checks.
3. Migrate each tenant unit of work to withRlsRequestTransaction. Do not wrap only one query while related authorization or writes remain on a different pool/client.
4. For bilateral routes, design explicit multi-party signed context and per-party SELECT/INSERT/UPDATE policies. The current wrapper intentionally rejects bilateralOrganizationScope; do not weaken that guard.
5. For auth routes, enforce dedicated auth runtime and auth_private contract; keep credentials/sessions inaccessible to app runtime.
6. For platform admin/onboarding, require verified platform authority and dedicated narrow capability; no broad RLS bypass role.
7. For workers, use the exact runtime name rupaykg_mrv_worker_runtime, reconcile missing production job tables, and prove worker scope under FORCE RLS.
8. Add route-level tests for tenant A/tenant B, missing context, forged context, membership revocation, cross-tenant parent IDs, bilateral party visibility and unauthorized mutations.
9. Only after all routes and worker jobs are covered, run full two-tenant acceptance with actual NOBYPASSRLS runtime credentials.

## Release decision

NO-GO for production RLS activation and MRV worker activation. The wrapper adoption scan shows incomplete coverage, and two worker job tables are absent in production. No production schema, role, ACL, feature flag, worker or deployment was changed. PR #216 remains a draft engineering candidate; TRL 9 is not established.
