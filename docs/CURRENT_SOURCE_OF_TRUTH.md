# RupayKg — Current Source of Truth and Recovery Checkpoint

**Checkpoint date:** 2026-10-30  
**Status:** Production HOLD · scheduler OFF · certification HOLD/OFF  
**Canonical repository:** `vishaltradewinds/rupaykg`  
**Production service:** Render `rupaykg` — `srv-daki4d7qj5pc73b8qksg`  
**Current main commit at checkpoint:** `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`

This file supersedes older status summaries when they conflict with the dated evidence below. Historical records are retained for auditability; a document's presence in Git is not proof that its claims remain current.

## 1. Release decision

**Do not release, certify, replay/rollback migrations, or enable scheduled processing while the provenance gate remains open.** No production/staging data or schema writes were performed during this checkpoint. The Neon inspections described below were read-only.

A live service or HTTP 200, a successful build, or green CI is not by itself proof of regulatory readiness, full production acceptance, or Shakti certification.

## 2. Neon and Render evidence observed

Neon project `rupaykg-production-fresh`, ID `steep-mud-79906940`, database `rupaykg`, PostgreSQL 18, AWS us-east-2:
- Main branch: `br-restless-base-b44cip2h`
- Staging branch: `br-spring-hill-b4544vz5`
- Rehearsal branch: `br-broad-glade-b46npw8o`

On Neon main, `public.schema_migrations` contained 92 rows. It recorded version `096`, filename `096_verification_authorization_provenance.sql`, applied at `2026-10-27T13:46:14.262221Z`. The four expected authorization snapshot columns existed on `public.verifications`, and `prevent_invalid_verification()` contained the authorization snapshot logic. The `verifications_integrity_guard` trigger existed.

Render runtime logs reported migration 096 applied at approximately `2026-10-27T13:46:15Z`. Render's earlier build used commit `ca8f4100782e13f8d72106187fafc8e1e446214f`; replacement commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` removed that migration from main. The SQL retrieved from the earlier commit had Git blob ID `258b1f4534efbf915688f78aa84d4ec24a47cbc0`. **This is a Git blob ID, not the SQL file's SHA-256.**

Staging and rehearsal each showed 95 migration-ledger rows, no version 096 entry, and none of the four authorization snapshot columns. Their `prevent_invalid_verification()` function did not contain the authorization snapshot logic. Both branches record migrations `20261022`–`20261025` at `2026-10-20T10:48:38.647496Z`, which predates the date encoded in those filenames and requires separate provenance review.

### What remains unproven

1. Whether Render's secret `DATABASE_URL` targets this exact Neon project, branch and database. Secret values must not be exposed to establish this.
2. The immutable image/artifact digest for the relevant Render deployment.
3. SHA-256 of the exact migration SQL bytes in that artifact and evidence those bytes were executed.
4. Authorized release approval and final reconciliation of production/staging migration histories.

The observed Neon main state strongly corroborates the migration-096 runtime log but does not close these provenance gates.

## 3. Required next batch — in order

1. Reconcile repository inventory, open PRs and branch divergence without deleting evidence or merging unreviewed code.
2. Confirm Render-to-Neon target using a safe, authorized metadata-only mechanism; never print secrets.
3. Preserve relevant Render build/deploy event records and logs.
4. Obtain immutable deployed artifact/image digest; calculate SHA-256 for the exact SQL bytes when available.
5. Reconcile migration inventories and ledgers for main, staging and rehearsal. Investigate date-stamped migration timestamps.
6. Run clean disposable PostgreSQL migration tests and the focused migration-history regression suites on the exact candidate commit.
7. Obtain independent review and explicit release approval before any production/staging remediation.

## 4. Repository cleanup rules

- Keep `main` unchanged during cleanup; work in a reviewable branch and pull request.
- Do not delete, rewrite, renumber, or replay migration files to make a ledger appear consistent.
- Preserve historical evidence and superseded status records in an explicitly labelled archive or mark them as historical. Do not erase provenance.
- Remove duplicate verification-only markers only after recording their content hashes and confirming no references remain.
- Keep one current source-of-truth status, and label dated snapshots as historical.
- Do not close or delete open PRs/branches in bulk based on age or naming alone. First map each to its head SHA, base, CI, dependencies, and whether it contains unique work; then propose supersession/closure.
- Separate code correctness, CI status, deployment status, regulatory validation, TRL evidence, and certification. Do not infer one from another.

## 5. Known open engineering tracks at checkpoint

Open PRs include migration preflight and migration-history test work (#146, #148), worker lease reconciliation and regression tests (#149, #150, plus #142/#144), CI routing (#147), authorization provenance proposals (#139/#140), migration-history audit and canonicalization (#134/#135), and several older feature/security/compliance/hardware tracks. Their presence does not mean they are approved or merged. Review and deduplicate these in coherent batches; preserve unique unmerged work until its successor is verified.

The repository has a large number of open PRs and feature branches. This is a genuine governance/clarity problem, but bulk deletion is not a safe first step. The cleanup PR should create a traceable inventory and only remove confirmed redundant documentation or markers.

## 6. Shakti Standards and TRL

Apply the Shakti Standards lifecycle: reality/context discovery → evidence → statutory and technical boundaries → feasibility → design → engineering → tests → independent review/approval → deployment → operation → measurement → continuous assurance. Use fail-closed gates and preserve evidence. Include TRL assessment, but do not claim TRL 5/9 or production certification without the required independently verifiable evidence. A live Render service does not establish TRL 9.

## 7. Evidence links

- [GitHub Issue #145 — migration provenance reconciliation](https://github.com/vishaltradewinds/rupaykg/issues/145)
- [Render service dashboard](https://dashboard.render.com/web/srv-daki4d7qj5pc73b8qksg)
- [Neon project console](https://console.neon.tech/app/projects/steep-mud-79906940)
- [Historical migration 096 source commit](https://github.com/vishaltradewinds/rupaykg/blob/ca8f4100782e13f8d72106187fafc8e1e446214f/migrations/096_verification_authorization_provenance.sql)
- [Current main commit at checkpoint](https://github.com/vishaltradewinds/rupaykg/commit/54a7fe1ceb41b37a68720a71c10a1dd03af30dea)

**Checkpoint is a record of observed evidence and blockers, not a release authorization.**


## 8. Repository cleanup progress

The repository cleanup and open-work triage inventory is recorded in [REPOSITORY_CLEANUP_TRIAGE_2026-10-30.md](REPOSITORY_CLEANUP_TRIAGE_2026-10-30.md), with dependency lanes in [MIGRATION_PR_DEPENDENCY_MAP_2026-10-30.md](MIGRATION_PR_DEPENDENCY_MAP_2026-10-30.md). Obsolete marker-only PRs #5–#9 and superseded worker PRs #144 and #122 were closed without merging. PR #122 was closed only after exact patch comparison confirmed its worker PostgreSQL test and CORS runtime test patches were byte-for-byte identical to the coverage carried forward in #150. Duplicate branch refs have been identified but not deleted because deletion requires a supported write path and a final dependency check. See draft [PR #151](https://github.com/vishaltradewinds/rupaykg/pull/151); it remains unmerged pending review.


## 9. Newly confirmed migration identity collision across candidate branches

During cleanup, PR #104 (`audit/pr97-merge-candidate-validation-2026-10-28`) and PR #106 (`shakti/batch-a-combined-pr97-validation`) were inspected. Both contain `migrations/096_epr_acceptance_evidence_immutability.sql` (Git blob `28ea4b350fe5074d2e59e59fc38c714019d00c10`) and `migrations/102_verification_authorization_provenance.sql` (Git blob `258b1f4534efbf915688f78aa84d4ec24a47cbc0`). The latter is the same Git blob as the historical `096_verification_authorization_provenance.sql` retrieved from commit `ca8f410...`. Thus candidate branches assign migration identity 096 to a different EPR migration and place the authorization-provenance SQL at 102. This is a cross-branch identity collision requiring full-history reconciliation; it is not safe to delete either candidate as a mere duplicate, nor to merge or renumber migrations blindly.
