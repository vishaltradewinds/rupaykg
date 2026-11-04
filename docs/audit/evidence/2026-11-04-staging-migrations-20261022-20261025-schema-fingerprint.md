# Staging-only migrations 20261022–20261025 — schema fingerprint evidence

**Classification:** read-only schema introspection of a non-authoritative Neon staging branch. This is a schema fingerprint, NOT recovered migration source and NOT a migration script. Do not copy this snapshot into `migrations/` or execute it.

## Target and provenance
- Neon project: `steep-mud-79906940`
- Branch: `br-spring-hill-b4544vz5` (`rupaykg-gov-inbox-staging-20261020`)
- Database: `rupaykg`
- Inspection date: 2026-11-04
- All queries were catalog-only SELECTs. No writes or branch operations.

## Ledger evidence
The staging branch's `public.schema_migrations` contains all four entries, each with recorded timestamp `2026-10-20T10:48:38.647Z`:
- `20261022_async_mirror_inbox.sql`
- `20261023_async_mirror_worker_leases.sql`
- `20261024_ai_intake_rate_limits.sql`
- `20261025_ai_evidence_intake_jobs.sql`

GitHub commit search for each exact migration identifier returned no commits in this repository. This is not proof that no external backup or deployment artifact contains the source.

## Object fingerprint

### async_mirror_inbox
Columns: `id uuid PK DEFAULT gen_random_uuid()`; `authority_code text NOT NULL`; `municipal_code text NOT NULL`; `batch_id uuid NOT NULL`; `sync_window_timestamp timestamptz NOT NULL`; `payload jsonb NOT NULL`; `payload_sha256 bpchar NOT NULL`; `status text NOT NULL DEFAULT 'RECEIVED'`; `attempts int4 NOT NULL DEFAULT 0`; `last_error_code text`; `received_at timestamptz NOT NULL DEFAULT now()`; `processed_at timestamptz`; `lease_token uuid`; `lease_until timestamptz`; `next_attempt_at timestamptz`; `quarantined_at timestamptz`; `validation_summary jsonb`.

Constraints: PK id; UNIQUE(authority_code,batch_id); authority code length 2–80; municipal code length 2–100; lowercase 64-hex payload hash; attempts >= 0; status in RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY, QUARANTINED. Indexes: due retry queue (next_attempt_at,received_at) for RECEIVED/RETRY; expired PROCESSING lease (lease_until); status/received time.

### async_mirror_inbox_events
Columns: `id int8 PK DEFAULT nextval(...)`; `inbox_id uuid NOT NULL FK async_mirror_inbox(id)`; `authority_code text NOT NULL`; `municipal_code text NOT NULL`; `batch_id uuid NOT NULL`; `from_status text`; `to_status text NOT NULL`; `attempt int4 NOT NULL`; `payload_sha256 bpchar NOT NULL`; `error_code text`; `occurred_at timestamptz NOT NULL DEFAULT now()`.

Constraints: attempt >= 0; lowercase 64-hex payload hash. Index (inbox_id,occurred_at). BEFORE UPDATE OR DELETE trigger calls `prevent_async_mirror_inbox_event_mutation()`, which raises an append-only exception. AFTER INSERT OR UPDATE on inbox calls `record_async_mirror_inbox_event()`; it records INSERT or status/attempt changes with authority/municipal/batch, old/new status, attempt, hash and error code.

### ai_intake_rate_limits
Columns: `identity_id uuid NOT NULL`; `organization_id uuid NOT NULL`; `window_start timestamptz NOT NULL`; `request_count int4 NOT NULL`. PK(identity_id,organization_id,window_start); FKs identity and organization with ON DELETE CASCADE; CHECK request_count between 1 and 10; index window_start.

### ai_evidence_intake_jobs
Columns: `id uuid PK DEFAULT gen_random_uuid()`; `identity_id uuid NOT NULL`; `organization_id uuid NOT NULL`; `idempotency_key varchar NOT NULL`; `request_sha256 bpchar NOT NULL`; `status text NOT NULL DEFAULT 'PROCESSING'`; `source_evidence_id uuid`; `proposal_evidence_id uuid`; `response_json jsonb`; `attempt_count int4 NOT NULL DEFAULT 1`; `lease_token uuid NOT NULL DEFAULT gen_random_uuid()`; `lease_expires_at timestamptz NOT NULL DEFAULT now()+5 minutes`; `last_error_code text`; `created_at timestamptz NOT NULL DEFAULT now()`; `updated_at timestamptz NOT NULL DEFAULT now()`; `completed_at timestamptz`.

Constraints: PK id; UNIQUE(identity_id,organization_id,idempotency_key); FKs identity, organization, source_evidence and proposal_evidence all ON DELETE RESTRICT; lowercase 64-hex request hash; attempt_count 1–100; status PROCESSING/RETRYABLE_FAILED/COMPLETED; COMPLETED iff completed_at non-null and requires response_json. Indexes organization/updated descending and lease-expiry recovery for non-COMPLETED rows.

## Security/ownership observations
All four tables are owned by `rupaykg`; RLS and FORCE RLS are disabled; no policies were found. The two mirror inbox trigger functions are SECURITY INVOKER. This staging branch is not authoritative and says nothing about production deployment.

## Exact source status: NOT RECOVERED
Catalog introspection cannot recover original SQL byte-for-byte, statement ordering, comments, transactional boundaries, intermediate changes, migration runner semantics, or source checksums. A reconstructed schema script would be lossy and must not be presented as the original migration.

## Required recovery
1. Search accessible Git refs, PR patches, Actions artifacts, deployment bundles, CI caches and approved backups for exact files.
2. Obtain original SQL and hashes from the staging deployment artifact or source owner.
3. Compare exact source with this fingerprint in an isolated disposable PostgreSQL instance.
4. Inspect application references and determine whether these features are active, abandoned, or require a reviewed forward-only plan.
5. Keep staging isolated; no production DDL, ledger edits, replay or migration is authorized.
