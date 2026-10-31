# Production PostgreSQL catalog security inventory — 2026-10-31

**Status:** VERIFIED read-only catalog snapshot  
**Target:** Neon project `rupaykg-production-fresh` / `steep-mud-79906940`, branch `main` / `br-restless-base-b44cip2h`, database `rupaykg`  
**Repository review branch:** `shakti/atomic-inbox-claim-2026-10-31`  
**Inspection timestamp:** 2026-10-31 15:34 UTC  
**Method:** Read-only PostgreSQL catalog queries. No DDL, DML, migration, role, grant, policy, branch or setting changes.

## Executive result

- Production branch remains the sole primary/default/ready branch.
- 67 public base tables.
- 0/67 tables have RLS enabled; 0 public RLS policies.
- 92 migration ledger rows; maximum version `20261021`.
- Inspection principal: `session_user=current_user=rupaykg`.
- `rupaykg` is LOGIN, non-superuser, but has BYPASSRLS, CREATEDB, CREATEROLE and REPLICATION; it is a member of `neon_superuser`. The `neon_superuser` role itself is NOLOGIN and carries the same elevated flags including BYPASSRLS.
- This inspection principal is not evidence of the deployed API/worker runtime identity.

**Security conclusion:** database-enforced tenant isolation is NOT ESTABLISHED. This remains a production release blocker. No blanket RLS change is proposed by this inventory.

## Direct ownership-key inventory

The following are the 23 tables with a direct `organization_id` column:

`activities`, `audit_events`, `bwg_profiles`, `bwg_reporting_periods`, `carbon_projects`, `cpcb_swm_stakeholder_workspaces`, `cpcb_swm_status_history`, `environmental_attribute_claims`, `epr_returns`, `esg_reporting_periods`, `evidence_artifact_series`, `field_devices`, `obligations`, `organization_bwg_assessments`, `organization_epr_applicability`, `organization_geography_scopes`, `organization_memberships`, `organization_statutory_profiles`, `organization_verification_evidence`, `platform_access_change_requests`, `resource_flows`, `roles`, `stakeholder_applications`.

The following are the 8 tables with a direct `identity_id` column:

`activity_assignments`, `field_devices`, `field_sync_envelopes`, `identity_credentials`, `identity_password_credentials`, `identity_sessions`, `organization_memberships`, `stakeholder_applications`.

Three tables contain both keys: `field_devices`, `organization_memberships`, `stakeholder_applications`. Therefore 28 distinct tables have at least one of these direct keys and 39 have neither.

## 39 tables without a direct organization_id or identity_id

`bwg_epr_reports`, `bwg_esg_reports`, `bwg_waste_reports`, `carbon_calculations`, `carbon_market_mechanisms`, `ccts_methodology_registry`, `chain_of_custody_links`, `credentials`, `epr_credit_allocations`, `epr_credit_transfers`, `epr_credits`, `epr_obligations`, `epr_schemes`, `esg_metrics`, `evidence`, `evidence_artifact_reviews`, `evidence_artifact_versions`, `evidence_verification_requirements`, `field_sync_conflicts`, `field_sync_cursors`, `geography`, `geography_sources`, `identities`, `measurements`, `methodology_governance_evidence`, `methodology_versions`, `mrv_observations`, `mrv_provenance_events`, `operation_sync_envelopes`, `organizations`, `platform_audit_chain_head`, `registry_events`, `regulatory_requirements`, `regulatory_sources`, `schema_migrations`, `settlement_events`, `settlements`, `stakeholder_application_approvals`, `verifications`.

**Important:** absence of a direct key does not make a table global or safe. The live catalog shows many FK relationships from these tables into activities, organizations, evidence, measurements, memberships, obligations, credentials, schemes, verifications and other parent records. Several may inherit ownership through parent/child relationships; some may be multi-party, global reference/control-plane, identity-private, append-only audit/evidence, or maintenance-only. Each needs explicit semantic classification and route/query review before policy design.

## What this snapshot does not prove

- It does not map every API route, SQL statement, operation, principal or tenant context.
- It does not establish whether a row is tenant-owned merely from a column name or FK edge.
- It does not verify views, materialized views, function execution privileges, sequences, default privileges, triggers or runtime grants exhaustively.
- It does not prove the production app's actual connection principal.
- It does not prove backup restoration, RPO/RTO, regulator acceptance, worker operation or TRL 9.

## Required next engineering gates

1. Complete route → repository/query → table → operation → principal → tenant-context mapping.
2. Classify every table as tenant-owned, identity-owned, multi-party, global reference/control-plane, append-only evidence/audit, or maintenance-only, with FK-derived ownership and read/write rules.
3. Inspect views, triggers, functions, sequences, ACLs and default privileges, including SECURITY DEFINER paths.
4. Design separate least-privilege API, migration, worker, event-writer and operations identities; do not use the elevated inspection login as a service identity.
5. Design non-forgeable tenant context and table-specific RLS; caller-controlled GUC alone is insufficient.
6. Rehearse on a disposable production-derived Neon branch with positive/negative cross-tenant, pooled-connection, revoked-membership and forged-context tests.
7. Obtain independent security review, backup/restore evidence and explicit approval before any production change.

## Change record

Read-only inspection only. Production remains unchanged; release HOLD; worker/scheduler OFF; certification OFF; TRL 9 NOT ESTABLISHED.
