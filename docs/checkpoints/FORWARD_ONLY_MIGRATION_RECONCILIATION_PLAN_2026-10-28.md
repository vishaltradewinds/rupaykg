# Forward-only Migration Reconciliation Plan — 2026-10-28

## Decision and safety boundary

**Current release catalog is not eligible to run against either audited live ledger. Production certification and async worker scheduler remain HOLD.** This plan is for review and isolated validation; it authorizes no live database writes.

Never edit an already-applied migration in place, fabricate ledger entries, delete existing rows, disable the orphan guard, auto-requeue staging inbox rows, or weaken production verification controls to obtain schema parity.

## Confirmed history divergence

| Environment ledger | Recorded source absent from current release catalog | Required disposition |
|---|---|---|
| Production | `096_verification_authorization_provenance.sql` | Recover historical source for review; independently review; create a new forward-only migration only after approval. |
| Staging | `20261022_async_mirror_inbox.sql` | Recover exact source and dependency order; reconcile staging-only objects without data loss. |
| Staging | `20261023_async_mirror_worker_leases.sql` | Recover exact source; resolve worker status/check-constraint mismatch before any scheduler activation. |
| Staging | `20261024_ai_intake_rate_limits.sql` | Recover exact source; confirm intended limits and object dependencies. |
| Staging | `20261025_ai_evidence_intake_jobs.sql` | Recover exact source; confirm job lifecycle, idempotency and evidence integrity. |

The shared 20261018–20261021 migrations are present in the current branch and must not be labelled orphaned. Production and staging are not assumed equivalent merely because shared table counts match.

## Batch A — immutable evidence and source recovery

1. Pin production and staging ledger exports, migration catalog inventory, object definitions, constraints, indexes, triggers, trigger functions, and row counts as read-only artifacts with timestamps and hashes.
2. Recover the exact historical sources from Git history or trusted release artifacts. Record commit SHA, blob SHA, filename, and whether it was ever approved/released.
3. Preserve recovered SQL outside the release `migrations/` directory until review is complete. Recovered source is evidence, not deployment authorization.
4. If an exact source cannot be verified, stop that branch of reconciliation. Do not create a substitute with a different filename and pretend it is the same historical migration.

## Batch B — security and dependency review

### Verification authorization (096)

The recovered source was explicitly removed from main as unreviewed. It adds authorization provenance columns and strengthens the verification trigger. Before reintroduction:
- inspect existing approved verifications with missing provenance without mutating them;
- do not fabricate decision-time membership/role snapshots;
- decide how legacy rows will be labelled and exposed to auditors;
- verify all constraints and trigger/function definitions explicitly—`ADD COLUMN IF NOT EXISTS` does not repair a pre-existing column's missing foreign key;
- independently review search-path/privilege safety, permission spelling equivalence, role/membership revocation semantics, concurrent updates, and decision changes away from APPROVED;
- write a new, reviewed forward migration; preserve the historical source and never replay it against production.

### Async mirror / AI intake (20261022–25)

- Recover exact source and dependency order for inbox, leases/status constraints, rate limits and evidence intake jobs.
- Fix the observed mismatch where worker code writes `UNRESOLVED` but the recorded status CHECK constraint does not allow it. Use a reviewed forward migration that safely adds the intended state and validates every transition.
- Treat existing staging inbox/events as retained data. No deletes, requeues, lease resets, or payload changes during reconciliation.
- Verify idempotency keys, payload hashes, append-only event history, lease expiry, retry exhaustion, quarantine, authorization, and rate-limit semantics.
- Keep the scheduler disabled until disposable PostgreSQL integration tests exercise the real worker and database constraints.

## Batch C — disposable PostgreSQL rehearsal

Create fresh, isolated schemas/branches with production-like and staging-like ledger histories. Do not use live databases for rehearsals.

1. Run the current release runner unchanged and assert it fails closed on missing recorded sources.
2. Apply proposed forward migrations only to disposable schemas using a versioned rehearsal bundle.
3. Compare pre/post object definitions: columns/types/nullability/defaults, constraints, indexes, triggers, functions, grants, RLS policies, and relevant extensions.
4. Compare data counts and stable row hashes for retained tables; specifically verify all staging inbox and event rows remain unchanged.
5. Test positive and negative verification cases, including organization mismatch, missing/inactive membership, suspended identity, self-verification, evidence/activity mismatch, and authorization snapshot capture.
6. Test async worker transitions against PostgreSQL CHECK constraints, including unresolved crosswalk, retries, lease expiry, quarantine, and duplicate delivery.
7. Re-run the migration runner twice; first run must produce the expected state and second run must be a no-op.
8. Simulate interrupted/failed migration and documented recovery/restore procedures.

## Batch D — approvals and staged rollout

Required approvals before any live change:
- independent security reviewer for verification authorization;
- database/migration owner for history reconciliation and rollback/restore;
- domain owner for async mirror and AI evidence-intake semantics;
- compliance owner confirming statutory evidence/record-retention obligations;
- release approver signing the Shakti Standards gate record.

Then:
1. take and verify recoverable backups/snapshots under the approved change plan;
2. apply the reviewed migration bundle first to an isolated rehearsal, then to a designated staging branch;
3. verify schema/data parity and application behavior with signed evidence;
4. obtain explicit production change approval and a maintenance/rollback plan before production changes;
5. apply forward-only changes in the approved order and verify postconditions;
6. keep the worker scheduler off until the worker/status acceptance suite is green and an operator explicitly authorizes activation.

## Exit criteria

- Every ledger filename resolves to the exact reviewed source or a formally approved, auditable history-reconciliation record.
- No migration guard bypass, in-place edit of applied history, data loss, or weakened authorization control.
- Disposable PostgreSQL tests cover actual SQL and real constraints.
- Production/staging object-level diffs are reviewed and explain every remaining difference.
- All CI checks pass on the exact final commit.
- TRL and Shakti Standards evidence are updated; production certification decision is separately approved.


## Batch A — Git path provenance recovered (2026-10-28)

Candidate source branch tip at inspection: `c56b9c1fe341ce3ba943bced10f47163dae2a513` (`intelligence/ai-evidence-intake-middleware`). Git path history reports these introducing commits:

| File | Candidate introducing commit | Commit message/date |
|---|---|---|
| `20261022_async_mirror_inbox.sql` | `5064e086085dda7f8765047ae8120f9cb6bf0d80` | `feat(bridge): add durable async mirror inbox migration` — 2026-10-19 |
| `20261023_async_mirror_worker_leases.sql` | `a27978f4f450108956b6baa3a17541c07a8ade26` and follow-up `13237f1714510a18021a94601ac9ff7b9f1def37` | Worker lease/quarantine and append-only state-transition work — 2026-10-20 |
| `20261024_ai_intake_rate_limits.sql` | `a54fbdf81b0f5c4ae558acec3fc104407f70c48b` | `security: add database-backed AI intake rate limit` — 2026-10-20 |
| `20261025_ai_evidence_intake_jobs.sql` | `fc958c1096baecf4f0f0c3f08b2f38742dafe708` | `feat: add durable AI intake idempotency ledger` — 2026-10-20 |

This establishes repository history for candidate artifacts, **not** proof of which exact SQL was applied to staging. Still required: compare file/blob hashes with deployment artifacts or recorded migration checksums, confirm the branch was the actual source used at deployment time, and reconcile chronology against the live migration ledger. Do not promote files based only on commit messages or filename match.


### Source blob continuity check

Fetched each candidate file at its introducing/follow-up commit and compared the Git blob SHA with the candidate branch tip:

- `20261022_async_mirror_inbox.sql`: identical blob at introduction and candidate branch tip (`4d08607e03561b9fbb4ce502b4c4211127237050`).
- `20261023_async_mirror_worker_leases.sql`: original blob at the lease/quarantine commit was `eeb01ff38cacf66db35852310e0330948d55e169`; it changed in the append-only state-transition follow-up. The follow-up blob matches the candidate branch tip (`33cb4d5d2e29a4a111340e5a0ac34170a0081895`).
- `20261024_ai_intake_rate_limits.sql`: identical blob at introduction and candidate branch tip (`87b51fe60a96a4e0752c8b0a9a170c81f9936dbb`).
- `20261025_ai_evidence_intake_jobs.sql`: identical blob at introduction and candidate branch tip (`6a0ae54530b7b756dac33589eaf18df3b071d8f2`).

This confirms Git blob continuity within repository history for these three unchanged files and the later worker migration revision. It does **not** authenticate the exact source deployed to staging. Deployment-artifact/ledger-checksum matching remains the blocking provenance gate.


## Read-only live ledger evidence — 2026-10-28

Read-only SELECTs were run against the connected Neon project `steep-mud-79906940`; no data was modified.

- Production branch `br-restless-base-b44cip2h`: ledger records version `096`, filename `096_verification_authorization_provenance.sql`, applied at `2026-10-27T13:46:14.262Z`.
- Staging branch `br-spring-hill-b4544vz5`: ledger records versions `20261022` through `20261025` with the expected filenames, all timestamped `2026-10-20T10:48:38.647Z`.

**Important evidence limitation:** both live `public.schema_migrations` tables contain only `version`, `filename`, and `applied_at`; they do not store source checksums. Therefore the live ledger cannot establish which exact Git blob was applied. Provenance must be established from retained deployment artifacts, release bundles, CI/deployment logs, or other trusted contemporaneous evidence. Do not manufacture checksums or infer exact applied source from the filename alone.

The read-only check confirms the ledger entries and timestamps, not source equivalence or schema safety. Continue to HOLD live changes and scheduler activation.


## Read-only staging constraint/data check — 2026-10-28

Additional read-only checks on staging branch `br-spring-hill-b4544vz5` confirmed:

- `async_mirror_inbox`: 12 rows; statuses are PROCESSING=8, QUARANTINED=1, RECEIVED=1, RETRY=1, VALIDATED=1.
- `async_mirror_inbox_events`: 29 rows.
- Current `async_mirror_inbox_status_check` allows RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY, QUARANTINED; it does **not** allow UNRESOLVED.
- Current count of rows with status UNRESOLVED is 0.
- The candidate forward migration `20261101_async_mirror_unresolved_crosswalk.sql` proposes replacing that CHECK to add UNRESOLVED and clarifies its non-authoritative meaning. It is still an unapproved candidate on a non-release branch; it has not been applied.

This confirms a concrete runtime compatibility blocker: the worker's UNRESOLVED status cannot be persisted under the current staging CHECK. Do not enable the worker or apply the candidate migration until tests exercise the exact SQL against a disposable PostgreSQL database, including existing rows, constraint replacement, allowed/disallowed statuses, rerun behavior, and rollback/recovery expectations. The 12 inbox rows and 29 events remain untouched.


## Disposable Neon PostgreSQL rehearsal — 2026-10-28

A separate Neon branch was created from the staging snapshot solely for rehearsal:
- Project: `steep-mud-79906940`
- Rehearsal branch: `shakti-unresolved-migration-rehearsal-20261028` (`br-broad-glade-b46npw8o`)
- Parent staging branch: `br-spring-hill-b4544vz5`

On the rehearsal branch only, the candidate forward-only `UNRESOLVED` CHECK replacement from Git blob `4f9776bc449025e795cb0d5c93e8bace9dea280b` was applied twice. Both applications completed successfully. The resulting CHECK includes `UNRESOLVED`. A controlled test successfully persisted `UNRESOLVED` and the CHECK rejected `INVALID_TEST_STATUS`; the test row's original `PROCESSING` status was restored.

Post-test read-only checks on the rehearsal branch:
- Inbox rows: 12 (same as baseline).
- Status distribution: PROCESSING=8, QUARANTINED=1, RECEIVED=1, RETRY=1, VALIDATED=1; UNRESOLVED=0 after restoring the test row.
- Inbox event rows: 33, up from the staging baseline of 29 because the controlled status-transition test exercised the append-only event trigger. These four test-generated events exist only on the rehearsal branch; no staging/production rows were touched.
- Invalid status rejection and repeated migration application passed.

This is a useful targeted rehearsal, not the complete migration acceptance gate. Still required: test every worker transition and lease/quarantine/retry path against the exact worker implementation; test concurrency and interrupted migration recovery; compare all source migrations with trusted deployment artifacts; independently review the proposed migration; and obtain release approval. The rehearsal branch is retained as evidence and must not be treated as production data. Do not enable the worker.



## Candidate SQL fixture-fidelity audit — 2026-10-28

The four non-release SQL fixtures used by the disposable PostgreSQL tests have provenance headers and formatting differences, so their Git blob hashes are not expected to equal the source blobs. To avoid treating formatting differences as substantive SQL divergence, the SQL was compared after removing line comments, stripping whitespace, and case-folding.

Results:
- `20261022_async_mirror_inbox.sql`: normalized SQL matches source blob `4d08607e03561b9fbb4ce502b4c4211127237050`.
- `20261023_async_mirror_worker_leases.sql`: normalized SQL matches source blob `33cb4d5d2e29a4a111340e5a0ac34170a0081895`.
- `20261024_ai_intake_rate_limits.sql`: normalized SQL matches source blob `87b51fe60a96a4e0752c8b0a9a170c81f9936dbb`.
- `20261025_ai_evidence_intake_jobs.sql`: normalized SQL matches source blob `6a0ae54530b7b756dac33589eaf18df3b071d8f2`.
- Recovered `096_verification_authorization_provenance.sql` fixture is byte-for-byte identical to blob `258b1f4534efbf915688f78aa84d4ec24a47cbc0`.

This is a source-fixture consistency check, not proof the source was deployed to staging/production. The live ledger stores no checksums, and the inspected historical GitHub Actions run returned no artifacts. No trusted release bundle/deployment checksum was found in the evidence inspected so far. The exact deployed-source provenance gate therefore remains OPEN.

## Worker integration evidence found

The non-release source branch `intelligence/ai-evidence-intake-middleware` contains `apps/src/async-mirror-worker-db.test.ts`, `apps/src/async-mirror-worker.test.ts`, and scheduler/operations documentation. Its CI run `39912468229` completed successfully on commit `c56b9c1fe341ce3ba943bced10f47163dae2a513`, including the general test suite and disposable PostgreSQL acceptance step. The workflow explicitly sets `RUPAYKG_RUN_DB_INTEGRATION_TESTS: "1"` for `npm test`, and `DATABASE_URL` points to the workflow's disposable PostgreSQL 16 service; therefore the DB integration test is enabled by CI configuration. The run passed. This is meaningful engineering evidence, but does not certify production behavior or justify moving that worker into the release branch. Ensure the worker source and exact migrations are reviewed together in a controlled release candidate.

**Status: targeted UNRESOLVED rehearsal and fixture/source SQL equivalence checks passed; deployed-source provenance, independent security/database review, full worker-transition acceptance evidence, and release approval remain blocking. Production/staging unchanged; scheduler disabled.**


## Additional deployment provenance evidence — Render, 2026-10-28

Read-only Render service history for the production-facing `rupaykg` service (service ID `srv-daki4d7qj5pc73b8qksg`) correlates two consecutive deployments:

- Deployment of commit `ca8f4100782e13f8d72106187fafc8e1e446214f` (“Bind verification to organization and snapshot authority”) started at 2026-10-27T13:44:53Z and finished at 13:46:30Z. Its application log at 13:46:15.943Z states `Database migrations are current (92 files).`
- Deployment of commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` (“Remove accidentally placed unreviewed verification migration from main”) started at 13:46:32Z and finished at 13:48:15Z. Its application log at 13:47:56.609Z states `Database migrations are current (91 files).`
- The read-only production migration ledger records `096_verification_authorization_provenance.sql` at 2026-10-27T13:46:14.262Z. The recovered SQL blob is `258b1f4534efbf915688f78aa84d4ec24a47cbc0`, from the first deployment's commit, and the review fixture is byte-for-byte identical to that blob.

This is a strong, time-correlated reconstruction that the 92-file build containing the historical 096 source ran immediately before the ledger timestamp, and that the following 91-file deployment omitted the source. It improves provenance evidence materially, but it is **not a cryptographic attestation of the exact image filesystem or SQL bytes executed**: the inspected Render history did not provide a retained image digest or deployment bundle containing the migration checksum. Record the source as *deployment-correlated, blob-recovered; artifact-level attestation unavailable*, not as checksum-verified deployment provenance.

The same logs do not prove which exact SQL bytes were used for staging's 20261022–20261025 entries. Their candidate source blobs and fixtures match after SQL normalization, but staging deployment-source provenance remains open. Continue to hold release certification pending independent review and artifact-level evidence or a formally accepted provenance exception.
