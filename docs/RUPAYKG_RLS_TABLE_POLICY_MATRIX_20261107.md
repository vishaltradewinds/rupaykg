# RupayKg tenant-isolation table policy matrix

**Snapshot:** 7 November 2026  
**Repository:** `vishaltradewinds/rupaykg`  
**Validation branch:** `shakti/tenant-isolation-rls-rehearsal-2026-11-06`  
**Database evidence:** Neon `rupaykg-production-fresh` / `main` / `rupaykg` (read-only catalog inspection)

## Release posture

Production tenant isolation remains **BLOCKED / HOLD**. The read-only authoritative Neon inspection found 67 public ordinary tables, 0 with RLS enabled, 0 with FORCE RLS, and 0 public RLS policies. The production application login was observed with `BYPASSRLS`. No production schema, role, grant, data, deployment or release setting was changed.

The Batch C disposable PostgreSQL CI rehearsal passed on exact PR head `9176189cd16a93c4f4695b2453113a5d9512000d` in workflow run `42278459372`. It validates candidate behavior only and does not change the production result.

## 1. Complete catalog classification

| Classification | Tables | Required access model |
|---|---:|---|
| Tenant-owned direct anchors | 19 | Explicit organization context, with table-specific predicates and write checks |
| Tenant-owned indirect FK paths | 17 | Derive ownership through reviewed FK path and validate parent visibility |
| Tenant authorization controls | 4 | Identity, verified membership, explicit permission and lifecycle checks |
| Tenant audit controls | 2 | Tenant visibility plus append-only, actor and parent consistency |
| Multi-party controls | 9 | Explicit participant-specific visibility and action-specific write authority |
| Identity security controls | 4 | Identity-scoped/authentication service access; no organization-wide exposure |
| Global reference tables | 8 | Least-privilege shared read access; governed writes |
| Platform controls | 3 | Platform governance / owner-only / migration service access |
| Unresolved legacy surface | 1 | Hold broad runtime access pending ownership and route reconciliation |
| **Total** | **67** | **All current public ordinary tables classified** |

### Tenant-owned direct anchors (19)

`activities`, `bwg_profiles`, `bwg_reporting_periods`, `carbon_projects`, `cpcb_swm_stakeholder_workspaces`, `environmental_attribute_claims`, `epr_returns`, `esg_reporting_periods`, `evidence_artifact_series`, `field_devices`, `obligations`, `organization_bwg_assessments`, `organization_epr_applicability`, `organization_geography_scopes`, `organization_statutory_profiles`, `organization_verification_evidence`, `organizations`, `resource_flows`, `stakeholder_applications`.

These are the direct organization anchors and root. A direct `organization_id` does not by itself define all write authority; field-device ownership, stakeholder onboarding and reporting boundaries still need route-level checks.

### Tenant-owned indirect FK paths (17)

`activity_assignments`, `bwg_epr_reports`, `bwg_esg_reports`, `carbon_calculations`, `epr_obligations`, `esg_metrics`, `evidence`, `evidence_artifact_reviews`, `evidence_artifact_versions`, `evidence_verification_requirements`, `field_sync_conflicts`, `field_sync_cursors`, `field_sync_envelopes`, `measurements`, `mrv_observations`, `mrv_provenance_events`, `verifications`.

The policy must traverse the intended parent path and fail closed when the parent or tenant context is missing. MRV and verification evidence additionally require their integrity, immutability and authorization controls to remain effective.

### Tenant authorization controls (4)

`organization_memberships`, `roles`, `platform_access_change_requests`, `stakeholder_application_approvals`.

Do not authorize by role name. Membership identity, exact organization, active/verified status, permission keys, approver authority and lifecycle state must be resolved by the actual access path. `platform_access_change_requests` is a controlled cross-identity workflow and must not inherit a generic `organization_id` predicate. The existing disposable rehearsal includes `stakeholder_application_approvals` in a narrow application-parent FK test; the other three authorization-control tables remain untested by Batch C.

### Tenant audit controls (2)

`audit_events`, `cpcb_swm_status_history`.

`audit_events.organization_id` is nullable, so tenant-bound and platform-level events require distinct access rules. `cpcb_swm_status_history` carries both workspace and organization identifiers; policy and write validation must prove those references agree. Preserve audit integrity and append-only behavior.

### Multi-party controls (9)

`bwg_waste_reports`, `chain_of_custody_links`, `credentials`, `epr_credit_allocations`, `epr_credit_transfers`, `epr_credits`, `registry_events`, `settlements`, `settlement_events`.

These represent producer/processor, issuer/holder, sender/recipient, payer/payee, obligation/credit and other multi-organization relationships. A single `current_org_id()` filter can hide legitimate counterparties or permit cross-party writes. Define participant-specific SELECT and action-specific write authority first; test every legitimate party and an unauthorized third party. Do not enable blanket single-tenant RLS merely to increase a coverage count.

### Identity security controls (4)

`identities`, `identity_credentials`, `identity_password_credentials`, `identity_sessions`.

Scope these by identity and dedicated authentication/service operations. Password hashes, salts, tokens, credentials and session state must not be exposed merely because an organization is in context.

### Global reference tables (8)

`carbon_market_mechanisms`, `ccts_methodology_registry`, `epr_schemes`, `geography`, `geography_sources`, `methodology_versions`, `regulatory_requirements`, `regulatory_sources`.

These are shared reference/catalogue surfaces. Runtime access should be least-privilege, normally read-only for consuming services. Governance, approval and publication writes must be separate from tenant DML.

### Platform controls (3)

`methodology_governance_evidence`, `platform_audit_chain_head`, `schema_migrations`.

These are governed by migration, platform-integrity or governance roles, not ordinary tenant sessions. `schema_migrations` must not be writable by the runtime application role.

### Unresolved legacy surface (1)

`operation_sync_envelopes`.

This legacy envelope table has actor/device fields but no declared foreign key proving device-to-organization binding. Do not classify it as public reference data. Reconcile every route, worker, device identity and payload scope; until then keep broad runtime access blocked and include it in the cutover deny list.

## 2. Batch C policy rehearsal coverage

The following 20 tables had candidate RLS policies exercised using two distinct non-owner `NOBYPASSRLS` test roles, with SELECT/INSERT/UPDATE/DELETE, transaction-local context and fail-closed context checks in the disposable test database:

`organizations`, `activities`, `evidence`, `measurements`, `mrv_observations`, `epr_obligations`, `activity_assignments`, `bwg_epr_reports`, `bwg_esg_reports`, `carbon_calculations`, `esg_metrics`, `evidence_artifact_reviews`, `evidence_artifact_versions`, `evidence_verification_requirements`, `field_sync_cursors`, `field_sync_envelopes`, `field_sync_conflicts`, `mrv_provenance_events`, `stakeholder_application_approvals`, `verifications`.

Coverage within the classification above:
- All 17 tenant-owned indirect FK paths were included.
- 2 of 19 tenant-owned direct anchors were included: `organizations` and `activities`.
- 1 of 4 tenant authorization controls was included: `stakeholder_application_approvals`.
- 31 of the 51 single-tenant, authorization, audit and multi-party surfaces remain outside Batch C coverage: 17 direct anchors, 3 authorization controls, 2 audit controls and 9 multi-party controls.

Identity, platform and global-reference surfaces require separate privilege models and are not counted as ordinary tenant-policy targets. `operation_sync_envelopes` is separately unresolved and is not part of the 31-table figure.

## 3. Required next batch

1. Exercise the remaining 17 direct tenant anchors with explicit `USING` and `WITH CHECK` predicates, cross-tenant CRUD negatives, null/unknown organization cases and service-role tests.
2. Design and test the three untested authorization controls: `organization_memberships`, `roles` and `platform_access_change_requests`. Include verified membership, permission keys, suspension/revocation, role mutation and cross-organization approver cases.
3. Add tenant-audit tests for nullable platform events, workspace/organization consistency, append-only constraints and unauthorized actor writes.
4. Define multi-party participant visibility and write authority for all nine surfaces; test each legitimate party and a non-participant before selecting policy semantics.
5. Map and deny broad application access to `operation_sync_envelopes` until ownership, route and worker linkage is proven.
6. Rehearse the final policies under the exact proposed runtime identity with `NOBYPASSRLS`, no table ownership, no DDL and least-privilege grants; test transaction and pooled-connection context reset.
7. Inventory every API route, server action, job, worker, direct SQL path and export before any production rollout. Obtain independent security/DBA review, deployed runtime identity proof, backup/restore proof and a founder-approved cutover plan.

## 4. Non-negotiable evidence boundary

- These classifications are a dated catalog-derived plan, not a production RLS migration.
- Candidate SQL and disposable CI do not establish production tenant isolation or TRL 5.
- The authoritative Neon `main` remains unchanged and read-only in this workstream.
- Do not promote this matrix to production policy until exact predicates, route/workflow compatibility, privilege shape, two-organization tests, rollback and independent review all pass.
- Overall TRL remains bounded by the critical integrated-system dependencies; successful Batch C CI alone does not change the provisional software TRL 4 determination.

## 5. Catalog validation

The updated CI inventory script now applies explicit classifications for authorization, audit, multi-party, identity-security, platform and unresolved legacy surfaces rather than accepting its initial FK heuristic as the final access model. It asserts the category counts above and fails closed if the 67-table catalogue or any category count drifts.
