# Production tenant-isolation inventory — 2026-11-04

## Scope and evidence

Read-only catalog inspection of Neon project `steep-mud-79906940`, branch `br-restless-base-b44cip2h` (`main`), database `rupaykg`. This document records catalog facts and source-level findings; it is not an authorization to change production.

- 67 public base tables.
- 181 public-schema foreign-key constraints.
- 0/67 tables have RLS enabled; 0/67 have FORCE RLS.
- All 67 public base tables are owned by `rupaykg`.
- Production role `rupaykg`: LOGIN, CREATEROLE, CREATEDB, REPLICATION, BYPASSRLS; member of `neon_superuser` (SUPERUSER=false).
- Earlier read-only ledger inspection: 92 migration rows, latest `20261021`; `mrv_source_snapshots` absent and migration 088 not recorded.
- No production write, DDL, grants, role changes, migration or RLS activation was performed.

## Direct tenant-key inventory

These 23 tables have `organization_id` or `tenant_id` columns. A direct key is necessary but not sufficient: every policy must prove membership, permissions, and resource ownership; relationship columns must be checked for cross-organization consistency.

1. `activities`
2. `audit_events`
3. `bwg_profiles`
4. `bwg_reporting_periods`
5. `carbon_projects`
6. `cpcb_swm_stakeholder_workspaces`
7. `cpcb_swm_status_history`
8. `environmental_attribute_claims`
9. `epr_returns`
10. `esg_reporting_periods`
11. `evidence_artifact_series`
12. `field_devices`
13. `obligations`
14. `organization_bwg_assessments`
15. `organization_epr_applicability`
16. `organization_geography_scopes`
17. `organization_memberships`
18. `organization_statutory_profiles`
19. `organization_verification_evidence`
20. `platform_access_change_requests`
21. `resource_flows`
22. `roles`
23. `stakeholder_applications`

## Complete 67-table catalog inventory

```text
activities
activity_assignments
audit_events
bwg_epr_reports
bwg_esg_reports
bwg_profiles
bwg_reporting_periods
bwg_waste_reports
carbon_calculations
carbon_market_mechanisms
carbon_projects
ccts_methodology_registry
chain_of_custody_links
cpcb_swm_stakeholder_workspaces
cpcb_swm_status_history
credentials
environmental_attribute_claims
epr_credit_allocations
epr_credit_transfers
epr_credits
epr_obligations
epr_returns
epr_schemes
esg_metrics
esg_reporting_periods
evidence
evidence_artifact_reviews
evidence_artifact_series
evidence_artifact_versions
evidence_verification_requirements
field_devices
field_sync_conflicts
field_sync_cursors
field_sync_envelopes
geography
geography_sources
identities
identity_credentials
identity_password_credentials
identity_sessions
measurements
methodology_governance_evidence
methodology_versions
mrv_observations
mrv_provenance_events
obligations
operation_sync_envelopes
organization_bwg_assessments
organization_epr_applicability
organization_geography_scopes
organization_memberships
organization_statutory_profiles
organization_verification_evidence
organizations
platform_access_change_requests
platform_audit_chain_head
registry_events
regulatory_requirements
regulatory_sources
resource_flows
roles
schema_migrations
settlement_events
settlements
stakeholder_application_approvals
stakeholder_applications
verifications
```

## Complete candidate policy matrix

See `docs/engineering/PRODUCTION_TENANT_POLICY_MATRIX_2026-11-04.md` for the 67-row table-by-table candidate tenant derivation, read/write boundary, multi-party handling, identity/platform exceptions and mandatory consistency checks. It is grounded in the live production catalog and is a design inventory only, not approved policy SQL.

## Relationship-driven classification required before policy design

Tables without a direct tenant key cannot be declared global. Their foreign keys and application joins indicate tenant inheritance or multi-party access:

- **MRV activity descendants:** `activity_assignments`, `carbon_calculations`, `chain_of_custody_links`, `credentials`, `measurements`, `mrv_observations`, `mrv_provenance_events`, `verifications`, and evidence descendants. Resolve tenant through the authoritative activity and validate any issuer/actor organization separately.
- **Evidence descendants:** `evidence`, `evidence_artifact_reviews`, `evidence_artifact_versions`, `evidence_verification_requirements`; derive access through evidence → activity and/or artifact series → organization. Reviewer/owner identity is an additional authorization dimension.
- **EPR / ESG / BWG children:** `bwg_epr_reports`, `bwg_esg_reports`, `bwg_waste_reports`, `epr_credit_allocations`, `epr_credit_transfers`, `epr_credits`, `epr_obligations`, `esg_metrics`. Resolve via reporting period, obligation, credit, evidence and/or verification; transfers and settlements require both counterparties and must not be reduced to a single-tenant policy.
- **Registry / settlement descendants:** `registry_events`, `settlements`, `settlement_events`. Validate issuer, payer, payee, owner and authorization relationships independently.
- **Field-sync descendants:** `field_sync_conflicts`, `field_sync_cursors`, `field_sync_envelopes`; derive scope through device and authenticated identity, and verify device ↔ organization ↔ identity binding. `operation_sync_envelopes` also binds an actor identity.
- **Identity/security:** `identities`, `identity_credentials`, `identity_password_credentials`, `identity_sessions`, `organization_memberships`, `roles`, `platform_access_change_requests`. These need identity self-access, organization-admin and platform-authority boundaries; do not expose them through generic organization policies.
- **Organization/global reference candidates requiring explicit data review:** `organizations`, `geography`, `geography_sources`, `epr_schemes`, `carbon_market_mechanisms`, `ccts_methodology_registry`, `methodology_versions`, `methodology_governance_evidence`, `regulatory_sources`, `regulatory_requirements`, `schema_migrations`, `platform_audit_chain_head`. Candidate shared/reference status is not proven by lack of an organization key. Protect write paths and distinguish public reference reads from privileged governance writes.

Important multi-party/indirect joins found in the catalog include:
- activities → organization; child activity tables → activities.
- evidence → activities and measurements; verification → activities, evidence, verifier identity, authorization membership and role.
- BWG reports → BWG reporting period; waste reports additionally → processor organization.
- EPR credits/transfers → issuer/recycler or from/to organizations, activity, evidence and verification.
- settlements → payer/payee organizations, obligations and credentials; settlement events → settlement and actor identity.
- stakeholder applications/approvals → organization, applicant identity, role, geography and approval identity.
- artifact versions → artifact series/evidence/uploader identity; artifact reviews → version/evidence/reviewer identity.
- field devices → organization/identity; envelopes → device/identity; conflicts → envelope/resolver identity.

A foreign key proves referential existence, not tenant-consistent ownership. Composite tenant-aware foreign keys or explicit transactional consistency checks may be needed where two tenant-bearing resources are joined.

## API and process surface mapped from `main`

`apps/src/server.ts` creates one runtime `pg.Pool` from `DATABASE_URL`, and passes it to these route registrars:

- `onboarding-hierarchy-routes.ts`
- `value-routes.ts` (also registers auth routes)
- `registry-routes.ts`
- `sync-routes.ts`
- `workspace-routes.ts`
- `bwg-routes.ts` (also registers EPR return routes)
- `cpcb-swm-routes.ts`
- `intelligence-routes.ts`
- `mrv-routes.ts` (also registers statutory routes)
- `evidence-vault-routes.ts`
- `platform-admin-routes.ts`

Inline handlers include health/status/overview, regulatory source listing, geography reads, operation sync, resource-flow creation and activity measurement creation. The registered modules cover onboarding approvals, carbon/EPR/ESG/BWG, registry/settlement, field devices and sync, workspaces, CPCB SWM, MRV/Guardian/Hedera, evidence vault and platform administration.

This is a route-family inventory, not a completed handler-by-handler authorization sign-off. Nested modules `auth-routes.ts`, `epr-return-routes.ts`, `statutory-routes.ts` and any further imports still require recursive review. Worker/cron/queue entrypoints also remain to be enumerated from the full repository and deployment configuration.

## Confirmed privilege-separation / boot-path defect

Source review confirms:
- `apps/src/server.ts` creates the API pool from `process.env.DATABASE_URL`.
- `apps/src/migrate.ts` independently creates a migration pool from the same `DATABASE_URL`.
- `apps/src/production-config.ts` validates and returns only one `databaseUrl`.
- `render.yaml` declares only one `DATABASE_URL` secret on the web service.
- `Dockerfile` runtime CMD executes `node apps/dist/src/migrate.js` before acceptance seed and production server, inside the same web container/service environment.

Therefore the deployed source/configuration does not demonstrate a separate least-privilege runtime credential and migration credential. It actively places migration execution in the web service boot path. This is stronger than merely sharing a variable name in source. Actual deployed secret value/role remains unverified. The acceptance seed is separately guarded by `RUPAYKG_ACCEPTANCE_SEED_ON_START=true`, but its code uses the same `DATABASE_URL` when enabled.

**Required design:** move migrations to a dedicated one-shot release/migration job with its own narrowly scoped credential, not an additional secret injected into the API service. Runtime identity must not own protected tables, create roles/databases, bypass RLS, or execute DDL. Deployment must fail closed if the migration job does not complete against the intended immutable release.

## Release gates — do not bypass

1. Finish handler-by-handler route and worker mapping, including all nested imports and scheduled/background entrypoints.
2. Produce an approved table policy matrix for all 67 tables: tenant derivation, multi-party semantics, read/write roles, identity/platform exceptions, append-only rules and global-reference treatment.
3. Reconcile migration source/ledger drift (production ledger is behind the source tree); never rewrite ledger history or blindly replay missing migrations.
4. Design runtime/migrator separation and owner-role transition with DBA review, backup, rehearsed rollback and exact target role verification.
5. Rehearse on a disposable Neon branch; run cross-tenant negative tests using the actual non-owner runtime role, including reads, inserts, updates, deletes, joins, nested resources, background jobs and transaction boundaries.
6. Enable RLS and FORCE RLS only after policy completeness and actual-role tests; do not rely on RLS while the runtime role owns tables or has BYPASSRLS.
7. Re-check catalog, grants, ownership, policies and CI at exact release SHA. Production changes require a separately approved change window and rollback plan.
8. Complete independent DBA/security review and field/operational evidence. Engineering CI alone does not establish TRL 9 or production certification.

## Current disposition

**P0 — FAIL / HOLD.** Production remains read-only. No migration, role/grant/ownership change, RLS activation, deployment, merge, worker activation or certification is authorized by this inventory. PR #243 and PR #244 remain draft/unmerged. Production tenant isolation, independent review, migration drift reconciliation, live Guardian/Hedera round-trip and SITE-JBP-01 field acceptance remain open.
