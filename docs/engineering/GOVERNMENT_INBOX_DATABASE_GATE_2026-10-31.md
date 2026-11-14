# Government inbox worker database gate — 2026-10-31

## Decision

**HOLD — worker remains OFF.** This inspection was read-only. No database rows, schema, grants, roles, secrets, deployments, or queue leases were changed.

## Environment reconciliation

Neon project `steep-mud-79906940` currently lists only:
- production/default branch `br-restless-base-b44cip2h` (`main`)
- staging branch `br-spring-hill-b4544vz5` (`rupaykg-gov-inbox-staging-20261020`)
- staging-derived branch `br-broad-glade-b46npw8o` (`shakti-unresolved-migration-rehearsal-20261028`)

The previously referenced production-derived rehearsal `br-frosty-term-b47k7ayc` is not present in the current branch listing; the Neon API returned branch-not-found. Do not assume that branch still exists.

Production database `rupaykg` has neither `async_mirror_inbox` nor `ai_evidence_intake_jobs`. The staging database `rupaykg` has both. The production schema is therefore not ready for this worker and must not be migrated merely to make the worker run.

## Staging schema findings (catalog inspection only)

### async_mirror_inbox
Columns: id, authority_code, municipal_code, batch_id, sync_window_timestamp, payload, payload_sha256, status, attempts, last_error_code, received_at, processed_at, lease_token, lease_until, next_attempt_at, quarantined_at, validation_summary.

Constraints include unique (authority_code,batch_id), hash format, length bounds, attempts >= 0, and status check limited to RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY, QUARANTINED.

Indexes include due queue, expired lease, status/received, and primary/unique indexes.

An AFTER INSERT OR UPDATE trigger `async_mirror_inbox_event_after_change` calls `record_async_mirror_inbox_event()`.

RLS is disabled and not forced. The `rupaykg` grant set includes DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE. This is not an acceptable least-privilege worker grant set.

### ai_evidence_intake_jobs
Columns include identity_id, organization_id, idempotency_key, request_sha256, status, evidence pointers, response_json, attempt_count, lease_token, lease_expires_at, error and lifecycle timestamps.

Constraints enforce idempotency, bounded attempts, valid hash, supported statuses PROCESSING/RETRYABLE_FAILED/COMPLETED, completion timestamp/response consistency, and restrictive foreign keys.

RLS is disabled and not forced. The `rupaykg` grant set also includes broad DELETE/TRIGGER/TRUNCATE privileges. This table is outside the government inbox worker's required scope and must not be granted to that worker.

## Blocking incompatibilities

1. **Status enum/check mismatch:** staging's `async_mirror_inbox_status_check` does not include `UNRESOLVED`, but the current worker writes status `UNRESOLVED` for missing or ambiguous jurisdiction mappings. That path will fail with a check-constraint violation unless a separately reviewed migration reconciles the state model. The prior rehearsal branch with an UNRESOLVED constraint is no longer listed; its existence cannot be assumed.
2. **Crosswalk schema absent in staging:** worker SQL references `government_jurisdiction_crosswalks`, `authoritative_source_snapshots`, `organization_has_explicit_geography_scope`, and `government_source_scope_covers_geography`. Catalog inspection found no public tables matching government, crosswalk, or authoritative naming in the current staging branch. The referenced objects therefore need explicit reconciliation before any worker execution.
3. **Production lacks inbox tables entirely:** worker cannot be deployed against production until a separately approved, production-safe schema migration and rollback/restore plan exist.
4. **Broad existing DB role:** staging's observed `rupaykg` role has destructive table privileges; it must not be reused as a worker identity.
5. **Runtime identity remains unknown:** Render's actual deployed database login/effective role has not been established. No grant design can be finalized until that evidence is obtained.
6. **Queue lease safety:** preserve all existing PROCESSING rows, including expired leases. No reset, replay, quarantine, or worker execution was performed.

## Required next gates

1. Reconcile the deployed branch inventory and create/use a clearly identified disposable database rehearsal only with a controlled compute/cost decision.
2. Reconcile worker SQL references against actual migrations and the current schema; specifically resolve the crosswalk/source snapshot tables and geography/scope functions.
3. Define the inbox state machine, including whether UNRESOLVED is a valid persisted terminal/manual-review state; migration and transition tests must agree.
4. Build real PostgreSQL integration tests for concurrent claims, expired-lease reclaim, stale fencing, failure/retry/quarantine, unresolved transitions, crosswalk ambiguity/version/effective dates, and denial of unrelated tenant/evidence/credential/settlement access.
5. Establish Render runtime identity using the protected read-only diagnostic endpoint; do not infer from repository or Neon role names.
6. Create a separate worker principal only in a disposable rehearsal first, with narrowly scoped SELECT and column-level UPDATE/EXECUTE rights. Verify negative permissions.
7. Obtain independent review and explicit deployment approval before any production migration, secret change, scheduler, or worker activation.

## Assurance boundary

A successful structural/jurisdictional validation is not a government filing, CPCB acceptance, statutory verification, MRV approval, carbon-credit issuance, or Guardian/Hedera submission. Worker activation and all external side effects remain prohibited pending the gates above.
