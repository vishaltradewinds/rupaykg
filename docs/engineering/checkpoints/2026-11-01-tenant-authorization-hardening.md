# Tenant authorization hardening checkpoint — 2026-11-01

## Scope
Two focused route authorization fixes based on the tenant-isolation review:
1. Revalidate field-device identity, VERIFIED device status and current VERIFIED organization membership for field-sync conflict listing and resolution.
2. Revalidate and lock exact organization membership + role rows inside the credential issuance transaction.

## Implementation
- `apps/src/sync-routes.ts`
  - Conflict GET joins envelope → device and checks identity binding, verified device status, current verified membership, and active organization context.
  - Conflict resolution applies the same predicates inside the UPDATE statement.
- `apps/src/auth.ts`
  - Added `lockOrganizationPermission(PoolClient,...)`, which checks the current VERIFIED membership and role permissions and takes PostgreSQL SHARE locks on both rows until transaction completion.
- `apps/src/registry-routes.ts`
  - Removed the pre-transaction issuance permission check.
  - Calls `lockOrganizationPermission` immediately inside the issuance transaction before evidence/verification locks and credential creation.
- `apps/src/tenant-authorization-hardening.test.ts`
  - PostgreSQL integration test proves membership revocation blocks while the permission lock is held, then later authorization observes revocation.
  - PostgreSQL integration test proves field-sync conflicts cannot be read/resolved after membership revocation or device de-verification.

## Pull request and CI
- Draft PR #181: https://github.com/vishaltradewinds/rupaykg/pull/181
- Branch: `security/tenant-revocation-and-issuance-atomicity-2026-11-01`
- Head: `bbeaabdcb95ed52713c820d4797885c7ee16914f`
- CI run: `41282033478`, started and still in progress at checkpoint time.

## Scope and safety
- Code/tests only on feature branch.
- No database migration, production/staging SQL, role, grant, RLS, secret, Render config or deployment changes.
- The integration tests use `DATABASE_URL` and return without executing when it is not configured; CI's disposable PostgreSQL step is required evidence.
- The permission lock protects membership/role changes after the lock is acquired. It does not by itself solve all tenant isolation, session revocation, RLS, cross-tenant business data, or platform control-plane issues.
- PR remains draft/unmerged pending exact-head CI and review.
