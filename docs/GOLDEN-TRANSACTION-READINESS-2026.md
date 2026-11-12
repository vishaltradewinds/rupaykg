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

## Live production evidence checkpoint — 2026-11-13

A read-only inspection was performed against the authoritative Neon production target:

- Project: `steep-mud-79906940` (`rupaykg-production-fresh`)
- Branch: `br-restless-base-b44cip2h` (`main`)
- Database: `rupaykg`
- Session identity observed: `rupaykg`
- No production data or schema was modified.

### Observed live data inventory

| Entity | Rows |
|---|---:|
| Organizations | 2 |
| Organization types | 2 `test_fixture` |
| Geography | 1 (`CLUSTER`) |
| Verified organization geography scopes | 0 |
| Activities | 0 |
| Resource flows | 0 |
| Chain-of-custody links | 0 |
| Measurements | 0 |
| Evidence | 0 |
| Verifications | 0 |
| MRV provenance events | 0 |
| Credentials | 0 |
| Registry events | 0 |

The database geography enum supports `ULB`, `WARD`, `GRAM_PANCHAYAT`, and `VILLAGE` in addition to higher-level geography kinds. However, the current live data contains only one `CLUSTER` row and no verified organization geography scopes. The `activities` table has no dedicated urban/rural mode column in the inspected schema; the implementation must preserve a single lifecycle with geography-authorized Urban and Rural contexts rather than introduce an unverified second source of truth.

### Acceptance conclusion

- **Live Urban Golden Transaction:** NOT STARTED — no authorized ULB/Ward scope or activity exists in the inspected live data.
- **Live Rural Golden Transaction:** NOT STARTED — no authorized Gram Panchayat/Village scope or activity exists in the inspected live data.
- **Evidence-to-measurement chain:** NOT STARTED — all relevant live record counts are zero.
- **Independent verification:** NOT STARTED.
- **Guardian/Hedera provenance:** NOT STARTED — no live provenance rows; CI fixtures are not live evidence.
- **Credential/registry/settlement:** NOT STARTED — no live credentials or registry events.

The existing `lifecycle-integration.test.ts` is a rollback-only database fixture. It directly inserts synthetic test data and an explicitly synthetic Guardian/HCS provenance row because CI has no live external provider credentials. It proves selected database constraints and state transitions only; it does not prove a real field transaction, authenticated Guardian policy execution, Hedera consensus, or government acceptance.

### Required next inputs

1. Authorize/identify the real Urban participating organization, ULB/Ward geography, and its verified membership/scope.
2. Authorize/identify the real Rural participating organization, Gram Panchayat/Village geography, and its verified membership/scope.
3. Capture actual generator → aggregator → transporter → recycler custody handoffs, calibrated measurement records, and source evidence.
4. Obtain an independent verifier with the required permission and a separate identity from the submitting actor.
5. Run the live Guardian policy and verify HCS consensus + Mirror Node digest against the exact evidence snapshot.
6. Record each stage's authoritative IDs and states; do not infer downstream eligibility, credential issuance, transfer/retirement, settlement, or statutory acceptance.

**Decision:** the software lifecycle has a disposable CI proof path, but the live operational Golden Transaction has not begun. No synthetic production data is to be created to make this checkpoint appear complete.
