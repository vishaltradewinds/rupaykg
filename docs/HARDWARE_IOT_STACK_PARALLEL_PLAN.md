# RupayKg Hardware & IoT Stack — Parallel Execution Plan

**Date:** 2026-10-30  
**Branch:** `hardware/iot-stack-parallel-2026-10-30`  
**Status:** Integration audit and baseline complete; package-local adapter-output validation added; canonical ingestion and physical integration gated.  
**Governing standard:** Shakti Standards.  
**Scope:** Pan-India, vendor-neutral hardware-to-MRV stack; not a pilot-only architecture.

## 1. Workstream decision

This workstream is an **integration and execution track**, not a competing architecture. Reuse the national architecture and qualification model proposed in PR #59 and reconcile the hardware assurance implementation proposed in PRs #47, #49 and #51.

- PR #47 — hardware/instrumentation approval register and site/methodology HOLD.
- PR #49 — model-specific hardware approval before MRV eligibility.
- PR #51 — evidence-bound approval and parameter-specific range/unit/accuracy enforcement.
- PR #59 — pan-India architecture, open-source evaluation and software-only synthetic simulation plan.
- PR #128 — canonical integration audit, verification evidence and only the missing adapter/acceptance work.

These PRs have been observed as draft/unmerged in the available PR search results. Before implementing overlapping controls, refresh exact heads, review status and whether changes have since reached `main`. Do not assume a draft PR or its historical CI run is deployed.

## 2. Canonical source baseline

A read-only inspection of the workstation checkout `C:\\Users\\Vishal\\rupaykg-live` on `fix/guardian-hedera-gate-20261010` identified:

| Existing component | Location / contract | Use |
|---|---|---|
| Field-device enrollment/verification | `apps/src/sync-routes.ts`, `/api/v1/field-devices` routes | Reuse identity, organization and governance checks. A VERIFIED field device is not automatically an approved measuring instrument. |
| Authenticated offline sync | `/api/v1/field-sync/envelopes`; `field_sync_envelopes` | Reuse idempotency key, client sequence, capture timestamp, payload hash, server cursor and replay/conflict behavior after exact schema review. |
| Field capture UI | `apps/web/src/field-capture-experience.ts` | Existing local drafts and authoritative-sync path; browser drafts alone are not authoritative evidence. |
| Operations | `apps/src/sync-routes.ts` operation handler | Existing activity, measurement, evidence and resource-flow operations; do not invent a new write path. |
| MRV read path | `apps/src/mrv-routes.ts` | Existing MRV observation path; end-to-end instrument/evidence linkage must be proven. |
| Instrument approval/calibration gate | Proposed in PRs #49/#51 | Reconcile and reuse the exact model, evidence-vault and parameter-spec contracts. |

**Audit evidence:** `docs/HARDWARE_IOT_CANONICAL_INTEGRATION_AUDIT.md`.

The local checkout had unrelated uncommitted changes. They were preserved. The local test result below is from that checkout and is not a substitute for exact-head CI on this branch.

## 3. Test baseline completed

Command run on the workstation: `npm test -w @rupaykg/api`.

Result: **exit code 0; 69 tests; 64 passed; 0 failed; 5 skipped.** Skips include environment-gated database/integration tests. The run includes field-sync validation and runtime acceptance unit coverage. It does not establish full PostgreSQL acceptance, hardware-in-the-loop testing, instrument calibration, model certification, site acceptance or production readiness.

GitHub Actions for the current PR #128 head is also running; its exact-head CI result must be checked before merge.

## 4. Required end-to-end data path

```
Actual instrument (exact model + manual + calibration)
  → documented read-only adapter
  → raw frame preserved with instrument/time/sequence metadata
  → local durable queue and bounded retry
  → canonical authenticated RupayKg field-sync / ingestion contract
  → exact-model approval + current calibration + parameter/unit/range gate
  → immutable evidence/source lineage
  → normalized measurement / activity / custody binding
  → existing MRV and methodology evaluation
  → independent review and authorized outcome
```

No device telemetry alone proves statutory compliance, EPR fulfillment, ESG assurance, CCTS/CCC eligibility, carbon-credit issuance or government acceptance. The device must not bypass existing authorization, evidence, methodology or independent-review gates.

## 5. Execution batches and exit criteria

### Batch A — reconcile parallel changes (current)

- [x] Create isolated branch and draft PR.
- [x] Establish a source-level integration audit and no-duplicate-persistence rule.
- [x] Run targeted API unit/runtime tests on the available workstation checkout.
- [x] Refresh PR #47/#49/#51/#59 current heads/status; all remain open drafts and #49/#51 overlap in routes and migrations.
- [x] Confirm proposed approval/calibration migrations are present in overlapping draft PRs #49/#51, not merged into `main`; avoid duplicate schema/routes.
- [ ] Resolve ownership of schema, route and evidence-vault changes before writing runtime code.

### Batch B — instrument adapter contract

Do not select protocol/driver until an actual instrument model and manual are available.

- [x] Add package-local validated adapter-output contract; it does not read hardware or persist raw frames. Protocol-specific interface and raw-frame retention remain gated.
- [x] Adapter-output contract binds instrument/device/site/org, parameter, unit, event ID, timestamps, sequence, clock quality and raw payload SHA-256. Exact model/revision and parameter acceptance still belong to canonical approval register.
- [x] Local validation returns only `READY_FOR_REVIEW`; it never approves an instrument or MRV eligibility. Server-authoritative approval/calibration integration remains gated.
- [ ] Avoid unsupported RS-232/RS-485/Modbus assumptions; verify electrical/protocol details from the actual manual.
- [ ] Extend tests after canonical envelope contract is confirmed: duplicate event, same ID with changed payload, sequence regression/replay, invalid unit/range, offline replay and queue corruption. Current synthetic tests cover malformed runtime input, digest, authentication/clock state, calibration state and timestamp order.

### Batch C — calibration and source-lineage acceptance

- [ ] Reuse PR #51's exact evidence-vault artifact-version contract if accepted; do not invent a second artifact store.
- [ ] Verify source envelope → normalized measurement → evidence artifact → instrument/calibration record → MRV observation.
- [ ] Missing, expired, wrong-model, wrong-parameter, wrong-organization or rejected evidence must fail closed.
- [ ] Use disposable PostgreSQL integration tests and exact-head CI; do not use production or shared staging.
- [ ] Verify tenant/geography isolation, replay idempotency and revocation after evidence review changes.

### Batch D — actual hardware qualification

- [ ] Obtain actual site/project boundary, current operator authority and process/methodology confirmation.
- [ ] Obtain instrument make/model/serial/manual, interface and calibration/verification evidence.
- [ ] Verify applicable exact-model MeitY approval per the user's project rule, plus applicable STQC/BIS/QCO/WPC/ETA, Legal Metrology, electrical safety and procurement requirements.
- [ ] Approve BOM and cost only after functional fit, official evidence, maintainability, indigenous sourcing claims and spares are checked.
- [ ] Run authorized bench tests and compare against a trusted reference instrument.
- [ ] Run site acceptance, security, recovery and operations drills.

### Batch E — release and operations

- [ ] Complete independent review and security sign-off.
- [ ] Record evidence-backed provisional TRL; do not infer deployment readiness from simulation alone.
- [ ] Finalize installation SOP, monitoring, key rotation, calibration renewal, firmware patching, spares, incident response and secure decommissioning.
- [ ] Keep production certification HOLD/OFF until all applicable gates are accepted.

## 6. Site and methodology stop condition

The existing hardware PR notes say Kathonda is documented primarily as a mass-burning waste-to-energy facility; an active landfill-gas recovery project boundary has not been evidenced. Therefore, **do not procure landfill-methane instruments or assume BEE BM WA03.001 applicability** based solely on site name or municipal-waste activity. Confirm the intended activity, boundary, current operator, monitoring plan and methodology with authoritative evidence first. A proposed Bio-CNG/CBG project is not treated as operational until approval, commissioning and eligibility are evidenced.

## 7. Indian compliance and approval evidence

The qualification register must check exact-product scope and current validity rather than make blanket claims:

- STQC IoT System Certification Scheme: https://stqc.gov.in/iot-system-certification-scheme
- STQC scheme rules/procedures: https://www.stqc.gov.in/sites/default/files/2024-05/STQC_IoT_D01-Rules-Procedures-Issue3-0.pdf
- BIS products under compulsory certification: https://www.bis.gov.in/product-certification/products-under-compulsory-certification/
- DoT Equipment Type Approval: https://preprodeservices.dot.gov.in/equipment-type-approval-eta
- CERT-In: https://www.cert-in.org.in/
- BEE approved methodologies: https://beeindia.gov.in/view_content.php?lang=1&lid=571

These are starting points for dated applicability review, not evidence that a selected product is certified or that a project is methodology-eligible.

## 8. Current truth status

- Architecture and integration audit: documented.
- Targeted workstation API tests: passed with 5 environment-gated skips.
- PR #128 exact-head CI for commit `21d39d2e26ef2331d108e461a6e8935c4b7fcbba`: queued at last check.
- Package-local adapter-output validation: implemented; canonical ingestion, authoritative calibration/model approval and protocol-specific hardware integration remain unimplemented.
- Actual instrument model/manual/calibration evidence: not available in the reviewed context.
- Procurement, physical connection, field testing, certification, government acceptance and production deployment: not claimed or authorized.

**Definition of done:** a real, authorized instrument is enrolled and approved under the exact model/parameter contract; source data is securely acquired and replay-safe; calibration and evidence lineage are verified; the canonical MRV path accepts only admissible measurements; offline/fault/security/tenant tests pass; site acceptance and independent Shakti release gates are signed. Until then, production remains HOLD.


## Resume checkpoint — 2026-10-30 08:37 UTC

- Reopened the canonical parallel branch `hardware/iot-stack-parallel-2026-10-30` and confirmed the workstream already has a dedicated PR (#128). Do not continue the separate `hardware/iot-stack-foundation-2026-10-30` documentation branch as the primary implementation path; it is redundant and must not be merged without reconciliation.
- Rechecked PR #128's recorded commit `21d39d2e26ef2331d108e461a6e8935c4b7fcbba`: GitHub Actions CI run #3281 completed with conclusion **success** for that commit. This validates that commit only; recheck current PR head and exact-head CI before merge.
- Current repo findings: main `package.json` build chain contains the hardware-edge package only on the PR branch; README/main does not establish that this work is merged or deployed.
- Keep #47, #49, #51 and #59 as coordinated draft dependencies. In particular, #49/#51 overlap in approval routes and migrations. No duplicate approval schema, route, evidence store, or protocol-specific driver is to be introduced here.
- Immediate next task: refresh current PR heads and review gates, then expand only non-overlapping synthetic acceptance tests for payload identity/digest, invalid timestamp ordering, calibration state, authorization/clock flags, and malformed input. Stateful replay/sequence checks must be tested at the canonical ingestion boundary, not claimed by this stateless validator.
- Physical interface and BOM remain HOLD until exact instrument make/model/manual, protocol/electrical specification, site activity and monitoring-methodology boundary are supplied and reviewed.
- No production deployment, database mutation, physical device connection, procurement or hardware certification was performed.


### Follow-on test batch — 2026-10-30 08:37 UTC

- Added five synthetic-only validator tests in `packages/hardware-edge/src/index.test.ts`: unsupported schema/invalid timestamp, missing identity/unit, malformed quality flags, verified-current calibration without a record ID, and revoked device identity.
- Test change commit: `1c7eef26ad9563a11de25e7a2e065b5bf6183637`.
- Exact-head CI for this new commit has not yet appeared in the workflow/status query; do not claim the new tests pass until CI or an isolated test run confirms them.
- These tests validate stateless adapter-output shape only. Duplicate/replay detection, monotonic sequence enforcement across events, tenant/facility authorization, exact-model approval and calibration verification remain canonical server-side acceptance responsibilities.

### Follow-on validation hardening — 2026-10-30 08:39 UTC

- Tightened `validTime` in `packages/hardware-edge/src/index.ts`: observations must use a full timestamp with an explicit timezone (UTC `Z` or numeric offset). Date-only and timezone-naive values are ambiguous and are quarantined.
- Added tests for date-only, timezone-naive, space-separated timestamps, and a valid RFC3339 offset timestamp.
- Implementation commit: `3d7152f36cb9d447fbc1f45943527a67527e1fd6`.
- Test commit: `eaca8bcd772d32098d1c3bf199535e83ab5983ce`.
- Exact-head CI for this follow-on batch is not yet visible. Treat test outcome as **PENDING**, not passed.
- Scope remains stateless payload validation. Event replay, duplicate ID/payload conflicts, monotonic sequence across observations, tenant/site authorization, model approval and evidence-vault verification must be enforced at the canonical server boundary.

### Timestamp hardening follow-up — 2026-10-30

- Strengthened the adapter validator to require a full timestamp with an explicit timezone and reject impossible calendar/clock values (for example, 30 February or hour 25).
- Added synthetic tests for timezone-naive/date-only inputs, valid numeric timezone offsets, and impossible calendar/clock fields.
- Latest implementation commit: `4033dafd56d3ddcef07e538617600b38021565ee`.
- Latest test commit: `e40fa72ea685996379e19626ab0aaefc89a9144a`.
- GitHub Actions runs observed for earlier commits remain `in_progress`; no exact-head run/result for the latest commit was returned at the time of this checkpoint. **CI status: PENDING.** Do not mark this batch passed or merge on the strength of earlier-head CI.
- No protocol driver, physical hardware, approval register, evidence-vault, database schema, production ingestion path, or deployment was changed in this batch.

### Validator correction — 2026-10-30

- Review of the generated source caught over-escaped regex metacharacters before the latest CI run completed. Corrected the timestamp regex to standard TypeScript/JavaScript regex syntax in commit `5d40c6a68e3c612a43e6658f5cb06ee06e5da630`.
- The exact-head CI must validate this corrected head; the earlier queued run is not sufficient. Status remains **PENDING** until the latest head's checks finish.

### Canonical ingestion boundary audit — 2026-10-30 08:42 UTC

- Exact-head hardware-edge validation workflow #3293 completed with conclusion **success** for code commit `5d40c6a68e3c612a43e6658f5cb06ee06e5da630`. The branch's subsequent documentation-only checkpoint commit is not itself the tested code head; re-run/check CI on the latest PR head before merge.
- Read-only source audit of `apps/src/sync-validation.ts` and `apps/src/sync-routes.ts` on `fix/guardian-hedera-gate-20261010` confirms the canonical field-sync path already checks verified device identity, idempotency-key payload conflicts, and client-sequence collisions inside a database transaction. Same-sequence/same-key/same-payload replays are idempotent; collisions are recorded and rejected.
- **Integration gap identified:** current `validateSyncEnvelope` accepts `capturedAt` if `Date.parse` can parse it, which can admit date-only/timezone-naive timestamps. The new hardware-edge adapter validator is stricter. This is a canonical ingestion contract issue to reconcile with the owning sync/migration PRs before production linkage; do not silently patch shared `sync-validation.ts` from this parallel branch.
- Hardware edge adapter remains a pre-ingestion shape validator, not a canonical persistence or authorization path. Any future linkage must preserve authenticated `/api/v1/field-sync/envelopes` intake and its existing idempotency/sequence handling, then add exact-model/parameter/calibration authorization at the approved owner boundary.
- No canonical route, migration, evidence vault, production database, physical interface, or instrument approval code was changed in this audit batch.


### Coordination and exact-head CI checkpoint — 2026-10-30 08:46 UTC

- Confirmed GitHub Actions CI run #3295 for documentation commit `4e5cc15dd2a2cea7e3d6de787b38672b4d46b7dd` completed successfully. Its workflow passed dependency audit, migration validation/execution, typecheck, build, browser smoke, tests including disposable PostgreSQL acceptance, and production-container build. This is the latest confirmed commit-specific CI evidence available during this checkpoint; still refresh the actual PR head before any merge.
- Re-enumerated changed paths for PRs #47, #49, #51, #59 and #128. PR #49 and #51 both change `apps/src/sync-routes.ts`, `apps/src/mrv-routes.ts`, `apps/src/mrv-instrument-approval.ts`, `apps/src/mrv-instrument-routes.ts`, `apps/src/server.ts`, migrations `088_mrv_instrument_approval_register.sql` and `089_measurement_instrument_binding_guard.sql`, plus the approval API documentation and dependency lockfile. PR #51 adds evidence-vault binding, parameter specifications, additional migrations and broader MRV integrity changes on top of the shared approval implementation.
- Merge-order/ownership decision required from maintainers: do not merge #49 and #51 independently without an explicit reconciliation. Treat #51 as the broader candidate for reviewing the combined approval implementation, and determine whether #49 should be superseded/closed or whether its commits are needed separately. This is a recommendation for review, not an assertion that #51 is safe to merge.
- No overlapping application source or migration files were changed by PR #128. Keep it isolated to the adapter contract and audit docs until the approval owner and canonical sync-validation owner are settled.
- Canonical `capturedAt` strict-timezone validation remains a documented issue; the current audit was read-only. Add the regression test/change in the PR that owns `apps/src/sync-validation.ts`, and ensure all clients using the canonical field-sync route receive the same contract.
- No production database, deployment, physical hardware, procurement, calibration, or certification was performed or authorized.
