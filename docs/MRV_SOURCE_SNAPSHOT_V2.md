# MRV Source Snapshot v2

## Purpose

Every Guardian/Hedera MRV execution must be reproducible against one immutable, versioned snapshot of the exact source state used by the application. A digest over selected identifiers or the latest measurement alone is insufficient.

## Captured source

The application captures the following in one PostgreSQL \`REPEATABLE READ\` transaction:

- Activity identity, organization, geography, type, lifecycle state, timestamps and metadata.
- Approved verification identity, selected evidence binding, scope, rationale and decision time.
- Every MRV observation, including parameter, value, unit, method, instrument, observation time, uncertainty, quality state and metadata.
- Every measurement, including value, unit, method, source, measured time, quality state and metadata.
- Every activity evidence record, including status, content URI/hash, metadata, artifact version ID/number, SHA-256, media type, byte size and recorded independent reviews.
- Guardian policy and methodology code.

The snapshot JSON uses schema \`rupaykg:mrv-source-snapshot:v1\`; its canonical, key-order-independent SHA-256 digest is stored with the immutable snapshot row.

## Version and correction rules

- First capture creates version 1.
- Repeated submission with the same digest reuses the same snapshot.
- If source data differs from the latest snapshot, submission fails closed unless the caller supplies \`correctionReason\` (10–2000 characters).
- A correction creates a new version linked through \`supersedes_snapshot_id\`; prior snapshots cannot be updated or deleted.
- PostgreSQL validates activity/verification/evidence binding, sequential supersession and source revision equality.
- Database triggers increment the activity source revision when activity context, verification, observations, measurements, evidence, artifact versions or independent reviews change. Credential issuance fails closed if the snapshot revision no longer matches the live activity revision.
- Reverting to an earlier data state still creates a new version linked to the immediately preceding snapshot.

A correction reason explains why the new snapshot supersedes the old one; it does not itself validate the corrected source. Evidence review and methodology controls remain separate requirements.

## Guardian and Hedera binding

- Guardian receives the complete observations, measurements and evidence set plus snapshot ID, version and digest in request metadata.
- Guardian idempotency keys include the source digest so changed inputs cannot reuse an earlier execution key.
- Hedera anchor schema \`rupaykg:mrv:v2\` includes snapshot ID, version and digest. The HCS integrity hash covers those fields.
- Mirror Node verification requires the expected snapshot fields and validates the complete anchored payload hash.
- Provenance persistence rechecks organization permission and geography after provider execution, inside the database write transaction.
- Mirror Node verification rechecks authorization and geography again inside the transaction that persists its verification timestamp.

## Registry gate

Credential issuance requires Guardian VERIFIED, HCS consensus confirmation, persisted Mirror Node verification, and a matching immutable source snapshot that is still the latest version for the activity. A superseded or legacy provenance record cannot satisfy the new gate.

## Important limitations

- This migration and code change do not prove that migration 088 has been applied to the authoritative Neon database.
- Existing v1 provenance remains historical and is not retroactively upgraded or represented as snapshot-bound.
- Source observation and measurement tables are not globally made append-only by this change. Instead, source mutations advance a database revision, making prior snapshots ineligible for new credential issuance until a new correction snapshot and provider anchor are completed. Each MRV execution preserves a complete immutable source snapshot. Independent evidence review remains necessary.
- A source correction after an external Guardian/HCS operation creates a new snapshot and requires a new provider execution and anchor. Existing anchors remain historical evidence for the earlier snapshot.
- No production deployment, live DB migration, RLS activation, external provider configuration or TRL 9 certification is authorized by this implementation.

## API behavior

Submit endpoint: \`POST /api/v1/mrv/activities/:activityId/submit\`

Optional body field:
- \`correctionReason\`: required only when the captured source digest differs from the latest snapshot; 10–2000 characters.

On changed source without a correction reason, the endpoint returns HTTP 409 with code \`MRV_CORRECTION_REASON_REQUIRED\`.
