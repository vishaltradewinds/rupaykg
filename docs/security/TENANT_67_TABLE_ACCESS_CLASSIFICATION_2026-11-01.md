# Production 67-table access classification — evidence-backed draft

**Source:** read-only catalog inspection of Neon project `steep-mud-79906940`, production branch `br-restless-base-b44cip2h`, database `rupaykg`, 2026-11-01.  
**Status:** engineering classification draft, not approved policy SQL. No production data, schema, roles, grants, RLS, or deployment were changed.

## Evidence boundary

The catalog inspection enumerated all 67 public base tables, ownership-candidate columns with nullability, FK edges, and existing policy counts. Baseline: 67 public tables; 0 RLS-enabled; 0 FORCE RLS; 0 policies in this inspection. The register separates true ownership from actor attribution, parent inheritance, bilateral parties, global reference data, and control-plane state. An `_id` column alone does not establish ownership.

## Per-table register

| Table | Proposed class | Catalog evidence | Policy-design direction |
|---|---|---|---|
| activities | ORG | organization_id NOT NULL; actor_identity_id | Org-scoped; geography as secondary scope |
| activity_assignments | CHILD | activity_id + identity_id + role_id | Assigned identity and parent-org admins; composite tenant FK |
| audit_events | APPEND/AUDIT | optional organization_id + actor_identity_id | Scoped audit readers; append-only; classify org-null events |
| bwg_epr_reports | CHILD | reporting_period_id; scheme/evidence/verification | Inherit reporting-period org; parent alignment |
| bwg_esg_reports | CHILD | reporting_period_id; evidence/verification | Inherit reporting-period org |
| bwg_profiles | ORG | organization_id NOT NULL; jurisdiction_id | Owning org; regulator by authority scope |
| bwg_reporting_periods | ORG | organization_id NOT NULL | Owning org; period uniqueness includes org |
| bwg_waste_reports | MULTIPARTY CHILD | reporting_period_id; processor_organization_id | Reporting org + explicit processor visibility |
| carbon_calculations | CHILD | activity_id; carbon_project_id; methodology_version_id | Inherit activity/project org; pin shared methodology |
| carbon_market_mechanisms | GLOBAL REF | No tenant attribution/FK | Tenant read-only; governance writes |
| carbon_projects | ORG | organization_id NOT NULL | Owning org; regulator/verifier scope |
| ccts_methodology_registry | GLOBAL REF | No tenant attribution/FK | Tenant read-only; standards governance writes |
| chain_of_custody_links | MULTIPARTY CHILD | resource_flow_id; actor_organization_id; activity/evidence | Flow owner + named counterparties; append-only chain |
| cpcb_swm_stakeholder_workspaces | ORG | organization_id NOT NULL; creator/updater identity | Owning org; regulator jurisdiction scope |
| cpcb_swm_status_history | APPEND CHILD | workspace_id + organization_id NOT NULL | Inherit workspace; enforce org equality; append-only |
| credentials | MULTIPARTY ASSET | issuer_organization_id; activity/verification | Issuer/current holder/regulator per registry rules |
| environmental_attribute_claims | ORG + CHILD | organization_id + activity_id NOT NULL | Claiming org; activity must be same org |
| epr_credit_allocations | CHILD | epr_credit_id + obligation_id | Both parent scopes must align; same-scheme validation |
| epr_credit_transfers | BILATERAL | from_organization_id + to_organization_id | Both parties + regulator; state-machine writes |
| epr_credits | MULTIPARTY ASSET | issuer_organization_id; recycler_organization_id | Issuer/recycler/regulator; explicit ownership lifecycle |
| epr_obligations | ORG | obligated_organization_id NOT NULL | Obligated org + regulator |
| epr_returns | ORG | organization_id NOT NULL; scheme/obligation | Owning org + regulator; scheme consistency |
| epr_schemes | GLOBAL REF | jurisdiction_id only | Tenant read-only; controlled governance writes |
| esg_metrics | CHILD | reporting_period_id; source_activity_id | Inherit period; activity must match org |
| esg_reporting_periods | ORG | organization_id NOT NULL | Owning org + regulator |
| evidence | INHERITED/UNATTACHED REVIEW | activity_id; measurement_id; captured_by_identity_id | Parent-derived scope; unattached evidence needs owner rule |
| evidence_artifact_reviews | CHILD/REVIEW | evidence_id + artifact_version_id + reviewer_identity_id | Evidence owner + authorized reviewer |
| evidence_artifact_series | ORG + CHILD | organization_id + activity_id + created_by_identity_id | Owning org; activity org equality |
| evidence_artifact_versions | CHILD/IMMUTABLE | series_id + evidence_id + uploader identity | Inherit series; both parents align; immutable versions |
| evidence_verification_requirements | CHILD | activity_id; satisfying evidence/verification | Inherit activity; satisfying artifacts align |
| field_devices | DEVICE PRINCIPAL | device_id; optional identity_id + organization_id | Bound org/identity/device service; enrollment/revocation |
| field_sync_conflicts | CHILD/WORKER | envelope_id; resolver identity | Inherit envelope; scoped conflict resolver |
| field_sync_cursors | CONTROL/WORKER | device_id | Device worker only; not tenant CRUD |
| field_sync_envelopes | DEVICE + IDENTITY | device_id + identity_id | Validate device-identity-org binding; replay controls |
| geography | GLOBAL REF | parent_id + source_id | Tenant read-only; governance writes |
| geography_sources | GLOBAL REF PROVENANCE | No tenant attribution/FK | Tenant read-only; immutable provenance |
| identities | IDENTITY SECURITY | Self principal; suspension actor | Self-limited profile; privileged state via security functions |
| identity_credentials | IDENTITY SECURITY | identity_id NOT NULL | Redacted self-read; credential lifecycle functions |
| identity_password_credentials | AUTH SECRET | identity_id NOT NULL | Auth functions only; no direct app DML/read |
| identity_sessions | AUTH SECRET | identity_id NOT NULL | Auth functions only; token hash, expiry, revocation |
| measurements | CHILD | activity_id; captured_by_identity_id | Inherit activity org; device/operator alignment |
| methodology_governance_evidence | GLOBAL GOV CHILD | methodology_version_id | Standards governance; tenant read-only |
| methodology_versions | GLOBAL VERSIONED REF | carbon_mechanism ref | Tenant read-only; governance writes; immutable version pinning |
| mrv_observations | CHILD | activity_id + measurement_id | Inherit activity; sensor/device provenance |
| mrv_provenance_events | APPEND CHILD | activity_id + verification_id + evidence_id | All parents same org; immutable provenance |
| obligations | ORG | organization_id NOT NULL; jurisdiction_id | Owning org + regulator |
| operation_sync_envelopes | CONTROL/WORKER | actor_identity_id + device_id | Bound worker/device only; reconcile legacy device type |
| organization_bwg_assessments | ORG | organization_id NOT NULL; evidence/verification | Owning org + regulator; evidence aligns |
| organization_epr_applicability | ORG | organization_id NOT NULL; evidence/verification | Owning org + regulator; all refs align |
| organization_geography_scopes | AUTH RELATION | organization_id + geography_id | Org governance + auth engine; not ordinary member-editable |
| organization_memberships | AUTH RELATION | identity_id + organization_id + role_id | Self-limited; membership functions/admin approval; revocation immediate |
| organization_statutory_profiles | ORG | organization_id NOT NULL | Owning org + regulator |
| organization_verification_evidence | ORG | organization_id NOT NULL; verifier identity | Owning org + authorized verifier/regulator |
| organizations | ORG ROOT/SECURITY | Root organization; verified_by identity | Limited member profile; controlled create/verify/suspend |
| platform_access_change_requests | PLATFORM CONTROL | target/requester/approver identities + org/role | Platform security workflow; dual control |
| platform_audit_chain_head | GLOBAL CONTROL | last_event_id | Dedicated audit function only |
| registry_events | APPEND MULTIPARTY | credential_id; from_owner_id; to_owner_id | Parties + regulator; immutable transfer sequence |
| regulatory_requirements | GLOBAL REF | regulatory_source_id | Tenant read-only; governance writes |
| regulatory_sources | GLOBAL REF PROVENANCE | supersedes_id | Tenant read-only; version/supersession governance |
| resource_flows | ORG + GEO | organization_id NOT NULL; source/destination geography | Owning org; counterparties only through explicit chain links |
| roles | ORG AUTHZ | organization_id NOT NULL | Org security admins + auth engine; audited permission changes |
| schema_migrations | MIGRATION CONTROL | No tenant attribution/FK | Migration identity only; no app access |
| settlement_events | APPEND BILATERAL CHILD | settlement_id + actor identity | Inherit settlement parties; append-only |
| settlements | BILATERAL | payer_id + payee_id | Both counterparties + authorized services; financial state machine |
| stakeholder_application_approvals | WORKFLOW CHILD | application_id + approver identity + geography | Applicant status only; assigned approver scope; append-only history |
| stakeholder_applications | IDENTITY + ORG WORKFLOW | identity_id + organization_id + role_id | Applicant self + assigned approvers; pending request grants no membership |
| verifications | SCOPED AUTHORIZATION | verifier_identity_id + authorization membership/role | Owner/verifier/regulator scope; live auth; no self-approval |

## Mandatory invariants before executable policy design

1. **Composite tenant integrity:** simple single-column FKs do not ensure parent and child belong to the same organization. Add/validate composite keys/FKs where ownership crosses a parent relation.
2. **Bilateral/multi-party visibility:** EPR transfers/credits, credentials, chain-of-custody, registry events and settlements need explicit participant visibility and state machines; never use a single active-org equality rule.
3. **Inherited ownership:** reports, calculations, evidence, measurements, artifact versions/reviews, observations and events inherit from canonical parents. Reconcile orphan/unattached rows before RLS.
4. **Identity boundary:** identities, credentials, sessions, memberships and roles need narrow security-definer functions. No ordinary app runtime direct password/session access.
5. **Global references:** geography, methodologies, regulatory source/requirements, CCTS registry, schemes and mechanisms should be tenant-read-only only after product/compliance confirmation; governance owns writes.
6. **Append-only integrity:** audit, status history, provenance, registry and settlement events require append-only grants/functions and verified hash/sequence controls where applicable.
7. **Control plane:** migration ledger, audit-chain head, device cursors, sync envelopes/conflicts and platform access workflow are not ordinary tenant CRUD.
8. **Regulator scope:** regulator visibility derives from verified authority and jurisdiction scope, never a broad cross-tenant flag.
9. **Context threat model:** transaction-local GUCs prevent missing-filter mistakes but are not a cryptographic boundary against arbitrary SQL running as app role.
10. **Lifecycle controls:** onboarding, approval, membership activation/revocation, org suspension, credential transfer/retirement, device reassignment and settlement transitions require adversarial state-machine tests.

## Evidence required to approve policies

For every table: PK/unique/check/FK definitions, triggers, views/functions, grants, data counts, null/orphan/cross-org samples, and all API/worker/CLI access paths. Obtain signed owner/reader/writer/regulator/worker matrix. Test two tenants against SELECT/INSERT/UPDATE/DELETE, cross-parent FK attempts, revoked memberships, regulator boundaries, bilateral counterparties, device impersonation, pooled connection reuse, concurrency and load. Review exact migration on a fresh disposable Neon branch and rehearse rollback.

## Gate

- Classification recorded: 67/67 tables.
- Approved executable policies: 0/67.
- Production RLS enabled/forced: 0/67.
- Production release: HOLD; certification OFF; TRL 9 not established.

Do not run this document as SQL. Do not enable production RLS until runtime role separation, auth bootstrap, request transaction context, worker identities, and table semantics are independently proven.
