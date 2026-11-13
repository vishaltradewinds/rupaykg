# CTO RLS Policy Classification — Remaining 50 Public Tables

Audit date: 2026-11-13  
Repository: `vishaltradewinds/rupaykg`  
Production source: read-only PostgreSQL catalogue on Neon `rupaykg` / `br-restless-base-b44cip2h`.

## Scope

Production catalogue: 67 public ordinary tables; 17 currently have RLS enabled; these are the 50 public tables with RLS disabled. The map below uses actual column names and FK targets observed in production. It is a **candidate policy classification**, not a claim that policies are implemented or accepted.

No production DDL/DML was performed.

## Table-by-table candidate boundary

| # | Table | Observed scope columns | FK targets | Candidate policy class / required boundary |
|---:|---|---|---|---|
| 1 | `activity_assignments` | activity_id, identity_id, role_id | activities, identities, roles | Tenant-child; inherit activity organization and constrain assigned identity/role to that organization |
| 2 | `bwg_epr_reports` | reporting_period_id, evidence_id | bwg_reporting_periods, epr_schemes, evidence, verifications | Tenant-child; inherit BWG reporting-period organization; evidence and verification must belong to same scope |
| 3 | `bwg_esg_reports` | reporting_period_id, evidence_id | bwg_reporting_periods, evidence, verifications | Tenant-child; inherit BWG reporting-period organization |
| 4 | `bwg_profiles` | organization_id | geography, organizations | Tenant-direct; organization membership plus geography scope |
| 5 | `bwg_reporting_periods` | organization_id | organizations | Tenant-direct; organization membership |
| 6 | `bwg_waste_reports` | reporting_period_id, processor_organization_id, evidence_id | bwg_reporting_periods, evidence, organizations, verifications | Multi-party/child; reporting-period owner plus processor participation; verify evidence scope |
| 7 | `carbon_market_mechanisms` | — | — | Global reference; controlled write/admin, read-only application access |
| 8 | `carbon_projects` | organization_id, geography_id, methodology_version_id | carbon_market_mechanisms, geography, methodology_versions, organizations, regulatory_sources | Tenant-direct; organization plus geography scope; global methodology/source references read-only |
| 9 | `ccts_methodology_registry` | — | — | Global regulatory/methodology reference; controlled write/admin |
| 10 | `cpcb_swm_stakeholder_workspaces` | organization_id, geography_id | geography, identities, organizations | Tenant-direct; organization membership and assigned geography |
| 11 | `cpcb_swm_status_history` | workspace_id, organization_id, actor_identity_id | cpcb_swm_stakeholder_workspaces, identities, organizations | Tenant-child; inherit workspace and organization, actor must be authorized in scope |
| 12 | `environmental_attribute_claims` | organization_id, activity_id, evidence_id | activities, evidence, organizations, verifications | Tenant/multi-party; validate claimant organization against activity, evidence and verification provenance |
| 13 | `epr_credit_allocations` | obligation_id | epr_credits, epr_obligations | Multi-party child; derive permitted view from both credit and obligation parties; reject mismatched pairings |
| 14 | `epr_credit_transfers` | credit_id, from_organization_id, to_organization_id, evidence_id | epr_credits, evidence, organizations, verifications | Bilateral multi-party; explicit from/to visibility and authorized transfer actor |
| 15 | `epr_credits` | issuer_organization_id, recycler_organization_id, activity_id, evidence_id | activities, epr_schemes, evidence, organizations, verifications | Multi-party; issuer/recycler rights plus activity/evidence provenance |
| 16 | `epr_obligations` | obligation_id, obligated_organization_id | epr_schemes, evidence, obligations, organizations, verifications | Tenant-direct/child; obligated organization and linked statutory obligation |
| 17 | `epr_returns` | organization_id, evidence_id, obligation_id | epr_obligations, epr_schemes, evidence, organizations, verifications | Tenant-direct/child; organization must own obligation and evidence |
| 18 | `epr_schemes` | — | geography | Global regulatory reference; controlled write/admin, geography applicability read-only |
| 19 | `esg_metrics` | reporting_period_id, evidence_id | activities, esg_reporting_periods, evidence, verifications | Tenant-child; inherit ESG reporting-period organization and validate activity/evidence |
| 20 | `esg_reporting_periods` | organization_id | organizations | Tenant-direct; organization membership |
| 21 | `evidence_artifact_reviews` | evidence_id | evidence, evidence_artifact_versions, identities | Tenant-child; inherit evidence/series scope; reviewer identity and review authority must be validated |
| 22 | `evidence_artifact_series` | organization_id, activity_id | activities, identities, organizations | Tenant-direct/child; organization and activity must agree |
| 23 | `evidence_artifact_versions` | series_id, evidence_id | evidence, evidence_artifact_series, identities | Tenant-child; inherit series/evidence scope; immutable version lineage |
| 24 | `field_sync_conflicts` | envelope_id | field_sync_envelopes, identities | Tenant-child; inherit envelope/device organization and constrain resolving identity |
| 25 | `field_sync_cursors` | device_id | field_devices | Tenant-child; inherit enrolled device organization; only authorized device/operator can advance cursor |
| 26 | `field_sync_envelopes` | device_id, identity_id | field_devices, identities | Tenant-child; device organization plus enrolled actor identity; idempotency/replay constraints retained |
| 27 | `geography` | — | geography, geography_sources | Global reference; versioned source lineage, controlled write/admin, authorized read |
| 28 | `geography_sources` | — | — | Global reference provenance; controlled write/admin, read-only application access |
| 29 | `identities` | — | identities | Identity control plane; self/private fields plus narrowly scoped platform-admin access, not tenant-wide directory visibility |
| 30 | `identity_credentials` | identity_id | identities | Identity-owned secret/credential material; self/auth service only, no tenant-wide read |
| 31 | `identity_password_credentials` | identity_id | identities | Identity-owned authentication secret; auth service only, never exposed to ordinary tenant roles |
| 32 | `identity_sessions` | identity_id | identities | Identity-owned session state; auth bootstrap/revocation functions only |
| 33 | `methodology_governance_evidence` | methodology_version_id | methodology_versions | Global governance child; controlled methodology assurance/admin, read-only application access |
| 34 | `methodology_versions` | — | carbon_market_mechanisms | Global controlled catalogue; versioned approval and controlled write/admin |
| 35 | `mrv_provenance_events` | activity_id, evidence_id | activities, evidence, verifications | Tenant-child; inherit activity and evidence; append-only provenance |
| 36 | `operation_sync_envelopes` | actor_identity_id, device_id | identities | Identity/device-bound queue; device_id lacks an FK in observed catalogue, so device-to-organization resolution must be explicitly verified before policy design |
| 37 | `organization_bwg_assessments` | organization_id, evidence_id | evidence, identities, organizations, verifications | Tenant-direct; organization membership and linked evidence/reviewer scope |
| 38 | `organization_epr_applicability` | organization_id, evidence_id | evidence, identities, organizations, verifications | Tenant-direct; organization membership and linked evidence/reviewer scope |
| 39 | `organization_geography_scopes` | organization_id, geography_id | geography, organizations | Tenant-direct authorization anchor; only approved organization geography scope can be managed |
| 40 | `organization_statutory_profiles` | organization_id | identities, organizations | Tenant-direct; organization membership; author identity is audited |
| 41 | `organization_verification_evidence` | organization_id | identities, organizations | Tenant-direct; organization membership and verifier authority |
| 42 | `platform_access_change_requests` | target_identity_id, organization_id, role_id, requester_identity_id | identities, organization_memberships, organizations, roles | Platform control plane; requester/target/organization scope, dual control, no self-approval |
| 43 | `platform_audit_chain_head` | — | — | Global platform integrity anchor; privileged integrity function only, not tenant-writable |
| 44 | `registry_events` | credential_id | credentials, identities, organizations, verifications | Multi-party child; derive issuer/current-owner/recipient visibility from credential and event actor; append-only |
| 45 | `regulatory_requirements` | — | regulatory_sources | Global regulatory catalogue; controlled write/admin, read-only application access |
| 46 | `regulatory_sources` | — | regulatory_sources | Global source catalogue/provenance; controlled write/admin, read-only application access |
| 47 | `schema_migrations` | — | — | Internal system metadata; migration owner/admin only, no application runtime access |
| 48 | `settlement_events` | settlement_id, actor_identity_id | identities, settlements | Multi-party child; inherit payer/payee settlement rules and constrain event actor |
| 49 | `stakeholder_application_approvals` | application_id, geography_id | geography, identities, stakeholder_applications | Workflow authority boundary; applicant/target organization plus approving authority geography; dual-control where required |
| 50 | `stakeholder_applications` | identity_id, organization_id, role_id, geography_id | geography, identities, organizations, roles | Pre-membership workflow; applicant self-access plus scoped reviewer access, not ordinary verified-member-only policy |

## Cross-cutting implementation rules

1. **Never blanket-enable one generic `organization_id = current_org` policy across all 50 tables.** The FK map shows global catalogues, identity secrets, child rows, and bilateral records.
2. Tenant-child policies must use explicit, indexed parent-FK joins and verify the parent is itself in the active tenant. Avoid trusting a client-supplied tenant ID.
3. Multi-party EPR/registry/settlement rows need explicit per-operation visibility and write rules. A single `current_organization_id` predicate is insufficient for bilateral transfer semantics.
4. Identity/session/credential tables need self-scope or SECURITY DEFINER auth operations, not broad organization membership access.
5. Shared geography/regulatory/methodology catalogues should be read-only to runtime; administrative writes need versioning and provenance.
6. Platform audit chain and migration metadata remain privileged control-plane resources.
7. Add SELECT, INSERT, UPDATE, DELETE negative tests as appropriate for each table; append-only records should explicitly deny UPDATE/DELETE.
8. For every policy, test no context, forged GUC without a context grant, wrong tenant, wrong actor, invalid parent, and unauthorized cross-party action.
9. The candidate session-bound context grant in migration 103 is a prerequisite for trusting `current_identity_id()` and `current_organization_id()`; it must pass disposable CI before any production change.
10. Table-by-table policy rollout must be staged with a read-only inventory, migration rehearsal, negative tests and rollback plan. Production stays unchanged until explicit change approval.

## Current status

- Catalogue classification: 50/50 tables assigned a candidate policy class from observed production columns/FKs.
- Final policy semantics: OPEN; code-path and workflow authorization review required for every table.
- RLS implementation on these 50 tables: NOT DONE.
- Cross-table negative acceptance: NOT DONE.
- Production migrations: NOT APPLIED.
- Production release: HOLD.

The live production data snapshot also contains only two VERIFIED `test_fixture` organizations and zero operational activities, measurements, evidence, devices, provenance, registry events or settlements. Therefore this schema map is not evidence of live urban/rural stakeholder operation.
