# Staging-Only Migration Recovery — Catalog Evidence (2026-10-28)

## Purpose and safety boundary

This is a **catalog-derived recovery record**, not a recovered original migration and not executable SQL. It records the schema that currently exists in the staging branch for the four legacy migration families that are absent from the current numbered-migration candidate. It must not be used as authority to apply DDL to production.

Read-only inspection only. No INSERT, UPDATE, DELETE, DDL, migration-ledger changes, or production/staging writes were performed.

## Source recovery result

Source recovery was rechecked against the feature branch `intelligence/ai-evidence-intake-middleware`, head commit `c56b9c1fe341ce3ba943bced10f47163dae2a513`. **All four original SQL files have now been located** on that branch:

- `migrations/20261022_async_mirror_inbox.sql` — blob `4d08607e03561b9fbb4ce502b4c4211127237050`; [source](https://github.com/vishaltradewinds/rupaykg/blob/intelligence/ai-evidence-intake-middleware/migrations/20261022_async_mirror_inbox.sql).
- `migrations/20261023_async_mirror_worker_leases.sql` — blob `33cb4d5d2e29a4a111340e5a0ac34170a0081895`; [source](https://github.com/vishaltradewinds/rupaykg/blob/intelligence/ai-evidence-intake-middleware/migrations/20261023_async_mirror_worker_leases.sql).
- `migrations/20261024_ai_intake_rate_limits.sql` — blob `87b51fe60a96a4e0752c8b0a9a170c81f9936dbb`; [source](https://github.com/vishaltradewinds/rupaykg/blob/intelligence/ai-evidence-intake-middleware/migrations/20261024_ai_intake_rate_limits.sql).
- `migrations/20261025_ai_evidence_intake_jobs.sql` — blob `6a0ae54530b7b756dac33589eaf18df3b071d8f2`; [source](https://github.com/vishaltradewinds/rupaykg/blob/intelligence/ai-evidence-intake-middleware/migrations/20261025_ai_evidence_intake_jobs.sql).

The same branch contains worker and integration-test sources:
- `apps/src/async-mirror-worker.ts` — blob `8008f0fa73f0f0a613cfcc1387fe50de51407862`.
- `apps/src/async-mirror-worker.test.ts` — blob `34451173fcc24a1b793ea0672ebccbbd397be23c`.
- `apps/src/async-mirror-worker-db.test.ts` — blob `611f16a2d2806747cf5f2d53df1a5629a69d7c9d`.
- `apps/src/async-mirror-routes.ts` — blob `96b814fb8723afeaadb3ba542126fbd73954928b`.
- `docs/GOVERNMENT_INBOX_WORKER_OPERATIONS.md` — blob `598595a169a725cf90397033befe2ac58386733c`.

**Important:** finding source in a feature branch is not equivalent to release approval. The worker operations document explicitly describes an engineering capability whose production scheduler is not enabled or certified. The 20261022 SQL creates the initial inbox status check; 20261023 expands it and adds lease/retry/quarantine columns and indexes. This aligns with the staging catalog observations. Before porting or applying anything, we still need to review branch divergence, run clean-install and both-ledger upgrade tests in disposable PostgreSQL, and prove that staging's 12 inbox and 29 event rows remain intact. No SQL has been applied to live databases. Exact historical grants/policies/ownership and any later modifications remain subject to full catalog comparison.

## Environment delta confirmed by read-only catalog checks

- Staging has `async_mirror_inbox`, `async_mirror_inbox_events`, `ai_intake_rate_limits`, and `ai_evidence_intake_jobs`.
- Production has none of these four tables.
- Current staging row counts: `async_mirror_inbox` = 12; `async_mirror_inbox_events` = 29; `ai_intake_rate_limits` = 0; `ai_evidence_intake_jobs` = 0.
- The inbox rows include 8 `PROCESSING`, 1 `QUARANTINED`, 1 `RECEIVED`, 1 `RETRY`, and 1 `VALIDATED`. Event rows include 14 `PROCESSING`, 12 `RECEIVED`, and one each `QUARANTINED`, `RETRY`, and `VALIDATED`.
- Observed timestamps are from 2026-10-20. These are live staging records and must be preserved; do not drop/recreate or replay these tables as part of migration recovery.
- There is no standalone `async_mirror_worker_leases` table in the current staging catalog. Lease state is represented by `lease_token` and `lease_until` columns on `async_mirror_inbox`. This is a catalog observation, not proof of the original migration's intended filename or full semantics.
- No non-internal triggers were found on these four tables in the staging catalog query.

## Catalog-reconstructed columns

### `async_mirror_inbox`
- `id uuid NOT NULL DEFAULT gen_random_uuid()`
- `authority_code text NOT NULL`
- `municipal_code text NOT NULL`
- `batch_id uuid NOT NULL`
- `sync_window_timestamp timestamptz NOT NULL`
- `payload jsonb NOT NULL`
- `payload_sha256 char(64) NOT NULL`
- `status text NOT NULL DEFAULT 'RECEIVED'`
- `attempts integer NOT NULL DEFAULT 0`
- `last_error_code text`
- `received_at timestamptz NOT NULL DEFAULT now()`
- `processed_at timestamptz`
- `lease_token uuid`
- `lease_until timestamptz`
- `next_attempt_at timestamptz`
- `quarantined_at timestamptz`
- `validation_summary jsonb`

Constraints:
- Primary key: `(id)`
- Unique: `(authority_code, batch_id)`
- `attempts >= 0`
- authority code length 2–80; municipal code length 2–100
- SHA-256 field must match `^[0-9a-f]{64}$`
- status in `RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY, QUARANTINED`

Indexes:
- `async_mirror_inbox_due_idx`: `(next_attempt_at, received_at)` for status RECEIVED/RETRY
- `async_mirror_inbox_expired_lease_idx`: `(lease_until)` for status PROCESSING
- `async_mirror_inbox_status_received_idx`: `(status, received_at)`
- Primary-key and unique indexes as above

### `async_mirror_inbox_events`
- `id bigint NOT NULL DEFAULT nextval('async_mirror_inbox_events_id_seq')`
- `inbox_id uuid NOT NULL`
- `authority_code text NOT NULL`
- `municipal_code text NOT NULL`
- `batch_id uuid NOT NULL`
- `from_status text`
- `to_status text NOT NULL`
- `attempt integer NOT NULL`
- `payload_sha256 char(64) NOT NULL`
- `error_code text`
- `occurred_at timestamptz NOT NULL DEFAULT now()`

Constraints:
- Primary key: `(id)`
- Foreign key `inbox_id REFERENCES async_mirror_inbox(id)`
- `attempt >= 0`
- SHA-256 field must match `^[0-9a-f]{64}$`

Indexes:
- `async_mirror_inbox_events_inbox_time_idx`: `(inbox_id, occurred_at)`
- Primary-key index

### `ai_intake_rate_limits`
- `identity_id uuid NOT NULL`
- `organization_id uuid NOT NULL`
- `window_start timestamptz NOT NULL`
- `request_count integer NOT NULL`

Constraints:
- Primary key: `(identity_id, organization_id, window_start)`
- Foreign keys to `identities(id)` and `organizations(id)`, both ON DELETE CASCADE
- `request_count >= 1 AND request_count <= 10`

Indexes:
- `ai_intake_rate_limits_window_idx`: `(window_start)`
- Primary-key index

### `ai_evidence_intake_jobs`
- `id uuid NOT NULL DEFAULT gen_random_uuid()`
- `identity_id uuid NOT NULL`
- `organization_id uuid NOT NULL`
- `idempotency_key varchar(200) NOT NULL`
- `request_sha256 char(64) NOT NULL`
- `status text NOT NULL DEFAULT 'PROCESSING'`
- `source_evidence_id uuid`
- `proposal_evidence_id uuid`
- `response_json jsonb`
- `attempt_count integer NOT NULL DEFAULT 1`
- `lease_token uuid NOT NULL DEFAULT gen_random_uuid()`
- `lease_expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes')`
- `last_error_code text`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`
- `completed_at timestamptz`

Constraints:
- Primary key: `(id)`
- Unique: `(identity_id, organization_id, idempotency_key)`
- Foreign keys to `identities(id)`, `organizations(id)`, and nullable `evidence(id)` source/proposal references; all ON DELETE RESTRICT
- `attempt_count BETWEEN 1 AND 100`
- status in `PROCESSING, RETRYABLE_FAILED, COMPLETED`
- request SHA-256 field must match `^[0-9a-f]{64}$`
- status is COMPLETED iff `completed_at IS NOT NULL`
- COMPLETED rows require `response_json IS NOT NULL`

Indexes:
- `ai_evidence_intake_jobs_org_updated_idx`: `(organization_id, updated_at DESC)`
- `ai_evidence_intake_jobs_recovery_idx`: `(lease_expires_at)` where status is not COMPLETED
- Unique idempotency and primary-key indexes

## Reconciliation decision

**Do not map these four staging-only migrations to numbered migrations 092–095.** Their SQL source and semantic equivalence are not established, and the existing staging inbox/event rows make destructive replay especially unsafe. Do not add filename aliases, mark legacy ledger entries as applied, or run schema repair against production based only on this catalog snapshot.

## Next engineering gates

1. Recover the two missing 20261022/23 SQL files from a trusted backup, developer artifact, deployment bundle, or audit record. If unavailable, treat catalog reconstruction as a new reviewed migration specification, never as recovered original SQL.
2. Import the recovered 20261024/25 files into an isolated disposable fixture and compare their full SQL-defined objects against staging catalogs; do not copy them into the release candidate or replay them against live staging merely because source was found.
3. Capture complete staging definitions including sequence ownership, grants, policies, dependencies, all indexes/constraints/functions, and seed data.
4. Create disposable PostgreSQL fixtures for both actual production and staging ledger/schema shapes. Preserve and assert all 12 inbox and 29 event rows across proposed upgrade tests.
5. Test clean install, upgrade from each ledger shape, repeated run/idempotence, rollback/recovery, and fail-closed behavior.
6. Obtain independent review before any production/staging DDL or ledger write.

## Shakti status

- Evidence gathering: **in progress**
- Original migration source recovery: **blocked**
- Compatibility proof: **not established**
- Production/staging write authorization: **not granted**
- Production certification: **HOLD**


## Additional operational finding — staging inbox backlog

A second read-only aggregate query found that the 12 staging inbox rows are not merely historical fixtures:
- 8 rows remain in `PROCESSING` with all 8 leases expired as of the audit time; the latest lease expiry was 2026-10-20.
- 1 `RETRY` row has a retry time in the past.
- 1 `RECEIVED`, 1 `VALIDATED`, and 1 `QUARANTINED` row remain.
- Latest inbox receipt and event timestamps are on 2026-10-20, so the queue appears stale for approximately eight days as of 2026-10-28.

This is a **staging operational incident candidate**, separate from migration compatibility. Do not auto-requeue, alter status, or clear these rows during migration repair. Next safe investigation is read-only correlation of each inbox row's non-payload identifiers/status/attempt/error fields with worker logs and code paths, followed by a documented recovery plan and disposable test. Do not read or expose raw payloads in the audit report.


### Read-only queue error/attempt breakdown

- 6 PROCESSING rows have attempts=1 and no last_error_code; 2 PROCESSING rows have attempts=2 and no last_error_code.
- The QUARANTINED row reached attempts=5 with `WORKER_ATTEMPTS_EXHAUSTED`.
- The RETRY row has attempts=1 and `SyntheticTransientError`.
- The RECEIVED row has attempts=0; the VALIDATED row has attempts=1 and no last_error_code.

This pattern is consistent with a test/synthetic queue exercise, but that is not conclusively proven from catalog metadata alone. Verify environment ownership and correlate worker/test logs before treating these as real operational workload or attempting recovery. Raw payloads were not queried.


### Stronger synthetic-data evidence

A read-only query of non-payload metadata for all 12 inbox rows found every row uses `authority_code='TEST-AUTH'` and `municipal_code='TEST-MUNI'`. Batch identifiers follow the repeated `b2b2…` test pattern for 10 rows, with two explicit test UUIDs for the initial samples. The only terminal failure code is `WORKER_ATTEMPTS_EXHAUSTED`; the retry row's error is explicitly `SyntheticTransientError`. This is strong evidence that these are test/acceptance fixtures rather than real municipal workload, although environment ownership should still be confirmed before any destructive cleanup.

The current repository tree and code search did not surface a worker implementation or matching worker error strings. Therefore no safe code-level replay/requeue operation can be justified from this repository snapshot. Preserve the rows until the test fixture's owning test/seed script is located and the environment owner approves cleanup.

## Queue recovery disposition

- Classification: **very likely synthetic/acceptance data**
- Operational backlog: **not treated as a production incident**
- Automatic requeue/lease reset: **not performed**
- Raw payload inspection: **not performed**
- Safe next action: locate the fixture/seed/test source from repository history, CI artifacts, or deployment bundle; add a disposable test proving fixture creation and expected queue transitions; then document a separately approved staging cleanup if the environment owner wants it removed.


### Repository ownership search

Inspected the current branch tree (348 tracked paths) and the available acceptance seed:
- No queue/worker implementation, mirror inbox handler, or worker test file is present in the branch tree.
- `apps/src/acceptance-seed.ts` is a separate WA03.001 carbon/MRV live-acceptance fixture and contains no mirror-inbox table or `TEST-AUTH` seed.
- The existing `migrations/083_mrv_mirror_node_registry_gate.sql` concerns Guardian/Hedera issuance gating, not async mirror queue storage.

This means the synthetic inbox rows' owning seed/test code is not present in the current candidate branch. Do not add guessed queue-worker code or fabricate a historical migration under the numbered migration directory. Keep the catalog reconstruction as documentation until a trustworthy source artifact is recovered or an independently reviewed new migration is authored.


## Recovery checkpoint update — 2026-10-28 15:58 UTC

- Latest CI for this checkpoint branch completed successfully: [run 40720538325](https://github.com/vishaltradewinds/rupaykg/actions/runs/40720538325), commit `1591450348564794324d17c8688ea1c72f209f5b`.
- The preceding documentation checkpoints also passed CI: [run 40720462052](https://github.com/vishaltradewinds/rupaykg/actions/runs/40720462052) and [run 40720257060](https://github.com/vishaltradewinds/rupaykg/actions/runs/40720257060).
- No database writes were performed. PR #107 remains unmerged; live migration compatibility remains unproven and production certification stays **HOLD**.


## Branch compatibility decision — do not merge the feature branch wholesale

GitHub compare between `shakti/migration-ledger-orphan-guard` and `intelligence/ai-evidence-intake-middleware` reports **diverged**: feature branch is 558 commits ahead and 19 commits behind the migration-ledger branch (comparison API result at 2026-10-28). The feature branch adds the four recovered migration files, worker/routes/scheduler code, integration tests, and additional October/November migrations; it is not a small isolated source-recovery patch.

**Decision:** do not merge or cherry-pick the feature branch wholesale. First extract a minimal, reviewable patch set, reconcile all intervening schema dependencies and migration ordering, and run it against disposable fixtures. The `20261101_async_mirror_unresolved_crosswalk.sql` fix is dated after this audit date and must be treated as a future-dated branch artifact requiring chronology and release-history verification, not as an already-applied live correction.

## Latest documentation CI result

- Commit `61316fd03eec69dbbfef7fa797aabcf7374e1380`: CI passed, [run 40722433202](https://github.com/vishaltradewinds/rupaykg/actions/runs/40722433202).
- This pass validates the current migration-ledger branch's checks/build/tests. It does **not** validate merging the diverged worker feature branch or prove live database upgrade compatibility.

## Newly identified release blocker — worker status constraint mismatch

Review of the recovered worker source found a concrete incompatibility that must be resolved before any worker activation:

- `apps/src/async-mirror-worker.ts` writes `status='UNRESOLVED'` when a structurally valid batch has no verified jurisdiction crosswalk or has ambiguous crosswalk candidates (worker source blob `8008f0fa73f0f0a613cfcc1387fe50de51407862`).
- `migrations/20261023_async_mirror_worker_leases.sql` constrains status to `RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY, QUARANTINED` and does **not** allow `UNRESOLVED`.
- The feature branch contains a later migration, `migrations/20261101_async_mirror_unresolved_crosswalk.sql` (blob `4f9776bc449025e795cb0d5c93e8bace9dea280b`), which adds `UNRESOLVED` to the constraint. That migration is dated in the future relative to this audit (2026-10-28) and is not present in the current candidate branch. It is a proposed corrective source, not proof the live staging schema has been fixed.
- The worker unit tests cover unresolved/ambiguous cases using a fake pool, which does not enforce PostgreSQL CHECK constraints. A disposable-PostgreSQL integration test must explicitly exercise this state against the exact migration chain. A passing unit test alone is insufficient.

**Disposition:** treat the unresolved-status path as a release blocker. Do not enable the scheduler or port worker code into the release candidate until the status constraint is reconciled via a correctly ordered, reviewed migration and a real PostgreSQL integration test proves that both unresolved and normal state transitions work. Do not edit already-applied historical migrations in place. Production/staging remain untouched.

## Recovery checkpoint update — 2026-10-28 16:03 UTC

All four source migration files and the async mirror worker implementation/tests have been located on feature branch `intelligence/ai-evidence-intake-middleware`. This closes the source-discovery gap, but not the release compatibility gate. CI passed for the prior report commit `77616533d3d6c931f530e7f62799af777eb01306` ([run 40721501835](https://github.com/vishaltradewinds/rupaykg/actions/runs/40721501835)); this report update itself requires its own CI run. PR #107 remains draft/open. No database writes were performed; production certification remains **HOLD**.


## CI follow-up — 2026-10-28 16:04 UTC

CI run [40722267160](https://github.com/vishaltradewinds/rupaykg/actions/runs/40722267160) is running for report commit `bc84541c6e4efe17d4e2ec27d92ae7f7c38acfdb`; final status not yet confirmed. Previous report commit `77616533d3d6c931f530e7f62799af777eb01306` passed CI in [run 40721501835](https://github.com/vishaltradewinds/rupaykg/actions/runs/40721501835).
