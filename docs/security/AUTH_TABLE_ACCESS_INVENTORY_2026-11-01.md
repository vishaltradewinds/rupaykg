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

## Application integration delivered in PR #192

- Adds opt-in `RUPAYKG_AUTH_RESOLVER_MODE=security_definer`.
- Uses one call to `auth_private.resolve_session($1)` for session validation and membership resolution.
- The resolver path has no fallback to direct auth-table SELECTs on missing function, permission error, or database failure.
- Default mode remains `legacy`; production behavior does not change.
- Unit tests cover hash binding, no-session results, no-membership identities, multi-organization selection, bilateral settlement semantics, resolver errors, inconsistent resolver output, and invalid configuration.

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

## Rollout decision

- Production auth resolver mode remains `legacy`.
- `auth_private.resolve_session(text)` is not yet installed in production.
- No auth-table RLS is enabled.
- Do not enable `security_definer` mode until its exact migration has passed disposable Neon acceptance under the intended runtime role.
- Do not enable auth-table RLS until every operation above is migrated and tested.
- Production certification remains OFF / HOLD.
