# RupayKg Gate 1 — database security foundation: preliminary source inventory

Date: 2026-10-31  
Branch at start of inspection: `shakti/atomic-inbox-claim-2026-10-31`  
Inspection mode: GitHub source read only; no database or deployment access in this batch.

## Purpose and scope

This is the first Gate 1 discovery slice, not a completed route/table authorization matrix and not an RLS implementation. It inventories the central API bootstrap, authentication and tenant-context helpers, production configuration, migration runner, Render service declaration and the route modules imported by the API bootstrap. SQL table names below are static source-extracted candidates; dynamic SQL, imported helpers and every authorization branch still require manual review.

## VERIFIED — runtime and connection configuration

1. Root `package.json` declares npm workspaces. The API workspace is `apps` (`apps/package.json`, package `@rupaykg/api`); web is `apps/web`; shared packages live under `packages/*`.
2. Render declares one web service, `rupaykg-production`, Docker runtime, region Singapore, health check `/health`, and `DATABASE_URL` as a manually supplied environment variable. No separate API/migration/worker connection variables are declared in the inspected `render.yaml`.
3. `apps/src/production-server.ts` loads validated production config and maps its single `databaseUrl` into `process.env.DATABASE_URL`.
4. `apps/src/server.ts` creates one PostgreSQL `Pool` from `process.env.DATABASE_URL` (max 10). It runs a read-only role diagnostic and logs role capability fields. It does not establish a distinct API role by code configuration.
5. `apps/src/migrate.ts` creates a separate process-local pool (max 1), but also reads the same `process.env.DATABASE_URL`. Separate process/pool does not mean separate database principal. Production migration execution is gated by a captured 92-row ledger manifest and exact live-ledger comparison.
6. `apps/src/production-config.ts` validates the URL format, TLS settings, production auth mode, synthetic-data prohibition and allowed origins. It does not validate a dedicated least-privilege role identity.
7. The Render manifest does not expose `GOVERNMENT_INBOX_DATABASE_URL` in the inspected service declaration. A live worker database identity is therefore NOT ESTABLISHED by this deployment manifest.

## VERIFIED — tenant context and current RLS readiness

- `apps/src/database-context.ts` derives identity and active organization from server-verified `AuthContext`, requires a verified membership, and uses transaction-local `set_config('rupaykg.identity_id', ..., true)` and `set_config('rupaykg.organization_id', ..., true)`.
- The helper's own comment explicitly says it is infrastructure only and callers must not assume RLS is enabled until a reviewed policy migration is applied.
- `apps/src/auth.ts` validates bearer sessions and verified memberships; multi-organization identities must select an active organization. This is application authorization, not a substitute for database-enforced tenant isolation.
- The central server still performs direct pool-level queries for some operations and route modules have mixed transaction patterns. A transaction-local context helper existing in the repository does not prove every tenant-scoped query uses it.
- Prior read-only Neon catalog inspection found zero RLS-enabled public tables and zero RLS policies on inspected branches. This remains a P1 release blocker.

## VERIFIED — route module inventory (preliminary static extraction)

The API bootstrap imports these route modules. Candidate table names and rough handler/query counts were extracted from each module; this is not yet a table-by-table access policy audit.

| Module | Route handlers found | Candidate tables found | Direct pool queries | client queries | Tenant transaction helper references |
|---|---:|---|---:|---:|---:|
| onboarding-hierarchy-routes.ts | 3 | geography, identities, organization_geography_scopes, organization_memberships, organization_verification_evidence, organizations, roles, stakeholder_application_approvals, stakeholder_applications | 2 | 0 | 0 |
| value-routes.ts | 9 | activities, bwg_epr_reports, bwg_esg_reports, bwg_profiles, bwg_reporting_periods, bwg_waste_reports, carbon_calculations, epr_credits, epr_obligations, epr_schemes, esg_metrics, esg_reporting_periods, evidence, geography, methodology_versions, obligations, organization_geography_scopes, organization_memberships, verifications | 0 | 20 | 21 |
| registry-routes.ts | 8 | activities, credentials, evidence, mrv_provenance_events, organization_memberships, organizations, registry_events, settlement_events, settlements, verifications | 0 | 3 | 0 |
| sync-routes.ts | 7 | activities, audit_events, evidence, field_devices, field_sync_conflicts, field_sync_cursors, field_sync_envelopes, measurements, organization_memberships, resource_flows | 3 | 38 | 0 |
| workspace-routes.ts | 8 | activities, carbon_calculations, credentials, esg_metrics, esg_reporting_periods, evidence, geography, measurements, methodology_versions, obligations, organization_memberships, organizations, registry_events, resource_flows, settlements, verifications | 0 | 14 | 19 |
| bwg-routes.ts | 1 | epr_obligations, epr_schemes, geography, obligations | 0 | 1 | 5 |
| cpcb-swm-routes.ts | 3 | audit_events, cpcb_swm_stakeholder_workspaces, cpcb_swm_status_history, organization_memberships | 0 | 6 | 9 |
| intelligence-routes.ts | 1 | activities, geography, organization_memberships | 1 | 0 | 0 |
| mrv-routes.ts | 4 | activities, evidence, measurements, mrv_observations, mrv_provenance_events, verifications | 0 | 4 | 13 |
| evidence-vault-routes.ts | 4 | activities, evidence, evidence_artifact_reviews, evidence_artifact_series, evidence_artifact_versions, verifications | 0 | 5 | 11 |
| platform-admin-routes.ts | 16 | audit_events, identities, identity_sessions, mrv_provenance_events, organization_memberships, organizations, platform_access_change_requests, platform_audit_chain_head, roles, stakeholder_applications, pg_roles | 5 | 17 | 0 |

Central `apps/src/server.ts` also contains additional handlers and direct `pool.query`/client access; the full matrix must include those handlers and all imported route modules, not just the summary above.

## Security interpretation

- Application authentication and permission checks are present in code, and some routes use transaction-local tenant context.
- RLS is not enabled in the inspected production schema; therefore DB-level tenant isolation is not in place.
- The API and migration processes both consume `DATABASE_URL`; separate process pools do not establish separate roles.
- The actual Render runtime database username/role has NOT been verified from a live Render environment. Never infer it from the Neon inspection role or from the manifest.
- The current source has a read-only database-role diagnostic endpoint, but its output must be retrieved from the actual deployed service and checked against the expected least-privilege role. No credentials or secret values should be collected in this process.

## NOT DONE / open questions

1. Full route × operation × table × tenant-scope × permission matrix, including central server routes and helper SQL.
2. Identify all database connection variables and all pool constructors, including government inbox/worker, tests, scripts and one-off operational tooling.
3. Verify actual Render service environment-variable names and database principal without disclosing secrets.
4. Inspect grants, ownership, default privileges and role memberships for the production runtime principal and migration principal.
5. Design per-table RLS policies and ensure every scoped query runs in a transaction with verified context.
6. Add positive and negative cross-tenant tests for reads, inserts, updates, deletes, admin routes, bilateral settlement and system-level government intake.
7. No RLS policy migration has been authored or applied in this batch. No database writes or role changes occurred.

## Next action

Continue Gate 1 by completing the route-to-table matrix. Inspect central server handlers and each route module's full SQL, identify global/system-level versus tenant-owned tables, classify read/write verbs and authorization source, then inventory every Pool constructor and connection-string name. Only after that should the least-privilege role matrix and table-specific RLS design be proposed. Validate in a disposable/production-derived rehearsal database; preserve production migration 096 and do not touch production until the reviewed gate is approved.


## Addendum — live Render service and deployed-code comparison (2026-10-31)

Read-only Render connector inspection identified the existing RupayKg web service:
- Service name: `rupaykg`; service ID `srv-daki4d7qj5pc73b8qksg`.
- Repository: `vishaltradewinds/rupaykg`; deployed branch: `main`; runtime Docker; region Singapore; health check `/health`; one instance; service currently not suspended.
- Latest deployment observed: `dep-dbis4nm417fc73a8m7ng`, status `live`, deployed commit `862512c8c904cef0f604df0350f02672318953af` (2026-10-31 10:28 UTC).
- Render account inventory returned no Render-hosted Postgres instances. This is consistent with Neon being the database provider, but does not by itself identify the connection endpoint or database role.
- The live service metadata does not expose the secret environment-variable values, and no environment-variable read operation was available in this inspection. No secrets were requested or copied.
- A Render log query for `database_role_diagnostic` returned no matching logs. More importantly, the deployed `main` source at the inspected ref does NOT contain the `readDatabaseRoleDiagnostic` call or the tenant database-context helper that exist on the review branch. Therefore the review-branch diagnostic cannot be used as evidence of the currently deployed runtime identity.
- The deployed main commit is older than the review branch security work. PR #175 is not deployed; its draft status is not approval to deploy.

## Updated Gate 1 conclusions

1. **VERIFIED:** the existing Render service deploys from `main`, not the review branch.
2. **VERIFIED:** latest observed live deploy is commit `862512c8c904cef0f604df0350f02672318953af`.
3. **NOT VERIFIED:** actual live Neon DB role/user and its grants. No credential or secret inspection was performed.
4. **NOT VERIFIED:** whether Render environment variable `DATABASE_URL` targets Neon production `main` or another endpoint; prior Neon context indicates `main` is the only authority, but the Render secret value was intentionally not accessed.
5. **P1:** deployed code and review-branch code differ. Do not claim the branch's role diagnostic, tenant context helper or RLS readiness are deployed.
6. Do not add or change Render environment variables, deploy the review branch, or create a worker until role separation, migration/rollback, security tests and deployment approvals are complete.

Next: compare the exact deployed main commit against the review branch and inspect the complete main-to-review security delta; then complete the route/table/permission matrix on the intended release candidate. Obtain live DB identity through an approved, non-secret diagnostic deployed via a reviewed release—not by extracting connection strings.
