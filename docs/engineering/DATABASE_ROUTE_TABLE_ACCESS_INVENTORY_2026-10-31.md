# Database access inventory — route × table × execution context

**Evidence date:** 2026-10-31  
**Branch:** `shakti/integrate-government-inbox-worker-2026-10-31`  
**Reviewed tree:** `ca66168a61da5efafc9f5abd67e22eda0586a51e`  
**Status:** first-pass static inventory; NOT an RLS policy specification and NOT production approval.

## Executive result

A static scan of the API route modules, server entry point, worker, acceptance seeder and migration runner found that tenant transaction support is present in several route modules, but is not uniformly applied. Multiple authenticated and privileged routes still execute direct pool queries or manually managed clients. The existence of a helper import does not prove every query in a module runs inside its context.

**Do not enable RLS on this evidence.** The inventory below is a discovery baseline. Before any policy migration, each SQL statement must be mapped to a verified identity, active organization, action permission, geography scope and execution role. Shared/global reads, platform-admin operations, identity/session flows and workers need distinct policies.

## 1. Route module inventory

The table lists explicit HTTP route registrations found by static scan. “Tenant wrapper” counts are syntactic call-site counts, not proof that all route queries are wrapped.

| Module | HTTP endpoints | Tenant transaction wrapper calls | Direct pool query calls | Manual pool connections | Initial disposition |
|---|---:|---:|---:|---:|---|
| auth-routes.ts | 8 | 0 | 14 | 3 | Identity/session/onboarding control plane; requires purpose-specific policies and transaction refactor |
| bwg-routes.ts | 1 | 1 | 0 | 0 | Tenant context present; inspect delegated EPR route and all SQL paths |
| cpcb-swm-routes.ts | 3 | 3 | 0 | 0 | Tenant context present; inspect audit writes and platform/stakeholder scope |
| epr-return-routes.ts | 4 | 4 | 0 | 0 | Tenant context present; parent/child ownership policy required |
| evidence-vault-routes.ts | 4 | 4 | 0 | 0 | Tenant context present; evidence, series, versions, reviews and verifications need inherited tenant scope |
| intelligence-routes.ts | 1 | 0 | 2 | 0 | Direct pool queries; tenant wrapper gap |
| mrv-routes.ts | 4 | 6 | 0 | 1 | Mixed helper/manual client use; inspect every query and outbound integration side effect |
| onboarding-hierarchy-routes.ts | 3 | 0 | 2 | 2 | Privileged governance and applicant paths; transaction and reviewer scope need separation |
| platform-admin-routes.ts | 16 | 0 | 8 | 1 | Dedicated platform control-plane access; not tenant policy by default; strong role/audit boundary required |
| registry-routes.ts | 8 | 0 | 0 | 1 | Manual transaction path; settlement is bilateral and registry ownership-specific |
| statutory-routes.ts | 5 | 0 | 10 | 0 | Direct pool query paths; tenant transaction gap |
| sync-routes.ts | 7 | 0 | 4 | 4 | Device/worker transaction contexts need explicit device and organization binding |
| value-routes.ts | 9 | 4 | 15 | 0 | Mixed direct-pool and tenant-helper paths in one module; high-priority refactor |
| workspace-routes.ts | 8 | 8 | 0 | 0 | Tenant helper present; shared reference joins and read filters still require proof |
| server.ts | 9 | 2 | 5 | 1 | Mixed health/global, authenticated tenant and sync operations; direct query audit required |

Endpoint counts exclude routes registered through nested route-registration functions and wildcard/static handlers not matched by the simple literal route scanner. The route list is therefore a module-level inventory, not a definitive OpenAPI contract.

## 2. Initial SQL table references by module

The following names were extracted from SQL text using conservative `FROM`, `JOIN`, `INSERT INTO`, `UPDATE` and `DELETE FROM` token scans. False positives from prose/comments and SQL aliases are possible; dynamic SQL and helper-internal SQL may be missed. Treat these as a review checklist, not a validated dependency graph.

| Module | Candidate table references |
|---|---|
| auth-routes.ts | `geography`, `identities`, `identity_password_credentials`, `identity_sessions`, `organization_geography_scopes`, `organization_memberships`, `organization_verification_evidence`, `organizations`, `roles`, `stakeholder_applications` |
| bwg-routes.ts | `epr_obligations`, `epr_schemes`, `geography`, `obligations` |
| cpcb-swm-routes.ts | `audit_events`, `cpcb_swm_stakeholder_workspaces`, `cpcb_swm_status_history`, `organization_memberships` |
| epr-return-routes.ts | `activities`, `epr_obligations`, `epr_returns`, `epr_schemes`, `evidence`, `obligations`, `verifications` |
| evidence-vault-routes.ts | `activities`, `evidence`, `evidence_artifact_reviews`, `evidence_artifact_series`, `evidence_artifact_versions`, `verifications` |
| intelligence-routes.ts | `activities`, `geography`, `organization_memberships` |
| mrv-routes.ts | `activities`, `evidence`, `measurements`, `mrv_observations`, `mrv_provenance_events`, `verifications` |
| onboarding-hierarchy-routes.ts | `geography`, `identities`, `organization_geography_scopes`, `organization_memberships`, `organization_verification_evidence`, `organizations`, `roles`, `stakeholder_application_approvals`, `stakeholder_applications` |
| platform-admin-routes.ts | `audit_events`, `identities`, `identity_sessions`, `mrv_provenance_events`, `organization_memberships`, `organizations`, `pg_roles`, `platform_access_change_requests`, `platform_audit_chain_head`, `roles`, `stakeholder_applications` |
| registry-routes.ts | `activities`, `credentials`, `evidence`, `mrv_provenance_events`, `organization_memberships`, `organizations`, `registry_events`, `settlement_events`, `settlements`, `verifications` |
| statutory-routes.ts | `activities`, `epr_schemes`, `evidence`, `organization_bwg_assessments`, `organization_epr_applicability`, `organization_statutory_profiles`, `verifications` |
| sync-routes.ts | `activities`, `audit_events`, `evidence`, `field_devices`, `field_sync_conflicts`, `field_sync_cursors`, `field_sync_envelopes`, `measurements`, `organization_memberships`, `resource_flows` |
| value-routes.ts | `activities`, `bwg_epr_reports`, `bwg_esg_reports`, `bwg_profiles`, `bwg_reporting_periods`, `bwg_waste_reports`, `carbon_calculations`, `epr_credits`, `epr_obligations`, `epr_schemes`, `esg_metrics`, `esg_reporting_periods`, `evidence`, `geography`, `methodology_versions`, `obligations`, `organization_geography_scopes`, `organization_memberships`, `verifications` |
| workspace-routes.ts | `activities`, `carbon_calculations`, `credentials`, `esg_metrics`, `esg_reporting_periods`, `evidence`, `geography`, `measurements`, `methodology_versions`, `obligations`, `organization_memberships`, `organizations`, `registry_events`, `resource_flows`, `settlements`, `verifications` |
| async-mirror-worker.ts | `activities`, `async_mirror_inbox`, `authoritative_source_snapshots`, `government_jurisdiction_crosswalks` |
| acceptance-seed.ts | `activities`, `activity_assignments`, `evidence`, `geography`, `identities`, `identity_sessions`, `measurements`, `mrv_observations`, `organization_geography_scopes`, `organization_memberships`, `organizations`, `roles`, `verifications` |
| migrate.ts | `schema_migrations` |
| server.ts | `activities`, `credentials`, `evidence`, `geography`, `measurements`, `obligations`, `organization_geography_scopes`, `organization_memberships`, `regulatory_sources`, `resource_flows`, `settlements`, `verifications` |

## 3. Data access classes and intended policy boundaries

This classification is an architecture target. Exact ownership paths and foreign keys must be confirmed from the live schema and all migration definitions before writing RLS policies.

| Data class | Representative tables | Intended access boundary |
|---|---|---|
| Identity and session | identities, identity_password_credentials, identity_sessions | Self-only identity/session access; authentication service narrowly scoped; no general tenant CRUD |
| Organization and membership | organizations, organization_memberships, roles, organization_geography_scopes, stakeholder_applications, stakeholder_application_approvals, organization_verification_evidence | Verified active membership for tenant reads; governance/review actions restricted to authorized reviewer and dual-control flow |
| Tenant operational / BWG | activities, obligations, measurements, resource_flows, BWG profiles/reports/periods | Organization ownership + active membership + action permission + geography scope |
| EPR / statutory | epr_schemes, epr_obligations, epr_returns, organization_epr_applicability, organization_statutory_profiles, organization_bwg_assessments | Tenant-owned applicability/return records; governed read-only scheme/catalog reference |
| Evidence and verification | evidence, evidence_artifact_series, evidence_artifact_versions, evidence_artifact_reviews, verifications, mrv_observations, mrv_provenance_events | Derive tenant through authoritative parent activity/organization; append-only review/provenance semantics; verifier-specific action grants |
| Carbon / methodology | carbon_calculations, methodology_versions, ESG/BWG report tables | Tenant-scoped calculations and reports; approved methodology/reference versions read-only for tenant roles |
| Registry / environmental attributes | credentials, registry_events, epr_credits | Current issuer/owner/recipient and action-specific permissions; append-only transfer/retirement events |
| Bilateral settlement | settlements, settlement_events | Explicit payer/payee party access; no generic tenant-to-tenant bypass |
| Field device and sync | field_devices, field_sync_envelopes, field_sync_conflicts, field_sync_cursors | Enrolled device + organization + signed/validated envelope; worker identity separate from human session |
| Government source control plane | async_mirror_inbox, authoritative_source_snapshots, government_jurisdiction_crosswalks | Worker/service role for ingestion; governed reviewer role for approval; tenant role read-only only where explicitly published |
| Platform security/audit | platform_access_change_requests, platform_audit_chain_head, audit_events | Platform-admin and dedicated audit writer only; append-only chain constraints; tenant visibility only through approved scoped views |
| Shared authoritative reference | geography, regulatory_sources, epr_schemes, methodology_versions | Governed global read; controlled ingestion/approval writes |

## 4. Concrete gaps found

1. **Tenant transaction coverage is incomplete.** `intelligence-routes.ts`, `statutory-routes.ts`, `auth-routes.ts`, `onboarding-hierarchy-routes.ts`, `platform-admin-routes.ts` and `sync-routes.ts` have direct pool/manual-client paths without the shared tenant transaction wrapper.
2. **Mixed access within one module.** `value-routes.ts` has both tenant-helper calls and direct pool queries. These must be separated and audited per endpoint, not declared safe at module level.
3. **Platform-admin is a separate trust domain.** It uses a platform-wide authorization check and audit chain. It should not inherit ordinary tenant policies or become a generic RLS bypass. Use a separate privileged role/service path and explicit audited access.
4. **Authentication and onboarding are pre-tenant control-plane operations.** They need narrowly scoped policies for self-identity, credential, session, application and governance records; they cannot simply require an active organization context.
5. **Settlement is bilateral.** Payer/payee authorization must be modeled explicitly and tested for both parties, non-parties and cross-organization inference.
6. **Worker and seed paths are privileged.** `async-mirror-worker.ts` and `acceptance-seed.ts` use direct pool operations. The worker must receive its own narrowly scoped database identity. Acceptance seeding must remain unavailable to production and must never share the API runtime identity.
7. **Helper coverage is not proof of query coverage.** The tenant helper sets transaction-local identity and organization context on one checked-out client. A route is only protected when every tenant SQL statement executes through that same client and context.
8. **Server-level endpoints need classification.** Health/status and approved shared-reference reads are not tenant CRUD; overview and sync endpoints include organization-sensitive queries and need endpoint-level policy mapping.
9. **No blanket policy migration is safe yet.** Existing production baseline evidence records RLS disabled and zero policies on the inspected public tables. A route-by-route policy matrix and negative tests are prerequisites.

## 5. Required next implementation batch

### A. Complete query inventory
- Enumerate every SQL statement (including helper functions, views, triggers, scripts, worker and integration tooling).
- Map each statement to endpoint, action, table, tenant derivation path, permission, geography condition, execution role and expected row-level behavior.
- Resolve false positives/aliases and add exact migration-defined FK parent paths.
- Identify SQL that runs outside request transactions and SQL with outbound effects (Guardian/Hedera).

### B. Refactor execution contexts before RLS
- Tenant API transaction: verified identity + one active organization, transaction-local settings, one checked-out client for every SQL statement.
- Authentication service context: self-only identity/credential/session operations.
- Governance/reviewer context: narrowly scoped review and dual-control operations, audited.
- Platform-admin context: separate privileged path with explicit audited cross-tenant authority.
- Worker context: separate service role for inbox leases and source/crosswalk ingestion; no human impersonation.
- Migration context: non-login owner/migration role, never loaded into web runtime.
- Acceptance fixture context: disposable CI database only; fail closed in production.

### C. Policy design and test gates
- Inventory all table owners, grants, sequences, views, triggers, functions and SECURITY DEFINER functions.
- Write SELECT/INSERT/UPDATE/DELETE policies independently per table and access class.
- Add RLS only in disposable production-shaped database first; test using the exact non-owner runtime role with no BYPASSRLS.
- Positive/negative tests: tenant A/B isolation; missing/invalid context; revoked membership; wrong geography; cross-tenant FK injection; payer/payee/non-party; worker scope; platform-admin audit; pooled connection reuse.
- Verify FORCE ROW LEVEL SECURITY and owner behavior only after worker, migration and administrative paths are explicit.
- Run backup restore, migration replay and rollback rehearsal before any production change request.

## 6. Release gate

**Current decision: HOLD.** This inventory is documentation-only. No RLS policy migration, role/grant change, credential change, production deployment, worker activation or data mutation was performed by this batch. The diagnostic endpoint has not been deployed to Render, so the actual Render runtime role remains unknown. The observed Neon role findings must not be treated as proof of which role the Render application uses.

**TRL note:** this work is an engineering/security discovery artifact. It does not establish field validation, operational reliability, regulatory acceptance, or TRL 9.
