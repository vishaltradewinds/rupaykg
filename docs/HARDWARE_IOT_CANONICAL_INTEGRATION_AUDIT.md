> **Historical snapshot — superseded 2026-10-31.** Historical source audit dated 2026-10-30. Its workstation checkout evidence is a preserved historical snapshot, not a current branch/runtime assertion. The consolidated current review is `docs/HARDWARE_IOT_CONSOLIDATED_ENGINEERING_REVIEW_2026-10-31.md` and draft PR #158.

# RupayKg Hardware/IoT Canonical Integration Audit

**Audit date:** 2026-10-30  
**Workstream:** `hardware/iot-stack-parallel-2026-10-30`  
**Status:** Source-level audit; implementation gates remain open  
**Evidence boundary:** GitHub main source plus a read-only inspection of the workstation checkout `C:\\Users\\Vishal\\rupaykg-live` on branch `fix/guardian-hedera-gate-20261010`. The checkout contained unrelated uncommitted changes; none were modified.

## Executive finding

RupayKg already has meaningful field-device and offline-sync primitives. The correct path is to extend those canonical primitives and reconcile the existing hardware assurance PRs, not create another IoT platform.

However, **field-device identity verification is not equivalent to exact-model instrument approval, calibration validity or measurement admissibility**. These are distinct controls. The hardware assurance implementation already exists as proposed work in draft PRs #47, #49 and #51, so this workstream must coordinate with those changes rather than duplicate them.

## Source-level inventory observed

| Capability | Evidence observed | Assessment / remaining gate |
|---|---|---|
| Field-device enrollment | `apps/src/sync-routes.ts`, `POST /api/v1/field-devices/enroll` | Existing identity/organization authorization and PENDING enrollment. Device identity does not prove the attached instrument is approved. |
| Field-device verification | `apps/src/sync-routes.ts`, `POST /api/v1/field-devices/:deviceId/verify` | Sets device status VERIFIED after governance authorization. Must not be treated as metrology or product certification. |
| Device inventory | `GET /api/v1/field-devices` in `apps/src/sync-routes.ts` | Organization membership-scoped listing exists. Confirm permissions and facility/geography boundaries through full tests/review. |
| Sync envelope | `POST /api/v1/field-sync/envelopes` and `field_sync_envelopes` | Source supports identity binding, idempotency key, client sequence, captured timestamp, payload/hash, server cursor and replay handling. Confirm exact migration constraints and conflict behavior before relying on it for instrument evidence. |
| Offline field capture | `apps/web/src/field-capture-experience.ts` | UI contains local drafts and authoritative-sync requirement for a verified field device. Browser-local drafts are not themselves authoritative evidence. |
| Measurement handoff | `apps/src/sync-routes.ts` operation handler for `MEASUREMENT_CREATE`; `apps/src/mrv-routes.ts` reads MRV observations | Existing measurement and MRV concepts exist, but direct device-to-measurement linkage and model-specific approval/calibration checks must be traced end to end. |
| Evidence | Sync operation supports `EVIDENCE_CREATE`; schema references evidence/measurement relationships | Need exact canonical evidence-vault artifact contract, immutable source envelope linkage and hash recomputation at acceptance. Do not add a competing store. |
| Hardware assurance | Draft PRs #47, #49 and #51 | Proposed model-specific approval register, MRV instrument gate and evidence-bound parameter specifications exist as review candidates. Do not assume merged or deployed. |
| National reference architecture | Draft PR #59, branch `docs/open-hardware-stack-evaluation` | Already defines pan-India shared core, facility/instrument profiles, open-source evaluation and software-only simulation. Reuse its design; do not create another architecture fork. |
| Site reality/methodology gate | PR #47/#49 hardware notes | Kathonda is not proven to be an active landfill-methane-recovery boundary. Do not purchase methane-specific hardware or assume BM WA03.001 eligibility. Confirm the actual project activity and current operator/site records first. |

## Existing hardware PR coordination

- **PR #47 — Add fail-closed hardware and instrumentation approval register:** documentation/register and site/methodology HOLD.
- **PR #49 — Enforce model-specific hardware approval before MRV eligibility:** proposed application/schema gate for exact instrument approval.
- **PR #51 — Bind MRV instrument approvals to reviewed evidence and parameter specs:** proposed evidence-vault-bound approval, parameter ranges/units/accuracy and ingestion/MRV enforcement.
- **PR #59 — Document open-source hardware stack evaluation and qualification gates:** national architecture and synthetic-only software simulation plan.
- **PR #128 — this workstream:** integration reconciliation and missing end-to-end test evidence, not a replacement for those PRs.

PR descriptions report CI results for earlier exact heads, but all listed PRs must be checked for their *current* state/head, review status and whether changes are already included in main before any implementation decision. A green CI run on a draft PR does not mean the change is merged or production accepted.

## Parallel PR status refreshed — 2026-10-30 08:06 UTC

The current heads were refreshed: #47 `7812f6f`, #49 `4d606e1`, #51 `e526914`, and #59 `0d9c2e4`. All four remain open draft PRs; none is merged. #49 and #51 both change the MRV instrument approval routes and migrations `088_mrv_instrument_approval_register.sql` and `089_measurement_instrument_binding_guard.sql`; #51 also adds parameter-spec, evidence-vault and MRV-freeze migrations. This overlap confirms that this workstream must not add its own approval table, route, or evidence store. The implementation on this branch is intentionally limited to a package-local adapter-output validator and synthetic tests pending a canonical decision on those draft PRs.

The latest edge contract is under `packages/hardware-edge`. Root `build` now includes `@rupaykg/hardware-edge`, so it is not omitted from the normal production build chain. CI for commit `21d39d2e26ef2331d108e461a6e8935c4b7fcbba` was queued at the time of this update.

## Highest-priority gaps

1. **Establish the live main baseline.** Determine whether PR #49/#51 and relevant migrations have merged since the workstation checkout was created. Do not apply a duplicate schema or migration.
2. **Trace immutable lineage.** Prove the relationship from the source `field_sync_envelopes.id` and `payload_hash` through normalized measurement, evidence artifact, instrument approval/calibration record and MRV observation. Where the schema does not support the relationship, design the smallest additive change after reviewing existing PRs.
3. **Calibration and parameter gate.** Missing, expired, out-of-scope or evidence-unverified calibration must block acceptance for measurements requiring calibrated instruments. Bind unit/range/resolution/accuracy to the exact instrument model and parameter, not a free-text source.
4. **Synthetic-only test boundary.** Build deterministic tests for duplicate/replay, changed payload with same event key, sequence regression, invalid timestamps, units/range, unknown device/instrument, calibration expiry, wrong tenant/facility, offline replay and attempts to reach production/external anchoring. Synthetic fixtures must never become authoritative MRV evidence.
5. **Instrument-specific first adapter.** Weighbridge is only a candidate priority. Do not implement serial/Modbus assumptions until the actual indicator model/manual and electrical/protocol details are available. A read-only adapter is the default.
6. **Site and methodology applicability.** Obtain actual project boundary, operator authority, facility activity, approved methodology and monitoring plan before selecting gas, energy, flow or other methodology-specific sensors.
7. **Exact-model qualification.** Record applicable MeitY/STQC/BIS/WPC/Legal Metrology and safety requirements per finished product and intended use. User policy requires verified applicable MeitY approval; if the exact route/model cannot be evidenced, status remains HOLD.
8. **TRL and operations.** Record TRL as provisional and evidence-backed, and include maintainability, local spares, security updates, calibration renewals, recovery drills and decommissioning.

## Next execution batch

1. Refresh PR #47/#49/#51/#59 current heads/status and inspect their changed files.
2. Compare proposed migrations and routes against the actual main branch and local source; preserve the unrelated uncommitted local files.
3. Run the existing targeted field-sync/measurement tests in an isolated local test context; record exact command and result. Do not run tests that can mutate shared staging/production.
4. Add only missing regression tests or a narrowly scoped adapter contract to this workstream, with synthetic-only fixtures and no external network writes.
5. Require exact-head CI and independent review before merge. Keep hardware approval, site acceptance and production certification HOLD until real instrument/calibration evidence is available.

## No claims made

This audit does not claim hardware purchase, instrument connectivity, model certification, calibration, hardware-in-the-loop testing, field acceptance, government approval or production deployment. No production database, deployment, external portal or physical device was changed.
