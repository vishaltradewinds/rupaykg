# Canonical Migration Reconciliation — 2026-10-31

## Executive decision

**Production remains HOLD. Scheduler remains OFF. Certification remains OFF.** This document records verified source and schema evidence and the controlled repository repair path. No production, staging or rehearsal database was modified.

The repository and Neon branches have divergent migration histories. Do not copy a database branch wholesale, rewrite applied ledgers, or infer migration SQL from live objects.

## Live Neon evidence

Project: `steep-mud-79906940`; database: `rupaykg`.

| Branch | Neon branch ID | Ledger | Observed schema |
|---|---|---:|---|
| Production/main | `br-restless-base-b44cip2h` | 92 rows | Has verifier authorization snapshot columns/FKs and stronger `prevent_invalid_verification()`; lacks async mirror and AI intake tables |
| Government inbox staging | `br-spring-hill-b4544vz5` | 95 rows | Has async mirror inbox, event history, AI rate-limit and AI evidence-intake tables; no `UNRESOLVED` status |
| Migration rehearsal | `br-broad-glade-b46npw8o` | 95 rows | Same four async/AI tables; inbox status additionally permits `UNRESOLVED` |

Production records migration `096_verification_authorization_provenance.sql`; staging and rehearsal do not. Production has these verifier authorization fields and references:
- `authorization_membership_id`
- `authorization_role_id`
- `authorization_permissions_snapshot`
- `authorization_checked_at`

Production's verifier trigger enforces evidence/activity binding, organization-scoped VERIFIED membership and identity, no self-verification, permission validation, and decision-time authorization snapshots. This is the security baseline to preserve.

Staging and rehearsal record migrations 20261022–20261025. Production does not. A schema comparison between staging and rehearsal found the only observed difference to be the inbox status constraint/comment: rehearsal permits `UNRESOLVED`, staging does not. Neither branch's migration ledger records 20261101, so the rehearsal `UNRESOLVED` change is unledgered schema drift.

## Historical migration provenance

### Migration 096 — recovered, but intentionally removed

- Original source commit: `ca8f4100782e13f8d72106187fafc8e1e446214f`
- Original path: `migrations/096_verification_authorization_provenance.sql`
- Git blob: `258b1f4534efbf915688f78aa84d4ec24a47cbc0`
- Deletion commit: `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`
- Deletion message: “Remove accidentally placed unreviewed verification migration from main”

Do not restore or replay migration 096 automatically. Independently review the deletion rationale and compare its SQL with the live production function, columns and FKs. Preserve the production controls regardless of the repository-history resolution.

### Async mirror and AI intake migrations — exact source objects recovered

Original sources were recovered from historical branch `test/real-worker-postgres-unresolved`, associated with closed draft PR #122. That branch is a provenance archive only: it is 580 commits ahead and 4 behind current main and contains extensive unrelated changes. Do not merge or cherry-pick it wholesale.

| File | Original source commit | Git blob SHA |
|---|---|---|
| `20261022_async_mirror_inbox.sql` | `5064e086085dda7f8765047ae8120f9cb6bf0d80` | `4d08607e03561b9fbb4ce502b4c4211127237050` |
| `20261023_async_mirror_worker_leases.sql` | `a27978f4f450108956b6baa3a17541c07a8ade26`; event-history update `13237f1714510a18021a94601ac9ff7b9f1def37` | `33cb4d5d2e29a4a111340e5a0ac34170a0081895` |
| `20261024_ai_intake_rate_limits.sql` | `a54fbdf81b0f5c4ae558acec3fc104407f70c48b` | `87b51fe60a96a4e0752c8b0a9a170c81f9936dbb` |
| `20261025_ai_evidence_intake_jobs.sql` | `fc958c1096baecf4f0f3c08b2f38742dafe708` | `6a0ae54530b7b756dac33589eaf18df3b071d8f2` |

The four source files have been restored to a focused draft PR #155. Each restored file's Git blob SHA was compared with its historical source blob; all four are identical Git objects.

PR #155: https://github.com/vishaltradewinds/rupaykg/pull/155

### 20261101 — unresolved-state migration

Historical source:
- Commit: `3270e4cee4552efe51f84d96a9ab2f02bc068b81`
- Git blob: `4f9776bc449025e795cb0d5c93e8bace9dea280b`

This migration adds `UNRESOLVED` to the internal inbox status constraint and documents that it means a structurally valid intake lacks one unambiguous, current, verified jurisdiction crosswalk. It is not official acceptance/rejection, an MRV result, or a credit decision.

Because the live ledgers do not record this migration and only rehearsal has its schema effect, it is not included in PR #155. It requires a separate explicit review and ledger/schema reconciliation decision.

## Worker reliability evidence

PR #122's historical PostgreSQL integration test covers:
- retry exhaustion and quarantine, including PROCESSING rows with NULL leases;
- expired and NULL-lease recovery;
- append-only, payload-free event history;
- stale fencing-token protection;
- unresolved intake remaining non-authoritative, with no official acceptance, authoritative MRV or Guardian/HCS side effects.

The exact-head CI run for PR #122 (run #3487) completed successfully with PostgreSQL 16, `DATABASE_URL`, and `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1` enabled. PR #142 exact-head CI #3485 and PR #143 exact-head CI #3471 also passed. These are historical feature-branch test results, not evidence that worker code is integrated into current main or deployed.

PR #122 was based on PR #142's feature branch; PR #142 itself was based on `intelligence/ai-evidence-intake-middleware`, not current main. These stacked feature branches must be reviewed and integrated through a focused dependency-aware PR sequence, not wholesale merged.

## CI and rehearsal status

- PR #154 documentation-only head `98f48ea02a9f1681087c03fe7f79931ddf4be2be`: exact-head CI run #3524 completed successfully. It ran migration catalogue validation, the migration runner against disposable CI PostgreSQL, type-check, build, browser smoke test, PostgreSQL acceptance suite and production-container build.
- PR #155 migration-source restoration head `9e7e6e045694a10c452b97ad36f9fb7bd5451116`: exact-head CI run #3525 was observed in progress at the last check; no pass is claimed until completed.
- A separate Neon production-clone rehearsal has not been completed. The Neon migration-preparation wrapper rejected a quoted semicolon in a COMMENT statement, and a branch-provision attempt was rejected by account compute/suspend settings. Branch inventory confirmed no new branch was created.

## Required release gates

1. PR #155 exact-head CI passes with the four recovered migrations applied in order on disposable PostgreSQL.
2. Verify source-to-live object equivalence and dependency ordering; distinguish repository history from the live applied ledgers.
3. Independently review migration 096's removal rationale and the rehearsal-only 20261101 state.
4. Integrate worker implementation and PostgreSQL acceptance tests from the stacked feature branches through a focused PR sequence; require zero relevant skips.
5. Obtain independent authorized review; no reviewer identity is assumed or fabricated.
6. Complete backup/restore rehearsal, operational monitoring, rate-limit and security review, deployment plan, rollback plan, and explicit production approval.

No SQL writes, DDL, production migration, staging migration, deployment, worker activation, scheduler activation, merge, or certification occurred during this reconciliation. Documentation, source recovery and CI do not advance TRL.

## Worker feature dependency boundary

A direct comparison of current `main` with `intelligence/ai-evidence-intake-middleware` shows that feature branch is 567 commits ahead and 4 behind, with a broad application/schema change set. The worker source and related routes, scheduler, crosswalk, evidence-intake and governance migrations are not present on current `main`; the feature branch includes additional migrations 20261026 onward and multiple supporting application files. PR #142 is based on that feature branch, and PR #122 is stacked on PR #142. Therefore the four-migration source restoration in PR #155 is deliberately not described as a complete worker integration. Worker code must not be cherry-picked in isolation until its schema, API, authorization, scheduler and operational-alert dependency closure is identified and reviewed. The historical worker PostgreSQL test passing on PR #122 remains useful evidence for that historical feature branch only.

PR #155 exact-head CI run #3525 completed successfully. It passed migration catalogue validation, applied the ordered migration runner to disposable PostgreSQL, passed type-check, build, browser smoke test, the repository's existing PostgreSQL acceptance suite, and production-container build. Note: PR #155 does not contain `apps/src/async-mirror-worker.postgres.test.ts` or the worker runtime, so this run is not a worker-specific PostgreSQL acceptance result.
