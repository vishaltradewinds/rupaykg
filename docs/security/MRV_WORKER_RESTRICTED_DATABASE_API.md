# MRV Worker Restricted Database API

Status: DESIGN ONLY. No production grants, role provisioning, migrations or worker activation are authorized.

## Required operations

1. Claim one due job atomically with row locking, SKIP LOCKED, attempt increment and a fresh lease token.
2. Re-authorize against live organization, identity, membership, role permission, activity, evidence, independent verification, geography and source measurements.
3. Persist Guardian idempotency binding under the current lease only.
4. Persist Hedera network, topic and transaction binding under the current lease only.
5. Renew a live lease using the matching token only.
6. Advance only through the explicit state machine; append an immutable event in the same transaction.
7. Release only the matching live lease with bounded retry metadata.
8. Finalize provenance and complete the job atomically after reauthorization and digest reconciliation.

## Minimum privilege boundary

The dedicated worker login must not own tables or functions, inherit other roles, bypass row security, create objects, or be a member of owner/elevated roles. It must have no direct table SELECT, INSERT, UPDATE, DELETE or TRUNCATE grants. It receives EXECUTE only on the narrowly scoped worker functions. PUBLIC execution is revoked. Functions are owned by a non-login migration owner, use a fixed safe search path, fully qualify referenced objects, avoid dynamic SQL, validate inputs and enforce tenant/geography scope and lease fencing inside PostgreSQL.

Do not add broad cross-tenant RLS policies to make the worker operational. System-level queue processing is permitted only through the narrowly scoped database functions, which re-check authorization for each job at decision time.

## Source data requiring consistent authorization snapshot

The existing worker authorization reads organizations, identities, organization_memberships, roles, activities, evidence, verifications, geography scope, mrv_observations, measurements and mrv_submission_jobs. It compares deterministic ordered observation and evidence snapshots and the latest measurement to the immutable enqueue payload. All reads must occur in one consistent database snapshot and fail closed on missing, changed or ambiguous data.

## Required PostgreSQL acceptance tests

- Direct table reads and writes are denied to the runtime login across source, job, event and provenance tables.
- Only approved worker functions can be executed by the runtime login; PUBLIC and unrelated roles cannot execute them.
- Cross-tenant identifiers, revoked membership, revoked permission, invalid geography, changed evidence and changed measurements are denied.
- Concurrent claimers cannot obtain two active leases for the same job.
- Expired or stale lease tokens cannot renew, release, advance, persist provider bindings or finalize.
- Repeated provider responses are idempotent; conflicting bindings are quarantined.
- Guardian, Hedera and Mirror Node calls remain outside database transactions.
- Provenance insertion and job completion are atomic; event and provenance records are append-only.
- Function ownership, execution grants and fixed search path are verified from PostgreSQL catalogs, including hostile caller-controlled schema objects.
- Full migration chain is tested from an empty disposable database and the supported prior schema.

## Existing implementation gaps

The worker's current direct SQL design must be replaced by a typed API client. Its preflight list must include mrv_observations and measurements while direct reads remain in place. Once the function-only API exists, remove the direct-read preflight rather than granting broad reads. The worker privilege query's escaped newline defect has been corrected in source; exact-head CI validation remains outstanding.

## Release gate

No runtime role provisioning, grants, production migration, worker enablement or TRL certification until the function API, TypeScript refactor, disposable PostgreSQL acceptance tests and independent DBA/security review are complete.