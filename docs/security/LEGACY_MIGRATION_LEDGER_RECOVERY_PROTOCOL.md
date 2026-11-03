# Legacy Migration Ledger Recovery Protocol

**Status:** Proposed control; not an execution authorization  
**Applies to:** Neon main, verifier rehearsal, worker rehearsal, and unresolved migration rehearsal branches  
**Owner:** Database change owner + independent reviewer  
**Rule:** Never infer a historical checksum from today's migration file and call it proof of what ran.

## 1. Current disposition

The inspected ledgers predate `checksum_sha256` and contain historical rows without byte-level provenance. The checksum-aware migration runner deliberately classifies a non-empty ledger without checksum metadata as `LEGACY_UNVERIFIED` and stops before altering that ledger.

Until each historical row is resolved under this protocol, the affected database remains blocked from checksum-aware migration execution. Do not disable the check, backfill current-file hashes, edit applied timestamps, delete ledger rows, or rewrite migration files to make the ledger appear current.

## 2. Evidence required per historical row

For each `(version, filename, applied_at)`, assemble an immutable evidence packet containing:

1. Exact migration file bytes from the release artifact or source commit proven to have been deployed at the time of application.
2. The immutable source commit SHA and Git blob identity for that exact file.
3. A release/deployment record that ties that artifact or commit to the target database and migration window.
4. Database-side evidence that the migration completed, such as a contemporaneous migration-runner log, deployment job result, or independently retained database audit record.
5. Current catalog evidence for the objects and constraints the migration was expected to create, where applicable.
6. Evidence provenance, collection timestamp, collector identity, and immutable storage reference.

A current branch copy, a matching filename, an `applied_at` timestamp, a present-day catalog object, or a successful CI run alone is insufficient to prove the exact historical bytes that were executed.

## 3. Classification

Every ledger row must receive exactly one classification:

- `PROVEN_EXACT_BYTES`: evidence establishes the exact applied file bytes and ties them to the target migration event.
- `PROVEN_EXECUTION_CATALOG_ONLY`: catalog state is consistent, but exact historical bytes are not proven. This is not eligible for checksum backfill.
- `CONFLICT`: evidence conflicts (different file bytes, filenames, release lineage, or catalog state).
- `UNRESOLVED`: evidence is absent or insufficient.

Only `PROVEN_EXACT_BYTES` may be considered for a separately approved checksum-recovery operation. All other classifications remain blocked. Catalog agreement does not upgrade a row to exact-byte proof.

## 4. Independent review and recovery operation

Before any recovery write:

1. Freeze the target branch's migration execution and capture a read-only snapshot of its ledger and relevant catalog.
2. Produce a row-by-row evidence matrix; include unresolved rows explicitly.
3. Have an independent database reviewer verify the source artifact, release lineage, target identity, and computed SHA-256.
4. Have the database change owner approve a reviewed recovery plan that names the exact branch, database, rows, before/after values, rollback/restore method, and evidence references.
5. Test the same recovery procedure on a disposable Neon branch cloned from the target lineage; compare pre/post ledger and catalog.
6. Capture a second independent review of the rehearsal output.
7. Only then may a separately reviewed, narrowly scoped recovery change be proposed. It must preserve every original `version`, `filename`, and `applied_at`, write only independently proven checksum values, and retain the evidence packet and approval record.
8. Re-run the checksum-aware runner and verify all rows before any later migration is considered.

This document does not implement that recovery operation and does not authorize it.

## 5. Mandatory stop conditions

Stop without writes if any of the following holds:

- the exact deployed artifact or commit cannot be established;
- the migration file bytes differ across plausible release artifacts;
- the target database or branch lineage is ambiguous;
- catalog postconditions conflict or cannot be independently checked;
- evidence references are mutable, missing, or not retained;
- reviewer independence or approval is absent;
- the disposable rehearsal differs from the proposed target outcome.

Never invent checksums, rewrite migration history, use `BYPASSRLS`, weaken tenant controls, or bypass the migration runner to restore service.

## 6. Branch-specific initial register

| Branch | Existing rows | Checksum column | Initial disposition |
|---|---:|---|---|
| Neon main | 92 | Absent | `UNRESOLVED` pending row-level evidence |
| Verifier rehearsal | 92 | Absent | `UNRESOLVED` pending row-level evidence |
| Unresolved migration rehearsal | 95 | Absent | `UNRESOLVED` pending row-level evidence |
| Worker rehearsal | 115 | Absent | `UNRESOLVED` pending row-level evidence |

These counts are from read-only catalog inspection. They do not establish that all recorded migrations or worker objects are present and valid. The worker rehearsal's higher ledger count is not proof that the restricted worker schema was applied.

## 7. Completion evidence

A recovery review is complete only when it contains:

- row-by-row classification and evidence references;
- independently reproduced SHA-256 values for every proven exact-byte row;
- explicit unresolved/conflict list;
- approved target and recovery plan;
- disposable-branch before/after evidence;
- post-recovery runner report showing every ledger row verified;
- independent reviewer sign-off.

Until then, keep the affected branch blocked from checksum-aware migrations and keep production certification disabled.
