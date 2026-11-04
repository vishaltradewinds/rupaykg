# RupayKg Tenant Isolation and PostgreSQL RLS — Architecture Decision Record (Draft)

**Date:** 2026-10-31  
**Status:** DRAFT — design only; not approved for production implementation  
**Production posture:** read-only inspection only; no roles, grants, policies or schema changes made.

## 1. Decision required

RupayKg intends to operate as pan-India infrastructure serving organisations, processors, producers, ULBs, state authorities, project developers, auditors and other stakeholders. National-scale operation requires enforceable tenant and jurisdiction boundaries.

The production database inspection found:
- 67 public base tables.
- 0 tables with RLS enabled.
- 0 tables with FORCE ROW LEVEL SECURITY.
- 0 public-schema RLS policies.
- The inspected Neon session login rupaykg has BYPASSRLS=true, CREATEROLE=true, CREATEDB=true, SUPERUSER=false and LOGIN=true.

This role fact describes the inspected database session. It does not prove that Render uses the same login; the deployed runtime principal remains unverified. The inspected login is privileged and must not be treated as a least-privilege application or worker identity.

## 2. Recommended target

Adopt a hybrid national control plane plus tenant-scoped data plane, with PostgreSQL RLS as a mandatory database enforcement layer for tenant-owned records.

- National control plane owns regulatory source versions, rule catalogue, jurisdiction crosswalks, platform policy, integration routing and aggregate operational oversight.
- Tenant data plane owns organisation-specific operational, evidence, compliance, project and transaction records.
- National ingestion authenticates and records source provenance, then routes records to tenant/jurisdiction-scoped processing identities.
- Cross-tenant transactions are explicit multi-party records with separately defined visibility to each participant; they must not be implemented as unrestricted global reads.
- Dedicated database deployments may be offered to high-assurance institutions, but are not the default architecture.

This ADR does not approve or activate the proposed queue worker.

## 3. Non-negotiable security model

1. Web runtime role must be a dedicated LOGIN role with NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB and only required table/function privileges.
2. Web runtime must not own tenant tables, schema or policies.
3. Migration owner and runtime identities must be separate. The migration identity must be time-bounded, independently controlled and not used by the web server.
4. Every tenant-owned table must have a row policy for SELECT, INSERT, UPDATE and DELETE as applicable. Immutable evidence/event tables should have narrowly scoped INSERT only and no UPDATE/DELETE for runtime roles.
5. Use FORCE ROW LEVEL SECURITY where table ownership and legitimate maintenance patterns allow; exceptions must be explicit and reviewed.
6. RLS must fail closed when authenticated request context is absent, expired, invalid or ambiguous.
7. Application authorization remains mandatory; RLS is defence in depth, not a replacement for permission checks.
8. Every database transaction must establish and clear request context safely. Connection-pool reuse must not leak identity or tenant context between requests.
9. Do not trust a caller-controlled custom PostgreSQL setting as identity proof. A raw SET app.identity_id can be forged by a session with the same login. Context propagation must prevent arbitrary identity impersonation, for example a signed short-lived request context validated by a tightly controlled database function, or tenant-specific database credentials/roles.
10. Superuser, table-owner and BYPASSRLS paths are outside ordinary tenant request handling and require separate audited break-glass controls.

## 4. Provisional table classification from production catalog

This first-pass classification was derived from information_schema columns and foreign-key metadata. It is not a final policy list; each table needs row ownership, mutation and cross-tenant semantics reviewed.

### 4.1 Direct organisation-scoped candidates

These tables contain an organization_id column:
- activities
- audit_events
- bwg_profiles
- bwg_reporting_periods
- carbon_projects
- cpcb_swm_stakeholder_workspaces
- cpcb_swm_status_history
- environmental_attribute_claims
- epr_returns
- esg_reporting_periods
- evidence_artifact_series
- field_devices
- obligations
- organization_bwg_assessments
- organization_epr_applicability
- organization_geography_scopes
- organization_memberships
- organization_statutory_profiles
- organization_verification_evidence
- platform_access_change_requests
- resource_flows
- roles
- stakeholder_applications

Important exceptions:
- audit_events needs tenant read policy plus a separate append-only writer path.
- organization_memberships and roles are security-sensitive; mutation needs dual-control/administrative rules.
- platform_access_change_requests requires requester/approver/target-specific visibility, not generic membership alone.
- stakeholder_applications may represent pre-membership onboarding; applicant identity and assigned review authority must both be considered.
- organization_geography_scopes must not allow an organisation to grant itself arbitrary jurisdiction scope.

### 4.2 Multi-party organisation records

These tables contain one or more organisation references and need explicit participant policy, not a simplistic active-organisation equality check:
- bwg_waste_reports — processor_organization_id and reporting-period ownership.
- chain_of_custody_links — actor_organization_id, geography, activity and evidence.
- credentials — issuer_organization_id plus activity ownership and registry visibility.
- epr_credit_transfers — from_organization_id and to_organization_id.
- epr_credits — issuer and recycler organisation references.
- settlements — payer_id and payee_id; both parties may see the transaction, but sensitive payment fields require scoped visibility.
- registry_events — visibility derives from credential and current/former owner; event immutability must be preserved.

### 4.3 Child records inheriting ownership through parent relations

These should use parent-scoped policies or a carefully validated denormalised tenant key with consistency constraints. Do not assume a child row is safe merely because its parent has a UUID.

- Activity/evidence/MRV children: activity_assignments, carbon_calculations, evidence, evidence_verification_requirements, measurements, mrv_observations, mrv_provenance_events and verifications.
- Evidence artefact children: evidence_artifact_reviews and evidence_artifact_versions via series/evidence.
- BWG/ESG children: bwg_epr_reports, bwg_esg_reports and esg_metrics via reporting period.
- EPR children: epr_credit_allocations and epr_obligations via credit/obligation.
- Field sync children: field_sync_envelopes, field_sync_conflicts, field_sync_cursors and operation_sync_envelopes via device/identity and applied entity scope.
- Settlement children: settlement_events.
- Other derived children: chain_of_custody_links, credentials and carbon_calculations.

Parent relationship, deletion semantics and cross-tenant participant visibility must be reviewed for each child. Prefer indexed direct tenant keys for high-volume tables if query-plan and integrity testing show parent-join RLS is too expensive, but enforce parent/tenant consistency with database constraints or triggers.

### 4.4 Identity-scoped and platform-sensitive tables

- identities
- identity_credentials
- identity_password_credentials
- identity_sessions
- field_sync_envelopes
- operation_sync_envelopes
- platform_access_change_requests
- platform_audit_chain_head

Identity data should be scoped to the authenticated identity and narrowly authorised security administrators. Password hashes, salts, session token hashes and authentication metadata must never be exposed through ordinary tenant reads. The global audit-chain head is maintenance-only and should not be available to tenant runtime queries.

### 4.5 Global reference data candidates

These appear to be shared reference/control data, but require a separate write policy and source authority model:
- carbon_market_mechanisms
- ccts_methodology_registry
- epr_schemes
- geography
- geography_sources
- methodology_governance_evidence
- methodology_versions
- regulatory_requirements
- regulatory_sources
- schema_migrations

Organizations is a root entity and needs membership-scoped read plus privileged onboarding/verification write rules; it must not be treated as unrestricted global data. platform_audit_chain_head is platform-only. Any table not explicitly classified remains deny-by-default until reviewed.

## 5. Context propagation options to evaluate

### Option A — Tenant-specific database login/role
Strong database identity boundary, but operationally expensive at national scale and requires safe connection-pool partitioning.

### Option B — Shared non-owner runtime role plus signed request context
One runtime role with NOBYPASSRLS, no table ownership and narrow grants. Each request receives a short-lived signed context, validated by a narrowly controlled function. RLS predicates use only verified context. Requires cryptographic key custody, expiry, revocation, function hardening and injection threat tests.

### Option C — Shared runtime role plus plain custom GUC
Not acceptable as the sole security boundary. A session that can set arbitrary custom GUC values may impersonate another tenant if policies trust those values directly.

Recommended investigation order: prototype Option B in a disposable production-derived branch, compare it against Option A for threat model and operating cost, and reject Option C as a standalone boundary.

## 6. Required test programme

- No context, invalid signature, expired context returns zero tenant rows and rejects writes.
- Tenant A cannot SELECT, INSERT, UPDATE or DELETE Tenant B rows.
- A child row cannot be attached to a parent in another tenant.
- A cross-party EPR transfer is visible only to authorised sender/recipient and approved oversight roles.
- Settlement payer/payee visibility is correct; payment secrets and internal notes remain restricted.
- Evidence, verifications and audit events cannot be altered or deleted by tenant runtime roles.
- Identity credentials, password hashes and session data are not visible to another identity or ordinary tenant role.
- Revoked membership is effective immediately for new transactions.
- A pooled connection cannot carry context from one request to the next.
- Table owner, migration role, superuser and BYPASSRLS paths are separately tested and logged.
- Direct SQL access with the runtime credential cannot forge another tenant context.
- Every API route, background worker, offline sync operation and reporting query is tested against the same boundaries.
- Query plans and latency are measured with representative row counts.

## 7. Implementation sequence

1. Inventory every table, primary key, foreign key, trigger, view, function, owner and grant.
2. Approve data classification and ownership/participant semantics.
3. Design and review signed context or tenant-specific identity mechanism.
4. Create least-privilege roles in a disposable rehearsal only.
5. Add RLS policies in ordered forward-only migrations, starting with a small representative set.
6. Run adversarial isolation tests and compare API behaviour.
7. Extend to all tenant-owned tables and child tables.
8. Review all SECURITY DEFINER functions and views for RLS bypass paths.
9. Test pooling, concurrency, offline sync and background processing.
10. Obtain independent security review and explicit approval before any production migration.

## 8. Explicit non-decisions

This draft does not approve a national system-queue worker, a global queue identity with access to all tenant data, production role creation, grants, RLS policies or migrations, Render environment changes or deployment. It does not claim tenant isolation, certification or TRL 9.

## 9. Exit criteria

Tenant isolation is accepted only when every production table has an approved classification, all tenant-owned tables have database-enforced policies, the runtime principal cannot bypass them, cross-tenant adversarial tests pass, privileged paths are independently reviewed, and the exact deployed runtime identity is verified without exposing credentials.
