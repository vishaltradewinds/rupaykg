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

## 2. Validated RLS rehearsal coverage — Batch C and Batch D

### Batch C — indirect FK paths and initial anchors

The Batch C disposable PostgreSQL rehearsal passed on exact commit `da8a1a257a2b3a2258b690387cf74fe6d3e0eb73`, workflow run [#5932](https://github.com/vishaltradewinds/rupaykg/actions/runs/42370081515).

Using two distinct non-owner `NOBYPASSRLS` runtime roles, the test covers:
- All 17 tenant-owned indirect FK paths.
- The two initial direct anchors: `organizations` and `activities`.
- One tenant-authorization path: `stakeholder_application_approvals`.
- SELECT/INSERT/UPDATE/DELETE isolation, transaction-local context reset, malformed-context fail-closed behavior, multi-party authorization boundary, concurrency, worker/pool context and disposable PostgreSQL acceptance.

The 20 tables covered by Batch C are:

`organizations`, `activities`, `evidence`, `measurements`, `mrv_observations`, `epr_obligations`, `activity_assignments`, `bwg_epr_reports`, `bwg_esg_reports`, `carbon_calculations`, `esg_metrics`, `evidence_artifact_reviews`, `evidence_artifact_versions`, `evidence_verification_requirements`, `field_sync_cursors`, `field_sync_envelopes`, `field_sync_conflicts`, `mrv_provenance_events`, `stakeholder_application_approvals`, `verifications`.

### Batch D — remaining 17 direct tenant anchors

The Batch D test is in `scripts/test-direct-tenant-anchors-batch-d.sql`. It passed on exact commit `5bfb5cad74e881a5b8c3232ab0eda934cef0f6eb`, workflow run [#5944](https://github.com/vishaltradewinds/rupaykg/actions/runs/42372289508). The entire workflow passed, including production dependency audit, migration validation/execution, typecheck, build, browser smoke, updated catalog inventory, Batch C, Batch D, policy-family CRUD, multi-party and concurrency checks, pooled-worker context, disposable PostgreSQL acceptance and production-container build.

The 17 direct tenant tables tested in Batch D are:

`bwg_profiles`, `bwg_reporting_periods`, `carbon_projects`, `cpcb_swm_stakeholder_workspaces`, `environmental_attribute_claims`, `epr_returns`, `esg_reporting_periods`, `evidence_artifact_series`, `field_devices`, `obligations`, `organization_bwg_assessments`, `organization_epr_applicability`, `organization_geography_scopes`, `organization_statutory_profiles`, `organization_verification_evidence`, `resource_flows`, `stakeholder_applications`.

Batch D exercises the direct-anchor policies under two non-owner `NOBYPASSRLS` test roles:
- Org A and Org B see their own direct-tenant rows and cannot enumerate the other tenant's rows.
- Each organization can update its own fixture rows; delete attempts against the other organization's fixture rows affect zero rows.
- Cross-tenant inserts are denied by the target table's RLS `WITH CHECK`.
- Unassigned `field_devices` are not visible in either tenant context.
- `stakeholder_applications` applicant self-service is identity-scoped even within the same organization; another applicant cannot enumerate the row.
- Missing/malformed organization or identity context fails closed across the 17 tables.
- Transaction-local organization and identity context is cleared after commit.

Two live domain guards needed special handling so their errors would not preempt the target-table RLS assertions: BWG reporting-period creation checks for a verified BWG profile; EPR return creation locks and validates the referenced EPR obligation. In disposable CI only, temporary `SELECT`/appropriate `FOR UPDATE` fixture policies are installed on those prerequisite tables for the corresponding cross-tenant insert assertion, then dropped before tenant visibility is rechecked. These temporary policies are test-harness scaffolding, not proposed application or production policies.

**Applicant/reviewer distinction:** Batch D establishes the applicant's identity-scoped self-service boundary for `stakeholder_applications`; it does not yet establish the separate reviewer/approver access workflow. That workflow remains within the authorization-control workstream.

### Current coverage summary

| Classification | Total tables | Validated | Remaining |
|---|---:|---:|---:|
| Tenant-owned direct anchors | 19 | 19 | 0 |
| Tenant-owned indirect FK paths | 17 | 17 | 0 |
| Tenant authorization controls | 4 | 1 | 3 |
| Tenant audit controls | 2 | 0 | 2 |
| Multi-party controls | 9 | 0 | 9 |
| **Tenant/auth/audit/multi-party surfaces** | **51** | **37** | **14** |

The one authorization control validated to date is `stakeholder_application_approvals`, exercised in Batch C through its application-parent FK path. The three authorization controls still requiring dedicated policy design/tests are `organization_memberships`, `roles` and `platform_access_change_requests`.

The two audit controls still requiring dedicated tests are `audit_events` and `cpcb_swm_status_history`.

The nine multi-party surfaces still requiring explicit participant-specific read/write semantics are `bwg_waste_reports`, `chain_of_custody_links`, `credentials`, `epr_credit_allocations`, `epr_credit_transfers`, `epr_credits`, `registry_events`, `settlements` and `settlement_events`.

Identity-security (4), global-reference (8) and platform-control (3) surfaces require their own least-privilege/service-role assurance and are not ordinary tenant policy targets. `operation_sync_envelopes` remains a separately unresolved legacy surface and is not included in the 51 or the 14 remaining surfaces.

## 3. Required next batch

1. Design and test the three untested authorization controls: `organization_memberships`, `roles` and `platform_access_change_requests`. Include verified membership, exact-organization binding, explicit permission keys, suspended/revoked identities, role mutation and cross-organization approver cases.
2. Add tenant-audit tests for nullable platform-level events, workspace/organization consistency, append-only behavior, actor authorization, and unauthorized mutation.
3. Define participant-specific visibility and action-specific write authority for all nine multi-party surfaces. Test every legitimate counterparty and an unauthorized third party; preserve settlement, EPR credit, credential and registry integrity.
4. Complete independent reviewer/approver workflow tests for `stakeholder_applications`; Batch D only establishes identity-scoped applicant self-service.
5. Map and deny broad application access to `operation_sync_envelopes` until ownership, device linkage, routes and workers are reconciled.
6. Rehearse final policies and the full route/worker model under the exact proposed runtime identity with `NOBYPASSRLS`, no table ownership, no DDL and least-privilege grants; test pooled connection reuse and worker context reset.
7. Inventory every API route, server action, job, worker, export and direct SQL path before any production rollout. Obtain independent security/DBA review, deployed runtime identity proof, backup/restore proof and a founder-approved cutover plan.

## 4. Non-negotiable evidence boundary

- These classifications are a dated catalog-derived plan, not a production RLS migration.
- Candidate SQL and disposable CI do not establish production tenant isolation or TRL 5.
- The authoritative Neon `main` remains unchanged and read-only in this workstream.
- Do not promote this matrix to production policy until exact predicates, route/workflow compatibility, privilege shape, two-organization tests, rollback and independent review all pass.
- Overall TRL remains bounded by the critical integrated-system dependencies; successful Batch C CI alone does not change the provisional software TRL 4 determination.

## 5. Catalog validation

The updated CI inventory script now applies explicit classifications for authorization, audit, multi-party, identity-security, platform and unresolved legacy surfaces rather than accepting its initial FK heuristic as the final access model. It asserts the category counts above and fails closed if the 67-table catalogue or any category count drifts.
