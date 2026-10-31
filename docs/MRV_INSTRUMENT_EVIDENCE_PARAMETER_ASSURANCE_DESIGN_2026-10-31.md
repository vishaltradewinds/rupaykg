# MRV Instrument Evidence and Parameter Assurance Design

**Date:** 2026-10-31  
**Status:** Engineering design / not approved for production  
**Parent implementation candidate:** PR #137  
**Tracking issue:** #50  
**Design rule:** No instrument, artifact, parameter, measurement, or MRV observation is eligible merely because a text reference or hash-shaped string is present.

## 1. Current-source audit

This design was prepared against current `main` plus the exact PR #137 candidate branch. It is intentionally additive and does not change live databases.

### Existing evidence-vault contract

Migration `20261021_evidence_artifact_vault.sql` provides:

- `evidence_artifact_series`: organization and activity scope, evidence type, creator.
- `evidence_artifact_versions`: immutable version UUID, evidence UUID, version number, byte length, SHA-256, stored bytes, uploader and source metadata.
- `evidence_artifact_reviews`: artifact-version UUID, evidence UUID, reviewer, APPROVED/REJECTED decision and rationale.
- Immutable artifact-version and append-only review triggers.
- Canonical evidence pointer and hash binding to the immutable artifact version.

The evidence-vault review route checks organization/geography permission, independent reviewer permission, uploader/reviewer separation, stored bytes length and SHA-256 on download, then writes the review row and updates evidence status to VERIFIED or REJECTED in one transaction. A reviewed evidence row cannot be reviewed a second time through that route; a new artifact version is the correction path.

### Existing instrument approval contract

PR #137 migrations 088/089 provide exact manufacturer/model/SKU identity, organization-scoped instrument register, supported parameter codes, text evidence references and SHA-256 strings, approval decision snapshots, and measurement-to-instrument binding.

**Gap:** The approval route accepts evidence-reference strings and syntactically valid SHA-256 values. It does not resolve the reference to an exact `evidence_artifact_versions.id`, prove same-organization ownership, require a matching independent APPROVED review, or recompute the stored bytes hash at the moment the instrument is approved.

### Existing observation lineage gap

The original `mrv_observations` table (migration 007) has nullable `measurement_id` and free-text `instrument_id`, plus parameter code/value/unit. PR #137 binds `measurements` to `mrv_instruments.id` and a parameter code, but its MRV submission gate currently reads `mrv_observations.instrument_id` as an instrument code.

**This is a material lineage discontinuity:** a verified `measurements.mrv_instrument_id` does not by itself prove that the MRV observation submitted to Guardian refers to that same measurement, instrument UUID, parameter specification, or evidence version. The submission gate must consume one canonical binding rather than independently trusted text identifiers.

## 2. Canonical evidence binding

For each instrument approval evidence role, persist an exact artifact-version UUID:

- MeitY / applicable product approval artifact.
- Calibration certificate artifact (when calibration is required).
- Firmware / cybersecurity lifecycle review artifact (when firmware exists).

The instrument row should hold explicit nullable foreign keys (or a normalized role table) to `evidence_artifact_versions.id`; free-text references remain descriptive metadata only and must never authorize approval.

At approval time, in one database transaction:

1. Lock the instrument row and every referenced artifact/version and review/evidence row in a consistent order.
2. Resolve each artifact version through `evidence_artifact_versions` → `evidence_artifact_series` and `evidence`.
3. Require series organization to equal the instrument organization; require evidence activity to belong to that same organization.
4. Require the exact version's evidence row to be VERIFIED and the exact version's review record to be APPROVED, with reviewer distinct from uploader and instrument registrant where separation-of-duties rules apply.
5. Recompute SHA-256 over the retrieved `content` bytes in the application using Node crypto; compare it to the immutable version's `sha256`, its `size_bytes`, and actual byte length. Do not trust caller-supplied hashes.
6. Verify artifact role, evidence type, exact manufacturer/model/SKU revision and certificate scope against the official source. A stored PDF or hash is evidence to review, not proof that an issuing authority genuinely issued it.
7. Persist exact artifact-version IDs, evidence IDs, hashes, byte lengths, review IDs/reviewer IDs, and the instrument identity/version into the append-only approval decision snapshot.
8. Reject missing, cross-tenant, unreviewed, rejected, inconsistent, substituted or hash-mismatched artifacts. Do not fall back to legacy text references.

Because artifact versions are immutable and reviews are append-only, later correction is a new artifact version plus a new instrument decision. If the business needs formal revocation, add an explicit append-only revocation/supersession event; do not edit or delete a past review.

## 3. Versioned parameter specification

Create an organization- and instrument-scoped parameter specification model. Each revision must have:

- Stable specification UUID and monotonically increasing revision number.
- Instrument UUID and canonical parameter code.
- Canonical unit identifier (not free-form unit aliases).
- Inclusive/exclusive lower and upper bounds, with explicit null semantics only where the methodology permits unbounded ranges.
- Resolution / quantization step and permitted decimal scale.
- Accuracy or maximum permissible error, numeric value and declared basis (for example absolute, relative, percent of reading, percent of full scale); no ambiguous bare number.
- Measurement conditions and operating envelope as structured, versioned fields (temperature, pressure, flow regime, sensor range, installation orientation, or other parameter-specific conditions only when relevant).
- Effective-from and effective-until timestamps, status (DRAFT, VERIFIED, SUPERSEDED, REJECTED), independent reviewer and append-only decision history.
- Supporting reviewed evidence artifact-version IDs when the specification is based on manufacturer datasheet, type approval, calibration or methodology evidence.

A verified revision is immutable. A changed range, unit, accuracy, resolution, condition or evidence set creates a new revision. A measurement must pin the exact verified specification UUID/revision used at capture time. No silent “latest spec” reinterpretation of historical measurements.

### Numeric rules

- Persist physical values as PostgreSQL NUMERIC; never use floating-point comparisons for range or resolution enforcement.
- Reject non-finite, missing, over-precision or out-of-range values.
- Require exact canonical unit equality at ingestion.
- Do not perform implicit conversion. Any future conversion must be an explicit, versioned, reviewed conversion rule with dimensional compatibility and tests.
- Define whether resolution is a decimal quantum or an instrument increment; validate using exact decimal arithmetic and the specification's declared rule.
- Validate uncertainty against the declared accuracy basis; do not compare unlike quantities or treat a calibration uncertainty as the instrument's accuracy without a documented method.

## 4. One canonical measurement-to-MRV lineage

The ingestion path must resolve and persist:

`activity → measurement → instrument UUID → parameter specification revision → evidence artifact versions`

The Guardian submission path must consume those same persisted identifiers.

Required changes:

1. Add exact instrument UUID and parameter-specification revision UUID to `mrv_observations`, with foreign keys and consistency checks.
2. Require a non-null `measurement_id` for observations entering an authoritative MRV submission, unless a separately reviewed methodology explicitly permits a non-measurement observation class.
3. Verify the observation's activity equals the measurement's activity; observation parameter, unit and numeric value equal the canonical measurement values (or are linked through an explicit, versioned transformation); instrument UUID equals `measurements.mrv_instrument_id`; and spec revision belongs to that instrument and parameter.
4. Re-run current instrument approval, exact artifact review, calibration validity, firmware/security validity and spec validity at ingestion and immediately before Guardian submission.
5. Build the Guardian payload and integrity hash from the canonical measurement/spec/artifact identifiers and values, not from a parallel free-text `instrument_id`.
6. Keep legacy observations readable for historical analysis but fail closed for new authoritative submission when canonical lineage is absent. Do not auto-backfill from free-text identifiers.
7. Keep corrections append-only: superseding measurements/observations and explicit supersession links, not updates that rewrite measured facts.

## 5. Required migration and implementation sequence

Do not assign a migration filename or apply a migration until the canonical production/staging/rehearsal ledger reconciliation is complete. The next migration number must be chosen from the reconciled ledger, not inferred from the current branch.

Proposed order:

A. **Evidence FK layer:** nullable exact artifact-version foreign keys; same-organization/activity and evidence-role constraints; no destructive rewrite of legacy rows.

B. **Parameter specification layer:** versioned specification and decision tables, immutable verified revisions, append-only decisions, exact numeric bounds and units.

C. **Ingestion enforcement:** direct measurement, offline field sync and any MRV observation creation path use the same database-backed validator and pin exact spec revision.

D. **Submission enforcement:** MRV/Guardian reads canonical observation-measurement lineage, verifies evidence artifacts and specification revision again, and includes identifiers in payload hash.

E. **Migration/backfill posture:** legacy text-only instruments/observations remain explicitly unqualified. No inferred binding or automatic approval. A controlled human-reviewed migration may bind an old record only where source evidence proves the exact instrument and measurement identity.

## 6. Disposable PostgreSQL acceptance matrix

Every database test must run on disposable PostgreSQL and fail the build if skipped in the dedicated acceptance job.

### Evidence binding
- Same-organization, same-activity, exact artifact version, APPROVED review: accepted.
- Cross-organization artifact, cross-activity artifact, wrong evidence type/role: rejected.
- PENDING, REJECTED, missing or mismatched review: rejected.
- Hash mismatch, byte-length mismatch, stored bytes mismatch: rejected.
- A later artifact version cannot silently replace the pinned version.
- Instrument approval snapshot retains exact artifact-version/review/hash IDs.
- Uploader self-review and registrant self-approval: rejected.
- Review revocation/supersession is explicit and append-only; no historical mutation.

### Parameter specification
- Exact canonical unit accepted; aliases and mismatched units rejected.
- Lower and upper boundaries tested at, just inside and just outside the boundary.
- Resolution and permitted precision boundaries tested using exact decimal arithmetic.
- Accuracy basis mismatch, missing accuracy, impossible uncertainty and invalid conditions rejected.
- Expired, superseded, unreviewed or wrong-instrument spec rejected.
- New revision cannot mutate prior verified revision or historical measurement meaning.

### End-to-end lineage and replay
- Direct and offline sync writes bind the same instrument UUID and spec revision.
- Observation with missing measurement, cross-activity measurement, different instrument, parameter or unit is rejected.
- Guardian submission rejects legacy text-only observation and mismatched lineage.
- Exact replay is idempotent; altered value/spec/evidence produces a different payload hash and cannot reuse stale anchor.
- Tenant isolation, geography scope, role permissions and separation of duties hold across every route.
- No official acceptance, carbon-credit issuance or registry eligibility is inferred from a passing synthetic test.

## 7. Explicit non-goals and release gates

This design does not establish that any device is MeitY/STQC/BIS/WPC/Legal Metrology approved, calibrated, suitable for a particular methodology, or deployed at a real site. Exact applicability must be determined from the actual instrument, intended use, statutory regime and official records.

No purchase, physical commissioning, production migration, deployment, Guardian submission or certification is authorized by this design document. Synthetic tests are never site evidence.

**Current posture:** PR #137 remains draft pending independent review; issue #50 remains open until the evidence binding, parameter specification and canonical MRV lineage gates are implemented and tested. Production HOLD; hardware/site acceptance HOLD; TRL 9 not established.
