# Hardware Approval Integration Gate — 2026-10-30

**Status:** COORDINATION PLAN — NOT AN INTEGRATION APPROVAL  
**Canonical repository:** `vishaltradewinds/rupaykg`  
**Main baseline used to create this document branch:** `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`  
**Governance:** Shakti Standards  
**Release disposition:** HOLD — no merge, migration, device procurement, site connection, or production activation authorized by this record.

## 1. Decision

PR #49 and PR #51 are overlapping candidate implementations of model-specific instrument approval and evidence-bound measurement acceptance. Do not merge either independently until one combined integration candidate is created from current `main`, reviewed as a whole, and passes exact-head CI.

The source branches both use the same older base SHA `0ddcf6087620880e21ea60e954c9f05d6b759469`; current main baseline is `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`. This is branch divergence requiring a reviewed integration—not a reason to force-update either source branch or to resolve conflicts mechanically.

## 2. Candidate snapshots inspected

| Candidate | Head SHA at checkpoint | Prior recorded CI | Limit |
|---|---|---|---|
| PR #49 — model-specific hardware approval | `4d606e188b31b890eb894aa8dfdd275f7c8ee4c4` | Run `40198548747`, SUCCESS | CI applies only to that branch head and environment. |
| PR #51 — evidence-bound approval and parameter specs | `1824d2a342ab64850575c9488a544edf3c80cbd5` | Run `41058468210`, SUCCESS | CI applies only to that branch head and environment. |
| PR #108 — migration-history/dual-ledger acceptance | `e4dcb3588d208968c49947d0493f98da6884aed2` | Run `41064298999`, SUCCESS | Separate candidate; does not resolve live migration-source provenance. |

None of these results is evidence of physical instrument qualification, current production/staging database provenance, site acceptance, legal approval, or TRL advancement.

## 3. Confirmed overlap and migration hazards

Inspection found the following paths shared by #49 and #51:

- `apps/src/mrv-instrument-approval.ts`
- `apps/src/mrv-instrument-routes.ts`
- `apps/src/mrv-routes.ts`
- `apps/src/server.ts`
- `apps/src/sync-routes.ts`
- approval-specific tests and `runtime-acceptance-v2.test.ts`
- API documentation, migration README and package lock
- `migrations/088_mrv_instrument_approval_register.sql`
- `migrations/089_measurement_instrument_binding_guard.sql`

The two `088` migration files and the two `089` migration files were inspected and have matching Git blob SHAs across both source branches. **They must appear only once in the integrated migration history.** Do not duplicate, rename, rewrite, or replay them merely to make branch history or live ledger state appear consistent.

PR #51 also contains `migrations/20261031_mrv_instrument_current_expiry_guard.sql`. This filename is dated 2026-10-31, one day after this checkpoint. Its intended release date, dependency order, naming convention, manifest/catalogue inclusion and upgrade-path compatibility must be explicitly reviewed before inclusion.

## 4. Required integration procedure

### Gate A — freeze and capture inputs
1. Re-fetch current main SHA, both PR heads, changed-file lists, migration catalogues and exact diffs immediately before integration.
2. Record the authoritative intended feature scope and designate one integration owner and one independent reviewer.
3. Keep #49 and #51 Draft; no merge, rebase or force-push of their source branches is implied by this plan.

### Gate B — construct one candidate from current main
1. Create a dedicated integration branch based on the then-current main SHA.
2. Integrate the smallest coherent set of required changes from #49/#51. Do not blindly merge both branches.
3. Resolve shared application files manually against current main and document every behavior decision.
4. Include migration 088 and 089 once only; inspect all subsequent migrations for dependency ordering and idempotent, forward-only upgrade behavior.
5. Treat the 2026-10-31 migration as blocked until its date/version intent and catalogue ordering are explicitly resolved.
6. Preserve fail-closed behavior: unknown device/model, unverified approval, missing/expired calibration, unapproved parameter, stale/revoked evidence, or authorization failure must not be accepted as authoritative MRV evidence.

### Gate C — prove the combined candidate
Required exact-head checks, with results retained:
- dependency/security audit, typecheck, production build and production-container build;
- migration catalogue validation and fresh-install migration run in disposable PostgreSQL;
- upgrade-path tests for every supported migration history, including dual-ledger histories and duplicate/missing/wrong-version source cases;
- approval-route, tenant/site isolation, authorization and sync regression tests;
- instrument/model/firmware identity, parameter/unit/range/resolution/accuracy, calibration validity, approval revocation, evidence hash/version and reviewer-locking negative tests;
- full suite and any required browser/runtime acceptance tests.

Any unexplained migration mismatch or critical acceptance failure blocks integration. Never alter a live migration ledger to force CI green.

### Gate D — independent review and decision
1. Review the full combined diff, migration order and test evidence independently of the implementation author.
2. Verify exact-head CI against the candidate SHA after the last change.
3. Keep the PR Draft if CI is pending/failed, independent review is missing, or migration provenance remains unresolved.
4. Only an authorized maintainer may decide merge after the repository's required checks and reviews pass. This document grants no merge permission.

## 5. External evidence and statutory applicability remain separate

Software approval logic is not proof that a real instrument is lawful or fit for use. For each candidate device, retain:
- exact manufacturer, model/SKU/revision, serial/asset ID and firmware;
- official certificate/registry evidence and a documented applicability decision for MeitY/STQC/BIS/QCO/WPC/Legal Metrology or other obligations relevant to that exact product and intended use;
- instrument manual, interface/register-map details, measurement range, units, accuracy/uncertainty, resolution and environmental limits;
- valid calibration/verification certificate, traceability, as-found/as-left results and due date;
- authorized site/operator data, installation/commissioning evidence and independent field acceptance.

Do not infer that MeitY approval is generic across categories, or that Indian origin, a processor brand, a vendor claim or open-source status establishes the required approval. If the required applicable route or exact-model evidence cannot be verified, record BLOCKED and do not procure/connect/use the device under the strict project rule.

## 6. Site and methodology boundary

The Kathonda/Jabalpur site intake remains OPEN and HOLD. Public records are leads, not current operator confirmation. The known public-record description points to a WtE mass-incineration plant; do not assume a landfill-methane recovery project or select methane instrumentation by default. Establish the actual operating process, project boundary and methodology eligibility from current authoritative/operator evidence before finalizing measurement requirements or a hardware BOM.

## 7. Separate production migration-provenance blocker

PR #108's green disposable-PostgreSQL CI does not establish which migration source was deployed to live production or staging. Before any live reconciliation, require authorized read-only ledger and schema evidence from both environments, canonical migration/source provenance, schema fingerprints, duplicate/removed-source analysis, fresh-install and upgrade-path acceptance, and a reviewed forward-only plan. No production read/write, replay, deployment, scheduler activation or certification is authorized here.

## 8. Exit status

- Combined current-main integration candidate: **NOT CREATED**
- Exact-head CI for combined candidate: **NOT RUN**
- Independent combined-diff review: **NOT RUN**
- Production/staging migration provenance: **BLOCKED / NOT ESTABLISHED**
- Physical device qualification and site acceptance: **NOT ASSESSED / NOT DEMONSTRATED**
- Production certification: **HOLD / OFF**
- TRL 5: **NOT DEMONSTRATED**; software remains provisional TRL 4; integrated-platform TRL unverified.

**Next action:** perform Gate A, then create and test a single coordinated candidate only after the exact current heads and intended scope are revalidated. Do not represent this coordination document as code integration or qualification evidence.

**Shakti Standards:** ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.


## 9. Source-branch scope audit — 2026-10-30 13:49Z

A fresh comparison against current `main` (`54a7fe1ceb41b37a68720a71c10a1dd03af30dea`) confirms that neither source branch is a clean current-main integration candidate:

- PR #49 is 3 commits ahead and 2 behind main from merge base `0ddcf6087620880e21ea60e954c9f05d6b759469`; its comparison contains 14 files.
- PR #51 is 121 commits ahead and 2 behind main from the same merge base; its comparison contains 38 files.
- PR #51's diff includes related but broader changes to acceptance seeding, evidence-vault routes, Guardian/Hedera handling, registry eligibility, settlement guards, synchronization validation and associated tests/docs, as well as the instrument-approval feature.

**Integration consequence:** do not transplant all 38 files or treat #51 as a clean superset without scope review. The integrated candidate must separate the minimum necessary approval/evidence-bound parameter changes from unrelated feature history, while retaining required dependencies. For every selected file, record why it is required and review the current-main delta. Explicitly decide whether the broader evidence-vault and credential-currentness migrations are prerequisites for the new approval behavior; do not silently omit required schema dependencies or pull in unrelated behavior.

### Added pre-integration checklist
- [ ] Confirm the source PR heads have not changed since this comparison.
- [ ] Build a file-level inclusion/exclusion matrix for all 38 #51 paths.
- [ ] Map every migration to its prerequisite schema/function and canonical execution order.
- [ ] Review whether current-main already contains newer versions of files changed by the source branch.
- [ ] Verify no behavior in acceptance-seed, Guardian/Hedera, registry, settlement or sync changes is lost or unintentionally imported.
- [ ] Produce a single combined diff against current main; do not use the PR's old merge base as the review baseline.
- [ ] Run exact-head CI only after the complete candidate is assembled.

This audit intentionally narrows the next implementation step: the safe next action is scope/dependency mapping, not an automatic branch merge.


## 10. File-level inclusion / exclusion matrix — 2026-10-30 13:50Z

### Revalidated source and CI facts

- PR #136 coordination-document commit `ae1f7d5b9e8d6edd51b3c7a6f62b68101472502b` completed workflow run #3404 (run ID `41066425963`) successfully. Dependency audit, migration validation, disposable migration run, typecheck, build, browser smoke test, tests including disposable PostgreSQL acceptance, production-container build and cleanup all completed successfully. This validates the **documentation-only PR #136 head**, not an application integration candidate.
- The current-main migration README ends at migration 087. Requests for `migrations/088_mrv_instrument_approval_register.sql` and `migrations/089_measurement_instrument_binding_guard.sql` at `main` returned 404, confirming neither is currently present on main. The two source branches contain byte-identical/blob-identical 088 and 089 files; add each once if approved.
- PR #51's migration `20261022_mrv_instrument_evidence_parameter_specs.sql` requires existing evidence-vault tables and adds `mrv_instrument_parameter_specs`; its migration README says it must follow the evidence-vault schema. Migrations 20261027 and 20261030 add current-evidence controls to credential/registry/settlement paths. Migration 20261031 is explicitly future-dated at this checkpoint and remains excluded pending chronology and catalogue review.

### Disposition matrix for all 38 paths in PR #51

| Path | Disposition for a minimal approval/parameter candidate | Reason / required handling |
|---|---|---|
| `apps/src/acceptance-seed.test.ts` | DEFER | Acceptance-fixture behavior is a separate concern; include only if the selected candidate changes its contract. |
| `apps/src/acceptance-seed.ts` | DEFER | Avoid importing unrelated fixture seeding changes; retain existing fixture exclusion controls. |
| `apps/src/evidence-vault-review-transition.test.ts` | CONDITIONAL DEPENDENCY | Include if evidence review/rejection transitions are changed or required to prove the selected current-evidence contract. |
| `apps/src/evidence-vault-routes.ts` | CONDITIONAL DEPENDENCY | Compare against current main; include only the minimum evidence-artifact API required by parameter-spec references, not an old branch snapshot. |
| `apps/src/evidence-vault.integration.test.ts` | CONDITIONAL DEPENDENCY | Required if the selected diff changes evidence-vault integration; otherwise keep as existing regression coverage. |
| `apps/src/hardware-simulation.test.ts` | INCLUDE / REVIEW | Relevant simulation coverage; verify it tests software contracts only and label physical/site acceptance as unproven. |
| `apps/src/hedera-anchor.test.ts` | DEFER | Broader anchoring behavior is not automatically part of the approval gate. Include only for a demonstrated direct dependency. |
| `apps/src/hedera-anchor.ts` | DEFER | Do not import unrelated Guardian/Hedera changes as incidental branch history. |
| `apps/src/mrv-evidence-concurrency-db.test.ts` | CONDITIONAL DEPENDENCY | Include if evidence review/issuance lock ordering is included; test rejection-vs-issuance race behavior on disposable PostgreSQL. |
| `apps/src/mrv-instrument-approval-db.test.ts` | INCLUDE | Required for database-level approval, evidence, calibration, parameter and fail-closed behavior. |
| `apps/src/mrv-instrument-approval.test.ts` | INCLUDE | Required unit tests for approval/parameter validation. |
| `apps/src/mrv-instrument-approval.ts` | INCLUDE | Core approval and parameter-spec validation logic; reconcile manually against current main. |
| `apps/src/mrv-instrument-routes.ts` | INCLUDE | Core organization-scoped instrument register APIs and authorization. |
| `apps/src/mrv-replay-identity.test.ts` | DEFER | Replay-identity integrity is a separate behavior set unless changed code directly depends on it. |
| `apps/src/mrv-routes.ts` | INCLUDE / SCOPE EDIT | Integrate only approval, parameter and current-evidence checks needed for MRV submission; preserve unrelated current-main behavior. |
| `apps/src/registry-routes.ts` | CONDITIONAL DEPENDENCY | Include only if current-evidence checks are intentionally required at registry eligibility; review all unrelated registry changes. |
| `apps/src/server.ts` | INCLUDE / SCOPE EDIT | Register required instrument/evidence routes and imports; do not replace current-main server code wholesale. |
| `apps/src/sync-routes.ts` | INCLUDE / SCOPE EDIT | Required to enforce the same instrument/parameter gate on offline sync; preserve existing sync envelope and authorization semantics. |
| `apps/src/sync-validation.test.ts` | SEPARATE IOT WORKSTREAM | Explicit-timezone/calendar validation belongs to the parallel IoT timestamp-hardening scope; integrate as a separately reviewed, non-conflicting change. |
| `apps/src/sync-validation.ts` | SEPARATE IOT WORKSTREAM | Same as above; do not lose timestamp hardening, but do not conflate it with instrument approval. |
| `apps/test/cors-runtime.test.ts` | CONDITIONAL | Include if new routes or runtime behavior require its added CORS assertion; compare against current main. |
| `apps/test/mrv-instrument-test-fixture.ts` | INCLUDE | Shared synthetic fixtures for instrument approval tests; ensure clearly test-only and never accepted as field qualification evidence. |
| `apps/test/runtime-acceptance-v2.test.ts` | SCOPE EDIT | Preserve only assertions needed to test the selected approval/sync behavior; review unrelated acceptance changes separately. |
| `apps/test/settlement-credential-guard.test.ts` | CONDITIONAL DEPENDENCY | Include if the selected current-evidence migration changes credential transfer/settlement eligibility. |
| `apps/test/settlement-reconciliation.test.ts` | DEFER | Settlement reconciliation changes are outside minimal instrument approval unless a demonstrated dependency requires them. |
| `docs/GUARDIAN_LIVE_ACCEPTANCE.md` | DEFER / REVIEW DIFF | Do not pull in anchoring documentation changes without a direct contract change; live Guardian/Hedera evidence remains a separate gate. |
| `docs/MRV_INSTRUMENT_APPROVAL_API.md` | INCLUDE | Update the API contract to match the final integrated route and evidence-vault behavior. |
| `docs/RUPAYKG_NO_COST_IOT_SIMULATION_RUNBOOK.md` | SEPARATE IOT WORKSTREAM | Keep in the parallel IoT simulation workstream; simulation does not prove physical qualification. |
| `docs/SETTLEMENT.md` | DEFER | Settlement docs are unrelated unless current-evidence settlement enforcement is expressly included. |
| `migrations/088_mrv_instrument_approval_register.sql` | INCLUDE ONCE, AFTER REVIEW | Not on main. Required for the instrument register/decision history. Never duplicate. |
| `migrations/089_measurement_instrument_binding_guard.sql` | INCLUDE ONCE, AFTER REVIEW | Not on main. Depends on 088 and binds new measurement writes to instrument/parameter; preserve historical rows as unbound. |
| `migrations/20261022_mrv_instrument_evidence_parameter_specs.sql` | CONDITIONAL, LIKELY CORE | Required for structured per-parameter specs and evidence-vault artifact-version binding. First prove its prerequisites exist in the integrated migration sequence and verify clean-install plus supported upgrade paths. |
| `migrations/20261026_mrv_measurement_freeze_after_submission.sql` | SEPARATE SCOPE / CONDITIONAL | Adds broad post-submission immutability; do not silently include as an approval dependency. If intended, review correction/superseding workflow and concurrency tests. |
| `migrations/20261027_credential_current_mrv_instrument_evidence.sql` | CONDITIONAL DEPENDENCY | Required if issuance must re-check current evidence; validate ordering after evidence-vault/parameter schema and test lock order. |
| `migrations/20261030_existing_credential_current_mrv_evidence_guard.sql` | CONDITIONAL DEPENDENCY | Extends current-evidence checks to existing credentials/transfers/settlements. Include only with explicit registry/settlement scope and independent review. |
| `migrations/20261031_mrv_instrument_current_expiry_guard.sql` | EXCLUDE / BLOCKED | Future-dated relative to this checkpoint. Require owner-approved intended release date, filename chronology, manifest/catalogue ordering and upgrade review before reconsideration. |
| `migrations/README.md` | INCLUDE AS MERGED EDIT | Main README is through 087; add descriptions for only the approved migrations in canonical order, with no duplicate entries or misleading statement that live ledgers are reconciled. |
| `package-lock.json` | CONDITIONAL | Reproduce only deliberate dependency changes against current main; inspect lockfile diff and audit results rather than importing the old lockfile wholesale. |

### Integration conclusion

The matrix is a scoped review disposition, not approval to merge any source branch. Build the candidate from current main and take the smallest coherent set: core register/route/measurement/sync enforcement, migration 088/089 once, parameter-spec/evidence-vault dependencies only after prerequisite proof, aligned tests and API documentation. Keep timestamp hardening tracked in the parallel IoT workstream. Treat credential-currentness, post-submission freeze, Guardian/Hedera, registry and settlement changes as explicit scope decisions rather than accidental imports.

Before writing application code, verify the latest source heads and compare the actual current-main versions of every selected shared file. The production/staging migration provenance blocker is unchanged; no live database action is authorized.


## 11. Minimal current-main integration candidate opened — 2026-10-30 13:57Z

Draft PR #137: https://github.com/vishaltradewinds/rupaykg/pull/137  
Branch: `integration/instrument-approval-minimal-2026-10-30`  
Base SHA: `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`  
Candidate head at opening: `e8b46f74f3b01b9df08cb90c9fdacacda4407924`  
Exact-head CI run #3412 / run ID `41068514359`: **IN PROGRESS** at first check.

### Selected candidate scope

- Adds the instrument approval module and organization-scoped register routes.
- Enforces instrument+parameter approval for direct measurement writes and offline `MEASUREMENT_CREATE` sync.
- Rechecks instrument approval before MRV submission.
- Adds migrations 088 and 089 once, focused tests and API/migration documentation.
- Reconciles the three shared application files against current `main` rather than replacing them with complete old-branch snapshots.
- Candidate is Draft, not merge-authorized, and not deployed.

### Deliberate exclusions and limitations

- Does not include migration 20261022 parameter-spec/evidence-vault schema extensions, 20261026 measurement freeze, 20261027/20261030 credential-currentness migrations, Guardian/Hedera changes, or the future-dated 20261031 migration. Those need separate dependency and scope decisions.
- Does not resolve production/staging migration ledger/source provenance.
- Does not prove exact-model statutory approval, calibration, device identity/security lifecycle, physical bench/site acceptance, methodology eligibility or TRL advancement.

### Required next gate

Wait for run #3412 to finish and repair any actual failures on the candidate branch. Then independently inspect the full combined diff, migration ordering and all fail-closed paths. Keep Draft until exact-head CI is green, independent review is complete, supported upgrade paths are established and migration provenance has a separate authorized reconciliation packet. No merge, deployment, live DB operation, device procurement or certification is authorized by opening this candidate.


## 12. Candidate CI correction and retest — 2026-10-30 14:06Z

PR #137 run #3412 (`41068514359`) initially failed because runtime acceptance submitted a measurement without the newly required instrument code and parameter. The test contract was corrected to assert fail-closed behavior for missing and unregistered instruments in commit `c9a449655fbc29bd03350d64771ab3a8602b3c18`.

Rerun #3414 (run ID `41068861872`) at exact candidate head `c9a449655fbc29bd03350d64771ab3a8602b3c18` is now **SUCCESS**: dependency/security audit, migration catalogue validation, disposable PostgreSQL migration run, typecheck, build, browser smoke test, full tests including disposable PostgreSQL acceptance, and production-container build all passed.

This is engineering CI evidence for the draft candidate only. It does not resolve production/staging migration provenance, independent code review, exact-model statutory approval, calibration, physical/site acceptance, methodology eligibility, TRL advancement, or production certification. PR #137 remains Draft; no merge/deployment/live DB action occurred.


## 13. Static integration review finding — separation of duties added

A source review of draft PR #137 found that the initial candidate allowed the registering identity to self-approve an instrument. This is inconsistent with independent evidence review. Remediation added to the candidate:

- API review route rejects `VERIFIED` when reviewer identity equals `registered_by_identity_id` (`MRV_INSTRUMENT_SEPARATION_OF_DUTIES_REQUIRED`).
- Migration 088 database trigger independently rejects direct SQL self-approval, so the API check is not the only control.
- PostgreSQL acceptance test now uses a distinct reviewer for legitimate approval and explicitly asserts self-approval fails.
- API and migration documentation updated to state the dual-control rule.

Remediation commits: `6a706b55bb2a3e57db29c64c133817a8d939d9db`, `964df30e3a7174f4c5d0228c5476626d140f4409`, `aae901fa7557edd3143180388c4a66df1d895375`, `8e283a076d5afbc3ce1d56f03fdcca72c445276f`. The latest amended head requires a fresh exact-head CI run; the earlier green run does not validate these changes. Keep PR #137 Draft until CI and independent review pass.


## 14. Verified-state downgrade bypass and durable immutability correction

A second source review found that locking fields only while `old.approval_status = 'VERIFIED'` would permit an operator to downgrade to HOLD and then mutate the previously verified model/evidence. Migration 088 now checks the append-only decision history for any prior `VERIFIED` decision; model identity, instrument classification, parameter mapping, MeitY/calibration/security evidence, and registration provenance remain immutable thereafter. Reviewer metadata can change only alongside an explicit status transition, whose decision is appended to the decision history; this preserves the ability to place a previously verified instrument on HOLD/EXPIRED without opening an evidence-mutation bypass. The database test exercises VERIFIED → HOLD → attempted model substitution and expects rejection, rolling the test sequence back afterward.

Latest amended candidate head: `365bd3f28026c79cfbbe33fabb8b5d581c92bf64`. Fresh CI run #3426 / `41070461964` is in progress. Earlier runs validate earlier commits only; do not mark the latest candidate green until this exact run passes. PR #137 remains Draft, unmerged, and undeployed.
