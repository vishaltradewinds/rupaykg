# RupayKg Hardware/IoT Stack — Resume Checkpoint

**Checkpoint date:** 2026-10-30  
**Repository:** `vishaltradewinds/rupaykg`  
**Workstream branch:** `hardware/iot-stack-parallel-2026-10-30`  
**PR:** #128 — draft, open, not merged  
**Exact head checked:** `7fae5b9f6bcda0fae5b8d1a6f74ef9eeb9bd6adc`  
**Exact-head CI:** GitHub Actions run #3303 — completed successfully  
**Release posture:** ENGINEERING ONLY; production/hardware qualification HOLD.

## Confirmed state

- The isolated `@rupaykg/hardware-edge` package validates adapter-output shape and rejects malformed identity, timestamp, sequence, digest, authentication/clock state and calibration state.
- Timestamp validation requires an explicit timezone and rejects impossible calendar/clock values.
- `READY_FOR_REVIEW` is intentionally non-authoritative. It is not device authentication, exact-model approval, calibration verification, measurement acceptance, MRV eligibility, statutory compliance or production acceptance.
- Root build includes the hardware-edge package.
- PR #128 changes only its audit/plan documents and the isolated edge package/build files; it does not add an approval route, migration, duplicate evidence store or protocol-specific driver.
- Current PR #128 head CI run #3303 passed. This is engineering CI evidence only; it is not a physical hardware or site acceptance test.

## Parallel PR coordination snapshot

At this checkpoint, PRs #47, #49, #51 and #59 are open draft PRs. PRs #49 and #51 overlap on approval routes and migrations. PR #51 is the broader candidate for review of the combined approval/evidence-bound parameter implementation, but it is not approved for merge merely by being broader. Maintainers must explicitly resolve ownership and merge order. Do not independently merge overlapping implementations or copy their routes/migrations into PR #128.

## Next batch — execute in this order

1. **Refresh all heads and changed paths immediately before integration.** Re-check #47/#49/#51/#59 and whether any of their changes have reached `main`; previous snapshots can become stale.
2. **Resolve canonical contract ownership.** Identify the owner of `apps/src/sync-validation.ts` and the approval/evidence-vault implementation. The strict timezone rule currently differs between the isolated edge validator and the previously audited canonical field-sync validator. Add a regression test/change only in the owning branch after checking its latest head; do not patch shared sync code from this parallel branch.
3. **Run isolated synthetic acceptance tests** for the full boundary: same event ID/same digest idempotent replay; same event ID/different digest conflict; duplicate sequence; sequence regression; offline replay; malformed/corrupt queue entry; tenant/site mismatch; wrong instrument/model/parameter; unit/range/resolution/accuracy mismatch; missing/expired/rejected calibration; evidence artifact version/hash mismatch; and revocation after review. Test stateful replay and authorization at the canonical server/database boundary, not in this stateless package.
4. **Prove immutable lineage** from authenticated source envelope and payload hash through normalized measurement, evidence artifact/version, instrument and calibration decision, and MRV observation. Reuse canonical persistence and evidence storage; do not create parallel records or write paths.
5. **Qualify an actual instrument only after evidence intake.** First candidate remains weighbridge-to-MRV, not a committed device choice. Require exact make/model/serial, manual, interface/electrical details, parameter mapping, calibration package, firmware/security lifecycle evidence, and official model-specific applicability/approval evidence. No RS-232/RS-485/Modbus assumption until the manual confirms it.
6. **Apply the user’s MeitY constraint correctly.** Maintain HOLD unless applicable MeitY approval can be evidenced for the exact finished product/model and intended use. Separately check current STQC, BIS/QCO, WPC/ETA, Legal Metrology, electrical safety and procurement requirements where applicable; do not imply one blanket certificate applies to every industrial instrument.
7. **Record provisional TRL with evidence.** Software contract + synthetic tests alone do not justify field-validation or operational TRL. Track bench validation, reference-instrument comparison, environmental/fault testing, site acceptance and sustained operation as distinct evidence gates.
8. **Keep site/methodology applicability gated.** Do not assume Kathonda is an active landfill-gas recovery project or that BM WA03.001 applies. Confirm the real activity boundary, operator authority, monitoring plan and methodology before sensor/BOM selection.
9. **Release only after independent review and operations readiness:** security review, calibration-renewal process, key rotation, firmware patching, local spares, queue recovery, monitoring, incident response, decommissioning, site acceptance and signed Shakti Standards gates.

## Hardware architecture rule

Pan-India and vendor-neutral: qualified measuring instrument → documented read-only adapter → durable local queue → authenticated canonical field-sync/ingestion → exact-model and parameter approval → calibration/evidence checks → normalized measurement/custody lineage → canonical MRV/methodology evaluation → independent review. Compute/gateway hardware (including ESP32 or future Indian RISC-V candidates such as VEGA/SHAKTI) is a separate qualification axis from the measuring instrument. No processor/board name alone establishes MeitY approval, metrological fitness or MRV eligibility.

## Explicit non-claims / stop conditions

No physical instrument is selected or connected. No purchase, calibration, field test, site acceptance, statutory approval, carbon-credit eligibility, production database mutation, deployment or certification is claimed or authorized. No BOM or CAPEX estimate should be treated as approved until the actual requirements and model-specific evidence are verified.

**Resume command:** “resume IoT Stack workstream” — continue at Next batch item 1, refresh live PR heads and canonical ownership, then work in coherent batches without disturbing parallel ESG/EPR/GRI/CCTS work.


## Follow-up execution update — 2026-10-30 12:28Z
- Refreshed live PR heads and changed-file lists for #47, #49, #51, #59 and #128. All remain open drafts; #49/#51 still overlap on the instrument-approval routes and migrations.
- Canonical timestamp discrepancy was confirmed in `main/apps/src/sync-validation.ts`: it previously relied on `Date.parse` alone.
- Corrective change and regression tests were committed to the owning integration branch for PR #51: `021926e533109d626a952c31680143085c2eecb1`. Field-sync now requires explicit timezone and rejects impossible calendar/clock values; tests cover date-only, timezone-naive, invalid dates/times, invalid offset minutes, explicit offsets and fractional seconds.
- PR #51 body updated with this follow-up. Exact-head CI for the new commit has not yet been observed; PR remains draft and must not be merged until CI and independent review pass.
- The PR #128 checkpoint document itself is current through the original exact-head validation plus this coordination note; no production database, hardware, or deployment changes were made.


## Follow-up execution update — 2026-10-30 12:35Z

- Refreshed PR #128 head: `0e4bef4c5a420902af494503e448dd3d04dca041`. Exact-head CI run #3356 (`41055626185`) completed successfully, including production-container build and cleanup. PR #128 remains draft/open/unmerged.
- PR #51 exact head is `e5388fd1db1533db1d5abcf7bd5f52fc5f09ad2b`. The prior concurrency failure was traced to the test calling an eligibility predicate while the instrument was deliberately HOLD; the predicate correctly requires VERIFIED. The test was changed to exercise the database evidence-binding trigger during the HOLD→VERIFIED transition and assert the specific fail-closed rejection when evidence review is rejected.
- PR #51 CI run #3357 (`41056362508`) has passed dependency audit, migration validation/execution, typecheck, build, browser smoke and the full disposable PostgreSQL acceptance tests. Production-container build is still running; no final workflow conclusion yet.
- Do not claim #51 passed until the entire workflow is completed successfully. Keep #47/#49/#51/#59/#128 as drafts and unmerged until overlap ownership, exact-head CI and independent review are resolved.
- Hardware gates remain unchanged: no selected/connected physical instrument, no verified exact-model statutory approval, no calibration/bench/site acceptance, and no production deployment or certification.


## Exact-head validation update — 2026-10-30 12:39Z
- Current PR #128 head is `3b78a4091bca919ea35ae60911160fe2ad8be2b6` (includes the checkpoint update).
- Exact-head CI run #3358 (run ID `41056559100`) completed successfully, including all configured validation and production-container build steps.
- PR #51 current head `e5388fd1db1533db1d5abcf7bd5f52fc5f09ad2b` also passed exact-head CI run #3357 (run ID `41056362508`). This does not resolve the overlapping approval-route/migration ownership between #49 and #51; do not merge either until an explicit integration order and independent review are recorded.
- PR #47/#49/#51/#59/#128 remain open drafts and unmerged. Physical hardware qualification, official exact-model approval, calibration, bench/site acceptance, methodology eligibility and production release remain HOLD.


## 2026-10-30 12:45Z — follow-up batch
- PR #128 head `852c6109b178e6313ed60c8674dd96e6730f5a2e`: exact-head CI run #3359 (`41057080062`) passed all configured steps, including disposable PostgreSQL acceptance and production-container build.
- PR #59 head `22904460e48fdbaada958a6b0a79bd6db8723ce0`: exact-head CI run #3360 (`41057128338`) passed all configured steps, including disposable PostgreSQL acceptance and production-container build.
- PR #51 head `e5388fd1db1533db1d5abcf7bd5f52fc5f09ad2b`: exact-head CI run #3357 (`41056362508`) passed all configured steps.
- The stateful replay/integrity matrix has been added to the simulation plan. It remains an acceptance specification; individual cases are not claimed passed unless backed by exact-head test evidence.
- PRs #47, #49, #51, #59 and #128 remain draft/unmerged. Resolve overlapping route/migration ownership between #49 and #51 before integration. Independent review, actual instrument/certificate/calibration packet, evidence-vault production contract, methodology/site eligibility, and bench/site qualification remain HOLD.


## 2026-10-30 13:25Z — TRL and migration-reconciliation checkpoint

- Refreshed PR #128 exact head: `b561c941c3658197e3d469b92163b5a73c1e3566`; exact-head CI run #3362 (`41057869797`) completed successfully. This is software validation only.
- PR #129 strict canonical field-sync timestamp fix is at head `e51a7fa719abcd082c6d099652c74d6a04193b99`; exact-head CI run #3299 (`41029236997`) reports success. PR #129 remains a separate draft and must be included in integration review rather than assumed present in #128.
- TRL execution plan PR #90 and evidence ledger PR #93 remain separate draft proposals. Use them as the canonical readiness/evidence route; do not create a competing hardware-specific TRL ledger.
- Audit PR #130 head `3d740ce0ad1b5b9b0f2e817fe894ce3a9fc8087d` has completed exact-head CI run #3383 (`41062818695`) successfully. The audit records a migration reconciliation blocker: current main migration catalogue and proposed hardware/evidence migrations differ, and the branch history diverges from main. Do not rebase/merge/apply #49/#51 migrations until the canonical manifest, authorized read-only production/staging ledger/schema evidence, schema fingerprints, removed/duplicate migration analysis and disposable fresh-install/upgrade acceptance are reconciled.
- PR #49/#51 continue to overlap on instrument approval routes and migrations; #51 also proposes evidence-bound parameter specifications and current-evidence guards. Explicitly select an integration order and independently review the combined diff before integration. Keep both drafts.
- No actual device model, official exact-model approval packet, calibration evidence, physical bench test, site acceptance, production DB mutation, procurement or deployment has been completed in this batch. Hardware/IoT TRL remains NOT ASSESSED where evidence is insufficient; overall TRL 9 and production certification remain HOLD/OFF.
