# 2026-10-31 16:49 UTC — authoritative production tenant baseline observation

Read-only query against Neon production primary `steep-mud-79906940 / br-restless-base-b44cip2h / rupaykg` returned:
- organizations: 0
- organization_memberships: 0
- roles: 0
- organization_geography_scopes: 0
- identities: 0
- active, unrevoked, unexpired identity sessions: 0

This means no tenant/member identity population currently exists in the authoritative production database snapshot. It is not evidence that the full application or external integrations are live. Production remains HOLD; no production writes were performed.

Security design observation:
- `organization_has_geography_scope(uuid,uuid)` currently returns true when an organization has no VERIFIED geography scopes. This is permissive-by-default behavior.
- The BWG integration fixture now tests out-of-scope denial only after inserting a distinct verified scope, so it tests the helper's actual scoped behavior without false assumptions.
- Do not change the helper or introduce a fail-closed migration blindly. First inventory every caller, current authorization contract, expected onboarding flow, and backward-compatibility implications; then design a staged enforcement migration with explicit scope onboarding and acceptance coverage.
