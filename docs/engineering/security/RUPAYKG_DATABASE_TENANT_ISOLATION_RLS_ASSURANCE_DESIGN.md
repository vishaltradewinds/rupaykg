# RupayKg Database Tenant Isolation — RLS Assurance Design

**Date:** 2026-11-01  
**Status:** Design and inventory only — NOT an approved production migration  
**Authoritative database:** Neon project `rupaykg-production-fresh`, default branch `main`, database `rupaykg`  
**Disposable rehearsal branch:** `rupaykg-rls-assurance-lab-20261101` (`br-red-salad-b4oqb4nx`)

## 1. Executive finding

Read-only inspection of the authoritative production branch found:

- 67 public ordinary tables.
- 0/67 tables have Row Level Security enabled.
- 0/67 tables have FORCE ROW LEVEL SECURITY enabled.
- All 67 public tables are owned by the `rupaykg` role.
- The `rupaykg` role has `rolbypassrls=true`.
- The Neon `main` branch was reported as `protected=false`.
- `schema_migrations` contained 92 rows, latest version `20261021`.

This is a production tenant-isolation release blocker. Application-level authorization remains necessary but is not a database boundary. No production SQL writes, DDL, role changes, branch-setting changes or deployments were performed.

## 2. Rehearsal environment

Created a fresh Neon child branch from production `main` at parent LSN `0/2EB8568`, timestamp 2026-11-01 17:26:04Z:

- Branch: `rupaykg-rls-assurance-lab-20261101`
- Branch ID: `br-red-salad-b4oqb4nx`
- Parent: `br-restless-base-b44cip2h`
- State: ready
- Compute: 0.25 CU minimum / maximum, suspend timeout 0
- Database: `rupaykg`

Read-only verification on the child branch reproduced 67 public tables, 0 RLS-enabled, 0 FORCE RLS, all 67 owned by `rupaykg`, and `rupaykg.rolbypassrls=true`. No data or schema changes have been made to this branch yet.

## 3. Schema classification — do not apply blanket policies

The 67 tables are not a homogeneous tenant model. Every table must be assigned one of the following policy classes before RLS is enabled.

### A. Direct single-organization scope
- `activities` — `organization_id`
- `audit_events` — `organization_id` plus actor identity
- `bwg_profiles`, `bwg_reporting_periods`
- `carbon_projects`
- `cpcb_swm_stakeholder_workspaces`, `cpcb_swm_status_history`
- `environmental_attribute_claims`
- `epr_obligations`
- `epr_returns`
- `esg_reporting_periods`
- `evidence_artifact_series`
- `field_devices`
- `obligations`
- `organization_bwg_assessments`, `organization_epr_applicability`, `organization_geography_scopes`, `organization_statutory_profiles`, `organization_verification_evidence`
- `platform_access_change_requests`
- `resource_flows`
- `roles` — organization-specific roles; global/reserved roles need a separate explicit policy.

### B. Derived organization scope through parent relationships
- `activity_assignments` → `activities`
- `bwg_epr_reports`, `bwg_esg_reports`, `bwg_waste_reports` → `bwg_reporting_periods`
- `carbon_calculations` → `activities` and/or `carbon_projects`
- `chain_of_custody_links` → `activities`, `resource_flows`, and actor organization
- `epr_credit_allocations` → `epr_credits` and `epr_obligations`
- `evidence` → `activities`
- `evidence_artifact_reviews`, `evidence_artifact_versions` → evidence/series
- `evidence_verification_requirements` → `activities`
- `measurements` → `activities`
- `mrv_observations` → `activities` / measurements
- `mrv_provenance_events` → activities/evidence/verifications
- `verifications` → activities/evidence and verifier authorization
- `registry_events` → credential and from/to owners
- `settlement_events` → settlement
- `stakeholder_application_approvals` → `stakeholder_applications`

Derived policies must use trusted parent relationships and must prevent orphan or mismatched cross-tenant references. Prefer composite tenant-aware foreign keys where practical after a compatibility audit.

### C. Multi-party organization scope — explicit bilateral or participant semantics required
- `credentials` — issuer organization plus activity ownership and credential lifecycle.
- `epr_credits` — issuer and optional recycler; both parties may have distinct allowed views/actions.
- `epr_credit_transfers` — from/to organizations.
- `settlements` — payer/payee and credential/obligation linkage.
- `registry_events` — from/to owner plus credential issuer.
- `chain_of_custody_links` — actor organization plus activity and resource flow.

Do not force these into a single `organization_id = current_org` policy. Define per-command read/write semantics for issuer, recycler, sender, receiver, payer, payee, verifier and regulator roles. In particular, bilateral settlement access must not accidentally grant unrestricted tenant-wide access.

### D. Identity-scoped / personal data
- `identities`
- `identity_credentials`
- `identity_password_credentials`
- `identity_sessions`
- `field_sync_envelopes`
- `field_sync_conflicts` and `field_sync_cursors` through their envelope/device ownership
- `operation_sync_envelopes`

These require identity ownership and tightly scoped platform operations. Do not expose password hashes, token hashes, sessions or identity records through organization-wide policies. Identity administrators and account recovery need separately reviewed privileged pathways.

### E. Global reference / controlled platform data
- `carbon_market_mechanisms`
- `ccts_methodology_registry`
- `epr_schemes`
- `geography`, `geography_sources`
- `methodology_governance_evidence`, `methodology_versions`
- `regulatory_requirements`, `regulatory_sources`
- `schema_migrations`

Global read access may be appropriate for selected reference tables, but write access must remain restricted to controlled governance/migration roles. `epr_schemes` includes jurisdiction linkage and must be checked for whether all rows are truly global or have a regional visibility rule.

### F. Platform-internal integrity/control
- `platform_audit_chain_head` — platform-wide integrity state; no tenant direct access.
- `stakeholder_applications` — applicant identity plus organization; reviewer visibility requires a dedicated authorized queue policy.
- `organization_memberships` — identity + organization; users may read only their own memberships and authorized organization administrators may manage memberships under approval constraints.
- `organizations` — visibility of public/pending/legal-verification attributes must be deliberately separated from private legal evidence.
- `field_sync_conflicts` — ownership derives from sync envelope/device; platform conflict-resolution action is separately privileged.

**Inventory note:** classifications above are provisional until the full 67-table DDL, every view/function/trigger, and all application query paths are mapped. The production foreign-key inventory contains 150+ tenant-relevant relationships; policy coverage must be generated from actual constraints, not table-name assumptions.

## 4. Authentication and transaction context — mandatory design decision

Current application authentication in `apps/src/auth.ts`:
- Bearer token is SHA-256 hashed and matched against `identity_sessions.token_hash`.
- Session must be unrevoked and unexpired.
- Identity must be VERIFIED and not suspended.
- Active organization is selected from verified memberships; multi-organization identities must explicitly select one.
- Settlement routes may intentionally operate across a bilateral organization scope.

The current authentication queries and most route queries use the shared `pg.Pool`. RLS cannot safely depend on a session-level `SET app.organization_id` left on pooled connections; that risks cross-request context leakage.

Required context design:
1. Bind every authenticated request's database work to a checked-out client and a transaction (or an equivalent rigorously proven connection-scoped wrapper).
2. Establish context transaction-locally and clear it automatically on commit/rollback.
3. Bind identity, active organization, and an explicit purpose/scope (ordinary single-org vs approved bilateral operation).
4. Validate context against a live, unrevoked, unexpired `identity_sessions` row and verified membership; do not trust an arbitrary caller-supplied organization UUID.
5. Do not rely solely on user-settable custom GUC values as an authentication proof. A caller with SQL execution can set arbitrary custom GUCs. Evaluate a SECURITY DEFINER context setter that validates the opaque bearer token (hash comparison), checks membership, and issues a transaction-bound signed context whose signing secret is inaccessible to the runtime role; or another reviewed mechanism with equivalent guarantees.
6. Pin SECURITY DEFINER function search_path, revoke PUBLIC execution, grant only required EXECUTE, schema-qualify objects, and test transaction rollback/pool reuse.
7. Preserve multi-organization user semantics and the explicit bilateral settlement exception without turning it into a general cross-tenant bypass.

A plain `SET LOCAL app.organization_id` implementation is NOT approved until its threat model explains how arbitrary SQL under the runtime role cannot impersonate another tenant.

## 5. Runtime role separation

The current `rupaykg` role owns every public table and has BYPASSRLS. Enabling RLS alone would not protect queries executed by that owner/BYPASSRLS role.

Target role model (names provisional):
- `rupaykg_owner`: non-login schema/table owner, used only by controlled migrations.
- `rupaykg_runtime`: LOGIN runtime role; not table owner, no SUPERUSER, no BYPASSRLS, no CREATEDB/CREATEROLE/REPLICATION; minimum required table/sequence/function privileges only.
- `rupaykg_security_definer`: NOLOGIN owner for narrowly scoped context/policy helper functions, not a general application role.
- Separate read-only/reporting role only if a real use case and policy matrix justify it.

Do not simply revoke BYPASSRLS from the existing owner role without mapping all deployment/migration/runtime dependencies. Do not change production roles as part of this design stage.

## 6. Required implementation phases

### Gate 0 — inventory and compatibility (current)
- Snapshot full schema, grants, owners, RLS flags, policies, functions, triggers, views, routes, background workers and scheduled jobs.
- Map every tenant-owned row to a direct or derived tenant key.
- Identify cross-tenant business processes and all privileged system paths.
- Confirm data quality: orphan links, mismatched parent/child tenant IDs, null tenant keys, shared rows.
- Freeze a table-by-table policy matrix with SELECT/INSERT/UPDATE/DELETE and USING/WITH CHECK semantics.

### Gate 1 — context and runtime-role prototype
- Implement request transaction context without changing production.
- Create a non-owner/non-BYPASSRLS test runtime role on disposable branch.
- Prove the context cannot be forged by setting custom GUCs or changing organization headers.
- Prove context is cleared on commit, rollback, exceptions and pooled connection reuse.

### Gate 2 — policy implementation in small table families
- Start with direct single-tenant tables and parent-derived children.
- Add explicit bilateral policies for credits, transfers, credentials, registry and settlements.
- Keep reference, identity and platform-internal tables on dedicated policies.
- Enable and FORCE RLS where appropriate; do not blanket-enable global/system tables.
- Add supporting indexes for policy predicates only after EXPLAIN and workload testing.

### Gate 3 — exhaustive negative and positive tests
- Runtime role only; never test as owner/superuser.
- Two or more tenants and identities; include users with one and multiple memberships.
- SELECT, INSERT, UPDATE, DELETE, RETURNING, upsert, joins, views, functions, CTEs, bulk operations.
- Attempt cross-tenant ID substitution, parent-child mismatch, evidence/report leakage, bilateral transfer abuse, credential/settlement leakage.
- Test background workers, sync ingestion, jobs, admin review queues and break-glass pathways.
- Test connection pool reuse, concurrent requests, rollback, failed transactions and context absence.
- Prove default-deny: no context means no tenant data and no tenant writes.

### Gate 4 — migration and operations rehearsal
- Apply migrations to a fresh clone and a second rehearsal branch.
- Measure lock duration, table scan cost, policy query plans, migration runtime and rollback feasibility.
- Validate backup/restore and point-in-time recovery.
- Validate deployment compatibility and staged rollout with observable fail-closed behavior.
- Confirm all workers use the restricted runtime role and set trusted context.
- Independent security review and signed approval required.

### Gate 5 — production rollout (not authorized)
- Production rollout requires explicit release approval, maintenance/rollback plan, monitoring, backup confirmation, independent review, and full Gate 0–4 evidence.
- No production RLS, grants, role, owner, branch protection or schema changes until these gates pass.

## 7. Acceptance criteria

- 100% of 67 public tables assigned an approved policy class and policy owner.
- 100% of tenant-owned tables protected by RLS or a documented, independently accepted alternative with explicit rationale.
- Runtime role is not owner and has no BYPASSRLS.
- All tenant writes have both USING and WITH CHECK semantics appropriate to the table.
- No unauthorized cross-tenant read/write across all CRUD and relationship paths.
- Identity, legal evidence, session/password data and platform audit integrity remain appropriately isolated.
- Transaction context is cryptographically or otherwise robustly bound to the authenticated session and active organization; arbitrary custom GUC spoofing is rejected.
- All HTTP routes, workers, jobs, sync consumers and admin paths are migrated to the context contract.
- Rehearsal, performance, rollback and independent review evidence is recorded.
- No unresolved P0/P1 security finding.

## 8. Current status and next action

- [x] Production metadata and RLS posture inspected read-only.
- [x] Fresh Neon disposable branch created from current production HEAD.
- [x] Rehearsal branch baseline re-verified read-only.
- [x] Foreign-key and tenant-key inventory collected.
- [x] Current auth implementation reviewed.
- [ ] Complete all-table DDL, view/function/trigger and grants inventory.
- [ ] Approve and prototype session-bound transaction context.
- [ ] Prototype restricted runtime role and policy families on disposable branch.
- [ ] Add integration test harness and route/worker migration.
- [ ] Independent review.

**Release decision: HOLD.** This document is an engineering design baseline, not evidence of RLS implementation or production certification.


## 9. Additional executable-surface inventory (disposable branch, read-only)

The fresh rehearsal branch was also inspected for database executable surfaces:

- `pgcrypto` extension is installed (version 1.4), so HMAC/digest primitives are available for a future signed-context prototype; this does not itself validate a context design.
- No public views were found in `pg_views`.
- 115 functions exist in schema `public`.
- 0 of those functions are marked SECURITY DEFINER.
- 78 functions are owned by `rupaykg`.
- All 115 resolve to PUBLIC EXECUTE under the effective default ACL.
- 70 user-defined triggers are present.

This is not automatically a vulnerability: trigger functions and non-definer functions have different invocation and privilege semantics. It is, however, an excessive/unreviewed callable surface that must be classified. Before introducing a restricted runtime role:
1. Inventory every non-trigger function's callers and required grants.
2. Revoke PUBLIC EXECUTE from application helper functions by default; grant exact signatures to the intended runtime/security roles.
3. Review trigger functions and trigger execution under a non-owner role; ensure required writes/reads remain valid without broad table grants.
4. Move privileged context helpers into a non-public schema with pinned search_path, minimal SECURITY DEFINER ownership, and exact EXECUTE grants.
5. Test function behavior with RLS active and runtime role non-owner/non-BYPASSRLS, including nested trigger calls.

The current database role owns all application functions and tables; role separation therefore requires coordinated ownership/grant migration, not only a new LOGIN role.
