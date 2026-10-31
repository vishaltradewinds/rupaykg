# 2026-10-31 — RupayKg runtime and database authority audit

## Executive result

**The application is live, but production certification remains on HOLD.** This checkpoint records verified runtime and database facts. It does not change Render, Neon production data, credentials, roles, or deployment settings.

## Simple system map

- **Render** runs the RupayKg application.
- **Neon** stores RupayKg PostgreSQL data.
- The intended production arrangement is one Render application connected to one authoritative Neon production branch, with staging isolated.

## Verified live application

- Render service: `rupaykg`
- Service ID: `srv-daki4d7qj5pc73b8qksg`
- Workspace: `My Workspace`
- Repository: `vishaltradewinds/rupaykg`
- Deploy branch: `main`
- Public URL: `https://rupaykg.onrender.com`
- Runtime: Docker, Singapore region, Free plan, one instance
- Health path: `/health`
- Latest inspected deployment: `dep-dbj1r07avr4c73bjc2c0`
- Deployed commit: `b5e91241d84a6712ff544d3deec1805702f45efd`
- Deployment completed successfully on 2026-10-31.
- Render logs showed repeated HTTP 200 health checks.
- The health route in `apps/src/server.ts` checks PostgreSQL with `select 1`; therefore HTTP 200 is evidence of application and database reachability, not proof of the identity of the connected database.

## Verified Neon production database

- Neon project: `rupaykg-production-fresh`
- Project ID: `steep-mud-79906940`
- Primary/default branch: `main`
- Branch ID: `br-restless-base-b44cip2h`
- Database: `rupaykg`
- Read-only SQL identified database `rupaykg`, server PostgreSQL 18.6, login role `rupaykg`, and 67 public base tables.
- A separate staging branch exists: `rupaykg-gov-inbox-staging-20261020` (`br-spring-hill-b4544vz5`).
- Additional rehearsal branches exist. They are not production and must not be treated as authoritative.

## Critical migration discrepancy — confirmed

- Current `main` repository tree contains **91** migration SQL files.
- Production `schema_migrations` contains **92** rows.
- The extra production ledger entry is version `096`, filename `096_verification_authorization_provenance.sql`.
- That migration file is **not present** in the current `main` repository tree.
- Current migration files include 001–087 (with historical gaps) and four date-versioned migrations 20261018–20261021.
- The application migration runner (`apps/src/migrate.ts`) iterates repository files and skips versions already in the ledger, but does not currently reconcile/report ledger entries whose migration files are absent.
- Consequently, its “91 files” message can coexist with 92 ledger rows and does not prove exact repository/database migration parity.

**Required response:** preserve the production ledger and schema. Recover the exact historical source and provenance for migration 096, compare its SQL and effects with production, and add a deterministic repository/ledger parity gate. Do not delete the ledger row, recreate a guessed migration, or rerun it in production.

### Historical provenance recovered

GitHub file history resolves why the extra ledger row exists:
- Migration 096 was introduced in commit `ca8f4100782e13f8d72106187fafc8e1e446214f` on 2026-10-27 (message: “Bind verification to organization and snapshot authority”).
- It was removed from `main` in commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` (message: “Remove accidentally placed unreviewed verification migration from main”).
- The exact historical SQL was recovered from the earlier commit. It adds four authorization snapshot columns to `verifications` and replaces the `prevent_invalid_verification()` trigger function.
- Production still contains all four columns and the `verifications_integrity_guard` trigger, and its migration ledger records version 096 as applied on 2026-10-27.

This is not a random counting error: production has a schema change whose source was deliberately removed from the current main branch because it was unreviewed. The source has now been recovered for forensic review, but it must **not** be restored to main or treated as approved merely because it exists in historical Git history. Review the SQL, compare the live function/trigger behavior, decide whether to formally adopt or safely supersede it, and record that decision in a reviewed migration. Preserve the production data and current schema throughout.


## Critical database security finding — confirmed

- Production main currently has 0 public tables with RLS enabled.
- Production main currently has 0 public RLS policies.
- The inspected login role `rupaykg` has `BYPASSRLS=true`.

This is a production tenant-isolation and least-privilege blocker. Do not simply enable RLS globally: first map every tenant-owned table, service query, migration owner, and authorization path; rehearse a complete policy/role design on a disposable branch; prove positive and negative cross-tenant tests; then prepare a controlled, reviewed production rollout with rollback.

## Render configuration note

The live Render service is named `rupaykg`; the repository's `render.yaml` blueprint declares `rupaykg-production`. This difference is not by itself proof of a runtime fault. The live Render service configuration is the current evidence for the running service; the blueprint must be reconciled separately before relying on it for future service creation or changes.

## Open verification item

The exact Neon branch/database reached by the Render runtime has **not** been independently proven. The Render health route reports availability but not a safe database identity fingerprint. Add a restricted, non-secret runtime identity diagnostic (database name, server identity, deployment commit, and a non-sensitive configured authority marker) and verify it from the live service. Never log or expose the database URL, password, certificates, or tokens.

## Shakti Standards execution gates

| Gate | Status | Evidence / next action |
|---|---|---|
| Reality and context | PASS with limits | Render service and Neon branches inspected |
| Evidence | PARTIAL | Runtime health and DB metadata observed; exact runtime branch binding remains open |
| Regulatory / statutory boundary | OPEN | Continue independent evidence and source control |
| Architecture / authority | OPEN | Prove Render-to-Neon binding; formally designate one production branch |
| Database security | BLOCKED | RLS absent; current role bypasses RLS |
| Migration integrity | BLOCKED | 91 repository files vs 92 ledger rows; missing source for version 096 |
| Engineering validation | PARTIAL | Candidate CI evidence exists; production rollout not established |
| Deployment / operations | PARTIAL | Live service and HTTP 200 observed; free single-instance service is not HA evidence |
| Measurement / assurance | OPEN | Backups, restore drill, monitoring, incident and recovery evidence required |
| TRL 9 | NOT ACHIEVED | Full operational environment, stakeholder acceptance, independent verification and sustained operation evidence remain necessary |

## Actions taken in this checkpoint

- Read-only inspection of Render service and deployment.
- Read-only inspection of Neon production branch metadata and SQL catalog/ledger.
- Read-only inspection of repository source, migration files and deployment template.
- No production data, schema, role, credential, Render setting, or deployment was changed.

## Immediate ordered work

1. Prove the live Render runtime's exact Neon database/branch without exposing secrets.
2. Recover and reconcile the missing source for migration 096; add migration parity validation.
3. Design and rehearse least-privilege database roles and tenant isolation on disposable Neon branches.
4. Reconcile Render blueprint naming/configuration with the existing live service without creating a duplicate service.
5. Consolidate pull requests only after overlap, dependency, and deployment-impact review.
6. Execute complete authenticated BWG/EPR/MRV workflows and operational recovery tests.
7. Update the Shakti production gate only when each claim has fresh evidence.

**Release decision: HOLD — live application, not production-certified national infrastructure.**
