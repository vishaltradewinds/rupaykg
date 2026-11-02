# RupayKg — callable function authorization review (production catalog)

Date: 2026-11-03  
Scope: read-only inspection of Neon production project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`, plus source inventory on PR #216 branch.  
Status: security engineering findings; **no production writes, grants, revocations, or migrations**.

## Executive finding

The 11 ordinary application-owned public functions identified in the function privilege inventory are all currently owned by the elevated `rupaykg` role, are `SECURITY INVOKER`, have no pinned `search_path` in the production catalog at audit time, and retain `PUBLIC EXECUTE`. The candidate search-path migration and trigger-only PUBLIC EXECUTE revocation have passed CI on the PR branch, but have not been applied to production.

The next safe action is **not** to blanket-revoke the 11 callable functions. Several are still used by application routes or by trigger functions; runtime roles do not yet exist in production. First provision and test the exact role model in disposable PostgreSQL, move callers behind the tenant transaction boundary, then apply explicit per-signature grants and revoke PUBLIC only after positive and negative tests pass.

## Production catalog observations

All 11 functions returned `prosecdef = false` (`SECURITY INVOKER`), owner `rupaykg`, `proconfig = NULL`, and PUBLIC EXECUTE = true at the time of the read-only query.

| Function | Observed direct/nested use | Security consequence / decision |
|---|---|---|
| `allocate_environmental_attribute_claim(uuid,uuid,text,text,text,numeric,text,text,text,uuid,uuid,uuid,jsonb)` | Called by trigger function `record_epr_credit_value_claim()`; calls `assert_environmental_attribute_available(text,text)` | Invoker function inserts an environmental claim using caller-supplied organization/activity/evidence/verification IDs. No explicit actor/tenant permission check appears in its body. Must not become a generally callable app API. Reconcile trigger execution identity, table grants, activity/evidence tenant binding, and claim authorization before narrowing EXECUTE. |
| `assert_environmental_attribute_available(text,text)` | Nested call from allocation function | Internal helper; keep callable only by the exact role required by the allocation path. Advisory lock and duplicate-basis check are integrity controls, not actor authorization. |
| `allocate_epr_credit(uuid,uuid,numeric)` | No TypeScript call or application-function dependency found in reviewed inventory | Invoker function locks and mutates credit/allocation/obligation rows; body contains no explicit identity or tenant authorization. Treat as HIGH RISK dormant surface. Verify operations, SQL scripts, scheduled jobs and external clients; then either remove through reviewed forward migration or grant only to a narrow service role after authorization is implemented. |
| `release_epr_credit_allocation(uuid)` | No TypeScript call or application-function dependency found in reviewed inventory | Invoker function changes allocation and obligation state; body contains no explicit identity or tenant authorization. Same dormant-surface handling as allocation; do not grant to general app runtime. |
| `can_assess_epr(uuid,uuid)` | TypeScript call in `apps/src/value-routes.ts` | Reads verified membership but accepts role-name aliases as authority. Route should migrate to explicit permission check in signed tenant transaction; then grant EXECUTE to app runtime only. |
| `can_manage_field_device(uuid,uuid)` | TypeScript call in `apps/src/sync-routes.ts` | Reads verified membership but accepts role-name aliases as authority. Replace/verify against explicit field-device permission and signed tenant transaction before granting app runtime. |
| `can_write_esg(uuid,uuid)` | TypeScript call in `apps/src/value-routes.ts` | Reads verified membership but accepts role-name aliases as authority. Replace/verify against explicit ESG permission and signed tenant transaction before granting app runtime. |
| `has_verification_permission(uuid)` | No direct TypeScript call or other application-function dependency found | Legacy helper; verify operational consumers. Do not grant to general runtime unless a live route requires it; use the hardened activity-bound verifier authorization path instead. |
| `identity_has_permission(uuid,text,text[])` | Nested in `enforce_registry_event_permission()` and `enforce_settlement_event_permission()` trigger functions | Trigger DML callers need the nested invoker function to remain executable under the actual DML role unless trigger execution design changes. Its role-name fallback is a policy concern; replace with explicit permission semantics before broad runtime exposure. |
| `organization_has_geography_scope(uuid,uuid)` | TypeScript calls in auth, EPR return, evidence vault, value, sync, CPCB SWM, statutory and MRV routes; nested in three geography enforcement trigger functions | Shared critical helper. Must remain executable by the app runtime and DML role used by relevant trigger paths, but only after tenant-context and RLS tests. Current production implementation treats organizations with no VERIFIED geography scopes as unrestricted; this is a separate policy decision requiring explicit review before broadening enforcement. |
| `rupaykg_default_role_permissions(text)` | Nested in `apply_rupaykg_role_defaults()` trigger function | Role-default helper, not a public app API. Trigger DML caller must retain only the execution path required for controlled role/onboarding writes. |

## Verified nested function call graph

Read-only scan of production `pg_proc.prosrc` found these direct nested references:

- `record_epr_credit_value_claim()` → `allocate_environmental_attribute_claim(...)`
- `allocate_environmental_attribute_claim(...)` → `assert_environmental_attribute_available(...)`
- `enforce_registry_event_permission()` → `identity_has_permission(...)`
- `enforce_settlement_event_permission()` → `identity_has_permission(...)`
- `enforce_activity_geography_scope()`, `enforce_epr_external_registration_evidence()`, and `enforce_resource_flow_geography_scope()` → `organization_has_geography_scope(...)`
- `apply_rupaykg_role_defaults()` → `rupaykg_default_role_permissions(...)`

The 11 callable functions themselves are not trigger-returning functions. They must not be included in the 20261114 trigger-only revoke set.

## Role and route prerequisites

- Production role audit previously found no `rupaykg_app_runtime`, `rupaykg_auth_runtime`, `rupaykg_app_owner`, `rupaykg_auth_owner`, `rupaykg_worker_runtime`, or `rupaykg_security_definer`; only elevated `rupaykg` was present.
- `apps/src/server.ts` expects app and auth connections to use the dedicated runtime roles and checks they are NOBYPASSRLS, non-inheriting and not members of owner roles.
- The route transaction wrapper is not yet universal; direct pool queries remain. Do not enable table RLS or remove PUBLIC EXECUTE from route-used helpers until each route uses the signed tenant transaction boundary and two-tenant tests pass.
- The MRV worker has its own role contract; do not reuse the app role for worker execution.

## Required next steps (ordered)

1. Review all SQL migrations, operational scripts, cron/scheduled jobs, integrations and external direct database clients for the 11 signatures. Static TypeScript absence is not proof of non-use.
2. Build a disposable production-shaped PostgreSQL rehearsal with the exact app/auth/worker NOLOGIN owner/runtime roles and restricted migration principal. Test role attributes, memberships, schema usage, table grants and function ACLs.
3. Replace role-name authorization in `can_assess_epr`, `can_manage_field_device`, `can_write_esg`, and `identity_has_permission` with explicit permissions and tenant/activity-bound context.
4. Add authorization and subject-tenant checks to the EPR allocation/release paths before exposing any direct app invocation. Prove trigger path semantics for `allocate_environmental_attribute_claim`.
5. Move all relevant routes to `withRlsRequestTransaction`; verify nested trigger calls under the actual NOBYPASSRLS app runtime.
6. Grant exact signatures only to the minimum role(s) demonstrated by tests. Revoke PUBLIC EXECUTE per signature only after positive business-operation and negative unauthorized-call tests pass.
7. Obtain independent DBA/security review before any production provisioning or migration.

## Release posture

- PR #216 remains DRAFT/UNMERGED; latest exact-head CI run #4964 passed on `5aa54132926404d4ff2f2bf545fd13a2a80d6269`.
- This CI result validates the candidate migration chain in disposable CI, not production deployment.
- No production DDL, role, grant, ACL, secret, RLS, worker, feature flag or deployment change was made.
- Production remains HOLD; RLS remains 0/67 tables; TRL 9 is not established.
