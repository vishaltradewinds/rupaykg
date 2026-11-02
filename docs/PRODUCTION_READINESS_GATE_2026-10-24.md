> **Latest evidence refresh — 2026-10-25 11:38 UTC (CI + read-only Render audit)**
>
> - PR #46 head `d675edbada6460b9626f09b9ca1af6f48e5c307a` passed exact-head CI run #40188872007: https://github.com/vishaltradewinds/rupaykg/actions/runs/40188872007. All workflow steps passed, including migration inventory/ledger verification, typecheck/build, browser smoke, full tests with disposable PostgreSQL migration-concurrency coverage, read-only audit-chain verification, disposable backup/restore verification, and production container build. This is engineering/CI evidence only.
> - PR #46 remains open, draft, unmerged, and targets `main`. It contains the migration-lock changes and the inherited PR #44 production-configuration changes; it is not an isolated lock-only patch.
> - Read-only Render metadata confirms web service `rupaykg` tracks `main`, auto-deploy is enabled, and latest live deploy is still `0ddcf6087620880e21ea60f954c9f05d6b759469` from 2026-10-20 10:08 UTC. The tested PR head is not deployed.
> - Render Postgres `rupaykg-db` (`dpg-dakhdv95efls73e1974g-a`) remains suspended for billing and has a provider expiry timestamp of 2026-10-15. The service and database share a Render environment ID, but this does not prove the running service's actual connection URL points to that database. No resume, billing, or database operation was attempted.
> - Read-only application logs for 2026-10-24 through 2026-10-25 show repeated `GET /health` responses with HTTP 200; the error/fatal-level log query returned zero entries. This is not a DB identity check or proof of end-to-end MRV readiness.
> - No merge, production deployment, production SQL write/migration, environment-variable change, TLS relaxation, billing change, or database reactivation was performed.
> - **Decision: PRODUCTION CERTIFICATION HOLD.** Remaining blockers include authoritative runtime/migration DB mapping and role verification, confirmed target schema/migration ledger/audit chain, production-grade recovery evidence, least-privilege runtime access, and real pilot/external Guardian-Hedera-Mirror Node acceptance.
>
> **Live status refresh — 2026-10-25 11:12 UTC (deployment and production-contract audit)**
>
> - Exact engineering head `ad31dfa4d877552ff91f9fa5e5b0614b4e7fcad7` passed CI run #2087: https://github.com/vishaltradewinds/rupaykg/actions/runs/40186716628. This covers the branch and disposable acceptance resources, not live production.
> - Render service `rupaykg` is active, tracks `main`, and has auto-deploy enabled. Latest live deployment remains `0ddcf6087620880e21ea60f954c9f05d6b759469` (2026-10-20 10:08 UTC); PR #44 is not deployed.
> - Read-only deployment logs show a failed start attempt at 10:04 UTC on 2026-10-20 with `PRODUCTION_CONFIG_INVALID: DATABASE_CA_CERT must contain a PEM certificate unless DATABASE_URL uses sslmode=require`, followed by a successful deployment at 10:08 UTC. This is a historical configuration failure, not proof of current failure; do not weaken TLS verification to silence it.
> - Current `main` production contract validates `DATABASE_URL` but does not require a distinct migration identity. PR #44 requires `MIGRATION_DATABASE_URL`, checks it targets the same host/port/database with a distinct role, and removes the migration credential from the API process environment. This is an engineering improvement but cannot be activated without confirmed runtime values and migration-target verification.
> - Render metadata lists `rupaykg-db` (`dpg-dakhdv95efls73e1974g-a`) as suspended for billing, expiry timestamp 2026-10-15, with allowlist `0.0.0.0/0`. Its mapping to the live service remains unconfirmed. Do not reactivate it or alter its network policy without mapping, backup/recovery proof, and authorization.
> - `GET /health` returned HTTP 200 on 2026-10-25. This establishes route responsiveness only; it is not an end-to-end MRV, schema, audit-chain, or recovery certificate.
> - No deployment, merge, production migration, environment change, database write, database reactivation, or TLS relaxation was performed.
> - **Gate: PRODUCTION CERTIFICATION HOLD.** Next prerequisite is authoritative, redacted confirmation of runtime and migration database provider/project/branch, database host/name, and roles; then verify the confirmed target's ledger/schema, audit chain, permissions, and recovery path.
>
# RupayKg Production Readiness Gate - 2026-10-24

> **Live status refresh — 2026-10-25 07:50 UTC**
>
> - Current PR #44 head: `7f9aa7db951d88bea954e7d16eafc8f8c82f19c2`.
> - Exact-head GitHub Actions CI run #2027: **SUCCESS** — https://github.com/vishaltradewinds/rupaykg/actions/runs/40173875619 (completed 2026-10-25 07:45:50 UTC). This run includes the latest documentation-only refresh and the exact branch head.
> - The prior code-bearing head `ca924589bada2f402ab4e81ffe3b41a44dd0c8fc` also passed CI run #2026. No application-code changes were made after that code commit; the current head adds readiness evidence documentation.
> - CI validates the tested branch commit only. It does not prove the live service's database mapping, production backup/restore, live Guardian/Hedera acceptance, or production certification.
> - Render metadata rechecked 2026-10-25: web service `rupaykg` is not suspended and tracks `main` with auto-deploy enabled; Render Postgres `rupaykg-db` remains suspended for billing. The latest listed live deploy remains `0ddcf6087620880e21ea60f954c9f05d6b759469` from 2026-10-20. Do not assume the suspended Render Postgres is the active database, and do not infer the live target from database names alone.
> - Read-only Render app logs show successful `GET /health` requests returning HTTP 200 on 2026-10-24. They do not expose a conclusive database target or prove pilot readiness.
> - Guardian acceptance seed requires an explicit non-empty `GUARDIAN_MRV_POLICY_ID` before opening its database pool; the plausible-looking fallback was removed and regression coverage added.
> - PR #44 remains **open, draft, and unmerged**. Production certification remains **HOLD**. No production migration, data mutation, provider setting change, billing change, deployment, or live Guardian/Hedera submission was performed.
>
## AIM

Make RupayKg operational, secure, auditable, recoverable, and compliant before any production release. Production deployment remains the last gate.

## Shakti controls

- Do not deploy, migrate, modify provider settings, change billing, or certify production without explicit release approval.
- Separate CI evidence from production evidence.
- Use read-only provider checks for discovery.
- Do not infer the active database solely from a matching name. The live service-to-database environment mapping still needs authoritative confirmation.
- Do not treat a successful health endpoint as proof of pilot readiness, real user onboarding, or external MRV acceptance.

## Evidence collected

### Application endpoint

At 2026-10-24 12:41 UTC, a non-mutating GET to https://rupaykg.onrender.com/health returned HTTP 200 with:

- status: READY
- database: AVAILABLE
- syntheticData: false

The root page also returned HTTP 200. These observations prove endpoint reachability at that time only; they do not prove complete workflow acceptance.

### Render provider metadata

- Web service rupaykg is configured for repository vishaltradewinds/rupaykg, branch main, with auto-deploy enabled.
- The latest listed live deploy uses commit 0ddcf6087620880e21ea60f954c9f05d6b759469 (2026-10-19).
- Render database rupaykg-db (dpg-dakhdv95efls73e1974g-a) is suspended by billing; provider metadata lists an expiry of 2026-10-15.
- Its IP allowlist is 0.0.0.0/0.
- No SQL was attempted against the suspended Render database. No billing or provider settings were changed.

Because the public health endpoint reported its database as available while this Render database is suspended, the Render database should not be assumed to be the active database. The service's actual database target must be confirmed from authoritative deployment configuration without exposing credentials.

### Neon provider metadata and read-only schema checks

The strongest current candidate for the active database is Neon project rupaykg-production-fresh, project ID steep-mud-79906940, branch main (br-restless-base-b44cip2h), database rupaykg, PostgreSQL 18.6. This is a high-confidence inference from recent compute activity and the successful live health endpoint, not yet a definitive environment-variable mapping.

Read-only SQL against that candidate reported:

- Latest migration marker: 20261021; 91 migration records. The repository has 97 SQL migrations; six are not applied on this candidate: 088_global_audit_chain_enforcement.sql and dated migrations 20261022 through 20261026.
- platform_audit_chain_head exists with one row.
- platform_audit_chain_anchor does not exist.
- No non-internal triggers are attached to public.audit_events.
- Counts at inspection time: identities 0, organizations 0, activities 0, evidence 0, audit events 0.
- The migration-088 global audit chain is therefore not yet present on this candidate database. The five unapplied dated migrations add CPCB evidence links, BM WA03.001 baseline records, BM WA03.001 reconciliations, baseline attestations, and BM-T-011 assessments; routes depending on these schema objects may fail or be unavailable until migration state is reconciled.
- Neon project settings show public connections are allowed (block_public_connections=false) and no IP allowlist entries are configured.
- Neon project history retention is 21,600 seconds (6 hours); the provider snapshot listing returned no snapshots.

These are point-in-time observations. Confirm the service-to-project mapping before treating this candidate as definitively production.

## Release blockers

1. Database identity: conclusively map the running service's configured database target to the provider project/branch/database without disclosing credentials.
2. Recovery: six-hour history retention and no listed snapshots are insufficient evidence of an approved recovery plan. Define and test backup retention, restore procedures, RPO/RTO, access control, and restore verification.
3. Audit-chain cutover: migration 088 is not present on the candidate database. It must not be applied until the target is conclusively identified, a backup/restore is proven, a maintenance/change window is approved, and the lock-ordering migration passes CI.
4. Network exposure: public database connections are allowed with no IP allowlist. Determine feasible application egress restrictions and apply a least-privilege network policy only after connectivity is mapped and an approved change plan exists.
5. Operational onboarding: the candidate database currently has zero identities, organizations, activities, evidence, and audit events. The platform's live endpoint is reachable, but a real pilot is not evidenced by these counts.
6. External trust chain: Guardian, Hedera HCS, and Mirror Node end-to-end acceptance remains unproven. No successful external production acceptance is claimed.
7. Release governance: PR #44 remains draft/unmerged. Production certification stays HOLD.

## Engineering evidence

- Latest fully successful CI: run #2010 on commit bef16a30a2ffffe13297339c7c050ff01dc872b3. Migration validation/application, migration inventory verifier, typecheck, build, browser smoke, disposable PostgreSQL acceptance, read-only audit-chain verification, backup/restore verification, and production container build all passed.
- The read-only migration-state verifier compares all repository migration filenames/versions with schema_migrations and reports missing, mismatched, and unexpected entries. It uses a TLS-verified connection by default and a repeatable-read read-only transaction; it never applies migrations.
- Migration 088 serializes global audit appends after quiescing writers, adds an immutable cutover anchor, blocks audit-event UPDATE/DELETE/TRUNCATE, and blocks deletion/truncation of the chain head and truncation of the anchor. CI acceptance tests passed, including the cascading TRUNCATE rejection test.
- Local validation: 97 migrations / 79 schema objects; workspace typecheck passed; API 105 passed / 0 failed / 12 skipped; carbon 30 passed; compliance 2 passed; domain 29 passed; ESG 1 passed; intelligence 2 passed. The 12 local skips require optional integration services; the PostgreSQL acceptance suite runs in CI.
- CI backup/restore rehearsal applies only to disposable CI PostgreSQL databases. It is not production backup/recovery evidence.


### Audit-writer transaction-boundary review

- Application audit writers found in CPCB SWM workspace creation/update/evidence linking and field-device enrollment/verification append audit events through the same PostgreSQL client and transaction as the corresponding business mutation.
- Platform administration routes use a shared transaction helper that commits business state and the audit insert together; errors roll back both.
- The legacy field-sync conflict audit is database-triggered, so its audit insert participates in the originating transaction. Migration 088 adds one database-owned chain for every audit_events insert.
- This code review does not prove runtime-role isolation or production execution. PostgreSQL acceptance tests for global ordering, rollback atomicity, immutable anchor/head and cascading truncate rejection passed in CI.

## Decision

Engineering validation: PASS for the tested branch/CI evidence.

Production operational readiness: HOLD. Production certification: HOLD.

No production database migration, data mutation, provider setting change, billing change, deployment, or external Guardian/Hedera/Mirror Node acceptance was performed during this review.
## Additional database privilege finding - 2026-10-24

A further read-only query against the candidate Neon database found that role rupaykg is the owner of audit_events, platform_audit_chain_head, and schema_migrations. The role can log in and has CREATEROLE, CREATEDB, and REPLICATION attributes. It also has UPDATE, DELETE, and TRUNCATE grants on the audit-event and chain-head tables.

This is a material least-privilege concern if this is the application's runtime role. The service-to-database and runtime-role mapping has not yet been proven, so do not label this as a confirmed live-app credential finding. The owner can change table structure and triggers; simply revoking DML grants is not a sufficient boundary while the same role remains owner.

### Required remediation design (not yet applied)

1. Prove the actual runtime database role and target using provider configuration or a safe non-secret diagnostic.
2. Introduce a dedicated non-owner application runtime role with only the table/sequence/function permissions needed by tested request paths.
3. Keep schema ownership and migration privileges in a separate controlled migration role; do not give runtime role CREATEROLE, CREATEDB, or REPLICATION.
4. Make append-only audit writes database-enforced under a dedicated privilege boundary; verify that runtime cannot update/delete/truncate events or alter/disable enforcement triggers.
5. Exercise all required API workflows against an isolated database under the proposed runtime role, including audit writes, and test denied destructive operations.
6. Only after a reviewed access matrix, backup/restore proof, service identity mapping, and approved change window, plan a production role transition. Do not change existing role grants or credentials speculatively.

No production role, grant, owner, trigger, schema, data, provider setting, or deployment was changed. Branch migration/test code was updated and validated in CI.
## Migration/runtime credential separation - engineering gate

The production configuration now requires two distinct PostgreSQL connection URLs:

- `DATABASE_URL`: application runtime identity, which must be a non-owner and least-privilege role.
- `MIGRATION_DATABASE_URL`: migration identity, distinct from the runtime role, for controlled schema changes.

The configuration fails closed if the migration URL is missing, uses the same database role, or targets a different host/database name. In production, the migration runner uses `MIGRATION_DATABASE_URL`; the application server continues to use `DATABASE_URL`. TLS mode is validated consistently for both connections. Non-production migration runs retain the existing `DATABASE_URL` fallback.

Local validation after this change: migration inventory validation passed (97 migrations / 79 schema objects); workspace typecheck passed; API tests 108 passed, 0 failed, 12 skipped because optional database/provider integration services were not configured locally. CI must still validate this commit.

**Deployment blocker:** Render production environment must be configured with the correct two role-specific URLs before this code is released. Do not merge while auto-deploy on `main` is enabled unless the migration and runtime credentials have been securely provisioned and verified. No environment variables or database roles were changed by this engineering batch.
### Audit-chain trigger privilege boundary - engineering follow-up

Added migration `20261027_runtime_role_audit_chain_security_definer.sql`. The audit-chain insert/update-head and immutable-row guard functions now run as `SECURITY DEFINER` with a pinned `pg_catalog, public` search path; `CREATE` on `public` is revoked from `PUBLIC` to prevent object shadowing in that search path. This is required for an application role that can append audit events but cannot directly update the global chain head or modify the immutable anchor.

Local validation: migration inventory validates at 98 migrations / 79 schema objects; workspace typecheck passed; API tests 109 passed, 0 failed, 12 skipped. These local tests include static checks for the new privilege boundary. PostgreSQL-backed tests must run in CI; local integration tests requiring isolated databases were skipped. This migration has not been applied to production.
The disposable-PostgreSQL integration suite now includes a least-privilege runtime-role acceptance test. It creates a temporary non-login role, grants ordinary table DML, restricts audit-event writes to append-only, grants read-only access to chain head/anchor, and verifies that the role can append an audit event while direct UPDATE/DELETE/TRUNCATE on the audit ledger, direct chain-head/anchor updates, and schema CREATE are denied. It also verifies that the SECURITY DEFINER trigger advances the chain head for the runtime insert. This test is gated to the disposable PostgreSQL integration environment and was skipped in local runs without that environment; CI is the authoritative execution gate.


## Reconciliation addendum — 2026-10-25 08:00 UTC

This addendum supersedes any earlier wording in this document that treated a Neon project as the "strongest current candidate" based on circumstantial signals. **Neither Neon project is currently verified as the live Render service's configured database target.** Matching database names, a matching migration count, compute activity, or a successful public health endpoint are not sufficient identity evidence.

### Current safe decision
- Render-managed PostgreSQL `rupaykg-db` remains reported as suspended for billing. No supported recovery/resume action is available through the current connector; the account owner must use the provider's supported billing/recovery path.
- Neon candidate `rupaykg-production-fresh` (`steep-mud-79906940`, branch `br-restless-base-b44cip2h`) has a 91-row migration ledger through `20261021`, but the targeted expected-table checks found the BM WA03.001/BM-T-011/CPCB objects absent. It has no listed snapshots and no configured branch snapshot schedule.
- Neon candidate `rupaykg` (`still-violet-61832250`, branch `br-soft-hill-b4817svc`) has zero migration-ledger rows and the same targeted expected-table gaps. A manual snapshot named `rupaykg-schema-baseline-2026-10-17` exists on that project; this is not proof it is production or a verified recovery point.
- Do not restore, migrate, seed, or repoint either candidate until the live service-to-database mapping is verified using non-secret provider/project/branch/database/runtime-role/migration-role metadata and an approved backup/restore plan.
- The latest reported successful CI run #2028 validates its tested commit only. It does not establish live database identity, recoverability, pilot acceptance, or Guardian/Hedera acceptance. The PR remains draft/unmerged; production remains HOLD.

### Documentation reconciliation note
Earlier sections contain migration-count statements from different inspection times (including 97 and 98 repository migrations and a 91-row candidate ledger). Do not treat those counts as interchangeable. Before any production migration, rerun the repository migration inventory against the exact current PR head and compare the complete filename/version inventory with the confirmed target's ledger in read-only mode. Record the exact commit SHA and timestamp with the result.

### Next gates
1. Owner resolves Render billing/suspension through the supported account process and confirms whether the existing database is recoverable.
2. An authorized operator confirms the actual service database mapping without exposing secrets.
3. Verify target schema, grants, migration inventory, audit chain, and backup/restore on the confirmed target.
4. Complete isolated PostgreSQL acceptance and security tests, then obtain independent review.
5. Complete authorized Guardian issuer/policy validation and live Guardian → Hedera consensus → persisted provenance → Mirror Node acceptance in an approved environment.
6. Only after evidence and approvals are complete, consider merge and deployment.

No production SQL writes, provider-setting changes, billing changes, database restore, external submission, merge, or deployment were performed for this addendum.
