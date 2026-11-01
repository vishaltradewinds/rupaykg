# Separate Session Verification Pool — 2026-11-01

## Status: INCOMPLETE — NOT REVIEW READY

Working branch: `security/separate-authentication-pool-2026-11-01`

This is an isolated implementation experiment. No pull request was opened and no production deployment or database change was made.

## Implemented on the work branch

- `authenticate(request, sessionPool, membershipPool)` separates opaque-session lookup from membership lookup.
- Initial propagation of the separate session pool exists in onboarding, value, field-sync, intelligence and MRV route registration.
- The server creates a dedicated pool from `AUTH_DATABASE_URL` and rejects production startup when it is absent.
- Production config draft requires the auth URL to target the same PostgreSQL host/database as the authoritative `DATABASE_URL`, but use a different database role.

## Blocking gaps before CI / PR

1. The MRV-to-statutory nested route registration currently passes a third argument to a two-argument function. This must be resolved before the branch can compile.
2. Workspace, registry/settlement, BWG/CPCB, statutory, evidence-vault and platform-admin routes have not all been migrated to the separate session pool.
3. `auth-routes.ts` still needs explicit separation for authenticated `/auth/me` and onboarding reads. Login/session writes remain on the operational pool pending a narrower database interface.
4. The separate database login's grants and role attributes have not been verified. The auth login must be least-privilege and must not have `BYPASSRLS`, superuser, DDL or role-management privileges.
5. Session verification under FORCE RLS needs a protected database function or a specifically reviewed policy design. This code alone does not make identity/session tables safe under RLS.
6. Tests are required for split-pool routing, invalid sessions, membership lookup, production config validation and route coverage.
7. Exact-head CI has not been run for this branch.

## Required next gates

- Complete propagation across every route and nested registration.
- Introduce and test the least-privilege database authentication contract; verify actual grants on the authoritative Neon database without changing production.
- Prove session verification, membership scoping, pool isolation and RLS behavior in a disposable PostgreSQL/Neon environment.
- Run full CI and independent review.
- Only then consider a production configuration rollout.

## Safety

No production database schema, roles, credentials, data or deployments were changed. The existing authoritative Neon database remains unchanged. Production RLS release remains HOLD.
