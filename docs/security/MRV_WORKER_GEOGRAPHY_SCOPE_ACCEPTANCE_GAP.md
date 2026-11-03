# MRV Worker Geography-Scope Acceptance Gap

Status: BLOCKER — source reconciliation only.

The repository's current live authorization helper `public.organization_has_geography_scope(uuid, uuid)` reads both `public.geography` and `public.organization_geography_scopes` (migration `012_geography_authorization.sql`).

The checked-in restricted-worker gates initially omitted `organization_geography_scopes`:

1. `apps/src/mrv-worker-server-restricted.ts` — `requiredTables` checks RLS and FORCE RLS on 13 relations but does not include `organization_geography_scopes`.
2. `tests/postgres/mrv-worker-api-boundary.acceptance.sql` — `required_tables` initially omitted `organization_geography_scopes`; this acceptance list has now been corrected and the same gate now checks the reconciled claim index predicate.

The preflight and acceptance gate can therefore pass while the geography helper's underlying scope relation is not protected by RLS/FORCE RLS. This is a fail-open coverage gap in the gate, not proof that the live database has or lacks a particular policy.

## Required source correction

- Add `organization_geography_scopes` to both lists (14 protected relations total).
- Include the relation in the function-owner minimum SELECT privilege and RLS policy review.
- Extend disposable PostgreSQL tests for verified scope roots, descendant geography, unrelated geography, missing/disabled scope, and cross-tenant organization/geography combinations.
- Verify the helper's effective execution identity, function ACL and search_path through the complete SECURITY DEFINER call chain.

No attempt is made here to create grants, RLS policies or a function-owner bypass. The SQL acceptance-file correction is committed. The restricted server TypeScript edit remains blocked and outstanding. Keep the worker disabled until both gates are corrected and the disposable PostgreSQL tests pass.


## Follow-up result — 2026-11-03

- Corrected `tests/postgres/mrv-worker-api-boundary.acceptance.sql` to include `organization_geography_scopes` in the 14-table RLS/FORCE RLS gate.
- Extended that acceptance script to require the reconciled claim index, its deterministic key order, all eight worker-claimable statuses, and exclusion of `NEEDS_RECONCILIATION`.
- The update to `apps/src/mrv-worker-server-restricted.ts` was attempted again but blocked. The server's runtime preflight still checks only 13 relations and must be corrected before worker readiness.
