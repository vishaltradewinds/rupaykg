# Staging-only migrations 20261022–20261025 — schema fingerprint evidence

**Classification:** read-only schema introspection of a non-authoritative Neon staging branch. This is a schema fingerprint, NOT recovered migration source and NOT a migration script. Do not copy this snapshot into `migrations/` or execute it.

## Target and provenance
- Neon project: `steep-mud-79906940`
- Branch: `br-spring-hill-b4544vz5` (`rupaykg-gov-inbox-staging-20261020`)
- Database: `rupaykg`
- Inspection date: 2026-11-04
- All queries were catalog-only SELECTs. No writes or branch operations.

## Ledger evidence
The staging branch's `public.schema_migrations` contains all four entries, each with the same recorded application timestamp `2026-10-20T10:48:38.647Z`:
- `20261022_async_mirror_inbox.sql`
- `20261023_async_mirror_worker_leases.sql`
- `20261024_ai_intake_rate_limits.sql`
- `20261025_ai_evidence_intake_jobs.sql`

GitHub commit search for each exact migration identifier returned no commits in the repository. This is a negative search result, not proof that no other external backup or branch contains the source.

## Object inventory

### Tables and columns

`public.async_mirror_inbox`
- `id uuid NOT NULL DEFAULT gen_random_uuid()`
- `authority_code text NOT NULL`
- `municipal_code text NOT NULL`
- `batch_id uuid NOT NULL`
- `sync_window_timestamp timestamptz NOT NULL`
- `payload jsonb NOT NULL`
- `payload_sha256 bpchar NOT NULL`
- `status text NOT NULL DEFAULT 'RECEIVED'`
- `attempts int4 NOT NULL DEFAULT 0`
- `last_error_code text`
- `received_at timestamptz NOT NULL DEFAULT now()`
- `processed_at timestamptz`
- `lease_token uuid`
- `lease_until timestamptz`
- `next_attempt_at timestamptz`
- `quarantined_at timestamptz`
- `validation_summary jsonb`

`public.async_mirror_inbox_events`
- `id int8 NOT NULL DEFAULT nextval('async_mirror_inbox_events_id_seq')`
- `inbox_id uuid NOT NULL`
- `authority_code text NOT NULL`
- `municipal_code text NOT NULL`
- `batch_id uuid NOT NULL`
- `from_status text`
- `to_status text NOT NULL`
- `attempt int4 NOT NULL`
- `payload_sha256 bpchar NOT NULL`
- `error_code text`
- `occurred_at timestamptz NOT NULL DEFAULT now()`

`public.ai_intake_rate_limits`
- `identity_id uuid NOT NULL`
- `organization_id uuid NOT NULL`
- `window_start timestamptz NOT NULL`
- `request_count int4 NOT NULL`

`public.ai_evidence_intake_jobs`
- `id uuid NOT NULL DEFAULT gen_random_uuid()`
- `identity_id uuid NOT NULL`
- `organization_id uuid NOT NULL`
- `idempotency_key varchar NOT NULL`
- `request_sha256 bpchar NOT NULL`
- `status text NOT NULL DEFAULT 'PROCESSING'`
- `source_evidence_id uuid`
- `proposal_evidence_id uuid`
- `response_json jsonb`
- `attempt_count int4 NOT NULL DEFAULT 1`
- `lease_token uuid NOT NULL DEFAULT gen_random_uuid()`
- `lease_expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes'`
- `last_error_code text`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`
- `completed_at timestamptz`

## Constraints and indexes

### async_mirror_inbox
- PK `(id)`
- UNIQUE `(authority_code, batch_id)`
- CHECK authority code length 2–80; municipal code length 2–100
- CHECK payload hash matches lowercase 64-hex SHA-256
- CHECK attempts >= 0
- CHECK status in RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY, QUARANTINED
- Indexes: due retry queue on `(next_attempt_at, received_at)` for RECEIVED/RETRY; expired PROCESSING lease on `lease_until`; status/received time.

### async_mirror_inbox_events
- PK `(id)`; FK `inbox_id -> async_mirror_inbox(id)`
- CHECK attempt >= 0 and payload hash lowercase 64-hex
- Index `(inbox_id, occurred_at)`
- BEFORE UPDATE OR DELETE trigger calls `prevent_async_mirror_inbox_event_mutation()`, which raises append-only exception.
- AFTER INSERT OR UPDATE on inbox calls `record_async_mirror_inbox_event()`; it records INSERT or status/attempt changes, including authority/municipal/batch, old/new status, attempt, hash, and error code.

### ai_intake_rate_limits
- PK `(identity_id, organization_id, window_start)`
- FK identity -> identities(id) ON DELETE CASCADE
- FK organization -> organizations(id) ON DELETE CASCADE
- CHECK request_count between 1 and 10
- Index on `window_start`.

### ai_evidence_intake_jobs
- PK `(id)`
- UNIQUE `(identity_id, organization_id, idempotency_key)`
- FKs identity -> identities(id), organization -> organizations(id), source_evidence/proposal_evidence -> evidence(id), all ON DELETE RESTRICT
- CHECK request SHA-256 lowercase 64-hex
- CHECK attempt_count between 1 and 100
- CHECK status in PROCESSING, RETRYABLE_FAILED, COMPLETED
- CHECK COMPLETED iff completed_at is non-null; COMPLETED requires response_json.
- Indexes: organization/updated descending; lease expiry for non-COMPLETED recovery.

## Security and ownership observations
All four staging tables are owned by `rupaykg`. All four report RLS disabled and FORCE RLS disabled. No policies were found on these tables. The two mirror inbox triggers execute as invoker (not SECURITY DEFINER). This staging branch is not authoritative and is not evidence of production deployment or production security posture.

## Exact source recovery status
**NOT RECOVERED.** The catalog contains the applied schema effects, not the original SQL text. A schema reconstruction would be lossy: it cannot reliably recover original statement ordering, comments, transactional boundaries, exact source text, intermediate alterations, migration runner semantics, or checksums. Do not fabricate source files from this fingerprint.

## Required recovery steps
1. Search all accessible Git refs, PR patches, Actions artifacts, deployment bundles, CI caches and approved backups for exact migration files.
2. Obtain original SQL and hashes from the staging deployment artifact or migration author/source control; verify each against the deployed schema effects.
3. Compare source to the schema fingerprint above in an isolated disposable PostgreSQL instance.
4. Inspect the application code that references these objects and determine whether staging features are abandoned, active, or need a forward-only migration plan.
5. Keep staging objects isolated from production. No production DDL, ledger edits, replay, or migration is authorized.
