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


## 12. Full production table classification — 2026-11-01 15:30 UTC

- Read-only Neon catalog inspection on authoritative production branch `br-restless-base-b44cip2h` / database `rupaykg`.
- Added `docs/security/TENANT_67_TABLE_ACCESS_CLASSIFICATION_2026-11-01.md`: all 67 public base tables classified with candidate attribution columns, FK edges, and proposed access family.
- Classes distinguish organization-owned, inherited child, bilateral/multi-party, identity/auth, global reference, append-only, device/worker and platform-control data.
- Added reference to the matrix in `TENANT_ISOLATION_ARCHITECTURE_AND_ROLLOUT_2026-11-01.md`.
- Classification coverage: 67/67. Executable policy approval: 0/67. Production RLS remains 0 enabled / 0 forced. This is a design register, not a policy or production migration.
- Commit: `1e431bf6cff3b2f9d1d89164447a276f37713ab5`; architecture link commit: `35ac25d6efbe8f9be340593909a9817132ee9b02`.

## 13. Auth resolver production-path correction — 2026-11-01 15:31 UTC

- Review found a critical gap: although the app runtime is designed to have no direct access to auth tables, the main `authenticate()` function in the PR branch had to be verified to use the existing resolver-mode abstraction on every production route.
- Restored a single explicit branch: `security_definer` calls `authenticateWithSecurityDefiner()` and `auth_private.resolve_session($1)` once; resolver errors propagate and do not fall back to direct auth-table queries. Legacy mode remains explicit for non-production/test compatibility.
- Existing `apps/src/auth.test.ts` already contains adversarial coverage for multi-org selection, missing/revoked sessions, malformed/unverified orgs, mixed identity rows, no-fallback behavior, and resolver-mode configuration.
- A transient implementation attempt was rejected by CI (typecheck failed because it bypassed the established three-argument resolver-mode API); corrected implementation is at `a0c2fe78ff256ea8233c5b71b71bfc37447a3956`, exact-head CI `41321594110` PASS.
- Runtime grant manifest corrected: PUBLIC execution denied on all 18 functions; app runtime receives resolver plus ten scoped authorization functions. Latest docs commit `15c0ee4ff2b4af07950a99bc19436e9966cbc089`; exact-head CI pending.
- Disposable Neon branch `br-blue-tooth-b4kvuut7` contains all 18 tested `auth_private` SECURITY DEFINER functions, owned by NOLOGIN/NOBYPASSRLS `rupaykg_auth_owner`; app and auth runtime roles have no direct auth-table privileges and no PUBLIC schema CREATE. Auth owner has SELECT on 13 required tables, INSERT on identities/password credentials/sessions, UPDATE on password credentials/sessions, and no DELETE.
- Critical remaining blocker: onboarding application create/withdraw handlers still perform direct writes through app pool to organization, role, membership, geography-scope and evidence tables. The app runtime design deliberately lacks membership writes; these endpoints will fail under the target least-privilege role until moved to identity-bound database functions. Platform-admin/worker paths also require dedicated reviewed access functions.
- No production DB mutations, credentials, role provisioning, RLS, migrations or deployment. Production remains HOLD; certification OFF; TRL 9 not established.
