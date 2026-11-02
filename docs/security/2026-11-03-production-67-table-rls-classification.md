# RupayKg — production 67-table RLS classification and policy design

Date: 2026-11-03  
Source: read-only PostgreSQL catalog inspection of Neon production project steep-mud-79906940, branch br-restless-base-b44cip2h, database rupaykg.  
Status: design inventory only. No DDL, RLS enablement, grants, role creation or production writes.

## Baseline

The production catalog contains 67 ordinary public application tables. All 67 are owned by rupaykg; all have row-level security disabled and FORCE RLS disabled. The owner role has BYPASSRLS and elevated attributes. Enabling RLS alone would not isolate data from the current owner/runtime connection. A NOBYPASSRLS runtime role and separate non-login owner/migration boundary are prerequisites.

This is a first-pass policy-design map based on live columns and foreign keys, not an executable policy set. Every indirect relationship must be tested against actual tenant data and route behavior before migration.

## Policy model

1. Tenant context must be transaction-local and signed. Runtime requests establish verified identity, selected organization and request nonce through the approved transaction wrapper. Missing, malformed, expired, mismatched or unset context denies rows and writes.
2. Never trust a plain caller-controlled organization GUC or request header. Context is set only by the trusted server boundary after authentication and membership verification.
3. Direct organization scope uses signed organization equality, with cross-organization access only through a separately authorized and audited workflow.
4. Indirect scope resolves the authoritative tenant through parent FKs such as activity, reporting period, evidence series, credit, obligation, settlement or workspace. Parent joins must be indexed and integrity-protected.
5. Credential, password and session data are identity-scoped and restricted to auth runtime; ordinary app runtime receives no direct access.
6. Regulatory, methodology and geography reference data may be globally readable but write-restricted to controlled governance roles.
7. Platform-control tables require narrow service/authority policies; ordinary tenant membership is insufficient.
8. Fail closed on unknown classification, orphan rows, missing parent, inconsistent parent/child organizations, absent signed context and unverified membership.
9. FORCE RLS is applied only after owner/runtime separation is tested. It does not constrain superusers or BYPASSRLS roles.
10. Authorization uses explicit permissions and verified membership, not role-name labels alone.

## 67-table classification

### A. Direct organization-owned tenant tables

Direct organization scope, plus operation-specific permission and integrity checks:

- activities — organization_id; geography and actor are additional integrity constraints.
- audit_events — tenant-scoped append-only audit records; controlled insert, no tenant update/delete.
- bwg_profiles — organization_id.
- bwg_reporting_periods — organization_id.
- carbon_projects — organization_id plus geography.
- cpcb_swm_stakeholder_workspaces — organization_id plus geography.
- cpcb_swm_status_history — organization_id and must match parent workspace organization.
- environmental_attribute_claims — organization_id plus activity/evidence/verification consistency.
- epr_returns — organization_id plus scheme and obligation relationships.
- esg_reporting_periods — organization_id.
- evidence_artifact_series — organization_id plus activity consistency.
- field_devices — organization_id plus registered identity/device authorization.
- obligations — organization_id plus jurisdiction.
- organizations — organization master; self-view requires verified membership, while platform authority access is a separate controlled path. Do not make every tenant row globally visible.
- organization_bwg_assessments — organization_id.
- organization_epr_applicability — organization_id.
- organization_geography_scopes — organization_id; only verified scopes authorize geography.
- organization_memberships — organization and identity scope; management requires approval workflow.
- organization_statutory_profiles — organization_id.
- organization_verification_evidence — organization_id; verification writes restricted.
- platform_access_change_requests — requester, target and approver visibility must be separated; not a simple tenant-wide read.
- resource_flows — organization_id plus source/destination geography.
- roles — nullable organization_id: tenant roles are private; system/platform roles require controlled authority paths.

### B. Indirect tenant tables — parent-derived policies

Do not add guessed organization columns or trust caller-supplied parent IDs. Resolve tenant through authoritative FK paths and reject inconsistent relationships.

- activity_assignments — activity_id to activities.organization_id; identity visibility also requires assignment/member checks.
- bwg_epr_reports — reporting_period_id to bwg_reporting_periods.organization_id; evidence and verification must match.
- bwg_esg_reports — reporting period; evidence and verification must match.
- bwg_waste_reports — reporting period; processor organization is a counterparty, not automatic read authority.
- carbon_calculations — activity_id to activities.organization_id; carbon project must agree with activity tenant.
- chain_of_custody_links — resource flow and activity; actor organization and activity tenant require explicit transfer/counterparty rule.
- credentials — activity tenant and issuer organization; post-issuance visibility needs explicit issuer/holder/public-verification policy.
- epr_credit_allocations — credit and obligation must resolve to compatible scheme/tenant/counterparty authorization.
- epr_credit_transfers — from/to organizations; each party gets only its authorized transfer view.
- epr_credits — issuer/recycler organizations and activity; explicit counterparty visibility required.
- epr_obligations — obligated_organization_id plus obligation/scheme consistency.
- esg_metrics — reporting period and source activity must resolve to same authorized reporting boundary.
- evidence — activity; captured identity/device are additional constraints.
- evidence_artifact_reviews — evidence/activity and artifact version/series; reviewer identity alone grants no tenant access.
- evidence_artifact_versions — series organization and evidence activity must agree.
- evidence_verification_requirements — activity; satisfied evidence/verification must belong to same activity.
- field_sync_conflicts — envelope/device/identity and entity reference; authorized device owner and resolver only.
- field_sync_cursors — device to field_devices.organization_id; worker/device roles only.
- field_sync_envelopes — device organization and identity; constrained queue policy.
- measurements — activity; captured identity/device are audit attributes, not tenant selectors.
- mrv_observations — activity; measurement must belong to same activity.
- mrv_provenance_events — activity; evidence and verification must match activity tenant.
- registry_events — credential/activity and owner organizations; issuer/from-owner/to-owner access modeled explicitly.
- settlement_events — settlement payer/payee; separate party visibility and append-only semantics.
- settlements — obligation, credential, payer and payee organizations; bilateral scope, not simple tenant equality.
- stakeholder_application_approvals — application and approval geography; applicant and platform reviewer access separated.
- verifications — activity/evidence and verifier identity; subject tenant and independently authorized verifier both required.

### C. Identity/authentication restricted tables

Separate auth data-access contract; ordinary app runtime denied direct access:

- identities — identity service only; minimal claims through controlled auth functions/views.
- identity_credentials — auth runtime only.
- identity_password_credentials — auth runtime only; no app runtime access or broad SELECT.
- identity_sessions — auth runtime only; token hashes and revocation state are security-sensitive.

### D. Global reference/governance tables

Global read may be appropriate for authenticated users; writes reserved for controlled governance/service roles and audit logged:

- carbon_market_mechanisms
- ccts_methodology_registry
- epr_schemes
- geography
- geography_sources
- methodology_governance_evidence
- methodology_versions
- regulatory_requirements
- regulatory_sources

### E. Platform-internal / operational tables

Ordinary tenant app roles have no direct access unless a documented API path proves necessity:

- operation_sync_envelopes — ingestion worker only; actor-bound payloads and replay controls.
- platform_audit_chain_head — audit writer/security owner only.
- schema_migrations — migration principal only.
- stakeholder_applications — applicant-scoped self-view plus controlled platform-review workflow; never a simple tenant-wide read.

## Special policy hazards

1. Multi-party rows: EPR transfers, credits, chain-of-custody, registry events, settlements and BWG processor references have multiple organizations. Define per-party visibility and permitted state transitions; do not use one organization predicate.
2. Parent consistency: BWG reports, evidence, measurements, calculations, provenance, verification and artifact versions need cross-FK consistency checks.
3. Global rows: roles, methodology and regulatory data need explicit system/tenant distinction. NULL organization must not mean universally writable.
4. Identity/auth: app server must not connect with auth runtime credentials or query credential/session tables directly.
5. Append-only records: audit, provenance, registry and settlement events need INSERT-only or controlled append permissions plus integrity triggers.
6. Worker queue: sync and MRV workers need dedicated queue access and job-scoped capability, not broad app runtime access.
7. Current owner bypass: production role rupaykg has BYPASSRLS and owns all tables. RLS policies cannot protect against it. Dedicated NOBYPASSRLS runtime roles and controlled owner/migration roles are mandatory.
8. Onboarding and platform authority remain separate from normal tenant CRUD.

## Rehearsal and acceptance gates

Before production DDL:

- Provision in disposable PostgreSQL the exact role graph: non-login app/auth/worker owners; login app/auth/worker runtimes; dedicated migration/bootstrap principal; no runtime owner membership; NOINHERIT and NOBYPASSRLS for every runtime.
- Assert runtime roles cannot own tables, create in public, bypass RLS, read password/session tables from app runtime, or execute unapproved privileged functions.
- Exercise every policy table with tenant A and tenant B; verify SELECT, INSERT, UPDATE, DELETE, FK side-channel and RETURNING behavior.
- Test absent/forged context, cross-tenant IDs, mismatched parent FKs, suspended identity, revoked membership, unverified organization, platform-authority boundary and geography boundary.
- Test trigger invoker behavior under actual runtime role after function ACL narrowing.
- Test all real route handlers and worker jobs, not only SQL predicates.
- Require migration rollback/recovery evidence, lock/statement-time review, backup/restore rehearsal and independent DBA/security sign-off.
- Keep production RLS at 0/67 until all gates are green; stage enablement only in a controlled release window.

## Release decision

NO-GO for production RLS migration at this checkpoint. This catalog classification is a first-pass 67-table map; multi-party policies, runtime-role provisioning, route coverage, test fixtures and independent review remain open. No production state was changed. TRL 9 is not established.
