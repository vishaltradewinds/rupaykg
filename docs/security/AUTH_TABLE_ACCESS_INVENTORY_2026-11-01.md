# Authentication table access inventory — 2026-11-01

**Repository:** `vishaltradewinds/rupaykg`
**Source files inspected:** `apps/src/auth.ts`, `apps/src/auth-routes.ts`, `migrations/004_security_auth.sql`, `079_native_password_auth.sql`, `082_super_admin_identity_governance.sql`.
**Scope:** application auth/bootstrap paths. This is not yet a complete repository-wide reference scan; platform-admin and other route-specific membership writes still require dedicated verification.

## Direct table access inventory

| Table | Current application access | Security-definer / policy requirement |
|---|---|---|
| `identities` | Register duplicate lookup; registration INSERT; login SELECT; auth resolver SELECT; `/auth/me` profile SELECT; suspension/status checks | Dedicated registration operation; login candidate lookup; session resolver; self-profile function or verified transaction context. Do not expose password/credential columns in profile responses. |
| `identity_password_credentials` | Registration INSERT; login SELECT; failed-attempt increment/lockout UPDATE; successful-login reset UPDATE | Atomic credential create, candidate lookup, failed-attempt update and successful reset functions. Preserve scrypt parameters and lockout semantics. |
| `identity_sessions` | Authentication SELECT; login INSERT; logout UPDATE revocation | Resolver, issue-session and revoke-session functions. Token hashes only; preserve 8-hour expiry and revocation semantics. |
| `organization_memberships` | Authentication SELECT of VERIFIED memberships; login and `/auth/me` membership/role projection; onboarding PENDING INSERT; withdrawal REJECTED UPDATE; reserved-role governance trigger | Resolver returns only VERIFIED memberships. Membership onboarding and lifecycle mutations must retain existing approval/dual-control triggers. Read projections need self-scoped function or transaction-local identity context. |
| `stakeholder_applications` | Login and `/auth/me` application projections; onboarding duplicate check and INSERT; applicant self-list; withdrawal UPDATE | Identity-scoped application read/create/withdraw operations; preserve organization verification evidence and approval lifecycle. |
| `roles`, `organizations` | Joined into membership projections and onboarding creation | Keep role/organization joins constrained to verified membership or an approved application lifecycle. |

## Current behavior that must be preserved

1. Bearer tokens are 32 random bytes, base64url encoded; only SHA-256 token hashes are stored.
2. Sessions expire after eight hours and logout sets `revoked_at`.
3. Passwords use scrypt with a random salt; plaintext passwords are not stored.
4. Failed login attempts increment and lock the account for 15 minutes at ten failures; successful login resets counters.
5. Identity must be `VERIFIED` and not suspended.
6. Only VERIFIED memberships are operational memberships.
7. A multi-organization identity must explicitly select an organization through `x-rupaykg-organization-id`.
8. Settlement routes retain bilateral access to all verified memberships after an explicit active-organization selection.
9. An identity with no verified memberships can authenticate but receives no organization scope.
10. Stakeholder onboarding creates PENDING memberships; approval and reserved-role dual control must remain database-enforced.

## Dedicated authentication runtime integration delivered in PR #192

- The production server now registers `auth-routes.ts`; the previous server entrypoint did not register this route module at all.
- Adds a distinct `AUTH_DATABASE_URL` pool (max 3 connections) alongside the ordinary application pool.
- Registration, login candidate lookup, password-failure tracking, lockout reset, session issue/revoke, and self-account context now call the tested `auth_private` SECURITY DEFINER functions only.
- `/auth/me` first authenticates via the application resolver, then reads the self-scoped account projection through the auth function.
- Stakeholder onboarding remains on the application pool and retains its current lifecycle transaction; its RLS migration is still outstanding.
- Production config requires the two URLs to target the same Neon host, port, and database but use distinct database role names.
- Production startup verifies both runtime identities are distinct, neither is superuser/BYPASSRLS/CREATEDB/CREATEROLE/REPLICATION, the app role cannot access auth tables or auth lifecycle functions, the auth role cannot directly read auth tables or resolve sessions, and the expected SECURITY DEFINER functions are owned by NOLOGIN/NOBYPASSRLS `rupaykg_auth_owner`.
- In security-definer mode, `hasOrganizationPermission` now calls `auth_private.has_organization_permission(identity_id, organization_id, permissions)` instead of directly querying memberships and roles.
- Geography/activity/evidence authorization helpers now call `auth_private.organization_has_geography_scope`, `can_read_geography`, `can_write_geography`, `can_write_activity`, and `can_verify_evidence`. These are SECURITY DEFINER, owned by `rupaykg_auth_owner`, and EXECUTE is granted only to `rupaykg_app_runtime`.
- Readiness now checks both database pools.

## Application integration delivered in PR #192

- Adds opt-in `RUPAYKG_AUTH_RESOLVER_MODE=security_definer`.
- Uses one call to `auth_private.resolve_session($1)` for session validation and membership resolution.
- The resolver path has no fallback to direct auth-table SELECTs on missing function, permission error, or database failure.
- Default mode remains `legacy`; production behavior does not change.
- Unit tests cover hash binding, no-session results, no-membership identities, multi-organization selection, bilateral settlement semantics, resolver errors, inconsistent resolver output, and invalid configuration.

## Remaining application authorization paths

- The core `hasOrganizationPermission` helper is now function-backed in security-definer mode.
- Remaining direct auth-table reads/writes are concentrated in platform-admin routes, stakeholder onboarding mutations, plus route-specific queries outside the shared authorization helpers. These must be moved to narrow identity-bound functions before the app runtime can be deployed with no auth-table privileges.

## Blocking requirements before auth-table RLS

The session resolver is only one part of the bootstrap. Do not enable RLS on auth tables until all of these are implemented and independently tested:

1. Password candidate lookup and lockout-safe credential verification.
2. Failed-attempt and successful-login counter mutations.
3. Atomic identity + password credential registration.
4. Session issue and revocation.
5. Identity profile and membership/application projections for `/auth/me`.
6. Self-scoped stakeholder application list/create/withdraw.
7. Platform-admin and reserved-role dual-control operations.
8. Non-HTTP worker, CLI, and scheduled-job access.
9. Explicit runtime role that cannot BYPASSRLS, assume owner roles, or read raw authentication tables.
10. A migration identity separate from the runtime role, with audited grant boundaries.

## Registration uniqueness finding

- The authoritative production Neon branch was checked using aggregate-only SQL: **0 duplicate case-insensitive email groups** and **0 excess duplicate identity rows** at audit time.
- Existing `identities_email_idx` is non-unique. It accelerates lookup but does not prevent concurrent duplicate email registration.
- A unique partial index on `lower(email)` was successfully tested on the disposable branch after a zero-duplicate preflight. A production migration must repeat the preflight immediately before creating the index.

## Rollout decision

- Production auth resolver mode remains `legacy`.
- `auth_private.resolve_session(text)` is not yet installed in production.
- No auth-table RLS is enabled.
- Do not enable `security_definer` mode until its exact migration has passed disposable Neon acceptance under the intended runtime role.
- Do not enable auth-table RLS until every operation above is migrated and tested.
- Production certification remains OFF / HOLD.
