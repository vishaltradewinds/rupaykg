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


## 8. Live migration-ledger reconciliation — 2026-10-31

Read-only inspection was performed against Neon project `steep-mud-79906940`, database `rupaykg`, using the recorded production, staging and rehearsal branch IDs. No schema or data was changed.

### 8.1 Observed ledger state

| Environment | Ledger rows | Relevant tail entries |
|---|---:|---|
| Production | 92 | `20261018`–`20261021`, plus `096:096_verification_authorization_provenance.sql` |
| Government inbox staging | 95 | `20261018`–`20261025` |
| Migration rehearsal | 95 | `20261018`–`20261025` |

Production's `096_verification_authorization_provenance.sql` ledger entry has no corresponding migration file in the inspected `main` tree or PR #137 branch. The live production function `prevent_invalid_verification()` confirms this is not an inert ledger row: it enforces organization-scoped VERIFIED membership and identity, non-suspended identity, explicit permission, self-verification prevention, and stores membership ID, role ID, permission snapshot and authorization timestamp on the verification row.

Staging and rehearsal do not have those two authorization snapshot columns and their corresponding function does not persist that snapshot. This production control must be preserved. The missing migration source must be recovered from trusted Git history/release artifact or reconstructed from verified production DDL and independently reviewed; it must not be recreated by guessing.

Staging and rehearsal contain the `20261022`, `20261023`, `20261024` and `20261025` ledger entries and async/AI intake schema objects that are absent from production and absent from the inspected PR #137 branch. The existence of those objects does not establish that their current definitions are authoritative or production-ready. The worker-lease object name must be resolved against the exact migration SQL before any dependency statement is made.

### 8.2 Repository-history discrepancies

- The inspected migration directory contains `023_lifecycle_state_guards.sql`, while `migrations/README.md` says migration 023 is intentionally absent.
- The migration directory contains `027_verification_permission_hardening.sql`, while the README describes `027_verification_permission_guard.sql`.
- The PR #137 branch contains migrations 088 and 089, but neither is recorded in any of the three inspected live ledgers.
- The production-only ledger row 096 is absent from the inspected source tree. The source file must be recovered before the repository can safely claim to represent production migration history.

### 8.3 Migration policy decision

1. Do not renumber 088/089, overwrite 096, delete production-only controls, or copy staging/rehearsal schemas wholesale.
2. Treat the three environments as separate schema histories until every migration source and every out-of-band change is accounted for.
3. Reconstruct a canonical, ordered migration manifest from the union of verified source files and verified applied-ledger records. Each migration must have a unique immutable identity and checksum; filenames alone are insufficient evidence of identical SQL.
4. Recover the exact 096 source and reconcile the production verifier schema/function before any new instrument/evidence migration is assigned a version.
5. Recover and review the exact 20261022–20261025 source files, dependency order and current schema definitions before staging/rehearsal worker work is promoted or replayed.
6. Correct README and migration validation so they validate actual repository history and detect missing applied migration sources, duplicate identities, changed checksums, and unapplied source migrations. Do not make the validator silently accept an unknown applied migration.
7. Only after reconciliation, choose new immutable migration identities for exact artifact-version binding, parameter specifications and canonical MRV lineage. Run fresh-install and upgrade-path tests on disposable PostgreSQL, then perform independent review.

### 8.4 Evidence and limitations

The observations above are direct read-only database results from 2026-10-31. They establish ledger and selected schema/function differences, not a complete byte-for-byte schema equivalence audit. No production writes, staging writes, rehearsal writes, migration execution, worker activation, deployment or certification occurred.

**Release gate:** migration provenance is currently FAIL-CLOSED. PR #137 remains a draft engineering candidate; migrations 088/089 are not authorized for application to any live branch. Production verifier provenance must remain intact.

## 9. Canonical measurement-to-Guardian lineage — source and live-schema audit

The live production schema and current `main` source were inspected read-only on 2026-10-31.

### 9.1 Existing schema facts

- `measurements` stores activity, numeric value, unit, method, source, measured timestamp, quality status, metadata, capture identity/device and optional geolocation.
- `mrv_observations` stores activity, nullable `measurement_id`, parameter code, numeric observed value, unit, method, nullable free-text `instrument_id`, observed timestamp, uncertainty, quality status and metadata.
- `evidence` may point to a measurement, but this is not a substitute for the MRV observation's own measurement lineage.
- The Guardian submission route currently selects MRV observations by activity without joining them to `measurements`. Separately, it selects the latest measurement for that activity and sends its value/unit as a top-level quantity. That latest measurement is not proven to be the source of each observation.
- The Guardian request serializes observation rows, including free-text `instrument_id`, but does not establish that the text value is the UUID of an approved `mrv_instruments` record.
- The current PR #137 migrations 088/089 add instrument binding to `measurements`, but do not add a UUID instrument FK/specification revision to `mrv_observations` or enforce `measurement_id` as NOT NULL for authoritative submissions.

### 9.2 Required transaction and payload contract

Before Guardian submission, resolve every observation through a single canonical join:
`mrv_observation.measurement_id → measurements.id → mrv_instrument_id → mrv_parameter_specification_revision`.

The authoritative preflight must reject unless:
- every observation has a non-null `measurement_id` and references a measurement in the same activity and organization;
- the observation parameter code, value, unit, method and timestamp match the linked measurement under an explicit, versioned transformation rule; default behavior is exact match, no implicit conversion;
- the measurement's instrument UUID equals the observation's UUID instrument FK and the approved instrument remains current;
- the exact verified parameter-specification revision covers the observation's parameter, unit, range, resolution, accuracy/uncertainty and operating conditions;
- the supporting evidence artifact versions and approval reviews remain exact, same-organization, same-activity and immutable;
- no unrelated “latest measurement” is substituted for the linked observations.

The Guardian payload and its integrity hash must be built from the canonical joined rows and exact immutable IDs/revisions. A retry must recompute the complete canonical payload hash; changed observations, parameter revisions, evidence versions, or instrument approval state must invalidate stale replay/anchor reuse. The preflight and authoritative submission snapshot must be transactionally consistent with approval revocation/expiry and observation mutation. Any asynchronous external call must be preceded by a durable immutable submission snapshot/outbox record, with idempotent status transitions and no lock held across an unbounded network call.

### 9.3 Current result

This is a confirmed source-level and schema-level gap, not just a future enhancement. Until the canonical join and snapshot contract are implemented, an MRV submission can contain observations that are not demonstrably derived from the same instrument-bound measurements represented by the separate top-level quantity. Instrument-linked data must therefore remain ineligible for authoritative Guardian/registry submission until the new gate is implemented and accepted. Legacy text-only observations remain readable for historical context but cannot be upgraded by inference.


### 8.5 Recovery of the production-applied 096 source

The exact 97-line migration source was recovered from commit `ca8f4100782e13f8d72106187fafc8e1e446214f` (commit message: “Bind verification to organization and snapshot authority”). The subsequent main-branch commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` explicitly removed it with the message “Remove accidentally placed unreviewed verification migration from main”.

The recovered source was compared with live production:
- all four `verifications.authorization_*` columns exist with the expected UUID/JSONB/timestamptz types;
- the live `verifications_integrity_guard` trigger is BEFORE INSERT OR UPDATE and invokes `prevent_invalid_verification()`;
- the live function body contains the same organization-scoped membership/identity/permission checks and decision-time snapshot assignments as the recovered source;
- staging has none of the four authorization snapshot columns.

This establishes the production source lineage with high confidence. It does not cancel the historical review concern recorded by the removal commit. The migration source is intentionally referenced here rather than silently reintroduced as an approved migration. A reviewer must reconcile the original removal reason and approve the recovered source before it is restored to the canonical migration directory or used in any upgrade path.

Source links:
- Original migration commit: https://github.com/vishaltradewinds/rupaykg/commit/ca8f4100782e13f8d72106187fafc8e1e446214f
- Removal commit: https://github.com/vishaltradewinds/rupaykg/commit/54a7fe1ceb41b37a68720a71c10a1dd03af30dea


## 10. Recovered async mirror / AI intake migration sources

Four migration sources were recovered byte-for-byte as Git objects from the historical worker branch and restored in source-only PR #155, which was later closed without merge. That branch is a provenance archive, not canonical repository history.

| Migration | Recovered Git blob | Observed live placement |
|---|---|---|
| `20261022_async_mirror_inbox.sql` | `4d08607e03561b9fbb4ce502b4c4211127237050` | staging + rehearsal |
| `20261023_async_mirror_worker_leases.sql` | `33cb4d5d2e29a4a111340e5a0ac34170a0081895` | staging + rehearsal |
| `20261024_ai_intake_rate_limits.sql` | `87b51fe60a96a4e0752c8b0a9a170c81f9936dbb` | staging + rehearsal |
| `20261025_ai_evidence_intake_jobs.sql` | `6a0ae54530b7b756dac33589eaf18df3b071d8f2` | staging + rehearsal |

PR #155 verified each restored file's Git blob SHA against its historical source object. Its exact-head disposable CI run #3525 passed migration catalogue validation, ordered PostgreSQL migration application, typecheck, build, browser smoke test, existing PostgreSQL acceptance and production-container build. That run did not include the worker runtime or worker-specific PostgreSQL acceptance test.

The exact source objects and live ledger/schema placement are now known. This does not prove that current staging/rehearsal objects are byte-for-byte the result of those files: out-of-band drift may exist, and rehearsal-only `UNRESOLVED` status is not ledgered. Do not replay these migrations into live branches or promote them to production until SQL effects, object/constraint/function equivalence and chronology are independently reviewed.

Integrate source restoration through the canonical migration-history review path (PR #154 / PR #134), not by merging the historical worker branch or cherry-picking worker runtime code. Worker implementation dependencies remain separately gated.


## 11. Production verifier migration 096 — forward-only security defect

A separate disposable-PostgreSQL regression candidate in PR #140 reproduced a defect in the recovered 096 trigger: because the trigger executes on every UPDATE, an unrelated update to an already-approved verification can refresh `authorization_permissions_snapshot` and `authorization_checked_at`. This rewrites decision-time provenance and may cause historical approval evidence to reflect later role permissions rather than the original decision.

PR #140 exact-head CI run #41073680266 passed its disposable regression and proposed forward-fix tests. The proposal exercises:
- preserving the original snapshot on unrelated updates and later role-permission revocation;
- rejecting verifier/evidence/activity linkage changes on already-approved rows;
- clearing caller-supplied authorization fields on non-approved inserts;
- rechecking current authorization when a row transitions to APPROVED.

This is an identified defect and a proposed forward-fix, not an approved production remediation. Independent database/security review must assess approved-row immutability, legitimate correction/revocation workflows, concurrency/locking, trigger privileges and search_path, runtime-role write reachability, and API readers. Do not restore/replay 096 blindly or replace the live function with the historical source without a separately reviewed forward-only correction.

**Release impact:** preserve production's current verifier controls, but classify decision-time authorization snapshot immutability as an open security assurance gap pending the forward-only fix and review. No live SQL has been changed.
