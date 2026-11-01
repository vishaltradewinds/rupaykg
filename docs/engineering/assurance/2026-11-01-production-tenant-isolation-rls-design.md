# Production Tenant Isolation and RLS Design

**Status:** Design / engineering gate only — not approved for production
**Date:** 2026-11-01
**Authoritative database:** Neon project `rupaykg-production-fresh`, project ID `steep-mud-79906940`, default branch `main`, database `rupaykg`
**Disposable rehearsal branch:** `rupaykg-rls-assurance-lab-20261101` (`br-red-salad-b4oqb4nx`), forked from production main at 2026-11-01T17:26:04Z
**Related blocker:** GitHub issue #196

## 1. Executive decision

RupayKg must implement database-enforced tenant isolation before production certification. The current production snapshot has 67 public ordinary tables, zero with RLS enabled, zero with FORCE RLS enabled, and the application-connected `rupaykg` role has `BYPASSRLS=true`. All 67 public tables are owned by `rupaykg`. The production Neon main branch is not protected.

A partial RLS experiment already exists on branch `rupaykg-tenant-isolation-lab-20261101`: four identity/authentication tables have RLS and FORCE RLS with 18 policies. Those policies are scoped to lab/owner roles and use broad `true` predicates; the `rupaykg` role still has BYPASSRLS. This experiment is not tenant isolation and must not be promoted or treated as a reusable policy baseline.

The newer `rupaykg-rls-assurance-lab-20261101` is a clean production snapshot with no RLS changes. Use it for a controlled design and migration rehearsal. No production writes, DDL, role changes, or branch-setting changes are authorized by this document.

## 2. Non-negotiable security principles

1. **Fail closed:** absent, malformed, stale, or unverified request identity/tenant context yields no tenant rows and no writes.
2. **One identity context:** derive actor identity only after validating the bearer session against `identity_sessions`; never trust a caller-supplied identity ID or organization ID as the security principal.
3. **Verified membership:** tenant access requires an active, `VERIFIED` membership and the route's explicit authorization. RLS supplements route/RBAC checks; it does not replace them.
4. **Transaction-local context:** set actor context using `set_config(..., true)` inside an explicit transaction. Never use session-level `SET` on pooled connections. Context must not survive COMMIT/ROLLBACK or connection reuse.
5. **Runtime role cannot bypass:** runtime role must be `NOBYPASSRLS`, must not own tenant tables, must not be superuser, and must not inherit a role that bypasses RLS. Table ownership belongs to a separate `NOLOGIN` migration/owner role.
6. **FORCE RLS:** enable and force RLS on tenant data tables after their policies and role grants are verified. FORCE RLS does not constrain superusers or BYPASSRLS roles.
7. **No blanket policy:** direct, derived, identity-scoped, global-reference, system-control, and multi-party tables require different policy models.
8. **No public broad policies:** never use `USING (true)` / `WITH CHECK (true)` for a tenant-facing runtime role.
9. **No accidental tenant elevation:** background jobs, ingestion, callbacks, sync workers and platform administration use explicit, separately audited service contexts and least privilege.
10. **Production stays unchanged:** rehearse on disposable Neon branches, add automated tests and obtain independent security review before production change.

## 3. Required runtime architecture

### 3.1 Separate database roles

Target role model (names are proposed and must be checked against existing Neon roles before migration):

- `rupaykg_owner`: `NOLOGIN`, owns application schema/tables/functions; migration ownership only.
- `rupaykg_runtime`: `LOGIN NOBYPASSRLS NOSUPERUSER`, ordinary API runtime; no table ownership, no role administration, no schema DDL.
- `rupaykg_auth_runtime`: narrowly scoped authentication role for login/session bootstrap only. It may read/validate session and identity records and perform narrowly defined auth mutations; it must not be used for normal tenant queries.
- `rupaykg_migrator`: separate deployment/migration credential with DDL privileges; not used by API workers.
- Provider-managed Neon roles are not application roles and must not be altered.

Do not simply change `BYPASSRLS` on the existing `rupaykg` role without first separating ownership, deployment/migration duties, auth bootstrap, and runtime privileges. The current migration runner uses the same `DATABASE_URL` as the API, so role separation requires an explicit production configuration and deployment contract (for example `DATABASE_URL` for runtime and `DATABASE_MIGRATION_URL` for migrations). Secrets must never enter source control or logs.

### 3.2 Request identity and transaction context

The current API authenticates with `authenticate(request, pool)`, then most routes issue independent `pool.query(...)` calls. Some routes acquire clients and open explicit transactions. There is currently no universal tenant context transaction wrapper.

Before enabling tenant RLS, implement one central request-scoped database context layer:

1. Resolve bearer token using the narrowly scoped authentication connection.
2. Validate token hash, session expiry/revocation, identity status, and verified memberships.
3. Acquire one runtime-role client for the protected request.
4. Start a transaction and set transaction-local values, at minimum `app.actor_identity_id`; add `app.active_organization_id` only where the request has one selected and verified organization.
5. Execute every protected query and mutation on that same client/transaction. No protected query may silently fall back to the unscoped pool.
6. Commit only after successful handler completion; otherwise rollback. Always release the client.
7. For multi-organization views, RLS may expose rows for all verified memberships of the authenticated actor, while application authorization still selects permitted organization IDs. Do not use a caller-supplied organization ID without checking membership.
8. Background jobs must set a separately authenticated service principal and explicit organization scope; never inherit a previous request's identity.
9. Add connection-pool reuse tests proving context is cleared after both COMMIT and ROLLBACK, including concurrent requests for different identities.

The current `server.ts` constructs one `pg.Pool` from `DATABASE_URL`, and route modules use both `pool.query` and `pool.connect`. Refactor these call paths explicitly; do not attempt to retrofit security by setting session variables in a pool `connect` hook.

### 3.3 RLS policy helper functions

Design helper functions only after the runtime role and context contract is implemented and tested. Candidate helpers:

- `app_current_actor_id()`: safely parse transaction-local `app.actor_identity_id`; missing/invalid returns NULL, never a privileged default.
- `app_actor_has_verified_membership(org_id)`: checks `organization_memberships` for the current actor and `status='VERIFIED'`.
- `app_actor_can_access_activity(activity_id)`: derives the owning organization through `activities` and verified membership.
- Explicit multi-party helpers for issuer/recycler, sender/recipient, payer/payee, and credential owner access.

If helper functions are `SECURITY DEFINER`, pin `search_path`, schema-qualify every object, revoke PUBLIC execute, grant only required execution, and audit function owner and code. Prefer `SECURITY INVOKER` unless a narrowly justified ownership boundary requires definer rights. Avoid recursive RLS helper calls by using tightly scoped, reviewed helper ownership/policies.

## 4. Table-by-table classification (67 tables)

This inventory is derived from the live schema metadata (columns and foreign keys) on the production snapshot. It is a policy-design classification, not a claim that the final predicates have been implemented. Every table needs SELECT, INSERT, UPDATE and DELETE semantics explicitly decided; immutable/audit tables should generally deny UPDATE/DELETE to runtime.

| Table | Initial class | Tenant derivation / policy notes |
|---|---|---|
| activities | Direct tenant | `organization_id`; require verified membership and geography scope where applicable |
| activity_assignments | Derived tenant | Through `activity_id → activities.organization_id`; assigned identity must not grant tenant access by itself |
| audit_events | Direct / system audit | `organization_id` plus actor identity; permit narrowly scoped platform audit writers; append-only |
| bwg_epr_reports | Derived tenant | `reporting_period_id → bwg_reporting_periods.organization_id`; evidence/verification references must belong to same tenant |
| bwg_esg_reports | Derived tenant | Through reporting period; evidence/verification tenant consistency |
| bwg_profiles | Direct tenant | `organization_id`; statutory applicability and local-body authority states remain separate |
| bwg_reporting_periods | Direct tenant | `organization_id`; verified BWG applicability and route permissions also required |
| bwg_waste_reports | Derived + counterparty | Through reporting period; processor organization is a distinct counterparty scope |
| carbon_calculations | Derived tenant | Through activity and/or carbon project; enforce both references resolve to same permitted tenant |
| carbon_market_mechanisms | Global reference | Read-only catalogue; writes only migration/standards authority |
| carbon_projects | Direct tenant | `organization_id`; geography and methodology references are global controls |
| ccts_methodology_registry | Global reference | Read-only regulatory/methodology catalogue |
| chain_of_custody_links | Multi-party / derived | Resource flow, actor organization, activity and evidence must agree; explicit participant visibility |
| cpcb_swm_stakeholder_workspaces | Direct tenant | `organization_id`; creator identity is audit attribution, not a substitute for membership |
| cpcb_swm_status_history | Derived tenant / audit | Workspace and organization must match; append-only |
| credentials | Multi-party / derived | Issuer organization and activity owner; credential visibility follows issuer/owner/authorized verifier rules |
| environmental_attribute_claims | Direct + derived | `organization_id` must match activity/evidence/verification; prevent cross-tenant claims |
| epr_credit_allocations | Derived tenant | Through credit and obligation; both parent organizations must be authorized and compatible |
| epr_credit_transfers | Multi-party | Explicit from/to organization policy; both sides see only permitted transfer fields/states |
| epr_credits | Multi-party | Issuer and recycler organizations; explicit issuer/recycler access, not single-org equality |
| epr_obligations | Direct tenant | `obligated_organization_id`; obligation source and evidence must reconcile |
| epr_returns | Direct tenant | `organization_id`; obligation/evidence/verification references must be same tenant |
| epr_schemes | Global reference | Scheme catalogue; jurisdiction and authority metadata are shared |
| esg_metrics | Derived tenant | Through ESG reporting period and optional activity; all references must be consistent |
| esg_reporting_periods | Direct tenant | `organization_id`; report visibility and write permission separated |
| evidence | Derived tenant / identity | Through activity; captured-by identity/device is attribution and device scope |
| evidence_artifact_reviews | Derived tenant / identity | Through evidence; reviewer identity and verification permission |
| evidence_artifact_series | Direct tenant | `organization_id` and activity; creator identity is attribution |
| evidence_artifact_versions | Derived tenant | Through series/evidence; immutable version and uploader attribution |
| evidence_verification_requirements | Derived tenant | Through activity; evidence/verification references same activity |
| field_devices | Direct tenant / identity | `organization_id`; enrolled identity binding; device access limited to owner organization |
| field_sync_conflicts | Derived tenant / device | Through sync envelope/device; resolution actor authorized for owning organization |
| field_sync_cursors | Derived tenant / device | Through `device_id → field_devices.organization_id`; device-scoped service access |
| field_sync_envelopes | Derived tenant / device | Through device and identity; enforce device-to-identity binding |
| geography | Global reference | Shared hierarchy; writes only trusted data ingestion/admin |
| geography_sources | Global reference | Shared source catalogue; writes only trusted ingestion/admin |
| identities | Identity-scoped | Actor may read own profile; privileged auth/admin paths separately scoped |
| identity_credentials | Identity-scoped | Through `identity_id`; user self-access plus narrow auth verification |
| identity_password_credentials | Identity-private | Through `identity_id`; only auth service; never ordinary API or user-facing reads |
| identity_sessions | Identity-private | Through `identity_id`; auth service only; tokens never exposed |
| measurements | Derived tenant | Through activity; capture identity/device attribution; enforce activity tenant consistency |
| methodology_governance_evidence | Global standards evidence | Linked to methodology version; write only standards governance process |
| methodology_versions | Global standards reference | Shared controlled catalogue; only governance/migration writes |
| mrv_observations | Derived tenant | Through activity; measurement must belong to same activity |
| mrv_provenance_events | Derived tenant / audit | Through activity/evidence/verification; append-only, HCS evidence integrity |
| obligations | Direct tenant | `organization_id`; geography scope and obligation ownership |
| operation_sync_envelopes | Identity/device derived | Through actor identity and device; explicit ingestion service boundary |
| organization_bwg_assessments | Direct tenant | `organization_id`; evidence/verification and determiner identity consistent |
| organization_epr_applicability | Direct tenant | `organization_id`; evidence/verification and determiner identity consistent |
| organization_geography_scopes | Direct tenant | `organization_id`; organization-specific geography scope |
| organization_memberships | Identity + tenant | Member sees own membership; org admins see their organization; platform governance uses separate role |
| organization_statutory_profiles | Direct tenant | `organization_id`; determination identity; external authority confirmation distinguished |
| organization_verification_evidence | Direct tenant | `organization_id`; sensitive legal evidence restricted to authorized roles |
| organizations | Tenant root | Access only through verified membership, applicant workflow, or explicit platform governance |
| platform_access_change_requests | Governance / tenant | Requester, target identity, organization, membership and approver; dual-control workflow |
| platform_audit_chain_head | System control | No tenant runtime access; narrow append/verification function only |
| registry_events | Multi-party / derived | Through credential and from/to owner IDs; append-only and explicit participant visibility |
| regulatory_requirements | Global reference | Shared statutory catalogue; controlled standards writes |
| regulatory_sources | Global reference | Shared source catalogue; controlled standards writes |
| resource_flows | Direct tenant | `organization_id`; source/destination geography scopes |
| roles | Tenant + platform governance | Organization roles scoped to `organization_id`; reserved platform roles isolated |
| schema_migrations | System control | Migration role only; no runtime access |
| settlement_events | Multi-party / derived | Through settlement; payer/payee/actor visibility, append-only |
| settlements | Multi-party | Payer and payee organization visibility; credential/obligation ownership integrity |
| stakeholder_application_approvals | Identity / application / geography | Through application and approval geography; approver hierarchy and self-approval prevention |
| stakeholder_applications | Identity + tenant | Applicant identity, requested organization, geography and approval workflow |
| verifications | Derived tenant / independent verifier | Through evidence/activity; verifier may be outside tenant but only for assigned authorized scope |

### 4.1 Classification totals

The classes overlap where a record has both a direct tenant key and derived/counterparty references. Do not force them into a mutually exclusive single-key model. The policy owner for each table must be recorded in the implementation matrix with:
- tenant source expression;
- actor/organization access rule;
- SELECT predicate;
- INSERT `WITH CHECK`;
- UPDATE `USING` and `WITH CHECK`;
- DELETE rule (usually denied for immutable/regulated records);
- privileged service path;
- FK consistency constraints;
- test IDs.

## 5. Implementation sequence (gated)

### Gate A — complete inventory and compatibility
- Confirm the 67-table snapshot against the latest migration head.
- Inspect all FK relationships, nullable tenant fields, unique constraints, trigger functions, views, materialized views, sequences, partitions and SECURITY DEFINER functions.
- Trace every route, worker, scheduled job, webhook and sync processor that touches each table.
- Identify unauthenticated flows (login, signup, onboarding application) and platform-admin workflows.
- Reconcile existing lab-only auth RLS experiment; do not copy its broad `true` policies.

### Gate B — runtime context plumbing
- Implement authentication-role bootstrap and transaction-scoped runtime-role context.
- Make all protected route reads/writes use the request-scoped client.
- Add explicit service contexts for workers and ingestion.
- Ensure no route can silently fall back to owner/migrator role.
- Add integration tests for concurrent users, multi-org actor, context absence, context spoof attempts, rollback, commit, pooled connection reuse and handler errors.

### Gate C — policy migration in disposable branch
- Create roles and grants in the lab only, after confirming existing roles and role memberships.
- Start with a narrow, representative slice: organizations/memberships, activities, measurements, evidence, verifications, BWG reporting periods and reports.
- Add policies using only reviewed helper functions and explicit tenant relationships.
- Enable and FORCE RLS table-by-table after policy tests exist.
- Test as the actual runtime role with `BYPASSRLS=false`, not as owner or Neon admin.
- Expand to all 67 tables by classification; multi-party tables require explicit participant tests.
- Validate that schema migrations still run using the migrator role and the application runtime cannot perform DDL.

### Gate D — complete security acceptance
- Two-tenant test fixtures with distinct organizations, identities, roles and data.
- SELECT/INSERT/UPDATE/DELETE denial across every class and every table.
- Cross-tenant FK substitution and parent-child mismatch tests.
- Read-only/global reference catalogue behaviour.
- Identity privacy, password/session isolation, applicant onboarding, platform admin dual control.
- Multi-party EPR transfer, credit allocation, credentials, registry ownership and settlement payer/payee tests.
- Device/sync isolation and background-worker service scope.
- Transaction context isolation under pooled and concurrent requests.
- Explain/analyze query plans and performance regression checks.
- Migration rollback/recovery rehearsed on disposable Neon branches.
- Independent security review and signed acceptance evidence.

### Gate E — production change control (not authorized here)
- Protect Neon production main branch.
- Approve separate runtime and migration credentials and rotate secrets safely.
- Confirm all Render/other production services use the intended runtime role; workers use explicit service roles.
- Backup/PITR and rollback plan; maintenance window and monitoring.
- Apply reviewed migrations only through normal release pipeline.
- Verify RLS and grants in production read-only after deployment.
- Keep feature/release gate closed until all checks pass.

## 6. Immediate blockers and non-goals

- Do not enable RLS across all 67 tables with a blanket `USING (true)` policy.
- Do not remove BYPASSRLS from the current owner/runtime role before ownership and migration separation are complete; doing so could break migrations and still leave a privilege-escalation path.
- Do not create an `app.organization_id` policy without authenticated actor context and membership checks.
- Do not use connection-level/session-level GUCs on pooled connections.
- Do not assume RLS protects superuser, BYPASSRLS or owner access unless FORCE RLS applies (and even FORCE does not constrain superuser/BYPASSRLS).
- Do not make platform admins globally visible through ordinary tenant roles.
- Do not run schema or role changes on production during this design phase.
- No production deployment, migration, role update, branch protection change, or data mutation has been performed.

## 7. Evidence recorded

Read-only Neon production snapshot:
- 67 public ordinary tables.
- 0 RLS-enabled tables; 0 FORCE RLS.
- all 67 tables owned by `rupaykg`.
- connected `rupaykg` role has `BYPASSRLS=true`.
- production default branch `main` reported unprotected.
- 92 rows in `schema_migrations`, latest version `20261021`.

Disposable branch `br-red-salad-b4oqb4nx`:
- parent production branch `br-restless-base-b44cip2h` at LSN `0/2EB8568`.
- 67 public tables, 0 RLS-enabled, 0 policies at baseline.
- no schema changes made in this branch as part of this design checkpoint.

Existing tenant-isolation lab `br-blue-tooth-b4kvuut7`:
- four tables RLS-enabled and FORCE RLS.
- 18 policies, all broad `true` predicates for lab/auth-owner roles.
- `rupaykg` still has `BYPASSRLS=true`.
- this is a partial authentication-isolation experiment only; it is not acceptable production tenant isolation.

**Release decision: HOLD.** This document is an engineering plan and inventory, not an implementation certification.

## 3.4 Source-code compatibility inventory (2026-11-01)

A targeted source scan of the production API route modules found the current database access pattern is distributed rather than centralized:

- 118 textual `pool.query` call sites across the inspected server/auth/route modules.
- 20 explicit `pool.connect` call sites.
- 221 textual `client.query` call sites in those same modules.
- Explicit multi-statement transaction handling exists in auth, CPCB SWM, EPR returns, evidence vault, onboarding hierarchy, platform admin, registry, sync and workspace paths.

These are source occurrence counts (not a runtime query count), captured from the files on `main` during this audit. They establish that RLS cannot safely be switched on by a migration alone. The context plumbing work must include every direct pool query, explicit client transaction, auth bootstrap, admin workflow, and worker. Tests must fail if any protected route uses an unscoped connection.

Implementation recommendation:
- Introduce a typed request-scoped DB unit-of-work abstraction and pass it into route modules instead of a process-wide raw `Pool`.
- Keep auth bootstrap on its own restricted role/connection.
- Make transaction lifecycle explicit and centralized; avoid nested BEGIN/COMMIT in handlers.
- Add a lint/static test that disallows raw `pool.query` outside the DB infrastructure and migration modules.
- Add an integration test that instruments query acquisition and proves all authenticated tenant data statements execute under the request's transaction-local actor context and runtime role.
