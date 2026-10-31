# RupayKg Integrated Migration and National Worker Release Plan

**Date:** 2026-10-31  
**Status:** Engineering plan; production HOLD  
**Target architecture:** National system-level source ingestion + organization-scoped downstream workflows  
**Authoritative DB:** Neon project `rupaykg-production-fresh` / `main` / database `rupaykg`

## 1. Current release facts

### Repository and CI
- Candidate branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Candidate HEAD at plan creation: `d36ef5b81c3fcfbfe047f90b5ca8f9d45d9b3934`.
- PR #175: open/draft, base `main`; exact-head CI run #3922 / `41214177450` completed SUCCESS.
- PR #161: open/draft, same head branch, stacked on `shakti/integrate-government-inbox-worker-2026-10-31`; not a direct merge to main.
- PR #173: open/draft, authoritative DB/repository cleanup workstream; separate candidate and dependency must be reconciled before promotion.
- PR #160: open/draft runtime DB-role diagnostic; diagnostic has not been deployed to Render.
- PR #175 and #161 are not two independent release candidates: they share a head branch but target different bases. Review and integrate the stack deliberately.
- Render production service observed in prior inspection deploys `main` at `862512c8c904cef0f604df0350f02672318953af`; candidate branch is not live. Reconfirm before any deployment.

### Neon production baseline (read-only)
- Project: `steep-mud-79906940`.
- Production branch: `main`, ID `br-restless-base-b44cip2h`, primary/default.
- Database: `rupaykg`.
- Migration ledger: 92 rows, max `20261021`.
- Public tables: 67; RLS enabled 0; FORCE RLS 0; policies 0.
- All 67 public tables owned by `rupaykg`.
- `rupaykg` login has BYPASSRLS, CREATEROLE, CREATEDB and REPLICATION and is a member of `neon_superuser`.
- Production branch `protected=false`; project history retention 21,600 seconds (6 hours).
- No independent backup restore proof was found.
- Actual Render runtime role remains NOT VERIFIED.

### Rehearsal and staging
- Production-derived worker/migration rehearsal: `br-young-mouse-b4jhqbci`; previous inspection found 115 migrations and 78 public tables; current read-only catalog query found 0 RLS-enabled public tables. It is not production authority.
- Staging and older rehearsal branches are not production authorities.
- Proposed migration chain must be tested against a production-derived disposable baseline that preserves migration 096 verifier authorization provenance.
- Do not copy staging/rehearsal schema wholesale into production.

## 2. Release principles

1. One authoritative live DB: production Neon main. Rehearsal branches are disposable test targets only.
2. Never activate national ingestion using the database-owner credential.
3. National ingestion worker has global scope only over the named internal queue and approved public-source metadata; it does not read tenant evidence.
4. Tenant dispatch is minimal and downstream workflows revalidate tenant membership, authority, rule version and evidence.
5. Migrations are a separately approved one-off operation using a migration identity, not API runtime credentials.
6. No migration success automatically starts a worker or makes an external integration live.
7. Preserve production-only migration 096 and verifier function behavior.
8. Keep CI, schema rehearsal, production approval and operational activation as four separate states.

## 3. Dependency-ordered release gates

### Gate 0 — protect authoritative infrastructure (P0)
**Exit evidence**
- Production branch protection configured and independently verified.
- Backup/export strategy documented with immutable retention appropriate to RPO/RTO.
- Restore rehearsal into isolated database passed with schema, row-count, key constraints, migration ledger, verifier function hash and authorization snapshot columns checked.
- Render production target branch/database confirmed.
- Current Render runtime role measured through the real service credential without revealing the secret.
- Emergency rollback owner, change approver and incident contact recorded.

**Current:** BLOCKED. Branch is unprotected; history retention is 6 hours; restore proof and Render principal are not established. No settings changed.

### Gate 1 — security and authority design (P0)
**Exit evidence**
- Complete route × statement × table × operation × principal × tenant-context map.
- Complete FK inheritance, views, triggers, functions, sequences, schema/default privilege and owner inventory.
- Final identity/privilege matrix approved.
- RLS policies per data class, not blanket enablement.
- Exact-role positive/negative acceptance tests pass on disposable production-shaped clone.
- Independent security reviewer signs off.

**Current:** BLOCKED. Catalog confirms zero RLS policies and privileged owner role. Source transaction context has improved, but full statement-level audit and runtime role proof remain incomplete.

### Gate 2 — migration reconciliation (P0)
1. Freeze writes to migration histories and preserve snapshots of production/staging/rehearsal ledgers.
2. Reconstruct production baseline exactly: 92 recorded migrations, production-applied 096 verifier provenance, four authorization snapshot columns and production verifier function definition/hash.
3. Reconcile repository migration files and ledger provenance without deleting/re-writing historical rows.
4. Apply proposed worker chain only to a disposable production-derived clone, in exact order, with exact migration owner role.
5. Check dependencies, constraints, trigger/function ownership, RLS/policies, grants, indexes, data backfills, idempotency and rollback.
6. Run DB acceptance tests with zero skips and compare expected schema to rehearsal.
7. Reconcile staging-only migration history separately; never replay 20261022–20261025 into a branch where already recorded.
8. Resolve unledgered rehearsal schema effects with an explicit forward-only migration after evidence and approval.
9. Independent reviewer approves final migration bundle and production change window.

**Current:** PARTIAL ENGINEERING EVIDENCE. CI has migration validation and production-baseline reconstruction. Production main has not received the worker schema. Rehearsal is not a substitute for independent production change approval.

### Gate 3 — national worker build and isolation (P0/P1)
- Implement system-level queue with bounded atomic claim, lease token, lease expiry, heartbeat, stale-worker fencing, retry/backoff, timeout, quarantine and payload-free append-only transition events.
- Worker reads only queue, approved source snapshots, jurisdiction crosswalk and exact resolver capability.
- Worker emits minimal dispatch envelope; no tenant evidence or measurements copied into the national queue.
- Worker login is separate, non-owner, non-superuser, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB, NOREPLICATION and NOINHERIT.
- Event writer is separate NOLOGIN capability; function ownership, search_path, SQL and EXECUTE grants independently reviewed.
- Verify `session_user`, `current_user`, role memberships, object ownership and exact grants at startup and in acceptance tests.
- Negative tests prove worker cannot read evidence, measurements, MRV, credentials, settlements, identities/passwords or arbitrary organization records.
- Verify source authenticity, timestamp/hash, source snapshot approval, crosswalk expiry/revocation, ambiguity handling and national-vs-tenant dispatch rules.
- Worker process runs as a separately declared deployment service with health checks, concurrency bounds, backpressure, metrics, alerts and graceful shutdown.
- Explicitly test crash/restart, duplicate delivery, timeout after accepted downstream dispatch, lease expiry, pool exhaustion, partial failure and replay.

**Current:** CODE/TEST foundations exist; no production worker service or live principal is evidenced. Render manifest has no worker service and no worker DB secret; worker OFF.

### Gate 4 — organization-scoped downstream execution (P1)
- Tenant dispatch service verifies message signature/identity, correlation, source snapshot and immutable organization binding.
- One tenant transaction per organization; validate current verified membership/authority and jurisdiction.
- Enforce RLS on root and child rows using reviewed FK ownership functions.
- Do not trust custom GUC values alone; validate membership/capability against DB-authoritative records.
- Re-evaluate applicable CPCB/SWM/EPR/CCTS rule snapshot and effective date.
- Evidence and MRV workflow remains organization-scoped with independent reviewer controls.
- Cross-organization transfers/settlements use bilateral party policies and append-only event history.
- Unmapped or ambiguous source data remains unresolved; no broad national tenant read.

**Current:** PARTIAL. Transaction context exists in multiple routes, but RLS and downstream dispatch boundary are not established.

### Gate 5 — regulatory and external trust integrations (P1/P2)
- Verify official source contracts, source authenticity, rate limits, transport, acknowledgement, correction/revocation semantics and source snapshots.
- Distinguish ingestion success from regulator acceptance.
- Guardian/Hedera: idempotent submission, ambiguous-submit recovery, external consensus/Mirror Node proof, policy/version linkage and duplicate prevention.
- Registry issuance/transfer/retirement and settlement proof must be externally confirmed; internal state alone is not proof.
- Statutory thresholds/methodologies bind to approved, versioned source snapshots and effective dates.

**Current:** NOT ESTABLISHED for official live CPCB acceptance, external registry acceptance, Hedera consensus proof or payment settlement.

### Gate 6 — operational acceptance and TRL progression (P2/P3)
- Backup/restore and disaster recovery; RPO/RTO measured.
- SLOs, uptime, queue lag, processing latency, retries, quarantine, data quality and alert thresholds.
- Security monitoring, incident drills, secret rotation, access reviews, rate limiting, vulnerability remediation.
- Privacy/retention/deletion controls and evidence malware scanning/quarantine.
- Hardware model approval, calibration/metrology, firmware signing, device provisioning/key rotation, field maintenance and field trial.
- Pan-India geography, local-body coverage, statutory applicability, language, accessibility, support and capacity evidence.
- Independent verification and real-world operational acceptance before TRL 9 claim.

**Current:** NOT ESTABLISHED.

## 4. PR integration plan

- PR #161 and #175 share the candidate branch; #161 is stacked on the government worker integration branch, #175 targets main. Do not merge both independently without checking duplicate commits and base history.
- PR #173 is the authoritative DB/repository cleanup stream. Review its migration and branch authority changes before integrating worker work.
- PR #160 provides the runtime-role diagnostic. It is not deployed; use it only after independent review and a controlled non-public execution path.
- Merge order must be decided by dependency graph and exact base commits, not PR number or creation time.
- Keep all PRs draft until migration, security, architecture and independent review gates are satisfied.

## 5. Production change protocol

Every production change requires:
1. Exact branch, project, database and endpoint confirmation.
2. Current schema/migration/role snapshot.
3. Backup/restore readiness and named rollback procedure.
4. Reviewed change SQL and migration checksum.
5. Security/compliance and platform owner approval.
6. Maintenance window and impact analysis.
7. Apply once using migration identity; do not run from API startup.
8. Verify schema, constraints, function hashes, grants, RLS, app health and data integrity.
9. Verify worker remains OFF unless separately approved.
10. Record evidence, operator, timestamps, exact commit and post-change result.

## 6. Hard stop conditions

Stop the release if:
- Runtime role cannot be verified or is owner/BYPASSRLS.
- Any tenant-owned table remains unclassified.
- RLS can be bypassed by a caller-set tenant GUC.
- Cross-tenant negative tests fail or are skipped.
- Migration 096 verifier provenance/function is altered or lost.
- Migration ledger/schema drift remains unexplained.
- Worker can read tenant evidence or use a broad owner credential.
- Backup restore or rollback cannot be demonstrated.
- External submission idempotency/ambiguous recovery is unresolved.
- PR base/branch relationship or exact-head CI is unclear.

## 7. Final release posture

**P0/P1 HOLD.** Engineering CI is positive at the candidate SHA; production DB security, runtime role, backup/restore, migration reconciliation, worker deployment and live government acceptance remain separate uncompleted gates. TRL 9 is not established.
