# Production Database Reconciliation — 2026-10-25

## AIM and Shakti gate

Identify the exact database used by the live RupayKg service and prove its migration state, privilege boundary, audit-chain integrity, and recoverability before any production mutation or release.

**Decision: PRODUCTION CERTIFICATION HOLD.** This document records read-only evidence only. It is not authorization to merge, deploy, migrate, seed, change roles, modify environment variables, change billing, or alter provider network policy.

## Verified Render service state

Inspection timestamps: 2026-10-25, around 12:26 UTC and 13:14 UTC.

- Workspace: `My Workspace` (`tea-dakh7k142hec73aj2kr0`).
- Service: `rupaykg` (`srv-daki4d7qj5pc73b8qksg`), URL `https://rupaykg.onrender.com`.
- Service is not suspended; tracks `main`; automatic deployment on commits is enabled.
- Last known successful deployment: `dep-dbbjqic9v7es73ffofmg`, commit `0ddcf6087620880e21ea60f954c9f05d6b759469`, completed 2026-10-20 10:08:03 UTC.
- Latest startup log captured from the October 20 deployment: `Database migrations are current (91 files).` at 2026-10-20 10:07:46 UTC. The same deployment emitted PostgreSQL SSL-mode security warnings.
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
- Last code-bearing head reviewed: `3051671d11b026d30219c209c9fce5af4756f18d`.
- Exact-head CI run #40196038352 completed successfully for that code-bearing head at 2026-10-25 13:07:46 UTC: https://github.com/vishaltradewinds/rupaykg/actions/runs/40196038352. It passed dependency audit, migration inventory/execution and ledger verification, typecheck/build, browser smoke, isolated PostgreSQL acceptance/concurrency tests, read-only audit-chain verification, disposable backup/restore rehearsal, and production container build. It passed dependency installation/audit, migration inventory and execution, ledger verification, typecheck/build, browser smoke, isolated PostgreSQL acceptance/concurrency tests, read-only audit-chain verification, disposable backup/restore verification, and production container build.
- This document is a new documentation-only commit after that CI run; its new head must receive its own CI result before the PR is eligible for review. All CI/disposable-database results validate only their tested commit and do not establish live production readiness.
- PR #46 is a combined change set (153 commits, 90 files at the time of this update), including inherited production configuration and MRV/CPCB changes. It is not an isolated migration-lock patch.
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


## Confirmed workspace follow-up — 2026-10-25 13:14 UTC

The user explicitly confirmed **My Workspace**. Render's workspace list independently returned `My Workspace` (`tea-dakh7k142hec73aj2kr0`), and all subsequent provider reads were scoped to that workspace.

Fresh read-only checks confirm:

- Service `rupaykg` remains not suspended, tracks `main`, and has auto-deploy enabled.
- Latest successful/live deploy remains `dep-dbbjqic9v7es73ffofmg` on commit `0ddcf6087620880e21ea60f954c9f05d6b759469`, completed 2026-10-20 10:08:03 UTC.
- The named `rupaykg-db` instance remains `suspended`, with `billing` listed as its suspender and an expiry timestamp of 2026-10-15 09:59:25 UTC.
- Live logs show repeated `GET /health` requests receiving HTTP 200 through 2026-10-25 13:14 UTC. The current deployed source's `/health` route executes `SELECT 1` and returns 200 only if that query succeeds. This strongly indicates the service is reaching some database, but it does not identify the endpoint or prove application workflows are healthy.
- A new read-only SQL attempt against the named Render database failed before the query ran. The connector reported `FATAL: SSL/TLS required (SQLSTATE 28000)` plus unexpected EOF. No SQL or data mutation occurred. Because the provider also reports the instance suspended, the connection failure is not sufficient to establish whether TLS configuration, suspension, or both are responsible.
- Current Render metadata still lists `0.0.0.0/0` for both service and database IP allowlists. This is a verified public exposure posture requiring a separately planned network review.
- The Render connector's service metadata does not expose environment-variable values or even a read-only list of configured variable names. No secret values were requested or changed.

### Current conclusion

**The authoritative database endpoint remains unidentified.** The named Render database is suspended, and none of the inspected Neon candidates is proven to be the live service target. The next hard gate is sanitized operator-side inspection of the Render service's `DATABASE_URL` and `MIGRATION_DATABASE_URL` metadata (provider/project, branch, hostname, database name, role name, TLS mode only). Do not paste passwords, full connection strings, tokens, or certificate contents into chat. Once the endpoint is confirmed, the migration ledger, roles/grants, audit chain, and backup/restore evidence can be checked against the correct database.

No database, environment, billing, network, role, migration, or deployment changes were made during this follow-up. This documentation change itself requires a fresh exact-head CI run before the PR can be considered review-ready.


## Follow-up engineering integrity batch — 2026-10-25 13:42 UTC

### Strict evidence-hash gates

A wider source audit found additional paths that accepted any non-null content URI or hash instead of requiring a valid SHA-256 digest. The engineering branch now requires a lowercase 64-hex-character SHA-256 hash for evidence used by:

- BM-T-011 annual assessment submission and independent review.
- Statutory determinations that bind evidence to an approved verification.
- Carbon value calculations and EPR-credit eligibility.
- ESG metric recording.
- Earlier BM WA03.001 baseline submission, independent decision, signed attestation, reconciliation, and Guardian MRV gates.

Regression tests cover the newly tightened BM-T-011, statutory, value/EPR, and ESG metric gates. The runtime acceptance fixture was updated to use a real SHA-256 digest rather than the nonconforming placeholder `sha256:<uuid>`; strict production validation was not weakened to preserve a test fixture.

### Audit-chain timestamp integrity

Code review found that migration 088's audit-chain trigger preserved a caller-supplied `created_at` value. The read-only audit verifier uses the cutover timestamp to flag unlinked post-anchor events, so accepting backdated timestamps could weaken that anomaly check if an event were written outside the normal trigger path. Added migration `20261036_audit_chain_server_timestamp.sql` to make the trigger overwrite caller-supplied timestamps with `clock_timestamp()` before calculating the canonical SHA-256 event hash. The replacement function retains `SECURITY DEFINER` and pinned `search_path = pg_catalog, public`. A regression assertion checks timestamp overwrite ordering before hashing.

### Exact-head engineering validation

- Code-bearing head: `10883c529ee0ce41cf238ef1bc582b778cf78825`.
- Exact-head CI run #40198696303 completed **SUCCESS** at 2026-10-25 13:42:27 UTC: https://github.com/vishaltradewinds/rupaykg/actions/runs/40198696303
- Passed dependency audit, migration validation and execution, full ledger comparison, typecheck/build, browser smoke, disposable PostgreSQL acceptance/concurrency, read-only audit-chain verification, backup/restore rehearsal, and production container build.
- This validates the tested engineering branch only. It does not identify the live production database or certify production data.

### Production remains blocked

The confirmed workspace is `My Workspace` (`tea-dakh7k142hec73aj2kr0`). Read-only Render metadata still shows the live service tracks `main` and the named `rupaykg-db` instance is suspended by billing. The live service IP allowlist and named database IP allowlist both remain `0.0.0.0/0`. The Render connector does not expose a read-only list of configured environment-variable names or values; direct SQL against the suspended named database fails before executing SQL with an SSL/TLS-required error and unexpected EOF.

**Hard gate:** an authorized operator must inspect the Render service configuration locally and provide only sanitized metadata for `DATABASE_URL` and `MIGRATION_DATABASE_URL`: provider/project, branch, hostname, database name, role name, and TLS mode. Do not share passwords, full URLs, tokens, or certificate contents. After the authoritative endpoint is identified, rerun migration-state, privilege, audit-chain, and backup/recovery verification against that exact target. Do not resume the suspended database, repoint the service, change billing or network rules, merge, or deploy by inference.

No production resources were changed during this engineering batch.
