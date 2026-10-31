# RupayKg Production Authorization and RLS Gap Assessment

**Evidence timestamp:** 2026-10-31 (UTC)  
**Repository candidate:** `shakti/atomic-inbox-claim-2026-10-31`  
**Candidate HEAD before this documentation batch:** `d36ef5b81c3fcfbfe047f90b5ca8f9d45d9b3934`  
**Database:** Neon project `rupaykg-production-fresh` / `steep-mud-79906940`, default branch `main` / `br-restless-base-b44cip2h`, database `rupaykg`  
**Method:** Read-only PostgreSQL catalog queries plus source/route review. No production writes.

## 1. Executive assessment

<badge> P0 / P1 RELEASE HOLD </badge>

The production database currently has **no database-enforced row-level security on any of its 67 public tables**. The sole application login role `rupaykg` owns all 67 tables, has `BYPASSRLS`, `CREATEROLE`, `CREATEDB`, and `REPLICATION`, and is a member of `neon_superuser`. This is not a least-privilege runtime identity.

This is a serious authorization architecture gap, but it is not by itself proof of an exploitable cross-tenant endpoint: application authorization exists and must be independently tested. Conversely, application authorization alone cannot be certified from source inspection without exact route-to-statement testing and a database boundary.

**Critical distinction:** the Neon catalog inspection session reported `session_user=current_user=rupaykg`. This proves the role used by this Neon inspection connection. It does **not** prove the Render web service uses the same connection principal. Render's actual runtime role remains NOT VERIFIED.

## 2. Verified production catalog facts

| Control | Live result | Interpretation |
|---|---:|---|
| Public base tables | 67 | Catalog count |
| Tables with direct `organization_id` | 23 | Direct organization key exists; child/other scope still needs review |
| Tables with direct `identity_id` | 8 | Identity/control-plane or actor relationship |
| Tables containing both | 3 | `field_devices`, `organization_memberships`, `stakeholder_applications` |
| Tables with RLS enabled | 0 / 67 | No row policies can currently enforce table isolation |
| Tables with FORCE RLS | 0 / 67 | No owner-forced row policy |
| Public RLS policies | 0 | No policies in inspected public schema |
| Public table owners | 1 distinct owner | All 67 owned by `rupaykg` |
| Non-owner table ACL entries | 0 | No explicit table grants to separate service roles |
| PUBLIC table ACL entries | 0 | No public table grants found |
| Public functions | 115 | Catalog count |
| SECURITY DEFINER public functions | 0 | No public SECURITY DEFINER function in this snapshot |
| Migration ledger | 92 rows; max version `20261021` | Production migration baseline |

The `rupaykg` login role is non-superuser but has `BYPASSRLS=true`, `CREATEROLE=true`, `CREATEDB=true`, `REPLICATION=true`, and `LOGIN=true`. It is a member of `neon_superuser`. Do not describe this as a safe application runtime role.

The public schema is owned by `pg_database_owner`; table ownership is `rupaykg`. The only non-platform application login found in the production catalog is `rupaykg`.

## 3. Direct organization and identity columns

### Direct `organization_id` — 23 tables

`activities`, `audit_events`, `bwg_profiles`, `bwg_reporting_periods`, `carbon_projects`, `cpcb_swm_stakeholder_workspaces`, `cpcb_swm_status_history`, `environmental_attribute_claims`, `epr_returns`, `esg_reporting_periods`, `evidence_artifact_series`, `field_devices`, `obligations`, `organization_bwg_assessments`, `organization_epr_applicability`, `organization_geography_scopes`, `organization_memberships`, `organization_statutory_profiles`, `organization_verification_evidence`, `platform_access_change_requests`, `resource_flows`, `roles`, `stakeholder_applications`.

### Direct `identity_id` — 8 tables

`activity_assignments`, `field_devices`, `field_sync_envelopes`, `identity_credentials`, `identity_password_credentials`, `identity_sessions`, `organization_memberships`, `stakeholder_applications`.

### No direct `organization_id` or `identity_id` — 39 tables

`bwg_epr_reports`, `bwg_esg_reports`, `bwg_waste_reports`, `carbon_calculations`, `carbon_market_mechanisms`, `ccts_methodology_registry`, `chain_of_custody_links`, `credentials`, `epr_credit_allocations`, `epr_credit_transfers`, `epr_credits`, `epr_obligations`, `epr_schemes`, `esg_metrics`, `evidence`, `evidence_artifact_reviews`, `evidence_artifact_versions`, `evidence_verification_requirements`, `field_sync_conflicts`, `field_sync_cursors`, `geography`, `geography_sources`, `identities`, `measurements`, `methodology_governance_evidence`, `methodology_versions`, `mrv_observations`, `mrv_provenance_events`, `operation_sync_envelopes`, `organizations`, `platform_audit_chain_head`, `registry_events`, `regulatory_requirements`, `regulatory_sources`, `schema_migrations`, `settlement_events`, `settlements`, `stakeholder_application_approvals`, `verifications`.

**Important:** absence of a direct tenant key does not mean a table is global. Several are children whose authorization must be inherited through reviewed foreign-key paths (e.g. evidence, measurements, reports, credits and verification). Others are global reference/control-plane data or bilateral objects. Classify by FK path and business semantics before writing policies.

## 4. Data-domain authorization classes

| Class | Examples | Required boundary |
|---|---|---|
| Tenant-owned root | organizations, activities, resource_flows, bwg_profiles, carbon_projects, epr_returns | Verified membership + organization scope |
| Tenant child / evidence | evidence, evidence_artifact_versions, measurements, mrv_observations, bwg reports, carbon_calculations | Parent-chain policy; deny if parent scope cannot be resolved |
| Identity/session | identities, identity_password_credentials, identity_sessions, identity_credentials | Self/identity-scoped, pre-tenant control-plane rules |
| Device and sync | field_devices, field_sync_envelopes, field_sync_cursors, field_sync_conflicts, operation_sync_envelopes | Device-bound identity and immutable organization binding; anti-spoof/replay |
| Governance / reviewer | stakeholder_applications, stakeholder_application_approvals, organization_verification_evidence, platform_access_change_requests | Jurisdictional authority, separation of duties, dual control and audit |
| Global reference | geography, geography_sources, regulatory_sources, regulatory_requirements, epr_schemes, carbon_market_mechanisms, ccts_methodology_registry | Read policy for approved reference data; controlled/versioned writes |
| Methodology governance | methodology_versions, methodology_governance_evidence | Approved reviewer/dual-control policy; not general public write |
| Registry / credit | credentials, registry_events, epr_credits, epr_credit_transfers | Issuer/current owner/recipient/actor and credential lifecycle |
| Bilateral settlement | settlements, settlement_events | Payer/payee/obligation/credential/actor relationship; not a single tenant predicate |
| Platform audit/control | audit_events, platform_audit_chain_head, schema_migrations | Append-only/system-admin controls; never tenant-wide mutation |

This table is a target authorization classification, not an assertion that every policy has been implemented.

## 5. Source and route evidence

Current candidate source review is in `docs/engineering/GATE1_CURRENT_CANDIDATE_SOURCE_REVIEW_2026-10-31.md`.

Improvement already present:
- `createTenantTransaction` sets transaction-local identity and organization context from server-verified AuthContext, requires verified membership and explicit active organization, and runs callback SQL on the same checked-out client.
- Current candidate uses it across value, BWG/EPR return, CPCB-SWM, workspace, MRV, evidence-vault and statutory paths, plus selected core writes.

Remaining context classes:
- Identity/authentication and onboarding pre-tenant operations.
- Jurisdictional reviewer/governance authority.
- Platform-admin privilege and audit.
- Intelligence and server overview/geography reads.
- Device-principal sync.
- Bilateral registry/settlement.
- National system-level source ingestion and tenant dispatch.

A transaction helper is not RLS, does not enforce policies, and does not protect against a compromised application role that can arbitrarily set custom GUCs. RLS policies must verify the claimed identity/organization against authoritative membership/authority state or use a separately validated capability.

## 6. P0 infrastructure protection gaps

Verified in the current Neon project metadata:
- Production branch `main` is default/primary but `protected=false`.
- The inspected rehearsal branches are also unprotected; they are not production authorities.
- Project history retention is 21,600 seconds (6 hours).
- No successful independent backup restore or point-in-time recovery drill is evidenced in the reviewed repository material.

Actions required:
1. Obtain an exportable backup/snapshot and document retention, restore point, RPO/RTO and restore operator.
2. Rehearse restore into an isolated environment and record row/schema/function integrity checks.
3. Protect production branch against accidental deletion/force operations using approved Neon controls.
4. Confirm project history retention is sufficient for the required operational recovery objectives; do not assume six hours is an adequate backup strategy.
5. Confirm Render target branch/database and actual runtime principal independently.

No branch protection, retention, backup or recovery setting was changed by this assessment.

## 7. RLS implementation sequence — do not shortcut

1. Complete route × SQL statement × table × operation × principal × tenant-context map.
2. Inventory every FK inheritance path and composite ownership relation, including child tables lacking direct org keys.
3. Inventory views, triggers, sequences, functions, default privileges, schema grants, ownership, role memberships and dynamic SQL.
4. Split API, identity/control-plane, national ingestion, tenant workflow, device, event-writer, migration and read-only operations identities.
5. Implement table-specific policies; separate public reference, identity self-access, reviewer jurisdiction, tenant roots/children, bilateral settlement and system queue classes.
6. Enforce identity/organization membership checks inside policy functions or trusted database capabilities. GUC values alone are not proof.
7. Test exact non-owner principals with positive and negative cross-tenant access, pool context reuse, revoked membership, multiple memberships, parent-child traversal, device spoof/replay, national worker boundaries, settlement counterparties and admin elevation.
8. Only after disposable production-shaped rehearsal, independent security review, backup/restore and rollback rehearsal, approve production change.

Do not blanket-enable RLS. Do not make the existing `rupaykg` owner login the permanent service role. Do not give the national worker a generic BYPASSRLS role.

## 8. Release conclusion

- Production DB security foundation: **NOT ESTABLISHED**.
- Actual Render runtime role: **NOT VERIFIED**.
- Database-enforced tenant isolation: **NOT IMPLEMENTED**.
- National worker least privilege: **PROPOSED, NOT PROVEN**.
- Backup restore: **NOT EVIDENCED**.
- Production activation: **BLOCKED**.
- TRL 9: **NOT ESTABLISHED**.

This assessment is a catalog-backed gap assessment plus bounded source review, not a line-by-line independent penetration test or certification.
