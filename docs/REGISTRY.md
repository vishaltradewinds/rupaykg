# Credentials and Registry

Environmental credentials are claims backed by verified source records and an authorized issuer.

## Issuance requirements
- source activity and measurement persisted
- required evidence verified
- methodology/calculation complete where applicable
- issuer identity bound to a configured trust root
- authorization decision recorded

## Registry lifecycle
`ISSUED -> ACTIVE -> TRANSFERRED -> RETIRED`

Transfers and retirements require authoritative registry persistence. If a configured registry/depository is unavailable, the operation fails closed and the UI reports the actual state.

Registry projections must be reconstructable from domain events and audit records.
