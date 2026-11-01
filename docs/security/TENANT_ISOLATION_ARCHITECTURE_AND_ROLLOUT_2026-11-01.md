# RupayKg tenant-isolation architecture and rollout gate

**Audit date:** 2026-11-01
**Repository baseline:** `main` at `b5e91241d84a6712ff544d3deec1805702f45efd`
**Authoritative Neon project:** `steep-mud-79906940`
**Production branch:** `br-restless-base-b44cip2h` (`main`)
**Database:** `rupaykg`
**Method:** read-only PostgreSQL catalog inspection. No DDL, DML, grants, role changes, RLS changes, deployment, or secret access.

## 1. Executive finding

The production database is not yet tenant-isolated at the PostgreSQL boundary.

Verified facts:
- 67 public base tables.
- 0 tables with RLS enabled.
- 0 tables with FORCE ROW LEVEL SECURITY.
- All 67 public tables are owned by login role `rupaykg`.
- Current database role `rupaykg` is a member of `neon_superuser`.
- Role flags: `rolsuper=false`, `rolcreaterole=true`, `rolcreatedb=true`, `rolreplication=true`, `rolbypassrls=true`, `rolcanlogin=true`.
- 45 tables have at least one direct organization, tenant, workspace, owner, creator, or identity attribution column (this is a discovery bucket, not proof that each table's policy is correct).
- 22 tables have no such direct column and need explicit inherited-ownership or shared-reference classification.
- Every inspected public table is owned by `rupaykg`; enabling RLS alone will not constrain this role while it retains BYPASSRLS.

**Decision:** no RLS migration may be enabled against the current application credential. First split runtime, ownership, and migration authority. Do not revoke existing privileges or rotate credentials until the live application connection and replacement role have been validated in a disposable branch.

## 2. Current role boundary is the first blocker

The observed `rupaykg` login role is far more privileged than a runtime service identity should be: it can create roles/databases, replicate, bypass RLS, and inherits membership in `neon_superuser`. It also owns every public table.

Required target roles (names are proposed, not created):
- `rupaykg_owner`: NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS. Owns application schemas/tables/functions. No application connection uses this role.
- `rupaykg_app`: dedicated runtime login, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS; only required schema usage and CRUD/function grants. No ownership, DDL, or membership in privileged roles.
- `rupaykg_migrator`: separately controlled, short-lived release identity. Only used by a single authorized migration job after target identity and backup checks. Never stored in the web-service runtime environment.
- Platform/admin role: retained only for break-glass administration and never used by the application.

Ownership transfer and privilege revocation are a separate controlled migration. Before removing the current role's elevated attributes/membership, identify all consumers and test the new roles, migration permissions, backup/restore, deploy, and rollback on a disposable Neon branch. Do not assume Render environment variables or current connection strings without an independently verified role identity.

## 3. Request context contract

RLS needs an authenticated context for every database transaction:
- Identity ID must come from verified server-side authentication, never from request body, query parameter, or client-supplied organization header.
- Active organization must be selected from the user's currently VERIFIED membership and role, not trusted from a submitted organization ID.
- Resolve membership/role on the server and revalidate for sensitive writes; revocation must take effect on subsequent transactions.
- Set identity and organization context with transaction-local settings only (for example `set_config(..., true)` inside the same transaction). Never use session-level `SET` on pooled connections; clear/reinitialize context on every checkout.
- Fail closed when identity or active organization context is absent, malformed, revoked, or ambiguous.
- Use a single transaction wrapper so context setup, authorization check, and business SQL share one connection and transaction.

**Security caveat:** ordinary PostgreSQL custom GUC values are settable by a database role. GUC-based RLS is strong protection against missing application filters and many accidental cross-tenant queries, but it is not a cryptographic boundary against arbitrary SQL executed as the runtime role. Do not claim otherwise. If SQL-injection containment is a formal requirement, evaluate a signed request-context assertion verified inside a tightly controlled database function or a stronger identity-to-database-role model; threat-model and test it before adoption.

## 4. Table classification register

### 4.1 Direct attribution candidates (45)

These tables expose one or more organization/workspace/identity/owner attribution columns and require an explicit row-access model:

`activities`, `activity_assignments`, `audit_events`, `bwg_profiles`, `bwg_reporting_periods`, `bwg_waste_reports`, `carbon_projects`, `chain_of_custody_links`, `cpcb_swm_stakeholder_workspaces`, `cpcb_swm_status_history`, `credentials`, `environmental_attribute_claims`, `epr_credit_transfers`, `epr_credits`, `epr_obligations`, `epr_returns`, `esg_reporting_periods`, `evidence`, `evidence_artifact_reviews`, `evidence_artifact_series`, `evidence_artifact_versions`, `field_devices`, `field_sync_conflicts`, `field_sync_envelopes`, `identities`, `identity_credentials`, `identity_password_credentials`, `identity_sessions`, `measurements`, `obligations`, `operation_sync_envelopes`, `organization_bwg_assessments`, `organization_epr_applicability`, `organization_geography_scopes`, `organization_memberships`, `organization_statutory_profiles`, `organization_verification_evidence`, `organizations`, `platform_access_change_requests`, `registry_events`, `resource_flows`, `roles`, `settlement_events`, `stakeholder_application_approvals`, `stakeholder_applications`, `verifications`.

Important: `identity_id`, `actor_identity_id`, `created_by_identity_id`, or `owner_id` does not automatically mean an organization-level policy. Each table needs an explicit owner/reader/writer matrix. Multi-party tables (for example EPR transfers and credits) need deliberate visibility rules for each party and regulator, not a generic `organization_id = current_org` policy.

### 4.2 No direct tenant/identity attribution (22)

`bwg_epr_reports`, `bwg_esg_reports`, `carbon_calculations`, `carbon_market_mechanisms`, `ccts_methodology_registry`, `epr_credit_allocations`, `epr_schemes`, `esg_metrics`, `evidence_verification_requirements`, `field_sync_cursors`, `geography`, `geography_sources`, `methodology_governance_evidence`, `methodology_versions`, `mrv_observations`, `mrv_provenance_events`, `platform_audit_chain_head`, `regulatory_requirements`, `regulatory_sources`, `schema_migrations`, `settlements`, and `(one additional table from the 67-table catalog requires explicit reconciliation before classification)`.

The catalog query identified 21 named rows in the no-direct-key bucket in this report draft; the source audit returned 22. This count discrepancy is intentionally retained as a reconciliation blocker rather than silently guessing the missing table. Re-run the catalog extract and complete this register before policy implementation.

Initial FK observations:
- Child/derived ownership candidates: `bwg_epr_reports`, `bwg_esg_reports`, `carbon_calculations`, `epr_credit_allocations`, `esg_metrics`, `evidence_verification_requirements`, `field_sync_cursors`, `methodology_governance_evidence`, `mrv_observations`, `mrv_provenance_events`, `settlements`. Their effective owner must be derived from and constrained to their referenced tenant-owned parent(s); add composite tenant-aware FKs where necessary.
- Shared reference candidates: `carbon_market_mechanisms`, `ccts_methodology_registry`, `epr_schemes`, `geography`, `geography_sources`, `methodology_versions`, `regulatory_requirements`, `regulatory_sources`. Likely globally readable and tightly controlled for writes, but this requires regulatory/product-owner confirmation.
- Operational/control candidates: `platform_audit_chain_head`, `schema_migrations`. Must not be exposed as ordinary tenant CRUD; restrict to controlled functions/migration identity.
- The table-by-table owner/visibility model is not complete. Do not generate blanket policies from column-name heuristics.

## 5. Required RLS policy families

1. Organization-owned rows: match the active verified organization, with INSERT/UPDATE checks and immutable organization ownership where required.
2. Identity-owned rows: identity self-access only, plus narrowly scoped authentication/security functions.
3. Child rows without a tenant key: enforce ownership through a tenant-owned parent and composite FK; prefer adding `organization_id` plus composite FK when query and audit semantics justify denormalization.
4. Multi-party rows: explicit party visibility (payer/payee, sender/receiver, issuer/recycler) and regulator/system roles; no accidental write authority from read visibility.
5. Global reference rows: tenant read-only; writes only via controlled governance/migration role.
6. Append-only evidence/audit/registry events: scoped read plus constrained append function; prohibit update/delete through grants and triggers.
7. Platform control/migration tables: no application role access except specific safe functions.

Use both `USING` and `WITH CHECK` policies for applicable commands. Avoid permissive-policy OR composition that accidentally broadens access. Prefer restrictive policies or one reviewed composite policy where policy interactions could widen access. Use FORCE ROW LEVEL SECURITY for tenant data after ownership and privileged maintenance paths are correctly separated.

## 6. Rollout sequence — fail closed

**Gate 0 — Complete evidence inventory**
- Reconcile the 67-table inventory and the 22 no-direct-key tables.
- Capture columns, PK/unique/FK constraints, views/materialized views, functions, triggers, sequences, grants, role memberships, and every application query path.
- Build a table-by-table data owner, reader, writer, regulator, system-worker matrix.
- Detect null/invalid organization IDs, cross-tenant FK mismatches, orphan child rows, and ambiguous identity ownership.

**Gate 1 — Role separation on disposable branch**
- Create owner/runtime/migrator role design on disposable Neon branch.
- Prove application works with non-owner NOBYPASSRLS runtime role.
- Prove migration runner is isolated, auditable, single-flight, and cannot be invoked by ordinary API runtime.
- Confirm Render deployment and connection pooling use only runtime role; do not reveal secrets in logs.

**Gate 2 — Context propagation**
- Implement transaction-scoped authenticated identity + verified active organization context.
- Add tests for absent context, invalid context, revoked membership, cross-tenant switch, pooled connection reuse, rollback, and parallel requests.
- Confirm all query helpers use the context wrapper.

**Gate 3 — Policy implementation**
- Apply policy families in small table groups on disposable branch.
- Include inherited-parent and multi-party semantics.
- Ensure schema owner cannot bypass forced RLS and runtime role cannot alter policy/function/schema.
- Validate query plans/indexes and performance.

**Gate 4 — Adversarial acceptance**
- Two tenants, same role, different rows; cross-tenant SELECT/INSERT/UPDATE/DELETE denied.
- Cross-tenant parent/child references rejected.
- NULL, missing, stale, revoked, and switched tenant context fails closed.
- Connection-pool reuse never leaks previous identity/organization.
- Worker, regulator, and platform-admin paths are explicitly tested.
- SQL injection/context-spoofing threat model documented; do not overstate GUC protection.
- Run full tests, load tests, backup/restore, and incident rollback rehearsal.

**Gate 5 — Controlled production rollout**
- Read-only preflight and signed approval.
- Backup/restore point and maintenance window.
- One migration execution, immutable release artifact, schema verification, smoke tests, monitoring.
- Roll back application if required; never blindly reverse destructive schema/data migrations.
- Keep certification OFF until independent security validation and operational evidence pass.

## 7. Release decision

- Production changes from this audit: none.
- RLS enabled in production: 0/67.
- FORCE RLS in production: 0/67.
- Runtime role replacement: not yet performed.
- Tenant isolation gate: FAIL / BLOCKED.
- Production release: HOLD.
- TRL 9: not established.

**CTO decision:** build and validate role separation and the transaction-context layer first. Do not switch on broad RLS policies against the current `rupaykg` role. Do not delete or reset any database branch. Do not promote staging-only migrations as part of this work.
