# Production trigger and tenant-boundary audit — 2026-11-02

**Scope:** read-only live production catalog inspection and function-body review.  
**Database:** Neon project `steep-mud-79906940`, primary branch `br-restless-base-b44cip2h`, database `rupaykg`.  
**Status:** engineering findings only; no production schema, privilege, role, data, secret, deployment or worker changes.

## Executive result

- 70 enabled public non-internal trigger instances were enumerated with table, trigger name, event definition, function name and owner.
- They invoke 67 distinct application-owned trigger functions (three function routines are attached to duplicate trigger definitions).
- All inventoried application trigger functions are SECURITY INVOKER; no function-level `search_path` setting was present in `proconfig`.
- 2 trigger functions were flagged for membership checks without organization scoping. One is a platform-governance trigger; the other is a verifier eligibility guard. They need explicit policy intent and negative tests.
- The verifier's second integrity trigger performs an organization-scoped membership/permission check for APPROVED decisions and snapshots the authorizing membership/role/permissions. Therefore the global verifier trigger is a defense-in-depth inconsistency, not proof by itself that an unapproved cross-tenant identity can approve. Preserve this distinction in remediation.
- Geography authorization helper returns TRUE if the organization has no VERIFIED geography scopes. This is an explicit fail-open default and remains a P0 policy decision.
- No trigger-level security remediation is safe to deploy until runtime-role behavior, trigger table access, function execute privileges and all calling routes/workers are tested on a disposable database.

## Trigger instances and attached functions

| Table | Trigger | Function |
|---|---|---|
| activities | activity_geography_scope_guard | enforce_activity_geography_scope |
| bwg_reporting_periods | bwg_reporting_period_requires_applicability | require_applicable_bwg_profile_for_reporting_period |
| carbon_calculations | carbon_calculation_mechanism_guard | enforce_carbon_methodology_mechanism |
| carbon_calculations | carbon_calculation_provenance_guard | prevent_carbon_provenance_mutation |
| carbon_calculations | carbon_calculation_reporting_reference | record_carbon_calculation_reporting_reference |
| credentials | credential_lifecycle_guard | enforce_credential_lifecycle |
| credentials | credentials_geography_guard | prevent_credential_out_of_scope_issue |
| credentials | credentials_reject_retirement_with_open_settlement | prevent_credential_retirement_with_open_settlement |
| credentials | credentials_require_guardian_hcs_mrv | require_guardian_hcs_mrv_for_credential |
| credentials | credentials_verification_guard | prevent_unverified_credential_issue |
| environmental_attribute_claims | environmental_attribute_double_claim_guard | prevent_environmental_attribute_double_claim |
| epr_credit_allocations | epr_credit_allocation_capacity | enforce_epr_credit_allocation_capacity |
| epr_credit_transfers | epr_transfer_evidence_guard | enforce_epr_transfer_evidence |
| epr_credit_transfers | epr_transfer_quantity_guard | enforce_epr_transfer_quantity |
| epr_credits | epr_credit_environmental_claim | record_epr_credit_value_claim |
| epr_returns | epr_return_quantity_guard | enforce_epr_return_quantity |
| esg_metrics | esg_metrics_brsr_metadata_projection | project_esg_brsr_metadata |
| evidence | evidence_vault_pointer_immutable | prevent_evidence_vault_pointer_mutation |
| evidence_artifact_reviews | evidence_artifact_reviews_append_only | prevent_evidence_artifact_review_mutation |
| evidence_artifact_versions | evidence_artifact_versions_immutable | prevent_evidence_artifact_version_mutation |
| field_devices | field_device_identity_mutation_guard | prevent_field_device_identity_mutation |
| field_sync_conflicts | field_sync_conflict_resolution_audit | audit_field_sync_conflict_resolution |
| field_sync_envelopes | field_sync_append_only_guard | prevent_field_sync_mutation |
| field_sync_envelopes | field_sync_envelope_binding_guard | enforce_field_sync_envelope_binding |
| field_sync_envelopes | field_sync_payload_hash_guard | field_sync_payload_hash |
| methodology_governance_evidence | methodology_governance_evidence_immutability_guard | prevent_methodology_governance_evidence_mutation |
| methodology_versions | methodology_governance_immutability_guard | enforce_methodology_governance_immutability |
| methodology_versions | methodology_governance_requirements_guard | enforce_methodology_governance_requirements |
| mrv_provenance_events | mrv_anchor_change_clears_mirror_verification | clear_mrv_mirror_verification_on_anchor_change |
| operation_sync_envelopes | operation_sync_device_binding_guard | enforce_operation_sync_device_binding |
| organization_epr_applicability | epr_external_registration_evidence_guard | enforce_epr_external_registration_evidence |
| organization_epr_applicability | trg_validate_epr_external_registration | validate_epr_external_registration_integrity |
| organization_memberships | stakeholder_membership_application_guard | prevent_direct_membership_activation |
| organization_memberships | verified_membership_permission_guard | enforce_verified_membership_role_permissions |
| organization_statutory_profiles | trg_validate_statutory_profile | validate_statutory_profile_integrity |
| organization_verification_evidence | trg_validate_organization_verification_evidence | validate_organization_evidence_integrity |
| organizations | trg_seed_organization_governance_profile | ensure_organization_governance_profile |
| organizations | trg_validate_organization_verification | validate_organization_verification_integrity |
| registry_events | registry_event_append_only | reject_registry_event_update |
| registry_events | registry_event_hash_anchor | anchor_registry_event_hash |
| registry_events | registry_event_hash_guard | hash_registry_event |
| registry_events | registry_events_append_only | reject_registry_event_update |
| registry_events | registry_high_risk_permission_guard | enforce_registry_event_permission |
| registry_events | registry_transfer_recipient_guard | prevent_unverified_registry_transfer_recipient |
| registry_events | registry_transfer_settlement_guard | prevent_transfer_with_open_settlement |
| resource_flows | resource_flow_geography_scope_guard | enforce_resource_flow_geography_scope |
| roles | roles_default_permissions_guard | apply_rupaykg_role_defaults |
| settlement_events | settlement_confirmation_reference_guard | persist_settlement_confirmation_reference |
| settlement_events | settlement_event_append_only | reject_settlement_event_update |
| settlement_events | settlement_event_hash_anchor | anchor_settlement_event_hash |
| settlement_events | settlement_event_hash_guard | hash_settlement_event |
| settlement_events | settlement_events_append_only | reject_settlement_event_update |
| settlement_events | settlement_high_risk_permission_guard | enforce_settlement_event_permission |
| settlements | settlement_confirmation_mutation_guard | prevent_settlement_confirmation_mutation |
| settlements | settlement_lifecycle_guard | enforce_settlement_lifecycle |
| settlements | settlement_registry_owner_guard | enforce_settlement_registry_owner |
| settlements | settlements_confirmation_rollback_guard | prevent_confirmation_rollback |
| settlements | settlements_credential_owner_authorization | enforce_settlement_credential_owner_authorization |
| settlements | settlements_external_confirmation_guard | prevent_unconfirmed_settlement_finalization |
| settlements | settlements_external_reference_immutability | enforce_settlement_external_reference_immutability |
| settlements | settlements_party_integrity | enforce_settlement_party_integrity |
| settlements | settlements_registry_owner_guard | enforce_settlement_registry_owner |
| settlements | settlements_reject_retired_credential | prevent_settlement_for_retired_credential |
| settlements | settlements_verification_guard | prevent_unverified_settlement |
| stakeholder_application_approvals | stakeholder_approval_separation_guard | prevent_stakeholder_self_approval |
| stakeholder_applications | stakeholder_application_chain_seed | rupaykg_seed_stakeholder_approval_chain |
| stakeholder_applications | stakeholder_approval_authority_guard | prevent_unauthorized_stakeholder_approval |
| stakeholder_applications | stakeholder_hierarchy_completion_guard | prevent_incomplete_hierarchical_stakeholder_approval |
| verifications | verification_independence_guard | enforce_verification_independence |
| verifications | verifications_integrity_guard | prevent_invalid_verification |

## Priority findings

### F-TRG-01 — geography default is fail-open

`organization_has_geography_scope(organization_id, geography_id)` returns TRUE when no VERIFIED geography-scope row exists for the organization. This allows geography-scoped operations to pass without an explicitly verified scope.

**Decision required:** define whether an organization without scope must be denied, receives an explicitly recorded national scope, or receives another governed scope. For a pan-India platform, national scope must be represented as an explicit verified authority record; it must not be inferred from missing data. Add tests for missing scope, pending scope, verified exact scope, verified ancestor scope and out-of-scope geography. Do not change the helper until that policy is approved and all callers are understood.

### F-TRG-02 — verifier trigger uses global membership lookup

`enforce_verification_independence()` checks for any VERIFIED membership with VERIFY_EVIDENCE permission or VERIFIER/AUDITOR role, without constraining the membership to the activity's organization. It also does not check identity status/suspension in that lookup.

A second trigger, `prevent_invalid_verification()`, does enforce activity organization, VERIFIED membership, VERIFIED identity, non-suspended identity and the accepted approval permissions when decision is APPROVED; it records authorization membership/role/permission snapshots. This second check is the stronger approved-decision boundary.

**Required change:** make the independence trigger derive the evidence activity and organization, require identity VERIFIED and not suspended, and use a VERIFIED membership in that same organization. Keep the independent actor/verifier separation check. Add two-tenant tests for same-tenant verifier, foreign-tenant-only verifier, pending membership, suspended identity, actor self-verification, and approved versus non-approved decisions. Do not relax the stronger integrity trigger.

### F-TRG-03 — platform stakeholder approval uses global platform-role lookup

`prevent_unauthorized_stakeholder_approval()` permits a verified platform_admin/super_admin membership from any organization, without checking the reviewer's identity status or suspension. A platform-wide authority may legitimately be global, so this is not automatically a tenant leak. The intended platform governance model must explicitly establish whether the role is a reserved platform role or merely an organization role with a matching name.

**Required change:** bind approval to the reserved platform-governance role registry / trusted platform authority, require active non-suspended identity and VERIFIED authority, and test that an ordinary organization administrator cannot approve another stakeholder's application. Preserve separation-of-duties and hierarchical approval triggers.

### F-TRG-04 — trigger functions have no pinned search_path

All 67 distinct application trigger functions are SECURITY INVOKER and have NULL `proconfig` in the inspected production snapshot. Review object resolution for every function. Schema-qualify security-sensitive tables/functions/extensions; pin safe search_path where appropriate and test under a restricted runtime role. SECURITY INVOKER is preferred for integrity triggers; do not convert them to SECURITY DEFINER as a blanket fix.

### F-TRG-05 — runtime grants and RLS behavior remain unknown/unproven

Current production has 67 public base tables, 0 RLS and 0 FORCE RLS. The inspected `rupaykg` role is BYPASSRLS and privileged. All 78 app-owned public functions have PUBLIC EXECUTE; 67 distinct trigger functions are attached to triggers. PUBLIC EXECUTE does not by itself grant underlying table privileges to a SECURITY INVOKER function, but the effective privileges of the real connection role and trigger execution paths must be tested. No blanket revoke or grant is authorized by this audit.

## Tenant schema notes

The 67-table classification in PR #198 remains the controlling design inventory. This live schema scan confirms the schema uses a mix of:
- direct organization keys (`organization_id`);
- alternate ownership keys (`issuer_organization_id`, `from_organization_id`, `to_organization_id`, payer/payee);
- derived tenant paths through activity, evidence, reporting period, device, credential, settlement and application foreign keys;
- identity-private/auth tables;
- global statutory/geography/methodology catalogues;
- multi-party and system-control tables.

Absence of `organization_id` does not mean a table is global or unowned. The PR #198 design already classifies all 67 tables and calls out 15 tables not directly found in 16 API modules, requiring trigger/worker/migration tracing. This trigger audit now supplies a concrete part of that missing database-side trace, but it does not close every route/worker call graph.

## Required next batch

1. Reconcile F-TRG-01 policy with statutory/geographic authority model; represent pan-India authority explicitly.
2. Implement same-organization verifier membership in `enforce_verification_independence` on disposable PostgreSQL only, with the two-tenant negative test matrix.
3. Harden platform stakeholder approval to require reserved platform governance authority and active identity, after confirming platform role model.
4. Complete per-trigger object reference/search_path/role privilege review under proposed NOBYPASSRLS runtime and owner roles.
5. Trace direct call sites for all 11 non-trigger application functions and database trigger side effects for all 67 tables.
6. Run RLS migration and trigger regression tests against a fresh disposable production snapshot. Do not promote any lab change to production.
7. Obtain independent security/DBA approval before production changes.

## CI and release posture

- PR #192 current exact-head CI: SUCCESS.
- PR #213 current exact-head CI: SUCCESS; remains draft and requires target-base metadata reconciliation and independent review.
- PR #193 current exact-head CI: SUCCESS (run 41500716186).
- PR #194 current exact-head CI: SUCCESS (run 41500726098).
- PR #204 documentation branch CI: IN PROGRESS (run 41500882768).
- Production: READ-ONLY / HOLD. EPR read flag OFF. Worker OFF. Certification OFF. TRL 9 NOT ESTABLISHED.

This is a catalog/source first-pass audit, not a penetration test or proof of safe runtime behavior. All findings require disposable integration tests and independent review.
