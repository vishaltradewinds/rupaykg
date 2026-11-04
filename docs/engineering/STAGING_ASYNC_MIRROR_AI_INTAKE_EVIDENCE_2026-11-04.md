# Staging-only async mirror and AI intake schema evidence — 2026-11-04

**Environment:** Neon project `steep-mud-79906940`, branch `br-spring-hill-b4544vz5` (`rupaykg-gov-inbox-staging-20261020`), database `rupaykg`.  
**Method:** read-only catalog and aggregate queries. Payload JSON was not read or exported.  
**Disposition:** non-authoritative staging evidence only; not production migration source and not a release acceptance environment.

## Ledger evidence

Staging ledger contains:
- `20261022_async_mirror_inbox.sql` applied at `2026-10-20T10:48:38.647Z`;
- `20261023_async_mirror_worker_leases.sql` applied at the same timestamp;
- `20261024_ai_intake_rate_limits.sql` applied at the same timestamp;
- `20261025_ai_evidence_intake_jobs.sql` applied at the same timestamp.

These four migration files are absent from current GitHub `main` tree and were not recovered from repository branch/commit searches during this run. The catalog below is reconstructed from the live staging schema; it is **not** an exact reconstruction of original migration SQL.

## Observed tables and schema characteristics

### `async_mirror_inbox`
- Global/source-ingestion shaped table: no `organization_id` column.
- Fields include UUID id, authority_code, municipal_code, batch_id, sync_window_timestamp, payload JSONB, payload_sha256, status, attempts, last_error_code, received_at, processed_at, lease_token, lease_until, next_attempt_at, quarantined_at and validation_summary.
- Unique key on `(authority_code, batch_id)`; status check allows RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY and QUARANTINED.
- Indexes support due retries, expired PROCESSING leases, status/received ordering.
- AFTER INSERT OR UPDATE trigger writes status/attempt transitions to `async_mirror_inbox_events`.

### `async_mirror_inbox_events`
- Append-only event table with inbox_id, authority_code, municipal_code, batch_id, from_status, to_status, attempt, payload_sha256, error_code and occurred_at.
- FK to inbox row; append-only BEFORE UPDATE OR DELETE trigger rejects mutation.
- Time index on `(inbox_id, occurred_at)`.

### `ai_intake_rate_limits`
- Composite primary key `(identity_id, organization_id, window_start)`.
- Identity and organization foreign keys; request_count constrained to 1–10.
- Index on window_start.

### `ai_evidence_intake_jobs`
- Tenant-scoped job record with identity_id, organization_id, idempotency_key, request_sha256, status, source_evidence_id, proposal_evidence_id, response_json, attempt_count, lease_token, lease_expires_at, last_error_code, created_at, updated_at and completed_at.
- FKs to identity, organization and source/proposal evidence; unique key `(identity_id, organization_id, idempotency_key)`.
- Status constrained to PROCESSING, RETRYABLE_FAILED, COMPLETED; attempt_count constrained 1–100; COMPLETED requires completed_at and response_json.
- Recovery index on lease_expires_at for non-completed jobs; organization/update index.
- No user-defined triggers were observed on this table.

## Isolation and ownership evidence

All four tables are owned by `rupaykg`. All four have RLS disabled and FORCE RLS disabled. This staging branch therefore does not provide tenant-isolation assurance. The inbox is global/source-scoped rather than tenant-scoped; downstream processing must establish authoritative authority/municipal/source validation and explicit organization mapping before creating tenant business records.

## Staging data-state snapshot

- `async_mirror_inbox`: 12 rows, all `authority_code=TEST-AUTH` and `municipal_code=TEST-MUNI`.
- `async_mirror_inbox_events`: 29 rows.
- `ai_intake_rate_limits`: 0 rows.
- `ai_evidence_intake_jobs`: 0 rows.
- Inbox statuses: 8 PROCESSING, 1 QUARANTINED, 1 RECEIVED, 1 RETRY, 1 VALIDATED.
- All 8 PROCESSING rows have expired leases. Lease expiry timestamps are approximately 2026-10-20 10:17 UTC; no subsequent status transition was observed.
- The one RETRY row has `next_attempt_at=2026-10-20T10:18:22.414Z`, already due; no later event was observed.
- The one QUARANTINED row reached `WORKER_ATTEMPTS_EXHAUSTED` after 5 attempts.
- The VALIDATED row completed at `2026-10-20T10:11:13.813Z`.
- All observed rows are clearly test-labelled. This does not prove a live government-authority integration or a production worker.

## Worker and operational interpretation

The schema has lease/recovery fields and indexes, and inbox events show a short-lived test sequence with claims, retries and quarantine. However:
- current GitHub `main` has no source files whose paths identify async mirror inbox, AI intake, worker or lease processing (the only matching path is the unrelated Guardian MRV Mirror Node migration);
- no user-defined trigger exists on `ai_evidence_intake_jobs`;
- no independent live worker deployment, scheduler, queue consumer, heartbeat, retry recovery, dead-letter handling or operational alerting was proven by this staging catalog.
- Expired PROCESSING leases and a due RETRY row indicate abandoned staging test work, not evidence of a running, healthy worker.

## Required recovery and assurance

1. Recover exact original SQL and application/worker source from deployment artifacts, container images, build logs or source-control history; do not synthesize a migration from catalog state and claim it is original.
2. Identify the intended authoritative owner and supported use of all four tables. Determine whether these migrations were ever deployed outside this staging branch.
3. Recover worker source and deployment configuration; prove one worker owner, lease fencing/token validation, SKIP LOCKED claim semantics, bounded retries/backoff, idempotency, quarantine replay controls, stale lease recovery and observability.
4. For the global inbox, require signed/authenticated source authority, replay protection, payload digest verification, municipal mapping and explicit provenance before tenant projection. Never infer tenant ownership from untrusted payload fields.
5. For tenant AI jobs and rate limits, require organization-scoped authorization and RLS policies; test pooled transaction context and cross-tenant negative cases under a non-owner runtime role.
6. Add acceptance tests for expired lease recovery, concurrent claim exclusion, stale worker token rejection, crash-after-claim, retry exhaustion, duplicate idempotency keys, source/proposal evidence ownership and tenant mismatch.
7. Keep these tables and staging branch outside production release scope until exact source, independent review and a disposable clone rehearsal are complete.

No staging data or schema was changed. Production remains READ-ONLY / HOLD. This evidence does not establish worker readiness, operational acceptance, production certification or TRL 9.
