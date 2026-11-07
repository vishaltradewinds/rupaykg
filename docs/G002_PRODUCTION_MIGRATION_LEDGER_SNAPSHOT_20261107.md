# Production Migration Ledger Snapshot — 2026-11-07

Source: read-only query against Neon project `rupaykg-production-fresh`, project `steep-mud-79906940`, primary branch `main` (`br-restless-base-b44cip2h`), database `rupaykg`.

## Result

- Production `public.schema_migrations`: **92 rows**
- Repository migration SQL inventory established by prior primary-repository audit: **91 SQL files**
- Production ledger contains an additional migration row not present as a matching SQL file in the primary repository:
  - version: `096`
  - filename: `096_verification_authorization_provenance.sql`
  - applied: `2026-10-27T13:46:14.262Z`

## Ordered production ledger

```text
001  001_core.sql
002  002_regulatory.sql
003  003_identity_geography_operations.sql
004  004_security_auth.sql
005  005_carbon_epr_esg.sql
006  006_registry_settlement_guardrails.sql
007  007_resource_flow_mrv.sql
008  008_verification_integrity.sql
009  009_field_sync.sql
010  010_integrity_controls.sql
011  011_field_sync_application.sql
012  012_geography_authorization.sql
013  013_settlement_external_confirmation.sql
014  014_registry_settlement_idempotency.sql
015  015_guardian_hedera_mrv.sql
016  016_field_device_enrollment.sql
017  017_field_device_provenance.sql
018  018_value_mutation_permissions.sql
019  019_settlement_reconciliation_immutability.sql
020  020_carbon_calculation_provenance.sql
021  021_methodology_governance.sql
022  022_carbon_provenance_integrity.sql
023  023_lifecycle_state_guards.sql
024  024_methodology_governance_immutability.sql
025  025_methodology_reconciliation_evidence.sql
026  026_regulatory_source_provenance.sql
027  027_verification_permission_hardening.sql
028  028_settlement_retired_credential_guard.sql
029  029_stakeholder_onboarding.sql
030  030_authorization_role_defaults.sql
031  031_settlement_credential_owner_authorization.sql
032  032_authorization_lifecycle_hardening.sql
033  033_field_sync_tenant_integrity.sql
034  034_operation_sync_device_binding.sql
035  035_cpcb_epr_portal_baseline.sql
036  036_bwg_epr_esg_reporting.sql
037  037_bwg_regulatory_registration_state.sql
038  038_bwg_registration_unknown_default.sql
039  039_india_regulatory_requirements.sql
040  040_india_regulatory_extensions.sql
041  041_high_risk_action_permissions.sql
042  042_india_regulatory_requirement_catalog.sql
043  043_bwg_epr_invariants.sql
044  044_bwg_reporting_requires_applicability.sql
045  045_guardian_mrv_registry_provenance_integrity.sql
046  046_epr_credit_allocation_integrity.sql
047  047_settlement_party_integrity.sql
048  048_settlement_party_integrity_compatibility.sql
049  049_credential_geography_integrity.sql
050  050_field_sync_conflict_audit.sql
051  051_registry_transfer_recipient_integrity.sql
052  052_stakeholder_approval_guard.sql
053  053_authoritative_regulatory_baseline.sql
054  054_circular_economy_carbon_regulatory_baseline.sql
055  055_carbon_market_mechanisms.sql
056  056_environmental_attribute_claim_controls.sql
057  057_environmental_attribute_allocation_api.sql
058  058_environmental_attribute_reporting_references.sql
059  059_epr_credit_environmental_claims.sql
060  060_brsr_structured_reporting.sql
061  061_brsr_metadata_projection.sql
062  062_stakeholder_onboarding_governance.sql
063  063_organization_legal_verification.sql
064  064_statutory_applicability_controls.sql
065  065_governance_integrity_and_profile_seeding.sql
066  066_organization_governance_cleanup.sql
067  067_epr_scheme_catalog.sql
068  068_epr_lifecycle_controls.sql
069  069_epr_evidence_guards.sql
070  070_epr_obligations_returns.sql
071  071_epr_return_obligation_binding.sql
072  072_epr_external_reference_uniqueness.sql
073  073_settlement_integrity.sql
074  074_settlement_party_integrity.sql
075  075_settlement_registry_owner_integrity.sql
076  076_settlement_reconciliation_reference_uniqueness.sql
077  077_hierarchical_stakeholder_onboarding.sql
078  078_stakeholder_approval_separation.sql
079  079_native_password_auth.sql
080  080_geography_created_at.sql
081  081_acceptance_fixture_geography.sql
082  082_super_admin_identity_governance.sql
083  083_mrv_mirror_node_registry_gate.sql
084  084_platform_audit_chain_head.sql
085  085_platform_access_dual_control.sql
086  086_reserved_role_restoration_db_guard.sql
087  087_acceptance_fixture_registry_exclusion.sql
20261018  20261018_cpcb_swm_stakeholder_workspaces.sql
20261019  20261019_cpcb_bwg_workflow_tracking.sql
20261020  20261020_ccts_methodology_registry.sql
20261021  20261021_evidence_artifact_vault.sql
096  096_verification_authorization_provenance.sql
```

## Determination

This is a **real migration-authority mismatch**, not merely a count mismatch:

- The repository contains 91 migration SQL files.
- Production contains 92 ledger entries.
- The extra production ledger entry is explicitly identified as version `096`.
- No matching `096_verification_authorization_provenance.sql` is present in the primary repository path inspected.

## Release consequence

**G-002 remains BLOCKED.**

The missing 096 SQL must be recovered from authoritative repository history or its exact schema effect must be reconstructed from preserved evidence before migration authority can be declared reconciled.

No production migration was applied or altered during this batch.
