# RupayKg Migration-History Reconciliation Plan
**Date:** 2026-10-30  
**Status:** Evidence and planning only — no live database changes authorized  
**Applies to:** production and staging migration history; Shakti Standards release gate

## 1. Executive finding

The migration runner's canonical history validator is available in draft PR #134. Its current head `c5bb999dcc5343a4e3cc911d7bb703552c1f166c` passed exact-head CI run [#41065339143](https://github.com/vishaltradewinds/rupaykg/actions/runs/41065339143). The job passed dependency audit, migration validation, the migration-runner command, typecheck, build, browser smoke, disposable PostgreSQL acceptance, and production-container build. The runner log explicitly reports `Validated 91 migrations and 73 schema objects` and `Database migrations are current (91 files)`.

This is isolated CI evidence, not approval to merge, run against production/staging, or certify the platform.

## 2. Observed history mismatch

Prior read-only inspection found:
- Production `schema_migrations`: 92 rows; the applied ledger includes `096_verification_authorization_provenance.sql`; the four corresponding `verifications.authorization_*` columns were present.
- Staging `schema_migrations`: 95 rows; it includes date-prefixed migrations `20261022` through `20261025` that are absent from the current main migration catalogue; the four production authorization columns were absent in staging.
- Main's migration catalogue contains 91 numbered/date-prefixed SQL files, ending with `20261021_evidence_artifact_vault.sql`.
- Checked branches `main`, `fix/migration-ledger-preflight-isolated`, and `shakti/dual-ledger-compatibility-tests` each exposed the same 91-file catalogue. Checked branches `cto/batch1-production-safety` and `integration/migration-runner-p0-reconciliation` exposed 95 files, including `088`–`091`, but did not expose the missing `096` or `20261022`–`20261025` sources.
- Git path history for `migrations/096_verification_authorization_provenance.sql` shows it was added in commit `ca8f4100782e13f8d72106187fafc8e1e446214f` and then removed from main in commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`, whose message states: “Remove accidentally placed unreviewed verification migration from main.” Therefore, restoring that SQL merely because production records it would be unsafe without locating its reviewed/approved provenance.
- Git path history returned no commits for the four staging date-prefixed migration paths checked. This means source provenance is not yet established in the inspected history; it does not prove that no source exists in any other branch, artifact, or deployment bundle.

## 3. Non-negotiable controls

1. Keep migration runner fail-closed when catalogue/history mismatches are detected.
2. Never edit applied ledger rows, drop/recreate objects, fake migration versions, or renumber migrations to make the histories appear aligned.
3. Do not replay historical SQL against either live database during investigation.
4. Do not infer migration content from names, schema columns, or downstream effects.
5. Keep production certification **HOLD/OFF** until independent review and all release gates pass.
6. Keep this reconciliation work isolated from parallel EPR/ESG/CCTS, GRI, IoT hardware, and TRL workstreams.

## 4. Required evidence collection

### A. Establish immutable database evidence
For each environment, export a read-only ordered ledger with at least: recorded version, filename, applied timestamp, checksum if recorded, execution status, and runner metadata. Capture schema-only definitions for affected objects and triggers/functions. Redact credentials and personal data. Hash and timestamp each export.

### B. Find authoritative source artifacts
Search every accessible branch, pull request, commit, release artifact, container image/build context, and deployment bundle for the exact original SQL source and associated review/approval. For each candidate record:
- exact repository/ref/commit and blob SHA;
- SQL file SHA-256;
- review/approval and change record;
- migration version/filename and intended ordering;
- idempotency and rollback/forward-repair assessment;
- objects and constraints changed;
- proof the source corresponds to what was applied, not just a similarly named file.

### C. Reconcile each environment independently
Create a row-by-row matrix: applied ledger entry → authoritative source → hash comparison → current schema effect → status (matched, source missing, version mismatch, duplicate/ambiguous, or schema drift). Never collapse production and staging into one assumed history.

### D. Produce a forward-only remediation proposal
Only after source provenance and actual schema are independently confirmed, propose a reviewed, additive forward migration if needed. Include preconditions, lock/availability impact, transactional behaviour, idempotency, rollback/compensation, data preservation, backups, monitoring, and explicit operator approval. The proposal must not execute automatically.

## 5. Acceptance gates

- [ ] Exact applied ledgers exported and hashed, read-only.
- [ ] Authoritative source and approval located for production `096`.
- [ ] Authoritative source and approval located for each staging date-prefixed migration `20261022`–`20261025`.
- [ ] Source hashes and applied schema effects reconciled independently for production and staging.
- [ ] Canonical validator and runner reviewed by a second engineer.
- [ ] Tests prove failure occurs before pending SQL on missing source, wrong version, duplicate catalogue prefix, and empty catalogue.
- [ ] A separate forward-only remediation plan is approved by the database owner and release authority.
- [ ] Staging rehearsal, backup/restore validation, observability, and rollback/compensation plan accepted.
- [ ] Shakti Standards / TRL evidence updated with test environment, scope, limitations, and independent sign-off.

## 6. Current decision

**Engineering validation may continue. Merge, production/staging writes, deployment, and certification are not authorized by this document.** The missing migration sources and their approval history remain unresolved until the evidence gates above are met.


## 7. Follow-up source discovery (2026-10-30)

A wider branch scan located historical source candidates for both the production authorization migration and two *different* migration families using the same date prefixes. This improves source discovery but does not close provenance/approval gates.

### Production `096` source candidate
- Exact source exists at commit `ca8f4100782e13f8d72106187fafc8e1e446214f`: [historical migration file](https://github.com/vishaltradewinds/rupaykg/blob/ca8f4100782e13f8d72106187fafc8e1e446214f/migrations/096_verification_authorization_provenance.sql).
- Git blob SHA reported by the contents API: `258b1f4534efbf915688f78aa84d4ec24a47cbc0`.
- The file was removed from main in `54a7fe1` explicitly because it was unreviewed. Source availability is now established; approval, production artifact identity, and reviewed remediation authority are **not** established. Do not restore it directly.

### Two competing date-prefixed source families

**Family A — async mirror / AI intake** on branch `shakti/migration-runner-advisory-lock-2026-10-25`:
| Version | Filename | Git blob SHA |
|---|---|---|
| 20261022 | `20261022_async_mirror_inbox.sql` | `4d08607e03561b9fbb4ce502b4c4211127237050` |
| 20261023 | `20261023_async_mirror_worker_leases.sql` | `33cb4d5d2e29a4a111340e5a0ac34170a0081895` |
| 20261024 | `20261024_ai_intake_rate_limits.sql` | `87b51fe60a96a4e0752c8b0a9a170c81f9936dbb` |
| 20261025 | `20261025_ai_evidence_intake_jobs.sql` | `6a0ae54530b7b756dac33589eaf18df3b071d8f2` |

**Family B — CPCB evidence links / BM WA03.001 baseline** on branch `shakti/engineering-validation-batch1-2026-10-24`:
| Version | Filename | Git blob SHA |
|---|---|---|
| 20261022 | `20261022_cpcb_swm_evidence_links.sql` | `f78e55dc1453c6d7b20b3b99db1257ac26051f18` |
| 20261023 | `20261023_bm_wa03001_baseline_records.sql` | `51d089b84dadb4dabd694577fb0e1db694a540e7` |
| 20261024 | `20261024_bm_wa03001_reconciliations.sql` | `10fb56998e42a4a5f46b953670f84e9168a35886` |
| 20261025 | `20261025_bm_wa03001_baseline_attestations.sql` | `eb65126d471d70721cac9c8c7a4322f0a0e6c944` |

**Critical collision:** both source families reuse the same four numeric date prefixes with different SQL. The staging inbox/event tables make Family A a plausible candidate for at least part of the observed staging schema, but this is not sufficient to prove the applied ledger filenames or the full sequence. Do not merge either branch or import either family into main until the exact staging ledger rows, source branch/commit, and schema effects have been matched. Numeric version/date alone is not a unique identity.

### Immediate reconciliation tasks
1. Obtain the exact, ordered staging `schema_migrations` rows including each stored `filename` (not just version and count). This is the decisive evidence for distinguishing the competing families.
2. For each exact stored filename, match to the candidate branch/commit and compare SQL text/blob hash against the deployment artifact or recorded checksum if available.
3. Inspect ancestry and PR review history for the candidate branches; identify whether any were actually merged, deployed, or only proposed.
4. Compare each migration's expected objects/constraints/functions to read-only staging schema definitions, including the inbox status check and event trigger.
5. Record explicit disposition per file: authoritative/applied, source found but approval unresolved, competing candidate, or unresolved. No ledger mutation or SQL replay.



## 8. Exact live-ledger filename evidence and chronology (read-only, 2026-10-30)

A read-only `SELECT version, filename, applied_at FROM schema_migrations` was run against both known Neon branches, project `steep-mud-79906940`, database `rupaykg`. No writes were performed.

### Production branch `br-restless-base-b44cip2h`
- The applied ledger explicitly records `version=096`, filename `096_verification_authorization_provenance.sql`, applied at `2026-10-27T13:46:14.262Z`.
- Git history shows the source was removed from `main` by commit `54a7fe1` at `2026-10-27T13:45:20Z`, with the commit message saying it was an accidentally placed unreviewed migration.
- Thus the recorded application time is **54 seconds after** the removal commit timestamp. The historical source blob exists, but this timing increases the need to identify the exact deployed artifact and authorized execution record. It does not establish whether the SQL was executed from a branch, build artifact, manual action, or other path.

### Staging branch `br-spring-hill-b4544vz5`
The ledger explicitly records the async mirror / AI intake family:
| Version | Exact stored filename | Applied at (UTC) | Candidate branch blob SHA |
|---|---|---|---|
| 20261022 | `20261022_async_mirror_inbox.sql` | 2026-10-20T10:48:38.647Z | `4d08607e03561b9fbb4ce502b4c4211127237050` |
| 20261023 | `20261023_async_mirror_worker_leases.sql` | 2026-10-20T10:48:38.647Z | `33cb4d5d2e29a4a111340e5a0ac34170a0081895` |
| 20261024 | `20261024_ai_intake_rate_limits.sql` | 2026-10-20T10:48:38.647Z | `87b51fe60a96a4e0752c8b0a9a170c81f9936dbb` |
| 20261025 | `20261025_ai_evidence_intake_jobs.sql` | 2026-10-20T10:48:38.647Z | `6a0ae54530b7b756dac33589eaf18df3b071d8f2` |

The competing CPCB/BM WA03.001 family is **not** what staging's ledger records for those four versions. This resolves the filename-family ambiguity.

### Important chronology gap
The async migration sources in branch `shakti/migration-runner-advisory-lock-2026-10-25` were restored by commits on **2026-10-25T10:23:53Z through 10:24:00Z**, while the staging ledger says they were applied on **2026-10-20T10:48:38.647Z**. Therefore, these restored branch commits cannot by themselves prove which exact SQL bytes were executed on staging five days earlier. The commit messages say “restore historical migration …”; original pre-restoration source, deployment artifact/hash, and approval/execution record must still be located.

### Updated disposition
- **Production 096:** filename and historical source blob identified; exact deployed artifact/approval provenance unresolved; application occurred just after removal from main.
- **Staging 20261022–20261025:** exact applied filenames identified and candidate source blobs located; candidate restore commits postdate application by five days, so execution-source identity and approval provenance unresolved.
- **Staging schema:** the previously observed inbox/event tables and statuses are consistent with the async migration family, but schema similarity alone does not prove SQL byte identity.
- **Release decision:** continue fail-closed. No SQL replay, ledger editing, source restoration to main, migration renumbering, merge, or deployment is authorized by this evidence.



## 9. Render deployment/log correlation — production 096 (read-only, 2026-10-30)

A read-only inspection of Render service `rupaykg` (service ID `srv-daki4d7qj5pc73b8qksg`) established a stronger execution chain than the earlier Git/ledger-only evidence:

- Render event history shows a successful build/deploy initiated for commit `ca8f4100782e13f8d72106187fafc8e1e446214f` at `2026-10-27T13:44:54Z` (build completed at `13:45:43.075Z`; deploy completed at `13:46:30.922Z`). This is the commit containing `migrations/096_verification_authorization_provenance.sql` with blob SHA `258b1f4534efbf915688f78aa84d4ec24a47cbc0`.
- Render application logs record `Applied 096_verification_authorization_provenance.sql` at `2026-10-27T13:46:15.075Z`, followed by `Database migrations are current (92 files).` at `13:46:15.943Z`.
- The Neon production ledger records the same filename/version applied at `2026-10-27T13:46:14.262Z`. The log and ledger timestamps differ by about 0.8 seconds, consistent with the same migration execution (timestamps may be written/logged at different points).
- Render then started a new build/deploy for removal commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` at `13:46:32.414Z`, with deploy completion at `13:48:16.681Z`. Its application logs report `Database migrations are current (91 files).` at `13:47:56.609Z`.

**Revised finding:** the best available evidence now ties the production application of migration 096 to the Render service booting a build of commit `ca8f410...`, rather than leaving the execution path wholly unknown. The sequence is: migration-containing build/deploy; migration applied; removal-commit build/deploy. The earlier statement that execution might have come from a manual or other path is superseded by this deployment/log correlation. However, this still does **not** establish that the migration had required review/approval or that the application was authorized. The removal commit explicitly says the migration was unreviewed. Preserve the deployed/log evidence and seek the PR/review/approval or incident/change record. Do not restore/replay the migration or edit the ledger.

### Production 096 disposition after log correlation
- Source blob identity: **identified**.
- Render service deployment commit containing source: **identified**.
- Runtime log of migration application: **identified** and correlated with ledger timestamp.
- Approval/change authorization and independent review: **unresolved**.
- Safe corrective action: **not yet determined**; do not remove columns/functions or replay SQL without impact analysis and approved forward-only remediation.

### Additional read-only schema evidence
- Both known Neon branches' `schema_migrations` tables contain only `version`, `filename`, and `applied_at`; no checksum/source-artifact digest is stored in the ledger. Thus ledger rows alone cannot cryptographically prove the executed SQL bytes.
- Production has the four `verifications.authorization_*` columns; staging does not. Staging has the async/AI intake tables and the expected lease/event columns. This is schema-shape corroboration, not a checksum of the SQL that originally ran.

### Remaining work for staging source provenance
The Render event/log inspection above resolves the production 096 execution path but does not resolve the four staging migrations. Continue searching the pre-2026-10-20 Git objects, CI/deployment artifacts and logs, and change/approval records for the async/AI family. Candidate commits dated 2026-10-25 remain too late to prove the bytes applied on 2026-10-20.


## 10. Staging worker/status constraint mismatch and test evidence (2026-10-30)

Read the source SQL for the recovered async/AI migration family and the current PR #122 test record:

- `20261022_async_mirror_inbox.sql` creates `async_mirror_inbox.status` with allowed states `RECEIVED, PROCESSING, PROCESSED, REJECTED, RETRY`.
- `20261023_async_mirror_worker_leases.sql` replaces that constraint with `RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY, QUARANTINED`; **`UNRESOLVED` is not allowed**.
- PR #122 documents a real-worker/disposable-PostgreSQL test for this mismatch. Its CI run `40891694084` passed on head `23d405bde272fb5cefe441db8f0ab496f0adc2b7`. A later comment reports commit `c3fbe3be779dfc221e55ef6344f538ee89e6cfec` applies the proposed `20261101_async_mirror_unresolved_crosswalk.sql` in the disposable schema before testing the real worker, while explicitly warning that exact-head CI/triggering for that later commit still needs confirmation.
- The PR description states that, under the historical constraint, the failed transition falls back to `RETRY`; the proposed corrected constraint permits `UNRESOLVED` only when no verified jurisdiction crosswalk exists. That state remains internal and non-authoritative: no official acceptance, MRV mutation, or Guardian submission is intended.

**Disposition:** this is a concrete staging functional-compatibility blocker, not permission to apply the future-dated migration. First establish the exact staging migration SQL bytes and worker version that were deployed; then verify the current PR #122 head and exact-head CI. Only after review should an additive, forward-only status widening be considered for a controlled environment. Test the full state machine, retries, lease expiry, quarantine, event append-only behavior, and assurance that `UNRESOLVED` cannot become an official authority/MRV/credit decision. No live database change is authorized.

## 11. Current evidence-based gate ordering

1. **P0-A — Source/deployment provenance:** retain the Render commit/log/ledger correlation for production 096; obtain approval/change record and independent trigger/function security review. Locate pre-2026-10-20 source/artifact identity for staging 20261022–25.
2. **P0-B — Staging worker compatibility:** confirm exact PR #122 head and CI; reproduce the current worker against the exact staging schema in disposable PostgreSQL. Keep the proposed 20261101 migration unapproved until its SQL, operational impact, and upgrade path are reviewed.
3. **P0-C — Canonical catalogue/ledger contract:** independently review PR #134 and integrate the missing-source/version-filename/duplicate-prefix checks with the dual-ledger and startup preflight work only through one coordinated exact-head candidate.
4. **P0-D — Release-shaped acceptance:** run fresh-install and supported upgrade tests against the final combined migration inventory, with production/staging-like ledger snapshots; prove failures occur before any pending SQL and ledger stays unchanged.
5. **Only then:** independent security/release approval, staged rollout and rollback/compensation plan. Until then production certification stays HOLD/OFF.


## 12. Exact PR #122 head/CI reconciliation (2026-10-30)

The current GitHub PR metadata for [PR #122](https://github.com/vishaltradewinds/rupaykg/pull/122) reports head `660ab729e613ffdd3629f4fdcdbf86a0e9054441`, base `intelligence/ai-evidence-intake-middleware` at `84cb4394dbd21f46d96e3b4757dfe2db4e5dfa8d`, draft/open, unmerged. The earlier passing CI comment refers to run `40891694084` on older head `23d405bde272fb5cefe441db8f0ab496f0adc2b7`; the available commit-workflow lookup returned no PR-triggered workflow runs for current head `660ab729...`. Therefore, **do not mark the current PR #122 head CI-verified based solely on the older run**. Confirm the GitHub Actions run directly on the exact head and its integration-test gate before accepting the test evidence.

The later commit `c3fbe3be779dfc221e55ef6344f538ee89e6cfec` changes the test to apply the exact proposed `20261101_async_mirror_unresolved_crosswalk.sql` in a disposable schema. It is an ancestor of the current PR head, but the passing run cited in the PR comment predates that change. The exact proposed migration source on the PR branch has blob SHA `4f9776bc449025e795cb0d5c93e8bace9dea280b`. This is useful review evidence, not release approval.

**Acceptance requirement:** a successful CI run on exact PR head `660ab729...` must visibly execute `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1` against disposable PostgreSQL and prove both the historical constraint retry path and the exact forward-migration path, including the non-authoritative UNRESOLVED assertions. If CI cannot be obtained on the current head, rerun through the repository's authorized workflow mechanism; do not alter production/staging to produce the evidence.
