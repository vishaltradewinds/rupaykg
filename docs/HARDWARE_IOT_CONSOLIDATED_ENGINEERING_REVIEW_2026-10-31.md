# RupayKg Hardware/IoT Consolidated Engineering Review — 2026-10-31

## Decision

Consolidate the overlapping hardware work into one review path. This branch is based on the evidence-bound instrument approval implementation from PR #51 and adds the isolated edge adapter contract and pan-India/site evidence architecture from PRs #128, #47 and #59.

- PR #51 supplies the broadest instrument assurance implementation: exact model/SKU approval, evidence-vault artifact binding, parameter specifications, range/unit/resolution/accuracy checks, and MRV/field-sync/database enforcement.
- PR #49 contains the earlier overlapping instrument approval register and measurement binding migrations. Those same migration files are present in #51; #51 adds the subsequent evidence-bound parameter and revocation/concurrency protections.
- PR #128 adds only the isolated `@rupaykg/hardware-edge` contract, tests, root build inclusion and integration audit. It does not add a second instrument registry, ingestion API, or evidence store.
- PR #47 contributes exact-model approval evidence intake, site/operator evidence requests, and the Jabalpur site/methodology HOLD.
- PR #59 contributes the pan-India vendor-neutral reference architecture, open-source stack evaluation, and synthetic-only software simulation plan.

This is a source-level consolidation. It is not a merge, procurement decision, hardware qualification, or production activation.

## Canonical end-to-end path

```
Physical instrument (exact make/model/SKU/serial + manual + calibration)
  -> documented interface adapter (only protocols confirmed by the manual)
  -> raw frame preserved with source/time/sequence/digest
  -> local durable offline queue and bounded retry
  -> isolated edge contract validation (non-authoritative)
  -> canonical authenticated RupayKg field-sync envelope
  -> exact-model instrument approval + parameter/unit/range/accuracy + current calibration gate
  -> existing evidence vault with immutable artifact/version/hash and independent review
  -> canonical activity/measurement/custody records
  -> methodology-specific MRV evaluation and independent authorization
  -> any external authority/Guardian/HCS workflow remains separately gated
```

The edge package returns `READY_FOR_REVIEW` only. It does not authenticate a physical device, validate a calibration certificate, approve an instrument, persist evidence, create a measurement, or establish MRV eligibility.

## Hardware and compliance rules

1. Field-device enrollment is not exact-model instrument approval. Gateway identity and attached measurement instrument eligibility are separate.
2. The user's mandatory MeitY requirement is applied to the exact finished product/model and intended use. Do not assume one blanket MeitY certificate applies to every industrial sensor, meter, PLC, gateway or weighbridge.
3. Check applicable BIS/QCO, Legal Metrology, TEC/MTCTE, WPC/ETA, electrical safety, EMC, cybersecurity/firmware lifecycle and procurement requirements for the exact product class and deployment context. Do not claim approval without official evidence.
4. A realistic hybrid hardware strategy is allowed. Do not require 100% Indian design/manufacture; evaluate indigenous processors/boards and Indian PCB/fabrication options on evidence, cost, support and qualification.
5. No RS-232, RS-485, Modbus, Ethernet, pulse output or other physical interface is assumed until the exact instrument manual and electrical/interface specification prove it.
6. No actual hardware, calibration, site data, or LGD/government geography is fabricated. Synthetic data remains confined to tests and software-only simulation.

## Site and methodology boundary

SITE-JBP-01 Kathonda remains a site-specific evidence and methodology HOLD. The Jabalpur waste facility's actual process boundary, operator, permits, process flow, weighbridge/instrument inventory, and any distinct proposed Bio-CNG project must be independently established before selecting instruments or associating measurements with BM WA03.001 or another methodology. Do not treat a proposed project as an operating asset, and do not generalize site assumptions to the pan-India platform.

The Jabalpur measurement requirements register is an optional site evidence pack, not a national platform schema.

## Current source-level inventory

| Layer | Existing capability / proposed component | Status |
|---|---|---|
| Device identity | Existing field-device enrollment, verification, identity/org binding | Implemented in repository; exact production acceptance remains external |
| Offline ingestion | Canonical field-sync envelope, idempotency, sequence/replay controls | Existing canonical path; retain as only ingestion boundary |
| Edge adapter | `@rupaykg/hardware-edge` stateless validator | Implemented in branch; no physical driver |
| Instrument approval | `mrv_instruments`, approval decisions, exact-model evidence | Implemented in PR #51 branch; independent review pending |
| Parameter specifications | Instrument-bound unit/range/resolution/accuracy specs | Implemented in PR #51 branch; independent review pending |
| Evidence lineage | Evidence-vault artifact/version/hash/review binding | Implemented in PR #51 branch; independent review pending |
| Physical interface | RS-232/RS-485/Modbus/PLC/RTU/gateway adapters | Not qualified; manual-specific work pending |
| Calibration | Exact instrument calibration/traceability/uncertainty evidence | No physical certificate accepted |
| Site acceptance | Bench/reference instrument, environmental/fault, operator/site acceptance | Not performed |
| Production | Live deployment and sustained field operation | HOLD |

## Exact-head validation evidence (historical PRs)

- PR #51 exact head `1824d2a342ab64850575c9488a544edf3c80cbd5`: CI run #41058468210 passed.
- PR #128 exact head `3d8265e1a29eb2232db111cd888d94c7992af7c4`: CI run #41127635122 passed.
- PR #47 exact head `7812f6f98f1d136604f7100493a3e7749aa85454`: CI run #40287031621 passed.
- PR #59 exact head `a1ddd1b5d93f571daf64f6bdce6bc36381bbe8b3`: CI run #41059092409 passed.

These are separate historical PR runs. They do not prove that this consolidated head passes CI; a fresh run on this exact integrated branch is required.

## Required Shakti gates before any hardware qualification

1. Fresh exact-head CI for the consolidated branch; inspect all PostgreSQL tests and skipped counts.
2. Independent review of migrations, authorization, evidence revocation/concurrency, parameter specification and MRV freeze controls.
3. Resolve PR overlap by retaining one canonical approval implementation; do not merge #49 separately from #51.
4. Obtain actual site/operator asset register and exact instrument make/model/SKU/serial/manual/interface.
5. Verify applicable MeitY/BIS/TEC/MTCTE/WPC/Legal Metrology/safety requirements for each exact device.
6. Obtain current calibration certificate, traceability chain, uncertainty, validity, laboratory scope/accreditation and as-found/as-left results where applicable.
7. Run bench tests against a traceable reference instrument, including fault injection, drift, clock loss, power loss, network loss, replay, tampering, sequence gaps and calibration expiry.
8. Demonstrate immutable lineage from raw instrument frame to evidence-vault artifact, parameter-bound measurement and MRV observation.
9. Conduct witnessed site acceptance with the actual operator, permissions, electrical/network safety, environmental conditions and operating procedure.
10. Demonstrate sustained operation, monitoring, maintenance, calibration renewal, incident response, backup/recovery and change control.

## TRL decision

The edge contract and synthetic tests are software engineering evidence only. They do not establish hardware-in-the-loop validation, relevant-environment validation, operational qualification or TRL 9. Software, instrument, integrated-site and pan-India operational TRL must be tracked separately and advanced only with evidence from each relevant environment.

## Release posture

- Consolidated PR: draft; not merged.
- Physical device selection/procurement: HOLD.
- Live instrument connection: OFF.
- Production MRV eligibility from edge package alone: prohibited.
- Production deployment / scheduler / external submission: not authorized by this document.
- Hardware qualification and TRL 9: not established.


## Additional open metrology gate: parameter-specific uncertainty

The instrument approval implementation validates exact-model evidence, calibration status, parameter unit/range/resolution and accuracy metadata. A source audit identified that the current calibration uncertainty is stored as one instrument-level scalar, while a multi-parameter instrument can have different uncertainty values and units for each parameter. Parameter specifications do not yet carry a complete reviewed per-parameter uncertainty statement, and the instrument-bound measurement path does not persist that uncertainty into each MRV observation.

See `docs/MRV_INSTRUMENT_UNCERTAINTY_LINEAGE_GAP_2026-10-31.md`. Do not use a generic uncertainty ratio or invent a universal threshold. A parameter-specific uncertainty model and immutable measurement/MRV lineage must be designed from the actual calibration certificate, applicable standard and methodology before production MRV eligibility. Until then, instrument approval code is an engineering foundation, not complete metrological qualification.
