# Golden Transaction Test Matrix — 2026

| Gate | Urban | Rural | Expected behavior |
|---|---|---|---|
| Authenticated session | Required | Required | Unauthenticated mutation rejected |
| Verified organization | Required | Required | Wrong organization rejected |
| Authorized geography | ULB/Ward | Block/GP/Village | Out-of-scope activity rejected |
| Real activity | Required | Required | Synthetic production data prohibited |
| Measurement | Required | Required | Missing measurement blocks value path |
| Evidence | Required | Required | Unverified/missing evidence blocks downstream path |
| Approved verification | Required | Required | Unapproved verification blocks MRV/value |
| Guardian MRV | Required for claim | Required for claim | Unavailable/failed Guardian remains blocked |
| HCS provenance | Required for claim | Required for claim | No consensus means no provenance confirmation |
| Eligibility | Explicit decision | Explicit decision | Must not be inferred from HCS |
| Credential/registry | Explicit backend state | Explicit backend state | Must not be inferred from eligibility alone |
| Transfer/retirement | Explicit backend state | Explicit backend state | Must not be inferred from credential issuance |
| Settlement | Explicit authorization + state | Explicit authorization + state | Must not be inferred from retirement |

## Acceptance evidence

For each successful real transaction record the authoritative IDs and statuses at every stage. For each negative test record the endpoint, expected HTTP outcome/code, and confirmation that no unauthorized downstream mutation occurred.
