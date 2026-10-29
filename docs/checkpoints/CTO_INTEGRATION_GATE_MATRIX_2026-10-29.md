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
