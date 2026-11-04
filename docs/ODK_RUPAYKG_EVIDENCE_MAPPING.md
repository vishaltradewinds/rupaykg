# ODK → RupayKg Evidence Vault Mapping

**Review baseline:** `main` at `934062ef8af2ca47bbcbf5e37c12de12a4f9f743`  
**Related design:** PR #275 / issue #274  
**Status:** Repository mapping only. No adapter, credentials, database changes, or live ODK connection are implemented.

## 1. Existing RupayKg contracts verified in source

### Evidence Vault

The current API is registered from `apps/src/server.ts` via `registerEvidenceVaultRoutes` and provides:

| Route | Current behaviour | Authorization |
|---|---|---|
| `POST /api/v1/evidence-vault/upload` | Stores file bytes in PostgreSQL `bytea`; creates an `evidence` row and immutable `evidence_artifact_versions` version; returns SHA-256, series/version IDs and `CAPTURED/PENDING` state | Existing RupayKg Bearer session, active organization, activity/geography scope, `evidence:upload` |
| `GET /api/v1/evidence-vault?activityId=...` | Lists artifact versions for one activity | Active organization/geography scope and read/upload/review permission |
| `GET /api/v1/evidence-vault/:evidenceId` | Downloads bytes after stored size/hash verification | Organization/geography scope and read/upload/review permission |
| `POST /api/v1/evidence-vault/:evidenceId/review` | Records APPROVED/REJECTED, reviewer rationale and verification; prevents self-review and repeat review | `evidence:review`, `canVerifyEvidence`, geography scope |

The upload path has a 5 MiB limit, a media-type allowlist, basic signature/content checks and SHA-256. Migration `20261021_evidence_artifact_vault.sql` defines versioned artifact storage and append-only review/version guards.

### Existing field-sync path

`apps/src/sync-routes.ts` provides:

- `POST /api/v1/field-sync/envelopes`: authenticated, verified enrolled field-device identity; idempotency key and client sequence; stores an envelope as RECEIVED.
- `POST /api/v1/field-sync/envelopes/:envelopeId/apply`: only the authenticated identity that owns the envelope can apply it.
- `EVIDENCE_CREATE`: creates an evidence metadata row from a content URI/hash; it does **not** upload or persist binary artifact bytes.
- `MEASUREMENT_CREATE`: creates a measurement linked to an activity.

This path is not an ODK integration as-is. ODK Central is not currently shown as a RupayKg enrolled field device or identity, and the sync envelope does not provide the Evidence Vault binary upload/version contract.

### Identity and tenancy

`apps/src/auth.ts` authenticates opaque Bearer tokens by hashing them and looking up unrevoked, unexpired `identity_sessions`; it then resolves verified organization memberships and active organization selection. Multiple-organization identities must select an organization. Authorization is enforced through membership, permission and geography checks.

There is no verified ODK-specific service-authentication contract in the inspected code. Do not invent a shared static API key, reuse a human token, or create an unreviewed service identity/session as a shortcut.

## 2. Canonical data mapping

| ODK source value | RupayKg target / treatment | Trust rule |
|---|---|---|
| Central project ID | Integration configuration → approved RupayKg organization/site/activity mapping | Never accept a client-supplied organization ID as authority |
| Form ID + form version | Evidence metadata / provenance envelope | Pin allowlisted form IDs and versions; reject unknown versions |
| Submission instance ID | External source reference + idempotency key | Unique per configured project/form; replay with changed payload is a conflict |
| Submitter / enumerator | Source provenance metadata | Record ODK actor reference; map to a RupayKg identity only after verified mapping |
| Submission time | Captured-at/source timestamp | Preserve original timestamp and ingestion timestamp separately |
| GPS | Evidence metadata and validation result | Preserve raw coordinates/accuracy; validate site boundary and capture policy; do not silently snap coordinates |
| Answers / measurements | Quarantined normalized observations; only later create approved activity/measurement records | Form fields do not override approved methodology, units, calibration or sampling rules |
| Attachment bytes | Existing Evidence Vault artifact version after quarantine review | Preserve original bytes, MIME, byte count and independently recomputed SHA-256 |
| ODK review state | Source-system metadata only | Never treat ODK review as RupayKg approval |
| RupayKg reviewer decision | Existing Evidence Vault review endpoint and `evidence_artifact_reviews` | Independent authorized reviewer; uploader cannot self-review |

## 3. Required ingestion state machine

`RECEIVED → VALIDATED → QUARANTINED → ACCEPTED_FOR_REVIEW → VERIFIED / REJECTED`

- **RECEIVED:** preserve the raw ODK submission envelope and source identifiers; do not create authoritative MRV measurements.
- **VALIDATED:** verify configured project/form/version, schema, attachment metadata and hashes, submission timestamps, mapped site/activity, enumerator mapping and geospatial constraints.
- **QUARANTINED:** retain untrusted payload and files in an isolated, access-controlled staging area. No impact on canonical resource flows, measurements, carbon calculations, EPR returns or regulatory reports.
- **ACCEPTED_FOR_REVIEW:** a RupayKg-authorized operator confirms the mapping and evidence package. This is not statutory approval.
- **VERIFIED / REJECTED:** only the existing independent RupayKg review authority records the final evidence review decision and rationale.

Every transition needs actor, timestamp, reason, source reference and append-only audit evidence. Retry must be idempotent; same source key with different payload hash must fail closed.

## 4. Critical implementation gaps — do not bypass

1. **No ODK integration authentication:** define and review a machine-to-machine principal/token lifecycle with narrow organization and route scope, expiry, rotation, revocation and audit. Current human-session authentication is not an integration contract.
2. **No quarantine store/route established:** current Evidence Vault upload immediately creates a canonical `CAPTURED` evidence row. It is not safe to point untrusted ODK submissions directly at it.
3. **No idempotency key on Evidence Vault upload:** the upload route currently creates a new series/version; ODK replay could duplicate artifacts. Add source-system idempotency and payload-hash conflict semantics before adapter writes.
4. **No approved ODK project/form/site mapping:** the mapping must be configuration controlled by RupayKg administrators; never trust form-submitted tenant, organization, facility or activity identifiers.
5. **No binary size/capacity strategy beyond 5 MiB:** ODK attachment batches, malware scanning, storage capacity, backup/restore, retention and privacy/residency need review.
6. **No validated SITE-JBP-01 measurement form:** measurement units, methods, calibration, sampling, GPS tolerance and evidence requirements must be signed off against the applicable approved methodology before field use.

## 5. Recommended next implementation boundary

Build a **non-production, read-only ODK Central connector first**:

1. Use a dedicated ODK Central App User restricted to the specific test project; keep its credential server-side.
2. Pull submissions and attachments into an isolated quarantine/staging area, preserving source IDs, raw payloads, timestamps and file hashes.
3. Validate project/form/version and resolve activity/site only through a pre-approved RupayKg mapping.
4. Produce a validation report and deterministic replay/conflict result; do not write to Neon or call the current Evidence Vault upload route yet.
5. Add the RupayKg machine-to-machine authentication and quarantine API only after threat model, data-flow, privacy and independent security review.
6. After those gates, implement an explicit reviewer-controlled promotion into the existing Evidence Vault; preserve immutable bytes and the source lineage.

## 6. Minimum PoC acceptance tests

- Correct configured project/form/version accepted into quarantine.
- Unknown project, form or version rejected.
- Wrong tenant/site/activity mapping rejected without disclosing another tenant's records.
- Duplicate submission with same hash is idempotent; same source ID with changed hash is a conflict.
- Attachment hash/size/MIME mismatch rejected.
- Invalid GPS, stale/future timestamps and missing required enumerator provenance quarantined or rejected per policy.
- ODK outage and partial attachment download retry without duplicate canonical evidence.
- ODK reviewer state cannot mark RupayKg evidence VERIFIED.
- Only an authorized independent RupayKg reviewer can promote/review; uploader cannot self-review.
- Full traceability from ODK source submission and attachment to RupayKg evidence/version/review.

## 7. Safety boundary

This document records source-code observations and a proposed design. It does not certify current production security, establish legal admissibility, validate SITE-JBP-01 field methods, or authorize live data. No production migration, RLS/role/grant change, worker activation, deployment or production certification is included. Neon remains the single authoritative RupayKg database.
