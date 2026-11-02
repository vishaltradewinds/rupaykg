# Settlement

Settlement converts eligible verified obligations or transactions into governed financial workflows.

## Lifecycle
`ELIGIBLE -> CREATED -> AUTHORIZED -> EXECUTING -> RECONCILING -> SETTLED`

Failure states: `REJECTED`, `FAILED`, `CANCELLED`.

Settlement must reference the exact source records and amounts that made it eligible. Financial state is not inferred from a UI event. Payment-provider or ledger responses are persisted with external identifiers and reconciliation status.

Automated payment or smart-contract execution may be used where configured, but it is a downstream execution mechanism, not evidence that the underlying physical activity occurred.
