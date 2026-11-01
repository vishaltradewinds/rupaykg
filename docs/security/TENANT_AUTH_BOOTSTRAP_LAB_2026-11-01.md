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


## Application-aligned resolver name proof — 2026-11-01

To validate the exact schema and function referenced by PR #192, the same disposable child branch received a second resolver at `auth_private.resolve_session(text)` (the earlier `auth_lab` proof remains unchanged).

- Function owner: `rupaykg_auth_lab_owner_20261101`, NOLOGIN and NOBYPASSRLS.
- Runtime role: `rupaykg_rls_lab_app_20261101`, LOGIN and NOBYPASSRLS.
- Function is SECURITY DEFINER with fixed `search_path = pg_catalog, pg_temp` and fully schema-qualified source tables.
- PUBLIC execution revoked; EXECUTE granted to the runtime role.
- FORCE RLS remains enabled on the three auth tables, with SELECT policies restricted to the function owner.
- Runtime-role acceptance passed for the expected currently VERIFIED membership.
- Revoked and expired session tokens returned zero rows.
- Runtime role was denied direct SELECT on all three source tables: `identity_sessions`, `identities`, and `organization_memberships`.
- Runtime role could not assume the function-owner role.
- Catalog verification confirmed SECURITY DEFINER, NOLOGIN, NOBYPASSRLS, and the expected function owner.

This confirms the application query contract in PR #192 against a disposable Neon branch. It does not install the function in production, provision production credentials, or validate all password/session lifecycle operations. The function schema and role grants still require a separately reviewed production migration and least-privilege cutover.


## Extended auth lifecycle and two-runtime-role proof — 2026-11-01

On the same disposable Neon child branch, an extended prototype was tested with FORCE RLS on `identities`, `identity_sessions`, `organization_memberships`, and `identity_password_credentials`.

### Tested SECURITY DEFINER functions

- `auth_private.find_login_candidate(email)`: returns the matching identity and scrypt credential candidate for application-side password verification.
- `auth_private.record_login_failure(identity_id)`: increments failed attempts and sets a 15-minute lock at ten failures.
- `auth_private.reset_login_failures(identity_id)`: clears counters after successful verification.
- `auth_private.issue_session(identity_id, token_hash, request_context)`: issues an eight-hour session only for an active, non-suspended identity.
- `auth_private.revoke_session(token_hash)`: revokes an active session.
- `auth_private.register_identity(email, display_name, password_hash, salt)`: atomically creates an identity and scrypt credential; no plaintext password enters PostgreSQL.
- `auth_private.get_self_account_context(token_hash)`: resolves a live bearer session and returns that identity's profile, membership lifecycle records, and stakeholder applications as JSONB. A revoked session returns no context.

### Additional data-integrity finding

- Production aggregate preflight returned **0 duplicate case-insensitive email groups** and **0 excess duplicate identity rows**.
- The existing `identities_email_idx` is a non-unique index on `lower(email)`; it does not prevent concurrent duplicate registrations.
- A unique partial index on `lower(email)` was tested successfully on the disposable branch after a zero-duplicate preflight. A production migration still needs a fresh duplicate preflight immediately before index creation.

### Two-role separation

- Application runtime role: `rupaykg_rls_lab_app_20261101`. It can execute only the session resolver; it cannot read password candidates, register identities, or issue/revoke sessions.
- Authentication runtime principal: `rupaykg_auth_lab_runtime_20261101` (NOLOGIN in the lab, simulated using `SET ROLE`). It can execute the narrowly scoped authentication functions but has no direct SELECT on password credentials and cannot assume the function-owner role.
- Both runtime principals are NOBYPASSRLS and are not members of the function-owner role.
- The auth function owner remains NOLOGIN/NOBYPASSRLS and is the only principal with underlying auth-table grants/policies.

### Acceptance results

- Login candidate lookup returned the synthetic identity's scrypt hash and salt through the auth function.
- Ten failed-attempt increments triggered the 15-minute lockout; reset cleared the counter and lock.
- Session issue created an eight-hour session; resolver accepted it; revocation caused subsequent resolver calls to return no rows.
- Registration created the identity and credential atomically; duplicate email registration failed through the tested unique index.
- Self-account context preserved both VERIFIED and REJECTED membership lifecycle states while returning only the currently valid session identity.
- Application runtime could not execute credential/session lifecycle functions.
- Authentication runtime could execute those functions but could not directly SELECT the credential table or assume the function owner.

### Limits and next requirements

- This is branch-local synthetic acceptance. No production role, grants, RLS, index, function, or application secret was changed.
- The auth runtime role was NOLOGIN in this test; actual production login credential provisioning and separate connection-pool verification remain outstanding.
- Application-side integration of the auth pool and functions is not yet complete.
- Stakeholder onboarding mutations, platform-admin dual-control actions, worker/CLI access, and all remaining auth-table access paths still need explicit handling before production auth-table RLS.
