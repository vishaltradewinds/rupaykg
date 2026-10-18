# MRV Evidence Vault — Engineering Gate

**Status:** Implemented on branch for CI review; not yet production-approved.  
**Scope:** Small, organization-scoped evidence files attached to existing operational activities. The vault does not replace the canonical waste/resource-flow ledger.

## API

- `POST /api/v1/evidence-vault/upload`: authenticated evidence upload.
- `GET /api/v1/evidence-vault/:evidenceId`: download a stored evidence artifact.
- `POST /api/v1/evidence-vault/:evidenceId/review`: append a review decision.

Uploads require the active organization's `evidence:upload` permission and an activity inside its authorized geography. Downloads require evidence read/upload/review permission. Reviews require `evidence:review`, the existing evidence-verification permission check, and geography scope. Client uploads cannot set a verified status.

## Storage and provenance

The first implementation stores file bytes in PostgreSQL `bytea`, with a hard 5 MiB per-file limit, allowlisted PDF/JPEG/PNG/CSV/plain-text/JSON media types, basic signature/content checks, SHA-256, source reference, measurement period, uploader identity, and version number. Each upload creates an existing RupayKg `evidence` record and an immutable `evidence_artifact_versions` row. A returned `seriesId` is used to add a later version to the same logical evidence series. Versions and review events cannot be updated or deleted by ordinary SQL updates/deletes.

This bounded database-backed store is a functional foundation, not a claim of large-scale object storage, malware scanning, OCR, legal admissibility, or production retention certification. Capacity, backup/restore, encryption-at-rest configuration, malware scanning, and retention/deletion policy require explicit production decisions before large-scale use.

## Review semantics

A reviewer must supply APPROVED or REJECTED plus a rationale. The decision is recorded in append-only `evidence_artifact_reviews` and the existing `verifications` table; the linked evidence status is updated within the same transaction. A reviewed artifact is not re-reviewed in place; upload a new version and review that version. A successful review proves only that an authorized RupayKg reviewer recorded a decision; it does not imply ACVA validation, CCTS approval, or CCC issuance.

## Test and release gates

Unit tests cover file name sanitization, canonical base64/size limits, media-type signatures and JSON validity. CI must also pass migration validation/execution, typecheck, build, API tests, browser smoke, database acceptance, and production container build. Production remains HOLD until tenant/geography authorization, backup/restore, storage capacity, and real pilot acceptance are independently verified.
