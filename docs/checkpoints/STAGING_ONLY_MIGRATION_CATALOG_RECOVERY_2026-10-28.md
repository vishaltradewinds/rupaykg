# Staging-Only Migration Recovery — Catalog Evidence (2026-10-28)

## Purpose and safety boundary

This is a **catalog-derived recovery record**, not a recovered original migration and not executable SQL. It records the schema that currently exists in the staging branch for the four legacy migration families that are absent from the current numbered-migration candidate. It must not be used as authority to apply DDL to production.

Read-only inspection only. No INSERT, UPDATE, DELETE, DDL, migration-ledger changes, or production/staging writes were performed.

## Source recovery result

Source recovery status was rechecked against additional repository branches on 2026-10-28:
- **Recovered:** `migrations/20261024_ai_intake_rate_limits.sql` from branch `intelligence/ai-evidence-intake-middleware`, blob `87b51fe60a96a4e0752c8b0a9a170c81f9936dbb`. The recovered SQL defines the identity/organization/minute composite primary key, request_count 1–10 check, and window_start index; these match the catalog summary recorded below.
- **Recovered:** `migrations/20261025_ai_evidence_intake_jobs.sql` from the same branch, blob `6a0ae54530b7b756dac33589eaf18df3b071d8f2`. The recovered SQL defines the durable idempotency ledger, status/attempt/hash checks, evidence and organization/identity foreign keys, and recovery/organization indexes; these match the catalog summary recorded below.
- **Not recovered:** `migrations/20261022_async_mirror_inbox.sql` and `migrations/20261023_async_mirror_worker_leases.sql`. Exact-path checks across the current migration branch and other relevant mirror/sync branches did not find these files. Searches of commit messages and issues did not surface a source artifact. No CI artifacts were attached to the inspected successful runs.

This narrows the recovery gap from four migrations to two. For 20261022/23, the schema below remains reconstructed from PostgreSQL catalogs on staging only. For 20261024/25, source SQL is recovered from a non-default feature branch but has not yet been independently replay-tested against clean and upgrade fixtures. The feature branch is evidence of source, not proof that its application code is present in the current release candidate. Exact historical grants, RLS policies, ownership, later alterations, and the original semantics of the separate worker-lease filename remain unverified.

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
