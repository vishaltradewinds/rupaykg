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
4. Start a transaction and set a transaction-local **signed request-context envelope** (for example `app.request_context`), not a plain actor/org GUC. The API signs actor ID, selected organization scope, issued-at, expiry and key ID with HMAC-SHA256. A tightly scoped database helper verifies the signature and expiry against a protected key table before any RLS policy accepts the context.
5. Execute every protected query and mutation on that same client/transaction. No protected query may silently fall back to the unscoped pool.
6. Commit only after successful handler completion; otherwise rollback. Always release the client.
7. For multi-organization views, RLS may expose rows for all verified memberships of the authenticated actor, while application authorization still selects permitted organization IDs. Do not use a caller-supplied organization ID without checking membership.
8. Background jobs must set a separately authenticated service principal and explicit organization scope; never inherit a previous request's identity.
9. Add connection-pool reuse tests proving context is cleared after both COMMIT and ROLLBACK, including concurrent requests for different identities.

The current `server.ts` constructs one `pg.Pool` from `DATABASE_URL`, and route modules use both `pool.query` and `pool.connect`. Refactor these call paths explicitly; do not attempt to retrofit security by setting session variables in a pool `connect` hook.

### 3.3 RLS policy helper functions

Design helper functions only after the runtime role and context contract is implemented and tested. Candidate helpers:

- `app_current_context_claims()`: reads the transaction-local signed envelope, verifies HMAC-SHA256 and short expiry using a protected key table, and returns actor plus authorized organization scope; missing, malformed, expired or forged context returns NULL.
- `app_actor_has_verified_membership(org_id)`: checks `organization_memberships` for the signed actor and `status='VERIFIED'`.
- `app_actor_can_access_activity(activity_id)`: derives the owning organization through `activities` and verified membership.
- Explicit multi-party helpers for issuer/recycler, sender/recipient, payer/payee, and credential owner access.

The plain custom GUC is caller-writable by any SQL session and is not sufficient as a production identity assertion. The disposable mechanics proof initially used a plain actor GUC; it has since been upgraded to a signed-envelope test. Production must use a cryptographically authenticated envelope so a query that can call `set_config` cannot simply change its actor or organization claim. Keep the HMAC key inaccessible to the runtime role; store it in a protected schema/table and in the API secret store, support key IDs/rotation, cap token lifetime (the lab used 120 seconds), and never log the token. Use a narrowly scoped `SECURITY DEFINER` verifier only for signature verification/key lookup: pin `search_path`, schema-qualify every object (including `public.hmac`), revoke PUBLIC execute, grant only required execution, audit the owner and function body, and ensure the runtime role cannot read the key table. Other policy helpers should prefer `SECURITY INVOKER` unless a narrowly justified ownership boundary requires definer rights. Avoid recursive RLS helper calls by using tightly scoped, reviewed helper ownership/policies.

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
- Baseline was 67 public application tables, 0 RLS-enabled, 0 policies.
- Added only an isolated `rls_lab` schema with two synthetic test tables, two synthetic actors/organizations and two NOLOGIN/NOBYPASSRLS lab roles. No existing application table, row, trigger, or production object was modified.
- Revoked the temporary CREATE-on-database privilege from the lab owner role after schema creation.

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

## 8. Additional production role privilege finding

A follow-up read-only query of the authoritative production branch inspected role attributes and inherited memberships for `rupaykg`:

- `rolbypassrls=true`
- `rolcreaterole=true`
- `rolcreatedb=true`
- `rolreplication=true`
- `rolinherit=true`
- membership in Neon-managed `neon_superuser`

The production database credential used for this inspection therefore does not merely bypass RLS: it inherits a highly privileged Neon role and has role/database creation and replication attributes. The deployed API's exact DATABASE_URL role must be verified separately from deployment configuration/telemetry; do not assume it is identical solely from this SQL inspection. Until proven otherwise, treat any service using the `rupaykg` credential as using a privileged administrative identity, not a least-privilege runtime identity. Do not expose it to ordinary API workers. This elevates runtime role separation and credential inventory to a P0 release gate. Neon-managed roles themselves must not be modified; create and validate application roles without inheriting provider-managed elevated roles.

A read-only inspection of the existing tenant-isolation lab also found proposed `rupaykg_app_runtime` / `rupaykg_auth_runtime` roles are not yet granted tenant-table privileges and have no runtime RLS policies; the `rupaykg` lab role has admin-option memberships on multiple lab owner/runtime roles. These role experiments are not proof of a usable production runtime split and must be audited before reuse.

### 8.1 Existing lab role/grant audit

On the existing tenant-isolation lab branch `br-blue-tooth-b4kvuut7`, read-only role/grant inspection found:
- `rupaykg_app_runtime` is LOGIN / NOBYPASSRLS, but has no table grants and no policies are defined for it.
- `rupaykg_auth_runtime` is LOGIN / NOBYPASSRLS, but the inspected auth-owner table grants are assigned to the separate NOLOGIN `rupaykg_auth_owner` role, not to `rupaykg_auth_runtime`.
- `rupaykg_app_owner`, `rupaykg_auth_owner`, `rupaykg_rls_lab_owner_20261101`, and other lab roles exist, but the current `rupaykg` role has admin-option memberships on several of them.
- `rupaykg` inherits Neon-managed `neon_superuser` and remains BYPASSRLS in that branch.
- The four RLS tables and their policies do not cover application tenant data; their predicates are broad `true` for lab/auth owner roles.

This proves that role names alone do not establish a least-privilege design. The new implementation must verify actual grants, inheritance, SET ROLE reachability, ownership, policy role targets and the live service's connection role. Existing lab role experiments should be treated as disposable research artefacts until reconciled; do not copy their grants or memberships into production.

## 9. Additional schema surface inventory

A read-only Gate A metadata scan on production main found:
- No public-schema views or materialized views.
- No public-schema sequences.
- No partitioned public tables.
- No public-schema `SECURITY DEFINER` functions in the inspected snapshot.
- Public-schema default privileges are configured for owner role `cloud_admin` to grant broad table and sequence privileges to Neon-managed `neon_superuser`.
- The production connection role `rupaykg` inherits `neon_superuser`, so those inherited privileges are part of the effective privilege analysis and must not be overlooked.
- Application integrity triggers are broadly enabled across activities, evidence, field sync, memberships, registry, settlements, stakeholder approval, and methodology governance. RLS rollout must test trigger execution under the non-owner runtime role; current trigger functions are owned by `rupaykg`, so ownership and execution/grant behaviour must be checked when moving tables/functions to the new owner role.

This reduces the immediate view/sequence/partition surface but does not reduce the tenant isolation blocker. Re-run this inventory after migrations and before each release gate; the live schema can evolve.

## 10. Disposable PostgreSQL RLS mechanics proof

On the clean Neon assurance branch `br-red-salad-b4oqb4nx`, I added a strictly isolated `rls_lab` schema (no changes to any of the 67 application tables) with synthetic actors, organizations and records. Two NOLOGIN roles were created:
- `rupaykg_rls_lab_owner_20261101`: NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOINHERIT, no role/database creation, no replication.
- `rupaykg_rls_lab_runtime_20261101`: same restricted role attributes; no table ownership.

Both test tables have RLS enabled and FORCE RLS. The membership policy derives actor and organization from a transaction-local signed `app.request_context` envelope; the records policy derives tenant visibility and writes through that membership. A SECURITY DEFINER verifier uses fixed `search_path = pg_catalog, rls_lab` and HMAC-SHA256, with the key stored in `rls_lab.context_keys`. The runtime role can execute the verifier but cannot read the key table. The lab runtime role receives only schema usage, membership SELECT and record SELECT/INSERT/UPDATE. The temporary database CREATE privilege granted to the owner role to establish the schema was revoked after setup.

### Observed test results
- Actor A sees only tenant A's synthetic records; actor B sees only tenant B's record.
- Runtime role with no context sees zero records (fail closed).
- A forged HMAC signature sees zero records.
- An expired signed context sees zero records.
- Setting the old unsigned `app.actor_id` GUC directly sees zero records; policies do not trust it.
- Runtime role cannot SELECT the protected `context_keys` table (permission denied).
- Actor A's cross-tenant UPDATE affects zero rows.
- Actor A's cross-tenant INSERT is rejected by PostgreSQL with a row-level security violation.
- Actor A can insert a record into its own organization and then sees both tenant-A records.
- Table owner role sees zero rows without signed context because FORCE RLS applies and no owner policy exists.
- The existing `rupaykg` role sees all three synthetic records despite FORCE RLS because it has BYPASSRLS; this demonstrates why the privileged owner/inspection role cannot be used as application runtime.

### Scope limitation
This is a PostgreSQL mechanics proof using synthetic data and a test-only HMAC key. It does **not** validate the RupayKg API's signing-key delivery/rotation, authentication-to-context binding, production role credentials, pooled request handling, all 67 table policies, worker isolation, or production readiness. It is not a release gate pass by itself. The next implementation step is the API request-scoped database unit-of-work and auth/runtime role split, followed by route-level acceptance under a real NOBYPASSRLS login role.

## 11. API route-to-table static inventory

A static SQL-reference scan of the 16 inspected API source modules identified direct SQL references to 52 of the 67 public tables. This is a source scan of `FROM`, `JOIN`, `INSERT INTO`, `UPDATE` and `DELETE FROM` patterns; it is not a complete runtime trace and may miss dynamic SQL, helper functions, trigger side effects, indirect views or database-only workflows.

| API module | Directly referenced tables |
|---|---|
| `server.ts` | activities, credentials, evidence, geography, measurements, obligations, organization_geography_scopes, organization_memberships, regulatory_sources, resource_flows, settlements, verifications |
| `auth.ts` | activities, evidence, identities, identity_sessions, organization_memberships, roles |
| `auth-routes.ts` | geography, identities, identity_password_credentials, identity_sessions, organization_geography_scopes, organization_memberships, organization_verification_evidence, organizations, roles, stakeholder_applications |
| `bwg-routes.ts` | epr_obligations, epr_schemes, geography, obligations |
| `cpcb-swm-routes.ts` | audit_events, cpcb_swm_stakeholder_workspaces, cpcb_swm_status_history, organization_memberships |
| `epr-return-routes.ts` | activities, epr_obligations, epr_returns, epr_schemes, evidence, obligations, verifications |
| `evidence-vault-routes.ts` | activities, evidence, evidence_artifact_reviews, evidence_artifact_series, evidence_artifact_versions, verifications |
| `intelligence-routes.ts` | activities, geography, organization_memberships |
| `mrv-routes.ts` | activities, evidence, measurements, mrv_observations, mrv_provenance_events, organization_memberships, verifications |
| `onboarding-hierarchy-routes.ts` | geography, identities, organization_geography_scopes, organization_memberships, organization_verification_evidence, organizations, roles, stakeholder_application_approvals, stakeholder_applications |
| `platform-admin-routes.ts` | audit_events, identities, identity_sessions, mrv_provenance_events, organization_memberships, organizations, platform_access_change_requests, platform_audit_chain_head, roles, stakeholder_applications |
| `registry-routes.ts` | activities, credentials, evidence, mrv_provenance_events, organization_memberships, organizations, registry_events, settlement_events, settlements, verifications |
| `statutory-routes.ts` | activities, epr_schemes, evidence, organization_bwg_assessments, organization_epr_applicability, organization_statutory_profiles, verifications |
| `sync-routes.ts` | activities, audit_events, evidence, field_devices, field_sync_conflicts, field_sync_cursors, field_sync_envelopes, measurements, organization_memberships, resource_flows |
| `value-routes.ts` | activities, bwg_epr_reports, bwg_esg_reports, bwg_profiles, bwg_reporting_periods, bwg_waste_reports, carbon_calculations, epr_credits, epr_obligations, epr_schemes, esg_metrics, esg_reporting_periods, evidence, geography, methodology_versions, obligations, organization_geography_scopes, organization_memberships, verifications |
| `workspace-routes.ts` | activities, carbon_calculations, credentials, esg_metrics, esg_reporting_periods, evidence, geography, measurements, methodology_versions, obligations, organization_memberships, organizations, registry_events, resource_flows, settlements, verifications |

The following 15 tables were not directly matched in these 16 route modules: `activity_assignments`, `carbon_market_mechanisms`, `carbon_projects`, `ccts_methodology_registry`, `chain_of_custody_links`, `environmental_attribute_claims`, `epr_credit_allocations`, `epr_credit_transfers`, `evidence_verification_requirements`, `geography_sources`, `identity_credentials`, `methodology_governance_evidence`, `operation_sync_envelopes`, `regulatory_requirements`, `schema_migrations`.

**Do not classify these 15 as obsolete or unused.** Several are written by database triggers, migration/standards processes, or other jobs not included in this route scan. Each requires a trace to its writers/readers before assigning a policy or excluding it from the RLS rollout. The implementation gate must close all 67 table classifications, including indirect database-only paths.

## 12. Signed request-context security boundary

The synthetic RLS lab was upgraded from a caller-writable `app.actor_id` GUC to a signed `app.request_context` envelope. In the lab:
- Envelope payload contains actor UUID, organization UUID, issued-at, expiry and key ID.
- HMAC-SHA256 signature is verified by a narrowly scoped `SECURITY DEFINER` function with fixed `search_path = pg_catalog, rls_lab`.
- The HMAC key lives in `rls_lab.context_keys`, owned by the lab owner role; the runtime role has no table privileges on that key store.
- Runtime receives only EXECUTE on the signature-verification function.
- The function returns no claims for missing, malformed, forged or expired envelopes.
- Membership and record RLS policies derive actor and organization from the verified claims, not from unsigned actor/org GUCs.

This is materially stronger than a plain custom GUC: the runtime can set `app.request_context`, but changing actor/organization claims invalidates the signature. It does not protect against compromise of the API signing key or a malicious trusted API process; those remain in the threat model. Production key storage, rotation, deployment secret delivery and a separate signed service-principal context for background workers must be designed and tested before rollout.
