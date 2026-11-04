# Migration source inventory and reconciliation — 2026-11-04

**Scope:** current GitHub `main` migration directory versus read-only production ledger on Neon main.  
**Production database:** project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`.  
**Status:** inventory only; no production writes or migration operations.

## Exact counts

- Current-main migration directory: **91 SQL files**.
- Numbered migration files: **87**, versions `001` through `087), inclusive.
- Dated migration files: **4**, versions `20261018` through `20261021`.
- Production `schema_migrations` ledger: **92 rows**.
- Production ledger records numbered versions `001`–`087`, version `096`, and dated versions `20261018`–`20261021`.
- Production ledger does not record versions `088`–`095`.
- Current-main active migration source does not contain `096_verification_authorization_provenance.sql`, although production records it.

## Current-main source manifest

### Numbered files (87)

- `001_core.sql`
- `002_regulatory.sql`
- `003_identity_geography_operations.sql`
- `004_security_auth.sql`
- `005_carbon_epr_esg.sql`
- `006_registry_settlement_guardrails.sql`
- `007_resource_flow_mrv.sql`
- `008_verification_integrity.sql`
- `009_field_sync.sql`
- `010_integrity_controls.sql`
- `011_field_sync_application.sql`
- `012_geography_authorization.sql`
- `013_settlement_external_confirmation.sql`
- `014_registry_settlement_idempotency.sql`
- `015_guardian_hedera_mrv.sql`
- `016_field_device_enrollment.sql`
- `017_field_device_provenance.sql`
- `018_value_mutation_permissions.sql`
- `019_settlement_reconciliation_immutability.sql`
- `020_carbon_calculation_provenance.sql`
- `021_methodology_governance.sql`
- `022_carbon_provenance_integrity.sql`
- `023_lifecycle_state_guards.sql`
- `024_methodology_governance_immutability.sql`
- `025_methodology_reconciliation_evidence.sql`
- `026_regulatory_source_provenance.sql`
- `027_verification_permission_hardening.sql`
- `028_settlement_retired_credential_guard.sql`
- `029_stakeholder_onboarding.sql`
- `030_authorization_role_defaults.sql`
- `031_settlement_credential_owner_authorization.sql`
- `032_authorization_lifecycle_hardening.sql`
- `033_field_sync_tenant_integrity.sql`
- `034_operation_sync_device_binding.sql`
- `035_cpcb_epr_portal_baseline.sql`
- `036_bwg_epr_esg_reporting.sql`
- `037_bwg_regulatory_registration_state.sql`
- `038_bwg_registration_unknown_default.sql`
- `039_india_regulatory_requirements.sql`
- `040_india_regulatory_extensions.sql`
- `041_high_risk_action_permissions.sql`
- `042_india_regulatory_requirement_catalog.sql`
- `043_bwg_epr_invariants.sql`
- `044_bwg_reporting_requires_applicability.sql`
- `045_guardian_mrv_registry_provenance_integrity.sql`
- `046_epr_credit_allocation_integrity.sql`
- `047_settlement_party_integrity.sql`
- `048_settlement_party_integrity_compatibility.sql`
- `049_credential_geography_integrity.sql`
- `050_field_sync_conflict_audit.sql`
- `051_registry_transfer_recipient_integrity.sql`
- `052_stakeholder_approval_guard.sql`
- `053_authoritative_regulatory_baseline.sql`
- `054_circular_economy_carbon_regulatory_baseline.sql`
- `055_carbon_market_mechanisms.sql`
- `056_environmental_attribute_claim_controls.sql`
- `057_environmental_attribute_allocation_api.sql`
- `058_environmental_attribute_reporting_references.sql`
- `059_epr_credit_environmental_claims.sql`
- `060_brsr_structured_reporting.sql`
- `061_brsr_metadata_projection.sql`
- `062_stakeholder_onboarding_governance.sql`
- `063_organization_legal_verification.sql`
- `064_statutory_applicability_controls.sql`
- `065_governance_integrity_and_profile_seeding.sql`
- `066_organization_governance_cleanup.sql`
- `067_epr_scheme_catalog.sql`
- `068_epr_lifecycle_controls.sql`
- `069_epr_evidence_guards.sql`
- `070_epr_obligations_returns.sql`
- `071_epr_return_obligation_binding.sql`
- `072_epr_external_reference_uniqueness.sql`
- `073_settlement_integrity.sql`
- `074_settlement_party_integrity.sql`
- `075_settlement_registry_owner_integrity.sql`
- `076_settlement_reconciliation_reference_uniqueness.sql`
- `077_hierarchical_stakeholder_onboarding.sql`
- `078_stakeholder_approval_separation.sql`
- `079_native_password_auth.sql`
- `080_geography_created_at.sql`
- `081_acceptance_fixture_geography.sql`
- `082_super_admin_identity_governance.sql`
- `083_mrv_mirror_node_registry_gate.sql`
- `084_platform_audit_chain_head.sql`
- `085_platform_access_dual_control.sql`
- `086_reserved_role_restoration_db_guard.sql`
- `087_acceptance_fixture_registry_exclusion.sql`

### Dated files (4)

- `20261018_cpcb_swm_stakeholder_workspaces.sql`
- `20261019_cpcb_bwg_workflow_tracking.sql`
- `20261020_ccts_methodology_registry.sql`
- `20261021_evidence_artifact_vault.sql`

## Production-only ledger/source discrepancy

Production records `096_verification_authorization_provenance.sql`, which is absent from current-main. Git history:
- Introduced by `ca8f4100782e13f8d72106187fafc8e1e446214f`.
- Removed by `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` with message “Remove accidentally placed unreviewed verification migration from main”.
- Recovered original blob: `258b1f4534efbf915688f78aa84d4ec24a47cbc0`.

Exact recovered SQL and security analysis are preserved in [Recovered migration 096 review](../security/RECOVERED_MIGRATION_096_REVIEW_2026-11-04.md).

## README inconsistencies corrected by this inventory

- README's former statement that migration 023 is absent is false: `023_lifecycle_state_guards.sql` exists in current main and is recorded in production.
- The former numbered inventory stopped at 028, omitting 029–087 and all dated files.
- The former README assigned high-risk permission work to 015, but current source 015 is `015_guardian_hedera_mrv.sql`; high-risk permission logic is `041_high_risk_action_permissions.sql`.

## Reconciliation rules

1. Never rewrite or delete production ledger rows.
2. Never replay migration 096 or restore it under its historical number.
3. Do not infer that absent versions 088–095 should be applied; establish exact provenance and intended branch/deployment history first.
4. Compare checksums, function definitions, trigger definitions, schema objects and deployment artifact provenance—not filenames alone.
5. Preserve staging-only migrations 20261022–20261025 as separate, unreviewed artifacts until their exact source is recovered.
6. Any remediation must be a new, forward-only migration with a new version, tested on a disposable clone and independently reviewed.
7. Production remains READ-ONLY / HOLD pending independent DBA/security review and explicit approval.
