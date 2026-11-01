# CTO resume checkpoint — 2026-11-01

**Repository:** `vishaltradewinds/rupaykg`
**Main baseline:** `b5e91241d84a6712ff544d3deec1805702f45efd`
**Checkpoint owner:** RupayKg CTO execution
**Release posture:** HOLD — production certification OFF — TRL 9 not established

This checkpoint consolidates the work completed on 2026-11-01 so a future engineering session can resume from verified state rather than repeat discovery.

## 1. Authoritative production database

- Neon project: `steep-mud-79906940`
- Production primary branch: `br-restless-base-b44cip2h` (`main`)
- Database: `rupaykg`
- Production branch remains the only identified authoritative live production branch.
- Production audit was read-only. No production schema, data, grants, role, RLS, or connection configuration was changed.

### Production security snapshot

- 67 public base tables.
- 0 RLS-enabled tables.
- 0 FORCE RLS tables.
- All 67 public tables owned by login role `rupaykg`.
- Inspected role `rupaykg` is a member of `neon_superuser`; flags include `CREATEROLE`, `CREATEDB`, `REPLICATION`, and `BYPASSRLS`.
- 46 tables have direct organization/workspace/identity/owner attribution columns.
- 21 tables have no direct attribution column and need inherited-owner or global-reference classification.
- A column-name match is not itself a tenant policy. Table-by-table owner/reader/writer semantics remain required.

## 2. Staging branch — preserve, do not delete

- Staging branch: `br-spring-hill-b4544vz5`
- Migration ledger: production 92 rows; staging 95 rows.
- Staging-only migration entries: `20261022_async_mirror_inbox.sql`, `20261023_async_mirror_worker_leases.sql`, `20261024_ai_intake_rate_limits.sql`, `20261025_ai_evidence_intake_jobs.sql`.
- Production-only historical version: `096_verification_authorization_provenance.sql`; source file is not present on main.
- Staging-only tables contain 12 inbox rows and 29 event rows. Eight PROCESSING leases were expired at audit time.
- Staging-only queue/intake tables had RLS disabled and no policies.
- Do not reset, drop, promote, or delete staging. Recover original migration sources and reconcile all inbox/event evidence before any worker activation.
- Asynchronous mirror and AI intake workers remain OFF.

See PR #188 and `docs/engineering/checkpoints/2026-11-01-neon-branch-reconciliation.md`.

## 3. Production startup safety — PR #187

[PR #187](https://github.com/vishaltradewinds/rupaykg/pull/187)
- Branch: `shakti/production-startup-safety-2026-11-01`
- Latest checkpoint head: `00c05975585c65b5cae0f84ee20456628f04c404`
- Latest CI: `41313803280` PASS.
- Docker and normal start scripts no longer run migrations or acceptance seeding.
- Adds explicit `npm run migrate:production`.
- Migration runner has TLS verification, a PostgreSQL advisory lock, a two-connection pool to avoid lock starvation, and exact Neon branch/database/role validation before DDL.
- Every Neon URL requires explicit expected target identity, even through the generic migration command.
- Adds manually dispatched GitHub Actions workflow `.github/workflows/production-migrate.yml`, pinned to production branch `br-restless-base-b44cip2h`, database `rupaykg`, role `rupaykg`.
- Workflow secrets are scoped only to the migration step.

**Do not use the workflow yet.** GitHub `production` Environment required reviewers and protected secrets are not configured/verified. It currently pins the privileged `rupaykg` role; a least-privilege migration identity and role split are required before production execution. No migration or deployment has been run.

## 4. Tenant isolation architecture and lab — PR #189

[PR #189](https://github.com/vishaltradewinds/rupaykg/pull/189)
- Branch: `shakti/tenant-isolation-architecture-2026-11-01`
- Branch head and latest CI are authoritative in the live [PR #189](https://github.com/vishaltradewinds/rupaykg/pull/189); do not reuse an older SHA from this document.
- Last recorded exact-head CI pass before the consolidated checkpoint: `41314197273` PASS; consolidated checkpoint CI `41314840322` was running at the time of this update.
- Design requires separate NOLOGIN schema owner, least-privilege runtime role, and separately authorized migration identity.
- Requires transaction-local authenticated identity and verified organization context.
- Explicitly treats custom GUC context as defense-in-depth, not a cryptographic boundary against arbitrary SQL under the runtime role.

### Disposable Neon lab

- Child branch: `br-blue-tooth-b4kvuut7`, parent production `br-restless-base-b44cip2h`.
- Proved a NOBYPASSRLS runtime role, NOLOGIN owner role, RLS `USING`/ `WITH CHECK`, FORCE RLS, cross-tenant SELECT/UPDATE/INSERT denial, missing-context fail-closed behavior, and least-privilege access.
- Proved a SECURITY DEFINER session resolver under FORCE RLS for `identity_sessions`, `identities`, and `organization_memberships`, owned by a NOLOGIN/NOBYPASSRLS function role.
- Valid session returns verified memberships; revoked/expired session returns no rows; membership revocation disappears from the next resolver result; runtime role can execute the function but cannot directly read auth tables.
- Post-test production verification confirmed 67 public tables, 0 RLS tables, 0 lab roles, and 0 lab schemas on production. All lab objects remained branch-local.

See:
- `docs/security/TENANT_ISOLATION_ARCHITECTURE_AND_ROLLOUT_2026-11-01.md`
- `docs/security/TENANT_ISOLATION_LAB_RESULTS_2026-11-01.md`
- `docs/security/TENANT_AUTH_BOOTSTRAP_LAB_2026-11-01.md`
- `docs/security/TENANT_CONTEXT_APPLICATION_INTEGRATION_INVENTORY_2026-11-01.md`

## 5. Request transaction adapter prototype — PR #191

[PR #191](https://github.com/vishaltradewinds/rupaykg/pull/191)
- Branch: `shakti/tenant-db-context-adapter-spike-2026-11-01`
- Head: `f6945ea8bd6b343c8e9f72aeb7dd1b80624ba15d`
- Exact-head CI: `41314454023` PASS.
- Adds an AsyncLocalStorage-backed adapter routing direct `pool.query()` and promise-based `pool.connect()` calls through one request client.
- Converts route-level BEGIN/COMMIT/ROLLBACK to nested savepoints.
- Covers SQL error recovery, unclosed savepoints, transaction rollback, concurrent request isolation, and Fastify lifecycle integration.
- **Not wired into `server.ts` and not production code.**
- Before integration: solve auth bootstrap, platform-admin/regulator/worker context, callback-style API coverage, transaction response hooks, pool saturation, and load testing.

PR #190 was closed as superseded by the stronger combined test in PR #191.

## 6. Other tenant integrity PRs

- PR #181 — field-sync authorization re-attestation and credential issuance locking; latest exact-head CI `41310235419` PASS.
- PR #182 — CPCB workspace/status-history composite tenant FK; latest exact-head CI `41283251594` PASS.
- PR #183 — evidence artifact ownership lineage; latest exact-head CI `41289389741` PASS.
- PR #184 — stakeholder application/role organization integrity; exact-head CI `41289620371` PASS.
- PR #185 — duplicate approval-geography proposal; closed as superseded by PR #186.
- PR #186 — approval geography integrity; corrected NULL-scope fixture; exact-head CI `41312776338` PASS.
- These remain proposals pending independent review and production data preflight. None is merged or deployed.

## 7. Hosting

- Render Docker service `rupaykg`: `srv-daki4d7qj5pc73b8qksg`
- Render auto-deploy tracks `main`; observed live commit remains `b5e91241d84a6712ff544d3deec1805702f45efd`.
- Free plan, Singapore region, `/health` check.
- No Render-hosted PostgreSQL instance was found. Neon is the identified database provider.
- No deployment was triggered by this work.

## 8. Next execution order

1. Finish exact-head CI on PR #189 (`41314784890`) and keep all evidence in the repository.
2. Obtain independent review of PRs #181–#184, #186–#189, and #191; do not merge solely because CI passes.
3. Complete role separation on a disposable Neon branch: owner/runtime/migrator/auth-function-owner; prove grants and login behavior; do not change production credentials yet.
4. Integrate the proven auth resolver into `auth.ts` on a feature branch, preserving password login, session issue/revoke, active-organization validation, multi-org selection, and bilateral settlement semantics.
5. Integrate the request transaction adapter only after auth bootstrap is complete; route every HTTP query and worker/CLI query through an explicit scoped identity.
6. Complete all 67 table classifications, data preflight, composite tenant FKs, policy design, multi-party/regulator/worker exceptions, and adversarial tests.
7. Prove backup/restore, connection pool capacity, failover, performance, and rollback on disposable Neon branches.
8. Only then prepare a separately reviewed production role cutover and staged RLS rollout.
9. Keep production certification OFF until independent operational and security evidence passes.

## 9. Non-negotiable safety state

- Production database mutations: none.
- Staging database mutations: none.
- Production RLS: 0/67.
- Production deployment: none.
- Background workers: OFF.
- Production migration workflow: DO NOT USE until environment protection, secrets, and least-privilege migration identity are verified.
- Production certification: OFF / HOLD.
- TRL 9: not established.

**Resume instruction:** continue from this checkpoint and the latest branch heads above. Do not repeat initial repository/Neon discovery unless a new commit or deployment changes the verified baseline.


## 10. Authentication resolver application slice — PR #192

[PR #192](https://github.com/vishaltradewinds/rupaykg/pull/192)
- Branch: `shakti/auth-bootstrap-application-integration-2026-11-01`
- Latest code-validation head: `b31c865d700bface91523d97214398abd582ee32`
- Exact-head CI run `41315975459`: **PASS**. Migration validation, dependency audit, TypeScript typecheck, build, browser smoke, disposable PostgreSQL acceptance, and production container build passed.
- Adds opt-in `RUPAYKG_AUTH_RESOLVER_MODE=security_definer`; default remains `legacy`.
- Security-definer mode calls `auth_private.resolve_session($1)` exactly once and has no direct-table fallback.
- Tests preserve multi-organization explicit selection, bilateral settlement scope, single-organization implicit selection, no-membership identity behavior, invalid/unverified organization rejection, and legacy path compatibility.
- PR remains draft and stacked on PR #189. No production migration or application auth-pool integration has been deployed.

### Extended disposable Neon auth lifecycle proof

- On child branch `br-blue-tooth-b4kvuut7`, proved FORCE RLS for identities, sessions, memberships, and password credentials.
- Proved SECURITY DEFINER functions for login candidate lookup, failed-attempt lockout, reset, session issue/revocation, registration, token-bound account context, and session resolution.
- Tested ten-failure / 15-minute lockout, reset, eight-hour session issue, revocation, atomic registration, and duplicate email rejection.
- Proved two runtime principals: application runtime can execute session resolver only; separate auth runtime can execute auth lifecycle functions but cannot directly read password credentials or assume the function-owner role.
- Production aggregate-only email preflight: zero duplicate case-insensitive email groups. Existing email index is non-unique; unique partial index tested on the disposable branch only.
- Evidence: `docs/security/TENANT_AUTH_BOOTSTRAP_LAB_2026-11-01.md` and `docs/security/AUTH_TABLE_ACCESS_INVENTORY_2026-11-01.md`.

### Remaining auth integration blockers

1. Add a separately configured auth connection pool and keep the ordinary application pool restricted to session resolution and business runtime operations.
2. Wire registration/login/lockout/session issue/logout to the auth runtime functions.
3. Wire `/auth/me` to the token-bound account-context function.
4. Move stakeholder onboarding membership writes and platform-admin dual-control flows behind approved functions or verified RLS policies.
5. Add the production migration only after the runtime and migration roles, exact grants, and rollback strategy are independently reviewed.
6. Do not enable RLS on authentication tables until every direct read/write path has been migrated.

Production database, production credentials, staging database, and Render deployment remain unchanged. Production certification remains OFF / HOLD; TRL 9 is not established.


## 11. Dedicated auth runtime and route registration — PR #192 continuation

- Found a critical integration defect: `apps/src/auth-routes.ts` existed but was not registered by `apps/src/server.ts`; no `registerAuthRoutes` call was found in the repository at this branch head.
- Server now registers the auth route module with separate application and authentication pools.
- `AUTH_DATABASE_URL` is a distinct connection pool (max 3) and must target the same Neon host/port/database as `DATABASE_URL`, but use a different database role.
- Registration uses `auth_private.register_identity`; login uses `find_login_candidate`, `record_login_failure`, `reset_login_failures`, `issue_session`, and `get_self_account_context`; logout uses `revoke_session`; `/auth/me` authenticates through the app resolver then reads self-scoped context through the auth function.
- The application pool is not used for password or session writes. No direct-table fallback is implemented in the auth routes.
- Production config requires `RUPAYKG_AUTH_RESOLVER_MODE=security_definer`, both distinct database URLs, and same target database.
- Production startup preflight rejects superuser/BYPASSRLS runtime roles, checks direct auth-table reads are denied, checks application runtime can execute only the session resolver, checks auth runtime cannot resolve sessions or directly read auth tables, and checks eight SECURITY DEFINER functions are owned by NOLOGIN/NOBYPASSRLS `rupaykg_auth_owner`.
- Readiness endpoint checks both database pools. Render manifest declares the new secret; it is not provisioned.
- No production or staging database changes, secret changes, or deployment.
- Remaining: CI exact-head verification; draft the production migration and role/grant manifest; integrate onboarding mutations and platform-admin governance functions; provision and validate credentials only after reviewed migration and approval.


## 12. Named production runtime roles and database authorization function — 2026-11-01

- Disposable Neon child branch `br-blue-tooth-b4kvuut7` now has exact production role names: `rupaykg_app_runtime`, `rupaykg_auth_runtime`, `rupaykg_app_owner`, and `rupaykg_auth_owner`.
- Both runtime roles were created with LOGIN in the disposable branch, NOBYPASSRLS, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOINHERIT. Owner roles are NOLOGIN/NOBYPASSRLS and have no elevated flags.
- All eight auth SECURITY DEFINER functions were reassigned to `rupaykg_auth_owner`; fixed `search_path = pg_catalog, pg_temp` verified for every function.
- Runtime privilege matrix checked by PostgreSQL catalog functions:
  - app runtime can execute session resolver; cannot execute login candidate lookup; no direct SELECT on auth tables; cannot assume owner.
  - auth runtime cannot execute session resolver; can execute login candidate and self-context functions; no direct SELECT on password credentials; cannot assume owner.
  - both runtime roles have no superuser/BYPASSRLS/CREATEDB/CREATEROLE/REPLICATION privileges.
- FORCE RLS remains enabled on identities, sessions, password credentials and memberships in the disposable branch; exact auth-owner policies were added for the renamed function owner.
- Added `auth_private.has_organization_permission(uuid,uuid,text[])`, SECURITY DEFINER and owned by `rupaykg_auth_owner`; EXECUTE is granted to app runtime only. Catalog verification confirmed auth runtime cannot execute it.
- Application `hasOrganizationPermission` now uses this function in security-definer mode, with no direct-table fallback. Added fail-closed tests.
- Remaining direct membership/auth-table paths: geography/activity authorization helpers, evidence verification, platform-admin routes, and stakeholder onboarding mutations. These need additional scoped functions before production runtime cutover.
- No production or staging objects, roles, grants, secrets, migrations, or deployments changed.


## 13. Scoped authorization function layer — 2026-11-01

- Added SECURITY DEFINER functions owned by `rupaykg_auth_owner`:
  - `has_organization_permission(identity_id, organization_id, permissions)`
  - `organization_has_geography_scope(organization_id, geography_id)`
  - `can_read_geography(identity_id, geography_id)`
  - `can_write_geography(identity_id, organization_id, geography_id)`
  - `can_write_activity(identity_id, activity_id)`
  - `can_verify_evidence(identity_id, evidence_id)`
- The geography helper reproduces the existing recursive parent-scope semantics and preserves the current behavior where an organization with no VERIFIED geography scopes is unrestricted by geography.
- A disposable Neon call initially exposed a search_path defect when calling the old public geography helper from a SECURITY DEFINER function. Replaced that nested call with a schema-qualified, SECURITY DEFINER helper using fully qualified `public.geography` and `public.organization_geography_scopes`; rerun accepted all six function results.
- Verified lab results: verified role permission true; rejected membership denied; geography read/write true under the existing no-scope semantics; unknown activity/evidence denied.
- Catalog verification: all six scoped authorization functions are SECURITY DEFINER, owned by `rupaykg_auth_owner`, executable by app runtime only and not auth runtime.
- Application `hasOrganizationPermission`, geography read/write, activity write and evidence verification helpers now use these functions in security-definer mode with no direct-table fallback.
- Startup gate now requires all fourteen SECURITY DEFINER functions and exact runtime grants.
- Remaining direct auth-table paths are mainly platform-admin governance and stakeholder onboarding create/withdraw, plus route-specific direct membership queries. Those remain release blockers.
- No production or staging database changes, deployments, secrets, or role provisioning.
