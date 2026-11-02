# Production 67-table tenant and RLS policy matrix — first-pass draft

**Date:** 2026-11-02  
**Source of truth inspected:** Neon project `rupaykg-production-fresh`, production branch `main` (`br-restless-base-b44cip2h`), database `rupaykg`.  
**Method:** Read-only `information_schema.columns` and FK metadata, plus `pg_class.relrowsecurity` / `relforcerowsecurity`.  
**Status:** DRAFT — structural ownership paths mapped; this is not an approved policy migration or proof of route coverage.

## 1. Production baseline

- 67 public base tables.
- 0/67 have RLS enabled.
- 0/67 have FORCE RLS enabled.
- 92 applied migrations; latest `20261021`.
- Database owner `rupaykg`.
- `auth_private` and `app_security` do not exist on production.

The table matrix below is based on actual live columns and foreign keys. The policy class is a proposed authorization boundary to be validated against every API route, worker, SQL function, trigger, service principal and bilateral business rule before implementation.

## 2. Table-by-table ownership and policy matrix

| # | Table | Observed tenant/ownership path | Proposed policy class |
|---:|---|---|---|
| 1 | `activities` | `organization_id`; actor identity; geography | Direct tenant root; organization + verified geography |
| 2 | `activity_assignments` | `activity_id → activities.organization_id`; assigned identity and role | Child of activity; same-tenant assignment plus identity/role authority |
| 3 | `audit_events` | `organization_id`; actor identity | Tenant audit; append-only, actor and platform audit readers |
| 4 | `bwg_epr_reports` | `reporting_period_id → bwg_reporting_periods.organization_id`; evidence and verification | Child of tenant reporting period |
| 5 | `bwg_esg_reports` | `reporting_period_id → bwg_reporting_periods.organization_id`; evidence and verification | Child of tenant reporting period |
| 6 | `bwg_profiles` | `organization_id`; jurisdiction geography | Direct tenant root; jurisdiction-scoped |
| 7 | `bwg_reporting_periods` | `organization_id` | Direct tenant root |
| 8 | `bwg_waste_reports` | `processor_organization_id`; reporting period; evidence and verification | Multi-party/processor tenant; validate reporting-period and processor party equality |
| 9 | `carbon_calculations` | `activity_id → activities.organization_id`; `carbon_project_id → carbon_projects.organization_id` | Child of activity/project; require both parent scopes to agree |
| 10 | `carbon_market_mechanisms` | No tenant FK; global mechanism catalog | Global reference; public read, controlled write |
| 11 | `carbon_projects` | `organization_id`; geography | Direct tenant root; project jurisdiction and methodology scope |
| 12 | `ccts_methodology_registry` | No tenant FK; source/document provenance fields | Global regulatory reference; controlled publication/versioning |
| 13 | `chain_of_custody_links` | `actor_organization_id`; resource flow; activity; from/to geography; evidence | Multi-party chain-of-custody; authorized actor + parent flow/activity parties |
| 14 | `cpcb_swm_stakeholder_workspaces` | `organization_id`; geography; creator/updater identities | Direct tenant root; jurisdiction and authorized reporter |
| 15 | `cpcb_swm_status_history` | `organization_id`; workspace; actor identity | Tenant child/audit history; append-only, same organization as workspace |
| 16 | `credentials` | `issuer_organization_id`; activity; verification | Issuer tenant plus referenced activity/verification; issuance is privileged |
| 17 | `environmental_attribute_claims` | `organization_id`; activity/evidence/verification | Direct tenant root; all referenced records must be within the claim's authorized lineage |
| 18 | `epr_credit_allocations` | `obligation_id → epr_obligations.obligated_organization_id`; credit | Child of obligation/credit; verify owner and scheme consistency |
| 19 | `epr_credit_transfers` | `from_organization_id`, `to_organization_id`; evidence/verification | Bilateral; both counterparties have scoped access, no unrelated tenant |
| 20 | `epr_credits` | `issuer_organization_id`, `recycler_organization_id`; activity/evidence/verification | Bilateral/multi-party; issuer and recycler only, plus explicit assurance role |
| 21 | `epr_obligations` | `obligated_organization_id`; source evidence/verification | Direct tenant root for obligated organization |
| 22 | `epr_returns` | `organization_id`; obligation; evidence/verification | Direct tenant root; obligation organization must match |
| 23 | `epr_schemes` | No tenant FK; jurisdiction geography | Global scheme reference; public read, controlled governance |
| 24 | `esg_metrics` | `reporting_period_id → esg_reporting_periods.organization_id`; source activity/evidence/verification | Child of ESG reporting period; source activity must match tenant |
| 25 | `esg_reporting_periods` | `organization_id` | Direct tenant root |
| 26 | `evidence` | `activity_id → activities.organization_id`; measurement and captured identity | Child of activity; immutable evidence provenance |
| 27 | `evidence_artifact_reviews` | `evidence_id → evidence → activity.organization_id`; reviewer identity | Child of evidence; reviewer capability and immutable review history |
| 28 | `evidence_artifact_series` | `organization_id`; activity; creator identity | Direct tenant root; series/activity tenant equality |
| 29 | `evidence_artifact_versions` | `series_id → evidence_artifact_series.organization_id`; evidence; uploader identity | Immutable child/version; parent series and evidence ownership must agree |
| 30 | `evidence_verification_requirements` | `activity_id`; satisfied evidence and verification | Child of activity; referenced evidence/verification must match activity |
| 31 | `field_devices` | `organization_id`; device identity and registrar/verifier identities | Direct tenant root; device principal bound to one verified organization |
| 32 | `field_sync_conflicts` | `envelope_id → field_sync_envelopes → field_devices.organization_id`; resolver identity | Child of device envelope; resolver authority and append-only resolution |
| 33 | `field_sync_cursors` | `device_id → field_devices.organization_id` | Child of field device; device principal only |
| 34 | `field_sync_envelopes` | `device_id → field_devices.organization_id`; identity | Child of device; tenant/device identity binding, idempotency and replay controls |
| 35 | `geography` | Self-referential `parent_id`; source | Global reference hierarchy; controlled source governance, read-only to tenants |
| 36 | `geography_sources` | Global source catalog | Global reference; controlled write and provenance |
| 37 | `identities` | Identity principal; suspension actor self-reference | Global identity control plane; self-scoped reads, privileged identity administration |
| 38 | `identity_credentials` | `identity_id` | Private identity credential data; auth service only, never tenant-wide |
| 39 | `identity_password_credentials` | `identity_id` | Private authentication secret data; auth service only |
| 40 | `identity_sessions` | `identity_id` | Private session data; auth verifier/runtime only, token hash never exposed |
| 41 | `measurements` | `activity_id → activities.organization_id`; captured identity/device | Child of activity; device and actor provenance |
| 42 | `methodology_governance_evidence` | `methodology_version_id`; evidence hash | Global methodology governance evidence; controlled publication, immutable versions |
| 43 | `methodology_versions` | Global mechanism/source reference | Global methodology catalog; controlled governance/versioning |
| 44 | `mrv_observations` | `activity_id → activities.organization_id`; measurement | Child of activity/measurement; preserve raw observation provenance |
| 45 | `mrv_provenance_events` | `activity_id → activities.organization_id`; verification/evidence | Child of activity; append-only provenance with verification lineage |
| 46 | `obligations` | `organization_id`; jurisdiction geography | Direct tenant root; organization and jurisdiction boundary |
| 47 | `operation_sync_envelopes` | Actor identity and device identifier | Service/device-scoped operational sync; resolve authoritative device/org binding |
| 48 | `organization_bwg_assessments` | `organization_id`; evidence/verification; determining identity | Direct tenant root; authorized assessor, evidence lineage |
| 49 | `organization_epr_applicability` | `organization_id`; evidence/verification and registration evidence | Direct tenant root; authorized applicability decision and immutable evidence |
| 50 | `organization_geography_scopes` | `organization_id`; geography | Tenant control-plane scope assignment; only approved geography authorities may mutate |
| 51 | `organization_memberships` | `organization_id`; identity and role | Tenant membership control plane; dual-control/reserved-role guards |
| 52 | `organization_statutory_profiles` | `organization_id`; determining identity | Direct tenant root; statutory profile governance |
| 53 | `organization_verification_evidence` | `organization_id`; verifying identity | Direct tenant root; immutable legal evidence and authorized verifier |
| 54 | `organizations` | Tenant root; organization type and verification authority | Organization control plane; restricted self/admin reads and controlled lifecycle |
| 55 | `platform_access_change_requests` | `organization_id`; target/requester/approver identities; role/membership | Privileged platform control plane; dual-control and actor separation |
| 56 | `platform_audit_chain_head` | Global singleton chain head | Platform integrity control; service-only mutation, independently verifiable |
| 57 | `registry_events` | `from_owner_id`, `to_owner_id`; credential/verification | Bilateral registry event; parties and authorized registry operators |
| 58 | `regulatory_requirements` | `regulatory_source_id` | Global regulatory reference; versioned and controlled |
| 59 | `regulatory_sources` | Self-reference `supersedes_id` | Global regulatory source catalog; immutable source lineage |
| 60 | `resource_flows` | `organization_id`; source/destination geography | Direct tenant root; both endpoints in authorized geography and counterparty rules |
| 61 | `roles` | `organization_id`; role permissions/geography scope | Tenant control plane; restricted role administration, reserved roles dual-control |
| 62 | `schema_migrations` | Global schema ledger | System-only; migrator/owner, never app runtime |
| 63 | `settlement_events` | `settlement_id → payer_id/payee_id`; actor identity | Bilateral settlement child; append-only and party/authority scoped |
| 64 | `settlements` | `payer_id`, `payee_id`; obligation/credential | Bilateral financial record; both counterparties and settlement service |
| 65 | `stakeholder_application_approvals` | `application_id → stakeholder_applications.organization_id`; geography and approver identity | Approval control plane; hierarchy, geography, dual-control and immutable decision history |
| 66 | `stakeholder_applications` | `organization_id`; applicant identity, role and geography | Applicant/organization control plane; applicant self-view plus authorized review scope |
| 67 | `verifications` | `activity_id → activities.organization_id`; evidence, verifier and authorization membership | Child of activity; verifier capability, independence and tenant scope |

## 3. Policy classes and non-negotiable design rules

1. **Tenant roots:** Direct organization-owned rows must bind to a verified organization membership and authorized geography. Caller-supplied organization IDs never establish authority.
2. **Child tables:** Do not add a broad `organization_id` policy to a child table without proving parent ownership. Use parent-derived `EXISTS` checks or a rigorously maintained denormalized tenant key with equality constraints and tests.
3. **Bilateral/multi-party records:** Model both counterparties explicitly. A party may see only the authorized projection; one party must not gain mutation authority over the other party's records.
4. **Identity/auth control plane:** Keep credentials and sessions behind narrow authentication functions/roles. The operational app role must not read raw credential/session tables.
5. **Platform control plane:** Organizations, memberships, roles, access requests, approvals and platform audit require separate privileged functions, dual control and immutable audit evidence.
6. **Global reference data:** Regulatory sources, methodologies, schemes, geography and mechanism catalogs are shared reference data. Tenant roles receive only the intended read path; write/publish authority is separate.
7. **System metadata:** Migration ledger and platform chain-head mutation are service-only. No tenant or normal app runtime access.
8. **Audit and evidence:** Preserve append-only behavior, provenance, hashes, actor identity, version lineage and non-repudiation. RLS must not accidentally permit update/delete.
9. **RLS owner boundary:** The application role must be NOBYPASSRLS and must not own protected tables. Table owner, migration role, auth function owner and application role must be distinct and have no unintended role-membership inheritance.
10. **Context boundary:** Every protected request must establish one transaction-local signed identity context. No pooled query may escape the same client/transaction; nested transaction behavior must be explicit.
11. **Geography:** Organization geography scope is hierarchical. Every activity, resource-flow endpoint, approval, project and statutory workflow must enforce the appropriate descendant/ancestor relationship.
12. **Workers/devices:** Device and worker principals require explicit organization/service scope, idempotency, replay controls, lease/recovery semantics and audit lineage.

## 4. Required validation before any RLS migration

- Reconcile every table's complete columns, indexes, FKs, unique constraints, triggers and grants against the live catalog and all repository migrations.
- Resolve polymorphic `source_id` / `source_type` and JSON ownership references; FKs alone do not cover them.
- Build a route + worker + CLI + scheduled job → table → SQL operation → role/function → scope predicate matrix.
- Add positive and negative tests for every policy class, including cross-tenant reads/writes, bilateral party access, child-parent mismatch, wrong geography, revoked/suspended identity, connection reuse and concurrent requests.
- Run on disposable Neon with the exact intended runtime/auth/migrator roles, not postgres/superuser.
- Rehearse from the current production catalog and migration ledger. Do not rewrite historical migration rows or replay blindly.
- Obtain independent security review, DBA approval, backup/restore proof, rollback plan and explicit release approval.

## 5. Known limitations / next pass

- This first pass records structural ownership paths for all 67 production public tables; it is not yet a complete policy predicate or SQL migration.
- Polymorphic fields, JSON payloads, triggers, SECURITY DEFINER ownership, views/materialized views, function grants, sequences, worker/service principal access and dynamic SQL need dedicated inspection.
- The table list and RLS counts were read from production on 2026-11-02; no production changes were made.
- Immediate priority is to validate the highest-risk tables and parent edges, then connect every API route/worker call site to the correct policy class.
