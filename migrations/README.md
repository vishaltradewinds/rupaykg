# Database migrations

Apply all SQL migration files discovered in `migrations/` in lexicographic filename order against a fresh PostgreSQL database. The authoritative active migration source inventory as of 2026-11-04 contains **93 SQL files**: numbered migrations `001`–`087` and six dated migrations spanning `20261018`–`20261104`.

The numbered migration sequence includes:
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

The dated migration files are:
- `20261018_cpcb_swm_stakeholder_workspaces.sql`
- `20261019_cpcb_bwg_workflow_tracking.sql`
- `20261020_ccts_methodology_registry.sql`
- `20261021_evidence_artifact_vault.sql`
- `2026110401_membership_role_tenant_binding.sql`
- `20261104_verification_authorization_tenant_binding.sql`

This manifest is maintained with the repository migration source.

**Production source-drift warning (2026-11-04):** the authoritative production ledger records `096_verification_authorization_provenance.sql`, but that file is not present in current-main source. Its exact historical SQL is preserved in the security review evidence associated with issue #214. Do not restore it under version 096, replay it, or rewrite production ledger history. Versions 088–095 are absent from the production ledger and must not be inferred as required migrations.

Migration filenames/versions are identity. Do not renumber, reuse or duplicate migration versions. The runner and validator discover numbered SQL files from the migration directory; keep this README synchronized with the source manifest.

## Membership-role tenant integrity

Migration `2026110401_membership_role_tenant_binding.sql` adds a validated composite foreign key from `(organization_memberships.role_id, organization_memberships.organization_id)` to `(roles.id, roles.organization_id)`. A membership can no longer point to a role owned by another organization, including through direct SQL writes or organization/role reassignment. Application authorization joins must retain the same organization equality as defense in depth.

## Production rule

A migration runner must stop on the first error. Never silently continue after a partial schema application. Run against a controlled migration ledger in deployment infrastructure before accepting application traffic.

Verification requires a verified organization membership with an explicit `VERIFY_EVIDENCE` permission (or one of its documented aliases). Role names such as `VERIFIER`/`AUDITOR` are not privilege grants, and an activity actor cannot approve their own evidence. Registry and settlement event hashes are generated by PostgreSQL from canonical event fields rather than trusting caller-provided hashes.

## Field-sync application rule

Receiving an offline envelope does not mutate authoritative business state. An envelope is applied only through an explicit authenticated application step. Supported operation types are deliberately allow-listed: `ACTIVITY_CREATE`, `MEASUREMENT_CREATE`, `EVIDENCE_CREATE`, and `RESOURCE_FLOW_CREATE`. The domain mutation and envelope status change commit in the same database transaction; failures roll back both.

## Geography authorization rule

An organization may have explicit verified geography roots. When roots exist, activities and resource flows are accepted only when their geography is the assigned root or a descendant of an assigned root. This is enforced in PostgreSQL so API and offline paths cannot bypass the authorization boundary. Organizations without configured geography roots remain governed by their existing organization-membership authorization until scopes are provisioned.

## Settlement truth rule

A settlement may enter `SETTLED` only when the authoritative settlement record contains an external settlement reference, an external-authority confirmation timestamp, and a reconciliation reference. These fields cannot be cleared after confirmation. Internal workflow transitions alone must never be treated as proof that funds moved.

A credential in `RETIRED` state cannot be used to create a settlement. A credential cannot be retired while it has an open settlement (`CREATED`, `AUTHORIZED`, `EXECUTING`, or `RECONCILING`). These lifecycle constraints are enforced at the PostgreSQL boundary rather than relying only on HTTP route behavior.

## Guardian/Hedera registry acceptance migration

Migration `083_mrv_mirror_node_registry_gate.sql` adds the persisted `mirror_node_verified_at` acceptance marker and tightens the PostgreSQL credential-issuance trigger. A Guardian `VERIFIED` result and Hedera `CONSENSUS_CONFIRMED` response are not sufficient by themselves; the exact anchored payload must also be successfully verified through Mirror Node. Existing provenance rows remain ineligible until that verification is performed. The authenticated Mirror Node verification endpoint checks the exact payload/hash and persists the marker only if the anchored tuple has not changed during verification. Credential issuance requires that persisted marker, and PostgreSQL independently checks it on inserts and transitions into value-bearing credential states.

## Platform-admin audit chain head

Migration `084_platform_audit_chain_head.sql` bootstraps a singleton chain head using the latest existing audit row as a migration-time anchor. Older audit writers do not all participate in the platform-admin chain, so the bootstrap is not a certification of the entire historical audit table. After cutover, platform-admin appends lock the head row inside the same transaction, use its hash as the predecessor, insert the event, and advance the head atomically. Append order therefore does not depend on transaction-start timestamps or random UUID ordering. A failed transaction rolls back both event and head update. Audit events are append-only; tests must not delete them or rewind the head.

## Reserved-role dual control

Migration `085_platform_access_dual_control.sql` records requests to grant reserved platform roles or restore a revoked reserved-role membership. The request and decision are separately authenticated, require distinct active Super Admin requester and approver identities, prohibit the target identity from approving its own change, revalidate the target and role at decision time, apply the membership change in the same transaction as approval, and append a hash-linked audit event. Ordinary membership grant and restoration routes remain blocked for reserved roles.


## Reserved-role restoration guard

Migration `086_reserved_role_restoration_db_guard.sql` protects status reactivation of a revoked `super_admin` or `platform_admin` membership. It requires a matching approved dual-control request, a different requester and approver, a target distinct from both, active Super Admin authority for requester and approver, and a request created after the revocation. Ordinary reserved-role grant/restoration APIs remain blocked; new grants are applied only by the authenticated dual-control workflow. Initial Super Admin bootstrap is an out-of-band privileged provisioning step and is not exposed through the ordinary API.


## Acceptance fixture registry exclusion

Migration `087_acceptance_fixture_registry_exclusion.sql` prevents activities or evidence explicitly marked with `metadata.acceptanceFixture=true` from backing credentials in value-bearing states. It also binds the database gate to the exact activity, verification, and evidence tuple. The MRV API reports acceptance fixtures as not registry eligible even after real Guardian/Hedera/Mirror Node verification. External anchoring proves message integrity and consensus; it does not validate the underlying activity as a real eligible carbon project.
