# RupayKg TRL 9 Baseline and Dependency Audit

**Audit timestamp:** 2026-10-30  
**Canonical repository:** `vishaltradewinds/rupaykg`  
**Baseline branch:** `main`  
**Baseline commit:** `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`  
**Purpose:** Batch A under `docs/TRL9_EXECUTION_PLAN.md`  
**Status:** Evidence-backed initial snapshot; not a production inspection or certification.

## 1. Current decision

**HOLD / NO-GO for overall TRL 9 and production certification.**

The existing assessment remains provisional software TRL 4; integrated-platform TRL is unverified. Physical hardware qualification, intended-site operation, external authority acceptance, and sustained live-operation evidence are not established by the repository records reviewed for this baseline.

## 2. Source-of-truth and branch governance

- Canonical source of truth: `vishaltradewinds/rupaykg`.
- Legacy `rupaykg-aistudio` is reference-only.
- GitHub API reported `main` at `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`, commit dated 2026-10-27.
- GitHub API reported `main` as **unprotected**, required status checks disabled, and repository rulesets empty at audit time.
- The TRL plan PR #90 and several engineering PRs were opened against older base snapshots. Re-check current base/head divergence and mergeability immediately before every integration decision.
- No branch protection, repository settings, live database or deployment was changed as part of this baseline.

**Governance risk:** A successful PR CI run is not an enforced merge gate while branch protection and required checks are disabled. The repository owner should approve and configure a safe branch-governance policy after confirming required CI contexts; do not guess check names.

## 3. PR coordination snapshot

The following are open/unmerged at the time checked. Current status and exact-head CI must be rechecked before action.

| PR | Workstream | Current observed status | Dependency / constraint |
|---|---|---|---|
| #90 | TRL 4→9 plan | Draft, open; head `b361e75dfbc4a110626afeba0098f7822c8ba3d2`; CI in progress at run #3361 / ID `41057840083` | Documentation-only plan; do not claim merged or gate passed. |
| #93 | TRL evidence ledger | Draft, open; head `e80690484b086d43c0a523024b99ef947e583202` | Align evidence states and identifiers with master plan; avoid duplicate/conflicting registers. |
| #91 | Production DB target/config safety | Draft, open; head `b8632ceacd18a0db2d635f23904e17c19664f48b` | Must be reviewed against production startup and migration behavior; do not infer live DB safety from tests alone. |
| #126 | Migration history fail-closed preflight | Draft, open; head `61191f5b7252c5d89d5157cefb01c27f464a9aef` | Reconcile source migration catalogue, schema and authorised environment ledger; never rewrite live ledger to force green. |
| #127 | Official India regulatory source register | Draft, open; head `269c953104c1dfe0f230fc814c78f9a1378b73ad` | Sources remain research-only until artifacts, hashes, effective dates and applicability are verified. |
| #128 | Hardware-edge observation contract | Draft, open; head `b561c941c3658197e3d469b92163b5a73c1e3566`; CI in progress at run #3362 / ID `41057869797` | Adapter contract is not physical instrument qualification; avoid duplicate device/evidence/persistence paths. |
| #129 | Strict timezone-aware field-sync timestamps | Draft, open; head `e51a7fa719abcd082c6d099652c74d6a04193b99` | Exact-head tests and review required; integrate with offline-sync work without weakening fail-closed behavior. |
| #49 | Hardware instrument approval | Draft, open; head `4d606e188b31b890eb894aa8dfdd275f7c8ee4c4` | Overlaps #51 on approval routes/schema. Site and methodology eligibility remain separate gates. |
| #51 | Evidence-bound instrument approval and parameter specifications | Draft, open; head `e5388fd1db1533db1d5abcf7bd5f52fc5f09ad2b` | Overlaps #49; prior exact-head CI is engineering evidence, not physical qualification. Resolve canonical migration/route ownership before merge. |
| #47 | Hardware/instrumentation approval register documentation | Draft, open; head `7812f6f98f1d136604f7100493a3e7749aa85454` | Align with the selected implementation in #49/#51. |
| #59 | Open-source hardware stack evaluation | Draft, open; head `22904460e48fdbaada958a6b0a79bd6db8723ce0` | Planning/evaluation only until exact hardware requirements and evidence are approved. |
| #108 | Dual-ledger migration compatibility acceptance | Open, not merged; head `0fc473ee69e21b05e8af5f1e476fd51835261152` | Coordinate with #126 and database-safety work; validate exact candidate and migration history. |
| #120 | Production startup, EPR quantities and ESG verification | Draft, open; head `1720df5eac80aa35d97f4b16b998ff70a2d45daa` | High-risk business and production guardrails; coordinate with EPR/ESG work. |
| #121 | GRI cross-mapping schema extension | Draft, open; head `b353d41ad71fa0f05149c046d75b2dba07c10f45` | Coordinate schema and reporting lineage with ESG work; do not imply assurance from schema alone. |

Additional parallel work, including ICVCM, Guardian/Hedera, waste custody, facility/resource-flow and agentic AI, must be included in the dependency map before any broad merge batch. This list is a snapshot, not an exhaustive claim that no other PRs exist.

## 4. Immediate dependency decisions

1. **Do not merge #49 and #51 independently** until a reviewed integration order selects the canonical migration and route ownership and resolves overlapping changes. Keep #47 aligned to that decision.
2. **Coordinate #126, #91 and #108** before migration or production-startup changes. The source tree, supported migration catalog, actual schema and authorised environment ledger must be reconciled; production remains untouched until an approved runbook and explicit authorization exist.
3. **Coordinate #128 and #129** with existing field-sync and evidence ingestion. Preserve strict timestamps, replay protection, quarantine, idempotency and canonical ingestion; no parallel persistence registry.
4. **Keep #127 source records research-only** until official source artifacts and applicability have been verified and reviewed.
5. **Align #90 and #93** so the execution plan is the master route and the evidence ledger records gate evidence without inventing readiness.
6. **Coordinate #120 and #121** with active EPR/ESG/GRI work. No statutory submission, verification or assurance claim without corresponding evidence.
7. Recheck the full current open-PR inventory and head/base SHAs before any merge batch. This baseline is not a merge authorization.

## 5. Migration and deployment evidence status

- `main` commit message on 2026-10-27 records removal of `migrations/096_verification_authorization_provenance.sql` from `main` after it was identified as an unreviewed migration.
- PR #126 explicitly addresses fail-closed handling of unresolved migration history.
- No authorised production migration-ledger export, production schema inspection, backup/restore proof or live deployment identity was established by this GitHub metadata check.
- The repository contains `docs/CLOUD_RUN_PRODUCTION_CONTRACT.md`, but that contract is a deployment specification, not proof of a live Cloud Run release.
- Do not infer that a migration is applied, absent, safe, or recoverable solely from branch contents or a CI run.

## 6. TRL evidence gaps

The following remain unproven until evidence is added to the controlled ledger:

- Independent review and exact-head validation for each candidate release.
- Authorised production/staging migration and schema reconciliation.
- Actual deployment identity and production operational monitoring.
- Complete security assessment and recovery exercise.
- Verified official regulatory artifacts and applicability.
- Independent reproduction of representative carbon/MRV calculations.
- Actual device inventory, model-specific approvals where required, calibration and metrology evidence.
- Hardware-in-the-loop and complete physical-to-cloud observation-chain tests.
- Intended-site permission, acceptance, actual operator workflows and independent reference comparisons.
- Real external Guardian/Hedera/Mirror Node integration evidence, if in scope.
- Sustained operational metrics, incident history and independent TRL assessment.

## 7. Batch A exit status

**Status: PARTIALLY COMPLETE — repository/PR snapshot recorded; production and schema evidence blocked/not yet available.**

Completed:
- Confirmed canonical repository and current `main` SHA from GitHub API.
- Confirmed branch protection is disabled and no rulesets were returned.
- Captured exact heads and observed statuses for key open PRs.
- Identified material overlap in hardware approval and migration/database work.
- Identified two exact-head CI runs still in progress at the time of query.

Not completed:
- Full paginated inventory of every open PR and all changed-file overlaps.
- Inspection of every current workflow/check and exact-head independent review.
- Authorised read-only inspection of actual production/staging migration ledger and schema.
- Confirmation of actual live deployment, site or hardware state.
- Assignment of accountable human owners and signed gate decisions.

**Next action:** complete the paginated PR/dependency map and review the relevant diffs; obtain an authorised, read-only environment evidence package for schema/ledger/deployment; then prioritise the database-safety and hardware-approval integration order. Do not make production mutations or declare Batch A passed until those blockers are resolved.

## 8. Source links

- [Canonical repository](https://github.com/vishaltradewinds/rupaykg)
- [TRL 9 execution plan PR #90](https://github.com/vishaltradewinds/rupaykg/pull/90)
- [TRL evidence ledger PR #93](https://github.com/vishaltradewinds/rupaykg/pull/93)
- [Database target safety PR #91](https://github.com/vishaltradewinds/rupaykg/pull/91)
- [Migration history preflight PR #126](https://github.com/vishaltradewinds/rupaykg/pull/126)
- [Regulatory source register PR #127](https://github.com/vishaltradewinds/rupaykg/pull/127)
- [Hardware-edge contract PR #128](https://github.com/vishaltradewinds/rupaykg/pull/128)
- [Timestamp validation PR #129](https://github.com/vishaltradewinds/rupaykg/pull/129)
- [Hardware approval PR #49](https://github.com/vishaltradewinds/rupaykg/pull/49)
- [Evidence-bound instrument PR #51](https://github.com/vishaltradewinds/rupaykg/pull/51)
- [Dual-ledger acceptance PR #108](https://github.com/vishaltradewinds/rupaykg/pull/108)
- [Production safety/EPR/ESG PR #120](https://github.com/vishaltradewinds/rupaykg/pull/120)
- [GRI schema PR #121](https://github.com/vishaltradewinds/rupaykg/pull/121)


## 9. Expanded inventory and P0 migration finding — 2026-10-30

### Open pull-request inventory
A subsequent repository-wide GitHub search returned **71 open pull requests**, including documentation, migration, security, hardware, EPR/ESG/GRI, carbon/ICVCM, Guardian/Hedera, facility/resource-flow and AI work. The table in Section 3 is a focused dependency snapshot, not the full 71-item register. The complete inventory must be exported/rechecked before a broad merge batch.

### Migration catalogue
The current `main/migrations` directory contains **91 SQL migration files**: numbered migrations `001–087` plus four date-prefixed files `20261018` through `20261021`. It does not include `096_verification_authorization_provenance.sql` or the staging-recorded date-prefixed migrations `20261022` through `20261025`.

The read-only production/staging comparison documented on PR #108 reports:
- Production records migration `096_verification_authorization_provenance.sql`, whose source was removed from `main` as unreviewed.
- Staging records `20261022`–`20261025` migration files that are absent from the current release catalogue.
- Production and staging have materially different verification-authorization definitions.
- Staging contains asynchronous inbox/AI-intake objects absent from production, and its inbox status constraint does not permit the worker's `UNRESOLVED` state.
- The schema comparison was read-only; no reconciliation was applied.

**P0 decision:** Treat production and staging release-catalogue mismatches as a hard release blocker. Do not merge application changes that assume the migration history is reconciled; do not remove the fail-closed checks; do not edit historical migration files; do not replay or repair live migration ledgers; do not activate the scheduler. Recover exact historical source artifacts, review the security-sensitive 096 logic independently, define a canonical forward-only release catalogue, and validate it against faithful production-shaped and staging-shaped disposable PostgreSQL histories before any authorised live change.

### Migration PR collision map
- PR #105 validates duplicate migration numbers/content and duplicate object names, but is a guardrail rather than a SQL parser and does not resolve existing collisions.
- PR #106 is a **validation-only combined candidate** carrying a broad ICVCM/agentic feature set and migrations `088–107`; it must not be treated as a release candidate or merged wholesale.
- PR #120 proposes EPR/ESG migrations numbered `088–091`.
- PR #118 proposes EPR migrations numbered `097–103`.
- PR #106 proposes multiple different migrations in the same numbered range. These branches cannot be integrated by number alone. The canonical migration namespace and ownership must be decided before integration.
- PRs #124, #126, #107, #108, #91, #105, #46 and #56 touch overlapping migration runner, history, validation or production startup paths. Build one reviewed integration candidate and run the full required CI against its exact head rather than merging overlapping branches independently.

### Exact-head CI observations at this audit moment
- PR #126 head `61191f5b7252c5d89d5157cefb01c27f464a9aef`: CI run #3249 succeeded on that exact commit; it does not prove that production/staging history is reconciled.
- PR #107 head `8ef76f327cf4266d2da745f7a12c272e9b15e3e0`: CI run #2977 succeeded on that exact commit; live migration mismatch remains.
- PR #105 head `ee49c2acb9d284c32a939bc09e632f743eb61300`: CI run #2959 succeeded on that exact commit; validator collisions remain to be resolved.
- PR #91 head `b8632ceacd18a0db2d635f23904e17c19664f48b`: CI run #2448 succeeded on that exact commit; review and production-target/recovery evidence remain required.
- PR #120 head `1720df5eac80aa35d97f4b16b998ff70a2d45daa`: CI run #3213 succeeded on that exact commit; its numbered migrations conflict with other open proposals and are not approved to merge.
- PR #90 run #3361 and PR #128 run #3362 were in progress at the time checked. PR #130's documentation-only CI run #3364 was also in progress. Recheck current run state before claiming success.
- PR #108 exact head `0fc473ee69e21b05e8af5f1e476fd51835261152` has completed CI run #3279 (run ID `41024084332`) with conclusion `success`. This is evidence for that exact candidate head's configured CI only; it does not reconcile live ledgers, approve migration SQL, or authorize production changes.

### Batch A revised disposition
**Batch A remains PARTIALLY COMPLETE; P0 release-catalogue and governance blockers are confirmed.** The repository and PR inventory is more complete, but it is not a substitute for the authorised read-only environment export, exact-head test evidence, independent review, or a signed integration decision.

Next, the responsible engineering owner should create a single migration reconciliation decision packet that names canonical owners for every conflicting migration range, lists exact source hashes, defines production/staging ledger preconditions and forward-only steps, and specifies disposable PostgreSQL acceptance cases. No live change is authorised by this finding.


## 10. CI evidence correction — 2026-10-30

The branch-scoped workflow history was checked after the initial commit-specific lookup. PR #108's exact head `0fc473ee69e21b05e8af5f1e476fd51835261152` passed CI run #3279 (run ID `41024084332`): [workflow run](https://github.com/vishaltradewinds/rupaykg/actions/runs/41024084332). This corrects the earlier note that the commit-specific lookup returned no run; that earlier note described the lookup method, not an absence of CI.

This exact-head CI success is a positive engineering gate for the candidate test harness, not live migration reconciliation, independent review, deployment provenance attestation, or production release approval. The current #130 baseline-doc CI run #3365 is in progress on head `923a38b531a8db3a44f0c831e13dc728ed282b55`; wait for its conclusion before claiming documentation CI passed.


## 11. Direct read-only Neon recheck — 2026-10-30

Using the connected Neon project `steep-mud-79906940` (`rupaykg-production-fresh`), I ran SELECT-only checks against the currently listed production and staging branches. No DDL, DML, migration, ledger repair, queue update, scheduler change or deployment was performed.

| Evidence item | Production branch `br-restless-base-b44cip2h` | Staging branch `br-spring-hill-b4544vz5` |
|---|---|---|
| Database name | `rupaykg` | `rupaykg` |
| `schema_migrations` row count | 92 | 95 |
| Latest recorded migration timestamp | `2026-10-27T13:46:14.262Z` | `2026-10-20T10:48:38.647Z` |
| Divergent records | `096_verification_authorization_provenance.sql` present | `20261022`–`20261025` async/AI migrations present |
| Instrumented schema difference | Four `verifications.authorization_*` columns present | Those four columns absent |
| Async inbox tables | Not present in the previously inspected object comparison | `async_mirror_inbox` and `async_mirror_inbox_events` present |

Staging row counts re-confirmed:
- `async_mirror_inbox`: 12 rows.
- `async_mirror_inbox_events`: 29 rows.
- Inbox status distribution: PROCESSING=8, QUARANTINED=1, RECEIVED=1, RETRY=1, VALIDATED=1.
- The current `async_mirror_inbox_status_check` permits RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY and QUARANTINED; it does **not** permit `UNRESOLVED`.

Production's `schema_migrations` query returned exactly one row for version `096` and filename `096_verification_authorization_provenance.sql`. Staging's ledger query returned all four expected rows for `20261022`–`20261025`.

**Evidence boundary:** these SELECT results verify current ledger entries, row counts, columns and the staging CHECK definition at the time queried. They do not prove deployed SQL artifact hashes, all-object schema equivalence, data equivalence, or that a forward migration is safe. The previously documented read-only schema comparison and migration decision packet remain necessary.

### Operational consequence

The production/staging release-catalog mismatch is confirmed by a fresh direct read-only check, not only by an old PR description. Keep the migration runner fail-closed. Keep the async worker scheduler off. No production migration, schema repair, ledger mutation or data change is authorized. The next engineering task remains a single reviewed reconciliation candidate that passes exact-head CI and complete disposable PostgreSQL acceptance against both ledger shapes.


## 12. Acceptance-test target safety dependency

PR #115 records a test-safety defect: migration acceptance scripts that create/drop temporary PostgreSQL schemas could operate on a remote production/staging URL if a developer accidentally supplied it. The proposed guard restricts these tests to loopback PostgreSQL hosts.

Because PR #108 introduces/uses actual-runner and dual-ledger acceptance scripts that create/drop isolated schemas, **the combined migration candidate must include or otherwise independently prove the #115 host guard**. Required negative test: remote hostname is rejected before database connection or schema creation. Required positive test: the same acceptance suite passes against the CI-provisioned localhost PostgreSQL service. Do not merge #108 without this dependency being resolved and exact-head CI plus review passing.

This is an engineering test-safety control, separate from the already confirmed production/staging schema divergence. No live database was changed.


## 13. Hardware/IoT and TRL coordination refresh — 2026-10-30 13:04Z

This addendum supersedes only the earlier **in-progress** CI labels in the PR snapshot; it does not replace the full inventory or authorize a merge.

### Exact-head engineering CI observed

| PR | Workstream | Head SHA | CI run | Result |
|---|---|---|---|---|
| #90 | TRL 4→9 execution plan | `b361e75dfbc4a110626afeba0098f7822c8ba3d2` | `41057840083` | Completed successfully |
| #128 | Hardware-edge observation contract | `b561c941c3658197e3d469b92163b5a73c1e3566` | `41057869797` | Completed successfully |
| #59 | Hardware simulation/acceptance plan | `a1ddd1b5d93f571daf64f6bdce6bc36381bbe8b3` | `41059092409` | Completed successfully |
| #51 | Instrument approval/evidence-bound parameter specifications | `1824d2a342ab64850575c9488a544edf3c80cbd5` | `41058468210` | Completed successfully |

These results are exact-head software CI evidence only. They do not establish real hardware qualification, regulatory approval, field acceptance, methodology eligibility, external Guardian/Hedera acceptance, independent TRL assessment, or production readiness.

### Updated dependency constraints

- PR #49 remains draft at `4d606e188b31b890eb894aa8dfdd275f7c8ee4c4`; PR #51 remains draft at `1824d2a342ab64850575c9488a544edf3c80cbd5`. Both change the hardware approval/evidence implementation and overlap in 14 files. PR #51 is 121 commits ahead and 2 behind `main` at the latest comparison. Do not merge either branch independently.
- PR #128 is a separate hardware-edge contract and simulation package; it must consume the canonical approval/evidence model after integration rather than introduce a second registry or persistence path.
- PR #59 documents acceptance and isolation requirements. Its isolation-control requirements are a plan unless actual negative-control tests prove that credentials are stripped, outbound network is denied by default, only disposable local services are allow-listed, and target validation blocks remote database URLs. Do not report isolation as proven from documentation alone.
- TRL execution-plan PR #90 is 2 commits ahead and 2 behind `main` at the latest comparison. Reconcile its documentation against this baseline before finalizing the Batch A exit.
- Eight previously tracked inline review threads on PR #51 now report resolved, including the credential issuance/evidence-revocation serialization thread. Resolution state does not replace independent review of the current combined diff or exact-head integrated tests.

### Required next integration batch

1. Select one canonical integration order and migration/route ownership for #49/#51; inspect all shared files, migration order and authorization semantics.
2. Verify both race orderings for instrument approval/evidence rejection and for credential issuance, transfer and settlement, including persisted state after both transactions finish. Preserve the requirement that evidence rejection invalidates subsequent value-bearing uses while retirement remains possible.
3. Integrate the hardware-edge contract (#128) with the approved instrument and parameter model without creating duplicate registries.
4. Run migration validation, full disposable PostgreSQL acceptance, typecheck/build, browser smoke, production-container build and security review on the **exact integrated commit**.
5. Recheck all open PR heads and base SHAs, then update the TRL evidence ledger with links to the exact CI/review artifacts.

**Batch A remains partially complete.** No TRL advancement is claimed. Physical instrument inventory, exact-model official certificates, calibration/security packets, intended-site and methodology applicability, hardware-in-the-loop/field acceptance, and sustained operational evidence remain separate gates. Production certification remains HOLD/OFF. No merge, deployment, procurement, or production database change is authorized by this addendum.


## 13. Follow-up CI and concurrency review — 2026-10-30 13:13Z

### Baseline-document CI
- Exact head: `c55055c6255648f5967658cd8ed20876da162995` on `readiness/trl9-baseline-20261030`.
- GitHub Actions CI run **#3380** (run ID `41060292614`) completed successfully. Its configured steps passed: production dependency audit, migration validation, migration execution in the disposable CI environment, typecheck, build, browser smoke, tests including disposable PostgreSQL acceptance, production-container build, and cleanup.
- This confirms the documentation branch's exact-head configured CI. It does not establish live production/staging safety, resolve the migration-catalogue mismatch, qualify physical hardware, or advance TRL.

### Evidence-revocation / credential issuance lock-order review
- Reviewed the current `feat/mrv-evidence-bound-parameters` versions of `migrations/20261027_credential_current_mrv_instrument_evidence.sql` and `apps/src/evidence-vault-routes.ts`.
- The credential trigger locks the relevant instrument rows in UUID order, then the related evidence rows, before checking current evidence for value-bearing credential states. The evidence-review route also locks affected instrument rows in UUID order before locking the evidence row and appending the review decision. The intended instrument→evidence lock order is therefore consistent in these two inspected paths and is designed to serialize evidence rejection against credential issuance.
- The review route permits an independent reviewer to append a terminal REJECTED review for a previously VERIFIED artifact; the current-evidence check requires the latest review to be APPROVED and the stored bytes/hash/size to match. The inspected logic supports fail-closed rejection of revoked evidence for new use.
- **Scope limitation:** this was a source-level review of the current branch files, not an independent security sign-off or a proof of every transaction interleaving. The combined #49/#51 candidate still needs a single integration owner, exact combined-head CI, concurrency acceptance on the combined candidate, independent review, and production evidence-store contract confirmation. Both PRs remain draft/unmerged/undeployed.

### Current gate decision
- Keep overall TRL 9 and production certification **HOLD/OFF**.
- Keep the TRL plan (#90), evidence ledger (#93), hardware adapter/sync work (#128/#129), and hardware approval work (#49/#51) coordinated as one dependency graph; do not create duplicate readiness or instrument registers.
- No production mutation, merge, deployment, procurement, or physical-hardware qualification is authorized by this update.
