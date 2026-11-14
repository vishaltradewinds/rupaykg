# Tenant authentication bootstrap — disposable Neon proof — 2026-11-01

**Project:** `steep-mud-79906940`
**Child branch:** `br-blue-tooth-b4kvuut7`
**Parent production branch:** `br-restless-base-b44cip2h`
**Scope:** authentication resolver design proof on disposable branch only. No production/staging SQL, role, grant, policy, or deployment changes.

## Problem

The current `authenticate()` function performs direct reads from:
- `identity_sessions`
- `identities`
- `organization_memberships`

Once these tables are protected by RLS, the runtime role cannot resolve an incoming bearer token before it has an identity context. This creates an authentication bootstrap problem.

## Disposable design tested

Created a dedicated function-owner role:
- `rupaykg_auth_lab_owner_20261101`
- NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, NOINHERIT.
- Not a table owner and not available to the runtime role for SET ROLE.

Enabled and forced RLS on the three authentication tables in the child branch. Granted the auth function owner SELECT on those tables and created SELECT policies scoped only to that NOLOGIN owner role.

Created `auth_lab.resolve_session(token_hash)`:
- SQL SECURITY DEFINER.
- Fixed `search_path = pg_catalog, pg_temp`.
- Fully schema-qualified table references.
- Returns only identity ID and VERIFIED organization/role memberships.
- Checks token hash, session revocation, expiry, identity VERIFIED status, and identity suspension.
- Does not return token hashes, email, display name, password credentials, or session metadata.
- Function owner is the dedicated NOLOGIN/NOBYPASSRLS role.
- PUBLIC execution revoked; EXECUTE granted only to the lab runtime role.

## Synthetic acceptance results

- A valid session returned exactly two VERIFIED organization memberships for a synthetic multi-organization identity.
- A revoked session returned zero rows.
- An expired session returned zero rows.
- After one synthetic membership was revoked using canonical `REJECTED + last_revoked_at + last_revoked_by_identity_id + last_revocation_reason`, the next resolver call returned only the remaining VERIFIED membership.
- Runtime role could execute the resolver but could not SELECT directly from `identity_sessions`, `identities`, or `organization_memberships`.
- Runtime role could not assume the auth function-owner role.
- Auth function owner had `rolbypassrls=false`, `rolcanlogin=false`, and the function was confirmed `SECURITY DEFINER` with that owner.

**Result:** the authentication bootstrap pattern works in a disposable Neon branch with FORCE RLS and a non-bypass function owner.

## Important limits

- This was a branch-local SQL proof with synthetic identities, organizations, roles, memberships, and sessions.
- It does not change the current application `authenticate()` implementation.
- It does not prove password login, session issuance/revocation routes, refresh/logout, rate limiting, or credential reset flows under RLS.
- It does not solve platform-admin/regulator/worker authority.
- The production runtime role separation, function grants, and policy rollout remain unimplemented.
- The fixed-search-path SECURITY DEFINER function still requires independent security review, SQL injection tests, execution-cost limits, and exact least-privilege grants before production use.

## Next engineering actions

1. Extract a production migration design for the resolver and its role/policy grants.
2. Replace the two direct auth reads in `authenticate()` with one typed resolver call.
3. Preserve active-organization header validation in application code after receiving verified memberships.
4. Add tests for invalid token, malformed token, suspended identity, expired/revoked session, pending/revoked membership, multi-organization selection, and concurrent revocation.
5. Implement login/session creation and revocation functions with least-privilege grants before enabling RLS on auth tables.
6. Verify all auth and request-context SQL uses the same request transaction/client.
7. Run all tests against a fresh disposable Neon branch before any production change.

Post-test read-only verification on the production parent confirmed branch ID `br-restless-base-b44cip2h`, 67 public tables, 0 RLS-enabled tables, 0 lab roles, and 0 lab schemas. The auth lab remained branch-local.

Production remains HOLD. This proof is not a production authorization or TRL 9 claim.
