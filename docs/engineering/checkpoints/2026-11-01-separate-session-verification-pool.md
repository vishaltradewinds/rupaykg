# Separate Session Verification Pool — 2026-11-01

## Status: IMPLEMENTATION SUBMITTED AS DRAFT PR — CI/REVIEW PENDING

Pull request: https://github.com/vishaltradewinds/rupaykg/pull/202

Working branch: security/separate-authentication-pool-2026-11-01

No production deployment, secret change, or production database mutation was made.

## Implemented on the branch

- authenticate(request, sessionPool, membershipPool) now verifies opaque sessions through a dedicated restricted database function and performs verified-membership lookup on the operational pool.
- Separate session-pool propagation covers onboarding, value, field sync, workspaces, registry/settlement, BWG/EPR, CPCB/SWM, intelligence, MRV/statutory, evidence vault and platform admin route groups.
- AUTH_DATABASE_URL is required by production config, must target the same PostgreSQL host/database as DATABASE_URL, and must use a different login.
- Production server explicitly propagates the validated auth URL.
- Startup contract rejects auth logins with superuser, CREATEDB, CREATEROLE, REPLICATION or BYPASSRLS, inherited elevated roles, public table SELECT, public-schema CREATE, or missing verifier execution.
- Migration 20261101_auth_session_verification_function.sql creates a restricted SECURITY DEFINER verifier. Its non-login owner has BYPASSRLS only to bypass future RLS on the two identity/session tables, SELECT only on those two tables, and no login/DDL/role/database privileges. The API login receives EXECUTE only through rupaykg_auth.
- Unit tests cover split pools, invalid sessions, elevated roles, direct table access, schema CREATE and verifier execution.
- Migration and DBA provisioning instructions are recorded in migrations/README.md.

## Remaining gates

1. Exact-head CI for PR #202 must pass, including migration validation, TypeScript build, tests and disposable PostgreSQL acceptance.
2. Inspect actual migration execution in a disposable Neon/PostgreSQL branch. Verify the migration runner can create roles and transfer function ownership, and prove the function's grants and SECURITY DEFINER owner.
3. Provision a dedicated LOGIN role out of band, grant membership in rupaykg_auth, set its password in the secret manager, and verify the startup contract against the actual login. No secret was created or deployed.
4. Independently review the SECURITY DEFINER function, owner role and inherited-privilege checks.
5. Operational route queries still use the operational pool directly. The app-wide transaction-scoped RLS migration is a separate gate.
6. The production operational login remains unverified for NOBYPASSRLS. All 67 production public tables and indirect trigger/worker paths remain part of the RLS release audit.
7. Keep PR #202 draft and production RLS release HOLD until the above gates and independent review are complete.

## Safety

Only the GitHub branch and draft PR changed. Production schema, roles, data, credentials, environment variables and deployments remain unchanged. Neon production remains the single authoritative database.
