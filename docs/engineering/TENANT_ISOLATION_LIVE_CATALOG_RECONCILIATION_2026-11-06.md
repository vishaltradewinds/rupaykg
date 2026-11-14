# RupayKg — Shakti Batch C Live Tenant-Boundary Reconciliation

Date: 2026-11-06

Status: ENGINEERING EVIDENCE — production remains READ-ONLY/HOLD.

## Authoritative catalog observed

Read-only Neon inspection of project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg` returned **67 public BASE TABLEs**.

The live catalog confirms:
- all 67 public tables currently report RLS disabled;
- all 67 currently report FORCE RLS disabled;
- all 67 are owned by `rupaykg`;
- the previously recorded production runtime role posture therefore remains a P0 boundary: runtime/table ownership/BYPASSRLS separation is not yet demonstrated.

No write, DDL, migration, role, grant, ownership, RLS or branch mutation was performed during this reconciliation.

## Provisional 67-table classification

Classification is generated from the live catalog using direct `organization_id`/tenant-key detection plus FK reachability from the organization root, with explicit security-control overrides.

### Tenant-owned direct

- activities
- bwg_profiles
- bwg_reporting_periods
- carbon_projects
- cpcb_swm_stakeholder_workspaces
- cpcb_swm_status_history
- environmental_attribute_claims
- epr_returns
- esg_reporting_periods
- evidence_artifact_series
- field_devices
- obligations
- organization_bwg_assessments
- organization_epr_applicability
- organization_geography_scopes
- organization_memberships
- organization_statutory_profiles
- organization_verification_evidence
- organizations
- platform_access_change_requests
- resource_flows
- roles
- stakeholder_applications

### Tenant-owned indirect

- activity_assignments
- bwg_epr_reports
- bwg_esg_reports
- bwg_waste_reports
- carbon_calculations
- chain_of_custody_links
- credentials
- epr_credit_allocations
- epr_credit_transfers
- epr_credits
- epr_obligations
- esg_metrics
- evidence
- evidence_artifact_reviews
- evidence_artifact_versions
- evidence_verification_requirements
- field_sync_conflicts
- field_sync_cursors
- field_sync_envelopes
- measurements
- mrv_observations
- mrv_provenance_events
- registry_events
- settlement_events
- settlements
- stakeholder_application_approvals
- verifications

### Security/control

- identities
- identity_credentials
- identity_password_credentials
- identity_sessions
- platform_audit_chain_head
- schema_migrations

### Global/reference or unresolved

- carbon_market_mechanisms
- ccts_methodology_registry
- epr_schemes
- geography
- geography_sources
- methodology_governance_evidence
- methodology_versions
- operation_sync_envelopes
- regulatory_requirements
- regulatory_sources

## Important boundary findings

The classification is **not yet an RLS policy decision**.

Several tables are indirect tenant data and therefore require policy predicates following their authoritative FK path rather than a fabricated `organization_id` column. Examples include evidence, measurements, MRV observations, settlements, verifications and EPR/ESG report chains.

Several reference/control tables require separate treatment. They must not be blindly given tenant policies merely because they participate in tenant-owned FK graphs.

The current catalog therefore supports the next engineering gate: policy design from actual FK paths, not blanket "organization_id exists" logic.

## Required next engineering batch

1. Generate the complete FK path map from each tenant-owned indirect table to the organization root.
2. Identify composite-key and non-`id` tables requiring specialized policy predicates.
3. Separate global reference data from security/control data using application semantics and read/write paths.
4. Build disposable PostgreSQL RLS policies only on a rehearsal database.
5. Create distinct runtime identities:
   - non-owner
   - `NOBYPASSRLS`
   - no table ownership
6. Prove SELECT, INSERT, UPDATE and DELETE isolation for two organizations.
7. Prove pooled-connection reset/no context leakage.
8. Prove background worker/system actor boundaries.
9. Prove that table owner and BYPASSRLS roles cannot be used as runtime evidence.
10. Obtain independent DBA/security review.

## Release boundary

This reconciliation does **not** authorize production RLS activation, role/grant/ownership changes, deployment, worker activation, certification or TRL 9.

Production remains READ-ONLY/HOLD.
