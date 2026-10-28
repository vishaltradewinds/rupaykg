# Staging-Only Migration Recovery — Catalog Evidence (2026-10-28)

## Purpose and safety boundary

This is a **catalog-derived recovery record**, not a recovered original migration and not executable SQL. It records the schema that currently exists in the staging branch for the four legacy migration families that are absent from the current numbered-migration candidate. It must not be used as authority to apply DDL to production.

Read-only inspection only. No INSERT, UPDATE, DELETE, DDL, migration-ledger changes, or production/staging writes were performed.

## Source recovery result

Searched GitHub repository history for these exact paths; each path returned no commits:
- `migrations/20261022_async_mirror_inbox.sql`
- `migrations/20261023_async_mirror_worker_leases.sql`
- `migrations/20261024_ai_intake_rate_limits.sql`
- `migrations/20261025_ai_evidence_intake_jobs.sql`

Repository code search also returned no matching files/excerpts for the table names. Therefore the original source SQL is **not recovered**. The schema below is reconstructed from PostgreSQL catalogs on staging only. Exact historical statement ordering, comments, grants, RLS policies, ownership, and any objects that were later altered cannot be inferred from this snapshot.

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

1. Recover original SQL from a trusted backup, developer artifact, CI artifact, deployment bundle, or audit record. If unavailable, treat the catalog reconstruction as a new reviewed migration specification, never as the original migration.
2. Capture full staging definitions and compare all columns, constraints, indexes, sequence ownership, grants, policies, functions, and dependencies against the proposed specification.
3. Create a disposable PostgreSQL fixture representing both the production ledger/schema and staging ledger/schema. Preserve and assert staging inbox/event rows across any proposed upgrade.
4. Test clean install, upgrade from each actual ledger shape, repeated run/idempotence, rollback/recovery, and fail-closed behavior.
5. Obtain independent review before any production/staging DDL or ledger write.

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
