# RupayKg Tenant-Isolation Reconstruction Gate

Status: **IN PROGRESS — RELEASE BLOCKED**

Date: 2026-11-05

## Evidence baseline

The authoritative Neon branch inspected for this gate is:

- Project: `steep-mud-79906940`
- Branch: `br-restless-base-b44cip2h`
- Database: `rupaykg`
- Runtime role observed: `rupaykg`

Direct PostgreSQL catalog inspection verified:

- 67 public tables.
- RLS is disabled on all 67 inspected public tables.
- RLS is not forced on all 67 inspected public tables.
- PostgreSQL policy count is zero.

Therefore PostgreSQL RLS currently provides **no tenant-isolation enforcement** on this database.

## Application authorization evidence

The current API authorization layer is organization-aware:

- authenticated identities are resolved from `identity_sessions`;
- verified `organization_memberships` are loaded;
- multi-organization identities must explicitly select an organization;
- endpoint authorization uses organization membership, roles, permissions and geography scope.

This is application-layer authorization. It must not be represented as equivalent to database-enforced tenant isolation.

## Direct organization-scoped tables observed

The authoritative database catalog shows direct organization ownership/scope on at least:

`activities`, `audit_events`, `bwg_profiles`, `bwg_reporting_periods`,
`carbon_projects`, `cpcb_swm_stakeholder_workspaces`,
`cpcb_swm_status_history`, `environmental_attribute_claims`,
`evidence_artifact_series`, `field_devices`, `obligations`,
`organization_bwg_assessments`, `organization_epr_applicability`,
`organization_geography_scopes`, `organization_memberships`,
`organization_statutory_profiles`, `organization_verification_evidence`,
`platform_access_change_requests`, `resource_flows`, `roles`,
`stakeholder_applications`.

There are additional bilateral/multi-party organization relationships, including:

- `bwg_waste_reports.processor_organization_id`
- `chain_of_custody_links.actor_organization_id`
- `credentials.issuer_organization_id`
- `epr_credit_transfers.from_organization_id`
- `epr_credit_transfers.to_organization_id`
- `epr_credits.issuer_organization_id`
- `epr_credits.recycler_organization_id`
- `epr_obligations.obligated_organization_id`

These cannot be reduced to a single generic `organization_id` policy without defining the access semantics for each relationship.

## Critical migration-lineage finding

The production ledger contains version `096` recorded as:

`096_verification_authorization_provenance.sql`

The active repository branch inspected for the protected-migrator work does not currently expose that filename under the active `migrations/` path. Exact-path checks were also performed against `apps/migrations/`, `db/migrations/`, and `database/migrations/`.

This is **not yet declared resolved**. The next lineage task is to identify whether the historical migration exists under another authoritative path/ref or whether the production ledger/source history requires a controlled reconciliation.

## Required architecture before enabling production RLS

RupayKg must not enable RLS ad hoc in production.

The application currently uses a pooled PostgreSQL role for API requests. Safe RLS requires an authenticated database tenant context that is transaction-scoped and cannot leak between pooled connections.

The required sequence is:

1. Reconcile the complete migration lineage, including version 096.
2. Define the authoritative tenant-policy matrix for every organization-scoped and bilateral table.
3. Implement transaction-scoped database identity/organization context in the API data-access path.
4. Define service/migrator/maintenance exceptions explicitly and fail closed.
5. Validate cross-tenant SELECT/INSERT/UPDATE/DELETE isolation on disposable PostgreSQL.
6. Validate multi-organization and bilateral access semantics.
7. Validate pooled-connection context reset/leakage behaviour.
8. Rehearse the complete migration on a disposable database.
9. Only after independent release gates pass, prepare a production migration proposal.
10. Keep production READ-ONLY/HOLD until explicit founder approval.

## Non-goals of this gate

This document does not:

- enable RLS in production;
- create production policies;
- mutate production data;
- change database roles or grants;
- claim tenant isolation is complete;
- claim production readiness;
- claim TRL 9.

