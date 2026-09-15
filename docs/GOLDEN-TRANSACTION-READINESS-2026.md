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
