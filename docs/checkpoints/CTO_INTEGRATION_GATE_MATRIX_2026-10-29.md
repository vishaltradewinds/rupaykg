# CTO Integration Gate Matrix — 2026-10-29

**Repository:** `vishaltradewinds/rupaykg`  
**Purpose:** Coordinate the open migration, EPR/ESG/CCTS/CCC baseline, production-safety, and GRI work without introducing conflicting migration history.  
**Status:** Engineering coordination record. No live database writes or deployment authorization.

## 1. Evidence checked

The following exact-head GitHub Actions runs were queried on 2026-10-29 and returned completed/successful:

| Workstream | PR | Checked head | CI run | Interpretation |
|---|---:|---|---:|---|
| Dual-ledger migration compatibility | #108 | `8343d065e63565dac0c03ae6d65d1abba4dea0de` | `40832658604` | Engineering acceptance only |
| India regulatory source baseline | #119 | `5ba6ed40ca7d988337fe63b689cfac6577295bc0` | `40877858923` | Research/source-register tests only |
| Production safety and EPR/ESG verification | #120 | `c93b162a853e8dcd096d706b13f095fe5f8d2479` | `40887959002` | Engineering acceptance only |
| GRI cross-mapping | #121 | `b04718ee1b0a34aa42f0bf4aa5dea32081de3892` | `40887646135` | Schema/package tests only |

These runs are not a combined integration run. They do not establish legal completeness, live schema parity, production readiness, independent review, or certification. Re-check the current PR heads and rerun CI after any integration.

## 2. Integration dependencies and disposition

| Gate | Required evidence | Current disposition |
|---|---|---|
| Historical production migration 096 | Render deployment chronology and recovered SQL blob reviewed independently; document that artifact-level SQL/image attestation was unavailable in inspected evidence | **OPEN — provenance exception/reviewer decision required** |
| Staging migrations 20261022–20261025 | Exact deployed-source evidence or formally accepted, documented provenance exception; reconcile ordering and object definitions | **OPEN — no checksum in inspected ledger** |
| Canonical release catalog | One authoritative ordered catalog, exact source mapping, no duplicate or conflicting migration numbers | **BLOCKED by history reconciliation** |
| PR #120 migrations 088–090 | Compare against canonical catalog and both live ledger histories; run integrated disposable PostgreSQL tests | **DEFERRED — do not merge/apply independently** |
| GRI persistence | Add migration only after canonical catalog/dual-ledger decision; preserve GRI as advisory mapping | **DEFERRED — PR #121 intentionally contains no GRI migration** |
| Regulatory baseline | Reuse PR #119's single source register; archive applicable Gazette/instrument versions, amendments, effective dates, hashes and applicability decisions | **REVIEW REQUIRED** |
| Worker/scheduler | Full actual-worker transition, lease, retry, quarantine, idempotency, concurrency and recovery acceptance; explicit release approval | **HOLD — scheduler disabled** |
| Production release | Object-level schema/data diff, independent security/database/domain/compliance reviews, verified backup/restore, signed Shakti Standards gate including TRL | **HOLD** |

## 3. Required sequence

1. Preserve the migration runner's fail-closed behavior. Never fabricate ledger entries, edit applied migrations in place, remove data, or bypass the orphan guard to make CI green.
2. Resolve the migration provenance record for production 096 and staging 20261022–20261025. Distinguish deployment-correlated evidence from cryptographic artifact attestation; do not describe the former as checksum-verified.
3. Approve one canonical migration catalog and documented forward-only reconciliation plan with independent database/security review.
4. Integrate PR #120 against that catalog. Re-run the actual migration runner and disposable PostgreSQL acceptance against production-shaped and staging-shaped ledgers, including rerun/no-op and failure/recovery behavior.
5. Integrate PR #119's source register as the single regulatory baseline. Keep EPR statutory compliance, ESG/BRSR disclosure/assurance, and CCTS/CCC eligibility/issuance as separate determinations. ICVCM remains supplemental.
6. Rebase/review PR #121 after the shared ESG changes settle. Add GRI persistence and organization-scoped authenticated APIs only as a separately reviewed follow-on against the canonical migration catalog, with append-only audit events and authorization tests.
7. Run combined exact-head CI, inspect the complete production/staging object-level diff, obtain required independent approvals, and record the Shakti Standards/TRL decision before any production change.

## 4. Non-negotiable release controls

- No production/staging DDL/DML or ledger repair is authorized by this record.
- No scheduler activation is authorized.
- A successful CI run is engineering evidence, not regulatory approval or production certification.
- No GRI crosswalk can satisfy or override EPR obligations, ESG assurance, CCTS eligibility, or CCC issuance.
- All external submission, verification, acceptance and certificate statuses must be supported by authoritative evidence; otherwise retain a non-authoritative state such as `NOT_OBSERVED` or `PENDING_REVIEW`.

## 5. Read-only live-ledger and schema comparison — 2026-10-29

Read-only Neon queries were run against project `steep-mud-79906940`, database `rupaykg`. No database writes were performed.

### Ledger summary

| Environment | Ledger rows | Earliest applied | Latest applied |
|---|---:|---|---|
| Production branch `br-restless-base-b44cip2h` | 92 | 2026-10-17T10:47:58.762Z | 2026-10-27T13:46:14.262Z |
| Staging branch `br-spring-hill-b4544vz5` | 95 | 2026-10-17T10:47:58.762Z | 2026-10-20T10:48:38.647Z |

Both ledgers share the date-prefixed migration records `20261018`–`20261021`. Production records `096_verification_authorization_provenance.sql`; staging instead records `20261022_async_mirror_inbox.sql`, `20261023_async_mirror_worker_leases.sql`, `20261024_ai_intake_rate_limits.sql`, and `20261025_ai_evidence_intake_jobs.sql`. This is divergent history, not a safe linear “production behind staging” sequence.

### Read-only object-level schema diff

Neon schema comparison (production relative to staging) identified substantive differences, including:

- Staging has the async mirror inbox, append-only inbox event functions, AI intake rate-limit and durable AI evidence-intake job tables; these objects are absent from the production-side schema dump.
- The verification authorization trigger/function definitions differ. Staging's definition derives activity from evidence, enforces activity/organization binding and active organization membership, blocks self-verification, and records authorization snapshots. Production's compared definition is older/different and does not contain all of those checks.
- The staging-side inbox event mutation/recording functions are absent from the production-side schema dump.
- These are functional/security differences, not merely migration-ledger naming differences.

The schema diff is evidence for a targeted object-by-object review, not a deployment plan. Before any reconciliation, independently inspect exact definitions of affected triggers/functions, grants/RLS, table constraints, indexes and data dependencies. Do not copy staging schema wholesale to production, replay staging migrations on production, or infer that migration 096 is safely equivalent to staging verification logic.

### Immediate implications

1. Maintain the production and staging write freeze for migration reconciliation.
2. Do not enable the async mirror/AI intake worker in production until its required objects and worker transitions are reviewed and tested.
3. Treat verification authorization behavior as a security-significant parity gap requiring an independent reviewer and explicit acceptance tests.
4. Build a forward-only reconciliation proposal only after the canonical catalog, exact source provenance, data-preservation plan, backup/restore evidence, and approvals are recorded.
5. CI for the documentation commit is separate from this read-only database evidence and must be confirmed at the exact commit before calling that commit validated.

## 6. Source-recovery and deployment-correlation update — 2026-10-29 14:15 UTC

Source discovery has advanced since the initial matrix:

- Production migration 096 source was recovered from commit `ca8f4100782e13f8d72106187fafc8e1e446214f`, blob `258b1f4534efbf915688f78aa84d4ec24a47cbc0`. Render deploy `dep-dbgallbrjlhs73d104r0` ran from `13:44:53Z` to `13:46:30Z` on 2026-10-27; the production ledger records migration 096 at `13:46:14Z` during that window. The next deploy removed the file. This is strong chronology/source correlation, but not signed artifact-image attestation.
- Staging migration source blobs are confirmed on `intelligence/ai-evidence-intake-middleware`: 20261022 `4d08607e03561b9fbb4ce502b4c4211127237050`; 20261023 `33cb4d5d2e29a4a111340e5a0ac34170a0081895`; 20261024 `87b51fe60a96a4e0752c8b0a9a170c81f9936dbb`; 20261025 `6a0ae54530b7b756dac33589eaf18df3b071d8f2`.
- The staging feature branch is materially diverged; these sources must not be copied into the candidate or merged wholesale without dependency and catalog review.
- Worker defect confirmed: worker code can write `UNRESOLVED`, but the recovered 20261023 constraint omits it. The future-dated 20261101 source is not a deployed fix. Disposable PostgreSQL acceptance must test this transition.

Accordingly, update the first two gate rows: exact source discovery is now **CLOSED**; independent source/deployment review and artifact attestation remain **OPEN**. Canonical catalog, forward-only reconciliation, live writes, scheduler and production release remain **BLOCKED/HOLD**.

The exact-head CI for this documentation commit must be checked independently; documentation CI does not validate database migration behavior.

