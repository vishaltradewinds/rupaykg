# RupayKg — Tenant Policy Classification Working Register
Date: 2026-11-06

Status: ENGINEERING WORKING REGISTER — live-schema reconciled; release approval pending.

## Evidence boundary
This register is derived from the live Neon schema inventory and read-only relationship/function/trigger inspection. It is a policy-design and reconciliation input, not proof that production RLS is enabled.

## Policy classes
- TENANT: direct organization ownership; access must be constrained to authenticated organization/active workspace.
- BILATERAL: multiple participating organizations; each side's visibility/write authority must be explicit.
- INHERITED: organization scope is derived through activity/evidence/verification/workspace/parent ownership.
- SHARED/ROOT: global reference/control-plane data; tenant filtering is not the primary boundary, but write authority and sensitive fields require explicit controls.

## Direct TENANT tables
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

## BILATERAL tables
bwg_waste_reports
chain_of_custody_links
credentials
epr_credit_transfers
epr_credits
epr_obligations
registry_events
settlements

## INHERITED tables
activity_assignments -> activities.organization_id
bwg_epr_reports -> evidence.activity_id / verifications.activity_id
bwg_esg_reports -> evidence.activity_id / verifications.activity_id
carbon_calculations -> activities.organization_id
epr_credit_allocations -> parent credit/transfer ownership path; exact policy still requires source-level review
esg_metrics -> activities.organization_id / evidence.activity_id
evidence -> activities.organization_id
evidence_artifact_reviews -> evidence.activity_id
evidence_artifact_versions -> evidence.activity_id
evidence_verification_requirements -> activities.organization_id / evidence activity
field_sync_conflicts -> field/device or sync-owner path; exact policy still requires source-level review
field_sync_cursors -> field/device or sync-owner path; exact policy still requires source-level review
field_sync_envelopes -> field/device or sync-owner path; exact policy still requires source-level review
measurements -> activities.organization_id
methodology_governance_evidence -> methodology/governance ownership path; exact policy still requires source-level review
mrv_observations -> activities.organization_id
mrv_provenance_events -> activities.organization_id / evidence.activity_id / verification.activity_id
operation_sync_envelopes -> operational/device ownership path; exact policy still requires source-level review
platform_audit_chain_head -> platform audit/control-plane path
settlement_events -> settlement ownership path
stakeholder_application_approvals -> stakeholder application organization
verifications -> activities.organization_id / evidence.activity_id

## SHARED/ROOT tables
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

## Critical live-schema findings
The inspected live schema provides explicit organization relationships for activity/evidence/verification chains and bilateral relationships including processor, actor, issuer, recycler, payer/payee, and from/to owner relationships.

Verification provenance is now live-reconciled at the database-object level:
- verifications_integrity_guard exists and invokes prevent_invalid_verification();
- prevent_invalid_verification() currently contains the organization-scoped APPROVED-verification authorization logic and writes the authorization snapshot columns;
- verification_independence_guard also exists.

Therefore the previous finding "verification trigger not evidenced" is superseded by this direct trigger/function inspection.

This does NOT prove migration-096 ledger reconciliation. The live object state must still be reconciled against migration chronology and deployment history.

## Release rule
No classification is final until each table's complete application access path, worker access, bilateral visibility, service-mode behavior, and sensitive-field exposure are reviewed.

Production remains READ-ONLY. No RLS, grants, ownership, trigger, or migration changes are authorized by this register.
