# Application runtime compatibility inventory — auth-protected tables

**Inspection:** 2026-11-01, static source scan of the current authentication integration branch.  
**Target roles:** `rupaykg_app_runtime` and `rupaykg_auth_runtime`.  
**Status:** engineering inventory; no grants or application runtime credentials were changed.

## Critical finding

The proposed least-privilege contract denies `rupaykg_app_runtime` direct access to `identities`, `identity_sessions`, `identity_password_credentials`, and `organization_memberships`. Authentication itself now has a SECURITY DEFINER resolver path, but many business, onboarding, geography, device, and platform-admin handlers still issue direct SQL against these protected tables.

Therefore, the auth runtime split is **not yet compatible with the whole API**. Do not provision the proposed app runtime role or switch production connections until each listed path has been moved to a reviewed function or otherwise proven compatible.

## Static scan summary

The following counts are source lines containing protected-table references, not counts of executed SQL statements. Multiple SQL statements may appear on one minified line; comments/type references may also match.

| Module | Lines with protected-table references | Primary remaining work |
|---|---:|---|
| `server.ts` | 19 | Geography roots directly joins memberships/scopes; overview count queries join memberships |
| `auth.ts` | 7 | Legacy fallback and permission/evidence fallback remain; production resolver path avoids them when mode is explicit |
| `auth-routes.ts` | 3 | Onboarding create/withdraw directly inserts/updates memberships, roles, organizations, geography scopes and applications |
| `onboarding-hierarchy-routes.ts` | 4 | Review queue, authority checks, legal verification, approvals/rejections directly read/write memberships and identities |
| `value-routes.ts` | 5 | Activity and geography authorization directly reads memberships/scopes |
| `registry-routes.ts` | 1 | Credential transfer checks destination membership directly |
| `sync-routes.ts` | 5 | Device enrollment, inventory, activity and geography checks directly read memberships |
| `workspace-routes.ts` | 1 | Workspace geography check directly reads memberships |
| `bwg-routes.ts` | 0 | No matching protected-table references in this scan |
| `cpcb-swm-routes.ts` | 2 | CPCB workspace writes directly query memberships/geography scope |
| `intelligence-routes.ts` | 1 | Intelligence authorization directly queries memberships |
| `mrv-routes.ts` | 1 | MRV authorization directly queries memberships |
| `evidence-vault-routes.ts` | 0 | No matching protected-table references in this scan; uses shared permission helpers |
| `platform-admin-routes.ts` | 62 | Admin overview, suspension/session revocation, membership grants/restoration and role governance remain direct-table workflows |

The inventory is intentionally wider than password/session tables: membership, role, organization and onboarding state form the authorization control plane. A role that cannot read memberships cannot safely support direct route queries that rely on them.

## Ordered remediation plan

1. **Keep the auth bootstrap narrow:** `authenticate()` in `security_definer` mode must call `auth_private.resolve_session($1)` exactly once; resolver failure must never fall back to direct table reads. This path is implemented and has exact-head CI coverage.
2. **Onboarding functions:** implement session-token-bound functions for application create, read-self and withdraw. The database function must derive identity from the token, validate role keys and organization type, create the pending organization/role/membership/scope/evidence/application atomically, and never activate membership before the approval chain completes.
3. **Onboarding review functions:** move queue filtering, legal verification, hierarchical approval/rejection, and membership activation/revocation behind authority-bound functions. Recheck current reviewer authority and jurisdiction inside the function and enforce separation of duties.
4. **Platform admin functions:** replace all direct identity/session/membership/role mutations and projections with reviewed functions. Preserve dual-control reserved-role rules and atomic session revocation.
5. **Operational authorization functions:** finish function coverage for geography, activity, device, workspace, CPCB, MRV, intelligence, evidence and registry paths. Ensure active organization is an explicit input where the route requires it; avoid “any membership” checks for scoped actions.
6. **Application data grants:** separately build a table-by-table app runtime SELECT/INSERT/UPDATE/DELETE matrix from the 67-table access classification. The auth lab app role has no general business-table privileges; passing the auth startup checks alone does not make the API operational.
7. **Request transaction context:** integrate the AsyncLocalStorage/savepoint adapter across all route SQL, test concurrent requests and pool reuse, and then introduce RLS in table groups only after the above gates pass.
8. **Workers and CLI:** inventory scheduled/async/edge processes independently; each needs a distinct service identity and narrowly scoped database functions/grants.

## Release gate

- Auth resolver implementation: code path and unit tests present.
- Full API compatibility with least-privilege roles: **NOT PASSED**.
- Onboarding direct-write conversion: **NOT IMPLEMENTED**.
- Platform-admin conversion: **NOT IMPLEMENTED**.
- Complete app data grant matrix: **NOT IMPLEMENTED**.
- Production roles/secrets/RLS/migrations/deployment: **NOT AUTHORIZED / NOT PERFORMED**.
- Production certification: OFF; TRL 9: not established.

Do not interpret a successful TypeScript/build/acceptance CI run as proof that the live API works with the proposed least-privilege credentials. A dedicated integration environment with the exact runtime roles and grants is required.
