# Production Database Reconciliation — 2026-10-25

## AIM and Shakti gate

Identify the exact database used by the live RupayKg service and prove its migration state, privilege boundary, audit-chain integrity, and recoverability before any production mutation or release.

**Decision: PRODUCTION CERTIFICATION HOLD.** This document records read-only evidence only. It is not authorization to merge, deploy, migrate, seed, change roles, modify environment variables, change billing, or alter provider network policy.

## Verified Render service state

Inspection timestamp: 2026-10-25, around 12:26 UTC.

- Workspace: `My Workspace` (`tea-dakh7k142hec73aj2kr0`).
- Service: `rupaykg` (`srv-daki4d7qj5pc73b8qksg`), URL `https://rupaykg.onrender.com`.
- Service is not suspended; tracks `main`; automatic deployment on commits is enabled.
- Last known successful deployment: `dep-dbbjqic9v7es73ffofmg`, commit `0ddcf6087620880e21ea60f954c9f05d6b759469`, completed 2026-10-20 10:08:03 UTC.
- Latest observed startup log: `Database migrations are current (91 files).` at 2026-10-25 09:00:18 UTC.
- Repeated live `GET /health` requests returned HTTP 200 on 2026-10-25 around 12:22–12:26 UTC. The route performs `SELECT 1`; this proves the application can reach some database, not which provider project/branch it reaches.
- Service IP allowlist is `0.0.0.0/0` (publicly reachable). This needs a separate threat-model and ingress review; do not change it during database identity discovery.

## Named Render Postgres state

- Database: `rupaykg-db` (`dpg-dakhdv95efls73e1974g-a`), database/user name `rupaykg`.
- Provider reports status `suspended`, suspender `billing`, expiry timestamp 2026-10-15 09:59:25 UTC.
- Database IP allowlist is `0.0.0.0/0`.
- A read-only connection attempt failed with `FATAL: SSL/TLS required` and unexpected EOF; no SQL query ran and no data changed.

**Conclusion:** the named Render Postgres instance is not currently a usable, verified target. Since the web service remains healthy and its startup logs report 91 migrations, the service appears to be using another reachable database endpoint or the provider mapping is stale. This does not prove which endpoint it uses. Do not resume the suspended database, change billing, or repoint the service based on inference.

## Neon candidates — explicitly unconfirmed

Read-only inspection of candidate branches returned:

| Candidate | Migration ledger | Recent migration | Data observations |
|---|---:|---|---|
| Project `rupaykg-production-fresh`, main `br-restless-base-b44cip2h` | 91 rows | `20261021_evidence_artifact_vault.sql` | Zero rows observed in organizations, identities, activities, measurements, evidence, evidence_artifact_versions, and audit_events |
| Same project, staging `br-spring-hill-b4544vz5` | 95 rows | `20261025_ai_evidence_intake_jobs.sql` | Same checked business/evidence/audit tables had zero rows |
| Separate project `rupaykg`, main `br-soft-hill-b4817svc` | 0 rows | None | Not a verified production target |

The two branches in the first project have no ledger entries for migration `088` or the new CPCB/BM migrations `20261029`–`20261035`; corresponding anchor/CPCB evidence objects are absent. That is consistent with these branches being behind the current PR's migration inventory. It is not evidence of production data loss. The inspected role `rupaykg` on the fresh-main candidate has `CREATEDB`, `CREATEROLE`, `REPLICATION`, and `BYPASSRLS` attributes; do not treat it as an approved least-privilege runtime role.

No automatic snapshot schedule or snapshot was listed for the `rupaykg-production-fresh` project branches inspected. A separate manual snapshot exists in the separate `rupaykg` project, but it does not prove a backup of the live database.

**Conclusion:** none of these candidates is proven to be the live Render service's configured database. Matching migration counts, database names, or healthy HTTP checks are insufficient to establish provider project and branch identity.

## Engineering branch and CI

- PR #46 remains open, draft, unmerged, and not deployed.
- Last code-bearing head reviewed: `2833273e59436d8b5e3600b8e336c15f44218432`.
- Exact-head CI run #40191612039 completed successfully for that code-bearing head at 2026-10-25 12:07:33 UTC. It passed dependency installation/audit, migration inventory and execution, ledger verification, typecheck/build, browser smoke, isolated PostgreSQL acceptance/concurrency tests, read-only audit-chain verification, disposable backup/restore verification, and production container build.
- This document is a new documentation-only commit after that CI run; its new head must receive its own CI result before the PR is eligible for review. All CI/disposable-database results validate only their tested commit and do not establish live production readiness.
- PR #46 is a combined change set (132 commits, 87 files at the time of inspection), including inherited production configuration and MRV/CPCB changes. It is not an isolated migration-lock patch.
- The deployed `main` source still contains the older hostname-based TLS exception; the PR branch removes it and requires TLS plus a PEM CA certificate. Do not deploy this change until provider-specific TLS requirements are verified for the actual live endpoint.

## Next gates — in order

1. An authorized operator reads the Render service's environment configuration locally. Do not copy secrets, full URLs, tokens, or certificate contents into chat or PR comments.
2. Record only sanitized metadata for both `DATABASE_URL` and `MIGRATION_DATABASE_URL`: provider/project, branch, hostname, database name, role name, and TLS mode. Confirm both URLs target the same exact endpoint/database but use distinct roles. The available Render connector does not provide a read-only listing of environment-variable names/values.
3. Using the exact confirmed target, run the repository's read-only migration-state verifier and audit-chain verifier. Preserve sanitized outputs and exact commit/timestamp.
4. Review runtime and migration role attributes, ownership, table/sequence/function grants, schema privileges, RLS, audit trigger ownership, and network exposure. Verify the runtime role is a non-owner and least-privilege.
5. Establish backup provenance and perform a restore rehearsal in an isolated target. Record recovery-point and recovery-time evidence.
6. Run migrations only after complete inventory reconciliation, backup/restore proof, impact review, approved change window, and rollback plan.
7. Complete real pilot and authorized Guardian → Hedera consensus → Mirror Node persisted-provenance acceptance in an approved environment.
8. Only after all gates pass, independently review and consider merge/deployment.

## Change record

This batch performed read-only Render metadata/log/event/metrics checks and read-only SQL against unconfirmed Neon candidates. It added a PR discussion comment with the evidence. No production data, schema, roles, environment variables, billing, network allowlists, snapshots, or deployments were changed.
