# Government inbox migration compatibility reconciliation — 2026-10-31

## Scope

Read-only review of the current worker implementation and migration files on `shakti/integrate-government-inbox-worker-2026-10-31`, compared with live Neon staging/production catalog observations recorded in `GOVERNMENT_INBOX_DATABASE_GATE_2026-10-31.md`.

No SQL migration was applied. No production/staging data or queue leases were changed.

## Corrected dependency chain

The worker's jurisdiction-resolution query is not satisfied by the first crosswalk migration alone. Its actual schema dependencies are:

1. `20261030_explicit_geography_scope.sql`: defines `organization_has_explicit_geography_scope(uuid,uuid)`.
2. `20261031_government_jurisdiction_crosswalk.sql`: creates `government_jurisdiction_crosswalk_requests` and `government_jurisdiction_crosswalks`, but does **not** yet add `source_snapshot_id`.
3. `20261101_async_mirror_unresolved_crosswalk.sql`: adds `UNRESOLVED` to the inbox status check.
4. `20261102_government_crosswalk_evidence_binding.sql`: requires crosswalk evidence to bind to immutable evidence-vault content and verified evidence on approved mappings.
5. `20261104_source_snapshot_and_regulatory_rule_versions.sql`: creates `authoritative_source_snapshots` and `regulatory_rule_versions`; it explicitly seeds no source snapshots or rules.
6. `20261105_crosswalk_snapshot_binding.sql`: adds `authority_code` to source snapshots, adds `source_snapshot_id` to crosswalk request/mapping rows, and requires an approved, matching snapshot.
7. `20261107_approved_source_snapshot_immutability.sql`, `20261108_crosswalk_request_expiry_immutability.sql`, and `20261109_source_snapshot_retirement_terminal.sql`: harden snapshot provenance and lifecycle.
8. `20261110_government_source_scope_geography_binding.sql`: adds geography-bound source scope and defines `government_source_scope_covers_geography(uuid,uuid)`; this is also referenced by the worker.
9. `20261111_prevent_approved_source_scope_hierarchy_expansion.sql`: closes hierarchy expansion after a source scope is approved.

The current worker query references `government_jurisdiction_crosswalks.source_snapshot_id`, `authoritative_source_snapshots.authority_code`, and `government_source_scope_covers_geography`. It therefore requires at least migrations 20261030, 20261031, 20261104, 20261105, and 20261110, plus the inbox state migration 20261101 and evidence binding migration 20261102 for the intended governance controls. The additional 20261107–09 and 20261111 hardening migrations are part of the complete safe schema baseline and must not be omitted from the eventual reviewed sequence.

## Important timeline and environment finding

The current date for this checkpoint is 2026-10-31. Migrations dated 20261101 onward are future-dated relative to this checkpoint and are present on the engineering branch as planned schema evolution. They are not evidence that those migrations have been deployed or accepted.

Live staging catalog inspection found the inbox tables but no public tables matching government/crosswalk/authoritative names. Production has no inbox tables. Thus the worker's current SQL cannot run against either live environment. The earlier conclusion that only the 20261031 crosswalk migration was missing was incomplete; the worker is coupled to later source-snapshot and geography-scope migrations too.

## Design risks to resolve before integration tests can pass

### 1. Migration chronology

The schema migration sequence must be tested from a clean disposable PostgreSQL database in filename order. Test both:
- full forward application of all approved migrations that are in-scope for the target release; and
- upgrade from an exact production-derived baseline.

Do not apply future-dated migrations to live databases or backfill migration-ledger entries to make the ledger appear consistent.

### 2. No source data is seeded

The source-snapshot migration explicitly creates no approved source snapshots or regulatory rules. The crosswalk migration also deliberately creates no real authority mappings. The worker should therefore return/retain `UNRESOLVED` when no approved source snapshot and independently reviewed crosswalk exist. It must not fabricate LGD codes, authority mappings, dataset coverage, or approvals to make tests pass.

### 3. Crosswalk cardinality and time windows

The partial unique index on (authority_code, municipal_code, source_version) applies only to VERIFIED rows with `effective_to IS NULL`. Historical closed intervals can overlap unless separately prohibited. The worker's `LIMIT 2` detects more than one currently eligible row but is not a substitute for a database exclusion/overlap invariant. Add tests for overlapping historical intervals and exact effective-boundary semantics; decide whether the schema should reject overlapping VERIFIED intervals, including bounded intervals.

### 4. Source-scope semantics

`government_source_scope_covers_geography` is a fail-closed scope check. It requires a verified versioned geography directory and LGD for administrative scope types. A source snapshot with missing scope binding must not resolve a crosswalk. This is intentional, but it means pan-India ingestion cannot be represented by a free-text label or an unverified directory.

### 5. Evidence is not government acceptance

The evidence-binding migration ties crosswalk evidence to immutable evidence-vault bytes and verified evidence status. It does not establish that a government source authorized API access, that an external portal accepted a filing, or that the payload is valid MRV. Preserve those separate assurance boundaries.

## Integration-test plan (must run on disposable PostgreSQL)

The following tests are required before worker activation:

- Migration-chain: clean install; production-derived upgrade; migration idempotency only where explicitly supported; fail-fast on missing prerequisite; assert no future migration ledger fabrication.
- Inbox state machine: RECEIVED/RETRY/PROCESSING/VALIDATED/REJECTED/QUARANTINED/UNRESOLVED constraints and valid transitions; ensure PROCESSING rows with expired leases remain untouched until an explicitly authorized worker claims them.
- Concurrent claims: two independent database connections, `FOR UPDATE SKIP LOCKED`, no duplicate live lease.
- Lease fencing: expired lease reclaim, stale worker cannot finalize after new token, lease-expired completion updates affect zero rows.
- Crosswalk resolution: no snapshot, unapproved snapshot, retired snapshot, wrong authority/version, out-of-scope source, no mapping, ambiguous mapping, approved exact mapping, inactive/expired mapping, activity mismatch, evidence not bound, evidence not verified, and scope hierarchy tampering.
- Effective windows: exact start/end boundaries, overlapping open/closed intervals, duplicate current verified mapping, timezone-normalized timestamp comparisons.
- Role denial: worker cannot INSERT/DELETE/TRUNCATE/TRIGGER/DDL, change crosswalk or source approvals, access unrelated tenant evidence/activities, issue credentials, settle funds, or submit Guardian/Hedera messages.
- Audit: inbox event rows remain append-only and payload-free; every status/attempt transition is represented exactly once.
- Fault injection: validator exception, database disconnect, process death after claim, failure during transition, and retry/quarantine boundaries.
- Worker input validation: malformed hash, timestamp, unknown payload fields, maximum records, NUL, malformed authority/municipal IDs.

The current worker still uses independent `pool.query` calls for the exhaustion sweep, claim, mapping lookup, and final status writes. This should be refactored to checked-out client transactions for state-changing phases, with a documented lock order and lease/fencing semantics. External or potentially long-running validation must not hold row locks; the claim transaction should commit before validation, and completion should be a short fenced update. Any reconciliation sweep must be independently bounded and transactionally safe.

## Decision

**HOLD — no production or staging migration, worker role, runtime secret, or worker activation.** Next engineering change should be worker transaction/fencing hardening plus a dedicated disposable PostgreSQL integration harness. Do not treat future-dated migrations as deployed schema.
