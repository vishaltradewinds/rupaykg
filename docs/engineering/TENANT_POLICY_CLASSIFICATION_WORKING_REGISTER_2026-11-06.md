# RupayKg — Tenant Policy Classification Working Register
Date: 2026-11-06

Status: ENGINEERING WORKING REGISTER — NOT RELEASE APPROVED

## Evidence boundary
This register is derived from the live Neon schema inventory and previously verified organization/bilateral relationships. It is a policy-design input, not proof that production RLS is enabled.

## Classification
- TENANT: access must be constrained to the authenticated organization/active workspace.
- BILATERAL: access must be constrained by the participating organization relationship; both sides require explicit policy semantics.
- SHARED/ROOT: global or reference data; tenant filtering is not the primary boundary, but write authority and sensitive fields still require controls.
- INHERITED: organization scope is inherited through a parent/activity/evidence/verification relationship and must be enforced through that relationship.

## Working classifications
### TENANT
activities
audit_events
bwg_profiles
bwg_reporting_periods
carbon_projects
cpcb_swm_stakeholder_workspaces
cpcb_swm_status_history
environmental_attribute_claims
epr_returns
esg_reporting_periods
evidence_artifact_series
field_devices
obligations
organization_bwg_assessments
organization_epr_applicability
organization_geography_scopes
organization_memberships
organization_statutory_profiles
organization_verification_evidence
platform_access_change_requests
resource_flows
roles
stakeholder_applications

### BILATERAL
bwg_waste_reports
chain_of_custody_links
credentials
epr_credit_transfers
epr_credits
epr_obligations
registry_events
settlements

### INHERITED — policy proof still required
activity_assignments
bwg_epr_reports
bwg_esg_reports
carbon_calculations
epr_credit_allocations
esg_metrics
evidence
evidence_artifact_reviews
evidence_artifact_versions
evidence_verification_requirements
field_sync_conflicts
field_sync_cursors
field_sync_envelopes
measurements
methodology_governance_evidence
mrv_observations
mrv_provenance_events
operation_sync_envelopes
organization_geography_scopes
platform_audit_chain_head
settlement_events
stakeholder_application_approvals
verifications

### SHARED/ROOT — explicit write/read policy required
carbon_market_mechanisms
ccts_methodology_registry
epr_schemes
geography
geography_sources
identities
identity_credentials
identity_password_credentials
identity_sessions
methodology_versions
organizations
regulatory_requirements
regulatory_sources
schema_migrations

## Release rule
No classification above is treated as final until every table has an explicit access-path review, including inherited ownership, bilateral visibility, service-mode access, background workers, and sensitive-field exposure.

Production remains READ-ONLY. No RLS, grants, ownership, trigger, or migration changes are authorized by this register.
