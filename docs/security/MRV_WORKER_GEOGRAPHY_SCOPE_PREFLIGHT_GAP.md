# MRV Worker Geography-Scope Preflight Gap

Status: BLOCKER — source finding only; no production change.

## Finding

The migration `012_geography_authorization.sql` creates:

- `public.geography`
- `public.organization_geography_scopes`
- `public.organization_has_geography_scope(uuid, uuid)`

The helper reads both tables. The restricted worker server's current `requiredTables` array includes `geography` but omits `organization_geography_scopes`. Its RLS/FORCE RLS preflight therefore does not cover every table read by the live geography authorization helper.

## Required correction

1. Add `organization_geography_scopes` to `requiredTables` in `apps/src/mrv-worker-server-restricted.ts`.
2. Include it in the API-owner's minimum SELECT privilege and exact RLS policy design.
3. Verify RLS and FORCE RLS from `pg_class` for this relation.
4. Add disposable PostgreSQL tests for a verified organization scope, descendant geography, unrelated geography, missing scope, revoked scope and cross-tenant identifiers.
5. Ensure the helper's execution identity and RLS behavior are proven under the actual SECURITY DEFINER call chain.

The API owner must not receive unrestricted application access as a shortcut. The helper's function ACL, owner, search_path and table access must be reviewed together with the eight worker functions.

## Release effect

Until the preflight list and acceptance matrix include this table, worker readiness must remain blocked. This is not a live Neon finding; it is a gap in the checked-in preflight source. No role, grant, RLS policy, migration or production setting was changed by this note.
