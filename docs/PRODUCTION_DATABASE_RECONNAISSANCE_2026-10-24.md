# RupayKg Production Database Reconnaissance — 2026-10-24

## AIM and release gate

**AIM:** Operate RupayKg as secure, auditable digital MRV and CPCB compliance infrastructure.

**Shakti Standards:** discover reality, gather evidence, respect compliance boundaries, validate before changes, preserve recovery, certify before release. Deployment is the final gate.

**Decision: PRODUCTION CERTIFICATION HOLD.** This document records read-only provider observations. The Render service's actual database connection is not yet proven to map to the candidate Neon branch below. Do not treat candidate-branch observations as confirmed live-service facts.

## 1. Scope and identity caveat

- Render web service: `rupaykg`, ID `srv-daki4d7qj5pc73b8qksg`, URL `https://rupaykg.onrender.com`.
- Render service is configured to track `main` with automatic deploys on commit.
- Render-managed Postgres candidate `rupaykg-db`, ID `dpg-dakhdv95efls73e1974g-a`, is suspended due to billing and shows expiry date 2026-10-15. Its allowlist includes `0.0.0.0/0`.
- Neon project `rupaykg-production-fresh`, ID `steep-mud-79906940`, has default branch `main`, ID `br-restless-base-b44cip2h`, database `rupaykg`.
- A second Neon project `rupaykg`, ID `still-violet-61832250`, also exists.
- Render's environment-variable values are not available via the read-only Render integration. The exact Render `DATABASE_URL` provider/project/branch is therefore **UNCONFIRMED**.

## 2. Read-only observations on candidate Neon main

Queries were executed against project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`. Provider API reports PostgreSQL 18.6.

### Migration ledger

The candidate database contains 91 migration rows, ending at `20261021_evidence_artifact_vault.sql`. The current engineering branch contains later migrations including global audit-chain enforcement and subsequent CPCB/MRV baseline work. This candidate database does not show the complete current repository migration inventory.

### Audit-chain objects

- `audit_events` exists.
- `platform_audit_chain_head` exists.
- `platform_audit_chain_anchor` is absent.
- No triggers on `public.audit_events` were returned by `information_schema.triggers`.
- No expected named audit-chain trigger functions were returned by the read-only function query.
- The two existing tables are owned by `rupaykg`; row-level security is disabled on both.
- The `rupaykg` role has direct `DELETE`, `INSERT`, `REFERENCES`, `SELECT`, `TRIGGER`, `TRUNCATE`, and `UPDATE` grants on both tables.
- The `rupaykg` role attributes include `CREATEROLE`, `CREATEDB`, `REPLICATION`, and `BYPASSRLS`. It is not marked superuser, but these attributes are not appropriate to assume for a least-privilege runtime role.

These are critical security findings **for the candidate Neon main branch only**. If Render is confirmed to use this branch, the current state does not satisfy the intended audit-chain and least-privilege release gates.

## 3. Recovery posture

- Neon project's history retention is 21,600 seconds (6 hours).
- No snapshots were listed.
- No automatic snapshot schedule was configured on the candidate main branch.
- No automatic snapshot schedule was configured on the staging branch either.
- A branch named `rupaykg-gov-inbox-staging-20261020`, ID `br-spring-hill-b4544vz5`, exists in the candidate project. It is not to be used for writes or presumed disposable without explicit verification.

No snapshot, role, grant, migration, environment variable, branch, or deployment was changed during this reconnaissance.

## 4. Required next steps

1. An authorized operator confirms the exact provider/project/branch/database and TLS mode for Render's runtime and migration connection variables from the Render dashboard. Record only non-secret metadata; never copy credentials or full connection strings into chat.
2. Run the repository's read-only migration-state verifier against the confirmed target and retain its sanitized output.
3. Verify whether the candidate Neon main findings apply to the actual live service.
4. Before any remediation, establish a recoverable backup and perform a restore rehearsal in a verified isolated target.
5. Design and test a least-privilege runtime role and separate migration role; inspect role memberships and ownership, not only table grants.
6. Apply audit-chain fixes only after target identity, backup/restore, lock impact, and rollback are verified, under an approved change window.
7. Re-run database integration tests and the production readiness gate. Keep production certification on HOLD until evidence passes.

## Evidence quality

Provider metadata and SQL observations above are read-only results. They establish the state of the named candidate Neon branch at query time, not its identity as the Render service's active database. No production certification is implied.
