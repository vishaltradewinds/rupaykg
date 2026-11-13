# Golden Transaction Readiness — 2026

## Current implementation assessment

The canonical backend already enforces important lifecycle preconditions:

- authenticated session and verified organization membership;
- authorized activity geography;
- verified evidence with provenance content;
- approved verification before carbon calculation;
- registered methodology version before carbon calculation;
- Guardian MRV only after completed activity, approved verification and VERIFIED evidence;
- HCS anchoring only after Guardian VERIFIED with an execution ID.

## Remaining proof required

Implementation should now focus on exercising the existing contracts with real authorized data rather than adding parallel workflow logic.

1. Identify a real authorized Urban organization/geography and transaction.
2. Identify a real authorized Rural organization/geography and transaction.
3. Execute the lifecycle using existing APIs.
4. Capture authoritative IDs/statuses.
5. Verify registry eligibility is an explicit backend decision after provenance.
6. Verify credential, transfer/retirement and settlement are explicit backend states and are not inferred from HCS.
7. Run negative authorization and missing-precondition cases.

## External blockers

Production Guardian credentials/endpoints and Hedera production configuration must be available before a real VERIFIED + CONSENSUS_CONFIRMED claim can be made. If unavailable, fail-closed behavior is the correct result.

## Deployment constraint

All changes belong to `vishaltradewinds/rupaykg` on `main` and must use the existing free Render service `rupaykg`. No second service or paid resource is to be created.


## 2026-11-13 production readiness evidence

A read-only production Neon audit found only two VERIFIED `test_fixture` organizations; zero activities, resource flows, measurements, evidence, verifications, field devices, MRV provenance events, credentials, registry events or settlements. The only geography row is the source-versioned acceptance-fixture cluster `RUPAYKG-ACCEPTANCE-V1`; no source-versioned ULB/Ward/Block/Gram Panchayat/Village geography is present.

Therefore:
- Urban Golden Transaction: **NOT EXECUTED — no real ULB/Ward geography, real organization transaction or field evidence in production**.
- Rural Golden Transaction: **NOT EXECUTED — no real Block/GP/Village geography, biomass activity, aggregation lineage or field evidence in production**.
- CI acceptance seed: **SYNTHETIC TEST ONLY**, not site evidence and not a TRL claim.
- Do not populate production with invented organizations, geography, measurements or evidence to make the checklist pass.

Required field inputs remain the official site/ULB/GP authorization records, real participating Generator + Aggregator + Processor/Recycler identities and memberships, source-backed geography, actual weighbridge/device calibration and measurement records, evidence artifact(s), and authorized independent verification. Until then, keep both Golden Transactions blocked and the platform at pre-validation for SITE-JBP-01.
